/**
 * When does this event next happen? — the ONE bounded walk (009 R903).
 *
 * Two surfaces ask it and neither owns it. A countdown counts towards its
 * event's next occurrence, because a repeat has no single day and counting to
 * a series' first occurrence would leave the bar stuck in the past
 * (spec Assumption 2). A search result names the day the calendar will move
 * to, for the same reason and by the same rule (FR-916, FR-918).
 *
 * It lives in `family-calendar-core` rather than in the countdown zone
 * deliberately: "when does this next happen" is a question about a calendar,
 * which a countdown reads — not a question about a countdown, which a calendar
 * would then have to depend on countdowns to answer.
 *
 * It is built on `expandWindow` and not on `ruleDatesIn`, so it inherits the
 * shipped reading of every hard part for free: skipped occurrences do not
 * count, a moved occurrence moves, `UNTIL` is a household-local comparison,
 * and the daylight-saving gap and fold policies are the calendar's own. A
 * second walk over the grammar would be a second place for those to drift.
 *
 * **The walk is bounded and the bound is exported.** `ruleDatesIn` steps a day
 * at a time, so an unbounded search for a rule with no future match would not
 * terminate. `LOOKAHEAD_DAYS` clears a full year with a month of slack, which
 * covers every repeat this project's grammar can express — daily, weekly and
 * monthly. A repeat with nothing inside that window is not something a
 * household is counting down to, and it simply leaves the bar.
 */

import type { Event } from "../types";

import { addDays, viewWindowOf } from "./dates";
import { expandWindow } from "./expand";

/**
 * How far either walk looks. A named export, so the tests bind this number
 * rather than guessing 400 and the bound has exactly one definition.
 */
export const LOOKAHEAD_DAYS = 400;

/**
 * The household-local date this event next falls on, on or after `fromDate` —
 * or `null` if it does not, within `LOOKAHEAD_DAYS`.
 *
 * A one-off answers with its own date when that date is not past. A repeat
 * answers with its first occurrence in the window, skips excluded.
 */
export function nextOccurrenceOn(event: Event, fromDate: string, zone: string): string | null {
  return firstDateOf(event, fromDate, zone);
}

/**
 * The household-local date this event LAST fell on, strictly before
 * `fromDate` — or `null` if it has not happened yet.
 *
 * A search answers with this when a repeat's occurrences are all in the past:
 * something that has finished still deserves an answer rather than vanishing
 * from the results (R908).
 */
export function lastOccurrenceBefore(event: Event, fromDate: string, zone: string): string | null {
  const start = addDays(fromDate, -LOOKAHEAD_DAYS);
  const dates = datesIn(event, start, LOOKAHEAD_DAYS, zone).filter((date) => date < fromDate);
  return dates.length === 0 ? null : dates[dates.length - 1];
}

function firstDateOf(event: Event, fromDate: string, zone: string): string | null {
  // +1 so the window is inclusive of the day LOOKAHEAD_DAYS away, which is
  // what the bound's own test asserts.
  const dates = datesIn(event, fromDate, LOOKAHEAD_DAYS + 1, zone);
  return dates.length === 0 ? null : dates[0];
}

/**
 * The event's occurrence dates inside one window, ascending and de-duplicated.
 *
 * `expandWindow` emits one occurrence per day a series falls on, already
 * sorted by original date; a multi-day event contributes its start date once,
 * which is the date both callers want.
 */
function datesIn(event: Event, startDate: string, days: number, zone: string): string[] {
  const window = viewWindowOf(startDate, days, zone);
  const seen = new Set<string>();
  for (const occurrence of expandWindow([event], window, zone)) seen.add(occurrence.occurrenceDate);
  return [...seen].sort();
}
