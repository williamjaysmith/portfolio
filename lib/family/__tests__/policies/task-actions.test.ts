/**
 * T048 — the task WRITE surface: FR-389's parent-only rule, the attribution the
 * actor owns, and every shape `createTask`, `updateTask` and `deleteTask`
 * refuse. Against the live local stack with the same plumbing as
 * `task-resolutions.test.ts` — Next's cookie store is an in-memory jar, the
 * request's Supabase session is a real signed-in client, and everything else
 * (the guards, the signed actor cookie, the admin client, RLS, the triggers,
 * the shared expander) is production code.
 *
 * **Every call here bypasses the interface by construction**: there is no form,
 * no button and no client component in this file — the action is invoked
 * directly with a payload of the test's own choosing. That is what makes
 * US2-15's "and the refusal holds when the request bypasses the interface" an
 * assertion rather than a hope, and it is why the member rows below are the
 * proof FR-389 asks for rather than a re-test of a hidden button.
 *
 * Covered here, per contracts/server-actions.md §Tasks:
 *   - SC-303 / FR-388: `createTask`, `updateTask` and `deleteTask` are refused
 *     with `NO_ACTOR` when nobody is punched in and when the cookie is forged,
 *     and nothing is written;
 *   - FR-389 / US2-15 / SC-304: a punched-in **member** is refused create, edit
 *     and delete with `FORBIDDEN` — and the two shipped Phase 1 surfaces
 *     FR-389 also names, `reorderCategories` (the column order, FR-309) and
 *     `updateCategory`'s `showOnTasks` (FR-313), are asserted here too, because
 *     the contract leans on them being already parent-only rather than adding
 *     an action;
 *   - FR-330 / Assumption 3: `created_by` and `updated_by` are taken from the
 *     punched-in actor and are never accepted from the payload;
 *   - US2-4: an empty title is `VALIDATION` against `summary`, with the other
 *     entries reported back untouched and nothing stored;
 *   - US2-5: no profile and Up for Grabs off is `VALIDATION`;
 *   - FR-323 / US2-6: a **Label** as an assignee is refused by the action AND,
 *     independently, by 018's `assert_task_assignee` trigger;
 *   - FR-331: a scope or an occurrence key sent to `updateTask` is `VALIDATION`
 *     — tasks have no per-occurrence overrides;
 *   - FR-347: a scope missing on a repeating delete, present on a one-off, or
 *     `this` on a routine is `VALIDATION` — the server never guesses a scope;
 *   - contracts §deleteTask: `this_and_future` on the series' **first**
 *     occurrence is promoted to `all` and leaves **no** `family.tasks` row,
 *     asserted rather than assumed, because the truncating branch would leave a
 *     rule that ends the day before it starts — a ghost that generates nothing,
 *     still appears in the Task list surfaces and still counts against FR-391's
 *     assignee arithmetic. The truncating branch is asserted beside it so the
 *     contrast is the thing under test;
 *   - an occurrence key the shared `expandTaskDay` does not produce →
 *     `NOT_FOUND`; `confirm !== true` → `VALIDATION`; an id outside the
 *     household → `NOT_FOUND` and never `FORBIDDEN`;
 *   - **T056 / FR-391 / SC-317**: deleting a Profile takes its assignments and
 *     its own chains, leaves a task somebody else is also assigned to standing
 *     with that person's history intact, deletes the tasks left with nobody to
 *     do them, and keeps a past CLAIM of an up-for-grabs chore — that row loses
 *     only its credit, because deleting it would unlink the middle of the
 *     household's chain and resurrect a settled occurrence.
 *
 *   - **T076 / FR-310 / FR-311 / FR-389**: `moveRoutine` is the one task verb
 *     that is NOT parent-only — reordering routines within one's own column is
 *     open to any punched-in Profile — so it is asserted from both sides: a
 *     member reorders their own column and is `FORBIDDEN` in somebody else's, a
 *     chore is refused outright because FR-311 forbids reordering chores at all,
 *     a neighbour in another section or another column is `VALIDATION`, and a
 *     successful drop writes **one** `sort_order` and leaves every other row's
 *     alone.
 *
 * The Task Box's three verbs are FR-389's fourth parent-only surface and are
 * asserted in `task-box.test.ts` (T071), which owns `lib/family/actions/task-box.ts`.
 *
 * Fixture rows are created by this file in run-tagged households of its own,
 * never taken from the seed, so nothing here can drift with — or damage — the
 * shared seeded board.
 *
 * RED by design until T050–T052 land the three verbs in
 * `lib/family/actions/tasks.ts`: `verb()` below throws by name for every export
 * that does not exist yet, which is the failing state T048 must leave behind.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import type { ActionError, ActionResult } from "@/lib/family/errors";
import type {
  OccurrenceKey,
  Task,
  TaskRepeatChoice,
  TaskScope,
  TimeOfDay,
} from "@/lib/family/types";
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
    if (!state.client) throw new Error("task-actions.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");
const { deleteCategory, reorderCategories, updateCategory } = await import(
  "@/lib/family/actions/categories"
);

/* ------------------------------------------------------------------------- *
 * The surface T050–T052 must export (contracts/server-actions.md §Tasks).
 * Restated here rather than imported so the payload shapes this suite pins are
 * the CONTRACT's, not whatever the implementation happens to accept.
 * ------------------------------------------------------------------------- */

