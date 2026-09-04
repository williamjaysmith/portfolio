"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type KeyboardEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from "react";

import { updateEvent } from "@/lib/family/actions/events";
import { addDays, diffDays, type DateWindow } from "@/lib/family/calendar/dates";
import { repeatChoiceOf } from "@/lib/family/calendar/expand";
import type { LayoutMetrics, TimedSegment } from "@/lib/family/calendar/layout";
import {
  DRAG_SLOP_PX,
  IDLE_DRAG_STATE,
  commitIntentOf,
  dragReducer,
  previewOf,
  promptOf,
  type CommitIntent,
  type ConfirmStep,
  type DragAction,
  type DragGesture,
  type DragMode,
  type DragState,
} from "@/lib/family/drag-state";
import type { ActionResult } from "@/lib/family/errors";
import { familyKeys } from "@/lib/family/queries";
import type {
  Event,
  EventInput,
  EventPatch,
  EventTimes,
  Occurrence,
  TimeFormat,
  UpdateEventInput,
} from "@/lib/family/types";
import {
  NO_GRAB,
  autoScrollVelocity,
  slotFromPoint,
  viewportYToMinutes,
  type DragGrab,
  type DragMetrics,
  type GridMetrics,
  MINUTES_PER_DAY,
  type Point,
  type ResizeEdge,
  type SlotPlacement,
  type TimedPlacement,
} from "@/lib/family/week-geometry";

import { useFamily, type FamilyContextValue } from "../../components/FamilyProvider";
import {
  householdWallInstant,
  isEmptyPatch,
  patchOf,
  rebasedOnSeries,
  type EditTarget,
} from "./event-drafts";
import { GONE_MESSAGE } from "./useCalendarEditor";

/**
 * T055: the DOM adapter of the drag layer (R205) — Pointer Events over the
 * two pure modules, and nothing else. Every decision belongs to them:
 * `week-geometry.ts` says where a pointer lands and what a candidate would
 * be, `drag-state.ts` says what the gesture IS at each moment and when it
 * has earned a write. This hook only measures, listens, throttles and
 * dispatches.
 *
 * What the wiring is, precisely:
 *
 * - **Capture on the grid's stable scroll container**, never on the block.
 *   The block can be refetched away mid-gesture (realtime, R209) and the
 *   container cannot, so the moves keep arriving; a source that really has
 *   gone dispatches `SOURCE_GONE` (below) rather than stranding the drag.
 * - **Distance slop, no timer** (FR-253): `PRESS` on pointerdown, and the
 *   reducer flips to `dragging` at `DRAG_SLOP_PX` of travel. A press that
 *   never travels is a tap and the block's own `onClick` owns it (FR-256).
 * - **rAF-throttled moves**: pointermove only stores the point; one animation
 *   frame loop dispatches it. A move that lands in the slot the pointer is
 *   already in returns the identical state object (drag-state's contract),
 *   so a still finger costs no re-render.
 * - **Auto-scroll** (vertical) and **edge-hold paging** (horizontal) run in
 *   that same loop: the hour viewport scrolls while the pointer hovers an
 *   end of it, and a dwell of `PAGE_HOLD_MS` in a `PAGE_EDGE_PX` side zone
 *   pages the view — R211's cross-week reach, legal under FR-253, which
 *   forbids a timed hold only for STARTING a drag.
 * - **`touch-action: none` on the dragged block** (`handleProps`), the grid
 *   background keeping `pan-y`: the gesture systems partition the surface by
 *   target, so a press on a block is a drag and never a scroll or a swipe
 *   (Assumption 44). The block press also stops propagating, so the week
 *   pager never sees it.
 * - **The frame rebase**: column indices are the RENDERED window's, so when an
 *   edge-hold page moves the window under a live gesture the source placement
 *   is re-pressed shifted by the page distance (the pointer is re-fed at
 *   once, so no second slop crossing is needed). Without it, dragging an
 *   occurrence into the following week would read as a drop where it started
 *   — nothing written, the one case R211's edge-hold exists to serve.
 *
 * jsdom has no layout, so `measureMetrics` is the injection seam the targeted
 * tests use (R213); in the app the metrics are read live at pointer time —
 * `GridMetrics` from T027's measurement, plus the scroll offset, the viewport
 * height and the all-day band's extent read from the two attached nodes.
 *
 * ## After the drop (T057) and without a pointer at all (T058)
 *
 * The gesture is only half the feature. The rest lives at the bottom of this
 * file, in the order it runs:
 *
 * - **the keyboard alternative** (`keyProps`, `dragKeyActionOf`) — Alt+Arrow
 *   moves, Alt+Shift+Arrow resizes an edge, Enter drops, Escape cancels, all
 *   through the SAME reducer, so there is one state machine and not two input
 *   systems to reconcile (FR-263, R205). A keyboard gesture needs no metrics,
 *   which is also what makes a whole drag testable in jsdom;
 * - **the announcement** (`dragAnnouncementOf`) — what each nudge lands on,
 *   in calendar language rather than pixels;
 * - **the drop pipeline** (`useDragCommit`) — FR-250's fixed order: the scope
 *   question first (a repeat only), the punch-in second (FR-248: on drop, and
 *   only when nobody is punched in — FR-275 re-asks after an idle punch-out
 *   mid-drag), then `updateEvent` with the planned patch. There is no drag
 *   action on the server: a committed drag is an edit with a gesture, so the
 *   patch is built by the form's own `event-drafts` diff (contracts). Any
 *   dismissal abandons the pipeline with nothing written (FR-249), and R208's
 *   pending overlay — the block held at its target, in flight, never shown as
 *   saved — lasts until the invalidated week has actually been read back.
 *
 * `DragSurfaceContext` carries the block-level half of that to the drawn
 * blocks. It is a context and not a prop chain because `WeekGrid` and
 * `DayColumn` are presentational and have no stake in a gesture: a read-only
 * grid (every US1 test, and the paint before the first measurement) simply
 * finds `null` there and renders exactly what it always did.
 */

/** R211: how close to a side edge counts as the paging zone. */
export const PAGE_EDGE_PX = 40;

/** R211: how long a drag must dwell in that zone before the view pages. */
export const PAGE_HOLD_MS = 600;

/** A frame gap longer than this is a stall, not motion — do not scroll for it. */
const MAX_FRAME_MS = 64;

/** How long an unconsumed post-drag click suppression may linger. */
const CLICK_SWALLOW_MS = 350;

/** R205's trade, made structural: a press on a block is a drag, never a scroll. */
const BLOCK_TOUCH_STYLE = { touchAction: "none" } as const;

const RELEASE: DragAction = { type: "RELEASE" };
const CANCEL: DragAction = { type: "CANCEL" };

