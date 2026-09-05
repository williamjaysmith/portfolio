/**
 * T027 / R314: the board's four cached reads plus the lazy fifth.
 *
 * Definitions are UNWINDOWED — any due-date window over `family.tasks` would be
 * wrong, not merely slow (an Anytime chore has no date, a Completed Date chore's
 * only occurrence is a cursor, a routine is a rule, and a chore due three weeks
 * ago belongs on today's board). Resolutions are windowed by the anchored week
 * plus every undated row; the carry tail is a disjoint window keyed by today;
 * and the cursor tail is its OWN query, never a PostgREST embed — `task_cursors`
 * is a view with no foreign key to embed through, so an embed would return
 * nothing at all and Completed Date would vanish from the board with no failure
 * to notice.
 *
 * Fixture rows are inserted by this file as `postgres`, never taken from the
 * seed, so the suite cannot drift with the seed fixtures.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import {
  familyKeys,
  fetchTaskBox,
  fetchTaskCarryForward,
  fetchTaskCursors,
  fetchTaskResolutions,
  fetchTasks,
} from "@/lib/family/queries";

import {
  createPool,
  deleteHousehold,
  fixtures,
  insertCategory,
  insertHousehold,
  userClient,
} from "./helpers";

// The anchored week 2026-10-04 (Sun) → 2026-10-10, with a displayed day inside
// it. The carry window that follows is [2026-09-09, 2026-10-03] — disjoint from
// the week by construction, which is what stops a row being fetched twice.
const WEEK_START = "2026-10-04";
const TODAY = "2026-10-07";
const START_WEEK_ON = 0;

const IN_WEEK = "2026-10-06";
const IN_CARRY = "2026-09-20";
const OUTSIDE_BOTH = "2026-07-01";
/** The Completed Date tail: older than every window the other three reads have. */
const CURSOR_TAIL_ON = "2026-03-02";

const ROUTINE_RRULE = "FREQ=WEEKLY;INTERVAL=2;WKST=SU;BYDAY=MO,WE";

interface TaskSeed {
  summary: string;
  routine?: boolean;
  startsOn?: string | null;
  dueTime?: string | null;
  timesOfDay?: string[];
  rrule?: string | null;
  renewAfterAmount?: number | null;
  renewAfterUnit?: string | null;
}

