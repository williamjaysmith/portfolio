"use client";

import { useCallback, useMemo, type ReactNode } from "react";

import type { DateWindow } from "@/lib/family/calendar/dates";
import {
  TOUCH_FLOOR,
  type AllDayLayout,
  type LayoutMetrics,
  type WeekLayout,
} from "@/lib/family/calendar/layout";
import type { PaletteColor } from "@/lib/family/colors";
import type { ConfirmStep } from "@/lib/family/drag-state";
import type { Category, Event, Occurrence, TimeFormat, Meal, MealCategory, Recipe, WeekStart } from "@/lib/family/types";
import type { GridMetrics } from "@/lib/family/week-geometry";

import { useRegisterFabAction } from "../../components/FabAction";
import { useFamily } from "../../components/FamilyProvider";
import { AllDayBand } from "./AllDayBand";
import type { CalendarView } from "@/lib/family/calendar/views";

import { CountdownChips } from "./CountdownChips";
import { CountdownList } from "./CountdownList";
import { MonthBody } from "./MonthBody";
import { EventSearch } from "./EventSearch";
import { useCalendarView } from "./useCalendarView";
import { useCalendarSearch, type CalendarSearch } from "./useEventSearch";
import { ViewSwitcher } from "./ViewSwitcher";
import { MealRow } from "./MealRow";
import { PreviewBar } from "./PreviewBar";
import { useCalendarPreview, type CalendarPreview, type CalendarPreviewOptions } from "./useCalendarPreview";
import { useCalendarMeals } from "./useCalendarMeals";
import { slotSeedOf } from "./event-drafts";
import { EventEditor } from "./EventEditor";
import { ScopeDialog } from "../../components/ScopeDialog";
import { MealSurfaces } from "../../meals/components/MealSurfaces";
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
import { useRememberedColumns } from "./useRememberedColumns";
import { useWeekAnchor } from "./useWeekAnchor";
import { useWeekOccurrences } from "./useWeekOccurrences";
import { WeekGrid } from "./WeekGrid";
import { WeekHeader } from "./WeekHeader";
import { DayNav } from "../../components/DayNav";
import { WeekPager } from "./WeekPager";
import { TopBarSearch } from "../../components/TopBarSearch";

/**
 * The Month view's swipe partition: nothing is rejected. Every month cell is a
 * button (FR-1113), and the month has no drag layer to partition against
 * (Assumption 6) — so the default `beginsOnBlock` would refuse every swipe.
 * Module-level so it is one identity rather than a new closure per render.
 */
const NOTHING_REJECTS = (): boolean => false;

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

/**
 * How many countdown chips hold a position at once (009 FR-908).
 *
 * Derived from the measured column count rather than fixed, because the whole
 * reason the reference rotates is "when space is limited" — and what is limited
 * is the width the grid already measured. A three-day phone shows one chip and
 * rotates; a seven-day tablet shows three and usually does not.
 */
