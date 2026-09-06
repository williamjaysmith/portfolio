/**
 * T030 — the board's two pure layout rules.
 *
 * `sectionsOf` is FR-302's four sections plus FR-311's fixed chore order: the
 * order exists precisely because chores are never reorderable, so without one
 * two builds could both satisfy the spec and render differently.
 *
 * `boardLayoutOf` is the viewport table the plan states — 1920×1080 → 4 ·
 * 1180×820 → 4 · 820×1180 → 3 wrapped · 390×844 → 1 paged — driven here by the
 * same arithmetic the mounted board's token probes will measure, so the table
 * is a claim about real viewports rather than about four invented numbers.
 */

import { describe, expect, it } from "vitest";

import { boardLayoutOf, sectionsOf, type BoardLayoutInput } from "@/lib/family/tasks/layout";
import type { BoardOccurrence } from "@/lib/family/types";

const TODAY = "2026-09-04";
const CLEO = "11111111-1111-4111-8111-111111111111";

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    rewardPoints: null,
    taskId: "task-1",
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

function createdAt(minute: number): string {
  return `2026-01-01T00:${String(minute).padStart(2, "0")}:00.000Z`;
}

function summariesOf(occurrences: readonly BoardOccurrence[]): string[] {
  return occurrences.map((one) => one.summary);
}

describe("sectionsOf — FR-302's four sections", () => {
  it("places each routine in the slot it was generated for", () => {
    const sections = sectionsOf([
      occurrence({ summary: "Brush teeth", routine: true, slot: "evening" }),
      occurrence({ summary: "Make bed", routine: true, slot: "morning" }),
      occurrence({ summary: "Homework", routine: true, slot: "afternoon" }),
    ]);
    expect(summariesOf(sections.morning)).toEqual(["Make bed"]);
    expect(summariesOf(sections.afternoon)).toEqual(["Homework"]);
    expect(summariesOf(sections.evening)).toEqual(["Brush teeth"]);
    expect(sections.chores).toEqual([]);
  });

  it("places every chore in the Chores section, whatever its sub-type", () => {
    const sections = sectionsOf([
      occurrence({ summary: "Timed", dueTime: "08:00" }),
      occurrence({ summary: "All day" }),
      occurrence({ summary: "Anytime", scheduledDate: null }),
      occurrence({ summary: "Late", scheduledDate: "2026-09-01", isLate: true }),
    ]);
    expect(sections.chores).toHaveLength(4);
    expect(sections.morning).toEqual([]);
    expect(sections.afternoon).toEqual([]);
    expect(sections.evening).toEqual([]);
  });

  it("gives an empty column four empty sections (FR-316)", () => {
    expect(sectionsOf([])).toEqual({ morning: [], afternoon: [], evening: [], chores: [] });
  });

  it("keeps routines in the order they arrive in — FR-310's order is upstream", () => {
    const sections = sectionsOf([
      occurrence({ summary: "Second", routine: true, slot: "morning", taskCreatedAt: createdAt(9) }),
      occurrence({ summary: "First", routine: true, slot: "morning", taskCreatedAt: createdAt(1) }),
    ]);
    expect(summariesOf(sections.morning)).toEqual(["Second", "First"]);
  });

  it("keeps a skipped occurrence in its section — hiding it is the filter's job (FR-361)", () => {
    const sections = sectionsOf([occurrence({ summary: "Water plants", state: "skipped" })]);
    expect(summariesOf(sections.chores)).toEqual(["Water plants"]);
  });
});

