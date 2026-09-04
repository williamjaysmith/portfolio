/**
 * Week-grid geometry — the pure px↔minutes core the calendar renders and
 * (later) drags against. FR-204: a timed block is positioned and sized from
 * its start and end times ALONE, measured against the hour ruler; everything
 * here is linear arithmetic on a `GridMetrics` snapshot the grid measures
 * (T027's `useGridGeometry`) — no DOM, no tokens, no constants smuggled in.
 *
 * Two coordinate spaces, converted in both directions:
 *
 * - CONTENT: y within one day column's midnight-to-midnight canvas
 *   (`minutesToOffsetPx` / `offsetPxToMinutes`). Blocks and the now-line are
 *   laid out here and scroll with the canvas.
 * - VIEWPORT: on-screen y through `gridTopPx` and the current `scrollTopPx`
 *   (`minutesToViewportY` / `viewportYToMinutes`). Pointer input arrives
 *   here; US3's `slotFromPoint` builds on these.
 *
 * Conversions are total and UNCLAMPED — fractional minutes out, negatives and
 * beyond-midnight values preserved — because what is "out of range" is the
 * caller's policy: layout clamps to the day, and the drag planners in the
 * second half of this file (T053) snap and validate.
 *
 * Those planners need two lengths the renderers never ask about — the all-day
 * band's extent and the hour viewport's own height (the scroll bound) — so
 * they take `DragMetrics`, `GridMetrics` plus exactly those three numbers.
 * Every field of `GridMetrics` stays where it was: `useGridGeometry`,
 * `NowLine` and `layout` keep measuring and consuming precisely what they
 * did, and the drag layer supplies the rest at pointer time.
 */

/** One day of minutes — the content canvas spans exactly this much time. */
export const MINUTES_PER_DAY = 1440;

/** FR-278's floor — never fewer day columns than this, however narrow. */
export const MIN_COLUMN_COUNT = 3;

/** FR-277's cap — the wall tablet's seven, the widest the week is ever drawn. */
export const MAX_COLUMN_COUNT = 7;

/**
 * Columns rendered before the grid has measured itself — server render and
 * first client paint. It lives here, beside the bounds, because the SERVER
 * fetches this many days too (`calendar/page.tsx`): the seeded rows only land
 * in the window the client first mounts if the two spans agree.
 */
export const DEFAULT_COLUMN_COUNT = MAX_COLUMN_COUNT;

/**
 * A measurement snapshot of the mounted grid, in CSS px. Produced by the
 * grid's ResizeObserver/scroll wiring (T027), consumed pure — geometry never
 * reads the DOM. Horizontal members serve column hit-testing (US3) and the
 * FR-277/278 column count; the vertical trio drives every conversion below.
 */
export interface GridMetrics {
  /** Measured height of one 60-minute hour row. Must be finite and > 0. */
  readonly hourRowPx: number;
  /** Measured width of one day column. */
  readonly columnWidthPx: number;
  /** Day columns currently rendered — 3–7 (FR-277/278). */
  readonly columnCount: number;
  /** Viewport x of the first day column's left edge (hour gutter's right edge). */
  readonly gridLeftPx: number;
  /** Viewport y of the hour viewport's top — where content y `scrollTopPx` is drawn. */
  readonly gridTopPx: number;
  /** Current vertical scroll offset of the hour canvas (FR-280). */
  readonly scrollTopPx: number;
}

/** Raw placement of a timed block within its day column (FR-204). */
export interface BlockOffsets {
  /** Content y of the block's top edge. */
  readonly topPx: number;
  /** Height from duration alone — the FR-218 floor is layout's, not ours. */
  readonly heightPx: number;
}

/** The one guard: every conversion divides or multiplies by this. */
function rowPxOf(metrics: GridMetrics): number {
  const { hourRowPx } = metrics;
  if (!Number.isFinite(hourRowPx) || hourRowPx <= 0) {
    throw new Error(`GridMetrics.hourRowPx must be a positive finite px value, got ${hourRowPx}`);
  }
  return hourRowPx;
}

/** Full height of one day's midnight-to-midnight content canvas. */
export function dayCanvasPx(metrics: GridMetrics): number {
  return (MINUTES_PER_DAY / 60) * rowPxOf(metrics);
}

