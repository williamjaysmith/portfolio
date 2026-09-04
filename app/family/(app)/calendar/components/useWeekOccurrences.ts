"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { addDays, fetchBoundsOf, viewWindowOf, type DateWindow } from "@/lib/family/calendar/dates";
import { expandWindow } from "@/lib/family/calendar/expand";
import { layoutWeek, type LayoutMetrics, type WeekLayout } from "@/lib/family/calendar/layout";
import { visibleOccurrences } from "@/lib/family/calendar/visibility";
import { prefetchWeek, useWeekEvents, type WeekFetchBounds } from "@/lib/family/queries";
import type { Event, Occurrence } from "@/lib/family/types";

import { useDeviceVisibility } from "../../components/useDeviceVisibility";

/**
 * T028: the one data path from the displayed window to drawn rectangles, as a
 * MEMO CHAIN whose layers invalidate independently (R206):
 *
 *   fetch (`useWeekEvents`, cache key = the window's own days, R207)
 *     → `expandWindow`  — ONCE per mounted window; only new data or a new
 *                         window re-runs it
 *     → visibility      → `visibleOccurrences` over THIS device's hidden
 *                         categories (FR-265/267, T061); its own layer, so a
 *                         filter toggle re-filters WITHOUT re-expanding
 *     → `layoutWeek`    — per measured metrics; a rotation re-layouts
 *                         without touching the layers above
 *
 * The window is the anchored first day plus the measured column count, and it
 * is ONE thing: what is fetched, what is expanded, and what is drawn. A page
 * moves the anchor by a whole window, so the next page's fetch abuts this
 * one's — nothing is fetched twice and no day falls between them.
 *
 * Expansion and layout are both worked in the household's zone (FR-219);
 * geometry waits on the grid's first measurement (`metrics: null` →
 * `layout: null`) while expansion never does — the occurrences exist before
 * the DOM has a size.
 *
 * The hook also warms the neighbouring windows once the anchor SETTLES
 * (R207): a short delay filters out the pages flicked past while swiping, and
 * React Query dedupes whatever remains.
 */

/** How long a window must stay mounted before its neighbours are prefetched. */
const PREFETCH_SETTLE_MS = 250;

const NO_OCCURRENCES: Occurrence[] = [];

export interface UseWeekOccurrencesOptions {
  householdId: string;
  /** The window's first day, `YYYY-MM-DD` in the household zone (R207). */
  anchorDate: string;
  /** Household IANA zone (FR-284) — every expansion and layout works in it. */
  zone: string;
  /** Visible day columns (FR-277/278) — `useGridGeometry().columnCount`. */
  columns: number;
  /** Measured layout inputs; `null` until the grid has measured (T027). */
  metrics: LayoutMetrics | null;
  /** The server-fetched first window, for a no-flicker first paint (R207). */
  initialData?: Event[];
}

export interface WeekOccurrencesState {
  /** The displayed window — the cache identity every write invalidates (R207). */
  window: DateWindow;
  /** The window's occurrences, expanded once and filtered to what this device shows. */
  occurrences: Occurrence[];
  /** The window's consecutive household-local dates, `columns` long. */
  columnDates: string[];
  /** Rectangles for the window; `null` until `metrics` arrive. */
  layout: WeekLayout | null;
  /** True while the window's FIRST fetch is still in flight. */
  isPending: boolean;
  error: Error | null;
}

export function useWeekOccurrences(options: UseWeekOccurrencesOptions): WeekOccurrencesState {
  const { householdId, anchorDate, zone, columns, metrics, initialData } = options;

  const viewWindow = useMemo(
    () => viewWindowOf(anchorDate, columns, zone),
    [anchorDate, columns, zone],
  );
  const fetchWindow = useMemo(() => toFetchWindow(viewWindow), [viewWindow]);
  const { data, isPending, error } = useWeekEvents(householdId, fetchWindow, initialData);

  const expanded = useMemo(
    () => (data === undefined ? NO_OCCURRENCES : expandWindow(data, viewWindow, zone)),
    [data, viewWindow, zone],
  );

  // The visibility layer (T061, R206): the FR-265 filter over the device's
  // OWN hidden set — display-only by construction (FR-267), and a layer of
  // its own, so toggling a profile or a label can never re-expand the week.
  // The hidden set is read here rather than passed in: it is a per-device
  // view preference (FR-266), not something the view should have to thread.
  const { hiddenIds } = useDeviceVisibility();
  const occurrences = useMemo(() => visibleOccurrences(expanded, hiddenIds), [expanded, hiddenIds]);

  const columnDates = useMemo(() => columnDatesOf(anchorDate, columns), [anchorDate, columns]);

  const layout = useMemo(
    () => (metrics === null ? null : layoutWeek(occurrences, columnDates, zone, metrics)),
    [occurrences, columnDates, zone, metrics],
  );

  const queryClient = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => {
      // The two pages a swipe or an arrow can reach: one window either side,
      // which is exactly `columns` days — the same step the anchor takes.
      for (const offset of [-columns, columns]) {
        const neighbour = viewWindowOf(addDays(anchorDate, offset), columns, zone);
        void prefetchWeek(queryClient, householdId, toFetchWindow(neighbour));
      }
    }, PREFETCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [queryClient, householdId, anchorDate, columns, zone]);

  return {
    window: viewWindow,
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
function toFetchWindow(window: DateWindow): WeekFetchBounds {
  return fetchBoundsOf(window);
}

/** The window's consecutive dates — what the header, columns and layout all key on. */
function columnDatesOf(anchorDate: string, columns: number): string[] {
  const dates: string[] = [];
  for (let day = 0; day < columns; day += 1) dates.push(addDays(anchorDate, day));
  return dates;
}
