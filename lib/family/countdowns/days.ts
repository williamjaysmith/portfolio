/**
 * How many days away, and what that means (009 R902, FR-902, FR-904, FR-905).
 *
 * Two functions, no clock, no React, no storage. The midnight roll SC-902 asks
 * for is not implemented here and deliberately so: the shell's shipped minute
 * store (`useNow`) already hands the calendar a household-local `todayDate`
 * once a minute, so the number falls on its own the moment that date changes.
 * A countdown-owned interval would be a second clock to get wrong at a
 * daylight-saving boundary, and it would tick while nobody was watching.
 *
 * Both dates are household-local `YYYY-MM-DD`, which is what makes a phone in
 * another timezone read the same number as the wall: the zone is applied once,
 * where `todayDate` is derived, and never again here.
 */

import { diffDays } from "../calendar/dates";

/**
 * Where a countdown is relative to its own day.
 *
 * `today` is a NAME rather than a zero, because the reference says nothing
 * about the day itself and counting down to zero and then into negatives would
 * be worse than either (spec Assumption 5). `past` is what FR-905 takes off
 * the bar the day after.
 */
export type CountdownState = "upcoming" | "today" | "past";

/**
 * Whole household-local days from `todayDate` to `targetDate`: positive ahead,
 * zero today, negative behind.
 *
 * Date subtraction, not hours divided by 24 — a spring-forward day is 23 hours
 * long and a fall-back day is 25, so an instant-based count is off by one for
 * half the year in every zone that observes the change.
 */
export function daysUntil(todayDate: string, targetDate: string): number {
  return diffDays(todayDate, targetDate);
}

/** The same number, named (FR-905). */
export function countdownStateOf(days: number): CountdownState {
  if (days > 0) return "upcoming";
  return days === 0 ? "today" : "past";
}
