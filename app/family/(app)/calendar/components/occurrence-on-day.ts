import { viewWindowOf } from "@/lib/family/calendar/dates";
import { expandWindow } from "@/lib/family/calendar/expand";
import type { Event } from "@/lib/family/types";

import type { EditTarget } from "./event-drafts";

/**
 * One event, expanded to its occurrence on one named day (009 R909).
 *
 * The countdown list and the search both need this and for the same reason:
 * the day they point at is, by definition, outside the window whose rows
 * `useCalendarEditor` could look an occurrence up in — a countdown's whole
 * point is that its day is far off, and a search's is that the answer is not
 * on screen. Both hold the real event row already, so they build the target
 * rather than asking for one.
 *
 * `null` when the event has gone between the paint and the tap, or when it has
 * no occurrence on that day after all. The caller then says nothing happened
 * rather than opening an empty dialog.
 */
export function occurrenceOnDay(
  events: readonly Event[],
  eventId: string,
  date: string,
  zone: string,
): EditTarget | null {
  const event = events.find((one) => one.id === eventId);
  if (event === undefined) return null;

  const occurrence = expandWindow([event], viewWindowOf(date, 1, zone), zone).find(
    (one) => one.occurrenceDate === date,
  );
  return occurrence === undefined ? null : { occurrence, event };
}
