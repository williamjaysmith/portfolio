/**
 * T034 / T036 — the resolution write surface: the punch-in gate, FR-351's
 * ownership rule and the record every resolution stores, against the live local
 * stack with the same plumbing as `event-actions.test.ts` — Next's cookie store
 * is an in-memory jar, the request's Supabase session is a real signed-in
 * client, and everything else (the guards, the signed actor cookie, the admin
 * client, RLS, the triggers, the shared expander) is production code.
 *
 * Covered here, per contracts/server-actions.md §Resolutions:
 *   - SC-303 / FR-388: complete and un-complete are refused with `NO_ACTOR`
 *     when nobody is punched in and when the cookie is forged, and nothing is
 *     written — every call in this file bypasses the interface by construction;
 *   - SC-304 / FR-351: member on own → allowed; member on another's →
 *     `FORBIDDEN` naming whose task it is and that a parent may do it; parent on
 *     another's → allowed;
 *   - T034 / R323: a parent DEMOTED on another device, still holding a valid
 *     actor cookie that says `parent`, is refused — the role is re-read from the
 *     database, not taken from the cookie — and `requireParent()` refuses it
 *     too, which is the shipped Phase 1 guarantee `createTask` (T050) rests on;
 *   - FR-354: every stored resolution names BOTH the credited Profile and the
 *     punched-in actor, and `tasks.updated_by` is left untouched;
 *   - SC-308: `resolved_on` is the household-local date of the WRITE — proved by
 *     writing the same occurrence under two household zones 25 hours apart, so
 *     the two dates always differ — never the occurrence's own date, and never
 *     the client's, which the strict payload refuses outright;
 *   - an occurrence key the shared `expandTaskDay` does not produce →
 *     `NOT_FOUND`, so a stale client cannot resolve a phantom;
 *   - a duplicate resolution → `23505` → `CONFLICT` reporting the stored state,
 *     with never a second row;
 *   - FR-344: `23503` → `CONFLICT` when the undo's scheduled successor has
 *     itself been resolved, and nothing is deleted;
 *   - FR-371/373/374: the streak checkpoint moves as the second statement and
 *     steps back by exactly one when the completion is un-ticked.
 *
 * Fixture rows are created by this file in run-tagged households of its own,
 * never taken from the seed, so nothing here can drift with — or damage — the
 * shared seeded board.
 *
 * RED by design until T037 lands `lib/family/actions/tasks.ts`: the dynamic
 * import below fails while the module does not exist, which is exactly the
 * failing state T036 must leave behind.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import { addDays, localDateOf } from "@/lib/family/calendar/dates";
import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { OccurrenceKey, TaskResolution } from "@/lib/family/types";
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
    if (!state.client) throw new Error("task-resolutions.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");
const { requireParent } = await import("@/lib/family/guards");

/** The surface T037 must export (contracts/server-actions.md §Resolutions). */
interface TaskActionsModule {
  completeTaskOccurrence(input: {
    occurrence: OccurrenceKey;
    creditProfileId?: string;
  }): Promise<ActionResult<TaskResolution>>;
  unresolveTaskOccurrence(input: { occurrence: OccurrenceKey }): Promise<ActionResult<null>>;
}

// Joined at runtime so `tsc` stays clean while the module does not exist yet;
// Vitest resolves the `@` alias when the import actually runs. Until T037
// creates the module this await throws and the whole suite is RED — the failing
// state T036 must leave behind.
const TASKS_MODULE = ["@", "lib", "family", "actions", "tasks"].join("/");
const { completeTaskOccurrence, unresolveTaskOccurrence } = (await import(
  TASKS_MODULE
)) as TaskActionsModule;

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

