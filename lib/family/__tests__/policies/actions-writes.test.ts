/**
 * The WRITE half of the server-action surface, against the live local stack.
 *
 * `actions.test.ts` covers punching in, creating, deleting and the actor-cookie
 * rules; this file covers everything that changes an existing row —
 * `updateCategory`, `reorderCategories`, `clearProfilePin`,
 * `updateHouseholdSettings` and the three avatar actions — with the same
 * plumbing: Next's cookie store is an in-memory jar, the request's Supabase
 * session is a real signed-in client, and everything else (guards, the signed
 * actor cookie, the admin client, RLS, the DB triggers, Storage) is the
 * production code talking to the real database.
 *
 * Two households are created per run: the one the test user belongs to, and a
 * second one nobody in this file can reach. Every tenancy assertion uses a row
 * from that second household, because "an id is not a capability" is only
 * proved by handing a real, live id to an action and watching it refuse.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import type { ActionError, ActionResult } from "@/lib/family/errors";
import {
  LOCAL,
  adminClient,
  createPool,
  createUsers,
  deleteHousehold,
  deleteUsers,
  fixtures,
  insertCategory,
  insertHousehold,
  testEmail,
  userClient,
  type FixtureUser,
} from "./helpers";

const ACTOR_COOKIE = "family_actor";
const BUCKET = "family-avatars";
/** D16 / the bucket's own limit — stated as a number so the test does not inherit the bug. */
const FIVE_MB = 5 * 1024 * 1024;