/** Minutes after local midnight → content y on the day canvas. */
export function minutesToOffsetPx(metrics: GridMetrics, minutes: number): number {
  return (minutes / 60) * rowPxOf(metrics);
}

/** Content y on the day canvas → (fractional) minutes after local midnight. */
export function offsetPxToMinutes(metrics: GridMetrics, offsetPx: number): number {
  return (offsetPx / rowPxOf(metrics)) * 60;
}

/** Minutes after local midnight → on-screen y at the current scroll offset. */
export function minutesToViewportY(metrics: GridMetrics, minutes: number): number {
  return metrics.gridTopPx - metrics.scrollTopPx + minutesToOffsetPx(metrics, minutes);
}

/** On-screen y → (fractional) minutes, at the current scroll offset. */
export function viewportYToMinutes(metrics: GridMetrics, viewportY: number): number {
  return offsetPxToMinutes(metrics, viewportY - metrics.gridTopPx + metrics.scrollTopPx);
}

/**
 * FR-204 verbatim: a timed block's raw top and height from its start and end
 * minutes and the measured ruler — nothing else enters.
 */
export function blockOffsets(
  metrics: GridMetrics,
  startMinutes: number,
  endMinutes: number,
): BlockOffsets {
  return {
    topPx: minutesToOffsetPx(metrics, startMinutes),
    heightPx: minutesToOffsetPx(metrics, endMinutes - startMinutes),
  };
}

/* ------------------------------------------------------------------------- *
 * The drag planners (T053, R205)
 *
 * A drag is an EDIT with a gesture: nothing here writes, prompts or animates
 * — each function turns measurements into a candidate placement, and
 * `drag-state.ts` decides when one becomes an intent to call `updateEvent`.
 *
 * The planners speak GRID SPACE — a column index and wall minutes after that
 * column's midnight — never dates or instants. Converting a column index to
 * a date (through the rendered window) and wall minutes to an instant (through
 * the household zone) is the adapter's job, which is what keeps zone policy
 * in `recurrence/zone.ts` and this module arithmetic.
 *
 * Minutes stay unclamped in the placements the planners RETURN: an end of
 * 1500 is 01:00 the next day, a start of -60 is 23:00 the day before, and
 * FR-217 says a midnight-crossing event is still one event.
 * ------------------------------------------------------------------------- */

/** FR-246: every drag and resize lands on a 15-minute step. */
export const SNAP_MINUTES = 15;

/** FR-251: an all-day event dropped into the grid becomes this long. */
export const DEFAULT_TIMED_MINUTES = 60;

/** Thickness of the auto-scroll zone at each end of the hour viewport. */
export const AUTO_SCROLL_EDGE_PX = 48;

/** Speed at the very edge of the viewport, px per second, ramped down inwards. */
export const AUTO_SCROLL_MAX_PX_PER_SECOND = 600;

/**
 * `GridMetrics` plus the two extents only a drag needs: where the all-day
 * band is (so a drop can land in it — FR-244/251) and how tall the hour
 * viewport is (the scroll bound the auto-scroll stops at). Measured by the
 * same pass that builds `GridMetrics`; kept separate so the renderers'
 * metrics type is untouched.
 */
export interface DragMetrics extends GridMetrics {
  /** Viewport y of the all-day band's top edge (below the day headers). */
  readonly bandTopPx: number;
  /** Rendered height of the all-day band — it grows with its lanes (FR-207). */
  readonly bandHeightPx: number;
  /** Visible height of the scrolling hour viewport. Must be finite and > 0. */
  readonly viewportHeightPx: number;
}

/** A pointer position in viewport coordinates. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** What lies under a pointer: a timed slot, an all-day day, or nothing valid. */
export type DropTarget =
  | { readonly kind: "grid"; readonly columnIndex: number; readonly minutes: number }
  | { readonly kind: "band"; readonly columnIndex: number };

/** A timed placement: one column's date, wall minutes from its midnight. */
export interface TimedPlacement {
  readonly allDay: false;
  readonly columnIndex: number;
  readonly startMinutes: number;
  readonly endMinutes: number;
}

/** An all-day placement: an inclusive run of day columns (FR-225). */
export interface AllDayPlacement {
  readonly allDay: true;
  readonly startColumnIndex: number;
  readonly endColumnIndex: number;
}