/** What the caller knows about the block being taken hold of. */
export interface DragHandle {
  /** The `events` row the occurrence expands from. */
  eventId: string;
  /** The occurrence's ORIGINAL household-local date — the exception key (R204). */
  occurrenceDate: string;
  /** Whether the drop must ask the scope question (FR-238/250). */
  isRepeating: boolean;
  /**
   * Where the block sits NOW, in the rendered window's grid space: a column
   * index into `columnDates` and wall minutes from that column's midnight.
   * A midnight-crosser's placement is its TRUE range in the grabbed column's
   * frame (an end past 1440 is the next morning — FR-217) — see
   * `timedSourceOf`.
   */
  source: SlotPlacement;
  /** The whole block, or one edge of it (FR-245). */
  mode: DragMode;
  /**
   * The occurrence itself, kept for after the drop: the ghost draws its
   * label and colours (T056), and the commit builds its patch from the
   * occurrence's effective fields — which an edge-hold page into another
   * week (R211) has by then carried out of the rendered set.
   */
  occurrence?: Occurrence;
}

/** Spread on a draggable block, bar or resize edge. */
export interface DragHandleProps {
  onPointerDown: PointerEventHandler<HTMLElement>;
  style: typeof BLOCK_TOUCH_STYLE;
}

/** Spread on a focusable block: the keyboard drag, and what it advertises. */
export interface DragKeyProps {
  onKeyDown: KeyboardEventHandler<HTMLElement>;
  "aria-keyshortcuts": string;
}

/**
 * What a drawn block and its column need from the drag layer — the half of
 * the controller that travels by context (see the module doc).
 */
export interface DragSurface {
  /** Props for one draggable block, bar or resize edge. */
  handleProps: (handle: DragHandle) => DragHandleProps;
  /** Props for the same block's keyboard drag (T058). */
  keyProps: (handle: DragHandle) => DragKeyProps;
  /** Is this occurrence the one under the gesture? (dim it in place — R205) */
  isDragSource: (occurrence: Pick<Occurrence, "eventId" | "occurrenceDate">) => boolean;
  /** Where to draw the ghost (T056) / hold the pending block (R208). */
  preview: SlotPlacement | null;
  /** The dragged occurrence — the ghost's own label and colours; `null` when idle. */
  sourceOccurrence: Occurrence | null;
  /** The household-local date a placement's column index stands for. */
  dateOfColumn: (columnIndex: number) => string;
  /** The measured ruler the ghost is drawn on (T027); `null` while unmeasured. */
  layoutMetrics: LayoutMetrics | null;
}

export interface UseEventDragOptions {
  /** The measured grid (T027); `null` → nothing can be dragged yet. */
  metrics: GridMetrics | null;
  /** The same measurement in layout's terms — the ghost's ruler (T056). */
  layoutMetrics?: LayoutMetrics | null;
  /** The displayed window's household-local dates — column 0 first. */
  columnDates: readonly string[];
  /** The displayed window's first day (R207): a page is not a vanished source. */
  windowStart: string;
  /** The mounted window's occurrences — the source leaving them is `SOURCE_GONE`. */
  occurrences: readonly Occurrence[];
  /** R211's edge-hold: page one window earlier (-1) or later (+1). */
  onPage?: (direction: -1 | 1) => void;
  /** Test seam (R213) — jsdom has no layout, so the metrics are injected. */
  measureMetrics?: () => DragMetrics | null;
}

export interface EventDragController extends DragSurface {
  /**
   * The same block-level members as one object, for `DragSurfaceContext`.
   * Destructure it at the call site (`const { surface, … } = useEventDrag()`)
   * — a controller held whole and read member-by-member during render is a
   * ref read, which is neither safe nor allowed.
   */
  surface: DragSurface;
  /** The machine's state — `idle` between gestures. */
  state: DragState;
  /** The live gesture in every non-idle state; `null` when idle. */
  gesture: DragGesture | null;
  /** Which dialog T057 must mount — `null` before the drop (FR-248). */
  prompt: ConfirmStep | null;
  /** The write, non-null only while it should be in flight (T057). */
  commitIntent: CommitIntent | null;
  /** True from the slop flip until the gesture ends. */
  isDragging: boolean;
  /** Attach to the grid's scrolling hour viewport (compose with T027/T034). */
  viewportRef: (node: HTMLElement | null) => void;
  /** Attach to the all-day band — the FR-244/251 drop surface. */
  bandRef: (node: HTMLElement | null) => void;
  /** The pipeline's inbox (T057) and the keyboard path's (T058). */
  dispatch: DragDispatch;
}

/** The reducer's inbox — the commit pipeline (T057) and keyboard (T058) type against it. */
export type DragDispatch = (action: DragAction) => void;

/** A mutable box — what `useRef` hands back, named so the plumbing reads. */
type Box<T> = { current: T };

/** Where the gesture's column indices are counted from, and in which window. */
interface DragFrame {
  /** `columnDates[0]` when the frame was set. */
  columnStart: string;
  /** The displayed window's first day when the frame was set. */
  windowStart: string;
}

/**
 * Everything the gesture mutates between renders. It is one stable object so
 * the listeners, the frame loop and the module-level steps below can all be
 * written as plain functions of `(refs, dispatch, …)` — which is what keeps
 * this adapter a set of small pieces instead of one closure-heavy hook.
 */
interface DragRefs {
  options: Box<UseEventDragOptions>;
  state: Box<DragState>;
  viewport: Box<HTMLElement | null>;
  band: Box<HTMLElement | null>;
  pointerId: Box<number | null>;
  point: Box<Point | null>;
  frame: Box<DragFrame | null>;
  /** Undo for the post-drag click suppression, while one is armed. */
  swallow: Box<(() => void) | null>;
}

type PointerListeners = Record<
  "pointermove" | "pointerup" | "pointercancel",
  (event: PointerEvent) => void
>;

interface PointerSurface {
  viewportRef: (node: HTMLElement | null) => void;
  bandRef: (node: HTMLElement | null) => void;
  handleProps: (handle: DragHandle) => DragHandleProps;
  keyProps: (handle: DragHandle) => DragKeyProps;
}

/**
 * Where the pressed occurrence is put. It is REACT STATE and not a ref: the
 * ghost and the commit both read it while rendering, and a value read during
 * a render has to be state or the render can miss it.
 */
type SetSource = (occurrence: Occurrence | null) => void;

/** An in-progress dwell in a side edge zone (R211). */
interface EdgeHold {
  direction: -1 | 1 | null;
  since: number;
}

const NO_HOLD: EdgeHold = { direction: null, since: 0 };

/** The frame loop's own memory — one object mutated in place per gesture. */
interface LoopState {
  previous: number | null;
  hold: EdgeHold;
}

