"use client";

import { useCallback, useRef, useState } from "react";

import type { LayoutMetrics } from "@/lib/family/calendar/layout";
import {
  DEFAULT_COLUMN_COUNT,
  MAX_COLUMN_COUNT,
  MIN_COLUMN_COUNT,
  type GridMetrics,
} from "@/lib/family/week-geometry";

import {
  attachProbe,
  detachProbe,
  hiddenProbeRoot,
  type ProbeAttachment,
} from "../../components/probeAttachment";

/**
 * T027: the grid measures ITSELF (spec Contradiction 5) — a `ResizeObserver`
 * on the mounted hour viewport turns real rendered sizes into the
 * `GridMetrics` every px↔minutes conversion consumes (`lib/family/
 * week-geometry.ts`) and the `LayoutMetrics` `layoutWeek` positions blocks
 * with. Nothing here hard-codes a token value: the token-driven lengths
 * (`--fam-day-col-w`, `--fam-hour-row-h`, `--fam-hour-gutter-w`, the event
 * title type and block padding) are read by measuring PROBE elements the hook
 * appends inside the observed node, so they resolve against the `.family`
 * scope at the current `--fam-u` / text-size rung and re-measure when either
 * changes.
 *
 * Column count (FR-277/278): at least 1024 CSS px wide in landscape → seven
 * columns; otherwise as many whole reference-width columns as fit in the
 * grid's content width, floored at three, capped at seven. The rendered
 * columns then stretch to share the content width equally — the reference
 * width decides only HOW MANY fit. A rotation fires the observer and the count
 * changes; nothing here reaches into anchor state, because the count IS the
 * window's width and its paging step — the anchored first day is unaffected,
 * the window simply grows or shrinks to its right.
 *
 * `GridMetrics.scrollTopPx` is the offset AT THE LAST MEASUREMENT — the hook
 * deliberately does not re-render per scrolled pixel. US1 renders in content
 * space (blocks and the now-line scroll with the canvas), so nothing
 * live-reads it yet; US3's pointer math takes fresh snapshots at pointer
 * time.
 *
 * Contract with `EventBlock` (T031, FR-218): the probe's title line renders
 * `--fam-fs-event-title` at weight 600 with the DEFAULT (normal) line
 * height, padded `--fam-event-pad` above and `--fam-event-pad-end` below —
 * the block must style its own title and vertical padding the same way, or
 * the measured minimum height stops matching the drawn one.
 *
 * In jsdom (no layout, no `ResizeObserver`) every rect measures zero and the
 * hook honestly stays unmeasured: `metrics` remains `null` and the column
 * count holds `DEFAULT_COLUMN_COUNT`. The pure maths (`columnCountFor`,
 * `geometryOf`) is what the unit suite drives with injected measurements;
 * the DOM plumbing is verified by running the app (T035).
 */

/** FR-277's breakpoint: at least this many CSS px wide, in landscape → 7. */
const SEVEN_COLUMN_MIN_WIDTH = 1024;

/** The inputs the FR-277/278 column count is decided from, all CSS px. */
export interface ColumnFitInput {
  /** Visual viewport width (`window.innerWidth`). */
  viewportWidth: number;
  viewportHeight: number;
  /** Rendered outer width of the hour viewport, gutter included. */
  gridWidth: number;
  /** Resolved `--fam-hour-gutter-w`. */
  gutterWidth: number;
  /** Resolved `--fam-day-col-w` — the "whole column that fits" width. */
  referenceColumnWidth: number;
}

/** One raw read of the mounted grid and its probes, all CSS px. */
export interface GridMeasurement extends ColumnFitInput {
  /** Viewport x of the hour viewport's left border edge. */
  gridLeft: number;
  /** Viewport y of the hour viewport's top border edge. */
  gridTop: number;
  /** Vertical scroll offset of the hour canvas at measurement time. */
  scrollTop: number;
  /** Resolved `--fam-hour-row-h` — one hour of the ruler. */
  hourRowHeight: number;
  /** One rendered line of `--fam-fs-event-title` (FR-218). */
  titleLineHeight: number;
  /** Event block vertical padding, `--fam-event-pad` + `--fam-event-pad-end`. */
  blockPaddingY: number;
}

