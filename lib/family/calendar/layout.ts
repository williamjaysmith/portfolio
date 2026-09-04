/**
 * Pure week-grid layout (spec 002, T022) — the lingua franca of the grid.
 * Every presentational component (`EventBlock`, `MoreOverflow`, `AllDayBand`,
 * `DayColumn`) renders exactly what this module returns and computes no
 * geometry of its own. Occurrences + the visible slice's column dates + the
 * measured metrics in; positioned timed segments, "+n more" overflow groups
 * and all-day lanes out. Output is deterministic (columns left-to-right,
 * top-down, ties by event id) for stable memoization.
 *
 * What it owes the spec:
 *
 * - **FR-217 midnight segmentation** — an event crossing midnight is ONE
 *   occurrence with a labelled segment in every column it touches; every
 *   segment carries the same `occurrence` reference, so a tap or drag on any
 *   of them acts on that single event.
 * - **FR-205 / FR-285 overlap** — simultaneous events share their column
 *   side by side up to the cap (three abreast where the column is at least
 *   180 wide, two below); every further event in that time band collapses
 *   into a "+n more" group. Scrolling is never the answer to simultaneity.
 *   Clustering works on RENDERED rectangles, not stored times, so blocks
 *   inflated to the FR-218 minimum also refuse to draw over each other.
 * - **FR-206 / FR-207 all-day lanes** — one spanning bar per all-day event
 *   across every visible day it covers, first-fit into lanes; a bar cut by
 *   the slice edge is clipped, with the cut edge flagged so the visible
 *   portion keeps its title (spec edge case).
 * - **FR-218 minimum height** — one line of the block's own title type plus
 *   its vertical padding, never under the FR-263 touch floor;
 *   `startMinutes`/`endMinutes` always carry the true times untouched.
 *
 * Vertical placement is WALL-CLOCK minutes in the household zone measured
 * against the 24-row hour ruler (FR-204/FR-219): on a DST fall-back day a
 * 13:00 event sits beside the 13:00 label, not 14 elapsed hours down.
 *
 * All lengths are CSS px — the same unit the spec's "points" resolve to on
 * the target tablets. Token-derived values (row height, title type, padding)
 * arrive MEASURED via `LayoutMetrics`; only the spec's own constants
 * (44 floor, 180 cap threshold) live here.
 */

import { diffDays, localDateOf, wallMinutesOf } from "./dates";
import type { EventTimes, Occurrence } from "../types";
import { MINUTES_PER_DAY } from "../week-geometry";

/** Wall minutes on the 24-row ruler; DST days still render 24 rows. */

/** FR-263's 44 touch floor — the FR-218 minimum-height backstop. */
export const TOUCH_FLOOR = 44;

/** FR-285: a column at least this wide draws three abreast, narrower two. */
const WIDE_COLUMN_MIN = 180;

/** The measured inputs layout depends on — see the module doc for units. */
export interface LayoutMetrics {
  /** Rendered width of one day column — decides the FR-285 abreast cap. */
  columnWidth: number;
  /** Vertical scale of the hour ruler, px per wall-clock minute. */
  pxPerMinute: number;
  /** One line of the event block's own title type (FR-218). */
  titleLineHeight: number;
  /** The block's total vertical padding, top plus bottom (FR-218). */
  blockPaddingY: number;
}

/**
 * One drawn rectangle of a timed occurrence in one day column. A
 * midnight-crossing event yields several segments sharing one `occurrence`
 * (FR-217); everything else yields exactly one.
 */
export interface TimedSegment {
  /** The expanded occurrence — the label, colours and identity of the block. */
  occurrence: Occurrence;
  /** Index into the `columnDates` passed to `layoutWeek`. */
  columnIndex: number;
  /** The column's household-local date, `YYYY-MM-DD`. */
  date: string;
  /** TRUE start within this column, wall minutes since its midnight (0–1440). */
  startMinutes: number;
  /** TRUE end within this column, wall minutes since its midnight (0–1440). */
  endMinutes: number;
  /** The event began in an earlier column (draw the top edge open). */
  continuesFromPrevious: boolean;
  /** The event runs on past this column's midnight (draw the bottom open). */
  continuesToNext: boolean;
  /** Rendered offset from the column top, px (min-height may pull it up). */
  top: number;
  /** Rendered height, px — never under `WeekLayout.minBlockHeight` (FR-218). */
  height: number;
  /** Left edge as a fraction of the column width (0 ≤ · < 1). */
  leftFraction: number;
  /** Width as a fraction of the column width (0 < · ≤ 1). */
  widthFraction: number;
}