export function useEventDrag(options: UseEventDragOptions): EventDragController {
  const [state, dispatch] = useReducer(dragReducer, IDLE_DRAG_STATE);
  const [pressed, setPressed] = useState<Occurrence | null>(null);
  const refs = useDragRefs(options, state);
  const liveGesture = liveGestureOf(state);

  const surface = usePointerSurface(refs, dispatch, setPressed);
  useDragLoop(refs, dispatch, liveGesture !== null);
  useEscapeKey(dispatch, liveGesture !== null);
  useFrameRebase(refs, dispatch, options.columnDates);
  useSourceWatch(refs, dispatch, liveGesture, options.occurrences, options.windowStart);

  const gesture = state.kind === "idle" ? null : state.gesture;
  const { columnDates } = options;

  const isDragSource = useCallback(
    (occurrence: Pick<Occurrence, "eventId" | "occurrenceDate">) =>
      gesture !== null &&
      gesture.eventId === occurrence.eventId &&
      gesture.occurrenceDate === occurrence.occurrenceDate,
    [gesture],
  );

  const dateOfColumn = useCallback(
    (columnIndex: number) => dateOfColumnIn(columnDates, columnIndex),
    [columnDates],
  );

  // Set in the same handler that dispatches `PRESS`, so the render that shows
  // the gesture is the render that has its occurrence; between gestures the
  // last one is simply not read.
  const sourceOccurrence = gesture === null ? null : pressed;

  const blockSurface = useMemo<DragSurface>(
    () => ({
      handleProps: surface.handleProps,
      keyProps: surface.keyProps,
      isDragSource,
      preview: previewOf(state),
      sourceOccurrence,
      dateOfColumn,
      layoutMetrics: options.layoutMetrics ?? null,
    }),
    [surface, isDragSource, state, sourceOccurrence, dateOfColumn, options.layoutMetrics],
  );

  return useMemo(
    () => ({
      state,
      gesture,
      prompt: promptOf(state),
      commitIntent: commitIntentOf(state),
      isDragging: state.kind === "dragging",
      dispatch,
      surface: blockSurface,
      ...blockSurface,
      viewportRef: surface.viewportRef,
      bandRef: surface.bandRef,
    }),
    [state, gesture, dispatch, blockSurface, surface],
  );
}

/* -------------------------------------------------------- the sub-hooks -- */

/**
 * The gesture's mutable slots: one `useRef` each, gathered into one stable
 * object so every step below can be a plain function of `(refs, …)`. The
 * gathering is a memo and not a ref of its own — the controller's handlers
 * close over this object while the VIEW reads the controller during render
 * (the ghost, the prompt, the announcement), and a ref's `current` is not a
 * value a render may read.
 */
function useDragRefs(options: UseEventDragOptions, state: DragState): DragRefs {
  const optionsBox = useRef(options);
  const stateBox = useRef(state);
  const viewport = useRef<HTMLElement | null>(null);
  const band = useRef<HTMLElement | null>(null);
  const pointerId = useRef<number | null>(null);
  const point = useRef<Point | null>(null);
  const frame = useRef<DragFrame | null>(null);
  const swallow = useRef<(() => void) | null>(null);

  const refs = useMemo<DragRefs>(
    () => ({
      options: optionsBox,
      state: stateBox,
      viewport,
      band,
      pointerId,
      point,
      frame,
      swallow,
    }),
    [],
  );

  // The mirror: event handlers and the frame loop read the CURRENT options
  // and state without re-binding, and an effect is where a ref may be written.
  useEffect(() => {
    optionsBox.current = options;
    stateBox.current = state;
  });

  return refs;
}

/**
 * The pointer wiring: `pointerdown` on a block starts a gesture, and the
 * move/up/cancel listeners live on the **scroll container** for the life of
 * the attachment — so a block refetched away mid-gesture takes nothing with
 * it (the capture is on the container too).
 */
function usePointerSurface(
  refs: DragRefs,
  dispatch: DragDispatch,
  setSource: SetSource,
): PointerSurface {
  const listeners = useMemo<PointerListeners>(
    () => ({
      pointermove: (event) => trackPointer(refs, event),
      pointerup: (event) => finishGesture(refs, dispatch, event, RELEASE),
      pointercancel: (event) => finishGesture(refs, dispatch, event, CANCEL),
    }),
    [refs, dispatch],
  );

  const viewportRef = useCallback(
    (node: HTMLElement | null) => attachViewport(refs, listeners, node),
    [refs, listeners],
  );

  const bandRef = useCallback(
    (node: HTMLElement | null) => attachBand(refs, node),
    [refs],
  );

  const handleProps = useCallback(
    (handle: DragHandle): DragHandleProps => ({
      style: BLOCK_TOUCH_STYLE,
      onPointerDown: (event) => beginGesture(refs, dispatch, setSource, handle, event),
    }),
    [refs, dispatch, setSource],
  );

  const keyProps = useCallback(
    (handle: DragHandle): DragKeyProps => ({
      "aria-keyshortcuts": DRAG_KEY_SHORTCUTS,
      onKeyDown: (event) => pressKey(refs, dispatch, setSource, handle, event),
    }),
    [refs, dispatch, setSource],
  );

  useEffect(() => () => clearSwallow(refs), [refs]);

  return useMemo(
    () => ({ viewportRef, bandRef, handleProps, keyProps }),
    [viewportRef, bandRef, handleProps, keyProps],
  );
}

/**
 * The one animation frame loop, alive only while a gesture is on the pointer:
 * it dispatches the stored point (the rAF throttle), scrolls the hour
 * viewport at the planner's velocity, and counts the edge-hold dwell.
 */
function useDragLoop(refs: DragRefs, dispatch: DragDispatch, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const loop: LoopState = { previous: null, hold: NO_HOLD };
    let handle = 0;
    const onFrame = (timestamp: number): void => {
      handle = requestAnimationFrame(onFrame);
      stepFrame(refs, dispatch, loop, timestamp);
    };
    handle = requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(handle);
  }, [refs, dispatch, active]);
}

/**
 * Escape belongs to the pre-drop gesture only: once a prompt is up the dialog
 * owns its own dismissal (T057), and a write in flight is not cancellable.
 */
function useEscapeKey(dispatch: DragDispatch, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") dispatch({ type: "ESCAPE" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, active]);
}

/**
 * Column indices are the RENDERED window's, so a page under a live gesture
 * re-frames it (see the module doc: without this, dragging an occurrence into
 * the following week reads as a drop where it started).
 */
function useFrameRebase(
  refs: DragRefs,
  dispatch: DragDispatch,
  columnDates: readonly string[],
): void {
  useEffect(() => {
    reframe(refs, dispatch, columnDates);
  }, [refs, dispatch, columnDates]);
}

