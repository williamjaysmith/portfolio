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
 * caller's policy: layout clamps to the day, the US3 planners (snapToStep,
 * slotFromPoint, planMove/planResize, autoScrollVelocity — T053) snap and
 * validate. Those planners bolt onto this module and this metrics type; only
 * `GridMetrics` is expected to GROW (all-day band extent, scroll bounds), the
 * conversions here are their fixed substrate.
 */

/** One day of minutes — the content canvas spans exactly this much time. */
export const MINUTES_PER_DAY = 1440;

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