describe("sectionsOf — FR-311's fixed chore order", () => {
  it("orders late, then timed, then all-day, then undated anytime", () => {
    const sections = sectionsOf([
      occurrence({ summary: "Anytime (late-made)", scheduledDate: null, taskCreatedAt: createdAt(9) }),
      occurrence({ summary: "All day", taskCreatedAt: createdAt(5) }),
      occurrence({ summary: "Timed 08:00", dueTime: "08:00", taskCreatedAt: createdAt(1) }),
      occurrence({ summary: "Timed 18:00", dueTime: "18:00", taskCreatedAt: createdAt(2) }),
      occurrence({
        summary: "Late 09-01",
        scheduledDate: "2026-09-01",
        isLate: true,
        taskCreatedAt: createdAt(6),
      }),
      occurrence({
        summary: "Late 08-30",
        scheduledDate: "2026-08-30",
        isLate: true,
        taskCreatedAt: createdAt(4),
      }),
      occurrence({ summary: "Anytime (early-made)", scheduledDate: null, taskCreatedAt: createdAt(3) }),
    ]);
    expect(summariesOf(sections.chores)).toEqual([
      "Late 08-30",
      "Late 09-01",
      "Timed 08:00",
      "Timed 18:00",
      "All day",
      "Anytime (early-made)",
      "Anytime (late-made)",
    ]);
  });

  it("breaks a same-date late tie by creation order, not by due time", () => {
    // FR-311's tie-break is creation order in as many words: the earlier-made
    // chore leads even though its due time is later.
    const sections = sectionsOf([
      occurrence({
        summary: "Made later, due 06:00",
        scheduledDate: "2026-09-01",
        dueTime: "06:00",
        isLate: true,
        taskCreatedAt: createdAt(8),
      }),
      occurrence({
        summary: "Made earlier, due 20:00",
        scheduledDate: "2026-09-01",
        dueTime: "20:00",
        isLate: true,
        taskCreatedAt: createdAt(2),
      }),
    ]);
    expect(summariesOf(sections.chores)).toEqual([
      "Made earlier, due 20:00",
      "Made later, due 06:00",
    ]);
  });

  it("orders the undated anytime chores, which have no key of their own, by creation order", () => {
    const sections = sectionsOf([
      occurrence({ summary: "Later", scheduledDate: null, taskCreatedAt: createdAt(7) }),
      occurrence({ summary: "Earlier", scheduledDate: null, taskCreatedAt: createdAt(3) }),
    ]);
    expect(summariesOf(sections.chores)).toEqual(["Earlier", "Later"]);
  });

  it("breaks a same-time tie by creation order", () => {
    const sections = sectionsOf([
      occurrence({ summary: "Later", dueTime: "08:00", taskCreatedAt: createdAt(7) }),
      occurrence({ summary: "Earlier", dueTime: "08:00", taskCreatedAt: createdAt(3) }),
    ]);
    expect(summariesOf(sections.chores)).toEqual(["Earlier", "Later"]);
  });

  it("is identical for everyone — the same input orders the same way every time", () => {
    const day = [
      occurrence({ summary: "All day", taskCreatedAt: createdAt(5) }),
      occurrence({ summary: "Timed", dueTime: "09:30", taskCreatedAt: createdAt(6) }),
      occurrence({ summary: "Anytime", scheduledDate: null, taskCreatedAt: createdAt(1) }),
    ];
    const forward = summariesOf(sectionsOf(day).chores);
    const backward = summariesOf(sectionsOf([...day].reverse()).chores);
    expect(forward).toEqual(["Timed", "All day", "Anytime"]);
    expect(backward).toEqual(forward);
  });

  it("does not mutate the array it is given", () => {
    const day = [
      occurrence({ summary: "All day", taskCreatedAt: createdAt(5) }),
      occurrence({ summary: "Timed", dueTime: "09:30", taskCreatedAt: createdAt(6) }),
    ];
    sectionsOf(day);
    expect(summariesOf(day)).toEqual(["All day", "Timed"]);
  });
});

/* -------------------------------------------------- the viewport table -- */

/** `--fam-u`: `clamp(0.5px, max(100vw, 100vh) / 1920, 1px)` (tokens.css). */
function famUnit(viewportWidth: number, viewportHeight: number): number {
  return Math.min(1, Math.max(0.5, Math.max(viewportWidth, viewportHeight) / 1920));
}

/** The reference's ~400-point column (FR-394) and `--fam-rail-w`, in units. */
const TASK_COLUMN_UNITS = 400;
const RAIL_UNITS = 102;

/**
 * What the mounted board's `ResizeObserver` and token probes would report at
 * one viewport: landscape keeps the nav rail beside the board, portrait puts
 * the same nav under it, so the board owns the whole width.
 */
function measured(
  viewportWidth: number,
  viewportHeight: number,
  columnCount: number,
): BoardLayoutInput {
  const unit = famUnit(viewportWidth, viewportHeight);
  const landscape = viewportWidth > viewportHeight;
  return {
    viewportWidth,
    viewportHeight,
    boardWidth: viewportWidth - (landscape ? RAIL_UNITS * unit : 0),
    referenceColumnWidth: TASK_COLUMN_UNITS * unit,
    columnCount,
  };
}

