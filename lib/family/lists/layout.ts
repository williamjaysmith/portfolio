/**
 * How many list cards a measured strip shows (005 R507; FR-502, FR-543, spec
 * Assumption 11) — the Lists tab's fit rule, beside the boards' `boardLayoutOf`.
 *
 * Same measurement, one difference: a list card row NEVER wraps. The reference's
 * Lists screen is one horizontal row of cards, and two rows of 76-unit item rows
 * would not read as lists — so when fewer cards fit than exist, every shape pages
 * by swipe, whatever the orientation. As many WHOLE cards as fit, never more than
 * exist, never fewer than one: on a phone `perRow` is 1 and the one card fills
 * the width.
 *
 * Framework-free and pure: the measurements arrive from `useBoardGeometry`,
 * which is handed this function as its `layoutOf` option.
 */

import type { BoardLayout, BoardLayoutInput } from "../tasks/layout";

const MIN_PER_ROW = 1;

/** Whole cards or a pager — never a second row. */
export function rowLayoutOf(input: BoardLayoutInput): BoardLayout {
  const { referenceColumnWidth, boardWidth, columnCount } = input;
  if (!Number.isFinite(referenceColumnWidth) || referenceColumnWidth <= 0) {
    throw new Error(`reference card width must be positive, got ${referenceColumnWidth}`);
  }
  const fits = Math.floor(boardWidth / referenceColumnWidth);
  const perRow = Math.max(MIN_PER_ROW, Math.min(columnCount, fits));
  return { perRow, mode: perRow >= columnCount ? "grid" : "pager" };
}
