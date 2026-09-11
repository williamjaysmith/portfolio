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

import { wholeColumnsOf, type BoardLayout, type BoardLayoutInput } from "../tasks/layout";

/**
 * Whole cards or a pager — never a second row.
 *
 * The gap between cards is counted, exactly as `boardLayoutOf` counts it: `n`
 * cards occupy `n · width + (n − 1) · gap`, so the count that fits is
 * `floor((board + gap) / (width + gap))`. Without that term a phone was told
 * two cards fit a width that could hold two cards but not the 19px between
 * them, and the grid squeezed both.
 */
export function rowLayoutOf(input: BoardLayoutInput): BoardLayout {
  // **Deliberately NOT gap-aware, where `boardLayoutOf` is.** These tracks are
  // `1fr` and squeeze happily: a day column or a list card that comes out a few
  // pixels under its reference width is simply a slightly narrower column, and
  // nothing inside it has a floor to breach. A Tasks column does — four 44px
  // toggles and two count pills — which is why that rule counts the gap and
  // this one must not.
  //
  // Counting it here cost the wall tablet its WEEK: at 1280 the Meals grid drew
  // six day columns instead of seven, and the arrows relabelled themselves from
  // "week" to "6 days". The browser pass caught it on `meals.spec:187`. Seven
  // whole days on the wall is the shipped guarantee (013), and it outranks an
  // arithmetic tidy-up.
  const perRow = wholeColumnsOf({ ...input, columnGap: 0 }, "reference card width");
  return { perRow, mode: perRow >= input.columnCount ? "grid" : "pager" };
}