async function insertTask(pool: Pool, householdId: string, seed: TaskSeed): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.tasks (household_id, summary, routine, starts_on, due_time, " +
      "times_of_day, rrule, renew_after_amount, renew_after_unit) " +
      "values ($1, $2, $3, $4, $5, $6::family.time_of_day[], $7, $8, $9) returning id",
    [
      householdId,
      seed.summary,
      seed.routine ?? false,
      seed.startsOn ?? null,
      seed.dueTime ?? null,
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

interface AssigneeSeed {
  taskId: string;
  categoryId: string;
  sortOrder?: number;
  streakCount?: number;
  streakThrough?: string | null;
}

async function insertAssignee(pool: Pool, householdId: string, seed: AssigneeSeed): Promise<void> {
  await pool.query(
    "insert into family.task_assignees " +
      "(household_id, task_id, category_id, sort_order, streak_count, streak_through) " +
      "values ($1, $2, $3, $4, $5, $6)",
    [
      householdId,
      seed.taskId,
      seed.categoryId,
      seed.sortOrder ?? 1000,
      seed.streakCount ?? 0,
      seed.streakThrough ?? null,
    ],
  );
}

interface ResolutionSeed {
  taskId: string;
  assigneeId: string;
  occurrenceDate: string | null;
  occurrenceSlot?: string | null;
  resolvedOn: string;
}

async function insertResolution(
  pool: Pool,
  householdId: string,
  seed: ResolutionSeed,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.task_resolutions (household_id, task_id, occurrence_date, " +
      "occurrence_slot, assignee_id, category_id, status, resolved_on) " +
      "values ($1, $2, $3, $4::family.time_of_day, $5, $5, 'complete', $6) returning id",
    [
      householdId,
      seed.taskId,
      seed.occurrenceDate,
      seed.occurrenceSlot ?? null,
      seed.assigneeId,
      seed.resolvedOn,
    ],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.task_resolutions returned no row");
  return row.id;
}

describe("the tasks board reads: unwindowed definitions, windowed resolutions, its own cursor read", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let assigneeId: string;
  let otherHouseholdId: string;
  let otherTaskId: string;
  let routineTaskId: string;
  let anytimeTaskId: string;
  let cursorTaskId: string;
  let inWeekId: string;
  let inCarryId: string;
  let outsideBothId: string;
  let undatedId: string;
  let cursorTailId: string;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    stranger = await userClient(fx.users.stranger);

    assigneeId = await insertCategory(pool, {
      householdId: fx.householdId,
      label: `Cleo ${fx.run}`,
      color: "#B6E085",
    });

    // Anchored eight months before the window: only an unwindowed read reaches it.
    routineTaskId = await insertTask(pool, fx.householdId, {
      summary: `Brush teeth ${fx.run}`,
      routine: true,
      startsOn: "2026-02-02",
      timesOfDay: ["morning", "evening"],
      rrule: ROUTINE_RRULE,
    });
    await insertAssignee(pool, fx.householdId, {
      taskId: routineTaskId,
      categoryId: assigneeId,
      sortOrder: 1500,
      streakCount: 11,
      streakThrough: "2026-10-06",
    });

    // No date at all (FR-328) — unrepresentable in any date window.
    anytimeTaskId = await insertTask(pool, fx.householdId, {
      summary: `Sort the recycling ${fx.run}`,
    });
    await insertAssignee(pool, fx.householdId, { taskId: anytimeTaskId, categoryId: assigneeId });

    // Completed Date: its open occurrence is derived from a tail that is older
    // than every other read's window.
    cursorTaskId = await insertTask(pool, fx.householdId, {
      summary: `Clean the bathroom ${fx.run}`,
      startsOn: "2026-01-05",
      renewAfterAmount: 2,
      renewAfterUnit: "week",
    });
    await insertAssignee(pool, fx.householdId, { taskId: cursorTaskId, categoryId: assigneeId });

    inWeekId = await insertResolution(pool, fx.householdId, {
      taskId: routineTaskId,
      assigneeId,
      occurrenceDate: IN_WEEK,
      occurrenceSlot: "morning",
      resolvedOn: IN_WEEK,
    });
    inCarryId = await insertResolution(pool, fx.householdId, {
      taskId: routineTaskId,
      assigneeId,
      occurrenceDate: IN_CARRY,
      occurrenceSlot: "morning",
      resolvedOn: IN_CARRY,
    });
    outsideBothId = await insertResolution(pool, fx.householdId, {
      taskId: routineTaskId,
      assigneeId,
      occurrenceDate: OUTSIDE_BOTH,
      occurrenceSlot: "morning",
      resolvedOn: OUTSIDE_BOTH,
    });
    // An Anytime chore's single undated occurrence: it belongs to every day, so
    // the week read carries it whatever the window says.
    undatedId = await insertResolution(pool, fx.householdId, {
      taskId: anytimeTaskId,
      assigneeId,
      occurrenceDate: null,
      resolvedOn: IN_WEEK,
    });
    cursorTailId = await insertResolution(pool, fx.householdId, {
      taskId: cursorTaskId,
      assigneeId,
      occurrenceDate: CURSOR_TAIL_ON,
      resolvedOn: CURSOR_TAIL_ON,
    });

    // One template worth something and one worth nothing (004 FR-401, FR-402).
    await pool.query(
      "insert into family.task_box_items (household_id, summary, emoji, routine, reward_points) " +
        "values ($1, $2, $3, $4, 5), ($1, $5, null, false, null)",
      [fx.householdId, `Make bed ${fx.run}`, "🛏️", true, `Take out trash ${fx.run}`],
    );

    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-tasks-other`);
    otherTaskId = await insertTask(pool, otherHouseholdId, { summary: `Other household ${fx.run}` });
  });

  afterAll(async () => {
    await deleteHousehold(pool, otherHouseholdId);
    // Assignees and resolutions cascade with their task.
    await pool.query("delete from family.tasks where id = any($1::uuid[])", [
      [routineTaskId, anytimeTaskId, cursorTaskId],
    ]);
    await pool.query("delete from family.task_box_items where household_id = $1", [fx.householdId]);
    await pool.query("delete from family.categories where id = $1", [assigneeId]);
    await pool.end();
  });

  it("keys all five reads under the swept ['family'] prefix", () => {
    const keys = [
      familyKeys.tasks("hid"),
      familyKeys.taskWeek("hid", WEEK_START),
      familyKeys.taskCarry("hid", TODAY),
      familyKeys.taskCursors("hid"),
      familyKeys.taskBox("hid"),
    ];
    for (const key of keys) expect(key[0]).toBe(familyKeys.all[0]);
    // Five distinct keys: a bare prefix sweep hits all of them, and none of
    // them collides with another's cache entry.
    expect(new Set(keys.map((key) => key.join("/"))).size).toBe(5);
    // The carry key carries TODAY, which is what rolls it over at midnight.
    expect(familyKeys.taskCarry("hid", TODAY)).not.toEqual(familyKeys.taskCarry("hid", WEEK_START));
  });

  it("fetches every task row for the household, whatever its dates", async () => {
    const tasks = await fetchTasks(member, fx.householdId);
    const ids = tasks.map((task) => task.id);
    expect(ids).toContain(routineTaskId);
    expect(ids).toContain(anytimeTaskId);
    expect(ids).toContain(cursorTaskId);
    expect(ids).not.toContain(otherTaskId);
    expect(tasks.every((task) => task.householdId === fx.householdId)).toBe(true);
  });

  it("embeds each task's assignees with their streak pair", async () => {
    const tasks = await fetchTasks(member, fx.householdId);
    const routine = tasks.find((task) => task.id === routineTaskId);
    expect(routine?.assignees).toEqual([
      {
        taskId: routineTaskId,
        householdId: fx.householdId,
        categoryId: assigneeId,
        sortOrder: 1500,
        streakCount: 11,
        streakThrough: "2026-10-06",
        createdAt: expect.any(String),
      },
    ]);
    expect(routine?.rrule).toBe(ROUTINE_RRULE);
    expect(routine?.timesOfDay).toEqual(["morning", "evening"]);
  });

  it("windows resolutions by the anchored week and always carries the undated rows", async () => {
    const resolutions = await fetchTaskResolutions(member, fx.householdId, WEEK_START);
    const ids = resolutions.map((resolution) => resolution.id);
    expect(ids).toContain(inWeekId);
    expect(ids).toContain(undatedId);
    expect(ids).not.toContain(inCarryId);
    expect(ids).not.toContain(outsideBothId);
  });

  it("reads the carry tail as a window disjoint from the week", async () => {
    const carried = await fetchTaskCarryForward(member, fx.householdId, TODAY, START_WEEK_ON);
    const ids = carried.map((resolution) => resolution.id);
    expect(ids).toContain(inCarryId);
    // Disjoint: nothing the week read already holds is fetched a second time.
    expect(ids).not.toContain(inWeekId);
    expect(ids).not.toContain(undatedId);
    expect(ids).not.toContain(outsideBothId);
  });

  it("reads the Completed Date tail as its own query, not through the task rows", async () => {
    const cursors = await fetchTaskCursors(member, fx.householdId);
    expect(cursors).toEqual([
      {
        householdId: fx.householdId,
        taskId: cursorTaskId,
        assigneeId,
        tailId: cursorTailId,
        tailResolvedOn: CURSOR_TAIL_ON,
      },
    ]);

    // The same tail is reachable through NO other read: it predates the week
    // window and the carry window alike, which is exactly why read 4 exists.
    const week = await fetchTaskResolutions(member, fx.householdId, WEEK_START);
    const carried = await fetchTaskCarryForward(member, fx.householdId, TODAY, START_WEEK_ON);
    for (const rows of [week, carried]) {
      expect(rows.map((resolution) => resolution.id)).not.toContain(cursorTailId);
    }
  });

  it("reads the Task Box templates with their star value, the fourth field (004 FR-401)", async () => {
    // SC-319's "no star value on a template" inverted into SC-418: the value
    // rides the same read, NULL where the template is worth nothing.
    const templates = await fetchTaskBox(member, fx.householdId);
    expect(templates.map((template) => [template.summary, template.rewardPoints])).toEqual([
      [`Take out trash ${fx.run}`, null],
      [`Make bed ${fx.run}`, 5],
    ]);
  });

  it("answers an authenticated non-member with nothing on all five reads", async () => {
    expect(await fetchTasks(stranger, fx.householdId)).toEqual([]);
    expect(await fetchTaskResolutions(stranger, fx.householdId, WEEK_START)).toEqual([]);
    expect(await fetchTaskCarryForward(stranger, fx.householdId, TODAY, START_WEEK_ON)).toEqual([]);
    expect(await fetchTaskCursors(stranger, fx.householdId)).toEqual([]);
    expect(await fetchTaskBox(stranger, fx.householdId)).toEqual([]);
  });
});