/**
 * A realtime refetch (R209) can take the dragged block out of the window under
 * the gesture. While the pressed window is still the rendered one that means it
 * was deleted or re-homed — `SOURCE_GONE`; once an edge-hold page has carried
 * the gesture into another window the source is legitimately absent from what
 * is rendered, and the gesture carries on.
 */
function useSourceWatch(
  refs: DragRefs,
  dispatch: DragDispatch,
  gesture: DragGesture | null,
  occurrences: readonly Occurrence[],
  windowStart: string,
): void {
  useEffect(() => {
    if (gesture === null || !pressedInWindow(refs, windowStart)) return;
    if (!isRendered(occurrences, gesture)) dispatch({ type: "SOURCE_GONE" });
  }, [refs, dispatch, gesture, occurrences, windowStart]);
}

/* ------------------------------------------------------ gesture steps ---- */

/** The handle as the reducer sees it — the occurrence stays with the adapter. */
function gestureOf(handle: DragHandle, grab: DragGrab): DragGesture {
  return {
    eventId: handle.eventId,
    occurrenceDate: handle.occurrenceDate,
    isRepeating: handle.isRepeating,
    mode: handle.mode,
    source: handle.source,
    grab,
  };
}

/** FR-253: a press arms the gesture; the reducer flips it at the slop. */
function beginGesture(
  refs: DragRefs,
  dispatch: DragDispatch,
  setSource: SetSource,
  handle: DragHandle,
  event: ReactPointerEvent<HTMLElement>,
): void {
  if (!event.isPrimary || event.button !== 0) return;
  const node = refs.viewport.current;
  const metrics = measureOf(refs);
  if (node === null || metrics === null) return;
  // R205/R211: the week pager and any enclosing surface must not see a press
  // that belongs to a block — the surfaces partition by target.
  event.stopPropagation();
  clearSwallow(refs);
  const origin: Point = { x: event.clientX, y: event.clientY };
  if (!captureOn(node, event.pointerId)) return;
  refs.pointerId.current = event.pointerId;
  refs.point.current = origin;
  refs.frame.current = frameOf(refs.options.current);
  setSource(handle.occurrence ?? null);
  dispatch({
    type: "PRESS",
    gesture: gestureOf(handle, grabOf(handle.mode, handle.source, metrics, origin)),
    point: origin,
  });
}

/** pointerup and pointercancel: give the capture back, then end the gesture. */
function finishGesture(
  refs: DragRefs,
  dispatch: DragDispatch,
  event: PointerEvent,
  action: DragAction,
): void {
  const id = refs.pointerId.current;
  if (id === null || event.pointerId !== id) return;
  refs.pointerId.current = null;
  releaseFrom(refs.viewport.current, id);
  if (action.type === "RELEASE") dropAt(refs, dispatch, event);
  dispatch(action);
}

/** The drop: the final pointer position, and the click it is about to spawn. */
function dropAt(refs: DragRefs, dispatch: DragDispatch, event: PointerEvent): void {
  const at: Point = { x: event.clientX, y: event.clientY };
  refs.point.current = at;
  // The browser's click after a real drag would open details on top of the
  // drop's own prompt (FR-256 against FR-248) — swallow exactly that one.
  if (refs.state.current.kind === "dragging") refs.swallow.current = swallowNextClick();
  dispatchMoveAt(refs, dispatch, at);
}

/** rAF throttling, the whole of it: a move only records where the pointer is. */
function trackPointer(refs: DragRefs, event: PointerEvent): void {
  if (event.pointerId !== refs.pointerId.current) return;
  refs.point.current = { x: event.clientX, y: event.clientY };
}

/** One animation frame of a live gesture. */
function stepFrame(
  refs: DragRefs,
  dispatch: DragDispatch,
  loop: LoopState,
  timestamp: number,
): void {
  const at = refs.point.current;
  const metrics = measureOf(refs);
  const elapsed = loop.previous === null ? 0 : timestamp - loop.previous;
  loop.previous = timestamp;
  if (at === null || metrics === null) return;
  if (refs.state.current.kind === "dragging") {
    scrollBy(refs.viewport.current, autoScrollVelocity(metrics, at.y), elapsed);
    loop.hold = heldOn(loop.hold, edgeDirectionOf(metrics, at.x), timestamp, refs.options.current);
  }
  dispatchMoveAt(refs, dispatch, at);
}

/** The window moved: record the new frame, and re-press what is mid-gesture. */
function reframe(refs: DragRefs, dispatch: DragDispatch, columnDates: readonly string[]): void {
  const current = refs.frame.current;
  const columnStart = columnDates[0];
  if (current === null || columnStart === undefined || columnStart === current.columnStart) return;
  // The frame keeps the window the gesture was PRESSED in: once an edge-hold
  // page has carried the drag into another window the source is legitimately
  // absent from what is rendered, and `useSourceWatch` must not read that
  // as a block deleted underneath the gesture.
  refs.frame.current = { columnStart, windowStart: current.windowStart };
  rebaseFrame(refs, dispatch, diffDays(current.columnStart, columnStart));
}

/** The re-press that carries a live gesture into a window that has moved. */
function rebaseFrame(refs: DragRefs, dispatch: DragDispatch, shiftDays: number): void {
  const gesture = liveGestureOf(refs.state.current);
  const at = refs.point.current;
  const metrics = measureOf(refs);
  if (gesture === null || at === null || metrics === null || shiftDays === 0) return;
  // The origin sits a slop behind the pointer and the live point is re-fed at
  // once, so the drag continues without a second slop crossing.
  dispatch({
    type: "PRESS",
    gesture: rebased(gesture, shiftDays),
    point: { x: at.x - DRAG_SLOP_PX - 1, y: at.y },
  });
  dispatch({ type: "POINTER_MOVE", point: at, metrics });
}

function dispatchMoveAt(refs: DragRefs, dispatch: DragDispatch, at: Point): void {
  const metrics = measureOf(refs);
  if (metrics !== null) dispatch({ type: "POINTER_MOVE", point: at, metrics });
}

/* --------------------------------------------------------- pure parts ---- */

/** The gesture while it is still on the pointer (pre-drop); `null` otherwise. */
function liveGestureOf(state: DragState): DragGesture | null {
  return state.kind === "armed" || state.kind === "dragging" ? state.gesture : null;
}

function frameOf(options: UseEventDragOptions): DragFrame {
  return {
    columnStart: options.columnDates[0] ?? options.windowStart,
    windowStart: options.windowStart,
  };
}

function pressedInWindow(refs: DragRefs, windowStart: string): boolean {
  const frame = refs.frame.current;
  return frame === null || frame.windowStart === windowStart;
}

function isRendered(occurrences: readonly Occurrence[], gesture: DragGesture): boolean {
  return occurrences.some(
    (occurrence) =>
      occurrence.eventId === gesture.eventId &&
      occurrence.occurrenceDate === gesture.occurrenceDate,
  );
}

