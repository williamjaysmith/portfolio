"use client";

import { useMemo } from "react";

import { fetchBoundsOf, viewWindowOf, type DateWindow } from "@/lib/family/calendar/dates";
import { expandWindow } from "@/lib/family/calendar/expand";
import {
  cellFillFor,
  monthGridLength,
  monthGridStart,
  monthRows,
  spanSegmentsOf,
  timedByDay,
  type SpanSegment,
} from "@/lib/family/calendar/month";
import { visibleOccurrences } from "@/lib/family/calendar/visibility";
import { useWeekEvents } from "@/lib/family/queries";
import type { Event, Occurrence, WeekStart } from "@/lib/family/types";

import { useDeviceVisibility } from "../../components/useDeviceVisibility";

/**
 * The month's data path (011 R1105), and it is deliberately the week's own
 * three top layers with a fourth of its own:
 *
 *   fetch (`useWeekEvents`) → `expandWindow` → `visibleOccurrences` → PLACEMENT
 *
 * The first three are byte-for-byte the week's concerns, because **a month
 * window is still a run of consecutive days**: 28, 35 or 42 of them beginning
 * on the household's own start-of-week. Nothing about the read or the
 * expansion knows a month exists, which is the whole reason this phase adds no
 * query and no migration.
 *
 * What is new is only the last layer. The week's is `layoutWeek`, which places
 * rectangles on a minute axis; a month cell has no minute axis, so placement
 * here is "which day does this belong to, and how many did not fit" — the pure
 * arithmetic in `lib/family/calendar/month.ts`.
 *
 * **All-day occurrences are counted once, as spans.** They are drawn across
 * their days by `spanSegmentsOf` and are excluded from the per-day timed lists,
 * so a cell's overflow count never double-counts an event that is already
 * drawn through it.
 *
 * No prefetch of neighbouring months. The week warms its neighbours because a
 * swipe flicks through them; a month is reached by a deliberate tap on an
 * arrow, and warming twelve months' events to save one fetch is not a trade
 * this household's data size justifies.
 */

const NO_OCCURRENCES: Occurrence[] = [];
const NO_EVENTS: Event[] = [];

export interface UseMonthOccurrencesOptions {
  householdId: string;
  /** Any day in the month being shown — the grid derives its own first day. */
  anchorDate: string;
  zone: string;
  startWeekOn: WeekStart;
  /** The server-fetched rows, when the seeded window is this one. */
  initialData?: Event[];
}

/** One day cell, ready to draw. */
export interface MonthCellModel {
  date: string;
  /** False for the leading and trailing days that belong to a neighbour. */
  inMonth: boolean;
  /** This day's timed occurrences, in start order — the ones a cell lists. */
  timed: Occurrence[];
  /** How many of them are shown, and how many are not (FR-1110). */
  shown: number;
  hidden: number;
  /** Every occurrence of the day, spans included — what "+ More" opens. */
  all: Occurrence[];
}

export interface MonthOccurrencesState {
  window: DateWindow;
  /** The rows the grid drew from — what a caller needs to build a details target. */
  events: Event[];
  /** The grid's week rows, each a run of seven cells. */
  rows: MonthCellModel[][];
  /** Multi-day bars, already cut per week row (FR-1112). */
  segments: SpanSegment[];
  isPending: boolean;
  error: Error | null;
}

export function useMonthOccurrences(
  options: UseMonthOccurrencesOptions,
): MonthOccurrencesState {
  const { householdId, anchorDate, zone, startWeekOn, initialData } = options;

  const monthWindow = useMemo(() => {
    const start = monthGridStart(anchorDate, startWeekOn);
    return viewWindowOf(start, monthGridLength(anchorDate, startWeekOn), zone);
  }, [anchorDate, startWeekOn, zone]);

  const bounds = useMemo(() => fetchBoundsOf(monthWindow), [monthWindow]);
  const events = useWeekEvents(householdId, bounds, initialData);

  const expanded = useMemo(
    () => (events.data === undefined ? NO_OCCURRENCES : expandWindow(events.data, monthWindow, zone)),
    [events.data, monthWindow, zone],
  );

  // Its own layer, exactly as the week's is: toggling a Profile re-filters
  // without re-expanding (FR-265).
  const { hiddenIds } = useDeviceVisibility();
  const visible = useMemo(
    () => visibleOccurrences(expanded, hiddenIds),
    [expanded, hiddenIds],
  );

  const placed = useMemo(
    () => placeMonth(visible, monthWindow, anchorDate),
    [visible, monthWindow, anchorDate],
  );

  return {
    window: monthWindow,
    events: events.data ?? NO_EVENTS,
    rows: placed.rows,
    segments: placed.segments,
    isPending: events.isPending,
    error: events.error,
  };
}

/**
 * The placement layer, pure and exported for its own test: occurrences and a
 * window in, drawable rows and bars out.
 */
export function placeMonth(
  occurrences: readonly Occurrence[],
  monthWindow: DateWindow,
  monthOf: string,
): { rows: MonthCellModel[][]; segments: SpanSegment[] } {
  const length = lengthOf(monthWindow);
  const timed = timedByDay(occurrences);

  const segments = occurrences.flatMap((occurrence) =>
    spanSegmentsOf(occurrence, monthWindow.startDate, length),
  );

  const spansByDay = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    if (!occurrence.times.allDay) continue;
    for (const date of daysOf(occurrence, monthWindow, length)) {
      const day = spansByDay.get(date);
      if (day === undefined) spansByDay.set(date, [occurrence]);
      else day.push(occurrence);
    }
  }

  const rows = monthRows(monthWindow.startDate, length).map((row) =>
    row.map((date) => {
      const dayTimed = timed.get(date) ?? [];
      const fill = cellFillFor(dayTimed.length);
      return {
        date,
        inMonth: date.slice(0, 7) === monthOf.slice(0, 7),
        timed: dayTimed,
        shown: fill.shown,
        hidden: fill.hidden,
        // The full list a "+ More" opens shows the day's spans too: somebody
        // asking what is on a day means all of it, not only the timed half.
        all: [...(spansByDay.get(date) ?? []), ...dayTimed],
      };
    }),
  );

  return { rows, segments };
}

/** The days of the grid an all-day occurrence covers, clamped to it. */
function daysOf(
  occurrence: Occurrence,
  monthWindow: DateWindow,
  length: number,
): string[] {
  return spanSegmentsOf(occurrence, monthWindow.startDate, length).flatMap((segment) => {
    const rowStart = segment.row * 7;
    return Array.from({ length: segment.endColumn - segment.startColumn + 1 }, (_unused, offset) =>
      dayAt(monthWindow.startDate, rowStart + segment.startColumn + offset),
    );
  });
}

function dayAt(startDate: string, index: number): string {
  const day = new Date(`${startDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + index);
  return day.toISOString().slice(0, 10);
}

function lengthOf(monthWindow: DateWindow): number {
  const start = new Date(`${monthWindow.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${monthWindow.endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}