/**
 * One "+n more" control (FR-285): the events of one time band that did not
 * fit abreast. Rendered as a single tappable block that lists `occurrences`.
 */
export interface OverflowGroup {
  columnIndex: number;
  date: string;
  /** Rendered band top, px from the column top. */
  top: number;
  /** Rendered band height, px (spans every collapsed block's rectangle). */
  height: number;
  /** Earliest TRUE start among the collapsed events, wall minutes. */
  startMinutes: number;
  /** Latest TRUE end among the collapsed events, wall minutes. */
  endMinutes: number;
  /** The "n" of "+n more". */
  hiddenCount: number;
  /** The collapsed events, earliest start first — the list the tap opens. */
  occurrences: Occurrence[];
}

/** One spanning bar in the all-day band (FR-206). */
export interface AllDayBar {
  occurrence: Occurrence;
  /** Row in the band, 0 at the top — never two overlapping bars share one. */
  lane: number;
  /** First covered column (index into `columnDates`), inclusive. */
  startColumn: number;
  /** Last covered column, inclusive. */
  endColumn: number;
  /** The event started before the visible slice — left edge is a cut, not a start. */
  clippedStart: boolean;
  /** The event continues past the visible slice — right edge is a cut. */
  clippedEnd: boolean;
}

/** The all-day band: bars plus how many lanes the band must fit (FR-207). */
export interface AllDayLayout {
  bars: AllDayBar[];
  laneCount: number;
}

/** Everything the grid draws for one visible slice of one week. */
export interface WeekLayout {
  /** Timed segments, column by column, top-down. */
  timed: TimedSegment[];
  /** "+n more" groups, column by column, top-down (FR-285). */
  overflow: OverflowGroup[];
  /** The band above the hours (FR-206/207). */
  allDay: AllDayLayout;
  /** The FR-218 floor every segment's `height` respects, px. */
  minBlockHeight: number;
}

/** FR-218: one title line + padding, never under the FR-263 touch floor. */
export function minBlockHeightOf(metrics: LayoutMetrics): number {
  return Math.max(metrics.titleLineHeight + metrics.blockPaddingY, TOUCH_FLOOR);
}

/** FR-285: how many events may draw abreast in a column this wide. */
export function abreastCapOf(columnWidth: number): 2 | 3 {
  return columnWidth >= WIDE_COLUMN_MIN ? 3 : 2;
}

/**
 * Lay out one visible slice. `columnDates` are the slice's consecutive
 * household-local dates (FR-289 tiling decides them); `householdZone` is the
 * one zone every render works in (FR-219/FR-284).
 */
export function layoutWeek(
  occurrences: readonly Occurrence[],
  columnDates: readonly string[],
  householdZone: string,
  metrics: LayoutMetrics,
): WeekLayout {
  assertColumns(columnDates);
  assertMetrics(metrics);
  const scale: Scale = {
    pxPerMinute: metrics.pxPerMinute,
    floor: minBlockHeightOf(metrics),
    columnHeight: MINUTES_PER_DAY * metrics.pxPerMinute,
  };
  const perColumn: Draft[][] = columnDates.map(() => []);
  for (const occurrence of occurrences) {
    if (!occurrence.times.allDay) {
      pushSegments(perColumn, occurrence, occurrence.times, columnDates, householdZone, scale);
    }
  }
  const cap = abreastCapOf(metrics.columnWidth);
  const timed: TimedSegment[] = [];
  const overflow: OverflowGroup[] = [];
  for (const drafts of perColumn) {
    const { segments, hidden } = placeColumn(drafts, cap);
    timed.push(...segments);
    for (const band of bandsOf(hidden)) overflow.push(groupOf(band));
  }
  return { timed, overflow, allDay: layoutAllDay(occurrences, columnDates), minBlockHeight: scale.floor };
}

/* ---------------------------------------------------------------- timed -- */

/** A positioned segment before its cluster decides the horizontal split. */
type Draft = Omit<TimedSegment, "leftFraction" | "widthFraction">;

interface Scale {
  pxPerMinute: number;
  floor: number;
  columnHeight: number;
}