function dateOfColumnIn(columnDates: readonly string[], columnIndex: number): string {
  const columnStart = columnDates[0];
  if (columnStart === undefined) {
    throw new Error("the drag layer needs at least one rendered column date");
  }
  return addDays(columnStart, columnIndex);
}

/** Where inside the block the press landed, so a move keeps it under the finger. */
function grabOf(mode: DragMode, source: SlotPlacement, metrics: DragMetrics, at: Point): DragGrab {
  // A resize drags an edge to the pointer; there is no offset to keep.
  if (mode.kind === "resize") return NO_GRAB;
  if (!source.allDay) {
    const offsetMinutes = viewportYToMinutes(metrics, at.y) - source.startMinutes;
    return { offsetMinutes, offsetDays: 0 };
  }
  const target = slotFromPoint(metrics, at);
  const column = target === null ? source.startColumnIndex : target.columnIndex;
  return { offsetMinutes: 0, offsetDays: column - source.startColumnIndex };
}

/** The same gesture read in a window that has moved `shiftDays` days later. */
function rebased(gesture: DragGesture, shiftDays: number): DragGesture {
  return { ...gesture, source: shiftPlacement(gesture.source, shiftDays) };
}

function shiftPlacement(placement: SlotPlacement, shiftDays: number): SlotPlacement {
  if (placement.allDay) {
    return {
      ...placement,
      startColumnIndex: placement.startColumnIndex - shiftDays,
      endColumnIndex: placement.endColumnIndex - shiftDays,
    };
  }
  return { ...placement, columnIndex: placement.columnIndex - shiftDays };
}

/** Which side zone the pointer is in, or `null` for the middle of the grid. */
function edgeDirectionOf(metrics: DragMetrics, x: number): -1 | 1 | null {
  const right = metrics.gridLeftPx + metrics.columnCount * metrics.columnWidthPx;
  if (x < metrics.gridLeftPx + PAGE_EDGE_PX) return -1;
  if (x > right - PAGE_EDGE_PX) return 1;
  return null;
}

/** R211's dwell: page once the hold matures, then re-arm for the next page. */
function heldOn(
  hold: EdgeHold,
  direction: -1 | 1 | null,
  now: number,
  options: UseEventDragOptions,
): EdgeHold {
  if (direction === null) return NO_HOLD;
  if (direction !== hold.direction) return { direction, since: now };
  if (now - hold.since < PAGE_HOLD_MS) return hold;
  options.onPage?.(direction);
  return { direction, since: now };
}

/* ---------------------------------------------------------- DOM plumbing - */

/** The auto-scroll step for one frame (the velocity is the planner's). */
function scrollBy(node: HTMLElement | null, velocityPxPerSecond: number, elapsedMs: number): void {
  if (node === null || velocityPxPerSecond === 0) return;
  node.scrollTop += (velocityPxPerSecond * Math.min(elapsedMs, MAX_FRAME_MS)) / 1000;
}

/**
 * The live measurement: T027's `GridMetrics` for the ruler and the columns,
 * plus the three lengths only a drag needs, read from the attached nodes at
 * pointer time (the scroll offset moves every frame while auto-scrolling).
 */
function measureOf(refs: DragRefs): DragMetrics | null {
  const { metrics, measureMetrics } = refs.options.current;
  if (measureMetrics !== undefined) return measureMetrics();
  return liveMetrics(metrics, refs.viewport.current, refs.band.current);
}

function liveMetrics(
  metrics: GridMetrics | null,
  viewport: HTMLElement | null,
  band: HTMLElement | null,
): DragMetrics | null {
  if (metrics === null || viewport === null || viewport.clientHeight <= 0) return null;
  const rect = viewport.getBoundingClientRect();
  const bandRect = band === null ? null : band.getBoundingClientRect();
  return {
    ...metrics,
    gridTopPx: rect.top,
    scrollTopPx: viewport.scrollTop,
    viewportHeightPx: viewport.clientHeight,
    bandTopPx: bandRect === null ? rect.top : bandRect.top,
    bandHeightPx: bandRect === null ? 0 : bandRect.height,
  };
}

function attachBand(refs: DragRefs, node: HTMLElement | null): void {
  refs.band.current = node;
}

function attachViewport(
  refs: DragRefs,
  listeners: PointerListeners,
  node: HTMLElement | null,
): void {
  const previous = refs.viewport.current;
  if (previous !== null) unbind(previous, listeners);
  refs.viewport.current = node;
  if (node !== null) bind(node, listeners);
}

function bind(node: HTMLElement, listeners: PointerListeners): void {
  node.addEventListener("pointermove", listeners.pointermove);
  node.addEventListener("pointerup", listeners.pointerup);
  node.addEventListener("pointercancel", listeners.pointercancel);
}

function unbind(node: HTMLElement, listeners: PointerListeners): void {
  node.removeEventListener("pointermove", listeners.pointermove);
  node.removeEventListener("pointerup", listeners.pointerup);
  node.removeEventListener("pointercancel", listeners.pointercancel);
}

/**
 * Capture is best-effort: the pointer can be gone before we ask for it — a
 * release inside the same frame, or an iOS `pointercancel` — and the DOM
 * answers that with a throw. A drag that cannot hold the pointer is simply
 * not armed; throwing out of the handler would leave the gesture half-built.
 */
function captureOn(node: HTMLElement, id: number): boolean {
  if (typeof node.setPointerCapture !== "function") return true;
  try {
    node.setPointerCapture(id);
    return true;
  } catch {
    return false;
  }
}

function releaseFrom(node: HTMLElement | null, id: number): void {
  if (node === null || typeof node.releasePointerCapture !== "function") return;
  // Symmetrically best-effort: the pointer may already be released.
  try {
    node.releasePointerCapture(id);
  } catch {
    // The capture is gone, which is the state we wanted.
  }
}

function clearSwallow(refs: DragRefs): void {
  refs.swallow.current?.();
  refs.swallow.current = null;
}

/** Eat the one click a finished drag produces; returns its own undo. */
function swallowNextClick(): () => void {
  const swallow = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    remove();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  // A gesture that ends without a click (a cancelled tap on touch) must not
  // leave a listener behind to eat an unrelated one later.
  const timer = window.setTimeout(() => remove(), CLICK_SWALLOW_MS);
  function remove(): void {
    window.clearTimeout(timer);
    window.removeEventListener("click", swallow, { capture: true });
  }
  return remove;
}

/* ========================================================================= *
 * T058 — the keyboard alternative (FR-263, R205)
 *
 * The same reducer, driven by keys instead of a pointer. Nothing here
 * simulates pixels: a nudge is a slot-semantic `KEY_MOVE`/`KEY_RESIZE` that
 * accumulates from where the block currently is, so the announcement can say
 * a day and a clock time rather than a delta. The always-available baseline
 * is unchanged — a block's press still opens details, and the form still
 * sets exact times (FR-256/257); this is the direct route for someone who
 * cannot drag.
 * ========================================================================= */

