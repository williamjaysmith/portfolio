/**
 * T071 — the Task Box's three verbs: FR-389's fourth parent-only surface, the
 * exact three fields FR-377 fixes, and FR-381's warned, irreversible deletion
 * that leaves the tasks already made from a template standing.
 *
 * Same plumbing as `task-actions.test.ts` — Next's cookie store is an in-memory
 * jar, the request's Supabase session is a real signed-in client, and
 * everything else (the guards, the signed actor cookie, the admin client, RLS,
 * the triggers) is production code. **Every call here bypasses the interface by
 * construction**: there is no sheet and no button in this file, so the member
 * rows below are FR-389's proof rather than a re-test of a hidden control.
 *
 * Covered here, per contracts/server-actions.md §The Task Box:
 *   - FR-388 / SC-303: nobody punched in → `NO_ACTOR` on all three, and a
 *     tampered cookie is the same refusal; nothing is written;
 *   - FR-389 / SC-304: a punched-in **member** is `FORBIDDEN` on all three, and
 *     the refusal is the DATABASE role — the same calls succeed as a parent;
 *   - FR-377 / SC-319: create stores **exactly** `summary`, `emoji` and
 *     `routine` (plus household, attribution and timestamps); a description, a
 *     date, a repeat, an assignment **or a star value** in the payload is
 *     `VALIDATION`, not silently stripped, and no star value is ever returned;
 *   - FR-330 / Assumption 3: `created_by` and `updated_by` come from the
 *     punch-in and are never accepted from the payload;
 *   - FR-380: the edit form's three fields are the three the action takes; a
 *     stored `reward_points` survives an edit **untouched and unreturned**,
 *     which is the reserved-column half of SC-319;
 *   - FR-381 / US4-12: `confirm: true` is required (`VALIDATION` otherwise) and
 *     a template's deletion leaves a task created from it **untouched** — with
 *     the structural reason asserted beside the behaviour: no constraint
 *     anywhere makes `family.tasks` reference `family.task_box_items`, so there
 *     is no link a delete could follow;
 *   - an id in another household is `NOT_FOUND` and never `FORBIDDEN`, on both
 *     the edit and the delete path (FR-390).
 *
 * Fixture rows live in run-tagged households of this file's own, never in the
 * seed, so nothing here can drift with — or damage — the seeded Task Box that
 * `tasks-schema.test.ts` counts to seventeen.
 *
 * RED by design until `lib/family/actions/task-box.ts` lands: `verb()` throws
 * by name for every export that does not exist yet.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { TaskBoxItem } from "@/lib/family/types";
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
    set(name: string, value: string, options?: { maxAge?: number }) {
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
    if (!state.client) throw new Error("task-box.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");
const { createTask } = await import("@/lib/family/actions/tasks");

/* ------------------------------------------------------------------------- *
 * The surface T071 must export (contracts/server-actions.md §The Task Box).
 * Restated here rather than imported, so the payload shapes this suite pins
 * are the CONTRACT's and not whatever the implementation happens to accept.
 * ------------------------------------------------------------------------- */

interface TaskBoxItemInputPayload {
  summary: string;
  emoji?: string | null;
  routine: boolean;
}

interface UpdateTaskBoxItemPayload {
  id: string;
  patch: Partial<TaskBoxItemInputPayload>;
}

interface DeleteTaskBoxItemPayload {
  id: string;
  confirm: boolean;
}

interface TaskBoxModule {
  createTaskBoxItem(input: TaskBoxItemInputPayload): Promise<ActionResult<TaskBoxItem>>;
  updateTaskBoxItem(input: UpdateTaskBoxItemPayload): Promise<ActionResult<TaskBoxItem>>;
  deleteTaskBoxItem(input: DeleteTaskBoxItemPayload): Promise<ActionResult<null>>;
}

// Joined at runtime so `tsc` stays clean while the three verbs do not exist;
// Vitest resolves the `@` alias when the import actually runs.
const TASK_BOX_MODULE = ["@", "lib", "family", "actions", "task-box"].join("/");
const taskBox = (await import(TASK_BOX_MODULE)) as Partial<TaskBoxModule>;

