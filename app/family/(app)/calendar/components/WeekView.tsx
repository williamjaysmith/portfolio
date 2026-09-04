"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { DateWindow } from "@/lib/family/calendar/dates";
import {
  TOUCH_FLOOR,
  type AllDayLayout,
  type LayoutMetrics,
  type WeekLayout,
} from "@/lib/family/calendar/layout";
import type { PaletteColor } from "@/lib/family/colors";
import type { ConfirmStep } from "@/lib/family/drag-state";
import type { Category, Event, Occurrence, TimeFormat } from "@/lib/family/types";
import { DEFAULT_COLUMN_COUNT, type GridMetrics } from "@/lib/family/week-geometry";

import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily } from "../../components/FamilyProvider";
import { AllDayBand } from "./AllDayBand";
import { slotSeedOf } from "./event-drafts";
import { EventEditor } from "./EventEditor";
import { ScopeDialog } from "./ScopeDialog";
import { useCalendarEditor, type CalendarEditor } from "./useCalendarEditor";
import {
  DragSurfaceContext,
  dragAnnouncementOf,
  useDragCommit,
  useEventDrag,
  type DragDispatch,
  type DragSurface,
} from "./useEventDrag";
import { useFollowScroll } from "./useFollowScroll";
import { useGridGeometry } from "./useGridGeometry";
import { useWeekAnchor } from "./useWeekAnchor";
import { useWeekOccurrences } from "./useWeekOccurrences";
import { WeekGrid } from "./WeekGrid";
import { WeekHeader } from "./WeekHeader";
import { WeekPager } from "./WeekPager";

/**
 * T033: the Week view orchestrator — the FR-201 day-columns-over-hours grid
 * assembled from the US1 pieces, each of which stays ignorant of the others:
 *
 *   useGridGeometry    measures the mounted viewport → columns + metrics
 *   useWeekAnchor      {today | pinned} first day, paged by the column count
 *   useWeekOccurrences fetch → expand → filter → layout memo chain (R206)
 *   useFollowScroll    the FR-290 follow-scroll on the hour viewport (T034)
 *   useCalendarEditor  the US2 write surfaces and their one commit path (T050)
 *   useEventDrag       the US3 gesture over the two pure drag modules (T055)
 *   useDragCommit      what a drop does: scope → punch-in → updateEvent (T057)
 *   WeekPager          the US4 swipe over that same one-page step (T060)
 *
 * The drag's three mounting points are here and nowhere else: the controller
 * goes into `DragSurfaceContext` so the drawn blocks can take hold of it and
 * the target column can draw the ghost; `prompt === 'scope'` mounts the
 * SHARED `ScopeDialog` in `move` mode (FR-237/250 — one component, one
 * wording, for edit, delete and drag alike), whose answer goes straight back
 * to the reducer; and the gesture's running commentary goes into one polite
 * live region, which is what makes the keyboard path usable (FR-263). The
 * punch-in needs no mounting — it is the shell's own sheet, opened on demand
 * by the pipeline (FR-248/275).
 *
 * Navigation (FR-281, Contradiction 1): the ‹ / Today / › cluster renders as
 * top-right pills in Phase 1's top-bar pill idiom. Today returns to the live
 * window — which begins on today — AND resumes the follow-scroll (FR-290's
 * second resume path). Those controls always page, however full the grid is.
 *
 * The one-page step has THREE drivers and one implementation: the arrows,
 * `WeekPager`'s horizontal swipe over the strip, and the drag layer's
 * edge-hold (R211) reaching sideways mid-gesture. All call `anchor.page`,
 * which moves the first day by exactly the number of columns on show — so
 * three columns step three days and seven step seven, consecutive pages abut,
 * and no day is skipped or shown twice. The pager partitions with the drag by
 * target (Assumption 44: a press on a block is always a drag).
 *
 * Creating has exactly two doors (FR-254): the shell's FAB, which this view
 * registers "Add event" with while mounted, and a tap on an empty slot —
 * that day, that 15-minute slot, one hour long (FR-255). No long press. A
 * tap on a block, bar or "+n more" row opens details (FR-256); editing is
 * reached from there only (FR-257).
 *
 * Until the grid's first measurement lands, the hour viewport renders with
 * an EMPTY layout rather than not at all — the viewport must mount for the
 * ResizeObserver to ever measure it, and expansion never waits on geometry
 * (R206). The server-fetched rows (R207) seed exactly ITS OWN cache entry —
 * the same first day AND the same width — because seeding whichever window is
 * mounted would hand a navigated-to or rotated window the wrong rows for a
 * whole staleTime.
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

/** FR-254's two doors into the create form: the shell's FAB and the empty-slot tap (FR-255). */
function useCreateDoors(openCreate: CalendarEditor["openCreate"], zone: string) {
  const createFromFab = useCallback(() => openCreate(), [openCreate]);
  useRegisterFabAction("Add event", createFromFab);

  return useCallback(
    (date: string, minutes: number) => openCreate(slotSeedOf(zone, date, minutes)),
    [openCreate, zone],
  );
}

