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

/** How many columns a measured board shows, and whether the rest wrap or page. */
export function boardLayoutOf(input: BoardLayoutInput): BoardLayout {
  const perRow = perRowOf(input);
  return { perRow, mode: modeOf(input, perRow) };
}

/** As many WHOLE columns as fit, never more than exist, never fewer than one. */
function perRowOf(input: BoardLayoutInput): number {
  const { referenceColumnWidth } = input;
  if (!Number.isFinite(referenceColumnWidth) || referenceColumnWidth <= 0) {
    throw new Error(`reference column width must be positive, got ${referenceColumnWidth}`);
  }
  const fits = Math.floor(input.boardWidth / referenceColumnWidth);
  return Math.max(MIN_PER_ROW, Math.min(input.columnCount, fits));
}

/**
 * Everything fits → one row. Otherwise FR-395's exception: a portrait viewport
 * showing two or more across wraps the remainder onto further rows, and every
 * other shape pages (FR-396). "Portrait" is height at least width, the
 * complement of the shipped calendar's strict landscape test.
 */
function modeOf(input: BoardLayoutInput, perRow: number): BoardLayoutMode {
  if (perRow >= input.columnCount) return "grid";
  const portrait = input.viewportHeight >= input.viewportWidth;
  return portrait && perRow >= MIN_WRAPPED_PER_ROW ? "grid" : "pager";
}
