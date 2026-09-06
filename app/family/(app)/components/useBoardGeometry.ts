"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  boardLayoutOf,
  type BoardLayout,
  type BoardLayoutInput,
} from "@/lib/family/tasks/layout";

import {
  attachProbe,
  detachProbe,
  hiddenProbeRoot,
  type ProbeAttachment,
} from "./probeAttachment";

/**
 * T040 / R320: the board measures ITSELF. FR-394 says decide how many columns
 * to show by measuring the space, not by a fixed count or a breakpoint, so a
 * `ResizeObserver` over the mounted board turns real rendered sizes into the
 * one pure decision function `boardLayoutOf`.
 *
 * Nothing here hard-codes a column width. `--fam-task-col-w` is
 * `calc(400 * var(--fam-u))` and `--fam-u` is itself a clamp on the viewport's
 * long edge, so the token resolves differently on a phone, a portrait iPad and
 * the wall tablet — and `calc(… * var(--fam-u))` never round-trips through
 * `getComputedStyle` as a number. The hook therefore appends a hidden PROBE
 * inside the observed node, sized by that token alone, and measures it: the
 * fit is decided against the live token rung, which is what makes the four
 * viewports of the visual brief land where `tasks-layout.test.ts` says they do
 * (1920×1080 → 4 · 1180×820 → 4 · 820×1180 → 3 wrapped · 390×844 → 1 paged).
 *
 * Those are the DEFAULTS — the Tasks and Rewards boards' token and rule. The
 * third board, the Lists tab (005 T006, R507), probes `--fam-list-card-w` and
 * applies `rowLayoutOf`, which never wraps; both arrive as `options`, and every
 * shipped call site passes none.
 *
 * This is Phase 2's `useGridGeometry` seam and deliberately not that hook:
 * `GridMetrics` and `LayoutMetrics` are hour-grid concepts — px per minute, an
 * hour gutter, a title line height — with no meaning on a board of people, and
 * sharing it would mean carrying five fields that are always zero.
 *
 * In jsdom (no layout, no `ResizeObserver`) every rect measures zero and the
 * hook says so: `measured` stays false. It does NOT hold back the board while
 * it waits, because the wall tablet's first paint must be the board rather
 * than a loading state (R314) — an unmeasured board renders every column it
 * has, as one grid row of equal tracks, which is the wall tablet's steady
 * state anyway. The columns stretch to share the width in every case, so an
 * unmeasured first frame can be too tight but never wider than the board.
 *
 * Contract with the columns (FR-394, SC-315): the board element carries
 * `.fam-board` (`overflow-x: hidden`) and each column body `.fam-task-scroll`
 * (`overflow-y: auto`), both declared in `app/family/tokens.css`. Twenty
 * occurrences are reachable by scrolling THAT column, and the page never
 * scrolls sideways at any width.
 *
 * What the layout's two modes then mean is `TasksBoard`'s to spend, and neither
 * needs anything further from here (T075): `grid` lays every column into
 * `perRow` tracks over `ceil(count / perRow)` rows of equal height, which IS
 * FR-395's portrait wrap; `pager` draws a window of `perRow` columns and
 * `ColumnPager` swipes between them (FR-396). The row count falls out of the
 * columns actually drawn, so the wrap needed no rule of its own.
 */

/** One raw read of the mounted board and its token probe, all CSS px. */
export interface BoardMeasurement {
  /** Visual viewport width — with its height, FR-395's wrap-or-page test. */
  viewportWidth: number;
  viewportHeight: number;
  /** Rendered content width the columns share. */
  boardWidth: number;
  /** Resolved `--fam-task-col-w` — the "whole column that fits" width. */
  referenceColumnWidth: number;
}

/** How a board is measured and decided; the Tasks board's values when absent. */
export interface BoardGeometryOptions {
  /** The CSS custom property the probe is sized by — the "whole column that fits" width. */
  widthToken?: string;
  /** The pure fit rule the measurement is handed to. */
  layoutOf?: (input: BoardLayoutInput) => BoardLayout;
}

const DEFAULT_WIDTH_TOKEN = "--fam-task-col-w";

export interface UseBoardGeometryResult {
  /** Attach to the board element (inside the `.family` scope). */
  boardRef: (node: HTMLElement | null) => void;
  /** FR-394's decision; the all-columns fallback until the board is measured. */
  layout: BoardLayout;
  /** False while the DOM has produced nothing real to decide from. */
  measured: boolean;
  /** Force a re-read outside any resize (e.g. after a web font loads). */
  remeasure: () => void;
}