/** FR-217: one draft per column the timed occurrence touches. */
function pushSegments(
  perColumn: Draft[][],
  occurrence: Occurrence,
  times: Extract<EventTimes, { allDay: false }>,
  columnDates: readonly string[],
  zone: string,
  scale: Scale,
): void {
  const startMs = Date.parse(times.startsAt);
  const endMs = Date.parse(times.endsAt);
  const firstDate = localDateOf(zone, startMs);
  // The last date holding any of the event: an end exactly ON a midnight
  // belongs wholly to the day before it (endsAt is exclusive).
  const lastDate = localDateOf(zone, endMs - 1);
  columnDates.forEach((date, columnIndex) => {
    if (date < firstDate || date > lastDate) return;
    const startMinutes = date === firstDate ? wallMinutesOf(zone, startMs) : 0;
    const endMinutes = endMinutesFor(zone, endMs, date, lastDate);
    perColumn[columnIndex].push(
      draftOf(occurrence, columnIndex, date, startMinutes, endMinutes, firstDate, lastDate, scale),
    );
  });
}

function endMinutesFor(zone: string, endMs: number, date: string, lastDate: string): number {
  if (date !== lastDate) return MINUTES_PER_DAY;
  // Ending exactly at the NEXT midnight reads as the full 1440 of this day.
  return localDateOf(zone, endMs) > date ? MINUTES_PER_DAY : wallMinutesOf(zone, endMs);
}

function draftOf(
  occurrence: Occurrence,
  columnIndex: number,
  date: string,
  startMinutes: number,
  endMinutes: number,
  firstDate: string,
  lastDate: string,
  scale: Scale,
): Draft {
  // FR-218: floor the DRAWN height only; a floored block near the column's
  // bottom is pulled up so it stays inside its day.
  const height = Math.max((endMinutes - startMinutes) * scale.pxPerMinute, scale.floor);
  const top = Math.max(0, Math.min(startMinutes * scale.pxPerMinute, scale.columnHeight - height));
  return {
    occurrence,
    columnIndex,
    date,
    startMinutes,
    endMinutes,
    continuesFromPrevious: date !== firstDate,
    continuesToNext: date !== lastDate,
    top,
    height,
  };
}

interface PlacedColumn {
  segments: TimedSegment[];
  hidden: Draft[];
}

/** FR-205/FR-285: cluster a column's drafts, lane them, cap the abreast. */
function placeColumn(drafts: readonly Draft[], cap: number): PlacedColumn {
  const sorted = [...drafts].sort(byTopThenLongest);
  const segments: TimedSegment[] = [];
  const hidden: Draft[] = [];
  for (const cluster of bandsOf(sorted)) placeCluster(cluster, cap, segments, hidden);
  return { segments, hidden };
}

function byTopThenLongest(a: Draft, b: Draft): number {
  return (
    a.top - b.top ||
    b.top + b.height - (a.top + a.height) ||
    a.occurrence.eventId.localeCompare(b.occurrence.eventId) ||
    a.occurrence.occurrenceDate.localeCompare(b.occurrence.occurrenceDate)
  );
}

/**
 * Maximal runs of transitively overlapping RENDERED rectangles (top-sorted
 * input). Serves twice: clusters for lane assignment, and FR-285's "time
 * band" grouping of the collapsed remainder.
 */
function bandsOf(sorted: readonly Draft[]): Draft[][] {
  const bands: Draft[][] = [];
  let current: Draft[] = [];
  let maxBottom = Number.NEGATIVE_INFINITY;
  for (const draft of sorted) {
    if (current.length > 0 && draft.top >= maxBottom) {
      bands.push(current);
      current = [];
      maxBottom = Number.NEGATIVE_INFINITY;
    }
    current.push(draft);
    maxBottom = Math.max(maxBottom, draft.top + draft.height);
  }
  if (current.length > 0) bands.push(current);
  return bands;
}

function placeCluster(
  cluster: readonly Draft[],
  cap: number,
  segments: TimedSegment[],
  hidden: Draft[],
): void {
  const laneBottoms: number[] = [];
  const placed: { draft: Draft; lane: number }[] = [];
  for (const draft of cluster) {
    const lane = laneFor(laneBottoms, draft, cap);
    if (lane === null) hidden.push(draft);
    else placed.push({ draft, lane });
  }
  // Width divides by the lanes the cluster actually used, so a pair shares
  // halves even where the cap would have allowed thirds.
  const laneCount = laneBottoms.length;
  for (const { draft, lane } of placed) {
    segments.push({ ...draft, leftFraction: lane / laneCount, widthFraction: 1 / laneCount });
  }
}

/** First lane whose last block ends above this one; null once capped out. */
function laneFor(laneBottoms: number[], draft: Draft, cap: number): number | null {
  for (let lane = 0; lane < laneBottoms.length; lane += 1) {
    if (laneBottoms[lane] <= draft.top) {
      laneBottoms[lane] = draft.top + draft.height;
      return lane;
    }
  }
  if (laneBottoms.length >= cap) return null;
  laneBottoms.push(draft.top + draft.height);
  return laneBottoms.length - 1;
}

