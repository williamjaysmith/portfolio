import { describe, expect, it } from "vitest";

import { visibleTaskOccurrences } from "@/lib/family/tasks/visibility";
import type { BoardOccurrence, TaskFilters } from "@/lib/family/types";

/**
 * T066 — FR-383's truth table: five switches (Completed tasks, Late chores,
 * Skipped tasks, Up for Grabs, and the per-Profile hidden set) over the three
 * occurrence states, with the search string (FR-386) as a sixth predicate.
 *
 * The rule lives in lib rather than in the sheet for the reason the calendar's
 * did (R319): five switches, a search string and three states is a combination
 * table, not a widget. Everything here is display only (FR-384) — nothing in
 * this module writes, and the counters never see it, because they are computed
 * above it (R317).
 */

const ANA = "profile-ana";
const BEN = "profile-ben";

/** Everything shown — the state one **Show all** leaves the four switches in. */
const ALL_ON: TaskFilters = { completed: true, late: true, skipped: true, upForGrabs: true };

/** FR-361's default: skipped occurrences are shown only when their switch is on. */
const DEFAULTS: TaskFilters = { completed: true, late: true, skipped: false, upForGrabs: true };

const NOBODY_HIDDEN: ReadonlySet<string> = new Set<string>();

function occurrenceOf(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    taskId: "task-1",
    assigneeId: ANA,
    scheduledDate: "2026-09-04",
    slot: null,
    cyclePrev: null,
    displayedDate: "2026-09-04",
    isLate: false,
    summary: "Take out the bins",
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

/** Ana's three states of the same chore, on the day it is due. */
const UNRESOLVED = occurrenceOf({ taskId: "task-unresolved" });
const COMPLETE = occurrenceOf({ taskId: "task-complete", state: "complete" });
const SKIPPED = occurrenceOf({ taskId: "task-skipped", state: "skipped" });

/** FR-357's carry-forward: due last Tuesday, drawn on today, marked late. */
const LATE = occurrenceOf({
  taskId: "task-late",
  scheduledDate: "2026-09-01",
  displayedDate: "2026-09-04",
  isLate: true,
});

/** FR-365: belongs to nobody until claimed, so it has no assignee at all. */
const UP_FOR_GRABS = occurrenceOf({
  taskId: "task-grabs",
  assigneeId: null,
  upForGrabs: true,
  summary: "Feed the cat",
});

/** FR-367: claimed, so it has left the Up for Grabs column for Ben's. */
const CLAIMED = occurrenceOf({
  taskId: "task-claimed",
  assigneeId: null,
  upForGrabs: true,
  state: "complete",
  creditedCategoryId: BEN,
  summary: "Feed the cat",
});

function idsOf(occurrences: readonly BoardOccurrence[]): string[] {
  return occurrences.map((one) => one.taskId);
}

function shown(
  occurrences: BoardOccurrence[],
  filters: TaskFilters = ALL_ON,
  hiddenIds: ReadonlySet<string> = NOBODY_HIDDEN,
  query = "",
): string[] {
  return idsOf(visibleTaskOccurrences(occurrences, hiddenIds, filters, query));
}

describe("visibleTaskOccurrences — nothing filtered", () => {
  it("returns the input array itself so an untouched board keeps its memo identity (R319)", () => {
    const day = [UNRESOLVED, COMPLETE, SKIPPED, LATE, UP_FOR_GRABS];

    expect(visibleTaskOccurrences(day, NOBODY_HIDDEN, ALL_ON, "")).toBe(day);
  });

  it("keeps that identity through a query of nothing but whitespace", () => {
    const day = [UNRESOLVED, COMPLETE];

    expect(visibleTaskOccurrences(day, NOBODY_HIDDEN, ALL_ON, "   ")).toBe(day);
  });

  it("never mutates what it is given (FR-384: display only)", () => {
    const day = [UNRESOLVED, COMPLETE, SKIPPED];

    visibleTaskOccurrences(day, new Set([ANA]), DEFAULTS, "bins");

    expect(idsOf(day)).toEqual(["task-unresolved", "task-complete", "task-skipped"]);
  });
});

describe("visibleTaskOccurrences — the Completed tasks switch", () => {
  const day = [UNRESOLVED, COMPLETE, SKIPPED];

  it("shows completed occurrences while it is on", () => {
    expect(shown(day)).toContain("task-complete");
  });

  it("hides only the completed ones when it goes off", () => {
    expect(shown(day, { ...ALL_ON, completed: false })).toEqual([
      "task-unresolved",
      "task-skipped",
    ]);
  });

  it("hides a completed occurrence whatever column it sits in (FR-367)", () => {
    expect(shown([CLAIMED, UP_FOR_GRABS], { ...ALL_ON, completed: false })).toEqual([
      "task-grabs",
    ]);
  });
});

describe("visibleTaskOccurrences — the Late chores switch (FR-383)", () => {
  const day = [UNRESOLVED, LATE, COMPLETE];

  it("shows carried-forward occurrences while it is on", () => {
    expect(shown(day)).toContain("task-late");
  });

  it("hides carried-forward occurrences without touching chores due on the displayed day", () => {
    expect(shown(day, { ...ALL_ON, late: false })).toEqual(["task-unresolved", "task-complete"]);
  });

  it("hides a late occurrence that was completed today just the same", () => {
    const lateAndDone = occurrenceOf({
      taskId: "task-late-done",
      scheduledDate: "2026-09-01",
      isLate: true,
      state: "complete",
    });

    expect(shown([lateAndDone, UNRESOLVED], { ...ALL_ON, late: false })).toEqual([
      "task-unresolved",
    ]);
  });
});

describe("visibleTaskOccurrences — the Skipped tasks switch (FR-361)", () => {
  const day = [UNRESOLVED, SKIPPED, COMPLETE];

  it("hides skipped occurrences by default, which is the switch's default off", () => {
    expect(shown(day, DEFAULTS)).toEqual(["task-unresolved", "task-complete"]);
  });

  it("reveals them, and only them, when the switch goes on (US3-6)", () => {
    expect(shown(day, { ...DEFAULTS, skipped: true })).toEqual([
      "task-unresolved",
      "task-skipped",
      "task-complete",
    ]);
  });
});

describe("visibleTaskOccurrences — the Up for Grabs switch", () => {
  const day = [UNRESOLVED, UP_FOR_GRABS, CLAIMED];

  it("shows the unclaimed column while it is on", () => {
    expect(shown(day)).toContain("task-grabs");
  });

  it("hides what belongs to nobody when it goes off", () => {
    expect(shown(day, { ...ALL_ON, upForGrabs: false })).toEqual([
      "task-unresolved",
      "task-claimed",
    ]);
  });

  it("leaves a claimed occurrence in the crediting Profile's column (FR-367)", () => {
    expect(shown([CLAIMED], { ...ALL_ON, upForGrabs: false })).toEqual(["task-claimed"]);
  });
});

describe("visibleTaskOccurrences — the per-Profile hidden set (FR-383)", () => {
  const day = [UNRESOLVED, occurrenceOf({ taskId: "task-ben", assigneeId: BEN }), UP_FOR_GRABS];

  it("hides one Profile's own occurrences on this device only", () => {
    expect(shown(day, ALL_ON, new Set([ANA]))).toEqual(["task-ben", "task-grabs"]);
  });

  it("never hides Up for Grabs, which belongs to no Profile at all (FR-308)", () => {
    expect(shown(day, ALL_ON, new Set([ANA, BEN]))).toEqual(["task-grabs"]);
  });

  it("hides a claimed occurrence with the Profile that claimed it (FR-367)", () => {
    expect(shown([CLAIMED, UP_FOR_GRABS], ALL_ON, new Set([BEN]))).toEqual(["task-grabs"]);
  });

  it("ignores ids the household has since deleted", () => {
    expect(shown(day, ALL_ON, new Set(["profile-gone"]))).toEqual([
      "task-unresolved",
      "task-ben",
      "task-grabs",
    ]);
  });
});

describe("visibleTaskOccurrences — search (FR-386, SC-320)", () => {
  const described = occurrenceOf({
    taskId: "task-described",
    summary: "Homework",
    description: "Maths and the cat poster",
  });
  const day = [UNRESOLVED, described, UP_FOR_GRABS];

  it("matches a title, case-insensitively", () => {
    expect(shown(day, ALL_ON, NOBODY_HIDDEN, "BINS")).toEqual(["task-unresolved"]);
  });

  it("matches a description as well as a title (FR-321's second reason to exist)", () => {
    expect(shown(day, ALL_ON, NOBODY_HIDDEN, "poster")).toEqual(["task-described"]);
  });

  it("reaches every column including Up for Grabs (SC-320)", () => {
    expect(shown(day, ALL_ON, NOBODY_HIDDEN, "cat")).toEqual(["task-described", "task-grabs"]);
  });

  it("trims the typed string rather than matching on the spaces", () => {
    expect(shown(day, ALL_ON, NOBODY_HIDDEN, "  bins  ")).toEqual(["task-unresolved"]);
  });

  it("shows nothing when nothing matches, rather than everything", () => {
    expect(shown(day, ALL_ON, NOBODY_HIDDEN, "zzz")).toEqual([]);
  });

  it("restores every card when the box is cleared", () => {
    expect(shown(day, ALL_ON, NOBODY_HIDDEN, "")).toEqual([
      "task-unresolved",
      "task-described",
      "task-grabs",
    ]);
  });

  it("never matches a null description against an empty needle by accident", () => {
    expect(shown([UNRESOLVED], ALL_ON, NOBODY_HIDDEN, "x")).toEqual([]);
  });
});

describe("visibleTaskOccurrences — the switches compose", () => {
  const day = [UNRESOLVED, COMPLETE, SKIPPED, LATE, UP_FOR_GRABS, CLAIMED];

  it("applies every predicate at once, each narrowing the last", () => {
    expect(shown(day, { completed: false, late: false, skipped: false, upForGrabs: false })).toEqual(
      ["task-unresolved"],
    );
  });

  it("lets the hidden set and a query narrow together", () => {
    expect(shown(day, ALL_ON, new Set([BEN]), "cat")).toEqual(["task-grabs"]);
  });

  it("can hide the whole day without touching a single stored row", () => {
    const filters: TaskFilters = {
      completed: false,
      late: false,
      skipped: false,
      upForGrabs: false,
    };

    expect(shown(day, filters, new Set([ANA, BEN]))).toEqual([]);
    expect(idsOf(day)).toHaveLength(6);
  });
});