/**
 * Where an event sits in grid space — the shape of both the dragged event's
 * current position and every candidate a planner produces, so a candidate
 * can be fed straight back in (the keyboard path accumulates that way).
 */
export type SlotPlacement = TimedPlacement | AllDayPlacement;

/**
 * Where inside the event the gesture took hold, so a move keeps the block
 * under the finger instead of jumping its start to it.
 */
export interface DragGrab {
  /** Minutes from a timed block's start to the grab point. */
  readonly offsetMinutes: number;
  /** Whole days from an all-day bar's first day to the grabbed day. */
  readonly offsetDays: number;
}

/** No offset at all — the keyboard path, and any grab on the block's start. */
export const NO_GRAB: DragGrab = { offsetMinutes: 0, offsetDays: 0 };

/** Which edge of a timed block a resize is dragging (FR-245). */
export type ResizeEdge = "start" | "end";

/** The second guard: column hit-testing divides by this. */
function columnPxOf(metrics: GridMetrics): number {
  const { columnWidthPx } = metrics;
  if (!Number.isFinite(columnWidthPx) || columnWidthPx <= 0) {
    throw new Error(
      `GridMetrics.columnWidthPx must be a positive finite px value, got ${columnWidthPx}`,
    );
  }
  return columnWidthPx;
}

/** FR-246: the 15-minute step nearest `minutes`, ties rounding later. */
export function snapToStep(minutes: number, stepMinutes: number = SNAP_MINUTES): number {
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    throw new Error(`snap step must be a positive finite number of minutes, got ${stepMinutes}`);
  }
  const snapped = Math.round(minutes / stepMinutes) * stepMinutes;
  // `Math.round(-0.4)` is -0, and a negative zero minute would print as
  // "-0" in an announcement and fail every identity comparison downstream.
  return snapped === 0 ? 0 : snapped;
}

/** The day column a viewport x falls in, or `null` for the hour rail / past the last column. */
function columnFromX(metrics: DragMetrics, x: number): number | null {
  const index = Math.floor((x - metrics.gridLeftPx) / columnPxOf(metrics));
  return index >= 0 && index < metrics.columnCount ? index : null;
}

function isInBand(metrics: DragMetrics, y: number): boolean {
  return y >= metrics.bandTopPx && y < metrics.bandTopPx + metrics.bandHeightPx;
}

function isInHourViewport(metrics: DragMetrics, y: number): boolean {
  return y >= metrics.gridTopPx && y < metrics.gridTopPx + metrics.viewportHeightPx;
}

/** A slot belongs to the day its column stands for, midnight to midnight. */
function clampToDay(minutes: number): number {
  return Math.min(MINUTES_PER_DAY, Math.max(0, minutes));
}

/**
 * Hit-test a pointer: the 15-minute slot under it, the all-day day under it,
 * or `null` for everything that is not a slot — the hour rail, the top bar
 * and day headers, the hairline between band and grid, below the viewport,
 * and past the last rendered column. A `null` here is FR-249's invalid drop.
 */
export function slotFromPoint(metrics: DragMetrics, point: Point): DropTarget | null {
  // Read the ruler first, so unmeasurable metrics fail loudly wherever the
  // point happens to be rather than silently answering "no slot".
  const minutes = viewportYToMinutes(metrics, point.y);
  const columnIndex = columnFromX(metrics, point.x);
  if (columnIndex === null) return null;
  if (isInBand(metrics, point.y)) return { kind: "band", columnIndex };
  if (!isInHourViewport(metrics, point.y)) return null;
  return { kind: "grid", columnIndex, minutes: clampToDay(snapToStep(minutes)) };
}

/** FR-251's grid→band half, and an all-day bar moved by whole days. */
function movedToBand(source: SlotPlacement, columnIndex: number, grab: DragGrab): AllDayPlacement {
  // A timed block dropped in the band becomes all-day on the day it was
  // dropped — its clock times are discarded, so its duration cannot survive.
  if (!source.allDay) {
    return { allDay: true, startColumnIndex: columnIndex, endColumnIndex: columnIndex };
  }
  const startColumnIndex = columnIndex - grab.offsetDays;
  const spanDays = source.endColumnIndex - source.startColumnIndex;
  return { allDay: true, startColumnIndex, endColumnIndex: startColumnIndex + spanDays };
}