/** Everything the view needs from the drag layer, flat — see `useWeekDrag`. */
interface WeekDrag {
  /** For `DragSurfaceContext`: what the blocks and their columns take hold of. */
  surface: DragSurface;
  /** `scope` mounts the shared dialog; `punchIn` is the pipeline's own (FR-250). */
  prompt: ConfirmStep | null;
  dispatch: DragDispatch;
  /** The live region's text (FR-263). */
  announcement: string;
  /** FR-288's refusal from a committed drop. */
  notice: string | null;
  viewportRef: (node: HTMLElement | null) => void;
  bandRef: (node: HTMLElement | null) => void;
}

interface UseWeekDragOptions {
  /** The displayed window: its identity guards the source watch, its days key the cache. */
  window: DateWindow;
  columnDates: readonly string[];
  occurrences: readonly Occurrence[];
  metrics: GridMetrics | null;
  layoutMetrics: LayoutMetrics | null;
  timeFormat: TimeFormat;
  /** R211's edge-hold reach — the same step the swipe and the arrows take. */
  onPage: (direction: -1 | 1) => void;
}

/**
 * The whole US3 gesture as one thing the view can hold: the pointer and
 * keyboard controller (T055/T058), the drop pipeline over it (T057), and the
 * announcement derived from its state. Kept as a hook so `WeekView` reads
 * seven plain values instead of assembling three layers itself.
 */
function useWeekDrag(options: UseWeekDragOptions): WeekDrag {
  const { window, columnDates, occurrences, metrics, layoutMetrics, timeFormat, onPage } = options;
  const {
    state,
    prompt,
    commitIntent,
    dispatch,
    dateOfColumn,
    sourceOccurrence,
    surface,
    viewportRef,
    bandRef,
  } = useEventDrag({
    metrics,
    layoutMetrics,
    columnDates,
    windowStart: window.startDate,
    occurrences,
    onPage,
  });

  const { notice } = useDragCommit({
    prompt,
    commitIntent,
    dispatch,
    dateOfColumn,
    sourceOccurrence,
    window,
    occurrences,
  });

  return {
    surface,
    prompt,
    dispatch,
    announcement: dragAnnouncementOf(state, { dateOfColumn, timeFormat }),
    notice,
    viewportRef,
    bandRef,
  };
}

/**
 * FR-281's ‹ / Today / › cluster, in Phase 1's top-bar pill idiom. The arrows
 * step one page — `columns` days — so their labels say how far, which is the
 * only way a screen-reader user can tell a three-day phone from a seven-day
 * tablet.
 */
