"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo } from "react";

import { sliceStarts } from "@/lib/family/calendar/dates";
import { TOUCH_FLOOR, type WeekLayout } from "@/lib/family/calendar/layout";
import type { PaletteColor } from "@/lib/family/colors";
import type { Category, Event } from "@/lib/family/types";

import { useFamily } from "../../components/FamilyProvider";
import { AllDayBand } from "./AllDayBand";
import { useFollowScroll } from "./useFollowScroll";
import { useGridGeometry } from "./useGridGeometry";
import { useWeekAnchor } from "./useWeekAnchor";
import { useWeekOccurrences } from "./useWeekOccurrences";
import { WeekGrid } from "./WeekGrid";
import { WeekHeader } from "./WeekHeader";

/**
 * T033: the Week view orchestrator — the FR-201 day-columns-over-hours grid
 * assembled from the US1 pieces, each of which stays ignorant of the others:
 *
 *   useGridGeometry    measures the mounted viewport → columns + metrics
 *   useWeekAnchor      {today | pinned} week + slice state over the clock
 *   useWeekOccurrences fetch → expand → filter → layout memo chain (R206)
 *   useFollowScroll    the FR-290 follow-scroll on the hour viewport (T034)
 *
 * Navigation (FR-281, Contradiction 1): the ‹ / Today / › cluster renders as
 * top-right pills in Phase 1's top-bar pill idiom. The arrows step a WHOLE
 * anchored week whatever the column count; Today returns to the live week's
 * slice containing today AND resumes the follow-scroll (FR-290's second
 * resume path). The slice swipe is US4's SlicePager (FR-279), not this.
 *
 * Until the grid's first measurement lands, the hour viewport renders with
 * an EMPTY layout rather than not at all — the viewport must mount for the
 * ResizeObserver to ever measure it, and expansion never waits on geometry
 * (R206). The server-fetched week (R207) seeds exactly ITS OWN cache entry:
 * seeding whichever week is mounted would hand a navigated-to week the
 * current week's rows for a whole staleTime.
 */

const EMPTY_LAYOUT: WeekLayout = {
  timed: [],
  overflow: [],
  allDay: { bars: [], laneCount: 0 },
  minBlockHeight: TOUCH_FLOOR,
};

/** Phase 1's top-bar pill (FilterSheet's idiom) at the FR-263 touch floor. */
const PILL_CLASS =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) items-center justify-center gap-2 " +
  "rounded-full bg-(--fam-pill-btn-bg) px-4 font-medium " +
  "text-(length:--fam-fs-pill) text-(--fam-text-muted)";

/** Category id → its palette colour — the fills' lookup in draw order (FR-227). */
function colorMapOf(categories: readonly Category[]): Record<string, PaletteColor> {
  const map: Record<string, PaletteColor> = {};
  for (const category of categories) map[category.id] = category.color;
  return map;
}

export interface WeekViewProps {
  /** The server-rendered current week's start, `YYYY-MM-DD` household-local (R207). */
  initialWeekStart: string;
  /** The server-fetched rows for that week — the no-flicker first paint (R207). */
  initialEvents: Event[];
}

export function WeekView({ initialWeekStart, initialEvents }: WeekViewProps) {
  const { householdId, settings, categories } = useFamily();
  const zone = settings.timezone;

  const { viewportRef: measureViewport, columnCount, layoutMetrics } = useGridGeometry();

  const anchor = useWeekAnchor({
    zone,
    startWeekOn: settings.startWeekOn,
    columns: columnCount,
    initialWeekStart,
  });
  const { goToToday: anchorToToday, goToPreviousWeek, goToNextWeek, todayDate } = anchor;

  const {
    viewportRef: followViewport,
    onScroll,
    resume,
  } = useFollowScroll({
    zone,
    pxPerMinute: layoutMetrics === null ? null : layoutMetrics.pxPerMinute,
  });

  const week = useWeekOccurrences({
    householdId,
    weekStart: anchor.weekStart,
    zone,
    sliceStart: sliceStarts(columnCount)[anchor.sliceIndex],
    columns: columnCount,
    metrics: layoutMetrics,
    initialData: anchor.weekStart === initialWeekStart ? initialEvents : undefined,
  });

  const colorsById = useMemo(() => colorMapOf(categories), [categories]);

  // One node, two consumers: the geometry measurement and the follow-scroll.
  const attachViewport = useCallback(
    (node: HTMLDivElement | null) => {
      measureViewport(node);
      followViewport(node);
    },
    [measureViewport, followViewport],
  );

  const goToToday = useCallback(() => {
    anchorToToday();
    resume();
  }, [anchorToToday, resume]);

  const layout = week.layout ?? EMPTY_LAYOUT;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-end gap-3 px-(--fam-edge-inset) pt-2">
        <button
          type="button"
          aria-label="Previous week"
          onClick={goToPreviousWeek}
          className={PILL_CLASS}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <button type="button" onClick={goToToday} className={PILL_CLASS}>
          Today
        </button>
        <button
          type="button"
          aria-label="Next week"
          onClick={goToNextWeek}
          className={PILL_CLASS}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-(--fam-dayheader-h) shrink-0 border-b border-(--fam-hairline)">
        <WeekHeader columnDates={week.columnDates} todayDate={todayDate} />
        <AllDayBand
          columnDates={week.columnDates}
          layout={layout.allDay}
          colorsById={colorsById}
          todayDate={todayDate}
        />
      </div>

      {week.error === null ? null : (
        <p
          role="alert"
          className="px-(--fam-edge-inset) py-1 text-(length:--fam-fs-small) text-(--fam-danger)"
        >
          The week could not be loaded.
        </p>
      )}

      <WeekGrid
        columnDates={week.columnDates}
        todayDate={todayDate}
        layout={layout}
        colorsById={colorsById}
        zone={zone}
        timeFormat={settings.timeFormat}
        viewportRef={attachViewport}
        onViewportScroll={onScroll}
      />
    </div>
  );
}