/** A result's day, short — the row has a title beside it and little room. */
function searchDateInWords(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * How many countdown chips a month's bar holds. The month grid is always seven
 * columns wide, so unlike the week there is no measured count to derive from —
 * it gets the widest setting, which is what a seven-column week gets.
 */
const MONTH_COUNTDOWN_SLOTS = 3;

function countdownSlotsFor(columnCount: number): number {
  return columnCount >= 7 ? 3 : columnCount >= 5 ? 2 : 1;
}

const EMPTY_LAYOUT: WeekLayout = {
  timed: [],
  overflow: [],
  allDay: { bars: [], laneCount: 0 },
  minBlockHeight: TOUCH_FLOOR,
};

/** Phase 1's top-bar pill (FilterSheet's idiom) at the FR-263 touch floor. */
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
 * WHICH DAYS ARE SHOWING, and how the household moves between them (011 R1103,
 * R1106): the chosen view, the geometry it measures itself with, and the anchor
 * that names its first day.
 *
 * One hook rather than three calls in `useWeekViewModel`, for the same reason
 * `useWeekChrome` exists: that function is a wiring of hooks and the view is a
 * rendering of a value, so each thing the view needs arrives as one value. It
 * is also what keeps the three in step — the geometry's fixed column count and
 * the anchor's paging step are both functions of the view, and separating them
 * would let a Day view page by seven.
 */
function useCalendarFrame(options: {
  zone: string;
  startWeekOn: WeekStart;
  initialAnchorDate: string;
  initialColumnCount: number;
}) {
  const { view, setView } = useCalendarView();

  // 011 R1103: Day view is this same grid at ONE column. The measured fit can
  // never return one — `columnCountFor` clamps to FR-278's floor for the week —
  // so the view asks for its own count and the floor keeps its meaning.
  //
  // 012: the second argument is what the SERVER drew, from this device's
  // remembered width, so the first client render agrees with the markup and the
  // grid stops re-laying-out on every load of a narrow screen.
  const geometry = useGridGeometry(view === "day" ? 1 : undefined, options.initialColumnCount);
  useRememberedColumns(geometry.columnCount, view === "week");

  const anchor = useWeekAnchor({
    zone: options.zone,
    startWeekOn: options.startWeekOn,
    columns: geometry.columnCount,
    initialAnchorDate: options.initialAnchorDate,
    view,
  });

  return {
    view,
    setView,
    anchor,
    viewportRef: geometry.viewportRef,
    metrics: geometry.metrics,
    layoutMetrics: geometry.layoutMetrics,
    columnCount: geometry.columnCount,
  };
}

/**
 * Everything the week draws AROUND its grid (009 R901, R905, R908): the preview
 * bar's countdowns and switches, and the toolbar's search.
 *
 * One hook rather than three separate ones in `useWeekViewModel`, for the
 * reason that function's own header gives — the view is a rendering of a value,
 * not a wiring of hooks — and because these take the same inputs and change for
 * the same reason: they are the chrome the household reads before it reads the
 * week itself.
 *
 * 014 removed a third member. `tasksProgress` was bundled here so the mount
 * rule read at the call site; the counts moved to the shell's `ProfileChipRow`
 * and the switch went with them, so the bar carries countdowns alone.
 */
interface WeekChrome {
  preview: CalendarPreview;
  search: CalendarSearch;
}

function useWeekChrome(options: CalendarPreviewOptions): WeekChrome {
  const preview = useCalendarPreview(options);
  const search = useCalendarSearch(options);
  return { preview, search };
}

/**
 * FR-281's ‹ / Today / › cluster, in Phase 1's top-bar pill idiom. The arrows
 * step one page — `columns` days — so their labels say how far, which is the
 * only way a screen-reader user can tell a three-day phone from a seven-day
 * tablet.
 */
/**
 * What one page of this view is called, so the arrows say how far they go —
 * the only way a screen-reader user can tell a three-day phone from a
 * seven-day tablet, and now a Day view from either (011 FR-1104).
 */
function pageLabelOf(view: CalendarView, columns: number): string {
  if (view === "day") return "day";
  if (view === "month") return "month";
  return `${columns} days`;
}

/**
 * 014: the cluster itself is now the shell's `DayNav`, shared with Meals — the
 * two tabs had drifted into two shapes and two orders for the same three
 * controls. What stays here is the only thing that was ever the Calendar's own:
 * the word for one step, which is "month" in the Month view and a count of days
 * otherwise, and the view switcher and search box that ride the same row.
 */
function WeekNav({
  view,
  columns,
  onPage,
  onToday,
  children,
}: {
  view: CalendarView;
  columns: number;
  onPage: (direction: -1 | 1) => void;
  onToday: () => void;
  /** 009 FR-915: the Search control, where the reference puts it on its toolbar. */
  children?: ReactNode;
}) {
  return (
    <DayNav distance={pageLabelOf(view, columns)} onPage={onPage} onToday={onToday}>
      {children}
    </DayNav>
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
  children,
}: {
  columnDates: readonly string[];
  layout: AllDayLayout;
  colorsById: Readonly<Record<string, PaletteColor>>;
  todayDate: string | null;
  onOpen: (occurrence: Occurrence) => void;
  bandRef: (node: HTMLElement | null) => void;
  /** 006 FR-634: the meal token row, under the band and outside its drag target. */
  children?: ReactNode;
}) {
  return (
    // **No `min-h-(--fam-dayheader-h)` here, deliberately.** The sampled token
    // is "date line + one all-day row", so this band reserved room for an
    // all-day row on every day that has none — which is the gap the operator
    // measured against the Month view, whose headings sit right on the grid:
    // *"doesnt have as much space between it and the calendar — closer to the
    // calendar … i would like day and week to match that"*. `AllDayBand`
    // collapses to nothing when it has no bars, so the band is now as tall as
    // what is in it. The bars arrive in the same read as the timed events, so
    // there is no second paint to shift under the reader. Meals still draws its
    // own header at the full token height and is unaffected.
    <div className="shrink-0 border-b border-(--fam-hairline)">
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
      {children}
    </div>
  );
}

/**
 * The preview bar, wherever the showing view puts it (009 FR-907, 011 FR-1116).
 *
 * One component because the bar belongs above the events in EVERY view
 * [VERIFIED](36625171368987, 40459070511515) and the week and the month place
 * it in different parents — the week inside its header band, the month above
 * its grid. Two copies would be two places for the mount rule below to drift.
 *
 * `slots` is the one thing that differs: the week derives it from its measured
 * column count, and the month is always seven columns wide.
 */
function CalendarPreviewBar({
  m,
  slots,
}: {
  m: ReturnType<typeof useWeekViewModel>;
  slots: number;
}) {
  return (
    <PreviewBar
      countdowns={
        m.chrome.preview.countdowns.length === 0 ? undefined : (
          <CountdownChips
            countdowns={m.chrome.preview.countdowns}
            slots={slots}
            onOpenList={m.chrome.preview.openList}
          />
        )
      }
    />
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
  /**
   * How many columns the server drew, which is how many days `initialEvents`
   * covers (012). It is this device's remembered width, or
   * `DEFAULT_COLUMN_COUNT` for a device that has never measured one.
   */
  initialColumnCount: number;
  /** The server-fetched rows for that window — the no-flicker first paint (R207). */
  initialEvents: Event[];
  /** 006 FR-634: the household's meal reads, seeded the same way. */
  initialMeals: Meal[];
  initialMealCategories: MealCategory[];
  initialRecipes: Recipe[];
}

/**
 * Every hook the week needs, assembled once. Kept out of `WeekView` so the
 * component below is a rendering of a value rather than a wiring of hooks —
 * the two change for different reasons and the cognitive budget is spent on
 * one of them at a time.
 */
/**
 * The Week and Day views' own model (011): the window's occurrences, the meal
 * tokens, the drag layer, the follow-scroll, and the one node all three of the
 * grid's consumers attach to.
 *
 * Split out of `useWeekViewModel` when the Month view arrived and pushed that
 * function over its cognitive budget. The line is the honest one: everything
 * here belongs to the HOUR GRID and is not asked for while a month is showing.
 * What stays above is what every view needs — the frame, the chrome, the
 * editor.
 */
function useWeekBodyModel(options: {
  householdId: string;
  zone: string;
  frame: ReturnType<typeof useCalendarFrame>;
  timeFormat: TimeFormat;
  initialAnchorDate: string;
  initialColumnCount: number;
  initialEvents: Event[];
  initialMeals: Meal[];
  initialMealCategories: MealCategory[];
  initialRecipes: Recipe[];
}) {
  const { householdId, zone, frame, timeFormat, initialAnchorDate } = options;
  const { anchor, metrics, layoutMetrics, columnCount } = frame;

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
    initialData: seedFor(
      anchor.anchorDate,
      columnCount,
      initialAnchorDate,
      options.initialColumnCount,
      options.initialEvents,
    ),
  });

  const meals = useCalendarMeals({
    householdId,
    window: week.window,
    zone,
    todayDate: anchor.todayDate,
    initial: {
      categories: options.initialMealCategories,
      recipes: options.initialRecipes,
      meals: options.initialMeals,
    },
  });

  // Destructured here: what the view reads while rendering must be plain
  // values, and `viewportRef` must keep its identity or the grid's callback ref
  // would detach and re-attach on every render.
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
    timeFormat,
    onPage: anchor.page,
  });

  // One node, three consumers: the geometry measurement, the follow-scroll and
  // the drag's pointer capture (R205 — the gesture lives on the stable scroll
  // container, never on the block). All three refs are stable, so the node is
  // never re-attached mid-gesture.
  const measureViewport = frame.viewportRef;
  const attachViewport = useCallback(
    (node: HTMLDivElement | null) => {
      measureViewport(node);
      followViewport(node);
      dragViewportRef(node);
    },
    [measureViewport, followViewport, dragViewportRef],
  );

  return {
    week,
    meals,
    onScroll,
    resume,
    attachViewport,
    dragSurface,
    dragPrompt,
    dragDispatch,
    dragNotice,
    dragBandRef,
    announcement,
  };
}