interface TaskInputPayload {
  summary: string;
  description?: string | null;
  emoji?: string | null;
  routine: boolean;
  assigneeIds: string[];
  upForGrabs?: boolean;
  trackHabit?: boolean;
  startsOn?: string | null;
  dueTime?: string | null;
  timesOfDay?: TimeOfDay[];
  repeat: TaskRepeatChoice;
  saveToTaskBox?: boolean;
}

interface UpdateTaskPayload {
  id: string;
  patch: Partial<Omit<TaskInputPayload, "saveToTaskBox">>;
}

interface DeleteTaskPayload {
  id: string;
  confirm: boolean;
  scope?: TaskScope;
  occurrenceKey?: OccurrenceKey;
}

/** contracts/server-actions.md §moveRoutine — the drop, named by its neighbours. */
interface MoveRoutinePayload {
  taskId: string;
  profileId: string;
  previousTaskId: string | null;
  nextTaskId: string | null;
}

interface TaskWriteModule {
  createTask(input: TaskInputPayload): Promise<ActionResult<Task>>;
  updateTask(input: UpdateTaskPayload): Promise<ActionResult<Task>>;
  deleteTask(input: DeleteTaskPayload): Promise<ActionResult<null>>;
  moveRoutine(input: MoveRoutinePayload): Promise<ActionResult<null>>;
}

// Joined at runtime so `tsc` stays clean while the three verbs do not exist;
// Vitest resolves the `@` alias when the import actually runs.
const TASKS_MODULE = ["@", "lib", "family", "actions", "tasks"].join("/");
const taskWrites = (await import(TASKS_MODULE)) as Partial<TaskWriteModule>;

/** Names the missing export, so a RED run says which task has not landed yet. */
function verb<K extends keyof TaskWriteModule>(name: K): NonNullable<Partial<TaskWriteModule>[K]> {
  const fn = taskWrites[name];
  if (fn === undefined) {
    throw new Error(`lib/family/actions/tasks.ts does not export ${name} yet (T050–T052, T076)`);
  }
  return fn;
}

function createTask(input: TaskInputPayload): Promise<ActionResult<Task>> {
  return verb("createTask")(input);
}

function updateTask(input: UpdateTaskPayload): Promise<ActionResult<Task>> {
  return verb("updateTask")(input);
}

function deleteTask(input: DeleteTaskPayload): Promise<ActionResult<null>> {
  return verb("deleteTask")(input);
}

function moveRoutine(input: MoveRoutinePayload): Promise<ActionResult<null>> {
  return verb("moveRoutine")(input);
}

/**
 * The three verbs behind one name, so "every write verb refuses X" is written
 * once instead of three times that can drift apart.
 */
async function everyWriteVerb(
  input: TaskInputPayload,
  targetId: string,
): Promise<ActionResult<unknown>[]> {
  return [
    await createTask(input),
    await updateTask({ id: targetId, patch: { summary: input.summary } }),
    await deleteTask({ id: targetId, confirm: true }),
  ];
}

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

function expectFailure(result: ActionResult<unknown>, code: ActionError): string {
  expect(result).toMatchObject({ ok: false, error: code });
  return result.ok ? "" : result.message;
}

/** FR-330: a refusal names the field, so the form can preserve everything else. */
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

const ZONE = "America/Chicago";

// Fixed past dates: every occurrence below is identified by its own scheduled
// date, so nothing here drifts with the calendar or with the run's clock.
/** A Tuesday, and the first occurrence of the weekly series. */
const SERIES_START = "2026-08-11";
/** A later Tuesday of the same series — the truncating branch's cut. */
const SERIES_LATER = "2026-09-01";
/** The day before the cut: what `UNTIL` becomes when the rule is truncated. */
const SERIES_TRUNCATED = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260831;BYDAY=TU";
const SERIES_RRULE = "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU";
/** A Wednesday: the weekly series never falls on it (FR-347's phantom). */
const NOT_AN_OCCURRENCE = "2026-08-12";
const ROUTINE_RRULE = "FREQ=DAILY;INTERVAL=1";

interface TaskSeed {
  summary: string;
  routine?: boolean;
  startsOn?: string | null;
  timesOfDay?: string[];
  rrule?: string | null;
}

async function insertTask(pool: Pool, householdId: string, seed: TaskSeed): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.tasks (household_id, summary, routine, starts_on, times_of_day, rrule) " +
      "values ($1, $2, $3, $4, $5::family.time_of_day[], $6) returning id",
    [
      householdId,
      seed.summary,
      seed.routine ?? false,
      seed.startsOn ?? null,
      seed.timesOfDay ?? [],
      seed.rrule ?? null,
    ],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.tasks returned no row");
  return row.id;
}

async function insertAssignee(pool: Pool, householdId: string, taskId: string, categoryId: string) {
  await pool.query(
    "insert into family.task_assignees (household_id, task_id, category_id) values ($1, $2, $3)",
    [householdId, taskId, categoryId],
  );
}