/** Names the missing export, so a RED run says which task has not landed yet. */
function verb<K extends keyof TaskBoxModule>(name: K): NonNullable<Partial<TaskBoxModule>[K]> {
  const fn = taskBox[name];
  if (fn === undefined) {
    throw new Error(`lib/family/actions/task-box.ts does not export ${name} yet (T071)`);
  }
  return fn;
}

function createTaskBoxItem(input: TaskBoxItemInputPayload): Promise<ActionResult<TaskBoxItem>> {
  return verb("createTaskBoxItem")(input);
}

function updateTaskBoxItem(input: UpdateTaskBoxItemPayload): Promise<ActionResult<TaskBoxItem>> {
  return verb("updateTaskBoxItem")(input);
}

function deleteTaskBoxItem(input: DeleteTaskBoxItemPayload): Promise<ActionResult<null>> {
  return verb("deleteTaskBoxItem")(input);
}

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

function expectFailure(result: ActionResult<unknown>, code: ActionError): string {
  expect(result).toMatchObject({ ok: false, error: code });
  return result.ok ? "" : result.message;
}

/** FR-330: a refusal names the field, so the sheet can preserve everything else. */
function expectFieldError(result: ActionResult<unknown>, field: string): void {
  expect(result).toMatchObject({ ok: false, error: "VALIDATION" });
  expect(Object.keys(result.ok ? {} : (result.fieldErrors ?? {}))).toContain(field);
}