function useWeekViewModel({
  initialAnchorDate,
  initialColumnCount,
  initialEvents,
  initialMeals,
  initialMealCategories,
  initialRecipes,
}: WeekViewProps) {
  const { householdId, settings, categories } = useFamily();
  const zone = settings.timezone;

  const frame = useCalendarFrame({
    zone,
    startWeekOn: settings.startWeekOn,
    initialAnchorDate,
    initialColumnCount,
  });
  const { view, setView, columnCount, anchor } = frame;

  const body = useWeekBodyModel({
    householdId,
    zone,
    frame,
    timeFormat: settings.timeFormat,
    initialAnchorDate,
    initialColumnCount,
    initialEvents,
    initialMeals,
    initialMealCategories,
    initialRecipes,
  });

  const chrome = useWeekChrome({
    householdId,
    todayDate: anchor.todayDate,
    zone,
    showCountdowns: settings.showCountdowns,
  });

  // Always the WEEK's window: the month opens events through `openTarget`,
  // which needs no lookup, so the editor never has to know a month exists.
  const editor = useCalendarEditor({ householdId, window: body.week.window, zone });
  const { goToToday: anchorToToday, page, todayDate, openAt } = anchor;
  const { resume } = body;
  const goToToday = useCallback(() => {
    anchorToToday();
    resume();
  }, [anchorToToday, resume]);

  return {
    zone,
    settings,
    ...body,
    householdId,
    editor,
    chrome,
    createFromSlot: useCreateDoors(editor.openCreate, zone),
    columnCount,
    anchorDate: anchor.anchorDate,
    view,
    setView,
    page,
    openAt,
    colorsById: useMemo(() => colorMapOf(categories), [categories]),
    layout: body.week.layout ?? EMPTY_LAYOUT,
    todayDate,
    goToToday,
  };
}