/** One band of collapsed drafts → its "+n more" group (FR-285). */
function groupOf(band: Draft[]): OverflowGroup {
  const first = band[0];
  const top = Math.min(...band.map((draft) => draft.top));
  const bottom = Math.max(...band.map((draft) => draft.top + draft.height));
  const members = [...band].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes ||
      a.occurrence.eventId.localeCompare(b.occurrence.eventId),
  );
  return {
    columnIndex: first.columnIndex,
    date: first.date,
    top,
    height: bottom - top,
    startMinutes: Math.min(...band.map((draft) => draft.startMinutes)),
    endMinutes: Math.max(...band.map((draft) => draft.endMinutes)),
    hiddenCount: band.length,
    occurrences: members.map((draft) => draft.occurrence),
  };
}

/* -------------------------------------------------------------- all-day -- */

type AllDaySpan = Omit<AllDayBar, "lane">;

/** FR-206/FR-207: spanning bars, first-fit into lanes. */
function layoutAllDay(
  occurrences: readonly Occurrence[],
  columnDates: readonly string[],
): AllDayLayout {
  const laneEnds: number[] = [];
  const bars = allDaySpansOf(occurrences, columnDates).map((span) => ({
    ...span,
    lane: laneForSpan(laneEnds, span),
  }));
  return { bars, laneCount: laneEnds.length };
}

/** Visible spans, clipped to the slice with the cut edges flagged (FR-206). */
function allDaySpansOf(
  occurrences: readonly Occurrence[],
  columnDates: readonly string[],
): AllDaySpan[] {
  const firstDate = columnDates[0];
  const lastIndex = columnDates.length - 1;
  const spans: AllDaySpan[] = [];
  for (const occurrence of occurrences) {
    if (!occurrence.times.allDay) continue;
    // Inclusive date pair (FR-225) against the slice's column offsets.
    const startOffset = diffDays(firstDate, occurrence.times.startDate);
    const endOffset = diffDays(firstDate, occurrence.times.endDate);
    if (endOffset < 0 || startOffset > lastIndex) continue;
    spans.push({
      occurrence,
      startColumn: Math.max(startOffset, 0),
      endColumn: Math.min(endOffset, lastIndex),
      clippedStart: startOffset < 0,
      clippedEnd: endOffset > lastIndex,
    });
  }
  return spans.sort(byStartColumnThenLongest);
}

function byStartColumnThenLongest(a: AllDaySpan, b: AllDaySpan): number {
  return (
    a.startColumn - b.startColumn ||
    b.endColumn - a.endColumn ||
    a.occurrence.eventId.localeCompare(b.occurrence.eventId) ||
    a.occurrence.occurrenceDate.localeCompare(b.occurrence.occurrenceDate)
  );
}

/** First lane free of the span's columns; input arrives start-sorted. */
function laneForSpan(laneEnds: number[], span: AllDaySpan): number {
  for (let lane = 0; lane < laneEnds.length; lane += 1) {
    if (laneEnds[lane] < span.startColumn) {
      laneEnds[lane] = span.endColumn;
      return lane;
    }
  }
  laneEnds.push(span.endColumn);
  return laneEnds.length - 1;
}

/* --------------------------------------------------------------- guards -- */

function assertColumns(columnDates: readonly string[]): void {
  if (columnDates.length === 0) {
    throw new Error("layout needs at least one column date");
  }
  for (let index = 1; index < columnDates.length; index += 1) {
    // diffDays also rejects malformed dates for us.
    if (diffDays(columnDates[index - 1], columnDates[index]) !== 1) {
      throw new Error(
        `column dates must be consecutive: "${columnDates[index - 1]}" → "${columnDates[index]}"`,
      );
    }
  }
}

function assertMetrics(metrics: LayoutMetrics): void {
  assertPositive("columnWidth", metrics.columnWidth);
  assertPositive("pxPerMinute", metrics.pxPerMinute);
  assertPositive("titleLineHeight", metrics.titleLineHeight);
  if (!Number.isFinite(metrics.blockPaddingY) || metrics.blockPaddingY < 0) {
    throw new Error(`layout metric "blockPaddingY" must be ≥ 0, got ${metrics.blockPaddingY}`);
  }
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`layout metric "${name}" must be a positive finite number, got ${value}`);
  }
}