/** Everything one measurement yields; `columnCount` mirrors `metrics`. */
export interface GridGeometry {
  metrics: GridMetrics;
  layoutMetrics: LayoutMetrics;
  columnCount: number;
}

/** FR-277/278: the day-column count a measured viewport must render. */
export function columnCountFor(input: ColumnFitInput): number {
  const { referenceColumnWidth } = input;
  if (!Number.isFinite(referenceColumnWidth) || referenceColumnWidth <= 0) {
    throw new Error(`reference column width must be positive, got ${referenceColumnWidth}`);
  }
  // CSS `orientation: landscape` — width STRICTLY greater than height.
  if (input.viewportWidth >= SEVEN_COLUMN_MIN_WIDTH && input.viewportWidth > input.viewportHeight) {
    return MAX_COLUMN_COUNT;
  }
  const fit = Math.floor((input.gridWidth - input.gutterWidth) / referenceColumnWidth);
  return Math.min(MAX_COLUMN_COUNT, Math.max(MIN_COLUMN_COUNT, fit));
}

/**
 * One measurement → the metrics pair, or `null` when the DOM has not really
 * been laid out (zero rects — jsdom, `display: none`, mid-unmount).
 */
export function geometryOf(measurement: GridMeasurement): GridGeometry | null {
  if (!isMeasurable(measurement)) return null;
  const columnCount = columnCountFor(measurement);
  const columnWidthPx = (measurement.gridWidth - measurement.gutterWidth) / columnCount;
  const metrics: GridMetrics = {
    hourRowPx: measurement.hourRowHeight,
    columnWidthPx,
    columnCount,
    gridLeftPx: measurement.gridLeft + measurement.gutterWidth,
    gridTopPx: measurement.gridTop,
    scrollTopPx: measurement.scrollTop,
  };
  const layoutMetrics: LayoutMetrics = {
    columnWidth: columnWidthPx,
    pxPerMinute: measurement.hourRowHeight / 60,
    titleLineHeight: measurement.titleLineHeight,
    blockPaddingY: measurement.blockPaddingY,
  };
  return { metrics, layoutMetrics, columnCount };
}

export interface UseGridGeometryResult {
  /**
   * Attach to the scrollable hour viewport (inside the `.family` scope).
   * Measurement begins on attach and follows resizes; detach resets to
   * unmeasured.
   */
  viewportRef: (node: HTMLElement | null) => void;
  /** `null` until the mounted grid produces a real measurement. */
  metrics: GridMetrics | null;
  /** `null` exactly when `metrics` is — `layoutWeek` waits on it. */
  layoutMetrics: LayoutMetrics | null;
  /** FR-277/278 count; `DEFAULT_COLUMN_COUNT` while unmeasured. */
  columnCount: number;
  /** Force a re-read outside any resize (e.g. after a web font loads). */
  remeasure: () => void;
}

export function useGridGeometry(): UseGridGeometryResult {
  const [geometry, setGeometry] = useState<GridGeometry | null>(null);
  const attachmentRef = useRef<Attachment | null>(null);

  const measure = useCallback(() => {
    const attachment = attachmentRef.current;
    if (attachment === null) return;
    const next = geometryOf(measurementOf(attachment));
    setGeometry((previous) => (sameGeometry(previous, next) ? previous : next));
  }, []);

  const viewportRef = useCallback(
    (node: HTMLElement | null) => {
      detachProbe(attachmentRef.current);
      attachmentRef.current = node === null ? null : attach(node, measure);
      if (node === null) setGeometry(null);
      else measure();
    },
    [measure],
  );

  return {
    viewportRef,
    metrics: geometry?.metrics ?? null,
    layoutMetrics: geometry?.layoutMetrics ?? null,
    columnCount: geometry?.columnCount ?? DEFAULT_COLUMN_COUNT,
    remeasure: measure,
  };
}