/**
 * The server-fetched rows seed only the window they were fetched for (R207):
 * the same first day AND the same width.
 *
 * The width it compares against is what the SERVER drew (012), not
 * `DEFAULT_COLUMN_COUNT`. Those were the same number until the server learned
 * this device's remembered width, and holding the constant here would have
 * quietly undone the point of learning it: a phone would render three columns
 * over a three-day fetch and then decline to use it.
 */
function seedFor(
  anchorDate: string,
  columns: number,
  initialAnchorDate: string,
  initialColumnCount: number,
  initialEvents: Event[],
): Event[] | undefined {
  const isInitialWindow = anchorDate === initialAnchorDate && columns === initialColumnCount;
  return isInitialWindow ? initialEvents : undefined;
}

/**
 * The Week and Day views' body: the drag layer, the pager, the header band and
 * the hour grid (011).
 *
 * Extracted when — and only when — a second body existed to justify it. Day
 * view needed no extraction at all, because it IS this body at one column
 * (R1103); the Month view is the one that needs a different one, so the screen
 * above now chooses between two bodies rather than holding one inline.
 *
 * It takes the whole model rather than fifteen props: it is not a reusable
 * component with an interface, it is one half of one screen, and enumerating
 * the model's fields here would be a second place to keep them in step.
 */
