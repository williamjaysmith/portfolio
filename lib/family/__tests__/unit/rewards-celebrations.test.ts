/**
 * T020 — the three verdicts nothing else may decide (R408): when a completion
 * finishes a list (FR-439, SC-414), what kind of week a routine had (FR-440,
 * SC-415), and the redemption modal's two lines (FR-432, FR-433).
 *
 * Each is pure so that "once, on this device, never on a skip" is a table here
 * rather than a screen recording. The emoji rain's trigger is judged from the
 * counters AS THEY STOOD BEFORE THE WRITE, so it can never race the refetch
 * that repaints the board.
 */

import { describe, expect, it } from "vitest";

import {
  listCompletesWith,
  redemptionCelebration,
  weekCelebrationKey,
  weekVerdictOf,
} from "@/lib/family/rewards/celebrations";
import type { TaskCounters } from "@/lib/family/tasks/counters";
import type { BoardOccurrence, Redemption } from "@/lib/family/types";

const HOUSEHOLD = "00000000-0000-4000-8000-000000000000";
const BEN = "22222222-2222-4222-8222-222222222222";
const CLEO = "11111111-1111-4111-8111-111111111111";
const BRUSH = "brush-teeth";
const TODAY = "2026-09-04";

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    taskId: "feed-the-cat",
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
    rewardPoints: 10,
    ...overrides,
  };
}

function counters(complete: number, total: number): TaskCounters {
  return { complete, total };
}

describe("listCompletesWith", () => {
  it("is true when the tapped occurrence is the last one outstanding (US4-6)", () => {
    expect(listCompletesWith(counters(2, 3), occurrence())).toBe(true);
  });

  it("is false while a second occurrence is still outstanding", () => {
    expect(listCompletesWith(counters(1, 3), occurrence())).toBe(false);
  });

  it("is false when a filter hides the other outstanding card — the counters are unfiltered (SC-414)", () => {
    // The caller passes `columnCountersOf` over the UNFILTERED list (R317), so
    // a hidden outstanding card still counts: the list is not complete.
    expect(listCompletesWith(counters(1, 3), occurrence())).toBe(false);
  });

  it("is false for an occurrence that is already complete — an undo is not a completion", () => {
    expect(listCompletesWith(counters(2, 3), occurrence({ state: "complete" }))).toBe(false);
  });

  it("is false for a skipped occurrence — a skip finishes nothing (US4-7)", () => {
    expect(listCompletesWith(counters(2, 3), occurrence({ state: "skipped" }))).toBe(false);
  });

  it("is false for an Up for Grabs occurrence, which is in nobody's column (FR-368)", () => {
    const unclaimed = occurrence({ assigneeId: null, upForGrabs: true });
    expect(listCompletesWith(counters(0, 1), unclaimed)).toBe(false);
  });

  it("is false for an empty column and for a column with nothing outstanding", () => {
    expect(listCompletesWith(counters(0, 0), occurrence())).toBe(false);
    expect(listCompletesWith(counters(3, 3), occurrence())).toBe(false);
  });

  it("counts this device's in-flight completions: two quick taps fire once, on the second (T048)", () => {
    // Both taps see the same pre-write counters (1 of 3); the second tap knows
    // the first is still writing.
    const first = occurrence({ taskId: BRUSH, slot: "morning" });
    const second = occurrence({ taskId: BRUSH, slot: "evening" });
    expect(listCompletesWith(counters(1, 3), first, 0)).toBe(false);
    expect(listCompletesWith(counters(1, 3), second, 1)).toBe(true);
  });

  it("fires again after an undo and a re-completion — the trigger is the list becoming complete", () => {
    const last = occurrence();
    expect(listCompletesWith(counters(2, 3), last)).toBe(true);
    // The undo: the board now reads 2 of 3 again with this one outstanding.
    expect(listCompletesWith(counters(2, 3), occurrence({ state: "complete" }))).toBe(false);
    expect(listCompletesWith(counters(2, 3), last)).toBe(true);
  });
});

