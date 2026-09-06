/**
 * T011: the Phase 3 data-model invariants pinned at the store, exercised
 * through the secret key the way the server actions write — so every refusal
 * surfaces as the SQLSTATE the actions must map, and every named CHECK is
 * asserted by name out of the message Postgres returns. The `events-schema`
 * pattern: each constraint and each trigger is shown actually refusing its own
 * invalid row, not merely declared.
 *
 * Covered: the nine named CHECKs on `family.tasks` (017), `tasks_rrule_grammar`
 * including the widened `INTERVAL` bound (FR-345, R305), the two 017 triggers
 * that hold FR-323 and FR-365, `task_assignees_streak_shape` (FR-371/373), the
 * four rules in `assert_task_resolution` (FR-359, FR-363, FR-368, and the chain
 * that cannot fork), the five-column occurrence key with its
 * `nulls not distinct` semantics (FR-353, FR-370, and the "Immediately" cycle
 * that differs only in `cycle_prev` — invariant 7, R308 job 2),
 * `task_resolutions_cycle_fk` as FR-344 (`23503` on a single-row delete with a
 * child, while a whole-chain delete in one statement succeeds — FR-391),
 * composite-FK tenancy on all three tables (FR-390), the cascades, and
 * `family.seed_task_box` producing exactly the seventeen templates and being
 * idempotent by emptiness rather than by conflict (FR-381, FR-382, SC-318).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import {
  adminClient,
  createPool,
  deleteHousehold,
  fixtures,
  insertCategory,
  insertHousehold,
} from "./helpers";

/** A valid routine: a rule, at least one slot, no due time (017). */
const ROUTINE = {
  routine: true,
  starts_on: "2026-09-01",
  rrule: "FREQ=DAILY;INTERVAL=1",
  times_of_day: ["morning"],
};

/** A valid Scheduled Date chore — rule mode, at the widened interval. */
const REPEATING_CHORE = {
  starts_on: "2026-09-01",
  rrule: "FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU",
};

/** A valid Completed Date chore — `renew_after_amount` IS the mode (FR-342). */
const CURSOR_CHORE = {
  starts_on: "2026-09-01",
  renew_after_amount: 14,
  renew_after_unit: "day",
};

/** `task_slots_shape`'s seven literals: non-empty, ordered, deduplicated. */
const LEGAL_SLOT_SETS = [
  ["morning"],
  ["afternoon"],
  ["evening"],
  ["morning", "afternoon"],
  ["morning", "evening"],
  ["afternoon", "evening"],
  ["morning", "afternoon", "evening"],
];

/** FR-382, verbatim: nine chores with no emoji, eight routines each with one. */
const SEEDED_TEMPLATES: readonly (readonly [string, string | null, boolean])[] = [
  ["Laundry", null, false],
  ["Dishes", null, false],
  ["Clean room", null, false],
  ["Vacuum", null, false],
  ["Take out trash", null, false],
  ["Clean bathroom", null, false],
  ["Set the table", null, false],
  ["Clear the table", null, false],
  ["Put away toys", null, false],
  ["Make bed", "🛏️", true],
  ["Brush teeth", "🪥", true],
  ["Shower", "🚿", true],
  ["Bath", "🛁", true],
  ["Homework", "📝", true],
  ["Skincare", "🧴", true],
  ["Wash face", "🧽", true],
  ["Do hair", "🪞", true],
];

interface Template {
  summary: string;
  emoji: string | null;
  routine: boolean;
}

/** Every refusal this file asserts carries a SQLSTATE and a named reason. */
interface StoreRefusal {
  code: string;
  message: string;
}

function expectRefusal(error: StoreRefusal | null, sqlstate: string, detail: string): void {
  expect(error?.code, detail).toBe(sqlstate);
  expect(error?.message, detail).toContain(detail);
}

function bySummary(a: Template, b: Template): number {
  return a.summary < b.summary ? -1 : 1;
}

