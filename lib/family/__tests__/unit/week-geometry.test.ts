import { describe, expect, it } from "vitest";
import {
  MINUTES_PER_DAY,
  blockOffsets,
  dayCanvasPx,
  minutesToOffsetPx,
  minutesToViewportY,
  offsetPxToMinutes,
  viewportYToMinutes,
  type GridMetrics,
} from "@/lib/family/week-geometry";

/**
 * T023 — the RENDERING half of week-geometry (FR-204: a timed block is placed
 * and sized from its start and end times alone, measured against the hour
 * ruler). The drag planners (snap table, slotFromPoint, planMove/planResize,
 * autoScrollVelocity) arrive with US3/T053 and extend THIS metrics snapshot.
 */

/** The reference grid at 1920×1080 — 195 px/hour, chrome 311 px tall. */
function metrics(overrides: Partial<GridMetrics> = {}): GridMetrics {
  return {
    hourRowPx: 195,
    columnWidthPx: 337,
    columnCount: 5,
    gridLeftPx: 219,
    gridTopPx: 311,
    scrollTopPx: 0,
    ...overrides,
  };
}

describe("GridMetrics content conversions (FR-204)", () => {
  it("maps minutes to a content offset linearly against the hour ruler", () => {
    const m = metrics();
    expect(minutesToOffsetPx(m, 0)).toBe(0);
    expect(minutesToOffsetPx(m, 60)).toBe(195);
    expect(minutesToOffsetPx(m, 90)).toBe(292.5);
    expect(minutesToOffsetPx(m, 9 * 60)).toBe(1755);
    expect(minutesToOffsetPx(m, MINUTES_PER_DAY)).toBe(dayCanvasPx(m));
  });

  it("scales with the measured row height, never a constant", () => {
    const tablet = metrics({ hourRowPx: 119.84 });
    expect(minutesToOffsetPx(tablet, 60)).toBeCloseTo(119.84, 10);
    expect(minutesToOffsetPx(tablet, 30)).toBeCloseTo(59.92, 10);
    const phone = metrics({ hourRowPx: 97.5 });
    expect(minutesToOffsetPx(phone, 120)).toBe(195);
    expect(dayCanvasPx(phone)).toBe(2340);
  });

  it("maps a content offset back to (fractional) minutes", () => {
    const m = metrics();
    expect(offsetPxToMinutes(m, 0)).toBe(0);
    expect(offsetPxToMinutes(m, 195)).toBe(60);
    expect(offsetPxToMinutes(m, 292.5)).toBe(90);
    // Fractional pixels give fractional minutes — snapping is US3's planner.
    expect(offsetPxToMinutes(m, 100)).toBeCloseTo(30.769230769, 6);
  });

  it("round-trips both directions at varying row heights", () => {
    for (const hourRowPx of [195, 119.84, 97.5, 260]) {
      const m = metrics({ hourRowPx });
      for (const minute of [0, 1, 8.25, 61, 719.5, 1439, MINUTES_PER_DAY]) {
        expect(offsetPxToMinutes(m, minutesToOffsetPx(m, minute))).toBeCloseTo(minute, 8);
      }
      for (const px of [0, 0.5, 97, 1755.25, dayCanvasPx(m)]) {
        expect(minutesToOffsetPx(m, offsetPxToMinutes(m, px))).toBeCloseTo(px, 8);
      }
    }
  });

  it("stays unclamped — callers upstream decide what is out of range", () => {
    const m = metrics();
    expect(minutesToOffsetPx(m, -30)).toBe(-97.5);
    expect(offsetPxToMinutes(m, -195)).toBe(-60);
    expect(minutesToOffsetPx(m, MINUTES_PER_DAY + 60)).toBe(dayCanvasPx(m) + 195);
  });
});

describe("viewport conversions through the scroll offset", () => {
  it("places a minute on screen through gridTop and scrollTop", () => {
    const rest = metrics();
    expect(minutesToViewportY(rest, 0)).toBe(311);
    expect(minutesToViewportY(rest, 60)).toBe(311 + 195);

    // Scrolled two hours down: 02:00 sits exactly at the viewport top.
    const scrolled = metrics({ scrollTopPx: 390 });
    expect(minutesToViewportY(scrolled, 120)).toBe(311);
    expect(minutesToViewportY(scrolled, 0)).toBe(311 - 390);
    expect(minutesToViewportY(scrolled, 180)).toBe(311 + 195);
  });

  it("reads minutes back from a viewport y at the same scroll offset", () => {
    const scrolled = metrics({ scrollTopPx: 390 });
    expect(viewportYToMinutes(scrolled, 311)).toBe(120);
    expect(viewportYToMinutes(scrolled, 311 + 97.5)).toBe(150);
    // A point above the grid while scrolled still lands ON the ruler.
    expect(viewportYToMinutes(scrolled, 311 - 195)).toBe(60);
  });

  it("round-trips both directions at varying scroll offsets and row heights", () => {
    for (const hourRowPx of [195, 119.84]) {
      for (const scrollTopPx of [0, 97.5, 390, 2000]) {
        const m = metrics({ hourRowPx, scrollTopPx, gridTopPx: 191.14 });
        for (const minute of [0, 42.5, 480, 1439]) {
          expect(viewportYToMinutes(m, minutesToViewportY(m, minute))).toBeCloseTo(minute, 8);
        }
        for (const y of [0, 191.14, 500.75, 820]) {
          expect(minutesToViewportY(m, viewportYToMinutes(m, y))).toBeCloseTo(y, 8);
        }
      }
    }
  });
});

describe("blockOffsets — placement from times alone (FR-204)", () => {
  it("derives top and height from start/end minutes and nothing else", () => {
    const m = metrics();
    expect(blockOffsets(m, 9 * 60, 10 * 60 + 30)).toEqual({ topPx: 1755, heightPx: 292.5 });
    expect(blockOffsets(m, 0, 15)).toEqual({ topPx: 0, heightPx: 48.75 });
  });

  it("keeps raw geometry raw — the FR-218 minimum height is layout's job", () => {
    const m = metrics();
    expect(blockOffsets(m, 600, 600)).toEqual({ topPx: 1950, heightPx: 0 });
    expect(blockOffsets(m, 600, 605).heightPx).toBeCloseTo(16.25, 10);
  });

  it("scales with the measured row height", () => {
    const m = metrics({ hourRowPx: 119.84 });
    expect(blockOffsets(m, 60, 120)).toEqual({ topPx: 119.84, heightPx: 119.84 });
  });
});

describe("metrics validation", () => {
  it("refuses a zero, negative or non-finite row height", () => {
    for (const hourRowPx of [0, -195, Number.NaN, Number.POSITIVE_INFINITY]) {
      const m = metrics({ hourRowPx });
      expect(() => minutesToOffsetPx(m, 60)).toThrow(/hourRowPx/);
      expect(() => offsetPxToMinutes(m, 195)).toThrow(/hourRowPx/);
      expect(() => minutesToViewportY(m, 60)).toThrow(/hourRowPx/);
      expect(() => viewportYToMinutes(m, 311)).toThrow(/hourRowPx/);
      expect(() => blockOffsets(m, 60, 120)).toThrow(/hourRowPx/);
      expect(() => dayCanvasPx(m)).toThrow(/hourRowPx/);
    }
  });
});
