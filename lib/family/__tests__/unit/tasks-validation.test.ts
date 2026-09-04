import { describe, expect, it } from "vitest";

import { ActionFailure } from "@/lib/family/errors";
import type { TaskRepeatChoice } from "@/lib/family/types";
import { parseOrThrow, taskInputSchema, taskRepeatChoiceSchema } from "@/lib/family/validation";

/**
 * T026 — the task write boundary (`contracts/server-actions.md` → "Zod rules").
 *
 * The whole rules table, asserted in both directions, because these schemas are
 * the FIRST line: the 016/017/018 CHECKs behind them refuse the same shapes and
 * their messages are never echoed to a parent (FR-330). Two properties beyond
 * the table are asserted here rather than trusted — no client may send a rule
 * string in any shape (R201, kept for tasks), and no count-of-occurrences limit
 * is accepted in either repeat mode (FR-346).
 */

const PROFILE_A = "00000000-0000-4000-8000-00000000000a";
const PROFILE_B = "00000000-0000-4000-8000-00000000000b";

type Draft = Record<string, unknown>;

function chore(overrides: Draft = {}): Draft {
  return {
    summary: "Take out trash",
    routine: false,
    assigneeIds: [PROFILE_A],
    startsOn: "2026-09-14",
    repeat: { kind: "never" },
    ...overrides,
  };
}

function routine(overrides: Draft = {}): Draft {
  return {
    summary: "Brush teeth",
    routine: true,
    assigneeIds: [PROFILE_A],
    startsOn: "2026-09-14",
    timesOfDay: ["morning", "evening"],
    repeat: { kind: "daily", interval: 1 },
    ...overrides,
  };
}

/** The refusal a parent actually sees: an `ActionFailure`, not a ZodError. */
function refusalOf(input: unknown): ActionFailure {
  try {
    parseOrThrow(taskInputSchema, input);
  } catch (error) {
    if (error instanceof ActionFailure) return error;
    throw error;
  }
  throw new Error("expected a VALIDATION refusal, got a parse");
}

function refusedFields(input: unknown): string[] {
  return Object.keys(refusalOf(input).fieldErrors ?? {});
}

function accepts(input: unknown): boolean {
  return taskInputSchema.safeParse(input).success;
}

describe("summary (FR-319)", () => {
  it("requires a title and names the field", () => {
    const failure = refusalOf(chore({ summary: "   " }));
    expect(failure.code).toBe("VALIDATION");
    expect(failure.fieldErrors?.summary).toBeDefined();
  });

  it("refuses a missing title", () => {
    expect(refusedFields(chore({ summary: undefined }))).toContain("summary");
  });

  it("trims and bounds the title at 120", () => {
    const parsed = parseOrThrow(taskInputSchema, chore({ summary: "  Trash  " }));
    expect(parsed.summary).toBe("Trash");
    expect(accepts(chore({ summary: "x".repeat(120) }))).toBe(true);
    expect(refusedFields(chore({ summary: "x".repeat(121) }))).toContain("summary");
  });
});

describe("description and emoji (FR-320, FR-321)", () => {
  it("bounds the description at 2000 and folds blank to null", () => {
    expect(accepts(chore({ description: "n".repeat(2000) }))).toBe(true);
    expect(refusedFields(chore({ description: "n".repeat(2001) }))).toContain("description");
    expect(parseOrThrow(taskInputSchema, chore({ description: "  " })).description).toBeNull();
  });

  it("accepts one grapheme cluster, including a ZWJ sequence", () => {
    expect(accepts(chore({ emoji: "🐱" }))).toBe(true);
    expect(accepts(chore({ emoji: "👨‍👩‍👧‍👦" }))).toBe(true);
  });

  it("refuses two clusters and anything over 16 characters", () => {
    expect(refusedFields(chore({ emoji: "🐱🐶" }))).toContain("emoji");
    expect(refusedFields(chore({ emoji: "ab" }))).toContain("emoji");
    expect(refusedFields(chore({ emoji: "x".repeat(17) }))).toContain("emoji");
  });
});

describe("assignment (FR-322, FR-323, FR-365)", () => {
  it("requires at least one assignee unless the chore is up for grabs", () => {
    expect(refusedFields(chore({ assigneeIds: [] }))).toContain("assigneeIds");
    expect(accepts(chore({ assigneeIds: [], upForGrabs: true }))).toBe(true);
  });

  it("refuses duplicates and non-ids", () => {
    expect(refusedFields(chore({ assigneeIds: [PROFILE_A, PROFILE_A] }))).toContain("assigneeIds");
    expect(refusedFields(chore({ assigneeIds: ["Cleo"] }))).toContain("assigneeIds");
    expect(accepts(chore({ assigneeIds: [PROFILE_A, PROFILE_B] }))).toBe(true);
  });

  it("refuses an up-for-grabs task that is assigned, or that is a routine (FR-338)", () => {
    expect(refusedFields(chore({ upForGrabs: true }))).toContain("upForGrabs");
    expect(refusedFields(routine({ upForGrabs: true, assigneeIds: [] }))).toContain("upForGrabs");
  });
});

