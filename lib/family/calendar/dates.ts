/**
 * View anchoring and plain-date maths for the calendar (FR-203, R207/R210),
 * worked in the HOUSEHOLD's zone — anchoring converts the instant through
 * `zone.ts` first; nothing here reimplements zone policy.
 *
 * The displayed view is a ROLLING WINDOW: `anchorDate` is its leftmost day and
 * the column count is its width, so a page moves the anchor by exactly that
 * many days. There is no seven-day box to tile into slices — with the anchor
 * rolling on today (`START_ON_CURRENT_DAY`) such a box would skip the days a
 * short window steps over and repeat those a pulled-back last slice covered
 * twice. `weekStartOf` survives for the settings toggle's off branch and for
 * the Month view a later phase adds.
 *
 * `viewWindowOf` derives the one fetch/expansion window per displayed window:
 * inclusive local dates for all-day comparisons, half-open instants
 * [startMs, endMs) for timed ones (R206's three-branch read). It spans exactly
 * the days the grid draws, so the fetch can never be narrower than the view.
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

/** A run of household-local days as the read and the expander consume it (R206/R207). */
export interface DateWindow {
  /** Inclusive household-local first day, `YYYY-MM-DD`. */
  startDate: string;
  /** Inclusive household-local last day. */
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

/**
 * Skylight's "Start on current day" (36835449004315), which overrides the
 * start-of-week preference for the Week view and makes today the leftmost
 * column. Held on and in code for this phase, like the other calendar toggles
 * (spec 002 Assumption 16): a wall calendar whose first five columns are
 * already spent is showing the household the past.
 *
 * `startWeekOn` still decides the anchor when this is off, and still governs
 * the views a later phase adds — which is why the branch stays rather than the
 * snap being deleted.
 */
export const START_ON_CURRENT_DAY = true;

/** The leftmost day of the window a date is shown in. */
export function weekAnchorOf(
  date: string,
  startWeekOn: WeekStart,
  startOnCurrentDay: boolean = START_ON_CURRENT_DAY,
): string {
  return startOnCurrentDay ? date : weekStartOf(date, startWeekOn);
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
 * The window's instant bounds as the ISO strings PostgREST compares against
 * (`lib/family/queries.ts` — the timed branch of the week read).
 */
export function fetchBoundsOf(window: DateWindow): {
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

/**
 * The displayed window's fetch/expansion window (see `DateWindow`): `days`
 * consecutive household-local days from `anchorDate`. `days` is the grid's
 * measured column count, so what is fetched and expanded is exactly what is
 * drawn — never less.
 */
export function viewWindowOf(anchorDate: string, days: number, zone: string): DateWindow {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`a window spans a whole number of days, not ${days}`);
  }
  return {
    startDate: anchorDate,
    endDate: addDays(anchorDate, days - 1),
    startMs: zoneMidnightMs(zone, anchorDate),
    endMs: zoneMidnightMs(zone, addDays(anchorDate, days)),
  };
}

/** The instant of a household-local date's 00:00 — one derivation, one DST reading. */
export function zoneMidnightMs(zone: string, date: string): number {
  const parts = datePartsOf(epochDayOf(date));
  return wallToInstant(zone, { ...parts, hour: 0, minute: 0, second: 0 });
}

/* ------------------------------------------------------------ wall time -- */

const wallFormatters = new Map<string, Intl.DateTimeFormat>();

function wallFormatterFor(zone: string): Intl.DateTimeFormat {
  const cached = wallFormatters.get(zone);
  if (cached) return cached;
  // h23 pins midnight to "00"; construction is the expensive part, cache it.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  wallFormatters.set(zone, formatter);
  return formatter;
}

/**
 * Wall-clock minutes since the zone's midnight at a UTC instant. A plain
 * instant→wall READ — every instant has exactly one reading, so no DST policy
 * is exercised here; zone POLICY (wall→instant, gap and fold) stays in
 * `recurrence/zone.ts`.
 *
 * One implementation on purpose: the hour grid, the now line and the FR-290
 * follow-scroll all place the same minute, and two conversions could disagree
 * by a minute — a calendar that is wrong is worse than one that is absent.
 */
export function wallMinutesOf(zone: string, instantMs: number): number {
  const text = wallFormatterFor(zone).format(instantMs); // "HH:MM"
  return Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
}