function expectFailure(result: ActionResult<unknown>, code: ActionError): string {
  expect(result).toMatchObject({ ok: false, error: code });
  return result.ok ? "" : result.message;
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

/**
 * The household's zone, and a second one 25 hours away from it. Their local
 * dates differ at EVERY instant, which is what makes SC-308's "the household's
 * date, not the server's" a deterministic assertion rather than a lucky one.
 */
const ZONE = "Pacific/Kiritimati";
const FAR_ZONE = "Pacific/Niue";

// Fixed past dates: every occurrence below is identified by its own scheduled
// date, so nothing here drifts with the calendar or with the run's clock.
const CHORE_DATE = "2026-08-11";
const ROUTINE_ANCHOR = "2026-08-01";
const ROUTINE_DATE = "2026-08-20";
const ROUTINE_RRULE = "FREQ=DAILY;INTERVAL=1";
const CURSOR_START = "2026-08-05";
/** The join row's own creation date — the Completed Date chain's seed (R309). */
const CHAIN_STARTED_AT = "2026-01-01T00:00:00Z";

interface TaskSeed {
  summary: string;
  routine?: boolean;
  trackHabit?: boolean;
  startsOn?: string | null;
  timesOfDay?: string[];
  rrule?: string | null;
  renewAfterAmount?: number | null;
  renewAfterUnit?: string | null;
}

async function insertTask(pool: Pool, householdId: string, seed: TaskSeed): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.tasks (household_id, summary, routine, track_habit, starts_on, " +
      "times_of_day, rrule, renew_after_amount, renew_after_unit) " +
      "values ($1, $2, $3, $4, $5, $6::family.time_of_day[], $7, $8, $9) returning id",
    [
      householdId,
      seed.summary,
      seed.routine ?? false,
      seed.trackHabit ?? false,
      seed.startsOn ?? null,
      seed.timesOfDay ?? [],
      seed.rrule ?? null,
      seed.renewAfterAmount ?? null,
      seed.renewAfterUnit ?? null,
    ],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.tasks returned no row");
  return row.id;
}

/** `createdAt` is the chain seed, so the cursor fixtures pin it rather than take `now()`. */
async function insertAssignee(
  pool: Pool,
  householdId: string,
  seed: { taskId: string; categoryId: string; createdAt?: string },
): Promise<void> {
  await pool.query(
    "insert into family.task_assignees (household_id, task_id, category_id, created_at) " +
      "values ($1, $2, $3, coalesce($4::timestamptz, now()))",
    [householdId, seed.taskId, seed.categoryId, seed.createdAt ?? null],
  );
}

interface StoredResolution {
  id: string;
  task_id: string;
  occurrence_date: string | null;
  occurrence_slot: string | null;
  assignee_id: string | null;
  category_id: string | null;
  cycle_prev: string | null;
  status: string;
  resolved_on: string;
  created_by: string | null;
}

describe("task resolutions: the punch-in gate, FR-351 ownership and the stored record (T034, T036)", () => {
  const fx = fixtures();
  const run = fx.run;
  const ANA_PIN = "4141";
  const CLEO_PIN = "4242";
  const SWING_PIN = "4343";
  const GHOST_PIN = "4444";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  /** The household's parent — FR-351's "a parent may resolve anything". */
  let anaId: string;
  /** A member who owns `cleoChoreId`, the routine and the Completed Date chain. */
  let cleoId: string;
  /** A member who owns `benChoreId` — nobody punches in as Ben. */
  let benId: string;
  /** Punched in as a parent, then demoted underneath its own cookie (T034). */
  let swingId: string;
  /** Punched in, then deleted underneath its own cookie. */
  let ghostId: string;

  let cleoChoreId: string;
  let benChoreId: string;
  let routineId: string;
  let cursorChoreId: string;
  let foreignTaskId: string;

  function keyFor(taskId: string, assigneeId: string, date: string | null): OccurrenceKey {
    return { taskId, assigneeId, occurrenceDate: date, slot: null, cyclePrev: null };
  }

  async function storedFor(taskId: string): Promise<StoredResolution[]> {
    const { rows } = await pool.query<StoredResolution>(
      "select id, task_id, occurrence_date::text as occurrence_date, " +
        "occurrence_slot::text as occurrence_slot, assignee_id, category_id, cycle_prev, " +
        "status, resolved_on::text as resolved_on, created_by " +
        "from family.task_resolutions where task_id = $1 order by created_at",
      [taskId],
    );
    return rows;
  }

  async function clearResolutions(taskId: string): Promise<void> {
    await pool.query("delete from family.task_resolutions where task_id = $1", [taskId]);
  }

  async function streakOf(taskId: string, categoryId: string): Promise<{
    streak_count: number;
    streak_through: string | null;
  }> {
    const { rows } = await pool.query<{ streak_count: number; streak_through: string | null }>(
      "select streak_count, streak_through::text as streak_through from family.task_assignees " +
        "where task_id = $1 and category_id = $2",
      [taskId, categoryId],
    );
    const [row] = rows;
    if (!row) throw new Error("no such assignee row");
    return row;
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

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-task-resolutions`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-task-resolutions-other`);
    await setZone(ZONE);

    const email = testEmail("task-resolutions", run);
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
    cleoId = await insertCategory(pool, { householdId, label: `Cleo ${run}`, color: "#B6E085" });
    benId = await insertCategory(pool, { householdId, label: `Ben ${run}`, color: "#FBA994" });
    swingId = await insertCategory(pool, {
      householdId,
      label: `Swing ${run}`,
      color: "#FBD97E",
      role: "parent",
    });
    ghostId = await insertCategory(pool, { householdId, label: `Ghost ${run}`, color: "#915EA1" });

    cleoChoreId = await insertTask(pool, householdId, {
      summary: `Cleo's chore ${run}`,
      startsOn: CHORE_DATE,
    });
    await insertAssignee(pool, householdId, { taskId: cleoChoreId, categoryId: cleoId });

    benChoreId = await insertTask(pool, householdId, {
      summary: `Ben's chore ${run}`,
      startsOn: CHORE_DATE,
    });
    await insertAssignee(pool, householdId, { taskId: benChoreId, categoryId: benId });

    routineId = await insertTask(pool, householdId, {
      summary: `Cleo's routine ${run}`,
      routine: true,
      trackHabit: true,
      startsOn: ROUTINE_ANCHOR,
      timesOfDay: ["morning"],
      rrule: ROUTINE_RRULE,
    });
    await insertAssignee(pool, householdId, { taskId: routineId, categoryId: cleoId });

    cursorChoreId = await insertTask(pool, householdId, {
      summary: `Cleo's bins ${run}`,
      startsOn: CURSOR_START,
      renewAfterAmount: 1,
      renewAfterUnit: "day",
    });
    await insertAssignee(pool, householdId, {
      taskId: cursorChoreId,
      categoryId: cleoId,
      createdAt: CHAIN_STARTED_AT,
    });

    foreignTaskId = await insertTask(pool, otherHouseholdId, {
      summary: `Foreign ${run}`,
      startsOn: CHORE_DATE,
    });

    // Binds the allowlist row to the account, exactly as the first sign-in does
    // — `set_pin` refuses a caller who has not claimed yet.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(anaId, ANA_PIN);
    await givePin(cleoId, CLEO_PIN);
    await givePin(swingId, SWING_PIN);
    await givePin(ghostId, GHOST_PIN);
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteHousehold(pool, otherHouseholdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  describe("with nobody punched in every resolution is NO_ACTOR (SC-303, FR-388)", () => {
    let seededId: string;

    beforeEach(async () => {
      await clearResolutions(cleoChoreId);
      await punchInAs(cleoId, CLEO_PIN);
      seededId = expectOk(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
      ).id;
      state.cookies.clear();
    });

    it("completeTaskOccurrence → NO_ACTOR and no row appears", async () => {
      await clearResolutions(cleoChoreId);
      expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        "NO_ACTOR",
      );
      expect(await storedFor(cleoChoreId)).toHaveLength(0);
    });

    it("unresolveTaskOccurrence → NO_ACTOR and the row survives", async () => {
      expectFailure(
        await unresolveTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        "NO_ACTOR",
      );
      expect((await storedFor(cleoChoreId)).map((row) => row.id)).toEqual([seededId]);
    });

    it("a tampered actor cookie is refused on both verbs and nothing is written", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const token = state.cookies.get(ACTOR_COOKIE) ?? "";
      expect(token).not.toBe("");
      const forged = tamper(token);

      state.cookies.set(ACTOR_COOKIE, forged);
      expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        "NO_ACTOR",
      );
      state.cookies.set(ACTOR_COOKIE, forged);
      expectFailure(
        await unresolveTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        "NO_ACTOR",
      );

      expect((await storedFor(cleoChoreId)).map((row) => row.id)).toEqual([seededId]);
      state.cookies.clear();
    });
  });

  describe("FR-351's ownership rule, on four paths (SC-304)", () => {
    beforeEach(async () => {
      await clearResolutions(cleoChoreId);
      await clearResolutions(benChoreId);
    });

    it("a member resolves their OWN occurrence, credited and attributed to them", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const created = expectOk(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
      );
      expect(created).toMatchObject({
        taskId: cleoChoreId,
        assigneeId: cleoId,
        categoryId: cleoId,
        occurrenceDate: CHORE_DATE,
        status: "complete",
      });

      const [stored] = await storedFor(cleoChoreId);
      expect(stored).toMatchObject({
        assignee_id: cleoId,
        category_id: cleoId,
        created_by: cleoId,
        status: "complete",
        occurrence_date: CHORE_DATE,
        occurrence_slot: null,
      });
    });

    it("a member is refused ANOTHER Profile's occurrence, told whose it is, and writes nothing", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const message = expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }),
        "FORBIDDEN",
      );
      expect(message).toContain(`Ben ${run}`);
      expect(message).toContain("parent");
      expect(await storedFor(benChoreId)).toHaveLength(0);
    });

    it("a member is refused UNDOING another Profile's stored resolution", async () => {
      await punchInAs(anaId, ANA_PIN);
      expectOk(await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }));

      await punchInAs(cleoId, CLEO_PIN);
      expectFailure(
        await unresolveTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }),
        "FORBIDDEN",
      );
      expect(await storedFor(benChoreId)).toHaveLength(1);
    });

    it("a parent resolves another Profile's occurrence: the record names BOTH (FR-354)", async () => {
      await punchInAs(anaId, ANA_PIN);
      expectOk(await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }));

      const [stored] = await storedFor(benChoreId);
      // The credit is Ben's; the actor is Ana. "Ana ticked Ben's chore" is a
      // fact the record keeps (Assumption 3).
      expect(stored).toMatchObject({ category_id: benId, created_by: anaId, assignee_id: benId });
    });

    it("a parent can undo another Profile's resolution, and the row is REMOVED not marked (FR-355)", async () => {
      await punchInAs(anaId, ANA_PIN);
      expectOk(await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }));
      expectOk(
        await unresolveTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }),
      );
      expect(await storedFor(benChoreId)).toHaveLength(0);
    });
  });

  describe("the actor's role is re-read from the database, never from the cookie (T034, R323)", () => {
    beforeEach(async () => {
      await clearResolutions(benChoreId);
    });

    it("a parent demoted on another device loses the power immediately, on both surfaces", async () => {
      await punchInAs(swingId, SWING_PIN);
      // Still a parent: the same call succeeds before the demotion, so the
      // refusal below is the ROLE changing and not the cookie failing.
      expectOk(await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }));
      expectOk(
        await unresolveTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }),
      );

      // Another device demotes them. The cookie still says `parent`.
      await pool.query("update family.categories set role = 'member' where id = $1", [swingId]);

      const message = expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }),
        "FORBIDDEN",
      );
      expect(message).toContain(`Ben ${run}`);
      expect(await storedFor(benChoreId)).toHaveLength(0);

      // The parent-only surface is unchanged: this is the guard `createTask`
      // (T050) is built on, refusing the same stale cookie.
      await expect(requireParent()).rejects.toMatchObject({ code: "FORBIDDEN" });

      await pool.query("update family.categories set role = 'parent' where id = $1", [swingId]);
    });

    it("a profile deleted underneath its own cookie is NO_ACTOR, and the cookie is cleared", async () => {
      await punchInAs(ghostId, GHOST_PIN);
      await pool.query("delete from family.categories where id = $1", [ghostId]);

      expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        "NO_ACTOR",
      );
      expect(state.cookies.has(ACTOR_COOKIE)).toBe(false);
    });
  });

  describe("the stored record (FR-353, FR-354, SC-308)", () => {
    beforeEach(async () => {
      await clearResolutions(cleoChoreId);
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("resolved_on is the household-local date of the WRITE, not the occurrence's own", async () => {
      const before = localDateOf(ZONE, Date.now());
      expectOk(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
      );
      const after = localDateOf(ZONE, Date.now());

      const [stored] = await storedFor(cleoChoreId);
      expect(stored?.occurrence_date).toBe(CHORE_DATE);
      expect([before, after]).toContain(stored?.resolved_on);
      expect(stored?.resolved_on).not.toBe(CHORE_DATE);
    });

    it("that date comes from the HOUSEHOLD's zone: two zones, two different dates", async () => {
      try {
        expectOk(
          await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        );
        const [here] = await storedFor(cleoChoreId);

        await clearResolutions(cleoChoreId);
        await setZone(FAR_ZONE);
        expectOk(
          await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        );
        const [far] = await storedFor(cleoChoreId);

        // 25 hours apart, so their local dates differ at every instant: only a
        // date read from the HOUSEHOLD's own zone can move when the zone does.
        expect(far?.resolved_on).not.toBe(here?.resolved_on);
      } finally {
        await setZone(ZONE);
      }
    });

    it("the client cannot name the date: an extra payload field is refused", async () => {
      const payload = {
        occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE),
        resolvedOn: "2026-01-01",
      } as unknown as { occurrence: OccurrenceKey };
      expectFailure(await completeTaskOccurrence(payload), "VALIDATION");
      expect(await storedFor(cleoChoreId)).toHaveLength(0);
    });

    it("tasks.updated_by and updated_at are untouched by a resolution", async () => {
      const readTask = async () => {
        const { rows } = await pool.query<{ updated_by: string | null; updated_at: string }>(
          "select updated_by, updated_at::text as updated_at from family.tasks where id = $1",
          [cleoChoreId],
        );
        return rows[0];
      };
      const before = await readTask();
      expectOk(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
      );
      expect(await readTask()).toEqual(before);
    });
  });

  describe("an occurrence the shared expander does not produce is NOT_FOUND", () => {
    beforeEach(async () => {
      await clearResolutions(cleoChoreId);
      await punchInAs(anaId, ANA_PIN);
    });

    it("a date the task does not fall on", async () => {
      expectFailure(
        await completeTaskOccurrence({
          occurrence: keyFor(cleoChoreId, cleoId, addDays(CHORE_DATE, 1)),
        }),
        "NOT_FOUND",
      );
      expect(await storedFor(cleoChoreId)).toHaveLength(0);
    });

    it("an assignee the task is not assigned to", async () => {
      expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(cleoChoreId, benId, CHORE_DATE) }),
        "NOT_FOUND",
      );
      expect(await storedFor(cleoChoreId)).toHaveLength(0);
    });

    it("a slot the routine does not run in", async () => {
      expectFailure(
        await completeTaskOccurrence({
          occurrence: {
            taskId: routineId,
            assigneeId: cleoId,
            occurrenceDate: ROUTINE_DATE,
            slot: "evening",
            cyclePrev: null,
          },
        }),
        "NOT_FOUND",
      );
      expect(await storedFor(routineId)).toHaveLength(0);
    });

    it("a task in another household — NOT_FOUND, never FORBIDDEN", async () => {
      expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(foreignTaskId, cleoId, CHORE_DATE) }),
        "NOT_FOUND",
      );
      expect(await storedFor(foreignTaskId)).toHaveLength(0);
    });

    it("undoing an occurrence with no stored resolution", async () => {
      expectFailure(
        await unresolveTaskOccurrence({ occurrence: keyFor(cleoChoreId, cleoId, CHORE_DATE) }),
        "NOT_FOUND",
      );
    });
  });

  describe("a second resolution of one occurrence is CONFLICT, never a second row (FR-370)", () => {
    beforeEach(async () => {
      await clearResolutions(benChoreId);
      await punchInAs(anaId, ANA_PIN);
    });

    it("the duplicate reports the stored state and names the credited Profile", async () => {
      expectOk(await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }));
      const message = expectFailure(
        await completeTaskOccurrence({ occurrence: keyFor(benChoreId, benId, CHORE_DATE) }),
        "CONFLICT",
      );
      expect(message).toContain(`Ben ${run}`);
      expect(await storedFor(benChoreId)).toHaveLength(1);
    });
  });

  describe("FR-344: an undo whose scheduled successor is already resolved is refused", () => {
    beforeEach(async () => {
      await clearResolutions(cursorChoreId);
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("23503 → CONFLICT, and nothing is deleted until the later cycle goes first", async () => {
      // Cycle 1 is the chain's seed: max(starts_on, the join row's own date).
      const first = expectOk(
        await completeTaskOccurrence({ occurrence: keyFor(cursorChoreId, cleoId, CURSOR_START) }),
      );
      // Cycle 2 is derived from the TAIL's resolved_on, not from cycle 1's date
      // (FR-362) — the cursor moved when it was ticked.
      const secondDate = addDays(first.resolvedOn, 1);
      const second = expectOk(
        await completeTaskOccurrence({
          occurrence: {
            taskId: cursorChoreId,
            assigneeId: cleoId,
            occurrenceDate: secondDate,
            slot: null,
            cyclePrev: first.id,
          },
        }),
      );
      expect(second.cyclePrev).toBe(first.id);

      expectFailure(
        await unresolveTaskOccurrence({ occurrence: keyFor(cursorChoreId, cleoId, CURSOR_START) }),
        "CONFLICT",
      );
      expect(await storedFor(cursorChoreId)).toHaveLength(2);

      // Withdrawn newest-first, the chain unwinds.
      expectOk(
        await unresolveTaskOccurrence({
          occurrence: {
            taskId: cursorChoreId,
            assigneeId: cleoId,
            occurrenceDate: secondDate,
            slot: null,
            cyclePrev: first.id,
          },
        }),
      );
      expectOk(
        await unresolveTaskOccurrence({ occurrence: keyFor(cursorChoreId, cleoId, CURSOR_START) }),
      );
      expect(await storedFor(cursorChoreId)).toHaveLength(0);
    });
  });

  describe("the habit streak checkpoint moves with the write (FR-371, FR-373, FR-374)", () => {
    const morning: OccurrenceKey = {
      taskId: "",
      assigneeId: "",
      occurrenceDate: ROUTINE_DATE,
      slot: "morning",
      cyclePrev: null,
    };

    beforeEach(async () => {
      await clearResolutions(routineId);
      await pool.query(
        "update family.task_assignees set streak_count = 0, streak_through = null " +
          "where task_id = $1 and category_id = $2",
        [routineId, cleoId],
      );
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("a day whose every occurrence is complete advances the count, and un-ticking steps it back", async () => {
      const occurrence = { ...morning, taskId: routineId, assigneeId: cleoId };
      expectOk(await completeTaskOccurrence({ occurrence }));
      expect(await streakOf(routineId, cleoId)).toEqual({
        streak_count: 1,
        streak_through: ROUTINE_DATE,
      });

      expectOk(await unresolveTaskOccurrence({ occurrence }));
      expect((await streakOf(routineId, cleoId)).streak_count).toBe(0);
    });
  });
});
