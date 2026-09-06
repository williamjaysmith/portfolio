/**
 * T029 — FR-305's denominator, written directly from SC-310's checklist.
 *
 * SC-310 names the day the numbers must be checkable by hand on: "an anytime
 * chore, a late chore, a skipped occurrence, a routine in two slots, and an
 * up-for-grabs occurrence claimed by that Profile — the claim leaving the Up
 * for Grabs count and joining that column's total and completed count as it is
 * made — and none of the numbers move when any filter is toggled."
 *
 * That last clause is asserted here as a table over every filter R319 ships,
 * with the counter-proof that the FILTERED list would move the numbers — so
 * the guarantee is pinned where it actually lives (the argument the caller
 * passes) instead of being asserted as a tautology.
 */

import { describe, expect, it } from "vitest";

import {
  columnCountersOf,
  routineProgressOf,
  upForGrabsCountOf,
} from "@/lib/family/tasks/counters";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import type {
  BoardOccurrence,
  Task,
  TaskAssignee,
  TaskResolution,
  TimeOfDay,
} from "@/lib/family/types";

const CHICAGO = "America/Chicago";
const TODAY = "2026-09-04"; // a Friday
const EARLIER = "2026-09-01";

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const BRUSH = "brush-teeth";

let uniqueTaskId = 0;

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  uniqueTaskId += 1;
  return {
    rewardPoints: null,
    taskId: `task-${uniqueTaskId}`,
    assigneeId: CLEO,
    scheduledDate: TODAY,
    slot: null,
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: "Feed the cat",
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
    trackHabit: false,
    dueTime: null,
    dueAt: null,
    isRepeating: false,
    taskCreatedAt: "2026-01-01T00:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
    ...overrides,
  };
}

/** SC-310's checklist day: Cleo's five, her skip, and the Up for Grabs pair. */
function checklistDay(): BoardOccurrence[] {
  return [
    occurrence({ summary: "Sort the recycling", scheduledDate: null }),
    occurrence({ summary: "Take out trash", scheduledDate: EARLIER, isLate: true }),
    occurrence({ summary: "Water plants", state: "skipped", isRepeating: true }),
    occurrence({ taskId: BRUSH, summary: "Brush teeth", routine: true, slot: "morning", state: "complete" }),
    occurrence({ taskId: BRUSH, summary: "Brush teeth", routine: true, slot: "evening" }),
    occurrence({
      summary: "Empty dishwasher",
      assigneeId: null,
      upForGrabs: true,
      state: "complete",
      creditedCategoryId: CLEO,
    }),
    occurrence({ summary: "Fold laundry", assigneeId: null, upForGrabs: true }),
  ];
}

describe("columnCountersOf — SC-310's checklist day", () => {
  it("counts routines per slot, the anytime chore, the late chore and the claim", () => {
    // 2 routine slots + 1 anytime + 1 late + 1 claimed = 5, and the skip leaves
    // the TOTAL and not only the completed count (FR-360).
    expect(columnCountersOf(checklistDay(), CLEO)).toEqual({ complete: 2, total: 5 });
  });

  it("leaves the claimed occurrence out of the Up for Grabs count", () => {
    expect(upForGrabsCountOf(checklistDay())).toBe(1);
  });

  it("moves the claim out of Up for Grabs and into the column as it is made", () => {
    const before = checklistDay().map((one) =>
      one.summary === "Empty dishwasher"
        ? { ...one, state: "unresolved" as const, creditedCategoryId: null }
        : one,
    );
    expect(upForGrabsCountOf(before)).toBe(2);
    expect(columnCountersOf(before, CLEO)).toEqual({ complete: 1, total: 4 });

    expect(upForGrabsCountOf(checklistDay())).toBe(1);
    expect(columnCountersOf(checklistDay(), CLEO)).toEqual({ complete: 2, total: 5 });
  });

  it("gives another Profile nothing out of this column", () => {
    expect(columnCountersOf(checklistDay(), BEN)).toEqual({ complete: 0, total: 0 });
  });

  it("reads zero of zero for an empty column (FR-316)", () => {
    expect(columnCountersOf([], CLEO)).toEqual({ complete: 0, total: 0 });
  });
});