describe("track habit (FR-337)", () => {
  it("is a routine's switch only", () => {
    expect(accepts(routine({ trackHabit: true }))).toBe(true);
    expect(refusedFields(chore({ trackHabit: true }))).toContain("trackHabit");
  });
});

describe("a routine's shape (FR-333, FR-334, FR-335, Assumption 26)", () => {
  it("requires at least one time of day, deduplicated and in canonical order", () => {
    expect(accepts(routine({ timesOfDay: ["morning", "afternoon", "evening"] }))).toBe(true);
    expect(refusedFields(routine({ timesOfDay: [] }))).toContain("timesOfDay");
    expect(refusedFields(routine({ timesOfDay: ["evening", "morning"] }))).toContain("timesOfDay");
    expect(refusedFields(routine({ timesOfDay: ["morning", "morning"] }))).toContain("timesOfDay");
    expect(refusedFields(routine({ timesOfDay: ["night"] }))).toContain("timesOfDay");
  });

  it("carries no due time and always has a start date", () => {
    expect(refusedFields(routine({ dueTime: "07:30" }))).toContain("dueTime");
    expect(refusedFields(routine({ startsOn: null }))).toContain("startsOn");
  });

  it("repeats daily or weekly and never in the other two modes", () => {
    expect(accepts(routine({ repeat: { kind: "weekly", interval: 1, weekdays: ["MO", "WE"] } }))).toBe(true);
    expect(refusedFields(routine({ repeat: { kind: "never" } }))).toContain("repeat");
    expect(refusedFields(routine({ repeat: { kind: "monthly", interval: 1 } }))).toContain("repeat");
    expect(
      refusedFields(routine({ repeat: { kind: "after_completion", amount: 2, unit: "week" } })),
    ).toContain("repeat");
  });
});

describe("a chore's four sub-types (FR-325, FR-326, FR-327, FR-328)", () => {
  it("carries no time of day", () => {
    expect(refusedFields(chore({ timesOfDay: ["morning"] }))).toContain("timesOfDay");
    expect(accepts(chore({ timesOfDay: [] }))).toBe(true);
  });

  it("is Timed only with a date under the time", () => {
    expect(accepts(chore({ dueTime: "18:00" }))).toBe(true);
    expect(refusedFields(chore({ startsOn: null, dueTime: "18:00" }))).toContain("dueTime");
  });

  it("takes an HH:MM household wall clock and never an instant", () => {
    expect(refusedFields(chore({ dueTime: "18:00:00" }))).toContain("dueTime");
    expect(refusedFields(chore({ dueTime: "2026-09-14T18:00:00Z" }))).toContain("dueTime");
    expect(refusedFields(chore({ dueTime: "24:00" }))).toContain("dueTime");
    expect(refusedFields(chore({ dueTime: "7:30" }))).toContain("dueTime");
  });

  it("is Anytime with neither, and Anytime cannot repeat", () => {
    expect(accepts(chore({ startsOn: null }))).toBe(true);
    expect(refusedFields(chore({ startsOn: null, repeat: { kind: "daily", interval: 1 } }))).toContain(
      "repeat",
    );
  });
});

describe("the repeat interval (FR-345, Assumption 14)", () => {
  it.each([1, 2, 99])("accepts a whole interval of %i", (interval) => {
    expect(accepts(chore({ repeat: { kind: "daily", interval } }))).toBe(true);
  });

  it.each([0, 100, 1.5, -1, "2"])("refuses %p", (interval) => {
    expect(refusedFields(chore({ repeat: { kind: "daily", interval } }))).toContain("repeat");
  });

  it("requires an interval on every rule-mode choice", () => {
    expect(refusedFields(chore({ repeat: { kind: "daily" } }))).toContain("repeat");
    expect(refusedFields(chore({ repeat: { kind: "weekly", weekdays: ["MO"] } }))).toContain("repeat");
    expect(refusedFields(chore({ repeat: { kind: "monthly" } }))).toContain("repeat");
  });
});

