/**
 * Week anchoring and plain-date maths for the calendar (FR-203, FR-289,
 * R207/R210). The displayed week is the one starting on the household's
 * start-of-week day in the HOUSEHOLD's zone — so anchoring converts the
 * instant through `zone.ts` first; nothing here reimplements zone policy.
 *
 * `sliceStarts` is FR-289's tiling table: slices of `columns` days tiled from
 * the week's first day, the LAST slice pulled back so it ends on the week's
 * last day while still showing a full set of columns.
 *
 * `weekWindowOf` derives the one fetch/expansion window per anchored week:
 * inclusive local dates for all-day comparisons, half-open instants
 * [startMs, endMs) for timed ones (R206's three-branch read).
 */

import { instantToWall, wallToInstant } from "../recurrence/zone";
import {
  DAY_MS,
  datePartsOf,
  epochDayOf,
  isoOfEpochDay,
  weekdayIndexOf,
} from "../recurrence/plain-date";
import type { WeekStart } from "../types";

/** The anchored week as the read and the expander consume it (R206/R207). */
export interface WeekWindow {
  /** Inclusive household-local first day, `YYYY-MM-DD`. */
  startDate: string;
  /** Inclusive household-local last day — `startDate` + 6. */
  endDate: string;
  /** Instant of `startDate` 00:00 in the household zone (epoch ms). */
  startMs: number;
  /** Instant of the day AFTER `endDate`, 00:00 household zone — exclusive. */
  endMs: number;
}

/** The zone's plain date (`YYYY-MM-DD`) at a UTC instant. */
export function localDateOf(zone: string, instantMs: number): string {
  const wall = instantToWall(zone, instantMs);
  return isoOfEpochDay(Date.UTC(wall.year, wall.month - 1, wall.day) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error(`cannot add ${days} days — whole days only`);
  return isoOfEpochDay(epochDayOf(date) + days);
}

/** Signed day count from `from` to `to`. */
export function diffDays(from: string, to: string): number {
  return epochDayOf(to) - epochDayOf(from);
}

/** The `YYYY-MM-DD` of the week containing `date`, per the household start-of-week. */
export function weekStartOf(date: string, startWeekOn: WeekStart): string {
  const day = epochDayOf(date);
  return isoOfEpochDay(day - ((weekdayIndexOf(day) - startWeekOn + 7) % 7));
}

/** Week anchoring in a named zone: the instant's LOCAL date decides the week. */
export function weekStartFor(zone: string, instantMs: number, startWeekOn: WeekStart): string {
  return weekStartOf(localDateOf(zone, instantMs), startWeekOn);
}

/**
 * Day offsets (0–6) where each slice of a `columns`-day view starts (FR-289):
 * tiled from day 0, last slice pulled back to end on day 6. One slice at 7.
 */
export function sliceStarts(columns: number): number[] {
  if (!Number.isInteger(columns) || columns < 1 || columns > 7) {
    throw new Error(`a week slices into 1–7 columns, not ${columns}`);
  }
  const starts: number[] = [];
  for (let start = 0; start + columns < 7; start += columns) starts.push(start);
  starts.push(7 - columns);
  return starts;
}

/** The anchored week's fetch/expansion window (see `WeekWindow`). */
/**
 * The window's instant bounds as the ISO strings PostgREST compares against
 * (`lib/family/queries.ts` — the timed branch of the week read).
 */
export function fetchBoundsOf(window: WeekWindow): {
  startDate: string;
  endDate: string;
  startsAt: string;
  endsAt: string;
} {
  return {
    startDate: window.startDate,
    endDate: window.endDate,
    startsAt: new Date(window.startMs).toISOString(),
    endsAt: new Date(window.endMs).toISOString(),
  };
}

export function weekWindowOf(weekStart: string, zone: string): WeekWindow {
  return {
    startDate: weekStart,
    endDate: addDays(weekStart, 6),
    startMs: midnightMs(zone, weekStart),
    endMs: midnightMs(zone, addDays(weekStart, 7)),
  };
}

function midnightMs(zone: string, date: string): number {
  const parts = datePartsOf(epochDayOf(date));
  return wallToInstant(zone, { ...parts, hour: 0, minute: 0, second: 0 });
}
