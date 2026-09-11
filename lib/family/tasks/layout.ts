/**
 * The board's two pure layout rules: what goes in which section of a column,
 * and how many columns the measured viewport shows (R320).
 *
 * `sectionsOf` is FR-302: an occurrence's SLOT is its section, so a routine
 * appears in the slot it was generated for and can never migrate out of it as
 * the clock passes (FR-336), and a chore — which carries no slot at all —
 * falls into the Chores section. The canonical section order is the one this
 * module's `ColumnSections` declares: Morning, Afternoon, Evening, Chores.
 *
 * FR-311's chore order lives here because chores are never reorderable by
 * anyone: without one fixed rule two builds could both satisfy the spec and
 * render the same column differently, and a column could not be checked by
 * hand against its counters (SC-310). Routines carry no order here — theirs is
 * the per-Profile `task_assignees.sort_order` the caller has already applied
 * (FR-310), and this function preserves the order it is handed.
 *
 * `boardLayoutOf` is FR-394/395/396: measure, do not switch between fixed
 * counts. It differs from the calendar's rule deliberately — no seven-column
 * cap and no three-column floor, because a Tasks column is a person and not a
 * day, so the floor is one. When fewer columns fit than exist, a portrait
 * viewport wraps them onto further rows (FR-395 — two fitting out of four is
 * the reference's photographed 2×2) and everything else pages by swipe
 * (FR-396).
 *
 * Framework-free and pure: no React, no DOM, no tokens read here — the
 * measurements arrive as arguments from `useBoardGeometry`'s probes.
 */

import type { BoardOccurrence } from "../types";

/** FR-302's four sections, declared in the order a column draws them. */
export interface ColumnSections {
  morning: BoardOccurrence[];
  afternoon: BoardOccurrence[];
  evening: BoardOccurrence[];
  chores: BoardOccurrence[];
}

/** FR-311's four bands, in the order the Chores section draws them. */
const LATE_BAND = 0;
const TIMED_BAND = 1;
const ALL_DAY_BAND = 2;
const ANYTIME_BAND = 3;

/**
 * One column's occurrences, split into its four sections, with the Chores
 * section in FR-311's fixed order. The input array is never mutated.
 */
export function sectionsOf(occurrences: readonly BoardOccurrence[]): ColumnSections {
  const sections: ColumnSections = { morning: [], afternoon: [], evening: [], chores: [] };
  for (const one of occurrences) {
    sections[one.slot ?? "chores"].push(one);
  }
  sections.chores.sort(compareChores);
  return sections;
}

/**
 * FR-311 verbatim: late carry-ins first by earliest original due date; then
 * chores due that day carrying a time, earliest first; then all-day; then
 * undated anytime; ties by creation order — which is the tie-break even
 * between two late chores of the same date that carry different times.
 */
function compareChores(a: BoardOccurrence, b: BoardOccurrence): number {
  const band = bandOf(a) - bandOf(b);
  if (band !== 0) return band;
  const within = compareText(withinBandKeyOf(a), withinBandKeyOf(b));
  if (within !== 0) return within;
  return compareText(a.taskCreatedAt, b.taskCreatedAt);
}

function bandOf(one: BoardOccurrence): number {
  if (one.isLate) return LATE_BAND;
  if (one.scheduledDate === null) return ANYTIME_BAND;
  return one.dueTime === null ? ALL_DAY_BAND : TIMED_BAND;
}

/**
 * What orders a band internally: the late band by the occurrence's own
 * original date (FR-358), the timed band by its wall clock. The other two
 * bands order by creation alone, and an empty key ties every member of them.
 */
function withinBandKeyOf(one: BoardOccurrence): string {
  return (one.isLate ? one.scheduledDate : one.dueTime) ?? "";
}

/** ISO dates, `HH:MM` clocks and ISO timestamps all sort chronologically as text. */
function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/* -------------------------------------------------------- board layout -- */

/** One measurement of the mounted board and its token probes, in CSS px. */
export interface BoardLayoutInput {
  /** Visual viewport width — with its height, the orientation test. */
  viewportWidth: number;
  viewportHeight: number;
  /** Rendered content width the columns share. */
  boardWidth: number;
  /** The resolved column token: the "whole column that fits" width. */
  referenceColumnWidth: number;
  /**
   * The gap the board actually draws between columns, in CSS px.
   *
   * **Without it the fit is over-counted by one column at exactly the wrong
   * widths.** Measured on a 414×896 phone: the board is 400px, a column token
   * resolves to 200px, and `floor(400 / 200)` says two whole columns fit — but
   * two columns plus the 13px between them need 413px, so each was drawn at
   * 173px instead of the 200 it was promised. A 173px column cannot hold its
   * own header: the four section toggles are 44px tap targets (FR-397) and
   * 4 × 44 = 176 > 173, so they wrapped to a second line and the header grew.
   * The operator reported exactly that. Defaults to 0 so an older caller — and
   * every test written before this — keeps the ungapped arithmetic.
   */
  columnGap?: number;
  /** Columns there are to place — Up for Grabs plus every shown Profile. */
  columnCount: number;
}