describe("tasks schema: the data-model invariants", () => {
  const fx = fixtures();
  let pool: Pool;
  let admin: SupabaseClient;
  /** Household A holds every fixture row; B exists only to prove tenancy. */
  let householdA: string;
  let householdB: string;
  /** C and D each start with an empty Task Box, so the seed can be measured. */
  let householdC: string;
  let householdD: string;
  let profileA: string;
  let profileA2: string;
  let labelA: string;
  let profileB: string;

  const insertTask = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("tasks")
      .insert({ household_id: householdA, summary: `Probe ${fx.run}`, ...row })
      .select("id")
      .single();

  const insertAssignee = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("task_assignees")
      .insert({ household_id: householdA, ...row });

  const insertResolution = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("task_resolutions")
      .insert({
        household_id: householdA,
        status: "complete",
        resolved_on: "2026-09-16",
        ...row,
      })
      .select("id")
      .single();


  /**
   * T082 / migration 023: the SAME grammar the tasks carry, on the shipped
   * events column. The timed shape and `timezone` are what 010's own CHECKs
   * demand of any event row; nothing here is about the event itself.
   */
  const insertEvent = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("events")
      .insert({
        household_id: householdA,
        summary: `Probe ${fx.run}`,
        timezone: "UTC",
        all_day: false,
        starts_at: "2026-10-06T17:00:00Z",
        ends_at: "2026-10-06T17:45:00Z",
        start_date: null,
        end_date: null,
        ...row,
      })
      .select("id")
      .single();

  async function createTask(row: Record<string, unknown>): Promise<string> {
    const { data, error } = await insertTask(row);
    if (error) throw error;
    return (data as { id: string }).id;
  }

  async function createResolution(row: Record<string, unknown>): Promise<string> {
    const { data, error } = await insertResolution(row);
    if (error) throw error;
    return (data as { id: string }).id;
  }

  async function count(table: string, column: string, value: string): Promise<number> {
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from family.${table} where ${column} = $1`,
      [value],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async function templatesOf(householdId: string): Promise<Template[]> {
    const { rows } = await pool.query<Template>(
      "select summary, emoji, routine from family.task_box_items where household_id = $1",
      [householdId],
    );
    return rows.sort(bySummary);
  }

  async function seedTaskBox(householdId: string): Promise<number> {
    const { rows } = await pool.query<{ inserted: number }>(
      "select family.seed_task_box($1) as inserted",
      [householdId],
    );
    return rows[0]?.inserted ?? -1;
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();
    householdA = await insertHousehold(pool, `test-${fx.run}-tasks-schema`);
    householdB = await insertHousehold(pool, `test-${fx.run}-tasks-schema-b`);
    householdC = await insertHousehold(pool, `test-${fx.run}-tasks-schema-c`);
    householdD = await insertHousehold(pool, `test-${fx.run}-tasks-schema-d`);
    profileA = await insertCategory(pool, {
      householdId: householdA,
      label: `Schema kid ${fx.run}`,
      color: "#B6E085",
    });
    profileA2 = await insertCategory(pool, {
      householdId: householdA,
      label: `Schema sibling ${fx.run}`,
      color: "#FDC36D",
    });
    labelA = await insertCategory(pool, {
      householdId: householdA,
      label: `Bin day ${fx.run}`,
      color: "#2178AF",
      isProfile: false,
    });
    profileB = await insertCategory(pool, {
      householdId: householdB,
      label: `Schema stranger ${fx.run}`,
      color: "#CB434C",
    });
  });

  afterAll(async () => {
    await deleteHousehold(pool, householdA);
    await deleteHousehold(pool, householdB);
    await deleteHousehold(pool, householdC);
    await deleteHousehold(pool, householdD);
    await pool.end();
  });

  it("only a chore is up for grabs; only a routine tracks a habit (23514)", async () => {
    const grabbableRoutine = await insertTask({ ...ROUTINE, up_for_grabs: true });
    expectRefusal(grabbableRoutine.error, "23514", "task_up_for_grabs_is_a_chore");

    const habitualChore = await insertTask({ track_habit: true });
    expectRefusal(habitualChore.error, "23514", "task_habit_is_a_routine");

    expect((await insertTask({ ...ROUTINE, track_habit: true })).error).toBeNull();
    expect((await insertTask({ up_for_grabs: true })).error).toBeNull();
  });

  it("a routine carries a rule, no due time and no delay (task_routine_shape)", async () => {
    const unruly = await insertTask({ ...ROUTINE, rrule: null });
    expectRefusal(unruly.error, "23514", "task_routine_shape");

    const timed = await insertTask({ ...ROUTINE, due_time: "07:30:00" });
    expectRefusal(timed.error, "23514", "task_routine_shape");

    const delayed = await insertTask({
      ...ROUTINE,
      rrule: null,
      renew_after_amount: 3,
      renew_after_unit: "day",
    });
    expectRefusal(delayed.error, "23514", "task_routine_shape");

    expect((await insertTask(ROUTINE)).error).toBeNull();
  });

  it("a routine's slot set is one of seven; a chore's is empty (task_slots_shape)", async () => {
    const slotless = await insertTask({ ...ROUTINE, times_of_day: [] });
    expectRefusal(slotless.error, "23514", "task_slots_shape");

    const slottedChore = await insertTask({ times_of_day: ["morning"] });
    expectRefusal(slottedChore.error, "23514", "task_slots_shape");

    // Order and deduplication are structural, not conventional: a repeated slot
    // would double a column's denominator and collide on the occurrence key.
    const unordered = await insertTask({ ...ROUTINE, times_of_day: ["evening", "morning"] });
    expectRefusal(unordered.error, "23514", "task_slots_shape");

    const duplicated = await insertTask({ ...ROUTINE, times_of_day: ["morning", "morning"] });
    expectRefusal(duplicated.error, "23514", "task_slots_shape");

    for (const slots of LEGAL_SLOT_SETS) {
      const legal = await insertTask({ ...ROUTINE, times_of_day: slots });
      expect(legal.error, slots.join("+")).toBeNull();
    }

    // The domain itself closes the value set (family.time_of_day, 017).
    const unknownSlot = await insertTask({ ...ROUTINE, times_of_day: ["night"] });
    expectRefusal(unknownSlot.error, "23514", "time_of_day");
  });

  it("a due time needs a due date; an anytime chore cannot repeat (23514)", async () => {
    const floatingTime = await insertTask({ due_time: "18:00:00" });
    expectRefusal(floatingTime.error, "23514", "task_time_needs_a_date");

    const unanchoredRule = await insertTask({ rrule: "FREQ=DAILY;INTERVAL=1" });
    expectRefusal(unanchoredRule.error, "23514", "task_repeat_needs_an_anchor");

    const unanchoredChain = await insertTask({ renew_after_amount: 3, renew_after_unit: "day" });
    expectRefusal(unanchoredChain.error, "23514", "task_repeat_needs_an_anchor");

    // FR-328: neither date nor time — exactly one undated occurrence, for ever.
    expect((await insertTask({})).error).toBeNull();
  });

  it("the two repeat modes are exclusive and the cursor owns its fields (23514)", async () => {
    const both = await insertTask({
      ...REPEATING_CHORE,
      renew_after_amount: 3,
      renew_after_unit: "day",
    });
    expectRefusal(both.error, "23514", "task_repeat_modes_exclusive");

    const unitless = await insertTask({ starts_on: "2026-09-01", renew_after_amount: 3 });
    expectRefusal(unitless.error, "23514", "task_cursor_shape");

    const amountless = await insertTask({ starts_on: "2026-09-01", renew_after_unit: "day" });
    expectRefusal(amountless.error, "23514", "task_cursor_shape");

    const strayEnd = await insertTask({ starts_on: "2026-09-01", renew_until: "2026-12-31" });
    expectRefusal(strayEnd.error, "23514", "task_cursor_shape");

    // FR-343: amount 0 IS "Immediately", with no special case anywhere.
    const immediately = await insertTask({
      starts_on: "2026-09-01",
      renew_after_amount: 0,
      renew_after_unit: "day",
    });
    expect(immediately.error).toBeNull();
  });

  it("tasks_rrule_grammar: whitelisted FREQ, INTERVAL 1–99, never COUNT (FR-345)", async () => {
    const refused = [
      "FREQ=DAILY;INTERVAL=0",
      "FREQ=DAILY;INTERVAL=01",
      "FREQ=DAILY;INTERVAL=100",
      "FREQ=DAILY;INTERVAL=1;COUNT=5",
      "RRULE:FREQ=DAILY;INTERVAL=1",
      "FREQ=YEARLY;INTERVAL=1",
      "FREQ=DAILY",
    ];
    for (const rrule of refused) {
      const result = await insertTask({ starts_on: "2026-09-01", rrule });
      expectRefusal(result.error, "23514", "tasks_rrule_grammar");
    }

    const accepted = [
      "FREQ=DAILY;INTERVAL=1",
      "FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU",
      "FREQ=MONTHLY;INTERVAL=99;BYMONTHDAY=15",
      "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261215;WKST=SU;BYDAY=MO,TU",
    ];
    for (const rrule of accepted) {
      const result = await insertTask({ starts_on: "2026-09-01", rrule });
      expect(result.error, rrule).toBeNull();
    }
  });


  // ── migration 023: the events column carries the identical constraint ─────

  it("events_rrule_grammar (023): the same accept/reject table as the tasks (FR-345)", async () => {
    const refused = [
      "FREQ=DAILY;INTERVAL=0",
      "FREQ=DAILY;INTERVAL=01",
      "FREQ=DAILY;INTERVAL=100",
      "FREQ=DAILY;INTERVAL=1;COUNT=5",
      "RRULE:FREQ=DAILY;INTERVAL=1",
      "FREQ=YEARLY;INTERVAL=1",
      "FREQ=DAILY",
    ];
    for (const rrule of refused) {
      const result = await insertEvent({ rrule });
      expectRefusal(result.error, "23514", "events_rrule_grammar");
    }

    const accepted = [
      "FREQ=DAILY;INTERVAL=1",
      "FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU",
      "FREQ=MONTHLY;INTERVAL=99;BYMONTHDAY=15",
      "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261215;WKST=SU;BYDAY=MO,TU",
    ];
    for (const rrule of accepted) {
      const result = await insertEvent({ rrule });
      expect(result.error, rrule).toBeNull();
    }
  });

  it("events_rrule_grammar (023): the FR-233 reference rule is accepted and read back byte-identical", async () => {
    // The verified Skylight capture minus the RRULE: prefix and array wrapper.
    const reference = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU";
    const inserted = await insertEvent({ rrule: reference });
    expect(inserted.error).toBeNull();
    const { rows } = await pool.query<{ rrule: string }>(
      "select rrule from family.events where id = $1",
      [(inserted.data as { id: string }).id],
    );
    expect(rows[0]?.rrule).toBe(reference);
  });

  it("023 dropped 010's unnamed rule check by definition, and the two tables now agree", async () => {
    const { rows } = await pool.query<{ table: string; name: string; def: string }>(
      `select c.conrelid::regclass::text as "table", c.conname as name,
              pg_get_constraintdef(c.oid) as def
         from pg_constraint c
        where c.conrelid in ('family.events'::regclass, 'family.tasks'::regclass)
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) like '%FREQ=%'
        order by 1`,
    );
    // Exactly one GRAMMAR check per table (the tasks' shape constraints also
    // name the column, but only the grammar spells FREQ): the old unnamed one
    // is gone, not standing beside the new one.
    const events = rows.filter((row) => row.table === "family.events");
    const tasks = rows.filter((row) => row.table === "family.tasks");
    expect(events.map((row) => row.name)).toEqual(["events_rrule_grammar"]);
    expect(tasks.map((row) => row.name)).toEqual(["tasks_rrule_grammar"]);
    // "Identical text": the same definition, character for character.
    expect(events[0]?.def).toBe(tasks[0]?.def);
  });

  it("split_event_series is still correct at INTERVAL=2 under the new constraint", async () => {
    const rule = "FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=TU";
    const head = await insertEvent({ rrule: rule });
    expect(head.error).toBeNull();
    const headId = (head.data as { id: string }).id;

    // The cut is the third fortnightly occurrence (Oct 6 → Oct 20 → Nov 3):
    // the head keeps its rule truncated to the day before, the tail restarts
    // on the cut with the same INTERVAL=2 rule, re-anchored.
    const headRule = "FREQ=WEEKLY;INTERVAL=2;UNTIL=20261102T235959Z;WKST=SU;BYDAY=TU";
    const { rows: split } = await pool.query<{ tail: string }>(
      "select family.split_event_series($1, $2, null, $3, $4, $5::jsonb, '{}'::uuid[]) as tail",
      [
        householdA,
        headId,
        headRule,
        "2026-11-03",
        JSON.stringify({
          summary: `Probe tail ${fx.run}`,
          all_day: false,
          starts_at: "2026-11-03T17:00:00Z",
          ends_at: "2026-11-03T17:45:00Z",
          timezone: "UTC",
          rrule: rule,
        }),
      ],
    );
    const tailId = split[0]?.tail;
    expect(tailId).toBeTruthy();

    const { rows } = await pool.query<{ id: string; rrule: string; starts_at: string }>(
      "select id, rrule, starts_at::text from family.events where id = any($1::uuid[]) order by starts_at",
      [[headId, tailId]],
    );
    expect(rows.map((row) => row.rrule)).toEqual([headRule, rule]);
    expect(rows[1]?.starts_at.startsWith("2026-11-03")).toBe(true);
  });

  it("summary, description, emoji and the reserved star value are bounded (23514)", async () => {
    // These four are declared inline and unnamed in 017, so the SQLSTATE is the
    // whole assertion — the named constraints are checked by name above.
    expect((await insertTask({ summary: "   " })).error?.code).toBe("23514");
    expect((await insertTask({ summary: "x".repeat(121) })).error?.code).toBe("23514");
    expect((await insertTask({ description: "d".repeat(2001) })).error?.code).toBe("23514");
    expect((await insertTask({ emoji: "e".repeat(17) })).error?.code).toBe("23514");
    // FR-329: only the sign is asserted at the store; the 0–500 bound is Zod's
    // (004 Assumption 4, T014), so a value past it is still storable here.
    expect((await insertTask({ reward_points: -1 })).error?.code).toBe("23514");
    expect((await insertTask({ reward_points: 5000 })).error).toBeNull();
  });

  it("reward_points on a task and on a template: null, 0 and 500 accepted, -1 refused — the shipped CHECK, unchanged (T011)", async () => {
    // Phase 4 reads and writes the two reserved columns (017, 021) without
    // touching their shape: `>= 0` or null is the whole store-side rule, and
    // the 500 ceiling is validation's (004 FR-402, Assumption 4).
    const insertTemplate = (reward_points: number | null) =>
      admin
        .schema("family")
        .from("task_box_items")
        .insert({ household_id: householdA, summary: `Template probe ${fx.run}`, reward_points });

    for (const value of [null, 0, 500]) {
      expect((await insertTask({ reward_points: value })).error, `tasks ${value}`).toBeNull();
      expect((await insertTemplate(value)).error, `task_box_items ${value}`).toBeNull();
    }
    expect((await insertTask({ reward_points: -1 })).error?.code).toBe("23514");
    expect((await insertTemplate(-1)).error?.code).toBe("23514");
  });

  it("assert_task_assignee: a Label is never assignable, and neither is a foreign Profile", async () => {
    const taskId = await createTask(REPEATING_CHORE);

    // FR-323 — refused AT THE DATA STORE, one of only two places the spec
    // demands it, because a Label has no punch-in identity.
    const asLabel = await insertAssignee({ task_id: taskId, category_id: labelA });
    expectRefusal(asLabel.error, "23514", "a task may be assigned only to a Profile");

    const foreignProfile = await insertAssignee({ task_id: taskId, category_id: profileB });
    expectRefusal(foreignProfile.error, "23514", "a task may be assigned only to a Profile");

    expect((await insertAssignee({ task_id: taskId, category_id: profileA })).error).toBeNull();
  });

  it("assert_task_assignee: an up-for-grabs task cannot carry an assignee (FR-365)", async () => {
    const grabbableId = await createTask({ up_for_grabs: true });
    const assigned = await insertAssignee({ task_id: grabbableId, category_id: profileA });
    expectRefusal(assigned.error, "23514", "an up-for-grabs task cannot carry an assignee");
  });

  it("assert_up_for_grabs_is_unassigned: the flip waits for the assignees to go", async () => {
    const taskId = await createTask({ starts_on: "2026-09-01" });
    expect((await insertAssignee({ task_id: taskId, category_id: profileA })).error).toBeNull();

    const flip = await admin
      .schema("family")
      .from("tasks")
      .update({ up_for_grabs: true })
      .eq("id", taskId);
    expectRefusal(flip.error, "23514", "an up-for-grabs task cannot carry an assignee");

    // The edit clears the assignees first, in the same action — that ordering
    // is the contract (data-model 017).
    const cleared = await admin
      .schema("family")
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId);
    expect(cleared.error).toBeNull();
    const flipAgain = await admin
      .schema("family")
      .from("tasks")
      .update({ up_for_grabs: true })
      .eq("id", taskId);
    expect(flipAgain.error).toBeNull();
  });

  it("task_assignees_streak_shape: a count needs the date it is true through", async () => {
    const taskId = await createTask(ROUTINE);
    expect((await insertAssignee({ task_id: taskId, category_id: profileA })).error).toBeNull();

    const dateless = await admin
      .schema("family")
      .from("task_assignees")
      .update({ streak_count: 11 })
      .eq("task_id", taskId);
    expectRefusal(dateless.error, "23514", "task_assignees_streak_shape");

    const checkpointed = await admin
      .schema("family")
      .from("task_assignees")
      .update({ streak_count: 11, streak_through: "2026-09-15" })
      .eq("task_id", taskId);
    expect(checkpointed.error).toBeNull();

    const negative = await admin
      .schema("family")
      .from("task_assignees")
      .update({ streak_count: -1 })
      .eq("task_id", taskId);
    expect(negative.error?.code).toBe("23514");
  });

  it("assert_task_resolution: only a routine or a repeating chore is skippable (FR-359)", async () => {
    const oneOffId = await createTask({ starts_on: "2026-09-01", due_time: "18:00:00" });
    const skipped = await insertResolution({
      task_id: oneOffId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
      status: "skipped",
    });
    expectRefusal(skipped.error, "23514", "only a routine or a repeating chore can be skipped");

    const repeatingId = await createTask(REPEATING_CHORE);
    const skippedRepeat = await insertResolution({
      task_id: repeatingId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
      status: "skipped",
    });
    expect(skippedRepeat.error).toBeNull();

    const routineId = await createTask(ROUTINE);
    const skippedRoutine = await insertResolution({
      task_id: routineId,
      occurrence_date: "2026-09-01",
      occurrence_slot: "morning",
      assignee_id: profileA,
      category_id: profileA,
      status: "skipped",
    });
    expect(skippedRoutine.error).toBeNull();
  });

  it("assert_task_resolution: a completion always credits a Profile (FR-368, FR-363)", async () => {
    const repeatingId = await createTask(REPEATING_CHORE);
    const anonymous = await insertResolution({
      task_id: repeatingId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: null,
    });
    expectRefusal(anonymous.error, "23514", "a completion must credit a Profile");

    const anonymousSkip = await insertResolution({
      task_id: repeatingId,
      occurrence_date: "2026-09-08",
      assignee_id: profileA,
      category_id: null,
      status: "skipped",
    });
    expectRefusal(
      anonymousSkip.error,
      "23514",
      "only an up-for-grabs occurrence may be resolved for nobody",
    );

    // The one resolution that credits nobody: a skip of an UNCLAIMED
    // up-for-grabs occurrence, which belongs to the household.
    const grabbableId = await createTask({ ...REPEATING_CHORE, up_for_grabs: true });
    const householdSkip = await insertResolution({
      task_id: grabbableId,
      occurrence_date: "2026-09-01",
      assignee_id: null,
      category_id: null,
      status: "skipped",
    });
    expect(householdSkip.error).toBeNull();

    // A claim: the household chain, credited to whoever took it.
    const claim = await insertResolution({
      task_id: grabbableId,
      occurrence_date: "2026-09-15",
      assignee_id: null,
      category_id: profileA,
    });
    expect(claim.error).toBeNull();
  });

  it("assert_task_resolution: the chain owner is the assignee, or nobody (FR-324, FR-365)", async () => {
    const assignedId = await createTask(REPEATING_CHORE);
    const ownerless = await insertResolution({
      task_id: assignedId,
      occurrence_date: "2026-09-01",
      assignee_id: null,
      category_id: profileA,
    });
    expectRefusal(ownerless.error, "23514", "the chain owner is the assignee");

    const grabbableId = await createTask({ ...REPEATING_CHORE, up_for_grabs: true });
    const owned = await insertResolution({
      task_id: grabbableId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
    });
    expectRefusal(owned.error, "23514", "the chain owner is the assignee");
  });

  it("assert_task_resolution: only a Completed Date chore has cycles, inside one chain", async () => {
    const ruleTaskId = await createTask(REPEATING_CHORE);
    const head = await createResolution({
      task_id: ruleTaskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
    });
    const linkedRule = await insertResolution({
      task_id: ruleTaskId,
      occurrence_date: "2026-09-15",
      assignee_id: profileA,
      category_id: profileA,
      cycle_prev: head,
    });
    expectRefusal(
      linkedRule.error,
      "23514",
      "only a Completed Date chore links its resolutions into a cycle",
    );

    const cursorTaskId = await createTask(CURSOR_CHORE);
    const minesTail = await createResolution({
      task_id: cursorTaskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
    });
    const forked = await insertResolution({
      task_id: cursorTaskId,
      occurrence_date: "2026-09-15",
      assignee_id: profileA2,
      category_id: profileA2,
      cycle_prev: minesTail,
    });
    expectRefusal(forked.error, "23514", "a cycle link must stay inside one chain");

    // The composite FK pins the task, so a link can never leave it (23503).
    const otherCursorId = await createTask(CURSOR_CHORE);
    const crossTask = await insertResolution({
      task_id: otherCursorId,
      occurrence_date: "2026-09-15",
      assignee_id: profileA,
      category_id: profileA,
      cycle_prev: minesTail,
    });
    expect(crossTask.error?.code).toBe("23503");
  });

  it("the occurrence key holds one resolution per occurrence, nulls not distinct (23505)", async () => {
    const cursorTaskId = await createTask(CURSOR_CHORE);
    const first = await createResolution({
      task_id: cursorTaskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
    });

    const duplicate = await insertResolution({
      task_id: cursorTaskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
    });
    expectRefusal(duplicate.error, "23505", "task_resolutions_occurrence_key");

    // R308 job 2: "After → Immediately" puts two cycles on ONE date, differing
    // only in cycle_prev. Under a four-column key the mode's headline use is
    // the one thing it cannot do.
    const immediately = await insertResolution({
      task_id: cursorTaskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
      cycle_prev: first,
    });
    expect(immediately.error).toBeNull();

    // NULLS NOT DISTINCT is what makes the undated, unslotted household chain
    // collide instead of admitting duplicates (FR-328, FR-370).
    const grabbableId = await createTask({ up_for_grabs: true });
    const claim = await insertResolution({
      task_id: grabbableId,
      occurrence_date: null,
      assignee_id: null,
      category_id: profileA,
    });
    expect(claim.error).toBeNull();
    const secondClaim = await insertResolution({
      task_id: grabbableId,
      occurrence_date: null,
      assignee_id: null,
      category_id: profileA2,
    });
    expectRefusal(secondClaim.error, "23505", "task_resolutions_occurrence_key");
  });

  it("FR-344 is a foreign key: a link with a child cannot be deleted on its own", async () => {
    const cursorTaskId = await createTask(CURSOR_CHORE);
    const first = await createResolution({
      task_id: cursorTaskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
    });
    const second = await createResolution({
      task_id: cursorTaskId,
      occurrence_date: "2026-09-15",
      assignee_id: profileA,
      category_id: profileA,
      cycle_prev: first,
    });
    expect(second).not.toBe(first);

    const undo = await admin.schema("family").from("task_resolutions").delete().eq("id", first);
    expectRefusal(undo.error, "23503", "task_resolutions_cycle_fk");
    expect(await count("task_resolutions", "task_id", cursorTaskId)).toBe(2);

    // NO ACTION, not RESTRICT: the check is deferred to end of statement, so a
    // whole chain still goes in one delete (FR-391).
    const wholeChain = await admin
      .schema("family")
      .from("task_resolutions")
      .delete()
      .eq("task_id", cursorTaskId);
    expect(wholeChain.error).toBeNull();
    expect(await count("task_resolutions", "task_id", cursorTaskId)).toBe(0);
  });

  it("a cross-household task, assignee or resolution is unrepresentable (23503)", async () => {
    const taskId = await createTask(REPEATING_CHORE);

    // The composite FK (task_id, household_id) refuses a foreign task even
    // though the trigger's own two checks pass.
    const foreignTask = await admin
      .schema("family")
      .from("task_assignees")
      .insert({ household_id: householdB, task_id: taskId, category_id: profileB });
    expect(foreignTask.error?.code).toBe("23503");

    const foreignAssignee = await insertResolution({
      task_id: taskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileB,
      category_id: profileB,
    });
    expect(foreignAssignee.error?.code).toBe("23503");

    const foreignHousehold = await admin
      .schema("family")
      .from("task_resolutions")
      .insert({
        household_id: householdB,
        task_id: taskId,
        occurrence_date: "2026-09-01",
        assignee_id: profileB,
        category_id: profileB,
        status: "complete",
        resolved_on: "2026-09-01",
      });
    expectRefusal(foreignHousehold.error, "23503", "no such task in this household");
  });

  it("deleting a task takes its assignees and its resolutions with it", async () => {
    const taskId = await createTask(REPEATING_CHORE);
    expect((await insertAssignee({ task_id: taskId, category_id: profileA })).error).toBeNull();
    await createResolution({
      task_id: taskId,
      occurrence_date: "2026-09-01",
      assignee_id: profileA,
      category_id: profileA,
    });

    const remove = await admin.schema("family").from("tasks").delete().eq("id", taskId);
    expect(remove.error).toBeNull();
    expect(await count("tasks", "id", taskId)).toBe(0);
    expect(await count("task_assignees", "task_id", taskId)).toBe(0);
    expect(await count("task_resolutions", "task_id", taskId)).toBe(0);
  });

  it("deleting a Profile takes its own chains but only nulls a household claim", async () => {
    const doomed = await insertCategory(pool, {
      householdId: householdA,
      label: `Doomed kid ${fx.run}`,
      color: "#FDC36D",
    });
    const ownedId = await createTask(REPEATING_CHORE);
    expect((await insertAssignee({ task_id: ownedId, category_id: doomed })).error).toBeNull();
    await createResolution({
      task_id: ownedId,
      occurrence_date: "2026-09-01",
      assignee_id: doomed,
      category_id: doomed,
    });

    // The household's own chain, claimed once by the Profile being deleted.
    const grabbableId = await createTask({ up_for_grabs: true });
    const claimId = await createResolution({
      task_id: grabbableId,
      occurrence_date: null,
      assignee_id: null,
      category_id: doomed,
    });

    const remove = await admin.schema("family").from("categories").delete().eq("id", doomed);
    expect(remove.error).toBeNull();

    expect(await count("task_assignees", "category_id", doomed)).toBe(0);
    expect(await count("task_resolutions", "assignee_id", doomed)).toBe(0);
    // The task survives with no assignee — the orphan the action clears next,
    // deliberately not a deferred constraint (data-model 017).
    expect(await count("tasks", "id", ownedId)).toBe(1);

    // Cascading the CREDIT would delete a link out of the middle of the
    // household chain and resurrect a settled occurrence, so it is nulled —
    // and `assert_task_resolution` is INSERT-only, so this UPDATE is never
    // re-evaluated against FR-368 (invariants 10 and 12).
    const { rows } = await pool.query<{ category_id: string | null; status: string }>(
      "select category_id, status from family.task_resolutions where id = $1",
      [claimId],
    );
    expect(rows[0]?.category_id).toBeNull();
    expect(rows[0]?.status).toBe("complete");
  });

  it("seed_task_box lands the seventeen templates verbatim (FR-382, SC-318)", async () => {
    expect(await seedTaskBox(householdC)).toBe(17);

    const expected = SEEDED_TEMPLATES.map(([summary, emoji, routine]) => ({
      summary,
      emoji,
      routine,
    })).sort(bySummary);
    const stored = await templatesOf(householdC);
    expect(stored).toEqual(expected);
    expect(stored.filter((row) => !row.routine)).toHaveLength(9);
    expect(stored.filter((row) => row.routine)).toHaveLength(8);
    expect(stored.filter((row) => !row.routine).every((row) => row.emoji === null)).toBe(true);
    expect(stored.filter((row) => row.routine).every((row) => row.emoji !== null)).toBe(true);
  });

  it("seed_task_box is idempotent by emptiness, so a deletion stays deleted (FR-381)", async () => {
    expect(await seedTaskBox(householdD)).toBe(17);
    await pool.query(
      "delete from family.task_box_items where household_id = $1 and summary = 'Vacuum'",
      [householdD],
    );

    // By CONFLICT it would resurrect "Vacuum"; by emptiness it does nothing,
    // which is what makes FR-381's permanent deletion permanent.
    expect(await seedTaskBox(householdD)).toBe(0);
    const stored = await templatesOf(householdD);
    expect(stored).toHaveLength(16);
    expect(stored.some((row) => row.summary === "Vacuum")).toBe(false);
  });
});