describe("boardLayoutOf — the four viewports (FR-394, FR-395, FR-396)", () => {
  // Up for Grabs plus Ana, Ben and Cleo — the spec's own household.
  const COLUMNS = 4;

  it("1920×1080 wall tablet → four across, one row", () => {
    expect(boardLayoutOf(measured(1920, 1080, COLUMNS))).toEqual({ perRow: 4, mode: "grid" });
  });

  it("1180×820 landscape iPad → four across, one row", () => {
    expect(boardLayoutOf(measured(1180, 820, COLUMNS))).toEqual({ perRow: 4, mode: "grid" });
  });

  it("820×1180 portrait iPad → three across, wrapped onto a second row", () => {
    expect(boardLayoutOf(measured(820, 1180, COLUMNS))).toEqual({ perRow: 3, mode: "grid" });
  });

  it("390×844 phone → one column, paged by swipe", () => {
    expect(boardLayoutOf(measured(390, 844, COLUMNS))).toEqual({ perRow: 1, mode: "pager" });
  });
});

describe("boardLayoutOf — the fit rule", () => {
  function input(overrides: Partial<BoardLayoutInput> = {}): BoardLayoutInput {
    return {
      viewportWidth: 1920,
      viewportHeight: 1080,
      boardWidth: 1818,
      referenceColumnWidth: 400,
      columnCount: 4,
      ...overrides,
    };
  }

  it("shows as many WHOLE columns as fit, never a partial one", () => {
    // 1818 / 400 = 4.5 — the reference's own half-visible fifth column is not
    // a column this board shows.
    expect(boardLayoutOf(input({ columnCount: 9 })).perRow).toBe(4);
  });

  it("never shows more columns than exist", () => {
    expect(boardLayoutOf(input({ columnCount: 2 })).perRow).toBe(2);
  });

  it("has no three-column floor — a Tasks column is a person, not a day", () => {
    expect(boardLayoutOf(input({ boardWidth: 700, viewportWidth: 700 })).perRow).toBe(1);
  });

  it("floors at one however narrow the board is", () => {
    expect(boardLayoutOf(input({ boardWidth: 120, viewportWidth: 120 })).perRow).toBe(1);
  });

  it("has no seven-column cap", () => {
    expect(
      boardLayoutOf(input({ boardWidth: 3600, viewportWidth: 3600, columnCount: 9 })).perRow,
    ).toBe(9);
  });

  it("refuses an unmeasured reference width rather than dividing by it", () => {
    expect(() => boardLayoutOf(input({ referenceColumnWidth: 0 }))).toThrow(/reference column/i);
  });

  it("holds one column for a household with none to show", () => {
    expect(boardLayoutOf(input({ columnCount: 0 }))).toEqual({ perRow: 1, mode: "grid" });
  });
});

describe("boardLayoutOf — wrap, then page", () => {
  function portrait(columnCount: number, perRowFits: number): BoardLayoutInput {
    return {
      viewportWidth: 820,
      viewportHeight: 1180,
      boardWidth: 250 * perRowFits,
      referenceColumnWidth: 250,
      columnCount,
    };
  }

  it("grids when every column fits, whatever the orientation", () => {
    expect(boardLayoutOf(portrait(3, 3)).mode).toBe("grid");
  });

  it("wraps onto a second row when the viewport is portrait (FR-395)", () => {
    expect(boardLayoutOf(portrait(4, 2))).toEqual({ perRow: 2, mode: "grid" });
  });

  it("pages when a portrait viewport fits only one column — a stack is not a wrap", () => {
    expect(boardLayoutOf(portrait(4, 1))).toEqual({ perRow: 1, mode: "pager" });
  });

  it("wraps onto a second row and no further: more than two rows' worth pages instead", () => {
    // Six across three fit in exactly two rows; a seventh would need a third,
    // and three rows share the height into columns too short to read.
    expect(boardLayoutOf(portrait(6, 3))).toEqual({ perRow: 3, mode: "grid" });
    expect(boardLayoutOf(portrait(7, 3))).toEqual({ perRow: 3, mode: "pager" });
    expect(boardLayoutOf(portrait(7, 2))).toEqual({ perRow: 2, mode: "pager" });
  });

  it("pages rather than wrapping in landscape (FR-396)", () => {
    expect(
      boardLayoutOf({
        viewportWidth: 1180,
        viewportHeight: 820,
        boardWidth: 500,
        referenceColumnWidth: 250,
        columnCount: 4,
      }),
    ).toEqual({ perRow: 2, mode: "pager" });
  });

  it("treats a square viewport as portrait, as the shipped calendar does", () => {
    expect(
      boardLayoutOf({
        viewportWidth: 900,
        viewportHeight: 900,
        boardWidth: 500,
        referenceColumnWidth: 250,
        columnCount: 4,
      }).mode,
    ).toBe("grid");
  });
});