interface StoredTask {
  id: string;
  summary: string;
  routine: boolean;
  rrule: string | null;
  starts_on: string | null;
  created_by: string | null;
  updated_by: string | null;
}

describe("task writes: FR-389's parent-only rule and the shapes the actions refuse (T048)", () => {
  const fx = fixtures();
  const run = fx.run;
  const ANA_PIN = "5151";
  const BEA_PIN = "5252";
  const CLEO_PIN = "5353";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  /** The parent who creates everything. */
  let anaId: string;
  /** A second parent, so `updated_by` can be seen to move off `created_by`. */
  let beaId: string;
  /** A member — FR-389's refusal target on every verb below. */
  let cleoId: string;
  /** A category that is NOT a profile: FR-323's Label. */
  let labelId: string;

  /** Re-seeded before every test that writes: ids change, shapes do not. */
  let oneOffId: string;
  let seriesId: string;
  let routineId: string;
  let foreignTaskId: string;

  function choreKey(taskId: string, date: string): OccurrenceKey {
    return { taskId, assigneeId: cleoId, occurrenceDate: date, slot: null, cyclePrev: null };
  }

  async function storedTasks(): Promise<StoredTask[]> {
    const { rows } = await pool.query<StoredTask>(
      "select id, summary, routine, rrule, starts_on::text as starts_on, created_by, updated_by " +
        "from family.tasks where household_id = $1 order by created_at",
      [householdId],
    );
    return rows;
  }

  async function storedTask(id: string): Promise<StoredTask | undefined> {
    return (await storedTasks()).find((row) => row.id === id);
  }

  async function assigneesOf(taskId: string): Promise<string[]> {
    const { rows } = await pool.query<{ category_id: string }>(
      "select category_id from family.task_assignees where task_id = $1 order by sort_order",
      [taskId],
    );
    return rows.map((row) => row.category_id);
  }

  async function setZone(zone: string): Promise<void> {
    await pool.query("update family.household_settings set timezone = $1 where household_id = $2", [
      zone,
      householdId,
    ]);
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

  /** The valid chore payload every refusal below is a single mutation of. */
  function choreInput(overrides: Partial<TaskInputPayload> = {}): TaskInputPayload {
    return {
      summary: `Feed the cat ${run}`,
      routine: false,
      assigneeIds: [cleoId],
      startsOn: SERIES_START,
      repeat: { kind: "never" },
      ...overrides,
    };
  }

  async function reseedTasks(): Promise<void> {
    await pool.query("delete from family.tasks where household_id = $1", [householdId]);

    oneOffId = await insertTask(pool, householdId, {
      summary: `One-off ${run}`,
      startsOn: SERIES_START,
    });
    await insertAssignee(pool, householdId, oneOffId, cleoId);

    seriesId = await insertTask(pool, householdId, {
      summary: `Weekly bins ${run}`,
      startsOn: SERIES_START,
      rrule: SERIES_RRULE,
    });
    await insertAssignee(pool, householdId, seriesId, cleoId);

    routineId = await insertTask(pool, householdId, {
      summary: `Brush teeth ${run}`,
      routine: true,
      startsOn: SERIES_START,
      timesOfDay: ["morning"],
      rrule: ROUTINE_RRULE,
    });
    await insertAssignee(pool, householdId, routineId, cleoId);
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-task-actions`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-task-actions-other`);
    await setZone(ZONE);

    const email = testEmail("task-actions", run);
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
    labelId = await insertCategory(pool, {
      householdId,
      label: `Bin day ${run}`,
      color: "#915EA1",
      isProfile: false,
    });

    foreignTaskId = await insertTask(pool, otherHouseholdId, {
      summary: `Foreign ${run}`,
      startsOn: SERIES_START,
    });

    // Binds the allowlist row to the account, exactly as the first sign-in does
    // — `set_pin` refuses a caller who has not claimed yet.
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
    await reseedTasks();
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

  describe("with nobody punched in every write verb is NO_ACTOR (SC-303, FR-388)", () => {
    it("create, edit and delete are all refused and nothing is written", async () => {
      const before = await storedTasks();
      const results = await everyWriteVerb(choreInput({ summary: `Refused ${run}` }), oneOffId);
      for (const result of results) expectFailure(result, "NO_ACTOR");
      expect(await storedTasks()).toEqual(before);
    });

    it("a tampered actor cookie is refused on all three verbs and nothing is written", async () => {
      await punchInAs(anaId, ANA_PIN);
      const token = state.cookies.get(ACTOR_COOKIE) ?? "";
      expect(token).not.toBe("");
      const forged = tamper(token);
      const before = await storedTasks();

      for (const call of [
        () => createTask(choreInput({ summary: `Forged ${run}` })),
        () => updateTask({ id: oneOffId, patch: { summary: `Forged ${run}` } }),
        () => deleteTask({ id: oneOffId, confirm: true }),
      ]) {
        state.cookies.set(ACTOR_COOKIE, forged);
        expectFailure(await call(), "NO_ACTOR");
      }

      expect(await storedTasks()).toEqual(before);
      state.cookies.clear();
    });
  });

  describe("a punched-in MEMBER is refused every parent-only verb (FR-389, US2-15, SC-304)", () => {
    beforeEach(async () => {
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("createTask, updateTask and deleteTask are FORBIDDEN, and nothing changes", async () => {
      const before = await storedTasks();
      const results = await everyWriteVerb(choreInput({ summary: `Refused ${run}` }), oneOffId);
      for (const result of results) expectFailure(result, "FORBIDDEN");
      expect(await storedTasks()).toEqual(before);
    });

    it("the refusal is the DATABASE role, not the cookie's: the same calls succeed as a parent", async () => {
      expectFailure(await createTask(choreInput({ summary: `Member ${run}` })), "FORBIDDEN");
      await punchInAs(anaId, ANA_PIN);
      expectOk(await createTask(choreInput({ summary: `Parent ${run}` })));
      expect((await storedTasks()).map((row) => row.summary)).toContain(`Parent ${run}`);
    });

    it("the two shipped surfaces FR-389 also names are parent-only already", async () => {
      // FR-309's column order is Phase 1's `reorderCategories`, and FR-313's
      // Show on Tasks switch is Phase 1's `updateCategory` — the contract adds
      // no action for either, so this is the assertion that the thing it leans
      // on is true.
      expectFailure(await reorderCategories([cleoId, anaId, beaId, labelId]), "FORBIDDEN");
      expectFailure(await updateCategory(cleoId, { showOnTasks: false }), "FORBIDDEN");

      const { rows } = await pool.query<{ show_on_tasks: boolean }>(
        "select show_on_tasks from family.categories where id = $1",
        [cleoId],
      );
      expect(rows[0]?.show_on_tasks).toBe(true);
    });
  });

  describe("createTask: attribution and the shapes it refuses", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("created_by and updated_by come from the ACTOR, and moving parents moves updated_by", async () => {
      const created = expectOk(await createTask(choreInput({ summary: `Trash ${run}` })));
      expect(await storedTask(created.id)).toMatchObject({
        created_by: anaId,
        updated_by: anaId,
      });

      await punchInAs(beaId, BEA_PIN);
      expectOk(await updateTask({ id: created.id, patch: { summary: `Trash again ${run}` } }));
      // The creator is a fact the record keeps; the editor is the actor who
      // just wrote (FR-330, Assumption 3).
      expect(await storedTask(created.id)).toMatchObject({ created_by: anaId, updated_by: beaId });
    });

    it("attribution sent in the payload is refused outright, never merged", async () => {
      const payload = {
        ...choreInput({ summary: `Spoofed ${run}` }),
        createdBy: cleoId,
        updatedBy: cleoId,
      } as unknown as TaskInputPayload;
      expectFailure(await createTask(payload), "VALIDATION");
      expect((await storedTasks()).map((row) => row.summary)).not.toContain(`Spoofed ${run}`);
    });

    it("the reserved star value is refused too, never stored (FR-329, SC-319)", async () => {
      const payload = {
        ...choreInput({ summary: `Starred ${run}` }),
        rewardPoints: 5,
      } as unknown as TaskInputPayload;
      expectFailure(await createTask(payload), "VALIDATION");
      expect((await storedTasks()).map((row) => row.summary)).not.toContain(`Starred ${run}`);
    });

    it("an empty title is VALIDATION on `summary` alone, and nothing is stored (US2-4)", async () => {
      const before = await storedTasks();
      const result = await createTask(
        choreInput({ summary: "   ", description: `keep me ${run}`, emoji: "🐈" }),
      );
      expectFieldError(result, "summary");
      // Only the title is named, so the form has nothing to discard but the
      // title — "the other entries are preserved" is that, server-side.
      expect(Object.keys(result.ok ? {} : (result.fieldErrors ?? {}))).toEqual(["summary"]);
      expect(await storedTasks()).toEqual(before);
    });

    it("no profile and Up for Grabs off is VALIDATION on `assigneeIds` (US2-5)", async () => {
      const before = await storedTasks();
      expectFieldError(
        await createTask(choreInput({ summary: `Nobody ${run}`, assigneeIds: [] })),
        "assigneeIds",
      );
      expect(await storedTasks()).toEqual(before);
    });

    it("a Label as an assignee is refused BY THE ACTION (FR-323, US2-6)", async () => {
      const before = await storedTasks();
      expectFieldError(
        await createTask(choreInput({ summary: `Bin day chore ${run}`, assigneeIds: [labelId] })),
        "assigneeIds",
      );
      expect(await storedTasks()).toEqual(before);
    });

    it("and independently by 018's trigger, so it is refused at the data store too", async () => {
      const refusal = await insertAssignee(pool, householdId, oneOffId, labelId).then(
        () => null,
        (error: unknown) => error,
      );
      expect(refusal).toMatchObject({ code: "23514" });
      expect(String(refusal)).toContain("only to a Profile");
      expect(await assigneesOf(oneOffId)).toEqual([cleoId]);
    });

    it("an assignee from another household is NOT_FOUND, never FORBIDDEN", async () => {
      const strangerId = await insertCategory(pool, {
        householdId: otherHouseholdId,
        label: `Stranger ${run}`,
        color: "#FBA994",
      });
      expectFailure(
        await createTask(choreInput({ summary: `Foreign assignee ${run}`, assigneeIds: [strangerId] })),
        "NOT_FOUND",
      );
      expect((await storedTasks()).map((row) => row.summary)).not.toContain(
        `Foreign assignee ${run}`,
      );
    });
  });

  describe("updateTask accepts no scope, ever (FR-331)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("a top-level scope is VALIDATION and the task is untouched", async () => {
      const before = await storedTask(seriesId);
      const payload = {
        id: seriesId,
        patch: { summary: `Scoped ${run}` },
        scope: "this_and_future",
      } as unknown as UpdateTaskPayload;
      expectFailure(await updateTask(payload), "VALIDATION");
      expect(await storedTask(seriesId)).toEqual(before);
    });

    it("an occurrence key is VALIDATION too — tasks carry no per-occurrence overrides", async () => {
      const before = await storedTask(seriesId);
      const payload = {
        id: seriesId,
        patch: { summary: `Keyed ${run}` },
        occurrenceKey: choreKey(seriesId, SERIES_START),
      } as unknown as UpdateTaskPayload;
      expectFailure(await updateTask(payload), "VALIDATION");
      expect(await storedTask(seriesId)).toEqual(before);
    });

    it("a scope smuggled inside the patch is refused by the strict shape", async () => {
      const before = await storedTask(seriesId);
      const payload = {
        id: seriesId,
        patch: { summary: `Smuggled ${run}`, scope: "all" },
      } as unknown as UpdateTaskPayload;
      expectFailure(await updateTask(payload), "VALIDATION");
      expect(await storedTask(seriesId)).toEqual(before);
    });

    it("an id outside the household is NOT_FOUND, never FORBIDDEN", async () => {
      expectFailure(
        await updateTask({ id: foreignTaskId, patch: { summary: `Reached ${run}` } }),
        "NOT_FOUND",
      );
      const { rows } = await pool.query<{ summary: string }>(
        "select summary from family.tasks where id = $1",
        [foreignTaskId],
      );
      expect(rows[0]?.summary).toBe(`Foreign ${run}`);
    });
  });

  describe("deleteTask: the confirm gate and FR-347's scope table", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("confirm !== true is VALIDATION and nothing is deleted", async () => {
      const before = await storedTasks();
      expectFailure(await deleteTask({ id: oneOffId, confirm: false }), "VALIDATION");
      const payload = { id: oneOffId } as unknown as DeleteTaskPayload;
      expectFailure(await deleteTask(payload), "VALIDATION");
      expect(await storedTasks()).toEqual(before);
    });

    it("a repeating task with NO scope is VALIDATION — the server never guesses one", async () => {
      const before = await storedTasks();
      expectFailure(await deleteTask({ id: seriesId, confirm: true }), "VALIDATION");
      expectFailure(await deleteTask({ id: routineId, confirm: true }), "VALIDATION");
      expect(await storedTasks()).toEqual(before);
    });

    it("a scope on a ONE-OFF is VALIDATION — there is no series to scope over", async () => {
      const before = await storedTasks();
      expectFailure(
        await deleteTask({
          id: oneOffId,
          confirm: true,
          scope: "this",
          occurrenceKey: choreKey(oneOffId, SERIES_START),
        }),
        "VALIDATION",
      );
      expect(await storedTasks()).toEqual(before);
    });

    it("`this` on a ROUTINE is VALIDATION — FR-347's asymmetry, Skip removes one instead", async () => {
      const before = await storedTasks();
      expectFailure(
        await deleteTask({
          id: routineId,
          confirm: true,
          scope: "this",
          occurrenceKey: {
            taskId: routineId,
            assigneeId: cleoId,
            occurrenceDate: SERIES_START,
            slot: "morning",
            cyclePrev: null,
          },
        }),
        "VALIDATION",
      );
      expect(await storedTasks()).toEqual(before);
      // …while `this_and_future` and `all` ARE the routine's two scopes.
      expectOk(
        await deleteTask({
          id: routineId,
          confirm: true,
          scope: "this_and_future",
          occurrenceKey: {
            taskId: routineId,
            assigneeId: cleoId,
            occurrenceDate: SERIES_LATER,
            slot: "morning",
            cyclePrev: null,
          },
        }),
      );
    });

    it("`this` and `this_and_future` with no occurrence key at all are VALIDATION", async () => {
      const before = await storedTasks();
      expectFailure(await deleteTask({ id: seriesId, confirm: true, scope: "this" }), "VALIDATION");
      expectFailure(
        await deleteTask({ id: seriesId, confirm: true, scope: "this_and_future" }),
        "VALIDATION",
      );
      expect(await storedTasks()).toEqual(before);
    });

    it("an occurrence key the shared expander does not produce is NOT_FOUND", async () => {
      const before = await storedTasks();
      expectFailure(
        await deleteTask({
          id: seriesId,
          confirm: true,
          scope: "this",
          occurrenceKey: choreKey(seriesId, NOT_AN_OCCURRENCE),
        }),
        "NOT_FOUND",
      );
      expectFailure(
        await deleteTask({
          id: seriesId,
          confirm: true,
          scope: "this",
          occurrenceKey: { ...choreKey(seriesId, SERIES_START), assigneeId: anaId },
        }),
        "NOT_FOUND",
      );
      expect(await storedTasks()).toEqual(before);
    });

    it("an id outside the household is NOT_FOUND, never FORBIDDEN, and the row survives", async () => {
      expectFailure(await deleteTask({ id: foreignTaskId, confirm: true }), "NOT_FOUND");
      const { rowCount } = await pool.query("select 1 from family.tasks where id = $1", [
        foreignTaskId,
      ]);
      expect(rowCount).toBe(1);
    });

    it("`all` deletes the row so no skip ghost can outlive it", async () => {
      expectOk(await deleteTask({ id: seriesId, confirm: true, scope: "all" }));
      expect(await storedTask(seriesId)).toBeUndefined();
      expect(await assigneesOf(seriesId)).toEqual([]);
    });
  });

  describe("`this_and_future` on the FIRST occurrence is promoted to `all` (contracts §deleteTask)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("leaves NO family.tasks row for that id — the ghost is never created", async () => {
      expectOk(
        await deleteTask({
          id: seriesId,
          confirm: true,
          scope: "this_and_future",
          occurrenceKey: choreKey(seriesId, SERIES_START),
        }),
      );
      // Asserted, not assumed: truncating here would set UNTIL to the day
      // before `starts_on`, leaving a live row that generates nothing, still
      // appears in the Task list surfaces and still counts against FR-391's
      // assignee arithmetic.
      expect(await storedTask(seriesId)).toBeUndefined();
    });

    it("while a LATER occurrence truncates instead, keeping the row and every earlier date", async () => {
      expectOk(
        await deleteTask({
          id: seriesId,
          confirm: true,
          scope: "this_and_future",
          occurrenceKey: choreKey(seriesId, SERIES_LATER),
        }),
      );
      expect(await storedTask(seriesId)).toMatchObject({
        rrule: SERIES_TRUNCATED,
        starts_on: SERIES_START,
      });
      expect(await assigneesOf(seriesId)).toEqual([cleoId]);
    });
  });

  /**
   * T056 / FR-391 / SC-317 — the phase's ONE destructive path: deleting a
   * Profile deletes the tasks it leaves with nobody to do them. Written before
   * the statement exists, as the plan's ordering requires.
   */
  describe("deleting a Profile takes the tasks nobody else is left to do (FR-391)", () => {
    /** A Profile of this block's own, so no other test's fixture depends on it. */
    let danaId: string;

    async function insertUpForGrabs(summary: string): Promise<string> {
      const { rows } = await pool.query<{ id: string }>(
        "insert into family.tasks (household_id, summary, up_for_grabs, starts_on) " +
          "values ($1, $2, true, $3) returning id",
        [householdId, summary, SERIES_START],
      );
      const [row] = rows;
      if (!row) throw new Error("insert into family.tasks returned no row");
      return row.id;
    }

    /** One resolution row, written straight in: the write path is not the subject here. */
    async function insertResolution(
      taskId: string,
      assigneeId: string | null,
      creditId: string | null,
    ): Promise<string> {
      const { rows } = await pool.query<{ id: string }>(
        "insert into family.task_resolutions " +
          "(household_id, task_id, occurrence_date, assignee_id, category_id, status, resolved_on) " +
          "values ($1, $2, $3, $4, $5, 'complete', $3) returning id",
        [householdId, taskId, SERIES_START, assigneeId, creditId],
      );
      const [row] = rows;
      if (!row) throw new Error("insert into family.task_resolutions returned no row");
      return row.id;
    }

    async function taskIds(): Promise<string[]> {
      return (await storedTasks()).map((row) => row.id);
    }

    async function resolutionCredit(id: string): Promise<{ found: boolean; credit: string | null }> {
      const { rows } = await pool.query<{ category_id: string | null }>(
        "select category_id from family.task_resolutions where id = $1",
        [id],
      );
      const [row] = rows;
      return { found: row !== undefined, credit: row?.category_id ?? null };
    }

    beforeEach(async () => {
      danaId = await insertCategory(pool, {
        householdId,
        label: `Dana ${run}`,
        color: "#FBA994",
      });
      await punchInAs(anaId, ANA_PIN);
    });

    it("deletes the tasks Dana alone was doing, and keeps the ones she shared", async () => {
      const hers = await insertTask(pool, householdId, { summary: `Hers ${run}` });
      await insertAssignee(pool, householdId, hers, danaId);
      const shared = await insertTask(pool, householdId, { summary: `Shared ${run}` });
      await insertAssignee(pool, householdId, shared, danaId);
      await insertAssignee(pool, householdId, shared, cleoId);
      const cleosHistory = await insertResolution(shared, cleoId, cleoId);

      expectOk(await deleteCategory(danaId, { confirm: true }));

      // The orphan is gone; the shared task stands, with the other person's
      // assignment and her history untouched (SC-317).
      expect(await taskIds()).not.toContain(hers);
      expect(await taskIds()).toContain(shared);
      expect(await assigneesOf(shared)).toEqual([cleoId]);
      expect(await resolutionCredit(cleosHistory)).toEqual({ found: true, credit: cleoId });
    });

    it("takes Dana's own chains with her, by the assignee cascade", async () => {
      const hers = await insertTask(pool, householdId, { summary: `Hers again ${run}` });
      await insertAssignee(pool, householdId, hers, danaId);
      const danasHistory = await insertResolution(hers, danaId, danaId);

      expectOk(await deleteCategory(danaId, { confirm: true }));

      expect(await resolutionCredit(danasHistory)).toEqual({ found: false, credit: null });
    });

    /**
     * The refinement FR-391 needs stating: a past CLAIM of an up-for-grabs chore
     * keeps its row and loses only its credit. Deleting it would unlink the
     * middle of the household's chain, rewind the cursor and resurrect a
     * settled occurrence.
     */
    it("keeps an up-for-grabs claim, crediting nobody, and keeps the task itself", async () => {
      const upForGrabs = await insertUpForGrabs(`Anyone ${run}`);
      const claim = await insertResolution(upForGrabs, null, danaId);

      expectOk(await deleteCategory(danaId, { confirm: true }));

      // An up-for-grabs task legitimately has no assignee, so the cleanup must
      // not mistake it for an orphan.
      expect(await taskIds()).toContain(upForGrabs);
      expect(await resolutionCredit(claim)).toEqual({ found: true, credit: null });
    });

    it("leaves every other household's tasks alone", async () => {
      const hers = await insertTask(pool, householdId, { summary: `Hers once more ${run}` });
      await insertAssignee(pool, householdId, hers, danaId);

      expectOk(await deleteCategory(danaId, { confirm: true }));

      const { rowCount } = await pool.query("select 1 from family.tasks where id = $1", [
        foreignTaskId,
      ]);
      expect(rowCount).toBe(1);
    });
  });

  /**
   * T076 / FR-310 / FR-311 / FR-389 — `moveRoutine`, the one task verb that is
   * not parent-only. Written before the action exists, as the plan requires.
   *
   * Three rules are under test and each is a different kind of refusal: WHO may
   * drop (a member in their own column, nobody in another's), WHAT may be
   * dropped (routines; never a chore, because FR-311 forbids reordering chores
   * at all and their order is a fixed rule of the read), and WHERE it may land
   * (between two routines of the same Profile in the same section, and nowhere
   * else). The successful drop asserts the thing R321 exists for: ONE row is
   * written, never a renumbering of the list.
   */
  describe("moveRoutine: reordering a routine inside one column (FR-310, T076)", () => {
    /** Cleo's three Morning routines, in the order they start out in. */
    let morningOne: string;
    let morningTwo: string;
    let morningThree: string;
    /** One Evening routine of Cleo's — a section a Morning drop may not reach. */
    let eveningOne: string;
    /** A Morning routine of ANA's — another column, likewise out of reach. */
    let anasMorning: string;
    /** A plain chore of Cleo's: FR-311 refuses it outright. */
    let choreId: string;

    async function assignAt(taskId: string, categoryId: string, sortOrder: number): Promise<void> {
      await pool.query(
        "insert into family.task_assignees (household_id, task_id, category_id, sort_order) " +
          "values ($1, $2, $3, $4)",
        [householdId, taskId, categoryId, sortOrder],
      );
    }

    async function routineOrder(categoryId: string): Promise<string[]> {
      const { rows } = await pool.query<{ task_id: string }>(
        "select a.task_id from family.task_assignees a join family.tasks t on t.id = a.task_id " +
          "where a.household_id = $1 and a.category_id = $2 and t.routine order by a.sort_order",
        [householdId, categoryId],
      );
      return rows.map((row) => row.task_id);
    }

    async function sortOrders(categoryId: string): Promise<Map<string, number>> {
      const { rows } = await pool.query<{ task_id: string; sort_order: string }>(
        "select task_id, sort_order::text as sort_order from family.task_assignees " +
          "where household_id = $1 and category_id = $2",
        [householdId, categoryId],
      );
      return new Map(rows.map((row) => [row.task_id, Number(row.sort_order)]));
    }

    beforeEach(async () => {
      // The shared reseed hands Cleo three tasks of its own, one of them a
      // Morning routine at the default `sort_order`. This block is about the
      // ORDER of a column, so it starts from an empty one.
      await pool.query(
        "delete from family.task_assignees where household_id = $1 and category_id = $2",
        [householdId, cleoId],
      );

      const routine = async (summary: string, slot: string): Promise<string> =>
        insertTask(pool, householdId, {
          summary: `${summary} ${run}`,
          routine: true,
          startsOn: SERIES_START,
          timesOfDay: [slot],
          rrule: ROUTINE_RRULE,
        });

      morningOne = await routine("Brush teeth", "morning");
      morningTwo = await routine("Make bed", "morning");
      morningThree = await routine("Pack bag", "morning");
      eveningOne = await routine("Read a book", "evening");
      anasMorning = await routine("Ana stretches", "morning");
      choreId = await insertTask(pool, householdId, {
        summary: `Bins ${run}`,
        startsOn: SERIES_START,
      });

      await assignAt(morningOne, cleoId, 1000);
      await assignAt(morningTwo, cleoId, 2000);
      await assignAt(morningThree, cleoId, 3000);
      await assignAt(eveningOne, cleoId, 4000);
      await assignAt(anasMorning, anaId, 1000);
      await assignAt(choreId, cleoId, 5000);
    });

    it("moves a routine within its section and writes exactly ONE sort_order (R321)", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const before = await sortOrders(cleoId);

      expectOk(
        await moveRoutine({
          taskId: morningThree,
          profileId: cleoId,
          previousTaskId: null,
          nextTaskId: morningOne,
        }),
      );

      expect(await routineOrder(cleoId)).toEqual([
        morningThree,
        morningOne,
        morningTwo,
        eveningOne,
      ]);
      const after = await sortOrders(cleoId);
      const moved = [...after].filter(([id, value]) => before.get(id) !== value);
      expect(moved.map(([id]) => id)).toEqual([morningThree]);
    });

    it("a PARENT may reorder somebody else's column (FR-389)", async () => {
      await punchInAs(anaId, ANA_PIN);

      expectOk(
        await moveRoutine({
          taskId: morningOne,
          profileId: cleoId,
          previousTaskId: morningTwo,
          nextTaskId: morningThree,
        }),
      );

      expect(await routineOrder(cleoId)).toEqual([
        morningTwo,
        morningOne,
        morningThree,
        eveningOne,
      ]);
    });

    it("a MEMBER is refused another Profile's column, and nothing moves (FR-351)", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const before = await routineOrder(anaId);

      const message = expectFailure(
        await moveRoutine({
          taskId: anasMorning,
          profileId: anaId,
          previousTaskId: null,
          nextTaskId: null,
        }),
        "FORBIDDEN",
      );

      expect(message).toContain(`Ana ${run}`);
      expect(await routineOrder(anaId)).toEqual(before);
    });

    it("refuses ANY move of a chore outright — chores do not reorder (FR-311)", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const before = await sortOrders(cleoId);

      expectFailure(
        await moveRoutine({
          taskId: choreId,
          profileId: cleoId,
          previousTaskId: null,
          nextTaskId: morningOne,
        }),
        "VALIDATION",
      );

      expect(await sortOrders(cleoId)).toEqual(before);
    });

    it("refuses a landing in ANOTHER time of day (FR-310)", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const before = await routineOrder(cleoId);

      expectFailure(
        await moveRoutine({
          taskId: morningOne,
          profileId: cleoId,
          previousTaskId: eveningOne,
          nextTaskId: null,
        }),
        "VALIDATION",
      );

      expect(await routineOrder(cleoId)).toEqual(before);
    });

    it("refuses a neighbour from another Profile's column (FR-310)", async () => {
      await punchInAs(anaId, ANA_PIN);
      const before = await routineOrder(cleoId);

      expectFailure(
        await moveRoutine({
          taskId: morningOne,
          profileId: cleoId,
          previousTaskId: anasMorning,
          nextTaskId: null,
        }),
        "VALIDATION",
      );

      expect(await routineOrder(cleoId)).toEqual(before);
    });

    it("refuses neighbours that are not next to each other in that section", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const before = await routineOrder(cleoId);

      // Morning reads one, two, three. Dropping "at the very start, and
      // immediately before Make bed" is a claim about a gap that does not
      // exist — Brush teeth is between them.
      expectFailure(
        await moveRoutine({
          taskId: morningThree,
          profileId: cleoId,
          previousTaskId: null,
          nextTaskId: morningTwo,
        }),
        "VALIDATION",
      );

      expect(await routineOrder(cleoId)).toEqual(before);
    });

    it("is NO_ACTOR with nobody punched in, and nothing moves (SC-303, FR-388)", async () => {
      const before = await routineOrder(cleoId);

      expectFailure(
        await moveRoutine({
          taskId: morningThree,
          profileId: cleoId,
          previousTaskId: null,
          nextTaskId: morningOne,
        }),
        "NO_ACTOR",
      );

      expect(await routineOrder(cleoId)).toEqual(before);
    });

    it("is NOT_FOUND for a task outside the household, never FORBIDDEN (FR-390)", async () => {
      await punchInAs(anaId, ANA_PIN);

      expectFailure(
        await moveRoutine({
          taskId: foreignTaskId,
          profileId: cleoId,
          previousTaskId: null,
          nextTaskId: null,
        }),
        "NOT_FOUND",
      );
    });

    it("changes nothing when the routine is dropped where it already was", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const before = await sortOrders(cleoId);

      expectOk(
        await moveRoutine({
          taskId: morningTwo,
          profileId: cleoId,
          previousTaskId: morningOne,
          nextTaskId: morningThree,
        }),
      );

      expect(await sortOrders(cleoId)).toEqual(before);
    });
  });
});