/** What the block advertises to assistive technology (FR-263). */
export const DRAG_KEY_SHORTCUTS =
  "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowUp " +
  "Alt+Shift+ArrowDown Alt+Shift+ArrowLeft Alt+Shift+ArrowRight Enter Escape";

/** A keyboard gesture has no pointer position, and never needs one. */
const KEY_ORIGIN: Point = { x: 0, y: 0 };

const ESCAPE: DragAction = { type: "ESCAPE" };

interface ArrowMove {
  readonly days: number;
  readonly steps: number;
}

interface ArrowResize {
  readonly edge: ResizeEdge;
  readonly steps: number;
}

/** Alt+Arrow: sideways by whole days, up and down by whole snap steps. */
const ARROW_MOVES: Readonly<Record<string, ArrowMove | undefined>> = {
  ArrowLeft: { days: -1, steps: 0 },
  ArrowRight: { days: 1, steps: 0 },
  ArrowUp: { days: 0, steps: -1 },
  ArrowDown: { days: 0, steps: 1 },
};

/**
 * Alt+Shift+Arrow: one edge, one step (FR-245). Up and down work the END
 * edge — the block's bottom, where a duration is usually adjusted — and left
 * and right the START, so both edges are reachable and no arrow is dead.
 */
const ARROW_RESIZES: Readonly<Record<string, ArrowResize | undefined>> = {
  ArrowLeft: { edge: "start", steps: -1 },
  ArrowRight: { edge: "start", steps: 1 },
  ArrowUp: { edge: "end", steps: -1 },
  ArrowDown: { edge: "end", steps: 1 },
};