describe("weekly and monthly (FR-340)", () => {
  it("requires non-empty, unique weekdays", () => {
    expect(refusedFields(chore({ repeat: { kind: "weekly", interval: 1, weekdays: [] } }))).toContain(
      "repeat",
    );
    expect(
      refusedFields(chore({ repeat: { kind: "weekly", interval: 1, weekdays: ["MO", "MO"] } })),
    ).toContain("repeat");
  });

  it("never accepts a day of the month — it is derived from startsOn", () => {
    expect(
      accepts(chore({ repeat: { kind: "monthly", interval: 1, byMonthDay: 14 } })),
    ).toBe(false);
    expect(accepts(chore({ repeat: { kind: "monthly", interval: 1 } }))).toBe(true);
  });
});

describe("Completed Date (FR-342, FR-343)", () => {
  const after = (overrides: Draft = {}) => ({ kind: "after_completion", unit: "week", amount: 2, ...overrides });

  it("accepts 0 as Immediately and bounds the delay at 99", () => {
    expect(accepts(chore({ repeat: after({ amount: 0, unit: "day" }) }))).toBe(true);
    expect(accepts(chore({ repeat: after({ amount: 99 }) }))).toBe(true);
    expect(refusedFields(chore({ repeat: after({ amount: 100 }) }))).toContain("repeat");
    expect(refusedFields(chore({ repeat: after({ amount: -1 }) }))).toContain("repeat");
  });

  it("requires a unit and a seed date", () => {
    expect(refusedFields(chore({ repeat: { kind: "after_completion", amount: 2 } }))).toContain("repeat");
    expect(refusedFields(chore({ repeat: after({ unit: "fortnight" }) }))).toContain("repeat");
    expect(refusedFields(chore({ startsOn: null, repeat: after() }))).toContain("repeat");
  });
});

describe("Repeats until (FR-346)", () => {
  it("refuses an end before the start, compared as household-local dates", () => {
    expect(
      refusedFields(chore({ startsOn: "2026-09-14", repeat: { kind: "daily", interval: 1, until: "2026-09-13" } })),
    ).toContain("repeat");
  });

  it("accepts an end on the start date, and an open-ended repeat", () => {
    expect(
      accepts(chore({ startsOn: "2026-09-14", repeat: { kind: "daily", interval: 1, until: "2026-09-14" } })),
    ).toBe(true);
    expect(accepts(chore({ repeat: { kind: "daily", interval: 1, until: null } }))).toBe(true);
  });

  it("accepts an end date on a routine too", () => {
    expect(accepts(routine({ repeat: { kind: "daily", interval: 1, until: "2026-12-18" } }))).toBe(true);
  });

  it("accepts no count-of-occurrences limit in either mode", () => {
    expect(accepts(chore({ repeat: { kind: "daily", interval: 1, count: 5 } }))).toBe(false);
    expect(accepts(chore({ repeat: { kind: "after_completion", amount: 2, unit: "week", count: 5 } }))).toBe(
      false,
    );
  });
});

describe("no client may send a rule string in any shape (R201)", () => {
  it.each([
    ["at the top level", chore({ rrule: "FREQ=DAILY;INTERVAL=1" })],
    ["inside the repeat", chore({ repeat: { kind: "daily", interval: 1, rrule: "FREQ=DAILY;INTERVAL=1" } })],
    ["as the repeat", chore({ repeat: "FREQ=DAILY;INTERVAL=1" })],
    ["as renew columns", chore({ renewAfterAmount: 2, renewAfterUnit: "week" })],
  ])("refuses one %s", (_where, input) => {
    expect(accepts(input)).toBe(false);
  });

  it("never accepts a reserved star value (FR-329, SC-319)", () => {
    expect(accepts(chore({ rewardPoints: 5 }))).toBe(false);
  });
});

describe("the repeat choice schema alone", () => {
  it("parses to the shared TaskRepeatChoice union", () => {
    const parsed: TaskRepeatChoice = taskRepeatChoiceSchema.parse({
      kind: "weekly",
      interval: 3,
      weekdays: ["MO", "TH"],
      until: null,
    });
    expect(parsed).toEqual({ kind: "weekly", interval: 3, weekdays: ["MO", "TH"], until: null });
  });

  it("refuses an unknown kind", () => {
    expect(taskRepeatChoiceSchema.safeParse({ kind: "yearly", interval: 1 }).success).toBe(false);
  });
});

describe("Save to task box is a create-time flag (FR-379)", () => {
  it("is optional and boolean", () => {
    expect(accepts(chore({ saveToTaskBox: true }))).toBe(true);
    expect(accepts(chore({ saveToTaskBox: "yes" }))).toBe(false);
  });
});
