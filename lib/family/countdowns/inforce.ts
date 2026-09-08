/**
 * Which countdowns the bar shows (009 FR-903, FR-905, FR-910, SC-904).
 *
 * The household's one setting decides how early a countdown starts appearing —
 * Always, 3 months prior, or 1 month prior [VERIFIED](40459070511515). This
 * module is where those three words become numbers, and it is the only place
 * they do.
 *
 * **The windows are DAYS, not calendar months, and that is deliberate.** A
 * month-counted window would mean a different number of days in February than
 * in July, so no test could be written against a fixed boundary and the bar
 * would admit a different set depending on the time of year. 92 days is the
 * longest possible three calendar months and 31 the longest possible one, so
 * the day-counted window is never STRICTER than a month-counted one would
 * be — it errs towards showing a countdown, which is the direction a household
 * that turned one on would want.
 *
 * A past countdown is never in force under any setting: FR-905 takes it off
 * the bar the day after. It keeps its line in the event's own details, because
 * an event that WAS a countdown did not stop having been one.
 *
 * Pure: events, a date, a zone and a setting in; a sorted list out.
 */

import type { Event, ShowCountdowns } from "../types";

import { countdownStatusOf, type CountdownStatus } from "./target";

/**
 * How many days ahead each setting reaches. `null` is Always — no ceiling at
 * all, which is a different thing from a very large number and is spelled as
 * such so no arithmetic pretends otherwise.
 */
const HORIZON_DAYS: Readonly<Record<ShowCountdowns, number | null>> = {
  always: null,
  three_months: 92,
  one_month: 31,
};

/** Whether one already-computed countdown reaches the bar under this setting. */
export function isInForce(status: CountdownStatus, showCountdowns: ShowCountdowns): boolean {
  if (status.state === "past") return false;
  const horizon = HORIZON_DAYS[showCountdowns];
  return horizon === null || status.days <= horizon;
}

/**
 * Every countdown the bar should show, soonest first.
 *
 * Ties break on the event's summary so the order is stable across renders —
 * a bar that reshuffles two same-day countdowns every minute is a bar nobody
 * can read.
 */
export function countdownsInForce(
  events: readonly Event[],
  todayDate: string,
  zone: string,
  showCountdowns: ShowCountdowns,
): CountdownStatus[] {
  const found: CountdownStatus[] = [];
  for (const event of events) {
    const status = countdownStatusOf(event, todayDate, zone);
    if (status !== null && isInForce(status, showCountdowns)) found.push(status);
  }
  return found.sort(soonestFirst);
}

function soonestFirst(a: CountdownStatus, b: CountdownStatus): number {
  if (a.days !== b.days) return a.days - b.days;
  return a.summary.localeCompare(b.summary);
}
