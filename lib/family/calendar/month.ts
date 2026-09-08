/**
 * The month grid's pure arithmetic (011 R1105, R1107, R1108, R1109).
 *
 * Everything the Month view decides that is not a pixel: which days the grid
 * covers, how they fall into week rows, which events a cell shows and how many
 * it hides, and how a multi-day event becomes drawable segments.
 *
 * It is separate from `layout.ts` for a reason worth stating. That module is a
 * week-shaped hour grid end to end — its scale is pixels per minute over a
 * 1440-minute column, its overflow is a time band, and its side-by-side rule is
 * keyed to a column width. A month cell has no minute axis, so none of it
 * transfers (R1104). This is the replacement, and it is deliberately smaller:
 * a month draws days, not durations.
 *
 * Framework-free and pure: dates and occurrences in, plain values out. No
 * clock, no React, no storage, no measurement.
 */

import type { Occurrence, WeekStart } from "../types";

import { addDays, diffDays, weekStartOf } from "./dates";

/** Whole weeks, so a grid row is always seven days. Internal: a caller reads
 *  a row's length from `monthRows`, which is the only shape that matters. */
const DAYS_PER_WEEK = 7;

/**
 * A cell's capacity, and its behaviour past it, exactly as documented
 * [VERIFIED](48026687853083): three events fit; at four or more the cell shows
 * two and says how many more there are.
 */
export const CELL_CAPACITY = 3;

/** What a cell falls back to once it cannot show everything. Internal: the
 *  step from three to two is `cellFillFor`'s to make, not a caller's. */
const CELL_SHOWN_WHEN_OVER = 2;

/** The first day of the grid containing `date` — the household's own week start. */
export function monthGridStart(date: string, startWeekOn: WeekStart): string {
  return weekStartOf(firstOfMonth(date), startWeekOn);
}

/**
 * How many days the grid covers: whichever whole number of weeks holds the
 * month (R1107) — so 28, 35 or 42.
 *
 * Six rows when the month needs six: a fixed six wastes a row in most months,
 * and a fixed five is simply wrong for a 31-day month that starts late in the
 * week.
 *
 * **And four rows when four is the truth.** A non-leap February beginning
 * exactly on the household's start-of-week is four whole weeks and nothing
 * more — it happens roughly once every seven years per start-of-week setting.
 * Padding it to five would draw a row of somebody else's month for no reason;
 * on a wall display the taller cells are the better outcome, not the worse
 * one. The reference says only "standard calendar format" and sets no minimum,
 * so this is the smallest true answer rather than an invented floor.
 */
export function monthGridLength(date: string, startWeekOn: WeekStart): number {
  const start = monthGridStart(date, startWeekOn);
  const lastDay = lastOfMonth(date);
  const span = diffDays(start, lastDay) + 1;
  return Math.ceil(span / DAYS_PER_WEEK) * DAYS_PER_WEEK;
}

/** The grid's days as week rows, in order. */
export function monthRows(startDate: string, length: number): string[][] {
  const rows: string[][] = [];
  for (let index = 0; index < length; index += DAYS_PER_WEEK) {
    rows.push(
      Array.from({ length: DAYS_PER_WEEK }, (_unused, offset) => addDays(startDate, index + offset)),
    );
  }
  return rows;
}

/** Whether a grid day belongs to the month being shown, or to a neighbour. */
export function isInMonth(date: string, monthOf: string): boolean {
  return date.slice(0, 7) === monthOf.slice(0, 7);
}

/**
 * What a cell shows and what it hides (R1108).
 *
 * `3 → 3 shown, 0 hidden`; `4 → 2 shown, 2 hidden`; `9 → 2 shown, 7 hidden`.
 * The step down from three to two at the boundary is the documented behaviour
 * and is the reason this is a function rather than a `slice` at the call site.
 */
export interface CellFill {
  shown: number;
  hidden: number;
}

