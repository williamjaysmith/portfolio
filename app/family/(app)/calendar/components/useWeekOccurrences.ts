"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { addDays, fetchBoundsOf, weekWindowOf, type WeekWindow } from "@/lib/family/calendar/dates";
import { expandWindow } from "@/lib/family/calendar/expand";
import { layoutWeek, type LayoutMetrics, type WeekLayout } from "@/lib/family/calendar/layout";
import { prefetchWeek, useWeekEvents, type WeekFetchBounds } from "@/lib/family/queries";
import type { Event, Occurrence } from "@/lib/family/types";

/**
 * T028: the one data path from the anchored week to drawn rectangles, as a
 * MEMO CHAIN whose layers invalidate independently (R206):
 *
 *   fetch (`useWeekEvents`, cache key = the anchored week, R207)
 *     → `expandWindow`  — ONCE per mounted week; only new data or a new
 *                         week re-runs it
 *     → visibility      — its own pass-through layer today; T061 slots
 *                         `isEventVisible` here (FR-265/267) so a filter
 *                         toggle re-filters WITHOUT re-expanding
 *     → `layoutWeek`    — per visible slice and measured metrics; a swipe
 *                         or rotation re-layouts without touching the
 *                         layers above
 *
 * Expansion and layout are both worked in the household's zone (FR-219);
 * geometry waits on the grid's first measurement (`metrics: null` →
 * `layout: null`) while expansion never does — the week's occurrences exist
 * before the DOM has a size.
 *
 * The hook also warms the two neighbour weeks once the anchor SETTLES
 * (R207): a short delay filters out the weeks flicked past while paging, and
 * React Query dedupes whatever remains. Same-week slice swipes cost zero
 * fetches by construction — the cache unit is the week.
 */

/** How long a week must stay mounted before its neighbours are prefetched. */
const PREFETCH_SETTLE_MS = 250;

const NO_OCCURRENCES: Occurrence[] = [];

export interface UseWeekOccurrencesOptions {
  householdId: string;
  /** The anchored week's first day, `YYYY-MM-DD` in the household zone (R207). */
  weekStart: string;
  /** Household IANA zone (FR-284) — every expansion and layout works in it. */
  zone: string;
  /**
   * Day offset (0–6) where the visible slice begins —
   * `sliceStarts(columns)[sliceIndex]` from the anchor state (FR-289).
   */
  sliceStart: number;
  /** Visible day columns (FR-277/278) — `useGridGeometry().columnCount`. */
  columns: number;
  /** Measured layout inputs; `null` until the grid has measured (T027). */
  metrics: LayoutMetrics | null;
  /** The server-fetched current week, for a no-flicker first paint (R207). */
  initialData?: Event[];
}

export interface WeekOccurrencesState {
  /** The WHOLE anchored week, expanded once and visibility-filtered. */
  occurrences: Occurrence[];
  /** The visible slice's consecutive household-local dates, `columns` long. */
  columnDates: string[];
  /** Rectangles for the visible slice; `null` until `metrics` arrive. */
  layout: WeekLayout | null;
  /** True while the week's FIRST fetch is still in flight. */
  isPending: boolean;
  error: Error | null;
}

export function useWeekOccurrences(options: UseWeekOccurrencesOptions): WeekOccurrencesState {
  const { householdId, weekStart, zone, sliceStart, columns, metrics, initialData } = options;

  const weekWindow = useMemo(() => weekWindowOf(weekStart, zone), [weekStart, zone]);
  const fetchWindow = useMemo(() => toFetchWindow(weekWindow), [weekWindow]);
  const { data, isPending, error } = useWeekEvents(householdId, fetchWindow, initialData);

  const expanded = useMemo(
    () => (data === undefined ? NO_OCCURRENCES : expandWindow(data, weekWindow, zone)),
    [data, weekWindow, zone],
  );

  // The visibility seam (R206): T061 replaces `visibleOf` with the
  // FR-265 filter over the device's hidden categories — display-only by
  // construction (FR-267), and a separate layer so it can never re-expand.
  const occurrences = useMemo(() => visibleOf(expanded), [expanded]);

  const columnDates = useMemo(
    () => columnDatesOf(weekStart, sliceStart, columns),
    [weekStart, sliceStart, columns],
  );

  const layout = useMemo(
    () => (metrics === null ? null : layoutWeek(occurrences, columnDates, zone, metrics)),
    [occurrences, columnDates, zone, metrics],
  );

  const queryClient = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const offset of [-7, 7]) {
        const neighbour = weekWindowOf(addDays(weekStart, offset), zone);
        void prefetchWeek(queryClient, householdId, toFetchWindow(neighbour));
      }
    }, PREFETCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [queryClient, householdId, weekStart, zone]);

  return {
    occurrences,
    columnDates,
    layout,
    isPending,
    error: error ?? null,
  };
}

/**
 * The read's window speaks ISO instants (`queries.ts` binds them into the
 * three-branch OR); the expander's speaks epoch ms. One derivation, so the
 * fetched window and the expanded one can never disagree.
 */
function toFetchWindow(weekWindow: WeekWindow): WeekFetchBounds {
  return fetchBoundsOf(weekWindow);
}

/** T061's slot. Until then every expanded occurrence is visible (FR-265's default). */
function visibleOf(occurrences: Occurrence[]): Occurrence[] {
  return occurrences;
}

/** The slice's consecutive dates — what the header, columns and layout all key on. */
function columnDatesOf(weekStart: string, sliceStart: number, columns: number): string[] {
  const dates: string[] = [];
  for (let day = 0; day < columns; day += 1) {
    dates.push(addDays(weekStart, sliceStart + day));
  }
  return dates;
}