/* ------------------------------------------------------------ plumbing -- */

interface ProbeElements {
  root: HTMLElement;
  /** `--fam-day-col-w` wide, `--fam-hour-row-h` tall. */
  column: HTMLElement;
  /** `--fam-hour-gutter-w` wide. */
  gutter: HTMLElement;
  /** The FR-218 padding box: pad-top + one title line + pad-bottom. */
  block: HTMLElement;
  title: HTMLElement;
}

type Attachment = ProbeAttachment<ProbeElements>;

/**
 * The shared plumbing (`probeAttachment.ts`), told which probe elements to
 * watch: the column and the padded block resize on their own when --fam-u or
 * the text-size rung changes (the node's border box does not).
 */
function attach(node: HTMLElement, onChange: () => void): Attachment {
  const probe = buildProbe(node.ownerDocument);
  return attachProbe(node, probe, [probe.column, probe.block], onChange);
}

/**
 * Hidden in-scope elements sized purely by the tokens, so measuring them IS
 * resolving the tokens (calc(… * var(--fam-u)) never round-trips through
 * `getComputedStyle` as a number).
 */
function buildProbe(doc: Document): ProbeElements {
  const root = hiddenProbeRoot(doc);

  const column = doc.createElement("div");
  column.style.width = "var(--fam-day-col-w)";
  column.style.height = "var(--fam-hour-row-h)";

  const gutter = doc.createElement("div");
  gutter.style.width = "var(--fam-hour-gutter-w)";

  const title = doc.createElement("span");
  title.style.display = "inline-block";
  title.style.fontFamily = "var(--fam-font-sans)";
  title.style.fontSize = "var(--fam-fs-event-title)";
  title.style.fontWeight = "600";
  title.textContent = "Ag";

  const block = doc.createElement("div");
  block.style.paddingTop = "var(--fam-event-pad)";
  block.style.paddingBottom = "var(--fam-event-pad-end)";
  block.appendChild(title);

  root.append(column, gutter, block);
  return { root, column, gutter, block, title };
}

function measurementOf(attachment: Attachment): GridMeasurement {
  const { node, probe } = attachment;
  const rect = node.getBoundingClientRect();
  const column = probe.column.getBoundingClientRect();
  const title = probe.title.getBoundingClientRect();
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    gridWidth: rect.width,
    gridLeft: rect.left,
    gridTop: rect.top,
    scrollTop: node.scrollTop,
    gutterWidth: probe.gutter.getBoundingClientRect().width,
    referenceColumnWidth: column.width,
    hourRowHeight: column.height,
    titleLineHeight: title.height,
    blockPaddingY: probe.block.getBoundingClientRect().height - title.height,
  };
}

function isMeasurable(m: GridMeasurement): boolean {
  return (
    isPositive(m.gridWidth) &&
    isPositive(m.referenceColumnWidth) &&
    isPositive(m.hourRowHeight) &&
    isPositive(m.titleLineHeight) &&
    isNonNegative(m.gutterWidth) &&
    isNonNegative(m.blockPaddingY) &&
    m.gridWidth - m.gutterWidth > 0
  );
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Value equality so a no-op observer pass never re-renders the grid. */
function sameGeometry(a: GridGeometry | null, b: GridGeometry | null): boolean {
  if (a === null || b === null) return a === b;
  return sameMetrics(a.metrics, b.metrics) && sameLayoutMetrics(a.layoutMetrics, b.layoutMetrics);
}

const METRIC_KEYS = [
  "hourRowPx",
  "columnWidthPx",
  "columnCount",
  "gridLeftPx",
  "gridTopPx",
  "scrollTopPx",
] as const satisfies readonly (keyof GridMetrics)[];

function sameMetrics(a: GridMetrics, b: GridMetrics): boolean {
  return METRIC_KEYS.every((key) => a[key] === b[key]);
}

function sameLayoutMetrics(a: LayoutMetrics, b: LayoutMetrics): boolean {
  return a.titleLineHeight === b.titleLineHeight && a.blockPaddingY === b.blockPaddingY;
}