describe("columnCountersOf — the skip rule (FR-360, US1-13, US4-5)", () => {
  function benDay(complete: number, outstanding: number, skipped: number): BoardOccurrence[] {
    return [
      ...Array.from({ length: complete }, () => occurrence({ assigneeId: BEN, state: "complete" })),
      ...Array.from({ length: outstanding }, () => occurrence({ assigneeId: BEN })),
      ...Array.from({ length: skipped }, () => occurrence({ assigneeId: BEN, state: "skipped" })),
    ];
  }

  it("reads three of ten before the skip (US1-13)", () => {
    expect(columnCountersOf(benDay(3, 7, 0), BEN)).toEqual({ complete: 3, total: 10 });
  });

  it("reads three of nine once one of the seven outstanding is skipped (US4-5)", () => {
    expect(columnCountersOf(benDay(3, 6, 1), BEN)).toEqual({ complete: 3, total: 9 });
  });

  it("returns the occurrence to the total when it is unskipped (FR-361)", () => {
    expect(columnCountersOf(benDay(3, 7, 0), BEN).total).toBe(
      columnCountersOf(benDay(3, 6, 1), BEN).total + 1,
    );
  });
});

describe("upForGrabsCountOf — unclaimed and unresolved only (FR-308)", () => {
  it("ignores assigned occurrences", () => {
    expect(upForGrabsCountOf([occurrence(), occurrence({ assigneeId: BEN })])).toBe(0);
  });

  it("ignores a skipped up-for-grabs occurrence, which credits nobody (FR-368)", () => {
    const day = [
      occurrence({ assigneeId: null, upForGrabs: true }),
      occurrence({ assigneeId: null, upForGrabs: true, state: "skipped", isRepeating: true }),
    ];
    expect(upForGrabsCountOf(day)).toBe(1);
  });

  it("counts nothing on an empty board", () => {
    expect(upForGrabsCountOf([])).toBe(0);
  });
});

describe("routineProgressOf — one routine on the displayed day (FR-312)", () => {
  function slots(states: readonly BoardOccurrence["state"][]): BoardOccurrence[] {
    const names: TimeOfDay[] = ["morning", "afternoon", "evening"];
    return states.map((state, index) =>
      occurrence({ taskId: BRUSH, routine: true, slot: names[index], state, trackHabit: true }),
    );
  }

  it("counts that routine's own slots, complete of total", () => {
    expect(routineProgressOf(slots(["complete", "unresolved"]), BRUSH, CLEO)).toEqual({
      complete: 1,
      total: 2,
    });
  });

  it("drops a skipped slot from its total too (FR-360)", () => {
    expect(routineProgressOf(slots(["complete", "skipped", "unresolved"]), BRUSH, CLEO)).toEqual({
      complete: 1,
      total: 2,
    });
  });

  it("ignores another routine and another Profile", () => {
    const day = [
      ...slots(["complete", "unresolved"]),
      occurrence({ taskId: "make-bed", routine: true, slot: "morning", state: "complete" }),
      occurrence({ taskId: BRUSH, routine: true, slot: "morning", assigneeId: BEN }),
    ];
    expect(routineProgressOf(day, BRUSH, CLEO)).toEqual({ complete: 1, total: 2 });
    expect(routineProgressOf(day, BRUSH, BEN)).toEqual({ complete: 0, total: 1 });
  });

  it("reads zero of zero for a routine that is not on the day", () => {
    expect(routineProgressOf(checklistDay(), "not-here", CLEO)).toEqual({ complete: 0, total: 0 });
  });
});

