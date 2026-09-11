"use client";

import type { ReactNode } from "react";

/**
 * The preview bar (009 FR-907, FR-910, R901) — `MealRow`'s three properties in
 * a row of its own:
 *
 *   1. it sits under the all-day band, drawn by `WeekView` inside
 *      `DayHeaderBand`, where the reference puts it ("above the events");
 *   2. it is OUTSIDE the drag layer — no pointer binding, so a chip never
 *      lifts and the events' drag is untouched;
 *   3. it returns `null` when it has nothing, so a household with no
 *      countdowns loses no vertical space at all (FR-910, SC-906) — which
 *      matters most on the phone where the band already carries day headers,
 *      the all-day bar and the meal tokens.
 *
 * **014 took Tasks Progress out of it.** The reference has countdowns
 * "alongside Tasks Progress" [VERIFIED](40459070511515) and 009 read that as
 * one row holding both; the operator saw the result on their phone as the
 * family's faces drawn twice, and the counts moved onto the shell's chips. What
 * is left here is the countdowns, and rule 3 now decides on them alone.
 *
 * It holds no state and makes no decision: whether there is anything to show
 * is the caller's, which is what keeps rule 3 true of the two halves together
 * rather than of each on its own.
 */

export interface PreviewBarProps {
  /**
   * The countdown chips, when any are in force (FR-902) — and `undefined`, not
   * a component that will render nothing, when there are none. A JSX element is
   * truthy whatever it renders, so a caller that always passes one would give
   * the bar an empty row forever and quietly break FR-910.
   */
  countdowns?: ReactNode;
}

export function PreviewBar({ countdowns }: PreviewBarProps) {
  if (!countdowns) return null;

  return (
    <div
      aria-label="Calendar preview"
      role="group"
      className="flex items-center gap-3 overflow-x-auto border-t border-(--fam-hairline) px-(--fam-edge-inset) py-1"
    >
      {countdowns}
    </div>
  );
}
