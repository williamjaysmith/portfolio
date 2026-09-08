/**
 * One event read as a countdown (009 R903, FR-901, FR-902, FR-905).
 *
 * The composer every countdown surface goes through: the bar's chips, the full
 * list, and the line under an event's own title. It answers three questions at
 * once — is this a countdown at all, which day is it counting towards, and how
 * far away is that — so no surface answers any of them itself.
 *
 * **Which day** is `nextOccurrenceOn`'s answer (009 R903): a one-off's own
 * date, and a repeat's next occurrence, because a repeat has no single day and
 * counting to a series' first occurrence would leave the bar stuck in the past
 * (spec Assumption 2).
 *
 * A repeat with nothing left ahead falls back to its LAST occurrence, so the
 * event's own details can still say the countdown has passed rather than
 * silently showing nothing. The bar never sees that case: `inforce.ts` drops
 * every past countdown (FR-905).
 *
 * Pure: two date strings and a zone in, a plain object out. No clock, no
 * React, no storage.
 */

import { lastOccurrenceBefore, nextOccurrenceOn } from "../calendar/next-occurrence";
import type { Event } from "../types";

import { countdownStateOf, daysUntil, type CountdownState } from "./days";

/** One event, read as a countdown. */
export interface CountdownStatus {
  eventId: string;
  summary: string;
  /** The household-local day it counts towards, `YYYY-MM-DD`. */
  targetDate: string;
  /** Whole days from today: positive ahead, zero today, negative behind. */
  days: number;
  state: CountdownState;
}

/**
 * This event's countdown, or `null` when it is not one — or is one whose day
 * cannot be found within the bounded walk (R903).
 *
 * `todayDate` is household-local and comes from the shell's minute store, which
 * is what makes the number fall at the household's midnight without a reload
 * (FR-904, SC-902) and what makes a phone in another timezone agree with the
 * wall.
 */
export function countdownStatusOf(
  event: Event,
  todayDate: string,
  zone: string,
): CountdownStatus | null {
  if (!event.countdownEnabled) return null;

  const targetDate =
    nextOccurrenceOn(event, todayDate, zone) ?? lastOccurrenceBefore(event, todayDate, zone);
  if (targetDate === null) return null;

  const days = daysUntil(todayDate, targetDate);
  return {
    eventId: event.id,
    summary: event.summary,
    targetDate,
    days,
    state: countdownStateOf(days),
  };
}