describe("no number moves under any filter (FR-384, FR-386, SC-310)", () => {
  const FILTERS: readonly [string, (one: BoardOccurrence) => boolean][] = [
    ["Completed tasks off", (one) => one.state !== "complete"],
    ["Late chores off", (one) => !one.isLate],
    ["Skipped tasks off", (one) => one.state !== "skipped"],
    ["Up for Grabs off", (one) => one.assigneeId !== null],
    ["Cleo hidden", (one) => one.assigneeId !== CLEO],
    ["search: trash", (one) => one.summary.toLowerCase().includes("trash")],
  ];

  it.each(FILTERS)("%s leaves every number where it was", (_name, keep) => {
    const day = checklistDay();
    // The filter must actually remove something, or the assertion below is empty.
    expect(day.filter(keep).length).toBeLessThan(day.length);

    expect(columnCountersOf(day, CLEO)).toEqual({ complete: 2, total: 5 });
    expect(upForGrabsCountOf(day)).toBe(1);
    expect(routineProgressOf(day, BRUSH, CLEO)).toEqual({ complete: 1, total: 2 });
  });

  it("would move if the filtered list were passed instead — which is the point", () => {
    const day = checklistDay();
    const withoutCompleted = day.filter((one) => one.state !== "complete");
    expect(columnCountersOf(withoutCompleted, CLEO)).not.toEqual(columnCountersOf(day, CLEO));
  });
});

/* ------------------------------------------------ through the expander -- */

function assignee(taskId: string): TaskAssignee {
  return {
    taskId,
    householdId: "house",
    categoryId: CLEO,
    sortOrder: 1000,
    streakCount: 0,
    streakThrough: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    rewardPoints: null,
    id,
    householdId: "house",
    summary: id,
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
    trackHabit: false,
    startsOn: TODAY,
    dueTime: null,
    timesOfDay: [],
    rrule: null,
    renewAfterAmount: null,
    renewAfterUnit: null,
    renewUntil: null,
    assignees: [assignee(id)],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function resolution(taskId: string, overrides: Partial<TaskResolution> = {}): TaskResolution {
  return {
    id: `res-${taskId}`,
    householdId: "house",
    taskId,
    occurrenceDate: TODAY,
    occurrenceSlot: null,
    assigneeId: CLEO,
    categoryId: CLEO,
    cyclePrev: null,
    status: "complete",
    resolvedOn: TODAY,
    resolvedAt: `${TODAY}T12:00:00.000Z`,
    createdBy: CLEO,
    createdAt: `${TODAY}T12:00:00.000Z`,
    ...overrides,
  };
}

describe("SC-310's checklist day through the shipped expander", () => {
  const tasks: Task[] = [
    task(BRUSH, { routine: true, timesOfDay: ["morning", "evening"] }),
    task("sort-recycling", { startsOn: null }),
    task("take-out-trash", { startsOn: EARLIER, dueTime: "18:00" }),
    task("water-plants", { rrule: "FREQ=DAILY;INTERVAL=1" }),
    task("empty-dishwasher", { upForGrabs: true, assignees: [] }),
    task("fold-laundry", { upForGrabs: true, assignees: [] }),
  ];
  const resolutions: TaskResolution[] = [
    resolution(BRUSH, { occurrenceSlot: "morning" }),
    resolution("water-plants", { status: "skipped" }),
    resolution("empty-dishwasher", { assigneeId: null }),
  ];
  const day = expandTaskDay(tasks, resolutions, [], {
    displayedDate: TODAY,
    todayDate: TODAY,
    zone: CHICAGO,
  });

  it("produces exactly the seven occurrences the checklist names", () => {
    expect(day).toHaveLength(7);
  });

  it("counts two of five in Cleo's column", () => {
    expect(columnCountersOf(day, CLEO)).toEqual({ complete: 2, total: 5 });
  });

  it("leaves one occurrence up for grabs", () => {
    expect(upForGrabsCountOf(day)).toBe(1);
  });

  it("reads one of two on the routine in two slots", () => {
    expect(routineProgressOf(day, BRUSH, CLEO)).toEqual({ complete: 1, total: 2 });
  });
});