function WeekNav({
  columns,
  onPage,
  onToday,
}: {
  columns: number;
  onPage: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-3 px-(--fam-edge-inset) pt-2">
      <button
        type="button"
        aria-label={`Previous ${columns} days`}
        onClick={() => onPage(-1)}
        className={PILL_CLASS}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button type="button" onClick={onToday} className={PILL_CLASS}>
        Today
      </button>
      <button
        type="button"
        aria-label={`Next ${columns} days`}
        onClick={() => onPage(1)}
        className={PILL_CLASS}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The day headers over the all-day band (FR-206/207). The band is wrapped so
 * its own extent can be measured: that rectangle is what makes it a drop
 * target, and FR-251's conversion depends on hitting it.
 */
function DayHeaderBand({
  columnDates,
  layout,
  colorsById,
  todayDate,
  onOpen,
  bandRef,
}: {
  columnDates: readonly string[];
  layout: AllDayLayout;
  colorsById: Readonly<Record<string, PaletteColor>>;
  todayDate: string | null;
  onOpen: (occurrence: Occurrence) => void;
  bandRef: (node: HTMLElement | null) => void;
}) {
  return (
    <div className="min-h-(--fam-dayheader-h) shrink-0 border-b border-(--fam-hairline)">
      <WeekHeader columnDates={columnDates} todayDate={todayDate} />
      <div ref={bandRef}>
        <AllDayBand
          columnDates={columnDates}
          layout={layout}
          colorsById={colorsById}
          todayDate={todayDate}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

/** A one-line grid notice — the week's load failure, or the editor's FR-288 messages. */
function Notice({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p
      role="alert"
      className="px-(--fam-edge-inset) py-1 text-(length:--fam-fs-small) text-(--fam-danger)"
    >
      {message}
    </p>
  );
}

export interface WeekViewProps {
  /** The server-rendered window's first day, `YYYY-MM-DD` household-local (R207). */
  initialAnchorDate: string;
  /** The server-fetched rows for that window — the no-flicker first paint (R207). */
  initialEvents: Event[];
}

/**
 * Every hook the week needs, assembled once. Kept out of `WeekView` so the
 * component below is a rendering of a value rather than a wiring of hooks —
 * the two change for different reasons and the cognitive budget is spent on
 * one of them at a time.
 */
function useWeekViewModel({ initialAnchorDate, initialEvents }: WeekViewProps) {
  const { householdId, settings, categories } = useFamily();
  const zone = settings.timezone;

  const {
    viewportRef: measureViewport,
    metrics,
    columnCount,
    layoutMetrics,
  } = useGridGeometry();

  const anchor = useWeekAnchor({
    zone,
    startWeekOn: settings.startWeekOn,
    columns: columnCount,
    initialAnchorDate,
  });

  const {
    viewportRef: followViewport,
    onScroll,
    resume,
  } = useFollowScroll({ zone, pxPerMinute: layoutMetrics?.pxPerMinute ?? null });

  const week = useWeekOccurrences({
    householdId,
    anchorDate: anchor.anchorDate,
    zone,
    columns: columnCount,
    metrics: layoutMetrics,
    initialData: seedFor(anchor.anchorDate, columnCount, initialAnchorDate, initialEvents),
  });

  const editor = useCalendarEditor({ householdId, window: week.window, zone });

  // Destructured at the call site: what the view reads while rendering must
  // be plain values, and `viewportRef` must keep its identity or the grid's
  // callback ref would detach and re-attach on every render.
  const {
    surface: dragSurface,
    prompt: dragPrompt,
    dispatch: dragDispatch,
    announcement,
    notice: dragNotice,
    viewportRef: dragViewportRef,
    bandRef: dragBandRef,
  } = useWeekDrag({
    window: week.window,
    columnDates: week.columnDates,
    occurrences: week.occurrences,
    metrics,
    layoutMetrics,
    timeFormat: settings.timeFormat,
    onPage: anchor.page,
  });

  // One node, three consumers: the geometry measurement, the follow-scroll,
  // and the drag's pointer capture (R205 — the gesture lives on the stable
  // scroll container, never on the block). The three refs are all stable, so
  // the node is never re-attached mid-gesture.
  const attachViewport = useCallback(
    (node: HTMLDivElement | null) => {
      measureViewport(node);
      followViewport(node);
      dragViewportRef(node);
    },
    [measureViewport, followViewport, dragViewportRef],
  );

  const { goToToday: anchorToToday, page, todayDate } = anchor;
  const goToToday = useCallback(() => {
    anchorToToday();
    resume();
  }, [anchorToToday, resume]);

  return {
    zone,
    settings,
    week,
    editor,
    createFromSlot: useCreateDoors(editor.openCreate, zone),
    columnCount,
    page,
    colorsById: useMemo(() => colorMapOf(categories), [categories]),
    layout: week.layout ?? EMPTY_LAYOUT,
    todayDate,
    goToToday,
    attachViewport,
    onScroll,
    dragSurface,
    dragPrompt,
    dragDispatch,
    dragNotice,
    dragBandRef,
    announcement,
  };
}

/**
 * The server-fetched rows seed only the window they were fetched for (R207):
 * the same first day AND the same width, since the server renders
 * `DEFAULT_COLUMN_COUNT` days and a measured phone shows fewer.
 */
function seedFor(
  anchorDate: string,
  columns: number,
  initialAnchorDate: string,
  initialEvents: Event[],
): Event[] | undefined {
  const isInitialWindow = anchorDate === initialAnchorDate && columns === DEFAULT_COLUMN_COUNT;
  return isInitialWindow ? initialEvents : undefined;
}

export function WeekView(props: WeekViewProps) {
  const m = useWeekViewModel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WeekNav columns={m.columnCount} onPage={m.page} onToday={m.goToToday} />

      <DragSurfaceContext.Provider value={m.dragSurface}>
        {/* FR-279: the whole strip pages together — the day headers, the
            all-day band and the hour grid are one window of days. */}
        <WeekPager onPage={m.page}>
          <DayHeaderBand
            columnDates={m.week.columnDates}
            layout={m.layout.allDay}
            colorsById={m.colorsById}
            todayDate={m.todayDate}
            onOpen={m.editor.openDetails}
            bandRef={m.dragBandRef}
          />

          <Notice message={weekErrorOf(m.week.error)} />
          <Notice message={m.editor.notice} />
          <Notice message={m.dragNotice} />

          <WeekGrid
            columnDates={m.week.columnDates}
            todayDate={m.todayDate}
            layout={m.layout}
            colorsById={m.colorsById}
            zone={m.zone}
            timeFormat={m.settings.timeFormat}
            viewportRef={m.attachViewport}
            onViewportScroll={m.onScroll}
            onOpen={m.editor.openDetails}
            onSlotTap={m.createFromSlot}
          />
        </WeekPager>
      </DragSurfaceContext.Provider>

      {/* FR-263: the keyboard drag's running commentary, in slot language. */}
      <p role="status" aria-live="polite" className="sr-only">
        {m.announcement}
      </p>

      <EventEditor editor={m.editor} />
      <DragScopeQuestion prompt={m.dragPrompt} dispatch={m.dragDispatch} />
    </div>
  );
}

/** A failed week read says so once, in the household's words, not the API's. */
function weekErrorOf(error: unknown): string | null {
  return error === null ? null : "The week could not be loaded.";
}

/**
 * FR-250's first prompt, for a dragged occurrence of a repeat: the same
 * dialog and the same three strings the form and the delete use (FR-237),
 * named `move`. Its answer goes back to the reducer, which then asks for the
 * punch-in; dismissing it abandons the drop with nothing written (FR-249).
 */
function DragScopeQuestion({
  prompt,
  dispatch,
}: {
  prompt: ConfirmStep | null;
  dispatch: DragDispatch;
}) {
  if (prompt !== "scope") return null;
  return (
    <ScopeDialog
      mode="move"
      onChoose={(scope) => dispatch({ type: "SCOPE_CHOSEN", scope })}
      onCancel={() => dispatch({ type: "SCOPE_DISMISSED" })}
    />
  );
}