// Hoisted: the mock factories below run before any import is evaluated.
const state = vi.hoisted(() => ({
  /** Name → value, exactly what the browser would send back on the next request. */
  cookies: new Map<string, string>(),
  /** The signed-in Supabase session this "request" carries. */
  client: null as SupabaseClient | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));
vi.mock("next/headers", () => {
  const read = (name: string) => {
    const value = state.cookies.get(name);
    return value === undefined ? undefined : { name, value };
  };
  const jar = {
    get: read,
    getAll: () => [...state.cookies].map(([name, value]) => ({ name, value })),
    has: (name: string) => state.cookies.has(name),
    // `lib/family/actor.ts` only ever calls the (name, value, options) form.
    set(name: string, value: string, options?: { maxAge?: number }) {
      // Max-Age=0 is how `clearActor` deletes: the cookie is gone next request.
      if (options?.maxAge === 0) state.cookies.delete(name);
      else state.cookies.set(name, value);
      return jar;
    },
    delete(name: string) {
      state.cookies.delete(name);
      return jar;
    },
  };
  return { cookies: async () => jar, headers: async () => new Headers() };
});
vi.mock("@/lib/family/supabase/server", () => ({
  createClient: async () => {
    if (!state.client) throw new Error("actions-writes.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

// Imported after the environment above is in place, so nothing can capture a
// missing key at module-evaluation time.
const { removeAvatar, signAvatarUrls, uploadAvatar } = await import("@/lib/family/actions/avatars");
const { reorderCategories, updateCategory } = await import("@/lib/family/actions/categories");
const { clearProfilePin } = await import("@/lib/family/actions/pins");
const { punchIn, punchOut } = await import("@/lib/family/actions/punch-in");
const { updateHouseholdSettings } = await import("@/lib/family/actions/settings");

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

function expectFailure(result: ActionResult<unknown>, code: ActionError): void {
  expect(result).toMatchObject({ ok: false, error: code });
}

/** A genuine 1×1 PNG — the bytes matter, the filename never does. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function upload(bytes: Uint8Array, filename: string, declaredType: string): FormData {
  const form = new FormData();
  // Copy into a plain ArrayBuffer: a Node Buffer's is typed ArrayBufferLike,
  // which BlobPart does not accept.
  const body = new Uint8Array(bytes).slice().buffer as ArrayBuffer;
  form.append("file", new Blob([body], { type: declaredType }), filename);
  return form;
}

interface CategoryFacts {
  label: string;
  color: string;
  role: string;
  birthday: string | null;
  sort_order: number;
  has_pin: boolean;
  updated_by: string | null;
  avatar_kind: string | null;
  avatar_id: string | null;
  avatar_path: string | null;
}

const CATEGORY_FACTS =
  "label, color, role, birthday::text as birthday, sort_order::float8 as sort_order, " +
  "has_pin, updated_by, avatar_kind, avatar_id, avatar_path";

describe("server actions: updates, reordering, settings and avatars", () => {
  const fx = fixtures();
  const run = fx.run;
  const PARENT_PIN = "1111";
  const PROMOTED_PIN = "2222";
  const MEMBER_PIN = "3333";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  /** The household's founding parent — the actor for most of this file. */
  let parentId: string;
  /** Starts a member, is promoted to parent by the updateCategory suite. */
  let promotedId: string;
  /** Stays a member for the whole run: the FR-015 refusals need one. */
  let memberId: string;
  let photoId: string;
  let labelId: string;
  /** A live parent profile in a household this user has no claim on. */
  let foreignId: string;
  let foreignPath: string;

  async function readCategory(id: string): Promise<CategoryFacts> {
    const { rows } = await pool.query<CategoryFacts>(
      `select ${CATEGORY_FACTS} from family.categories where id = $1`,
      [id],
    );
    const [row] = rows;
    if (!row) throw new Error(`no category ${id}`);
    return row;
  }

  /** Ids of this household's categories, in the order the database would render them. */
  async function orderedIds(): Promise<string[]> {
    const { rows } = await pool.query<{ id: string }>(
      "select id from family.categories where household_id = $1 order by sort_order",
      [householdId],
    );
    return rows.map((row) => row.id);
  }

  async function sortOrders(ids: readonly string[]): Promise<number[]> {
    const values: number[] = [];
    for (const id of ids) values.push((await readCategory(id)).sort_order);
    return values;
  }

  async function readHousehold(): Promise<{ name: string; updated_by: string | null }> {
    const { rows } = await pool.query<{ name: string; updated_by: string | null }>(
      "select name, updated_by from family.households where id = $1",
      [householdId],
    );
    const [row] = rows;
    if (!row) throw new Error("household disappeared");
    return row;
  }

  async function readSettings(): Promise<{ punch_out_minutes: number; updated_by: string | null }> {
    const { rows } = await pool.query<{ punch_out_minutes: number; updated_by: string | null }>(
      "select punch_out_minutes, updated_by from family.household_settings where household_id = $1",
      [householdId],
    );
    const [row] = rows;
    if (!row) throw new Error("settings row disappeared");
    return row;
  }

  /** Setup only: the action-level path through `set_pin` is `actions.test.ts`'s job. */
  async function givePin(profileId: string, pin: string): Promise<void> {
    const { error } = await admin
      .schema("family")
      .rpc("set_pin", { p_user_id: user.id, p_profile: profileId, p_pin: pin });
    if (error) throw error;
  }

  async function punchInAs(profileId: string, pin: string): Promise<void> {
    expectOk(await punchIn(profileId, pin));
  }

  async function bucketNames(prefix: string): Promise<string[]> {
    const listed = await admin.storage.from(BUCKET).list(prefix);
    if (listed.error) throw listed.error;
    return (listed.data ?? []).map((object) => object.name);
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-writes`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-writes-other`);
    const email = testEmail("writes-a", run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      email,
    ]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error("expected one fixture account");
    user = created;

    parentId = await insertCategory(pool, {
      householdId,
      label: `Parent ${run}`,
      color: "#2178AF",
      role: "parent",
    });
    promotedId = await insertCategory(pool, {
      householdId,
      label: `Kid ${run}`,
      color: "#B6E085",
      role: "member",
    });
    memberId = await insertCategory(pool, {
      householdId,
      label: `Teen ${run}`,
      color: "#CB434C",
      role: "member",
    });
    photoId = await insertCategory(pool, {
      householdId,
      label: `Snap ${run}`,
      color: "#F66951",
      role: "member",
    });
    labelId = await insertCategory(pool, {
      householdId,
      label: `Holidays ${run}`,
      color: "#FDC36D",
      isProfile: false,
    });
    foreignId = await insertCategory(pool, {
      householdId: otherHouseholdId,
      label: `Foreign ${run}`,
      color: "#915EA1",
      role: "parent",
    });

    // The foreign profile carries a REAL photo, so `signAvatarUrls` omitting it
    // can only be the household filter and never a missing object.
    foreignPath = `${otherHouseholdId}/${foreignId}.png`;
    const seeded = await admin.storage
      .from(BUCKET)
      .upload(foreignPath, PNG_1X1, { contentType: "image/png", upsert: true });
    if (seeded.error) throw seeded.error;
    await pool.query(
      "update family.categories set avatar_kind = 'photo', avatar_path = $2 where id = $1",
      [foreignId, foreignPath],
    );

    // Binds the allowlist row to the account, exactly as the first sign-in
    // does — `set_pin` refuses a caller who has not claimed yet.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(parentId, PARENT_PIN);
    await givePin(promotedId, PROMOTED_PIN);
    await givePin(memberId, MEMBER_PIN);
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await admin.storage.from(BUCKET).remove([foreignPath, `${householdId}/${photoId}.png`]);
    await deleteHousehold(pool, householdId);
    await deleteHousehold(pool, otherHouseholdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  describe("updateCategory", () => {
    beforeAll(async () => {
      await punchInAs(parentId, PARENT_PIN);
    });

    it("a parent renames a profile and the row really changes", async () => {
      const renamed = `Kid renamed ${run}`;
      const result = expectOk(await updateCategory(promotedId, { label: renamed }));
      expect(result.label).toBe(renamed);
      expect(await readCategory(promotedId)).toMatchObject({ label: renamed, color: "#B6E085" });
    });

    it("refuses to demote the only parent → CONFLICT, and the trigger agrees", async () => {
      expectFailure(await updateCategory(parentId, { role: "member" }), "CONFLICT");
      expect((await readCategory(parentId)).role).toBe("parent");

      // The app pre-check is a courtesy; the database is the guarantee. Both
      // must refuse, or one of them is decoration.
      await expect(
        pool.query("update family.categories set role = 'member' where id = $1", [parentId]),
      ).rejects.toMatchObject({ code: "23514", message: expect.stringContaining("LAST_PARENT") });
      expect((await readCategory(parentId)).role).toBe("parent");
    });

    it("refuses a birthday on a Label → VALIDATION (Profiles and Labels are one record, FR-019)", async () => {
      expect(await updateCategory(labelId, { birthday: "2014-05-02" })).toMatchObject({
        ok: false,
        error: "VALIDATION",
        fieldErrors: { birthday: [expect.any(String)] },
      });
      expect((await readCategory(labelId)).birthday).toBeNull();
    });

    it("an id from another household is NOT_FOUND, not an edit", async () => {
      const before = await readCategory(foreignId);
      expectFailure(await updateCategory(foreignId, { label: `Hijacked ${run}` }), "NOT_FOUND");
      expect(await readCategory(foreignId)).toEqual(before);
    });

    it("stamps updated_by with the profile that is punched in (FR-016)", async () => {
      expectOk(await updateCategory(promotedId, { role: "parent" }));
      expect(await readCategory(promotedId)).toMatchObject({ role: "parent", updated_by: parentId });

      // A different parent takes over the tablet: the attribution follows them.
      expectOk(await punchOut());
      await punchInAs(promotedId, PROMOTED_PIN);
      expectOk(await updateCategory(labelId, { color: "#A8D4D3" }));
      expect(await readCategory(labelId)).toMatchObject({
        color: "#A8D4D3",
        updated_by: promotedId,
      });
    });
  });

  describe("reorderCategories", () => {
    let reversed: string[];

    beforeAll(async () => {
      expectOk(await punchOut());
      await punchInAs(parentId, PARENT_PIN);
      reversed = [labelId, photoId, memberId, promotedId, parentId];
    });

    it("writes the requested order into sort_order", async () => {
      expectOk(await reorderCategories(reversed));
      expect(await orderedIds()).toEqual(reversed);
      expect(await sortOrders(reversed)).toEqual([1000, 2000, 3000, 4000, 5000]);
    });

    it("is idempotent when the same order is replayed", async () => {
      expectOk(await reorderCategories(reversed));
      expect(await orderedIds()).toEqual(reversed);
      expect(await sortOrders(reversed)).toEqual([1000, 2000, 3000, 4000, 5000]);

      // And a real move still lands.
      const moved = [parentId, ...reversed.slice(0, 4)];
      expectOk(await reorderCategories(moved));
      expect(await orderedIds()).toEqual(moved);
    });

    it("an id from another household is NOT_FOUND and moves nothing", async () => {
      const before = await orderedIds();
      const beforeOrders = await sortOrders(before);
      const foreignBefore = await readCategory(foreignId);

      expectFailure(await reorderCategories([foreignId, ...before]), "NOT_FOUND");

      expect(await orderedIds()).toEqual(before);
      expect(await sortOrders(before)).toEqual(beforeOrders);
      expect((await readCategory(foreignId)).sort_order).toBe(foreignBefore.sort_order);
    });
  });

  describe("clearProfilePin", () => {
    beforeAll(async () => {
      expectOk(await punchOut());
    });

    it("a member actor is refused → FORBIDDEN, and the PIN survives", async () => {
      await punchInAs(memberId, MEMBER_PIN);
      expectFailure(await clearProfilePin(promotedId), "FORBIDDEN");
      expect((await readCategory(promotedId)).has_pin).toBe(true);
    });

    it("a parent clears a PIN: has_pin flips and that profile can no longer punch in", async () => {
      expectOk(await punchOut());
      await punchInAs(parentId, PARENT_PIN);

      expectOk(await clearProfilePin(memberId));
      expect((await readCategory(memberId)).has_pin).toBe(false);

      expectFailure(await punchIn(memberId, MEMBER_PIN), "NO_PIN");
      // A refused punch-in never disturbs whoever is already at the tablet.
      expect(state.cookies.has(ACTOR_COOKIE)).toBe(true);
    });
  });

  describe("updateHouseholdSettings", () => {
    const renamed = `test-${run}-renamed`;

    beforeAll(async () => {
      await givePin(memberId, MEMBER_PIN);
      expectOk(await punchOut());
      await punchInAs(parentId, PARENT_PIN);
    });

    it("a parent changes the name and the punch-out window; each lands in its own table (D15)", async () => {
      const result = expectOk(
        await updateHouseholdSettings({ householdName: renamed, punchOutMinutes: 7 }),
      );
      expect(result.household.name).toBe(renamed);
      expect(result.settings.punchOutMinutes).toBe(7);

      expect(await readHousehold()).toEqual({ name: renamed, updated_by: parentId });
      expect(await readSettings()).toEqual({ punch_out_minutes: 7, updated_by: parentId });
    });

    it("refuses a punch-out window outside 1–60 and writes nothing at all", async () => {
      for (const punchOutMinutes of [0, 61]) {
        expectFailure(
          await updateHouseholdSettings({
            householdName: `Should not land ${run}`,
            punchOutMinutes,
          }),
          "VALIDATION",
        );
      }
      // The name travelled in the same patch: a rejected patch is rejected whole.
      expect((await readHousehold()).name).toBe(renamed);
      expect((await readSettings()).punch_out_minutes).toBe(7);
    });

    it("a member actor is refused → FORBIDDEN", async () => {
      expectOk(await punchOut());
      await punchInAs(memberId, MEMBER_PIN);

      expectFailure(await updateHouseholdSettings({ punchOutMinutes: 12 }), "FORBIDDEN");
      expect((await readSettings()).punch_out_minutes).toBe(7);
    });
  });

  describe("avatars", () => {
    const uploaded = () => `${householdId}/${photoId}.png`;

    beforeAll(async () => {
      expectOk(await punchOut());
      await punchInAs(parentId, PARENT_PIN);
    });

    it("refuses a payload whose BYTES are not an image, whatever the file claims (R7/D16)", async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
        "utf8",
      );
      const result = await uploadAvatar(photoId, upload(svg, "photo.png", "image/png"));
      expectFailure(result, "VALIDATION");
      // Refused by the byte sniff specifically — not by the "no file" branch.
      expect(result).toMatchObject({ message: expect.stringContaining("JPEG, PNG or WebP") });

      expect(await readCategory(photoId)).toMatchObject({
        avatar_kind: null,
        avatar_id: null,
        avatar_path: null,
      });
      expect(await bucketNames(householdId)).not.toContain(`${photoId}.png`);
    });

    it("refuses a file over 5 MB even when the bytes are a real image", async () => {
      const tooBig = Buffer.alloc(FIVE_MB + 1);
      PNG_1X1.copy(tooBig);

      const result = await uploadAvatar(photoId, upload(tooBig, "huge.png", "image/png"));
      expectFailure(result, "VALIDATION");
      // The bytes ARE a PNG, so only the size check can be doing this.
      expect(result).toMatchObject({ message: expect.stringContaining("larger than 5 MB") });

      expect((await readCategory(photoId)).avatar_kind).toBeNull();
    });

    it("stores a real PNG at <household>/<profile>.png and marks the row a photo", async () => {
      const result = expectOk(
        await uploadAvatar(photoId, upload(PNG_1X1, "anything.jpg", "image/webp")),
      );
      expect(result).toMatchObject({
        avatarKind: "photo",
        avatarPath: uploaded(),
        avatarId: null,
      });
      expect(await readCategory(photoId)).toMatchObject({
        avatar_kind: "photo",
        avatar_path: uploaded(),
        avatar_id: null,
        updated_by: parentId,
      });
      expect(await bucketNames(householdId)).toContain(`${photoId}.png`);
    });

    it("signs this household's photos for any member and silently omits a foreign id", async () => {
      // Reading avatars needs a member, not an actor (FR-008).
      expectOk(await punchOut());

      // Guard the guard: the foreign row IS a signable photo with a real object
      // behind it, so its absence below can only be the household filter.
      expect(await readCategory(foreignId)).toMatchObject({
        avatar_kind: "photo",
        avatar_path: foreignPath,
      });
      expect(await bucketNames(otherHouseholdId)).toContain(`${foreignId}.png`);

      const urls = expectOk(await signAvatarUrls([photoId, foreignId]));
      expect(Object.keys(urls)).toEqual([photoId]);

      const response = await fetch(urls[photoId]);
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer()).equals(PNG_1X1)).toBe(true);

      expect(expectOk(await signAvatarUrls([]))).toEqual({});
      await punchInAs(parentId, PARENT_PIN);
    });

    it("removeAvatar clears the row's avatar fields and drops the object", async () => {
      const result = expectOk(await removeAvatar(photoId));
      expect(result).toMatchObject({ avatarKind: null, avatarPath: null, avatarId: null });
      expect(await readCategory(photoId)).toMatchObject({
        avatar_kind: null,
        avatar_id: null,
        avatar_path: null,
        updated_by: parentId,
      });
      expect(await bucketNames(householdId)).not.toContain(`${photoId}.png`);
    });
  });
});
