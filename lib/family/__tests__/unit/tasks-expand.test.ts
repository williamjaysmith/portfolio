import { describe, expect, it } from "vitest";
import {
  anytimeChoreOccurrences,
  carryForwardPass,
  cursorChoreOccurrences,
  expandTaskDay,
  routineOccurrences,
  scheduledChoreOccurrences,
  scheduledDaysInWeek,
  type ExpandOptions,
  type TaskContext,
} from "@/lib/family/tasks/expand";
import { resolutionIndexOf } from "@/lib/family/tasks/resolutions";
import type { BoardOccurrence, Task, TaskAssignee, TaskCursor, TaskResolution } from "@/lib/family/types";

const CHICAGO = "America/Chicago";
const ANA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const TASK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const TODAY = "2026-09-04"; // a Friday

function assignee(categoryId: string, createdAt = "2026-01-01T00:00:00.000Z"): TaskAssignee {
  return {
    taskId: TASK,
    householdId: "house",
    categoryId,
    sortOrder: 1000,
    streakCount: 0,
    streakThrough: null,
    createdAt,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: TASK,
    householdId: "house",
    summary: "Take out trash",
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
    rewardPoints: null,
    assignees: [assignee(ANA)],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function resolution(overrides: Partial<TaskResolution> = {}): TaskResolution {
  return {
    id: "res-1",
    householdId: "house",
    taskId: TASK,
    occurrenceDate: TODAY,
    occurrenceSlot: null,
    assigneeId: ANA,
    categoryId: ANA,
    cyclePrev: null,
    status: "complete",
    resolvedOn: TODAY,
    resolvedAt: `${TODAY}T12:00:00.000Z`,
    createdBy: ANA,
    createdAt: `${TODAY}T12:00:00.000Z`,
    ...overrides,
  };
}

function options(overrides: Partial<ExpandOptions> = {}): ExpandOptions {
  return { displayedDate: TODAY, todayDate: TODAY, zone: CHICAGO, ...overrides };
}

function context(
  resolutions: readonly TaskResolution[] = [],
  cursors: readonly TaskCursor[] = [],
  overrides: Partial<ExpandOptions> = {},
): TaskContext {
  return {
    index: resolutionIndexOf(resolutions),
    resolutions,
    cursors,
    options: options(overrides),
  };
}

/** The occurrence key plus the two fields every table below reads. */
function shapeOf(one: BoardOccurrence): Record<string, unknown> {
  return {
    assigneeId: one.assigneeId,
    scheduledDate: one.scheduledDate,
    slot: one.slot,
    displayedDate: one.displayedDate,
    isLate: one.isLate,
    state: one.state,
  };
}

/* ------------------------------------------------------------- T024 ----- */

describe("routineOccurrences (FR-335, FR-336)", () => {
  const daily = task({
    routine: true,
    summary: "Brush teeth",
    startsOn: "2026-09-01",
    rrule: "FREQ=DAILY;INTERVAL=1",
    timesOfDay: ["morning", "evening"],
  });

  it("emits one separately completable occurrence per slot per matching date", () => {
    const occurrences = routineOccurrences(daily, context());
    expect(occurrences.map((one) => one.slot)).toEqual(["morning", "evening"]);
    expect(occurrences.every((one) => one.scheduledDate === TODAY)).toBe(true);
    expect(occurrences.every((one) => one.routine)).toBe(true);
  });

  it("stamps each occurrence with the slot it was generated for, whatever the clock says", () => {
    // FR-336: a Morning occurrence is still Morning at 22:00 — nothing here
    // reads a clock at all, so it cannot migrate between sections.
    const evening = routineOccurrences(daily, context([], [], { displayedDate: TODAY }));
    expect(evening.map((one) => one.slot)).toEqual(["morning", "evening"]);
  });

  it("fans out across assignees — each with their own occurrences (FR-324)", () => {
    const shared = task({ ...daily, assignees: [assignee(ANA), assignee(BEN)] });
    const occurrences = routineOccurrences(shared, context());
    expect(occurrences.map((one) => [one.assigneeId, one.slot])).toEqual([
      [ANA, "morning"],
      [ANA, "evening"],
      [BEN, "morning"],
      [BEN, "evening"],
    ]);
  });

  it("honours the rule's interval and weekdays", () => {
    const everyTwoDays = task({
      ...daily,
      startsOn: "2026-09-02",
      rrule: "FREQ=DAILY;INTERVAL=2",
      timesOfDay: ["morning"],
    });
    expect(routineOccurrences(everyTwoDays, context())).toHaveLength(1);
    expect(
      routineOccurrences(everyTwoDays, context([], [], { displayedDate: "2026-09-03" })),
    ).toHaveLength(0);

    const weekdays = task({
      ...daily,
      startsOn: "2026-08-31",
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE",
      timesOfDay: ["afternoon"],
    });
    expect(routineOccurrences(weekdays, context())).toHaveLength(0); // Friday
    expect(
      routineOccurrences(weekdays, context([], [], { displayedDate: "2026-09-02" })),
    ).toHaveLength(1);
  });

  it("stops at the rule's own end date and never runs before its anchor", () => {
    const bounded = task({
      ...daily,
      rrule: "FREQ=DAILY;INTERVAL=1;UNTIL=20260903",
      timesOfDay: ["morning"],
    });
    expect(routineOccurrences(bounded, context())).toHaveLength(0);
    expect(
      routineOccurrences(bounded, context([], [], { displayedDate: "2026-08-31" })),
    ).toHaveLength(0);
  });

  it("reads each slot's own resolution", () => {
    const done = resolution({ occurrenceSlot: "morning" });
    const occurrences = routineOccurrences(daily, context([done]));
    expect(occurrences.map((one) => one.state)).toEqual(["complete", "unresolved"]);
    expect(occurrences[0].creditedCategoryId).toBe(ANA);
  });

  it("declines a chore", () => {
    expect(routineOccurrences(task(), context())).toEqual([]);
  });
});

describe("scheduledChoreOccurrences (FR-327, FR-340, FR-341)", () => {
  it("emits exactly its own date when the chore does not repeat", () => {
    const oneOff = task({ startsOn: TODAY });
    expect(scheduledChoreOccurrences(oneOff, context()).map(shapeOf)).toEqual([
      {
        assigneeId: ANA,
        scheduledDate: TODAY,
        slot: null,
        displayedDate: TODAY,
        isLate: false,
        state: "unresolved",
      },
    ]);
    expect(
      scheduledChoreOccurrences(oneOff, context([], [], { displayedDate: "2026-09-05" })),
    ).toEqual([]);
  });

  it("carries no clock instant on an all-day chore (FR-327)", () => {
    const [allDay] = scheduledChoreOccurrences(task(), context());
    expect(allDay.dueTime).toBeNull();
    expect(allDay.dueAt).toBeNull();
  });

  it("puts a Timed chore's due time at the household-zone instant (FR-326)", () => {
    const [timed] = scheduledChoreOccurrences(task({ dueTime: "18:00" }), context());
    expect(timed.dueTime).toBe("18:00");
    expect(timed.dueAt).toBe(new Date(Date.UTC(2026, 8, 4, 23)).toISOString());
  });

  it("walks the rule anchored on starts_on", () => {
    const weekly = task({ startsOn: "2026-08-14", rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
    expect(scheduledChoreOccurrences(weekly, context())).toHaveLength(1);
    expect(
      scheduledChoreOccurrences(weekly, context([], [], { displayedDate: "2026-09-03" })),
    ).toHaveLength(0);
    // Clamped at its anchor: no occurrence before the series starts.
    expect(
      scheduledChoreOccurrences(weekly, context([], [], { displayedDate: "2026-08-07" })),
    ).toHaveLength(0);
  });

  it("produces the fresh occurrence whatever happened to the earlier ones (FR-341)", () => {
    const weekly = task({ startsOn: "2026-08-14", rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
    const missed = context([]);
    expect(scheduledChoreOccurrences(weekly, missed)[0].state).toBe("unresolved");
    expect(scheduledChoreOccurrences(weekly, missed)[0].scheduledDate).toBe(TODAY);
  });

  it("fans out across assignees, one independently completable occurrence each", () => {
    const shared = task({ assignees: [assignee(ANA), assignee(BEN)] });
    const done = resolution({ assigneeId: ANA, categoryId: ANA });
    const occurrences = scheduledChoreOccurrences(shared, context([done]));
    expect(occurrences.map((one) => [one.assigneeId, one.state])).toEqual([
      [ANA, "complete"],
      [BEN, "unresolved"],
    ]);
  });

  it("emits ONE unassigned occurrence for an up-for-grabs chore (FR-365)", () => {
    const upForGrabs = task({ upForGrabs: true, assignees: [] });
    const occurrences = scheduledChoreOccurrences(upForGrabs, context());
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].assigneeId).toBeNull();
    expect(occurrences[0].upForGrabs).toBe(true);
  });

  it("declines routines, Anytime chores and Completed Date chores", () => {
    expect(scheduledChoreOccurrences(task({ routine: true }), context())).toEqual([]);
    expect(scheduledChoreOccurrences(task({ startsOn: null }), context())).toEqual([]);
    expect(
      scheduledChoreOccurrences(
        task({ renewAfterAmount: 14, renewAfterUnit: "day" }),
        context(),
      ),
    ).toEqual([]);
  });
});

describe("anytimeChoreOccurrences (FR-328)", () => {
  const anytime = task({ summary: "Sort the recycling", startsOn: null });

  it("emits exactly one undated occurrence, never late", () => {
    const occurrences = anytimeChoreOccurrences(anytime, context());
    expect(occurrences.map(shapeOf)).toEqual([
      {
        assigneeId: ANA,
        scheduledDate: null,
        slot: null,
        displayedDate: TODAY,
        isLate: false,
        state: "unresolved",
      },
    ]);
  });

  it("stays on every displayed day while it is unresolved, however long", () => {
    for (const displayedDate of ["2026-01-01", TODAY, "2027-12-31"]) {
      const [one] = anytimeChoreOccurrences(anytime, context([], [], { displayedDate }));
      expect(one.displayedDate).toBe(displayedDate);
      expect(one.isLate).toBe(false);
    }
  });

  it("stays on the day it was completed, and leaves every other day", () => {
    // Otherwise ticking it would drop it out of the day's total and walk the
    // column's ring backwards.
    const done = resolution({ occurrenceDate: null, resolvedOn: TODAY });
    const [today] = anytimeChoreOccurrences(anytime, context([done]));
    expect(today.state).toBe("complete");
    expect(
      anytimeChoreOccurrences(anytime, context([done], [], { displayedDate: "2026-09-05" })),
    ).toEqual([]);
  });

  it("fans out across assignees", () => {
    const shared = task({ ...anytime, assignees: [assignee(ANA), assignee(BEN)] });
    expect(anytimeChoreOccurrences(shared, context()).map((one) => one.assigneeId)).toEqual([
      ANA,
      BEN,
    ]);
  });

  it("declines a dated chore and a routine", () => {
    expect(anytimeChoreOccurrences(task(), context())).toEqual([]);
    expect(anytimeChoreOccurrences(task({ routine: true, startsOn: null }), context())).toEqual([]);
  });
});

describe("cursorChoreOccurrences (FR-343, R309)", () => {
  const cursorTask = task({
    summary: "Clean the bathroom",
    startsOn: "2026-08-21",
    renewAfterAmount: 14,
    renewAfterUnit: "day",
  });

  function tail(resolvedOn: string, assigneeId: string | null = ANA): TaskCursor {
    return {
      householdId: "house",
      taskId: TASK,
      assigneeId,
      tailId: "res-tail",
      tailResolvedOn: resolvedOn,
    };
  }

  it("emits exactly one open occurrence, on the date the tail schedules", () => {
    const occurrences = cursorChoreOccurrences(cursorTask, context([], [tail("2026-08-21")]));
    expect(occurrences).toHaveLength(1);
    expect(shapeOf(occurrences[0])).toEqual({
      assigneeId: ANA,
      scheduledDate: TODAY,
      slot: null,
      displayedDate: TODAY,
      isLate: false,
      state: "unresolved",
    });
    expect(occurrences[0].cyclePrev).toBe("res-tail");
  });

  it("emits none on any other day", () => {
    expect(
      cursorChoreOccurrences(
        cursorTask,
        context([], [tail("2026-08-21")], { displayedDate: "2026-09-05" }),
      ),
    ).toEqual([]);
  });

  it("seeds a chain with no tail, and starts a newly added assignee today", () => {
    const seeded = cursorChoreOccurrences(task({ ...cursorTask, startsOn: TODAY }), context());
    expect(seeded[0].scheduledDate).toBe(TODAY);
    expect(seeded[0].cyclePrev).toBeNull();

    const joinedToday = task({
      ...cursorTask,
      startsOn: "2026-03-01",
      assignees: [assignee(ANA, `${TODAY}T09:00:00.000Z`)],
    });
    expect(cursorChoreOccurrences(joinedToday, context())[0].scheduledDate).toBe(TODAY);
  });

  it("emits none at all past Repeats until (FR-346)", () => {
    const bounded = task({ ...cursorTask, renewUntil: "2026-09-03" });
    expect(cursorChoreOccurrences(bounded, context([], [tail("2026-08-21")]))).toEqual([]);
  });

  it("gives each assignee an independent cycle (FR-324)", () => {
    const shared = task({ ...cursorTask, assignees: [assignee(ANA), assignee(BEN)] });
    // Ben ticked on 2026-08-21, Ana has never done it; Ben's tick must not move
    // Ana's due date, which is still the chore's own seed.
    const cursors = [tail("2026-08-21", BEN)];
    expect(
      cursorChoreOccurrences(shared, context([], cursors)).map((one) => [
        one.assigneeId,
        one.scheduledDate,
      ]),
    ).toEqual([[BEN, TODAY]]);
    expect(
      cursorChoreOccurrences(
        shared,
        context([], cursors, { displayedDate: "2026-08-21", todayDate: "2026-08-21" }),
      ).map((one) => [one.assigneeId, one.scheduledDate]),
    ).toEqual([[ANA, "2026-08-21"]]);
  });

  it("renders a settled cycle on its own date (SC-308)", () => {
    const settled = resolution({ occurrenceDate: "2026-08-21", resolvedOn: "2026-08-21" });
    const occurrences = cursorChoreOccurrences(
      cursorTask,
      context([settled], [tail("2026-08-21")], { displayedDate: "2026-08-21" }),
    );
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].state).toBe("complete");
    expect(occurrences[0].scheduledDate).toBe("2026-08-21");
  });

  it("declines a rule-mode chore and a routine", () => {
    expect(cursorChoreOccurrences(task(), context())).toEqual([]);
    expect(cursorChoreOccurrences(task({ routine: true }), context())).toEqual([]);
  });
});

/* ------------------------------------------------------------- T025 ----- */

describe("carryForwardPass (FR-356, FR-357, FR-358)", () => {
  const lateOneOff = (scheduledOn: string): Task => task({ startsOn: scheduledOn });

  it("lands a carried occurrence on today carrying its OWN scheduled date", () => {
    const [carried] = carryForwardPass(lateOneOff("2026-09-01"), context());
    expect(shapeOf(carried)).toEqual({
      assigneeId: ANA,
      scheduledDate: "2026-09-01",
      slot: null,
      displayedDate: TODAY,
      isLate: true,
      state: "unresolved",
    });
  });

  it.each([
    ["2026-08-08", 27, true],
    ["2026-08-07", 28, false],
    ["2026-08-06", 29, false],
  ])("an occurrence scheduled %s (%i days back) is carried: %s", (scheduled, _days, carried) => {
    const occurrences = carryForwardPass(lateOneOff(scheduled as string), context());
    expect(occurrences).toHaveLength(carried ? 1 : 0);
  });

  it("never carries a routine (FR-338) or an Anytime chore (FR-328)", () => {
    const routine = task({
      routine: true,
      startsOn: "2026-08-01",
      rrule: "FREQ=DAILY;INTERVAL=1",
      timesOfDay: ["morning"],
    });
    expect(carryForwardPass(routine, context())).toEqual([]);
    expect(carryForwardPass(task({ startsOn: null }), context())).toEqual([]);
  });

  it("carries each missed occurrence of a repeating chore beside the fresh one (FR-341)", () => {
    const weekly = task({ startsOn: "2026-08-14", rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
    // 08-14, 08-21 and 08-28 all missed; 08-07 is outside the bound.
    expect(carryForwardPass(weekly, context()).map((one) => one.scheduledDate)).toEqual([
      "2026-08-14",
      "2026-08-21",
      "2026-08-28",
    ]);
  });

  it("stops carrying an occurrence resolved on an earlier day", () => {
    const weekly = task({ startsOn: "2026-08-14", rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
    const done = resolution({ occurrenceDate: "2026-08-21", resolvedOn: "2026-08-22" });
    expect(carryForwardPass(weekly, context([done])).map((one) => one.scheduledDate)).toEqual([
      "2026-08-14",
      "2026-08-28",
    ]);
  });

  it("keeps an occurrence ticked TODAY on today's board (SC-308)", () => {
    // Due Tuesday, ticked Friday: Friday's count includes it, so it must not
    // vanish from Friday the moment it is ticked.
    const tuesday = lateOneOff("2026-09-01");
    const ticked = resolution({ occurrenceDate: "2026-09-01", resolvedOn: TODAY });
    const [carried] = carryForwardPass(tuesday, context([ticked]));
    expect(carried.state).toBe("complete");
    expect(carried.scheduledDate).toBe("2026-09-01");
    expect(carried.isLate).toBe(true);
  });

  it("EXEMPTS the Completed Date open occurrence from the bound (FR-343 vs FR-357, R316)", () => {
    // Neglected 40 days: bounded literally it would be on no reachable screen,
    // nothing could resolve it, and no next cycle could ever be scheduled.
    const neglected = task({
      startsOn: "2026-07-26",
      renewAfterAmount: 14,
      renewAfterUnit: "day",
    });
    const [carried] = carryForwardPass(neglected, context());
    expect(carried.scheduledDate).toBe("2026-07-26");
    expect(carried.isLate).toBe(true);

    // A Scheduled Date chore at day 29 is not carried — the bound stands there.
    expect(carryForwardPass(lateOneOff("2026-08-06"), context())).toEqual([]);
  });

  it("carries an up-for-grabs occurrence ONCE for the household (FR-366)", () => {
    const upForGrabs = task({ upForGrabs: true, assignees: [], startsOn: "2026-09-01" });
    const occurrences = carryForwardPass(upForGrabs, context());
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].assigneeId).toBeNull();
  });
});

/* ------------------------------------------------------- 004 T017 ----- */

describe("rewardPoints rides every occurrence (004 FR-403, R406)", () => {
  // The chip reads the task's value AS IT IS NOW from the occurrence; what a
  // past completion actually earned is the ledger's business (FR-409). One
  // assertion per generator, so a generator that forgot the field fails by
  // name rather than through whichever card happened to render first.
  const WORTH = 15;

  it("routineOccurrences carries it onto every slot", () => {
    const routine = task({
      routine: true,
      startsOn: "2026-09-01",
      rrule: "FREQ=DAILY;INTERVAL=1",
      timesOfDay: ["morning", "evening"],
      rewardPoints: WORTH,
    });
    expect(routineOccurrences(routine, context()).map((one) => one.rewardPoints)).toEqual([
      WORTH,
      WORTH,
    ]);
  });

  it("scheduledChoreOccurrences carries it", () => {
    expect(scheduledChoreOccurrences(task({ rewardPoints: WORTH }), context())[0].rewardPoints).toBe(
      WORTH,
    );
  });

  it("anytimeChoreOccurrences carries it", () => {
    expect(
      anytimeChoreOccurrences(task({ startsOn: null, rewardPoints: WORTH }), context())[0]
        .rewardPoints,
    ).toBe(WORTH);
  });

  it("cursorChoreOccurrences carries it", () => {
    const cursor = task({ renewAfterAmount: 14, renewAfterUnit: "day", rewardPoints: WORTH });
    expect(cursorChoreOccurrences(cursor, context())[0].rewardPoints).toBe(WORTH);
  });

  it("carryForwardPass carries it, and a task worth nothing stays null", () => {
    expect(
      carryForwardPass(task({ startsOn: "2026-09-01", rewardPoints: WORTH }), context())[0]
        .rewardPoints,
    ).toBe(WORTH);
    expect(carryForwardPass(task({ startsOn: "2026-09-01" }), context())[0].rewardPoints).toBeNull();
  });
});

describe("expandTaskDay — the one entry point (R315)", () => {
  it("runs the carry pass only when the displayed day IS today", () => {
    const late = [task({ startsOn: "2026-09-01" })];
    expect(expandTaskDay(late, [], [], options())).toHaveLength(1);
    expect(
      expandTaskDay(late, [], [], options({ displayedDate: "2026-09-03" })),
    ).toHaveLength(0);
  });

  it("shows a carried occurrence on its own day and on today, and NOWHERE between", () => {
    const late = [task({ startsOn: "2026-09-01" })];
    const ownDay = expandTaskDay(late, [], [], options({ displayedDate: "2026-09-01" }));
    expect(ownDay.map(shapeOf)).toEqual([
      {
        assigneeId: ANA,
        scheduledDate: "2026-09-01",
        slot: null,
        displayedDate: "2026-09-01",
        isLate: false,
        state: "unresolved",
      },
    ]);
    for (const between of ["2026-09-02", "2026-09-03"]) {
      expect(expandTaskDay(late, [], [], options({ displayedDate: between }))).toEqual([]);
    }
    expect(expandTaskDay(late, [], [], options())).toHaveLength(1);
  });

  it("gives two assignees two independently completable occurrences (FR-324, SC-317)", () => {
    const shared = [task({ summary: "Set the table", assignees: [assignee(ANA), assignee(BEN)] })];
    const anaDone = resolution({ assigneeId: ANA, categoryId: ANA });
    const occurrences = expandTaskDay(shared, [anaDone], [], options());

    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((one) => [one.assigneeId, one.state])).toEqual([
      [ANA, "complete"],
      [BEN, "unresolved"],
    ]);
    // Neither is reachable from the other's key: one credit, one column each.
    expect(occurrences[0].creditedCategoryId).toBe(ANA);
    expect(occurrences[1].creditedCategoryId).toBeNull();
  });

  it("contributes TWO occurrences on the day an Immediately cycle is completed", () => {
    const immediate = task({
      summary: "Descale the kettle",
      startsOn: TODAY,
      renewAfterAmount: 0,
      renewAfterUnit: "day",
    });
    const done = resolution({ id: "cycle-1", occurrenceDate: TODAY, cyclePrev: null });
    const tail: TaskCursor = {
      householdId: "house",
      taskId: TASK,
      assigneeId: ANA,
      tailId: "cycle-1",
      tailResolvedOn: TODAY,
    };
    const occurrences = expandTaskDay([immediate], [done], [tail], options());

    // 0/1 → 1/2: the one just ticked and the one it scheduled, both genuine.
    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((one) => [one.cyclePrev, one.state])).toEqual([
      [null, "complete"],
      ["cycle-1", "unresolved"],
    ]);
  });

  it("holds the DST pair to exactly one occurrence each (FR-326, SC-313)", () => {
    const spring = task({ startsOn: "2027-03-14", dueTime: "02:30" });
    const springDay = expandTaskDay([spring], [], [], {
      displayedDate: "2027-03-14",
      todayDate: "2027-03-14",
      zone: CHICAGO,
    });
    expect(springDay).toHaveLength(1);
    // 02:30 does not exist; the first valid time that date is 03:00 CDT.
    expect(springDay[0].dueAt).toBe(new Date(Date.UTC(2027, 2, 14, 8)).toISOString());

    const fall = task({ startsOn: "2026-11-01", dueTime: "01:30" });
    const fallDay = expandTaskDay([fall], [], [], {
      displayedDate: "2026-11-01",
      todayDate: "2026-11-01",
      zone: CHICAGO,
    });
    expect(fallDay).toHaveLength(1);
    // 01:30 happens twice; the first instant is CDT.
    expect(fallDay[0].dueAt).toBe(new Date(Date.UTC(2026, 10, 1, 6, 30)).toISOString());
  });

  it("sweeps a year of an every-2-days chore with nothing missing or duplicated (SC-313)", () => {
    const everyTwoDays = [task({ startsOn: "2026-01-01", rrule: "FREQ=DAILY;INTERVAL=2" })];
    const seen: string[] = [];
    // A future "today" keeps the carry pass out of the sweep.
    const future = "2030-01-01";
    for (let day = 0; day < 365; day += 1) {
      const displayedDate = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      const occurrences = expandTaskDay(everyTwoDays, [], [], {
        displayedDate,
        todayDate: future,
        zone: CHICAGO,
      });
      expect(occurrences.length, displayedDate).toBe(day % 2 === 0 ? 1 : 0);
      for (const one of occurrences) seen.push(one.scheduledDate as string);
    }
    expect(seen).toHaveLength(183);
    expect(new Set(seen).size).toBe(183);
  });

  it("dispatches each task shape to exactly one generator", () => {
    const tasks = [
      task({ id: "chore", startsOn: TODAY }),
      task({ id: "anytime", startsOn: null }),
      task({
        id: "routine",
        routine: true,
        startsOn: "2026-09-01",
        rrule: "FREQ=DAILY;INTERVAL=1",
        timesOfDay: ["morning"],
      }),
      task({ id: "cursor", startsOn: TODAY, renewAfterAmount: 7, renewAfterUnit: "day" }),
    ];
    const occurrences = expandTaskDay(tasks, [], [], options());
    expect(occurrences.map((one) => one.taskId)).toEqual(["chore", "anytime", "routine", "cursor"]);
  });
});

/* ------------------------------------------------------------ 004 T049 -- */

describe("scheduledDaysInWeek (004 FR-440, R408)", () => {
  const WEEK_START = "2026-08-30"; // a Sunday
  const WEEK = [
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
  ];
  const daily = task({
    routine: true,
    summary: "Brush teeth",
    startsOn: "2026-08-01",
    rrule: "FREQ=DAILY;INTERVAL=1",
    timesOfDay: ["morning"],
  });

  it("lists every day of the week for a daily routine, oldest first", () => {
    expect(scheduledDaysInWeek(daily, WEEK_START, CHICAGO)).toEqual(WEEK);
  });

  it("lists only the rule's weekdays for a weekly routine", () => {
    const weekdays = task({ ...daily, rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR" });
    expect(scheduledDaysInWeek(weekdays, WEEK_START, CHICAGO)).toEqual([
      "2026-08-31",
      "2026-09-02",
      "2026-09-04",
    ]);
  });

  it("begins at startsOn when the routine starts mid-week", () => {
    const fromWednesday = task({ ...daily, startsOn: "2026-09-02" });
    expect(scheduledDaysInWeek(fromWednesday, WEEK_START, CHICAGO)).toEqual(WEEK.slice(3));
  });

  it("ends at UNTIL when the routine ends mid-week", () => {
    const untilTuesday = task({ ...daily, rrule: "FREQ=DAILY;INTERVAL=1;UNTIL=20260901" });
    expect(scheduledDaysInWeek(untilTuesday, WEEK_START, CHICAGO)).toEqual(WEEK.slice(0, 3));
  });

  it("is empty for a chore, whatever its rule — a routine's scheduled days only", () => {
    const chore = task({ ...daily, routine: false, timesOfDay: [] });
    expect(scheduledDaysInWeek(chore, WEEK_START, CHICAGO)).toEqual([]);
    expect(scheduledDaysInWeek(task({ startsOn: "2026-09-01" }), WEEK_START, CHICAGO)).toEqual([]);
  });

  it("counts a day once however many slots and assignees the routine has", () => {
    const busy = task({
      ...daily,
      timesOfDay: ["morning", "afternoon", "evening"],
      assignees: [assignee(ANA), assignee(BEN)],
    });
    expect(scheduledDaysInWeek(busy, WEEK_START, CHICAGO)).toEqual(WEEK);
  });

  it("is exactly the set of days the routine generator emits an occurrence on", () => {
    const weekdays = task({ ...daily, rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,SA" });
    const expected = WEEK.filter(
      (date) => routineOccurrences(weekdays, context([], [], { displayedDate: date })).length > 0,
    );
    expect(expected).toEqual(["2026-09-01", "2026-09-05"]);
    expect(scheduledDaysInWeek(weekdays, WEEK_START, CHICAGO)).toEqual(expected);
  });
});
