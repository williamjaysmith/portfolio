/**
 * Search results, shaped (009 FR-915, FR-916, FR-917, FR-918, R908).
 *
 * The query returns EVENTS. This turns each into the one thing the household
 * needs to act on: the title they were looking for, and the day the calendar
 * will move to if they choose it.
 *
 * **One row per event, never one per occurrence** (FR-918). A weekly swim
 * lesson is one result. That is not a de-duplication step here — it falls out
 * of searching the events table rather than an expansion — but it is the
 * property the test pins, because an implementation that expanded first would
 * pass every other assertion and flood the household with fifty identical rows.
 *
 * **Which day**: the next occurrence on or after today, by the same bounded
 * walk a countdown's target uses. A repeat whose occurrences are all behind
 * shows its LAST one — something that has finished still deserves an answer
 * rather than vanishing, because "when was the school thing" is exactly the
 * question somebody asks about a thing that has happened.
 *
 * Pure: rows, a date and a zone in; a sorted list out.
 */

import type { Event } from "../types";

import { lastOccurrenceBefore, nextOccurrenceOn } from "./next-occurrence";

/** One row of results. */
export interface EventSearchResult {
  eventId: string;
  summary: string;
  /** The household-local day choosing this result takes the calendar to. */
  onDate: string;
  /** Whether that day is behind — what lets the row say so. */
  isPast: boolean;
  /** Whether the event repeats, so a row can say "every Thursday" rather than a date alone. */
  isRepeating: boolean;
}

/**
 * The matching events as results, soonest first.
 *
 * Events with no findable day at all — a repeat with nothing inside the walk in
 * either direction — are dropped: a result the calendar cannot navigate to is
 * not a result.
 */
export function searchResultsOf(
  events: readonly Event[],
  todayDate: string,
  zone: string,
): EventSearchResult[] {
  const results: EventSearchResult[] = [];
  for (const event of events) {
    const next = nextOccurrenceOn(event, todayDate, zone);
    const onDate = next ?? lastOccurrenceBefore(event, todayDate, zone);
    if (onDate === null) continue;
    results.push({
      eventId: event.id,
      summary: event.summary,
      onDate,
      isPast: next === null,
      isRepeating: event.rrule !== null,
    });
  }
  return results.sort(soonestFirst);
}

/**
 * Upcoming before past, then by date, then by title.
 *
 * Upcoming first because "when is the school thing" is asked far more often
 * than "when was it", and within each group by date so the nearest answer is at
 * the top. Past rows run BACKWARDS from today — the most recent first — for the
 * same reason.
 */
function soonestFirst(a: EventSearchResult, b: EventSearchResult): number {
  if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
  if (a.onDate !== b.onDate) {
    const order = a.onDate < b.onDate ? -1 : 1;
    return a.isPast ? -order : order;
  }
  return a.summary.localeCompare(b.summary);
}
