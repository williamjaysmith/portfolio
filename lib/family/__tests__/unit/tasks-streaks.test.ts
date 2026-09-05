import { describe, it, expect } from "vitest";
import { addDays } from "@/lib/family/calendar/dates";
import { nextStreak, type DayOutcome, type StreakCheckpoint } from "@/lib/family/tasks/streaks";
import type { OccurrenceState } from "@/lib/family/types";

const NEVER: StreakCheckpoint = { count: 0, through: null };
const DAY_ONE = "2026-03-01";

/** The day AFTER the one being restated, so `date` has ended (FR-373). */
function tomorrow(date: string): string {
  return addDays(date, 1);
}

/**
 * One day of one routine for one person. `before` defaults to the day as it
 * stood with the write's own occurrence still outstanding, which is what a
 * completion or a skip restates.
 */
function outcome(
  date: string,
  states: OccurrenceState[],
  extra: { before?: OccurrenceState[]; todayDate?: string } = {},
): DayOutcome {
  return {
    date,
    todayDate: extra.todayDate ?? date,
    states,
    statesBefore: extra.before ?? states.map(() => "unresolved"),
  };
}

/** Replays a run of days the way an action heals a gap it finds behind `through`. */
function replay(from: StreakCheckpoint, days: readonly DayOutcome[]): StreakCheckpoint {
  return days.reduce(nextStreak, from);
}

/** `n` consecutive days from DAY_ONE, every occurrence completed. */
function completedRun(count: number, states: OccurrenceState[] = ["complete"]): DayOutcome[] {
  return Array.from({ length: count }, (_unused, index) => {
    const date = addDays(DAY_ONE, index);
    return outcome(date, states, { todayDate: tomorrow(date) });
  });
}

describe("nextStreak — one day at a time (FR-373)", () => {
  it("advances by one for a day whose every occurrence was completed", () => {
    expect(nextStreak(NEVER, outcome(DAY_ONE, ["complete"]))).toEqual({
      count: 1,
      through: DAY_ONE,
    });
    expect(nextStreak({ count: 7, through: "2026-02-28" }, outcome(DAY_ONE, ["complete"]))).toEqual({
      count: 8,
      through: DAY_ONE,
    });
  });

  it("advances only when EVERY slot of the day is complete", () => {
    expect(
      nextStreak({ count: 3, through: "2026-02-28" }, outcome(DAY_ONE, ["complete", "complete"])),
    ).toEqual({ count: 4, through: DAY_ONE });
  });

  it("holds across a day every occurrence of which was skipped", () => {
    expect(nextStreak({ count: 11, through: "2026-02-28" }, outcome(DAY_ONE, ["skipped"]))).toEqual({
      count: 11,
      through: DAY_ONE,
    });
  });

  it("holds across a day that mixes a completion with a skip", () => {
    expect(
      nextStreak({ count: 11, through: "2026-02-28" }, outcome(DAY_ONE, ["complete", "skipped"])),
    ).toEqual({ count: 11, through: DAY_ONE });
  });

  it("neither advances nor breaks on a day the routine does not run", () => {
    expect(nextStreak({ count: 4, through: "2026-02-28" }, outcome(DAY_ONE, []))).toEqual({
      count: 4,
      through: DAY_ONE,
    });
  });

  it("resets to zero once a day has ENDED with an occurrence unresolved", () => {
    const ended = outcome(DAY_ONE, ["complete", "unresolved"], { todayDate: tomorrow(DAY_ONE) });
    expect(nextStreak({ count: 30, through: "2026-02-28" }, ended)).toEqual({
      count: 0,
      through: DAY_ONE,
    });
  });

  it("leaves the checkpoint alone while the day is still running", () => {
    const midday = outcome(DAY_ONE, ["complete", "unresolved"], { todayDate: DAY_ONE });
    expect(nextStreak({ count: 30, through: "2026-02-28" }, midday)).toEqual({
      count: 30,
      through: "2026-02-28",
    });
  });

  it("counts the second slot of a two-slot routine, not the first", () => {
    const previous: StreakCheckpoint = { count: 5, through: "2026-02-28" };
    const morning = nextStreak(previous, outcome(DAY_ONE, ["complete", "unresolved"]));
    expect(morning).toEqual(previous);
    expect(
      nextStreak(morning, outcome(DAY_ONE, ["complete", "complete"], {
        before: ["complete", "unresolved"],
      })),
    ).toEqual({ count: 6, through: DAY_ONE });
  });

  it("ignores a day the checkpoint has already moved past", () => {
    const previous: StreakCheckpoint = { count: 9, through: "2026-03-10" };
    expect(nextStreak(previous, outcome(DAY_ONE, ["complete"]))).toEqual(previous);
    expect(
      nextStreak(previous, outcome(DAY_ONE, ["unresolved"], { todayDate: "2026-03-10" })),
    ).toEqual(previous);
  });
});

