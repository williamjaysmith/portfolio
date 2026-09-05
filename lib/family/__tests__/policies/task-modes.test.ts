/**
 * T049 — SC-307 end to end, the two repeat modes SIDE BY SIDE, against the live
 * local stack: tasks created through the real `createTask`, resolved through
 * the shipped `completeTaskOccurrence`, and read back through the shipped read
 * path (`fetchTasks` / `fetchTaskCursors`) and the one shared expander
 * `expandTaskDay`. Nothing about a mode is asserted from a fixture row: every
 * expectation below is what the board would actually draw.
 *
 * What this file pins:
 *   - FR-341 / SC-307's absolute half: a Scheduled Date chore left undone for
 *     three of its occurrences still produces the fourth **on schedule**, shows
 *     the three outstanding beside it, and completing today's changes none of
 *     the other three — a missed occurrence never delays or shifts the next;
 *   - US2-9's exact dates: every 2 weeks on Tuesday from 2026-09-08 falls on
 *     8 and 22 September and 6 October, and **none** on the 15th;
 *   - FR-343 / SC-307's cursor half / US2-11 and US2-12: a Completed Date chore
 *     with a two-week delay has **no** next occurrence anywhere until the open
 *     one is completed, and then **exactly one**, dated fourteen days after the
 *     completion — from the resolution's own `resolved_on`, never from the
 *     occurrence's date;
 *   - FR-342's "Immediately": a zero delay lands the next cycle on the same
 *     date, so the day carries the settled cycle and the one it scheduled;
 *   - US2-10 / FR-346: `Repeats until` suppresses everything past its date in
 *     **both** modes;
 *   - FR-333 / FR-334 / US2-7 / US2-8, the row this task gained: a routine
 *     repeating **every 2 days with no weekdays and one time of day SAVES** —
 *     weekdays are a field of the *weekly* repeat, not a requirement of every
 *     routine — on create and on a conversion from a chore;
 *   - FR-332: a changed due date, repeat, interval, end date or **type
 *     conversion** is never refused because the task carries resolutions and
 *     never deletes one. The stranded row is kept and simply not surfaced.
 *
 * A separate file from `task-actions.test.ts`, importing nothing of it, so the
 * two were written together as the plan's Parallel opportunities says.
 *
 * Dates are anchored to the household's own today wherever "late", "carried
 * forward" and "fourteen days after the completion" are the thing under test —
 * those words have no meaning against a frozen date — and to US2-9's literal
 * calendar dates where the scenario names them.
 *
 * RED by design until T050/T051 land `createTask` and `updateTask` in
 * `lib/family/actions/tasks.ts`: `verb()` below throws by name for every export
 * that does not exist yet, which is the failing state T049 must leave behind.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import { addDays, localDateOf } from "@/lib/family/calendar/dates";
import type { ActionResult } from "@/lib/family/errors";
import { fetchTaskCursors, fetchTasks } from "@/lib/family/queries";
import { TASK_RESOLUTION_COLUMNS, toTaskResolution, type TaskResolutionRow } from "@/lib/family/rows";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import type {
  BoardOccurrence,
  OccurrenceKey,
  Task,
  TaskRepeatChoice,
  TaskResolution,
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

// Hoisted: the mock factories below run before any import is evaluated.
const state = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
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
    if (!state.client) throw new Error("task-modes.test: no signed-in client selected");
    return state.client;
  },
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");

/* ------------------------------------------------------------------------- *
 * The surface this file drives (contracts/server-actions.md §Tasks). The two
 * write verbs are T050's and T051's; the resolution verb is shipped.
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

interface TaskModule {
  createTask(input: TaskInputPayload): Promise<ActionResult<Task>>;
  updateTask(input: {
    id: string;
    patch: Partial<Omit<TaskInputPayload, "saveToTaskBox">>;
  }): Promise<ActionResult<Task>>;
  completeTaskOccurrence(input: {
    occurrence: OccurrenceKey;
    creditProfileId?: string;
  }): Promise<ActionResult<TaskResolution>>;
}

const TASKS_MODULE = ["@", "lib", "family", "actions", "tasks"].join("/");
const taskActions = (await import(TASKS_MODULE)) as Partial<TaskModule>;

/** Names the missing export, so a RED run says which task has not landed yet. */
function verb<K extends keyof TaskModule>(name: K): NonNullable<Partial<TaskModule>[K]> {
  const fn = taskActions[name];
  if (fn === undefined) {
    throw new Error(`lib/family/actions/tasks.ts does not export ${name} yet (T050, T051)`);
  }
  return fn;
}

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