/** Only what a keypress needs to be read as a drag action. */
export interface DragKeyEvent {
  readonly key: string;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

/**
 * A keypress as a reducer action, or `null` for every key that is not part
 * of the drag: Enter drops (the same transition as a pointerup), Escape
 * cancels, and the arrows only ever mean anything with Alt held — a plain
 * arrow belongs to the grid's own scrolling.
 */
export function dragKeyActionOf(event: DragKeyEvent): DragAction | null {
  if (event.key === "Enter") return RELEASE;
  if (event.key === "Escape") return ESCAPE;
  if (!event.altKey) return null;
  if (event.shiftKey) {
    const resize = ARROW_RESIZES[event.key];
    return resize === undefined ? null : { type: "KEY_RESIZE", ...resize };
  }
  const move = ARROW_MOVES[event.key];
  return move === undefined ? null : { type: "KEY_MOVE", ...move };
}

function sameOccurrence(
  gesture: Pick<DragGesture, "eventId" | "occurrenceDate">,
  handle: DragHandle,
): boolean {
  return gesture.eventId === handle.eventId && gesture.occurrenceDate === handle.occurrenceDate;
}

/** The first nudge IS the drag — there is no slop to cross on a keyboard. */
function startKeyGesture(
  refs: DragRefs,
  dispatch: DragDispatch,
  setSource: SetSource,
  handle: DragHandle,
): void {
  clearSwallow(refs);
  // No pointer is involved, so the frame loop must not replay the last one's
  // position over the keyboard's candidate.
  refs.pointerId.current = null;
  refs.point.current = null;
  refs.frame.current = frameOf(refs.options.current);
  setSource(handle.occurrence ?? null);
  dispatch({ type: "PRESS", gesture: gestureOf(handle, NO_GRAB), point: KEY_ORIGIN });
}

function pressKey(
  refs: DragRefs,
  dispatch: DragDispatch,
  setSource: SetSource,
  handle: DragHandle,
  event: ReactKeyboardEvent<HTMLElement>,
): void {
  const action = dragKeyActionOf(event);
  if (action === null) return;
  const state = refs.state.current;
  if (state.kind === "idle") {
    // Enter and Escape mean nothing until a drag is under way: Enter is still
    // the block's own activation, opening details (FR-256).
    if (action.type !== "KEY_MOVE" && action.type !== "KEY_RESIZE") return;
    startKeyGesture(refs, dispatch, setSource, handle);
  } else if (!sameOccurrence(state.gesture, handle)) {
    return;
  }
  // Enter must not ALSO fire the button's click (details on top of the drop's
  // own prompt), and an arrow must not scroll the grid out from under it.
  event.preventDefault();
  event.stopPropagation();
  dispatch(action);
}

/* ---------------------------------------------- the announcement (FR-263) - */

const MINUTES_PER_HOUR = 60;
const MINUTE_MS = 60_000;

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

/** What the announcement needs from the view — the column's dates and its clock. */
export interface DragAnnouncementView {
  dateOfColumn: (columnIndex: number) => string;
  timeFormat: TimeFormat;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** A plain `YYYY-MM-DD` read as itself — no zone enters an announcement. */
function dayLabelOf(date: string): string {
  return dayLabelFormatter.format(Date.parse(`${date}T00:00:00Z`));
}

/** Wall minutes as the household's own clock, whichever day they land on. */
function clockLabelOf(minutes: number, timeFormat: TimeFormat): string {
  const wall = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(wall / MINUTES_PER_HOUR);
  const minute = wall % MINUTES_PER_HOUR;
  if (timeFormat === "24h") return `${pad2(hour)}:${pad2(minute)}`;
  const twelve = ((hour + 11) % 12) + 1;
  return `${twelve}:${pad2(minute)} ${hour < 12 ? "AM" : "PM"}`;
}

function placementLabelOf(placement: SlotPlacement, view: DragAnnouncementView): string {
  if (placement.allDay) {
    return `all day, ${dayLabelOf(view.dateOfColumn(placement.startColumnIndex))}`;
  }
  const day = dayLabelOf(view.dateOfColumn(placement.columnIndex));
  const from = clockLabelOf(placement.startMinutes, view.timeFormat);
  const to = clockLabelOf(placement.endMinutes, view.timeFormat);
  return `${day}, ${from} – ${to}`;
}

/**
 * The drag said in calendar language: where the block would land, or that
 * the gesture has nowhere to land, or that a write is in flight. Empty for
 * every state that speaks for itself — a mounted dialog announces itself,
 * and a gesture that has ended has left the block visibly where it was
 * (FR-249: nothing was written, so there is nothing to report).
 *
 * Pure, so the live region is a plain function of the machine's state: no
 * transition history, no state of its own, nothing to fall out of step with
 * what the grid is drawing.
 */
export function dragAnnouncementOf(state: DragState, view: DragAnnouncementView): string {
  if (state.kind === "dragging") {
    if (state.candidate === null) return "No slot there.";
    const verb = state.gesture.mode.kind === "resize" ? "Resizing to" : "Moving to";
    return `${verb} ${placementLabelOf(state.candidate, view)}`;
  }
  if (state.kind === "committing") return "Saving the move…";
  return "";
}

/* ------------------------------------------------- the block-level surface - */

/**
 * The drag surface a drawn block reaches for, or `null` in a read-only grid.
 * `WeekView` provides the controller itself.
 */
export const DragSurfaceContext = createContext<DragSurface | null>(null);

export function useDragSurface(): DragSurface | null {
  return useContext(DragSurfaceContext);
}

/**
 * The dragged block's TRUE range in the grabbed column's frame. `layout`
 * clips each drawn segment to its own column (FR-217), which would tell a
 * move that a 22:00–02:00 event lasts two hours; the occurrence's stored
 * times say how long it really is, and the open edge says which end of it
 * this column shows.
 */
export function timedSourceOf(segment: TimedSegment): TimedPlacement {
  const { columnIndex, startMinutes, endMinutes } = segment;
  const spanMinutes = timedSpanOf(segment.occurrence.times);
  if (spanMinutes === null || !segment.continuesFromPrevious) {
    const end = spanMinutes === null ? endMinutes : startMinutes + spanMinutes;
    return { allDay: false, columnIndex, startMinutes, endMinutes: end };
  }
  // The block began in an earlier column: its start is before this midnight.
  if (!segment.continuesToNext) {
    return { allDay: false, columnIndex, startMinutes: endMinutes - spanMinutes, endMinutes };
  }
  // Longer than the whole column — neither edge is in this frame, so the drag
  // reads the block as beginning where it is drawn.
  return { allDay: false, columnIndex, startMinutes, endMinutes: startMinutes + spanMinutes };
}

function timedSpanOf(times: EventTimes): number | null {
  if (times.allDay) return null;
  return (Date.parse(times.endsAt) - Date.parse(times.startsAt)) / MINUTE_MS;
}

/** Everything one column needs to draw the ghost (T056), or `null`. */
export interface DragGhost {
  occurrence: Occurrence;
  placement: TimedPlacement;
  metrics: LayoutMetrics;
}

/**
 * The ghost for the column showing `date` — the candidate lands here, it is
 * timed (an all-day candidate belongs to the band), the dragged occurrence
 * is known and the grid has been measured. Anything else draws nothing.
 */
export function dragGhostOf(surface: DragSurface | null, date: string): DragGhost | null {
  if (surface === null) return null;
  const { preview, sourceOccurrence, layoutMetrics } = surface;
  if (preview === null || preview.allDay) return null;
  if (sourceOccurrence === null || layoutMetrics === null) return null;
  if (surface.dateOfColumn(preview.columnIndex) !== date) return null;
  return { occurrence: sourceOccurrence, placement: preview, metrics: layoutMetrics };
}

/* ========================================================================= *
 * T057 — the drop pipeline
 *
 * There is no drag action on the server (contracts): a committed drag is
 * `updateEvent` with new times and, on a repeat, the chosen scope. The patch
 * is therefore built with the FORM's own diff — the candidate is turned into
 * the submission an equivalent edit would have made, and `event-drafts`
 * decides what actually changed. A drag can then never write a field the
 * form would not, and scope `all` gets the same re-anchoring onto the
 * series' own start that keeps earlier occurrences from vanishing.
 * ========================================================================= */

const COMMIT: DragAction = { type: "COMMIT" };
const COMMIT_SETTLED: DragAction = { type: "COMMIT_SETTLED" };
const COMMIT_FAILED: DragAction = { type: "COMMIT_FAILED" };
const PUNCH_IN_DISMISSED: DragAction = { type: "PUNCH_IN_DISMISSED" };
const PUNCH_IN_REFUSED: DragAction = { type: "PUNCH_IN_REFUSED" };

/** A candidate as STORED times: grid space → the household's clock (FR-284). */
export function placementTimesOf(
  candidate: SlotPlacement,
  dateOfColumn: (columnIndex: number) => string,
  zone: string,
): EventTimes {
  if (candidate.allDay) {
    return {
      allDay: true,
      startDate: dateOfColumn(candidate.startColumnIndex),
      endDate: dateOfColumn(candidate.endColumnIndex),
    };
  }
  // Minutes outside 0–1440 are the day before or after (FR-217); the wall
  // instant is counted from this column's midnight either way.
  const date = dateOfColumn(candidate.columnIndex);
  return {
    allDay: false,
    startsAt: instantOf(zone, date, candidate.startMinutes),
    endsAt: instantOf(zone, date, candidate.endMinutes),
  };
}

function instantOf(zone: string, date: string, minutes: number): string {
  return new Date(householdWallInstant(zone, date, minutes)).toISOString();
}

/**
 * The dragged occurrence with its new times — the submission an equivalent
 * edit would have made, so the form's diff can be reused verbatim. Every
 * other field is the occurrence's own effective value, and therefore
 * unchanged: a drag moves an event, it does not retitle one.
 */
function draggedInputOf(target: EditTarget, times: EventTimes, zone: string): EventInput {
  const { occurrence, event } = target;
  const rest = {
    summary: occurrence.summary,
    description: occurrence.description,
    location: occurrence.location,
    // Provenance is written once and is not patchable (FR-224) — carried
    // only because a submission has the field.
    timezone: event.timezone,
    repeat: repeatChoiceOf(event.rrule, zone),
    categoryIds: [...occurrence.categoryIds],
  };
  if (times.allDay) {
    return { ...rest, allDay: true, startDate: times.startDate, endDate: times.endDate };
  }
  return { ...rest, allDay: false, startsAt: times.startsAt, endsAt: times.endsAt };
}

/** The scope fields the action takes: none on a one-off, the key per occurrence. */
function scopedUpdate(intent: CommitIntent, patch: EventPatch): UpdateEventInput {
  const { scope } = intent;
  if (scope === null) return { id: intent.eventId, patch };
  if (scope === "all") return { id: intent.eventId, patch, scope };
  return { id: intent.eventId, patch, scope, occurrenceDate: intent.occurrenceDate };
}

/**
 * The write a committed drag is, or `null` when the drop describes no change
 * at all (the reducer already refuses a same-slot drop; this is the second
 * line, and it is also what keeps a rounding-equal drop from writing).
 */
export function dragUpdateOf(
  intent: CommitIntent,
  target: EditTarget,
  zone: string,
  dateOfColumn: (columnIndex: number) => string,
): UpdateEventInput | null {
  const times = placementTimesOf(intent.candidate, dateOfColumn, zone);
  const input = draggedInputOf(target, times, zone);
  const patch = patchOf(input, target, zone);
  if (isEmptyPatch(patch)) return null;
  const scoped = intent.scope === "all" ? rebasedOnSeries(patch, input, target, zone) : patch;
  return scopedUpdate(intent, scoped);
}

export interface UseDragCommitOptions {
  /** Which prompt is up — `punchIn` is this pipeline's cue (FR-248/250). */
  prompt: ConfirmStep | null;
  /** The write, non-null only while it should be in flight. */
  commitIntent: CommitIntent | null;
  /** The reducer's inbox — every step of the pipeline reports back through it. */
  dispatch: DragDispatch;
  /** The household-local date a candidate's column index stands for. */
  dateOfColumn: (columnIndex: number) => string;
  /** The dragged occurrence as it was picked up — the cross-week fallback. */
  sourceOccurrence: Occurrence | null;
  /** The displayed window — whose cache entry the write invalidates (R207). */
  window: DateWindow;
  /** The rendered window's occurrences — a dropped block's own effective fields. */
  occurrences: readonly Occurrence[];
}

export interface DragCommitState {
  /** FR-288's refusal message; `null` when there is nothing to say. */
  notice: string | null;
}

/** Everything one commit needs, gathered once so each step stays a plain function. */
interface CommitDeps {
  zone: string;
  householdId: string;
  window: DateWindow;
  queryClient: QueryClient;
  occurrences: readonly Occurrence[];
  sourceOccurrence: Occurrence | null;
  dateOfColumn: (columnIndex: number) => string;
  withActor: FamilyContextValue["withActor"];
  dispatch: DragDispatch;
  setNotice: (notice: string | null) => void;
}

/**
 * The dragged event's row, from whichever cached window holds it. Usually the
 * mounted one; after an edge-hold page (R211) a one-off's row belongs to the
 * window the gesture started in, which is still in the cache.
 */
function cachedEventRow(
  queryClient: QueryClient,
  householdId: string,
  eventId: string,
): Event | undefined {
  const weeks = queryClient.getQueriesData<Event[]>({ queryKey: familyKeys.events(householdId) });
  for (const [, rows] of weeks) {
    const found = rows?.find((row) => row.id === eventId);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The occurrence and the row every write round-trips. The rendered week is
 * asked first, so a mid-drag refetch's values win; the occurrence captured
 * at the press is the fallback for the cross-week drag, where the source is
 * legitimately no longer in what is rendered.
 */
function dragTargetOf(deps: CommitDeps, intent: CommitIntent): EditTarget | null {
  const occurrence =
    deps.occurrences.find(
      (candidate) =>
        candidate.eventId === intent.eventId &&
        candidate.occurrenceDate === intent.occurrenceDate,
    ) ?? deps.sourceOccurrence;
  const event = cachedEventRow(deps.queryClient, deps.householdId, intent.eventId);
  if (occurrence === undefined || occurrence === null || event === undefined) return null;
  return { occurrence, event };
}

/** FR-288's messages. A missing actor is not a message — it is a dismissal. */
function refusalNoticeOf(result: ActionResult<unknown>): string | null {
  if (result.ok) return null;
  if (result.error === "NO_ACTOR") return null;
  return result.error === "NOT_FOUND" ? GONE_MESSAGE : result.message;
}

async function commitDrag(deps: CommitDeps, intent: CommitIntent): Promise<void> {
  const target = dragTargetOf(deps, intent);
  if (target === null) {
    // FR-288: the row left the cache between the drop and the write.
    deps.setNotice(GONE_MESSAGE);
    deps.dispatch(COMMIT_FAILED);
    return;
  }
  const input = dragUpdateOf(intent, target, deps.zone, deps.dateOfColumn);
  if (input === null) {
    deps.dispatch(COMMIT_SETTLED);
    return;
  }
  const result = await deps.withActor(() => updateEvent(input));
  if (!result.ok) {
    deps.setNotice(refusalNoticeOf(result));
    deps.dispatch(result.error === "NO_ACTOR" ? PUNCH_IN_REFUSED : COMMIT_FAILED);
    return;
  }
  // R208/SC-206: the block stays drawn at its target — in flight, never
  // "saved" — until the invalidated week has actually been read back.
  await deps.queryClient.invalidateQueries({
    queryKey: familyKeys.week(deps.householdId, deps.window),
  });
  deps.dispatch(COMMIT_SETTLED);
}

/**
 * FR-248: the drop is where identity is demanded, and only when nobody is
 * punched in — FR-275's idle punch-out mid-drag therefore asks again, and
 * someone already punched in is never asked at all (SC-206's "the gesture
 * and nothing else").
 */
function usePunchInGate(
  prompt: ConfirmStep | null,
  hasActor: boolean,
  openPunchIn: FamilyContextValue["openPunchIn"],
  dispatch: DragDispatch,
): void {
  useEffect(() => {
    if (prompt !== "punchIn") return;
    if (hasActor) {
      dispatch(COMMIT);
      return;
    }
    let live = true;
    void openPunchIn().then((session) => {
      if (!live) return;
      dispatch(session === null ? PUNCH_IN_DISMISSED : COMMIT);
    });
    return () => {
      live = false;
    };
  }, [prompt, hasActor, openPunchIn, dispatch]);
}

/**
 * One write per intent. `commitIntentOf` builds a fresh object each render,
 * so the guard — not the dependency list — is what makes this run once.
 */
function useCommitOnce(
  intent: CommitIntent | null,
  run: (intent: CommitIntent) => Promise<void>,
): void {
  const started = useRef(false);
  useEffect(() => {
    if (intent === null) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;
    void run(intent);
  }, [intent, run]);
}

/**
 * The whole of what happens after a drop: the punch-in gate, the write, and
 * the wait for the week to come back. The scope question is the caller's to
 * mount (`drag.prompt === "scope"` → the shared `ScopeDialog`, mode `move`),
 * because the dialog belongs in the view — its ANSWER comes back through
 * `drag.dispatch`, and this pipeline never sees it.
 */
export function useDragCommit({
  prompt,
  commitIntent,
  dispatch,
  dateOfColumn,
  sourceOccurrence,
  window,
  occurrences,
}: UseDragCommitOptions): DragCommitState {
  const { householdId, settings, actor, withActor, openPunchIn } = useFamily();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  usePunchInGate(prompt, actor !== null, openPunchIn, dispatch);

  const run = useCallback(
    (intent: CommitIntent) => {
      setNotice(null);
      return commitDrag(
        {
          zone: settings.timezone,
          householdId,
          window,
          queryClient,
          occurrences,
          sourceOccurrence,
          dateOfColumn,
          withActor,
          dispatch,
          setNotice,
        },
        intent,
      );
    },
    [
      settings.timezone,
      householdId,
      window,
      queryClient,
      occurrences,
      sourceOccurrence,
      dateOfColumn,
      withActor,
      dispatch,
    ],
  );

  useCommitOnce(commitIntent, run);

  return useMemo(() => ({ notice }), [notice]);
}