/** Re-encode the payload without re-signing: the signature no longer matches. */
function tamper(token: string): string {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("not a JWT");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
  claims.role = "parent";
  claims.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const forged = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${forged}.${signature}`;
}

/** SC-319: nothing star-shaped may reach a caller, whatever the column holds. */
const STAR_SHAPED = /reward|point|star/i;

const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000ff";

interface StoredTemplate {
  id: string;
  summary: string;
  emoji: string | null;
  routine: boolean;
  reward_points: number | null;
  created_by: string | null;
  updated_by: string | null;
}

describe("the Task Box: FR-389's parent-only templates and FR-377's three fields (T071)", () => {
  const fx = fixtures();
  const run = fx.run;
  const ANA_PIN = "6161";
  const BEA_PIN = "6262";
  const CLEO_PIN = "6363";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  /** The parent who creates everything. */
  let anaId: string;
  /** A second parent, so `updated_by` can be seen to move off `created_by`. */
  let beaId: string;
  /** A member — FR-389's refusal target on all three verbs. */
  let cleoId: string;

  /** Re-seeded before every test that writes: ids change, shapes do not. */
  let choreTemplateId: string;
  let routineTemplateId: string;
  let foreignTemplateId: string;

  async function insertTemplate(
    targetHouseholdId: string,
    seed: { summary: string; emoji?: string | null; routine?: boolean },
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.task_box_items (household_id, summary, emoji, routine) " +
        "values ($1, $2, $3, $4) returning id",
      [targetHouseholdId, seed.summary, seed.emoji ?? null, seed.routine ?? false],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.task_box_items returned no row");
    return row.id;
  }

  async function storedTemplates(): Promise<StoredTemplate[]> {
    const { rows } = await pool.query<StoredTemplate>(
      "select id, summary, emoji, routine, reward_points, created_by, updated_by " +
        "from family.task_box_items where household_id = $1 order by summary",
      [householdId],
    );
    return rows;
  }

  async function storedTemplate(id: string): Promise<StoredTemplate | undefined> {
    return (await storedTemplates()).find((row) => row.id === id);
  }

  /** Setup only: the action-level PIN path is Phase 1's suite's job. */
  async function givePin(profileId: string, pin: string): Promise<void> {
    const { error } = await admin
      .schema("family")
      .rpc("set_pin", { p_user_id: user.id, p_profile: profileId, p_pin: pin });
    if (error) throw error;
  }

  async function punchInAs(profileId: string, pin: string): Promise<void> {
    state.cookies.clear();
    expectOk(await punchIn(profileId, pin));
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-task-box`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-task-box-other`);
    await pool.query(
      "update family.household_settings set timezone = $1 where household_id = $2",
      ["America/Chicago", householdId],
    );

    const email = testEmail("task-box", run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      email,
    ]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error("expected one fixture account");
    user = created;

    anaId = await insertCategory(pool, {
      householdId,
      label: `Ana ${run}`,
      color: "#2178AF",
      role: "parent",
    });
    beaId = await insertCategory(pool, {
      householdId,
      label: `Bea ${run}`,
      color: "#FBD97E",
      role: "parent",
    });
    cleoId = await insertCategory(pool, { householdId, label: `Cleo ${run}`, color: "#B6E085" });

    foreignTemplateId = await insertTemplate(otherHouseholdId, { summary: `Foreign ${run}` });

    // Binds the allowlist row to the account, exactly as the first sign-in does.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(anaId, ANA_PIN);
    await givePin(beaId, BEA_PIN);
    await givePin(cleoId, CLEO_PIN);
  });

  beforeEach(async () => {
    await pool.query("delete from family.tasks where household_id = $1", [householdId]);
    await pool.query("delete from family.task_box_items where household_id = $1", [householdId]);
    choreTemplateId = await insertTemplate(householdId, { summary: `Vacuum ${run}` });
    routineTemplateId = await insertTemplate(householdId, {
      summary: `Brush teeth ${run}`,
      emoji: "🪥",
      routine: true,
    });
    state.cookies.clear();
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteHousehold(pool, otherHouseholdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  /** The three verbs behind one name, so "every verb refuses X" is written once. */
  async function everyTemplateVerb(): Promise<ActionResult<unknown>[]> {
    return [
      await createTaskBoxItem({ summary: `Refused ${run}`, routine: false }),
      await updateTaskBoxItem({ id: choreTemplateId, patch: { summary: `Refused ${run}` } }),
      await deleteTaskBoxItem({ id: choreTemplateId, confirm: true }),
    ];
  }

  describe("with nobody punched in every verb is NO_ACTOR (SC-303, FR-388)", () => {
    it("create, edit and delete are all refused and nothing is written", async () => {
      const before = await storedTemplates();
      for (const result of await everyTemplateVerb()) expectFailure(result, "NO_ACTOR");
      expect(await storedTemplates()).toEqual(before);
    });

    it("a tampered actor cookie is refused on all three verbs and nothing is written", async () => {
      await punchInAs(anaId, ANA_PIN);
      const token = state.cookies.get(ACTOR_COOKIE) ?? "";
      expect(token).not.toBe("");
      const forged = tamper(token);
      const before = await storedTemplates();

      for (const call of [
        () => createTaskBoxItem({ summary: `Forged ${run}`, routine: false }),
        () => updateTaskBoxItem({ id: choreTemplateId, patch: { summary: `Forged ${run}` } }),
        () => deleteTaskBoxItem({ id: choreTemplateId, confirm: true }),
      ]) {
        state.cookies.set(ACTOR_COOKIE, forged);
        expectFailure(await call(), "NO_ACTOR");
      }

      expect(await storedTemplates()).toEqual(before);
      state.cookies.clear();
    });
  });

  describe("a punched-in MEMBER is refused every template verb (FR-389, SC-304)", () => {
    beforeEach(async () => {
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("createTaskBoxItem, updateTaskBoxItem and deleteTaskBoxItem are FORBIDDEN", async () => {
      const before = await storedTemplates();
      for (const result of await everyTemplateVerb()) expectFailure(result, "FORBIDDEN");
      expect(await storedTemplates()).toEqual(before);
    });

    it("the refusal is the DATABASE role, not the cookie's: the same call succeeds as a parent", async () => {
      expectFailure(
        await createTaskBoxItem({ summary: `Member ${run}`, routine: false }),
        "FORBIDDEN",
      );
      await punchInAs(anaId, ANA_PIN);
      expectOk(await createTaskBoxItem({ summary: `Parent ${run}`, routine: false }));
      expect((await storedTemplates()).map((row) => row.summary)).toContain(`Parent ${run}`);
    });
  });

  describe("create holds exactly three fields (FR-377, FR-330, SC-319)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("stores the title, the emoji and the type, attributed to the punch-in", async () => {
      const item = expectOk(
        await createTaskBoxItem({ summary: `Homework ${run}`, emoji: "📝", routine: true }),
      );
      expect(item).toMatchObject({
        householdId,
        summary: `Homework ${run}`,
        emoji: "📝",
        routine: true,
        createdBy: anaId,
        updatedBy: anaId,
      });

      const stored = await storedTemplate(item.id);
      expect(stored).toMatchObject({
        summary: `Homework ${run}`,
        emoji: "📝",
        routine: true,
        created_by: anaId,
        updated_by: anaId,
      });
      // FR-329: the column exists and nothing writes it.
      expect(stored?.reward_points).toBeNull();
    });

    it("returns no star value on the item it hands back (SC-319)", async () => {
      const item = expectOk(await createTaskBoxItem({ summary: `Dishes ${run}`, routine: false }));
      expect(Object.keys(item).filter((key) => STAR_SHAPED.test(key))).toEqual([]);
    });

    it("an emoji is optional, and a template without one stores NULL", async () => {
      const item = expectOk(await createTaskBoxItem({ summary: `Laundry ${run}`, routine: false }));
      expect(item.emoji).toBeNull();
      expect((await storedTemplate(item.id))?.emoji).toBeNull();
    });

    it("a blank title is VALIDATION against `summary`, and nothing is stored", async () => {
      const before = await storedTemplates();
      expectFieldError(await createTaskBoxItem({ summary: "   ", routine: false }), "summary");
      expect(await storedTemplates()).toEqual(before);
    });

    it("a star value in the payload is REFUSED, not stripped (FR-329, SC-319)", async () => {
      const before = await storedTemplates();
      for (const extra of [{ rewardPoints: 5 }, { reward_points: 5 }]) {
        const result = await createTaskBoxItem({
          summary: `Starred ${run}`,
          routine: false,
          ...extra,
        } as TaskBoxItemInputPayload);
        expectFailure(result, "VALIDATION");
      }
      expect(await storedTemplates()).toEqual(before);
    });

    it("a template holds no description, date, repeat or assignment (FR-377)", async () => {
      const before = await storedTemplates();
      const rejected: Record<string, unknown>[] = [
        { description: "Every other Tuesday" },
        { startsOn: "2026-09-04" },
        { repeat: { kind: "never" } },
        { assigneeIds: [cleoId] },
        { upForGrabs: true },
      ];
      for (const extra of rejected) {
        const result = await createTaskBoxItem({
          summary: `Too much ${run}`,
          routine: false,
          ...extra,
        } as TaskBoxItemInputPayload);
        expectFailure(result, "VALIDATION");
      }
      expect(await storedTemplates()).toEqual(before);
    });
  });

  describe("edit offers those same three fields and no fourth (FR-380, SC-319)", () => {
    beforeEach(async () => {
      await punchInAs(beaId, BEA_PIN);
    });

    it("changes the title, the emoji and the type, and moves `updated_by` to the editor", async () => {
      const item = expectOk(
        await updateTaskBoxItem({
          id: choreTemplateId,
          patch: { summary: `Hoover ${run}`, emoji: "🧹", routine: true },
        }),
      );
      expect(item).toMatchObject({
        id: choreTemplateId,
        summary: `Hoover ${run}`,
        emoji: "🧹",
        routine: true,
        updatedBy: beaId,
      });
      expect(await storedTemplate(choreTemplateId)).toMatchObject({
        summary: `Hoover ${run}`,
        emoji: "🧹",
        routine: true,
        updated_by: beaId,
      });
    });

    it("clears an emoji when the patch sets it to null", async () => {
      const item = expectOk(
        await updateTaskBoxItem({ id: routineTemplateId, patch: { emoji: null } }),
      );
      expect(item.emoji).toBeNull();
      expect((await storedTemplate(routineTemplateId))?.emoji).toBeNull();
    });

    it("leaves a stored star value untouched and unreturned (FR-329, SC-319)", async () => {
      await pool.query("update family.task_box_items set reward_points = 3 where id = $1", [
        choreTemplateId,
      ]);
      const item = expectOk(
        await updateTaskBoxItem({ id: choreTemplateId, patch: { summary: `Kept ${run}` } }),
      );
      expect(Object.keys(item).filter((key) => STAR_SHAPED.test(key))).toEqual([]);
      expect((await storedTemplate(choreTemplateId))?.reward_points).toBe(3);
    });

    it("a star value in the patch is REFUSED and nothing changes (SC-319)", async () => {
      const before = await storedTemplates();
      const result = await updateTaskBoxItem({
        id: choreTemplateId,
        patch: { rewardPoints: 5 } as Partial<TaskBoxItemInputPayload>,
      });
      expectFailure(result, "VALIDATION");
      expect(await storedTemplates()).toEqual(before);
    });

    it("a blank title is VALIDATION against `summary` and nothing changes", async () => {
      const before = await storedTemplates();
      expectFieldError(
        await updateTaskBoxItem({ id: choreTemplateId, patch: { summary: "  " } }),
        "summary",
      );
      expect(await storedTemplates()).toEqual(before);
    });

    it("a template in another household is NOT_FOUND, never FORBIDDEN (FR-390)", async () => {
      expectFailure(
        await updateTaskBoxItem({ id: foreignTemplateId, patch: { summary: `Reached ${run}` } }),
        "NOT_FOUND",
      );
      expectFailure(await updateTaskBoxItem({ id: UNKNOWN_ID, patch: {} }), "NOT_FOUND");

      const { rows } = await pool.query<{ summary: string }>(
        "select summary from family.task_box_items where id = $1",
        [foreignTemplateId],
      );
      expect(rows[0]?.summary).toBe(`Foreign ${run}`);
    });
  });

  describe("delete is confirmed, permanent, and leaves its tasks alone (FR-381, US4-12)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("without `confirm: true` it is VALIDATION and the template survives", async () => {
      const before = await storedTemplates();
      expectFailure(await deleteTaskBoxItem({ id: choreTemplateId, confirm: false }), "VALIDATION");
      expectFailure(
        await deleteTaskBoxItem({ id: choreTemplateId } as DeleteTaskBoxItemPayload),
        "VALIDATION",
      );
      expect(await storedTemplates()).toEqual(before);
    });

    it("with `confirm: true` the template is gone and its neighbour is not", async () => {
      expect(expectOk(await deleteTaskBoxItem({ id: choreTemplateId, confirm: true }))).toBeNull();
      expect((await storedTemplates()).map((row) => row.id)).toEqual([routineTemplateId]);
    });

    it("a task already created from the template is untouched (US4-12)", async () => {
      // FR-378's add: the ordinary create form, pre-filled with the template's
      // three values and given the assignment and schedule it still requires.
      const task = expectOk(
        await createTask({
          summary: `Vacuum ${run}`,
          routine: false,
          assigneeIds: [cleoId],
          startsOn: "2026-09-04",
          repeat: { kind: "never" },
        }),
      );

      expectOk(await deleteTaskBoxItem({ id: choreTemplateId, confirm: true }));

      const { rows } = await pool.query<{ id: string; summary: string; routine: boolean }>(
        "select id, summary, routine from family.tasks where household_id = $1",
        [householdId],
      );
      expect(rows).toEqual([{ id: task.id, summary: `Vacuum ${run}`, routine: false }]);
    });

    it("structurally: nothing in `family.tasks` references a template (FR-381)", async () => {
      // The behaviour above is a consequence of the schema, not of an ordering
      // the delete remembers: `createTask` copies three values and keeps no link.
      const { rows } = await pool.query<{ conname: string }>(
        "select c.conname from pg_constraint c " +
          "join pg_class child on child.oid = c.conrelid " +
          "join pg_class parent on parent.oid = c.confrelid " +
          "join pg_namespace n on n.oid = child.relnamespace " +
          "where c.contype = 'f' and n.nspname = 'family' " +
          "and parent.relname = 'task_box_items'",
      );
      expect(rows).toEqual([]);
    });

    it("a template in another household is NOT_FOUND and survives (FR-390)", async () => {
      expectFailure(
        await deleteTaskBoxItem({ id: foreignTemplateId, confirm: true }),
        "NOT_FOUND",
      );
      expectFailure(await deleteTaskBoxItem({ id: UNKNOWN_ID, confirm: true }), "NOT_FOUND");

      const { rows } = await pool.query<{ count: string }>(
        "select count(*)::text as count from family.task_box_items where id = $1",
        [foreignTemplateId],
      );
      expect(rows[0]?.count).toBe("1");
    });
  });
});