describe("weekVerdictOf", () => {
  const DAILY = [
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
  ];

  it("is Amazing when every scheduled day is completed (SC-415)", () => {
    expect(weekVerdictOf({ scheduledDays: DAILY, completedDays: DAILY, skippedDays: [] })).toBe(
      "amazing",
    );
  });

  it("is Strong when exactly one day is missed of a daily routine (SC-415)", () => {
    expect(
      weekVerdictOf({ scheduledDays: DAILY, completedDays: DAILY.slice(1), skippedDays: [] }),
    ).toBe("strong");
  });

  it("is nothing when two days are missed (SC-415)", () => {
    expect(
      weekVerdictOf({ scheduledDays: DAILY, completedDays: DAILY.slice(2), skippedDays: [] }),
    ).toBeNull();
  });

  it("is Amazing with one day skipped and the rest completed — a skip is neither (SC-415, FR-440)", () => {
    expect(
      weekVerdictOf({
        scheduledDays: DAILY,
        completedDays: DAILY.slice(1),
        skippedDays: [DAILY[0]],
      }),
    ).toBe("amazing");
  });

  it("is Strong with one day skipped and one missed — the skip is not a second miss", () => {
    expect(
      weekVerdictOf({
        scheduledDays: DAILY,
        completedDays: DAILY.slice(2),
        skippedDays: [DAILY[0]],
      }),
    ).toBe("strong");
  });

  it("is nothing when every scheduled day was skipped — at least one must be completed", () => {
    expect(weekVerdictOf({ scheduledDays: DAILY, completedDays: [], skippedDays: DAILY })).toBeNull();
  });

  it("never gives Strong to a routine scheduled twice a week (FR-440)", () => {
    const twice = ["2026-08-31", "2026-09-03"];
    expect(
      weekVerdictOf({ scheduledDays: twice, completedDays: [twice[0]], skippedDays: [] }),
    ).toBeNull();
    expect(weekVerdictOf({ scheduledDays: twice, completedDays: twice, skippedDays: [] })).toBe(
      "amazing",
    );
  });

  it("gives Strong at exactly three scheduled days with one missed", () => {
    const thrice = ["2026-08-31", "2026-09-02", "2026-09-04"];
    expect(
      weekVerdictOf({ scheduledDays: thrice, completedDays: thrice.slice(1), skippedDays: [] }),
    ).toBe("strong");
  });

  it("is nothing for a week the routine was not scheduled at all", () => {
    expect(weekVerdictOf({ scheduledDays: [], completedDays: [], skippedDays: [] })).toBeNull();
  });

  it("reads only scheduled days: a completion on an unscheduled day neither helps nor hurts", () => {
    const twice = ["2026-08-31", "2026-09-03"];
    expect(
      weekVerdictOf({
        scheduledDays: twice,
        completedDays: [...twice, "2026-09-01"],
        skippedDays: [],
      }),
    ).toBe("amazing");
  });

  it("treats a day both completed and skipped as neither, as the streak rule does (FR-373)", () => {
    // A two-slot routine with one slot done and one skipped protects a streak
    // rather than advancing it; a week reads that day the same way.
    expect(
      weekVerdictOf({
        scheduledDays: DAILY,
        completedDays: DAILY,
        skippedDays: [DAILY[3]],
      }),
    ).toBe("amazing");
    expect(
      weekVerdictOf({
        scheduledDays: DAILY,
        completedDays: DAILY.slice(1),
        skippedDays: [DAILY[3]],
      }),
    ).toBe("strong");
  });
});

describe("weekCelebrationKey", () => {
  it("is one key per routine, Profile and week", () => {
    const key = weekCelebrationKey(BRUSH, CLEO, "2026-08-30");
    expect(key).toBe(`${BRUSH}:${CLEO}:2026-08-30`);
    expect(weekCelebrationKey(BRUSH, BEN, "2026-08-30")).not.toBe(key);
    expect(weekCelebrationKey(BRUSH, CLEO, "2026-09-06")).not.toBe(key);
    expect(weekCelebrationKey("practice-piano", CLEO, "2026-08-30")).not.toBe(key);
  });
});

describe("redemptionCelebration", () => {
  function redemption(overrides: Partial<Redemption> = {}): Redemption {
    return {
      id: "redemption-1",
      householdId: HOUSEHOLD,
      rewardId: "reward-cookies",
      categoryId: CLEO,
      pointValue: 20,
      rewardName: "Bake cookies",
      redeemedOn: "2026-09-05",
      redeemedAt: "2026-09-05T20:00:00.000+00:00",
      redeemedBy: CLEO,
      reversedAt: null,
      reversedBy: null,
      ...overrides,
    };
  }

  it("writes the modal's two lines from the returned row (US3-2, FR-432)", () => {
    expect(redemptionCelebration(redemption(), "Cleo")).toEqual({
      title: "Great work! Bake cookies redeemed",
      subtitle: "By Cleo for 20 stars on September 5, 2026",
    });
  });

  it("names the Profile redeemed FOR, not the actor: a parent's redemption says By Cleo (US3-4)", () => {
    const byAna = redemption({ redeemedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    expect(redemptionCelebration(byAna, "Cleo").subtitle).toBe(
      "By Cleo for 20 stars on September 5, 2026",
    );
  });

  it("shows the household's day of the redemption, not the instant's UTC date (FR-433)", () => {
    // 03:30 UTC on the 6th is the evening of the 5th in Chicago; the trigger
    // stored the household day, and that is the day shown.
    const late = redemption({
      redeemedOn: "2026-09-05",
      redeemedAt: "2026-09-06T03:30:00.000+00:00",
    });
    expect(redemptionCelebration(late, "Cleo").subtitle).toMatch(/on September 5, 2026$/);
  });

  it("does not let a plain date slide across midnight into the year before", () => {
    const newYear = redemption({ redeemedOn: "2026-01-01" });
    expect(redemptionCelebration(newYear, "Cleo").subtitle).toMatch(/on January 1, 2026$/);
  });

  it("uses the cost as it was stored and reads a single star in the singular", () => {
    const one = redemption({ pointValue: 1, rewardName: "Sticker" });
    expect(redemptionCelebration(one, "Ben")).toEqual({
      title: "Great work! Sticker redeemed",
      subtitle: "By Ben for 1 star on September 5, 2026",
    });
  });
});