describe("nextStreak — restating the day the checkpoint stands on (FR-374)", () => {
  it("steps back by exactly one when the most recent completion is un-ticked", () => {
    const previous: StreakCheckpoint = { count: 30, through: DAY_ONE };
    const untick = outcome(DAY_ONE, ["unresolved"], { before: ["complete"] });
    expect(nextStreak(previous, untick)).toEqual({ count: 29, through: "2026-02-28" });
  });

  it("holds the count when a skip is reversed — an unskip never costs a day", () => {
    const previous: StreakCheckpoint = { count: 11, through: DAY_ONE };
    const unskip = outcome(DAY_ONE, ["unresolved"], { before: ["skipped"] });
    expect(nextStreak(previous, unskip)).toEqual({ count: 11, through: "2026-02-28" });
  });

  it("re-completing the day it was un-ticked on returns the same count", () => {
    const previous: StreakCheckpoint = { count: 30, through: DAY_ONE };
    const untick = nextStreak(previous, outcome(DAY_ONE, ["unresolved"], { before: ["complete"] }));
    expect(nextStreak(untick, outcome(DAY_ONE, ["complete"]))).toEqual(previous);
  });

  it("does not advance twice when the same day is resolved again", () => {
    const previous: StreakCheckpoint = { count: 4, through: DAY_ONE };
    const again = outcome(DAY_ONE, ["complete"], { before: ["complete"] });
    expect(nextStreak(previous, again)).toEqual(previous);
  });

  it("un-ticking the only day ever counted leaves zero, never a negative", () => {
    const untick = outcome(DAY_ONE, ["unresolved"], { before: ["complete"] });
    expect(nextStreak({ count: 1, through: DAY_ONE }, untick)).toEqual({
      count: 0,
      through: "2026-02-28",
    });
    expect(nextStreak({ count: 0, through: DAY_ONE }, untick)).toEqual({
      count: 0,
      through: "2026-02-28",
    });
  });

  it("un-ticking a day that has ended leaves it broken rather than restored", () => {
    const previous: StreakCheckpoint = { count: 30, through: DAY_ONE };
    const untick = outcome(DAY_ONE, ["unresolved"], {
      before: ["complete"],
      todayDate: tomorrow(DAY_ONE),
    });
    expect(nextStreak(previous, untick)).toEqual({ count: 0, through: DAY_ONE });
  });
});

describe("SC-312 — thirty days with one skipped day and one unresolved day", () => {
  it("reads thirty across thirty completed days", () => {
    expect(replay(NEVER, completedRun(30))).toEqual({
      count: 30,
      through: addDays(DAY_ONE, 29),
    });
  });

  it("holds its value across the skipped day and resets after the unresolved one", () => {
    const skipDate = addDays(DAY_ONE, 14);
    const openDate = addDays(DAY_ONE, 15);

    const beforeSkip = replay(NEVER, completedRun(14));
    expect(beforeSkip).toEqual({ count: 14, through: addDays(DAY_ONE, 13) });

    const acrossSkip = nextStreak(
      beforeSkip,
      outcome(skipDate, ["skipped"], { todayDate: tomorrow(skipDate) }),
    );
    expect(acrossSkip).toEqual({ count: 14, through: skipDate });

    const afterOpen = nextStreak(
      acrossSkip,
      outcome(openDate, ["unresolved"], { todayDate: tomorrow(openDate) }),
    );
    expect(afterOpen).toEqual({ count: 0, through: openDate });

    // The run starts again from the day after the break, not from fifteen.
    expect(
      nextStreak(afterOpen, outcome(addDays(DAY_ONE, 16), ["complete"])),
    ).toEqual({ count: 1, through: addDays(DAY_ONE, 16) });
  });

  it("un-ticking the most recent of the thirty moves it back by exactly one", () => {
    const thirty = replay(NEVER, completedRun(30));
    const lastDate = addDays(DAY_ONE, 29);
    const untick = outcome(lastDate, ["unresolved"], {
      before: ["complete"],
      todayDate: lastDate,
    });
    expect(nextStreak(thirty, untick).count).toBe(29);
  });
});

describe("the stored shape the CHECK constraint requires", () => {
  it("never returns a positive count without a date it accounts for", () => {
    const runs: StreakCheckpoint[] = [
      nextStreak(NEVER, outcome(DAY_ONE, ["complete"])),
      nextStreak(NEVER, outcome(DAY_ONE, ["skipped"])),
      nextStreak(NEVER, outcome(DAY_ONE, ["unresolved"], { todayDate: tomorrow(DAY_ONE) })),
      nextStreak(NEVER, outcome(DAY_ONE, ["unresolved"])),
      replay(NEVER, completedRun(30)),
    ];
    for (const run of runs) {
      expect(run.count).toBeGreaterThanOrEqual(0);
      if (run.count > 0) expect(run.through).not.toBeNull();
    }
  });
});