async function createTask(input: TaskInputPayload): Promise<Task> {
  return expectOk(await verb("createTask")(input));
}

const ZONE = "America/Chicago";

/** US2-9's own calendar: Tuesdays, and the one the fortnight skips. */
const FORTNIGHT_START = "2026-09-08";
const FORTNIGHT_SKIPPED = "2026-09-15";
const FORTNIGHT_DATES = ["2026-09-08", "2026-09-22", "2026-10-06"];
const FORTNIGHT_RRULE = "FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU";

/** The delay SC-307 and US2-12 name, in days, for the dates they name. */
const DELAY_WEEKS = 2;
const DELAY_DAYS = 14;

/** Far enough past the delay to prove "no next occurrence ANYWHERE" (FR-343). */
const HORIZON_DAYS = 40;

function daysAfter(date: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(date, index + 1));
}

describe("the two repeat modes, side by side (T049, SC-307)", () => {
  const fx = fixtures();
  const run = fx.run;
  const ANA_PIN = "6161";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let anaId: string;
  let cleoId: string;
  /** The household's own today — every relative date below hangs off it. */
  let today: string;

  /** One read of the whole board, replayed over as many days as a test needs. */
  async function boardOf(taskId: string): Promise<(displayedDate: string) => BoardOccurrence[]> {
    const [tasks, cursors, resolutions] = await Promise.all([
      fetchTasks(admin, householdId),
      fetchTaskCursors(admin, householdId),
      allResolutions(),
    ]);
    return (displayedDate: string) =>
      expandTaskDay(tasks, resolutions, cursors, {
        displayedDate,
        todayDate: today,
        zone: ZONE,
      }).filter((one) => one.taskId === taskId);
  }

  /**
   * Every resolution of the household, unwindowed. The board's own read is
   * windowed (T027); windowing here would make a missing occurrence ambiguous
   * between "the mode did not produce it" and "the read did not fetch it", and
   * the mode is what is under test.
   */
  async function allResolutions(): Promise<TaskResolution[]> {
    const { data, error } = await admin
      .schema("family")
      .from("task_resolutions")
      .select(TASK_RESOLUTION_COLUMNS)
      .eq("household_id", householdId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as TaskResolutionRow[]).map(toTaskResolution);
  }

  async function complete(taskId: string, occurrenceDate: string): Promise<TaskResolution> {
    return expectOk(
      await verb("completeTaskOccurrence")({
        occurrence: { taskId, assigneeId: cleoId, occurrenceDate, slot: null, cyclePrev: null },
      }),
    );
  }

  async function storedRule(taskId: string): Promise<{
    rrule: string | null;
    renew_after_amount: number | null;
    renew_until: string | null;
  }> {
    const { rows } = await pool.query<{
      rrule: string | null;
      renew_after_amount: number | null;
      renew_until: string | null;
    }>(
      "select rrule, renew_after_amount, renew_until::text as renew_until " +
        "from family.tasks where id = $1",
      [taskId],
    );
    const [row] = rows;
    if (!row) throw new Error("no such task");
    return row;
  }

  async function resolutionCount(taskId: string): Promise<number> {
    const { rows } = await pool.query<{ count: string }>(
      "select count(*)::text as count from family.task_resolutions where task_id = $1",
      [taskId],
    );
    return Number(rows[0]?.count ?? "0");
  }

  /** The dates in a window on which this task has an OUTSTANDING occurrence. */
  function openDatesIn(
    on: (displayedDate: string) => BoardOccurrence[],
    dates: readonly string[],
  ): string[] {
    return dates.filter((date) => on(date).some((one) => one.state === "unresolved"));
  }

  function scheduledDatesOn(
    on: (displayedDate: string) => BoardOccurrence[],
    date: string,
  ): string[] {
    return on(date)
      .map((one) => one.scheduledDate ?? "")
      .sort();
  }

  async function punchInAs(profileId: string, pin: string): Promise<void> {
    state.cookies.clear();
    expectOk(await punchIn(profileId, pin));
  }

  function choreFor(summary: string, startsOn: string, repeat: TaskRepeatChoice): TaskInputPayload {
    return { summary: `${summary} ${run}`, routine: false, assigneeIds: [cleoId], startsOn, repeat };
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-task-modes`);
    await pool.query("update family.household_settings set timezone = $1 where household_id = $2", [
      ZONE,
      householdId,
    ]);
    today = localDateOf(ZONE, Date.now());

    const email = testEmail("task-modes", run);
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

    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    const { error } = await admin
      .schema("family")
      .rpc("set_pin", { p_user_id: user.id, p_profile: anaId, p_pin: ANA_PIN });
    if (error) throw error;
  });

  beforeEach(async () => {
    await pool.query("delete from family.tasks where household_id = $1", [householdId]);
    await punchInAs(anaId, ANA_PIN);
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  describe("SC-307 with both chores on one board", () => {
    /** Every 7 days from three weeks ago: three missed, the fourth due today. */
    let absoluteId: string;
    /** Two-week delay, seeded today: one open occurrence and nothing after it. */
    let delayedId: string;
    let missed: string[];

    beforeEach(async () => {
      missed = [addDays(today, -21), addDays(today, -14), addDays(today, -7)];
      absoluteId = (
        await createTask(
          choreFor("Take out trash", addDays(today, -21), { kind: "daily", interval: 7 }),
        )
      ).id;
      delayedId = (
        await createTask(
          choreFor("Clean the bathroom", today, {
            kind: "after_completion",
            amount: DELAY_WEEKS,
            unit: "week",
          }),
        )
      ).id;
    });

    it("the absolute chore produces the fourth on schedule with three outstanding beside it", async () => {
      const on = await boardOf(absoluteId);
      // The fourth arrived on its own date; the three that were missed stand
      // beside it, each carrying its own scheduled date (FR-341, FR-358).
      expect(scheduledDatesOn(on, today)).toEqual([...missed, today].sort());
      expect(on(today).filter((one) => one.state === "unresolved")).toHaveLength(4);
      expect(
        on(today)
          .filter((one) => one.isLate)
          .map((one) => one.scheduledDate)
          .sort(),
      ).toEqual([...missed].sort());
    });

    it("completing today's changes none of the other three", async () => {
      await complete(absoluteId, today);
      const on = await boardOf(absoluteId);
      expect(
        on(today)
          .filter((one) => one.state === "complete")
          .map((one) => one.scheduledDate),
      ).toEqual([today]);
      expect(openDatesIn(on, missed)).toEqual(missed);
      expect(
        on(today)
          .filter((one) => one.state === "unresolved")
          .map((one) => one.scheduledDate)
          .sort(),
      ).toEqual([...missed].sort());
    });

    it("the delayed chore produces NO next occurrence until it is completed (US2-11)", async () => {
      const on = await boardOf(delayedId);
      expect(scheduledDatesOn(on, today)).toEqual([today]);
      // Not merely "not on day 14" — nowhere at all for the next six weeks.
      expect(openDatesIn(on, daysAfter(today, HORIZON_DAYS))).toEqual([]);
    });

    it("…then exactly one, dated by the delay from the COMPLETION (US2-12)", async () => {
      const before = await boardOf(delayedId);
      const due = addDays(today, DELAY_DAYS);
      expect(before(due)).toEqual([]);

      const done = await complete(delayedId, today);
      const on = await boardOf(delayedId);
      // Counted from the day it was ticked, which is the day the record kept —
      // never from the occurrence's own date.
      const expected = addDays(done.resolvedOn, DELAY_DAYS);
      expect(openDatesIn(on, daysAfter(today, HORIZON_DAYS))).toEqual([expected]);
      expect(scheduledDatesOn(on, expected)).toEqual([expected]);
      expect(on(expected)[0]?.cyclePrev).toBe(done.id);
    });

    it("the contrast in one read: the schedule marches on, the delay waits", async () => {
      const absolute = await boardOf(absoluteId);
      const delayed = await boardOf(delayedId);
      const future = daysAfter(today, HORIZON_DAYS);

      // Absolute: three missed occurrences delayed nothing — the next five
      // arrive on their own dates all the same (FR-341).
      expect(openDatesIn(absolute, future)).toEqual(
        [7, 14, 21, 28, 35].map((days) => addDays(today, days)),
      );
      expect(absolute(today)).toHaveLength(4);

      // Delayed: one open occurrence and, until it is resolved, nothing after
      // it anywhere (FR-343).
      expect(openDatesIn(delayed, future)).toEqual([]);
      expect(delayed(today)).toHaveLength(1);
    });
  });

  describe("US2-9's own dates: every 2 weeks on Tuesday from 2026-09-08", () => {
    it("falls on 8 and 22 September and 6 October, and never on the 15th", async () => {
      const task = await createTask(
        choreFor("Hoover the stairs", FORTNIGHT_START, {
          kind: "weekly",
          interval: 2,
          weekdays: ["TU"],
        }),
      );
      // WKST is required above interval 1, or a stored rule's week parity is
      // ambiguous; the client never sent a rule string (R201).
      expect(await storedRule(task.id)).toMatchObject({ rrule: FORTNIGHT_RRULE });

      const on = await boardOf(task.id);
      for (const date of FORTNIGHT_DATES) expect(scheduledDatesOn(on, date)).toEqual([date]);
      expect(on(FORTNIGHT_SKIPPED).some((one) => one.scheduledDate === FORTNIGHT_SKIPPED)).toBe(
        false,
      );
    });
  });

  describe("FR-342's 'Immediately' lands the next cycle on the same date", () => {
    it("the day carries the cycle just settled and the one it scheduled", async () => {
      const task = await createTask(
        choreFor("Descale the kettle", today, {
          kind: "after_completion",
          amount: 0,
          unit: "day",
        }),
      );
      const done = await complete(task.id, today);

      const on = await boardOf(task.id);
      const day = on(done.resolvedOn);
      expect(day).toHaveLength(2);
      expect(day.filter((one) => one.state === "complete")).toHaveLength(1);
      const open = day.filter((one) => one.state === "unresolved");
      expect(open).toHaveLength(1);
      expect(open[0]?.cyclePrev).toBe(done.id);
    });
  });

  describe("US2-10: `Repeats until` suppresses everything past its date, in BOTH modes", () => {
    it("rule mode stops after the end date", async () => {
      const until = addDays(today, 7);
      const task = await createTask(
        choreFor("Homework", today, { kind: "daily", interval: 7, until }),
      );
      const on = await boardOf(task.id);
      expect(openDatesIn(on, [today, ...daysAfter(today, HORIZON_DAYS)])).toEqual([today, until]);
    });

    it("cursor mode schedules no cycle past the end date, however it is completed", async () => {
      const until = addDays(today, 7);
      const task = await createTask(
        choreFor("Water the plants", today, {
          kind: "after_completion",
          amount: DELAY_WEEKS,
          unit: "week",
          until,
        }),
      );
      expect(await storedRule(task.id)).toMatchObject({ rrule: null, renew_until: until });

      await complete(task.id, today);
      const on = await boardOf(task.id);
      // The next cycle would fall on day 14, past the end date, so there is no
      // open occurrence anywhere — and the settled one still shows on its day.
      expect(openDatesIn(on, [today, ...daysAfter(today, HORIZON_DAYS)])).toEqual([]);
      expect(on(today).filter((one) => one.state === "complete")).toHaveLength(1);
    });
  });

  describe("a routine repeating every 2 days with NO weekdays saves (FR-333, FR-334, US2-7/8)", () => {
    function everyTwoDays(summary: string): TaskInputPayload {
      return {
        summary: `${summary} ${run}`,
        routine: true,
        assigneeIds: [cleoId],
        startsOn: today,
        timesOfDay: ["morning"],
        repeat: { kind: "daily", interval: 2 },
      };
    }

    it("on create — weekdays are a field of the WEEKLY repeat, not of every routine", async () => {
      const task = await createTask(everyTwoDays("Make bed"));
      expect(await storedRule(task.id)).toMatchObject({ rrule: "FREQ=DAILY;INTERVAL=2" });

      const on = await boardOf(task.id);
      expect(on(today).map((one) => one.slot)).toEqual(["morning"]);
      expect(on(addDays(today, 1))).toEqual([]);
      expect(scheduledDatesOn(on, addDays(today, 2))).toEqual([addDays(today, 2)]);
    });

    it("and on a conversion from a chore, which is US2-8's own reading", async () => {
      const chore = await createTask(choreFor("Tidy up", today, { kind: "never" }));
      expectOk(
        await verb("updateTask")({
          id: chore.id,
          patch: {
            routine: true,
            timesOfDay: ["morning"],
            repeat: { kind: "daily", interval: 2 },
          },
        }),
      );
      expect(await storedRule(chore.id)).toMatchObject({ rrule: "FREQ=DAILY;INTERVAL=2" });
      const on = await boardOf(chore.id);
      expect(on(today).map((one) => one.routine)).toEqual([true]);
    });
  });

  describe("FR-332: no edit is refused for carrying resolutions, and none deletes one", () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await createTask(
        choreFor("Set the table", today, { kind: "daily", interval: 1 }),
      );
      taskId = task.id;
      await complete(taskId, today);
      expect(await resolutionCount(taskId)).toBe(1);
    });

    it("a changed due date is accepted and strands the row rather than deleting it", async () => {
      const moved = addDays(today, 3);
      expectOk(await verb("updateTask")({ id: taskId, patch: { startsOn: moved } }));
      expect(await resolutionCount(taskId)).toBe(1);

      const on = await boardOf(taskId);
      // The occurrence it settled no longer exists, so it is simply not
      // surfaced — which is what deriving occurrences does for free.
      expect(on(today)).toEqual([]);
      expect(scheduledDatesOn(on, moved)).toEqual([moved]);
    });

    it("a changed repeat and interval are accepted and the row survives", async () => {
      expectOk(
        await verb("updateTask")({ id: taskId, patch: { repeat: { kind: "daily", interval: 3 } } }),
      );
      expect(await storedRule(taskId)).toMatchObject({ rrule: "FREQ=DAILY;INTERVAL=3" });
      expect(await resolutionCount(taskId)).toBe(1);
    });

    it("a changed end date is accepted and the row survives past it", async () => {
      const until = addDays(today, 2);
      expectOk(
        await verb("updateTask")({
          id: taskId,
          patch: { repeat: { kind: "daily", interval: 1, until } },
        }),
      );
      expect(await resolutionCount(taskId)).toBe(1);
      const on = await boardOf(taskId);
      expect(openDatesIn(on, daysAfter(until, 5))).toEqual([]);
    });

    it("a TYPE CONVERSION is accepted and the row survives (FR-318 crossed with FR-332)", async () => {
      expectOk(
        await verb("updateTask")({
          id: taskId,
          patch: {
            routine: true,
            timesOfDay: ["evening"],
            repeat: { kind: "daily", interval: 2 },
          },
        }),
      );
      expect(await resolutionCount(taskId)).toBe(1);
      const on = await boardOf(taskId);
      // The stored resolution named no slot, so the routine's evening
      // occurrence is outstanding — the row is kept, not surfaced.
      expect(on(today).map((one) => one.state)).toEqual(["unresolved"]);
    });
  });
});