/** FR-251's band→grid half, and a timed block moved with its duration (FR-247). */
function movedToGrid(
  source: SlotPlacement,
  target: { columnIndex: number; minutes: number },
  grab: DragGrab,
): TimedPlacement {
  const columnIndex = target.columnIndex;
  // An all-day bar has no clock times to preserve or to grab into: it lands
  // at the dropped time, one default hour long.
  if (source.allDay) {
    const startMinutes = snapToStep(target.minutes);
    const endMinutes = startMinutes + DEFAULT_TIMED_MINUTES;
    return { allDay: false, columnIndex, startMinutes, endMinutes };
  }
  const startMinutes = snapToStep(target.minutes - grab.offsetMinutes);
  const durationMinutes = source.endMinutes - source.startMinutes;
  return { allDay: false, columnIndex, startMinutes, endMinutes: startMinutes + durationMinutes };
}

/**
 * Where a moved event would sit: the same duration in a new place (FR-244,
 * FR-247), or FR-251's conversion when the move crosses between the timed
 * grid and the all-day band.
 */
export function planMove(
  source: SlotPlacement,
  target: DropTarget,
  grab: DragGrab,
): SlotPlacement {
  if (target.kind === "band") return movedToBand(source, target.columnIndex, grab);
  return movedToGrid(source, target, grab);
}

/**
 * Where a resized block would sit: ONLY the dragged edge moves (FR-245),
 * never closer than one snap step to the other (FR-247), so a block can
 * never invert. An edge dragged into a neighbouring column reads as time
 * past midnight or before it, which is how a resize crosses a day boundary
 * (FR-217). The all-day band is not a resize target — that conversion is a
 * move (FR-251) — so a band target plans nothing.
 */
export function planResize(
  source: TimedPlacement,
  edge: ResizeEdge,
  target: DropTarget,
): TimedPlacement | null {
  if (target.kind !== "grid") return null;
  const dayShift = (target.columnIndex - source.columnIndex) * MINUTES_PER_DAY;
  const edgeMinutes = dayShift + snapToStep(target.minutes);
  if (edge === "start") {
    return { ...source, startMinutes: Math.min(edgeMinutes, source.endMinutes - SNAP_MINUTES) };
  }
  return { ...source, endMinutes: Math.max(edgeMinutes, source.startMinutes + SNAP_MINUTES) };
}

/** How far the hour canvas can scroll before the day's end is at the bottom. */
function maxScrollTopOf(metrics: DragMetrics): number {
  return Math.max(0, dayCanvasPx(metrics) - metrics.viewportHeightPx);
}

/** 0 at the inner edge of the zone, 1 at the viewport edge and past it. */
function rampOf(depthPx: number): number {
  if (depthPx <= 0) return 0;
  return Math.min(1, depthPx / AUTO_SCROLL_EDGE_PX);
}

/**
 * How fast the hour viewport should scroll while a drag hovers, in px per
 * second: negative towards earlier hours, positive towards later, zero in
 * the middle and zero at whichever end of the canvas is already reached.
 * A pointer past the viewport's edge pulls at full speed rather than
 * stopping, so a drag that overshoots the tablet's edge keeps working. In a
 * viewport shorter than two edge zones the top zone wins.
 */
export function autoScrollVelocity(metrics: DragMetrics, pointerY: number): number {
  const top = metrics.gridTopPx;
  const bottom = top + metrics.viewportHeightPx;
  const maxScrollTop = maxScrollTopOf(metrics);
  const upward = rampOf(AUTO_SCROLL_EDGE_PX - (pointerY - top));
  if (upward > 0) {
    return metrics.scrollTopPx <= 0 ? 0 : -upward * AUTO_SCROLL_MAX_PX_PER_SECOND;
  }
  const downward = rampOf(AUTO_SCROLL_EDGE_PX - (bottom - pointerY));
  if (downward > 0) {
    return metrics.scrollTopPx >= maxScrollTop ? 0 : downward * AUTO_SCROLL_MAX_PX_PER_SECOND;
  }
  return 0;
}
