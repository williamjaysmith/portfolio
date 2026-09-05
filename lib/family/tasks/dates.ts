/**
 * The tasks board's date vocabulary: the carry-forward bound, the two windows
 * derived from it, the due instant and the time-of-day window.
 *
 * `CARRY_FORWARD_DAYS` is declared HERE and nowhere else, and is consumed by
 * both the read that fetches the carry tail (`queries.ts`) and the render pass
 * that places carried occurrences (`expand.ts`), so the two bounds are the same
 * number by construction (FR-357, R316).
 *
 * Zone policy is inherited, never reimplemented: `dueInstantOf` composes the
 * shipped `wallToInstant`, so FR-326's gap rule (a time that does not exist
 * lands on the first valid time that date) and fold rule (a time that happens
 * twice takes the first instant) are Phase 2's, unchanged.
 *
 * Framework-free and pure: no React, no storage, no clock.
 */

import { addDays, wallMinutesOf, weekStartOf } from "../calendar/dates";
import type { LocalDateRange } from "../recurrence/expand";
import { datePartsOf, epochDayOf } from "../recurrence/plain-date";
import { wallToInstant } from "../recurrence/zone";
import type { TimeOfDay, WeekStart } from "../types";

/**
 * FR-357's bound. An occurrence scheduled 27 days ago is still carried onto
 * today; one scheduled 28 days ago has stopped ("28 days after its scheduled
 * date" is the day it stops, not the last day it appears).
 */
export const CARRY_FORWARD_DAYS = 28;

/** Noon and 18:00 as minutes past the household zone's midnight (FR-306). */
const AFTERNOON_FROM = 12 * 60;
const EVENING_FROM = 18 * 60;

const WALL_CLOCK = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/**
 * FR-357 as arithmetic rather than as a range, because the range form is what
 * produced a day-28 disagreement between the plan and its own fixture. A
 * future or same-day occurrence is trivially inside the bound — the pass that
 * calls this only ever offers it past days.
 */
export function withinCarryBound(scheduledDate: string, todayDate: string): boolean {
  return epochDayOf(todayDate) - epochDayOf(scheduledDate) < CARRY_FORWARD_DAYS;
}

/** The past days the carry pass walks: the closed form of the bound above. */
export function carryWalkRangeOf(todayDate: string): LocalDateRange {
  return {
    start: addDays(todayDate, -(CARRY_FORWARD_DAYS - 1)),
    end: addDays(todayDate, -1),
  };
}

/**
 * The resolution rows the carry pass needs, disjoint from the anchored week's
 * own read (R314 read 3). It reaches one day FURTHER back than the pass walks:
 * the pass must know the day-28 occurrence is resolved before it declines to
 * carry it, and one extra day of rows costs nothing.
 */
export function carryReadWindowOf(
  todayDate: string,
  startWeekOn: WeekStart,
): { startDate: string; endDate: string } {
  return {
    startDate: addDays(todayDate, -CARRY_FORWARD_DAYS),
    endDate: addDays(weekStartOf(todayDate, startWeekOn), -1),
  };
}

/**
 * The instant a chore's due time falls at on a date, in the household zone
 * (FR-326). `time` is a wall clock `HH:MM`; an instant is never stored, so
 * this is the only place one is made.
 */
export function dueInstantOf(date: string, time: string, zone: string): number {
  const match = WALL_CLOCK.exec(time);
  if (!match) throw new Error(`"${time}" is not an HH:MM household wall clock`);
  const parts = datePartsOf(epochDayOf(date));
  return wallToInstant(zone, {
    ...parts,
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: 0,
  });
}

/**
 * Which time-of-day window an instant falls in, read in the household zone:
 * midnight–noon Morning, noon–18:00 Afternoon, 18:00–midnight Evening
 * (FR-306). Each boundary belongs to the later window.
 */
export function timeOfDayAt(zone: string, instantMs: number): TimeOfDay {
  const minutes = wallMinutesOf(zone, instantMs);
  if (minutes < AFTERNOON_FROM) return "morning";
  return minutes < EVENING_FROM ? "afternoon" : "evening";
}
