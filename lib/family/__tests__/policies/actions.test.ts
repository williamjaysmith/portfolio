/**
 * SC-002 / SC-010 at the server: the real server actions (`punchIn`,
 * `setProfilePin`, `createCategory`, `deleteCategory`, …) run against the
 * local stack with Next's request plumbing replaced by an in-memory cookie jar
 * and a per-user supabase-js session. Everything else — guards, the actor
 * cookie, the admin client, the PIN functions, RLS — is the production code.
 *
 * The action modules are written by another wave; until they import cleanly
 * this file reports itself as skipped (with the reason) instead of failing.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { Category } from "@/lib/family/types";
import {
  LOCAL,
  adminClient,
  createPool,
  createUsers,
  deleteHousehold,
  deleteUsers,
  fixtures,
  insertHousehold,
  testEmail,
  userClient,
  type FixtureUser,
} from "./helpers";

const ACTOR_COOKIE = "family_actor";

// Hoisted so the mock factories below can reach it.
const state = vi.hoisted(() => ({
  /** The request/response cookie jar — what the browser would hold between calls. */
  cookies: new Map<string, string>(),
  /** The signed-in Supabase session the "request" carries. */
  client: null as SupabaseClient | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));
vi.mock("next/headers", () => {
  interface CookieInit {
    name: string;
    value: string;
    maxAge?: number;
    expires?: Date | number;
  }
  const expired = (init: Pick<CookieInit, "maxAge" | "expires">): boolean =>
    init.maxAge === 0 ||
    (init.expires !== undefined && new Date(init.expires).getTime() <= Date.now());
  const jar = {
    get(name: string) {
      const value = state.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return [...state.cookies].map(([name, value]) => ({ name, value }));
    },
    has(name: string) {
      return state.cookies.has(name);
    },
    set(nameOrInit: string | CookieInit, value?: string, options?: Omit<CookieInit, "name" | "value">) {
      const init: CookieInit =
        typeof nameOrInit === "string"
          ? { name: nameOrInit, value: value ?? "", ...options }
          : nameOrInit;
      // A cleared cookie (Max-Age=0) is gone on the next request.
      if (expired(init)) state.cookies.delete(init.name);
      else state.cookies.set(init.name, init.value);
      return jar;
    },
    delete(name: string) {
      state.cookies.delete(name);
      return jar;
    },
  };
  return {
    cookies: async () => jar,
    headers: async () => new Headers(),
  };
});
vi.mock("@/lib/family/supabase/server", () => ({
  createClient: async () => {
    if (!state.client) throw new Error("actions.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

async function loadActions() {
  try {
    const [punchIn, pins, categories] = await Promise.all([
      import("@/lib/family/actions/punch-in"),
      import("@/lib/family/actions/pins"),
      import("@/lib/family/actions/categories"),
    ]);
    return { ...punchIn, ...pins, ...categories };
  } catch (error) {
    console.warn(
      "[policies] actions.test skipped — the server action modules are not importable yet:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

const actions = await loadActions();

function expectOk<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}: ${result.message}`);
  return result.data;
}

function expectFailure<T>(result: ActionResult<T>, code: ActionError): void {
  expect(result).toMatchObject({ ok: false, error: code });
}

function tamper(token: string): string {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("not a JWT");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  claims.role = "parent";
  claims.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const forged = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${forged}.${signature}`;
}

describe.skipIf(actions === null)("server actions: punch-in, PINs and category rules", () => {
  const api = actions!;
  const fx = fixtures();
  const run = fx.run;
  const PARENT_PIN = "1111";
  const CHILD_PIN = "2222";

  let pool: Pool;
  let admin: SupabaseClient;
  let householdId: string;
  let users: FixtureUser[] = [];
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let parent: Category;
  let child: Category;
  let labelId: string;
  let parentToken: string;

  async function profileExists(id: string): Promise<boolean> {
    const { rows } = await pool.query("select 1 from family.categories where id = $1", [id]);
    return rows.length === 1;
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();
    // A household of its own with no profiles yet: the bootstrap rule (D6)
    // creates the first parent, and "last parent" means exactly one.
    householdId = await insertHousehold(pool, `test-${run}-actions`);
    const emails = [testEmail("actions-a", run), testEmail("actions-b", run)];
    await pool.query(
      "insert into family.household_users (household_id, email) values ($1, $2), ($1, $3)",
      [householdId, ...emails],
    );
    users = await createUsers(admin, emails);
    const [a, b] = users;
    if (!a || !b) throw new Error("expected two accounts");
    clientA = await userClient(a);
    clientB = await userClient(b);
    state.client = clientA;
    state.cookies.clear();
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteUsers(admin, users.map((user) => user.id));
    await pool.end();
  });

  it("bootstrap: with no parent yet, a member with no actor creates the first parent (D6)", async () => {
    parent = expectOk(
      await api.createCategory({ label: `Parent ${run}`, color: "#2178AF", isProfile: true }),
    );
    expect(parent).toMatchObject({ householdId, isProfile: true, role: "parent", hasPin: false });

    // The door closes the moment a parent exists.
    expectFailure(
      await api.createCategory({ label: `Second ${run}`, color: "#CB434C", isProfile: true }),
      "NO_ACTOR",
    );
  });

  it("the FIRST PIN is set with nobody punched in (FR-018, SC-010)", async () => {
    expect(state.cookies.has(ACTOR_COOKIE)).toBe(false);
    expectOk(await api.setProfilePin(parent.id, PARENT_PIN));
  });

  /**
   * The no-lockout window closes the moment it can. Until a parent holds a PIN
   * nobody could punch in to authorise a PIN, so the session alone has to do.
   * Once one does, an actor-less caller — a child or a visitor at the
   * always-signed-in tablet — can no longer reset a parent's PIN.
   */
  it("once a parent holds a PIN, an actor-less set is refused", async () => {
    expect(state.cookies.has(ACTOR_COOKIE)).toBe(false);
    expectFailure(await api.setProfilePin(parent.id, "4321"), "NO_ACTOR");
    // And the original PIN still works, so nothing was half-written.
    expectOk(await api.punchIn(parent.id, PARENT_PIN));
    expectOk(await api.punchOut());
  });

  it("punchIn refuses a wrong PIN and mints an actor cookie for the right one", async () => {
    expectFailure(await api.punchIn(parent.id, "9999"), "BAD_PIN");
    expect(state.cookies.has(ACTOR_COOKIE)).toBe(false);

    const session = expectOk(await api.punchIn(parent.id, PARENT_PIN));
    expect(session).toMatchObject({ profileId: parent.id, role: "parent", label: parent.label });
    expect(session.ttlSeconds).toBeGreaterThan(0);
    expect(session.ttlSeconds).toBeLessThanOrEqual(60 * 60);
    expect(state.cookies.has(ACTOR_COOKIE)).toBe(true);

    const current = expectOk(await api.getActor());
    expect(current?.profileId).toBe(parent.id);
  });

  it("a parent actor creates a child profile", async () => {
    child = expectOk(
      await api.createCategory({
        label: `Kid ${run}`,
        color: "#B6E085",
        isProfile: true,
        role: "member",
      }),
    );
    expect(child).toMatchObject({ householdId, role: "member", hasPin: false });
  });

  it("punchOut clears the cookie and getActor reports nobody", async () => {
    expectOk(await api.punchOut());
    expect(state.cookies.has(ACTOR_COOKIE)).toBe(false);
    expect(expectOk(await api.getActor())).toBeNull();
    // Idempotent.
    expectOk(await api.punchOut());
  });

  it("a punched-in parent gives the child a PIN, who then punches in as a member", async () => {
    // Actor-less no longer works here: the parent has a PIN, so someone can
    // punch in to authorise this, and therefore must.
    expectFailure(await api.setProfilePin(child.id, CHILD_PIN), "NO_ACTOR");

    expectOk(await api.punchIn(parent.id, PARENT_PIN));
    expectOk(await api.setProfilePin(child.id, CHILD_PIN));
    expectOk(await api.punchOut());

    const session = expectOk(await api.punchIn(child.id, CHILD_PIN));
    expect(session).toMatchObject({ profileId: child.id, role: "member" });
  });

  it("a member actor cannot create categories → FORBIDDEN", async () => {
    expectFailure(
      await api.createCategory({ label: `Sneaky ${run}`, color: "#F66951", isProfile: false }),
      "FORBIDDEN",
    );
  });

  it("a member actor cannot set a PIN → FORBIDDEN, and the PIN is unchanged", async () => {
    expectFailure(await api.setProfilePin(child.id, "3333"), "FORBIDDEN");
    expectFailure(await api.setProfilePin(parent.id, "3333"), "FORBIDDEN");

    expectOk(await api.punchOut());
    expectFailure(await api.punchIn(child.id, "3333"), "BAD_PIN");
    expectOk(await api.punchIn(child.id, CHILD_PIN));
    expectOk(await api.punchOut());
  });

  it("a parent actor creates a label and must confirm a delete", async () => {
    expectOk(await api.punchIn(parent.id, PARENT_PIN));
    parentToken = state.cookies.get(ACTOR_COOKIE) ?? "";
    expect(parentToken).not.toBe("");

    const label = expectOk(
      await api.createCategory({
        label: `Bin day ${run}`,
        color: "#DADADA",
        isProfile: false,
        emoji: "🗑️",
      }),
    );
    labelId = label.id;
    expect(label).toMatchObject({ isProfile: false, role: "member", emoji: "🗑️" });

    expectFailure(await api.deleteCategory(labelId, { confirm: false }), "VALIDATION");
    expect(await profileExists(labelId)).toBe(true);
  });

  it("deleting the last parent → CONFLICT, and the row survives", async () => {
    expectFailure(await api.deleteCategory(parent.id, { confirm: true }), "CONFLICT");
    expect(await profileExists(parent.id)).toBe(true);
  });

  it("a tampered actor cookie → NO_ACTOR", async () => {
    state.cookies.set(ACTOR_COOKIE, tamper(parentToken));
    expectFailure(await api.extendActor(), "NO_ACTOR");
    expectFailure(
      await api.createCategory({ label: `Forged ${run}`, color: "#915EA1", isProfile: false }),
      "NO_ACTOR",
    );
    expect(await profileExists(labelId)).toBe(true);
  });

  it("an actor cookie minted under user A is rejected under user B's session → NO_ACTOR", async () => {
    state.cookies.set(ACTOR_COOKIE, parentToken);
    state.client = clientB;
    try {
      expectFailure(await api.extendActor(), "NO_ACTOR");
      expectFailure(await api.deleteCategory(labelId, { confirm: true }), "NO_ACTOR");
    } finally {
      state.client = clientA;
    }
    expect(await profileExists(labelId)).toBe(true);

    // The same cookie is still good for the session it was minted under.
    state.cookies.set(ACTOR_COOKIE, parentToken);
    expectOk(await api.extendActor());
  });
});

/**
 * D6 in its own right. The bootstrap window closes on the FIRST record a
 * parent-less household creates, so each case needs a household of its own —
 * and an account of its own, because the household comes from the caller's
 * membership, not from an argument.
 */
describe.skipIf(actions === null)("bootstrap forces the first record to be a parent profile (D6)", () => {
  const api = actions!;
  const fx = fixtures();
  const run = fx.run;

  let pool: Pool;
  let admin: SupabaseClient;
  const users: FixtureUser[] = [];
  const households: string[] = [];

  /** A parent-less household with an allowlisted account, signed in and selected. */
  async function freshHousehold(tag: string): Promise<string> {
    const householdId = await insertHousehold(pool, `test-${run}-${tag}`);
    households.push(householdId);
    const email = testEmail(`actions-${tag}`, run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      email,
    ]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error(`expected an account for ${tag}`);
    users.push(created);
    state.client = await userClient(created);
    state.cookies.clear();
    return householdId;
  }

  interface KindRow {
    is_profile: boolean;
    role: string;
    emoji: string | null;
  }

  /** What the DATABASE holds — the action's return value is not the guarantee. */
  async function readKind(id: string): Promise<KindRow> {
    const { rows } = await pool.query<KindRow>(
      "select is_profile, role, emoji from family.categories where id = $1",
      [id],
    );
    const [row] = rows;
    if (!row) throw new Error(`no category ${id}`);
    return row;
  }

  beforeAll(() => {
    pool = createPool();
    admin = adminClient();
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    for (const householdId of households) await deleteHousehold(pool, householdId);
    await deleteUsers(admin, users.map((user) => user.id));
    await pool.end();
  });

  it("a Label asked for with no parent yet is created as a PARENT profile, and the window shuts", async () => {
    const householdId = await freshHousehold("bootstrap-label");

    const created = expectOk(
      await api.createCategory({ label: `Bin day ${run}`, color: "#FDC36D", isProfile: false }),
    );
    expect(created).toMatchObject({ householdId, isProfile: true, role: "parent" });
    expect(await readKind(created.id)).toEqual({ is_profile: true, role: "parent", emoji: null });

    // The whole point of deriving the role from the FORCED kind: the household
    // now has a parent, so the actor-less door D6 opened is shut again.
    expectFailure(
      await api.createCategory({ label: `After ${run}`, color: "#2178AF", isProfile: true }),
      "NO_ACTOR",
    );
  });

  it("drops the emoji the Label carried instead of letting 003 reject the insert", async () => {
    await freshHousehold("bootstrap-emoji");

    const created = expectOk(
      await api.createCategory({
        label: `Holidays ${run}`,
        color: "#FDC36D",
        isProfile: false,
        emoji: "🎉",
      }),
    );
    expect(created).toMatchObject({ isProfile: true, role: "parent", emoji: null });
    expect(await readKind(created.id)).toEqual({ is_profile: true, role: "parent", emoji: null });
  });
});