function WeekBody({ m }: { m: ReturnType<typeof useWeekViewModel> }) {
  return (
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
        >
          <MealRow
            columnDates={m.week.columnDates}
            tokens={m.meals.tokens}
            categoriesById={m.meals.categoriesById}
            recipeNames={m.meals.surfaces.recipeNames}
            onOpen={m.meals.surfaces.editor.openPopover}
          />
          {/* 009 FR-907: the preview bar, under the band and outside the
              drag layer — MealRow's own three properties (R901). */}
          <CalendarPreviewBar m={m} slots={countdownSlotsFor(m.columnCount)} />
        </DayHeaderBand>

        <Notice message={weekErrorOf(m.week.error)} />
        <Notice message={m.editor.notice} />
        <Notice message={m.dragNotice} />
        <Notice message={m.meals.surfaces.notice} />

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
  );
}

export function WeekView(props: WeekViewProps) {
  const m = useWeekViewModel(props);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WeekNav view={m.view} columns={m.columnCount} onPage={m.page} onToday={m.goToToday}>
        {/* 011 FR-1101: one control, labelled with the view showing. */}
        <ViewSwitcher view={m.view} onChange={m.setView} />
        {/* 009 FR-916: a chosen result takes the calendar to the day the event
            next falls on AND opens it — a finder, not a filter (divergence 6).
            It is PAINTED in the shell's top bar rather than on this row — five
            controls do not fit an iPhone SE, and the view switcher was the one
            that fell off — but it still lives here, so the term, the results
            and the jump are all this view's as before. */}
        <TopBarSearch>
        <EventSearch
          value={m.chrome.search.term}
          onChange={m.chrome.search.setTerm}
          results={m.chrome.search.results}
          answered={m.chrome.search.answered}
          formatDate={searchDateInWords}
          onChoose={(result) => {
            const target = m.chrome.search.targetFor(result);
            // Clearing the term is what closes the results: the control keeps
            // no open-state of its own (009 T050).
            m.chrome.search.setTerm("");
            if (target === null) return;
            m.openAt(result.onDate);
            m.editor.openTarget(target);
          }}
        />
        </TopBarSearch>
      </WeekNav>

      {/* 011 FR-1116: the preview bar belongs above the events in EVERY view
          [VERIFIED](36625171368987, 40459070511515), so on the month it sits
          here rather than inside the week's header band. */}
      {m.view === "month" ? (
        // The month pages by swipe too, on the same step its arrows call — it
        // never did, and the operator asked for it once the Week and Day views
        // had it. `rejects` is overridden because every month cell is a button;
        // see `WeekPagerProps.rejects`.
        <WeekPager onPage={m.page} rejects={NOTHING_REJECTS}>
          <MonthBody
            householdId={m.householdId}
            anchorDate={m.anchorDate}
          zone={m.zone}
            startWeekOn={m.settings.startWeekOn}
          todayDate={m.todayDate}
          timeFormat={m.settings.timeFormat}
          colorsById={m.colorsById}
            previewBar={<CalendarPreviewBar m={m} slots={MONTH_COUNTDOWN_SLOTS} />}
            notices={<Notice message={m.editor.notice} />}
            onOpenDay={(date) => {
              // FR-1113 / Assumption 5: a cell is a door to its DAY.
              m.openAt(date);
              m.setView("day");
            }}
            onOpenTarget={m.editor.openTarget}
          />
        </WeekPager>
      ) : (
        <WeekBody m={m} />
      )}

      {/* FR-263: the keyboard drag's running commentary, in slot language. */}
      <p role="status" aria-live="polite" className="sr-only">
        {m.announcement}
      </p>

      {/* 009 FR-909: the full list a tap on the bar opens. Choosing a row
          takes the calendar to that countdown's day AND opens its event —
          the target is built from the bar's own rows, because that day is by
          definition outside the window the editor could look one up in. */}
      {m.chrome.preview.listOpen ? (
        <CountdownList
          countdowns={m.chrome.preview.countdowns}
          onClose={m.chrome.preview.closeList}
          onOpen={(countdown) => {
            const target = m.chrome.preview.targetFor(countdown);
            m.chrome.preview.closeList();
            if (target === null) return;
            m.openAt(countdown.targetDate);
            m.editor.openTarget(target);
          }}
        />
      ) : null}

      <EventEditor editor={m.editor} />
      <MealSurfaces m={m.meals.surfaces} />
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