/**
 * One measurement → the layout, or `null` when the DOM has not really been
 * laid out (zero rects — jsdom, `display: none`, mid-unmount). Every input is
 * required: `boardLayoutOf` divides by the reference width and decides wrap
 * against orientation, so a zero in any of the four is a wrong answer rather
 * than a rough one.
 */
export function boardGeometryOf(
  measurement: BoardMeasurement,
  columnCount: number,
  layoutOf: (input: BoardLayoutInput) => BoardLayout = boardLayoutOf,
): BoardLayout | null {
  if (!isMeasurable(measurement)) return null;
  return layoutOf({ ...measurement, columnCount });
}

export function useBoardGeometry(
  columnCount: number,
  options: BoardGeometryOptions = {},
): UseBoardGeometryResult {
  const widthToken = options.widthToken ?? DEFAULT_WIDTH_TOKEN;
  const layoutOf = options.layoutOf ?? boardLayoutOf;
  const [measurement, setMeasurement] = useState<BoardMeasurement | null>(null);
  const attachmentRef = useRef<Attachment | null>(null);

  const measure = useCallback(() => {
    const attachment = attachmentRef.current;
    if (attachment === null) return;
    const next = measurementOf(attachment);
    setMeasurement((previous) => (sameMeasurement(previous, next) ? previous : next));
  }, []);

  const boardRef = useCallback(
    (node: HTMLElement | null) => {
      detachProbe(attachmentRef.current);
      attachmentRef.current = node === null ? null : attach(node, measure, widthToken);
      if (node === null) setMeasurement(null);
      else measure();
    },
    [measure, widthToken],
  );

  // The column count is NOT a dependency of the measurement — a Profile
  // switched off the Tasks tab (FR-313) re-decides the layout without the DOM
  // being touched, and a resize re-decides it without the count moving.
  const geometry = useMemo(() => {
    const decided =
      measurement === null ? null : boardGeometryOf(measurement, columnCount, layoutOf);
    return { layout: decided ?? unmeasuredLayoutOf(columnCount), measured: decided !== null };
  }, [measurement, columnCount, layoutOf]);

  return { boardRef, layout: geometry.layout, measured: geometry.measured, remeasure: measure };
}

/* ------------------------------------------------------------ plumbing -- */

/** Every column it has, in one row of equal tracks — never a partial board. */
function unmeasuredLayoutOf(columnCount: number): BoardLayout {
  return { perRow: Math.max(1, columnCount), mode: "grid" };
}

function isMeasurable(measurement: BoardMeasurement): boolean {
  return (
    isPositive(measurement.boardWidth) &&
    isPositive(measurement.referenceColumnWidth) &&
    isPositive(measurement.viewportWidth) &&
    isPositive(measurement.viewportHeight)
  );
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

interface ProbeElements {
  root: HTMLElement;
  /** The width token wide — measuring it IS resolving the token. */
  column: HTMLElement;
}

type Attachment = ProbeAttachment<ProbeElements>;

/**
 * The shared plumbing (`probeAttachment.ts`), told to watch the probe column:
 * it resizes on its own when --fam-u changes (the board's border box does not
 * have to), so a rotation that keeps the width still moves the count.
 */
function attach(node: HTMLElement, onChange: () => void, widthToken: string): Attachment {
  const probe = buildProbe(node.ownerDocument, widthToken);
  return attachProbe(node, probe, [probe.column], onChange);
}

/** A hidden in-scope element sized purely by the token, on the shared root. */
function buildProbe(doc: Document, widthToken: string): ProbeElements {
  const root = hiddenProbeRoot(doc);

  const column = doc.createElement("div");
  column.style.width = `var(${widthToken})`;
  column.style.height = "1px";

  root.appendChild(column);
  return { root, column };
}

function measurementOf(attachment: Attachment): BoardMeasurement {
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    boardWidth: attachment.node.getBoundingClientRect().width,
    referenceColumnWidth: attachment.probe.column.getBoundingClientRect().width,
  };
}

const MEASUREMENT_KEYS = [
  "viewportWidth",
  "viewportHeight",
  "boardWidth",
  "referenceColumnWidth",
] as const satisfies readonly (keyof BoardMeasurement)[];

/** Value equality, so a no-op observer pass never re-renders the board. */
function sameMeasurement(a: BoardMeasurement | null, b: BoardMeasurement): boolean {
  return a !== null && MEASUREMENT_KEYS.every((key) => a[key] === b[key]);
}
