"use client";

import { useMemo } from "react";

import { countdownsInForce } from "@/lib/family/countdowns/inforce";
import type { CountdownStatus } from "@/lib/family/countdowns/target";
import { useCountdownEvents } from "@/lib/family/queries";
import type { Event, ShowCountdowns } from "@/lib/family/types";

/**
 * The preview bar's one data path (009 R901): the household's countdown events
 * in, the ones in force out.
 *
 * **It brings its own read** and does not touch the week's. The calendar
 * displays three to seven days; a countdown's whole point is that its day is
 * further off than that, so the week's cache entry cannot answer the question.
 * `useCountdownEvents` is keyed by the household alone, so paging the week
 * costs nothing here — the same shape 008 gave the reminder banner, for the
 * same reason.
 *
 * **Mounting is the `enabled`.** Nothing calls this hook unless the bar is
 * rendered, and the bar is rendered only inside the calendar tab.
 *
 * `todayDate` arrives from the view's anchor, which derives it from the shell's
 * shipped minute store — so the numbers fall at the household's midnight with
 * no clock of this feature's own (FR-904, SC-902), and every device reads the
 * household's day rather than its own.
 */

export interface CalendarPreviewOptions {
  householdId: string;
  /** Household-local today; `null` during server render and first paint. */
  todayDate: string | null;
  zone: string;
  /** The household's one setting (FR-903). */
  showCountdowns: ShowCountdowns;
}

export interface CalendarPreview {
  /** The countdowns the bar should draw, soonest first. Empty draws no bar. */
  countdowns: CountdownStatus[];
}

const NO_EVENTS: Event[] = [];
const NO_COUNTDOWNS: CountdownStatus[] = [];

export function useCalendarPreview({
  householdId,
  todayDate,
  zone,
  showCountdowns,
}: CalendarPreviewOptions): CalendarPreview {
  const events = useCountdownEvents(householdId);
  const rows = events.data ?? NO_EVENTS;

  const countdowns = useMemo(
    () =>
      // No clock yet means no number yet: a countdown computed against the
      // epoch and corrected a moment later is worse than a bar that arrives
      // with the first tick.
      todayDate === null ? NO_COUNTDOWNS : countdownsInForce(rows, todayDate, zone, showCountdowns),
    [rows, todayDate, zone, showCountdowns],
  );

  return { countdowns };
}
