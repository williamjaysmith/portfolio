import { renderHook } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_COLUMN_COUNT,
  columnCountFor,
  geometryOf,
  useGridGeometry,
  type ColumnFitInput,
  type GridMeasurement,
} from "@/app/family/(app)/calendar/components/useGridGeometry";

/**
 * T027 / FR-277 / FR-278: the column count is a MEASUREMENT consequence, not
 * a stored preference (spec Contradiction 5). At least 1024 CSS px wide in
 * landscape → seven columns; otherwise as many whole reference-width columns
 * as fit in the grid (gutter excluded), never fewer than three, never more
 * than seven. The maths is pure and tested with injected measurements — the
 * ResizeObserver plumbing is verified by running the app (T035).
 */

function fit(overrides: Partial<ColumnFitInput> = {}): ColumnFitInput {
  return {
    viewportWidth: 900,
    viewportHeight: 1200,
    gridWidth: 800,
    gutterWidth: 60,
    referenceColumnWidth: 200,
    ...overrides,
  };
}

describe("columnCountFor", () => {
  it("renders seven columns at ≥1024 landscape whatever the fit says (FR-277)", () => {
    // 1180×820 is the T035 verification viewport; the reference column
    // (207 at that scale) would only fit five — FR-277 overrides the fit.
    expect(
      columnCountFor(
        fit({
          viewportWidth: 1180,
          viewportHeight: 820,
          gridWidth: 1123,
          gutterWidth: 72,
          referenceColumnWidth: 207,
        }),
      ),
    ).toBe(7);
  });

  it("treats exactly 1024 wide in landscape as seven columns", () => {
    expect(columnCountFor(fit({ viewportWidth: 1024, viewportHeight: 768 }))).toBe(7);
  });

  it("a square viewport is not landscape — the fit decides", () => {
    // CSS `orientation: landscape` requires width strictly greater than height.
    expect(
      columnCountFor(
        fit({ viewportWidth: 1024, viewportHeight: 1024, gridWidth: 964, gutterWidth: 60 }),
      ),
    ).toBe(4); // (964 − 60) / 200 = 4.52
  });

  it("fits whole reference columns between the extremes (FR-278)", () => {
    expect(
      columnCountFor(
        fit({ gridWidth: 1000, gutterWidth: 60, referenceColumnWidth: 180 }),
      ),
    ).toBe(5); // 940 / 180 = 5.22
  });

  it("floors at three columns on a phone (FR-278)", () => {
    expect(
      columnCountFor(
        fit({ viewportWidth: 390, viewportHeight: 844, gridWidth: 390, gutterWidth: 58.5 }),
      ),
    ).toBe(3); // 331.5 / 200 = 1.65 → floored at 3
  });

  it("caps at seven columns however wide the grid is", () => {
    expect(
      columnCountFor(
        fit({
          viewportWidth: 1440,
          viewportHeight: 2560, // portrait monitor — the fit path, not FR-277's
          gridWidth: 2000,
          gutterWidth: 60,
          referenceColumnWidth: 207,
        }),
      ),
    ).toBe(7); // 1940 / 207 = 9.37 → capped
  });

  it("shows three columns on a portrait tablet at reference proportions", () => {
    // 820×1180 portrait: gutter 71.91, reference column 207.11 (visual brief).
    expect(
      columnCountFor(
        fit({
          viewportWidth: 820,
          viewportHeight: 1180,
          gridWidth: 820,
          gutterWidth: 71.91,
          referenceColumnWidth: 207.11,
        }),
      ),
    ).toBe(3); // 748.09 / 207.11 = 3.61
  });

  it("refuses a non-positive reference column width", () => {
    expect(() => columnCountFor(fit({ referenceColumnWidth: 0 }))).toThrow(/column/i);
  });
});

function measurement(overrides: Partial<GridMeasurement> = {}): GridMeasurement {
  return {
    viewportWidth: 1180,
    viewportHeight: 820,
    gridWidth: 1123.5,
    gridLeft: 56.5,
    gridTop: 137,
    scrollTop: 100,
    gutterWidth: 71.91,
    referenceColumnWidth: 207.11,
    hourRowHeight: 119.84,
    titleLineHeight: 16,
    blockPaddingY: 33.2,
    ...overrides,
  };
}

describe("geometryOf", () => {
  it("assembles GridMetrics and LayoutMetrics from one measurement", () => {
    const geometry = geometryOf(measurement());
    expect(geometry).not.toBeNull();
    if (geometry === null) throw new Error("unreachable");

    expect(geometry.columnCount).toBe(7); // 1180×820 is ≥1024 landscape
    const { metrics, layoutMetrics } = geometry;
    expect(metrics.columnCount).toBe(7);
    expect(metrics.hourRowPx).toBeCloseTo(119.84);
    // Columns stretch to share the measured content width equally.
    expect(metrics.columnWidthPx).toBeCloseTo((1123.5 - 71.91) / 7);
    // The first day column starts at the gutter's right edge.
    expect(metrics.gridLeftPx).toBeCloseTo(56.5 + 71.91);
    expect(metrics.gridTopPx).toBe(137);
    expect(metrics.scrollTopPx).toBe(100);

    expect(layoutMetrics.columnWidth).toBeCloseTo(metrics.columnWidthPx);
    expect(layoutMetrics.pxPerMinute).toBeCloseTo(119.84 / 60);
    expect(layoutMetrics.titleLineHeight).toBe(16);
    expect(layoutMetrics.blockPaddingY).toBeCloseTo(33.2);
  });

  it("returns null for a degenerate measurement (unmounted or unstyled DOM)", () => {
    expect(
      geometryOf(
        measurement({
          gridWidth: 0,
          gutterWidth: 0,
          referenceColumnWidth: 0,
          hourRowHeight: 0,
          titleLineHeight: 0,
          blockPaddingY: 0,
        }),
      ),
    ).toBeNull();
  });

  it("returns null when the gutter swallows the whole grid width", () => {
    expect(geometryOf(measurement({ gridWidth: 70, gutterWidth: 71.91 }))).toBeNull();
  });
});

describe("useGridGeometry", () => {
  it("starts unmeasured: null metrics, seven columns by default", () => {
    const { result } = renderHook(() => useGridGeometry());
    expect(result.current.metrics).toBeNull();
    expect(result.current.layoutMetrics).toBeNull();
    expect(result.current.columnCount).toBe(DEFAULT_COLUMN_COUNT);
  });

  it("survives attach and detach in a layout-less DOM (jsdom) without measuring", () => {
    const { result } = renderHook(() => useGridGeometry());
    const node = document.createElement("div");
    document.body.appendChild(node);

    act(() => {
      result.current.viewportRef(node);
    });
    // jsdom performs no layout — every rect is 0 — so the hook must stay
    // honestly unmeasured rather than fabricating a zero-height grid.
    expect(result.current.metrics).toBeNull();
    expect(result.current.columnCount).toBe(DEFAULT_COLUMN_COUNT);

    act(() => {
      result.current.remeasure();
      result.current.viewportRef(null);
    });
    expect(result.current.metrics).toBeNull();
    node.remove();
  });
});