/** Wrapped rows of a grid, or one row paged by horizontal swipe (FR-396). */
export type BoardLayoutMode = "grid" | "pager";

export interface BoardLayout {
  /** Columns per row — the grid's track count, and the pager's page size. */
  perRow: number;
  mode: BoardLayoutMode;
}

/** FR-396's floor: a column is a person, and one person is a board. */
const MIN_PER_ROW = 1;

/** Below this a "wrap" is a vertical stack of columns, which is FR-396's phone. */
const MIN_WRAPPED_PER_ROW = 2;

/**
 * FR-395 says "a second row", and means it: the rows share the board's height,
 * so a third or fourth row would leave every column too short to read a card
 * in. A portrait board that would need more than two rows pages instead.
 */
const MAX_WRAPPED_ROWS = 2;

/**
 * The height a board needs before it may spend half of it on a second row.
 *
 * "Portrait" alone was the test, and a phone satisfies it exactly as a portrait
 * iPad does — which is how the operator's phone ended up drawing four people
 * two-up, each column ~170px wide and ~250px tall: a header, and no room for
 * the tasks under it. Their report: *"my 3 users wrap (showing four users 2 top
 * 2 bottom) … but i think it should maybe always stay horizontal otherwise
 * theres not room to show the tasks below them"*.
 *
 * 900 splits the two devices FR-395 is actually about. The reference's
 * photographed 2×2 is the portrait iPad (820×1180) and it still wraps; every
 * phone in the visual brief (844, 896, 667, 568 tall) pages instead, which is
 * also what the brief's own expectation for 390×844 already said. It is a
 * height, not a breakpoint on width: the thing being rationed is vertical
 * space, so that is what the rule reads.
 */
const MIN_WRAPPED_HEIGHT = 900;

/** How many columns a measured board shows, and whether the rest wrap or page. */
export function boardLayoutOf(input: BoardLayoutInput): BoardLayout {
  const perRow = wholeColumnsOf(input);
  return { perRow, mode: modeOf(input, perRow) };
}

/**
 * As many WHOLE columns as fit, never more than exist, never fewer than one —
 * the arithmetic BOTH fit rules share (`boardLayoutOf` here, `rowLayoutOf` on
 * the Lists tab), which is why it is exported rather than written twice.
 *
 * `n` columns occupy `n · width + (n − 1) · gap`, so the count that fits is
 * `floor((board + gap) / (width + gap))` — the `+ gap` on top cancels the one
 * gap the last column does not need. With a zero gap this is the plain division
 * it replaced, which is what every caller written before the gap existed gets.
 *
 * **The gap term is not a refinement, it is a defect fix.** Without it a board
 * seats a column its content box cannot hold and the grid squeezes every column
 * below the width the token promised: measured at 193px against a promised 200
 * on a 414×896 phone, which was narrow enough to wrap the column header's own
 * controls onto a second line.
 */
export function wholeColumnsOf(input: BoardLayoutInput, what = "reference column width"): number {
  const { referenceColumnWidth } = input;
  if (!Number.isFinite(referenceColumnWidth) || referenceColumnWidth <= 0) {
    throw new Error(`${what} must be positive, got ${referenceColumnWidth}`);
  }
  const gap = Number.isFinite(input.columnGap) ? Math.max(0, input.columnGap ?? 0) : 0;
  const fits = Math.floor((input.boardWidth + gap) / (referenceColumnWidth + gap));
  return Math.max(MIN_PER_ROW, Math.min(input.columnCount, fits));
}

/**
 * Everything fits → one row. Otherwise FR-395's exception: a TALL portrait
 * viewport showing two or more across wraps the remainder onto a second row —
 * and only a second — and every other shape pages (FR-396). "Portrait" is
 * height at least width, the complement of the shipped calendar's strict
 * landscape test; "tall" is `MIN_WRAPPED_HEIGHT`, and it is what keeps a phone
 * out of a layout meant for a tablet.
 */
function modeOf(input: BoardLayoutInput, perRow: number): BoardLayoutMode {
  if (perRow >= input.columnCount) return "grid";
  const portrait = input.viewportHeight >= input.viewportWidth;
  const tall = input.viewportHeight >= MIN_WRAPPED_HEIGHT;
  const wraps = perRow >= MIN_WRAPPED_PER_ROW && input.columnCount <= perRow * MAX_WRAPPED_ROWS;
  return portrait && tall && wraps ? "grid" : "pager";
}