export function cellFillFor(total: number): CellFill {
  if (total <= CELL_CAPACITY) return { shown: Math.max(0, total), hidden: 0 };
  return { shown: CELL_SHOWN_WHEN_OVER, hidden: total - CELL_SHOWN_WHEN_OVER };
}

/**
 * One drawable piece of a multi-day event, on one week row (R1109).
 *
 * The reference says a multi-day event is "a single connected bar"
 * [VERIFIED](44738510847259, 36625171368987). A grid that wraps cannot draw one
 * rectangle across a row break, so a span becomes one segment per row it
 * crosses — each knowing whether the event continues past the row's edge, so
 * the household can see it is part of something longer (spec Assumption 4).
 */
export interface SpanSegment {
  eventId: string;
  occurrenceDate: string;
  summary: string;
  /** Which week row, 0-based. */
  row: number;
  /** First and last column of this segment within its row, 0-6 inclusive. */
  startColumn: number;
  endColumn: number;
  /** The event begins before this row's first day. */
  continuesLeft: boolean;
  /** The event ends after this row's last day. */
  continuesRight: boolean;
}

/**
 * Cut one all-day occurrence's date range into the segments the grid draws.
 *
 * Returns nothing at all when the span misses the grid entirely, and clamps to
 * the grid's own edges when it runs past them — a January event shown on a
 * February grid is drawn from the grid's first day, marked as continuing.
 */
export function spanSegmentsOf(
  occurrence: Occurrence,
  gridStart: string,
  length: number,
): SpanSegment[] {
  if (!occurrence.times.allDay) return [];

  const gridEnd = addDays(gridStart, length - 1);
  const from = occurrence.times.startDate;
  const to = occurrence.times.endDate;
  if (to < gridStart || from > gridEnd) return [];

  const firstIndex = Math.max(0, diffDays(gridStart, from));
  const lastIndex = Math.min(length - 1, diffDays(gridStart, to));

  const segments: SpanSegment[] = [];
  for (let index = firstIndex; index <= lastIndex; ) {
    const row = Math.floor(index / DAYS_PER_WEEK);
    const rowLastIndex = row * DAYS_PER_WEEK + (DAYS_PER_WEEK - 1);
    const endIndex = Math.min(lastIndex, rowLastIndex);

    segments.push({
      eventId: occurrence.eventId,
      occurrenceDate: occurrence.occurrenceDate,
      summary: occurrence.summary,
      row,
      startColumn: index - row * DAYS_PER_WEEK,
      endColumn: endIndex - row * DAYS_PER_WEEK,
      // Continuation is about the EVENT, not about the grid's clamping: an
      // event that starts before the grid continues left on the first row too.
      continuesLeft: from < addDays(gridStart, row * DAYS_PER_WEEK),
      continuesRight: to > addDays(gridStart, endIndex),
    });
    index = endIndex + 1;
  }
  return segments;
}

/**
 * The timed occurrences of each grid day, in start order.
 *
 * All-day occurrences are excluded: they are drawn as spans by
 * `spanSegmentsOf`, and counting them twice would make every cell's overflow
 * number wrong.
 */
export function timedByDay(
  occurrences: readonly Occurrence[],
): ReadonlyMap<string, Occurrence[]> {
  const byDay = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    if (occurrence.times.allDay) continue;
    const day = byDay.get(occurrence.occurrenceDate);
    if (day === undefined) byDay.set(occurrence.occurrenceDate, [occurrence]);
    else day.push(occurrence);
  }
  for (const day of byDay.values()) day.sort(byStart);
  return byDay;
}

function byStart(a: Occurrence, b: Occurrence): number {
  const aStart = a.times.allDay ? "" : a.times.startsAt;
  const bStart = b.times.allDay ? "" : b.times.startsAt;
  if (aStart !== bStart) return aStart < bStart ? -1 : 1;
  return a.summary.localeCompare(b.summary);
}

function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function lastOfMonth(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const days = month === 2 ? (isLeap(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  return `${date.slice(0, 7)}-${String(days).padStart(2, "0")}`;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
