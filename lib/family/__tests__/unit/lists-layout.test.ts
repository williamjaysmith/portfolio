import { describe, expect, it } from "vitest";

import { rowLayoutOf } from "@/lib/family/lists/layout";

/**
 * 005 T020 — the Lists tab's fit rule (R507; FR-502, FR-543, spec Assumption
 * 11): whole cards or a pager, never a second row, whatever the orientation.
 * The reference card is ~495 units; the board widths below are the four
 * viewports with the shipped rail and insets taken off, as `useBoardGeometry`
 * measures them.
 */

const CARD = 495;

function layout(viewportWidth: number, viewportHeight: number, boardWidth: number, columnCount: number) {
  return rowLayoutOf({ viewportWidth, viewportHeight, boardWidth, referenceColumnWidth: CARD, columnCount });
}

describe("rowLayoutOf", () => {
  it("shows three whole cards of five on the wall tablet and pages the rest", () => {
    expect(layout(1920, 1080, 1778, 5)).toEqual({ perRow: 3, mode: "pager" });
  });

  it("shows every card in one row when they all fit", () => {
    expect(layout(1920, 1080, 1778, 2)).toEqual({ perRow: 2, mode: "grid" });
    expect(layout(1920, 1080, 1778, 3)).toEqual({ perRow: 3, mode: "grid" });
  });

  it("shows two on the iPad in landscape", () => {
    expect(layout(1180, 820, 1040, 4)).toEqual({ perRow: 2, mode: "pager" });
  });

  it("NEVER wraps in portrait — the shape the task board would wrap pages here", () => {
    // 820×1180 portrait, 700 wide: one 495 card fits, so the board's rule would
    // wrap 2 columns; a list row pages instead.
    expect(layout(820, 1180, 700, 4)).toEqual({ perRow: 1, mode: "pager" });
    // Even when two fit in portrait with four to place (the board's photographed 2×2).
    expect(layout(1000, 1400, 1000, 4)).toEqual({ perRow: 2, mode: "pager" });
  });

  it("fills a phone with one card and pages", () => {
    expect(layout(390, 844, 350, 3)).toEqual({ perRow: 1, mode: "pager" });
  });

  it("holds one card for a household with none to show, and never more than exist", () => {
    expect(layout(1920, 1080, 1778, 0)).toEqual({ perRow: 1, mode: "grid" });
    expect(layout(1920, 1080, 1778, 1)).toEqual({ perRow: 1, mode: "grid" });
  });

  it("refuses an unresolved card width rather than dividing by zero", () => {
    expect(() =>
      rowLayoutOf({ viewportWidth: 1920, viewportHeight: 1080, boardWidth: 1778, referenceColumnWidth: 0, columnCount: 3 }),
    ).toThrow(/positive/);
  });
});
