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
 *      countdowns and Tasks Progress off loses no vertical space at all
 *      (FR-910, SC-906) — which matters most on the phone where the band
 *      already carries day headers, the all-day bar and the meal tokens.
 *
 * It is ONE row and not two. The reference is explicit that countdowns appear
 * "alongside Tasks Progress" [VERIFIED](40459070511515), and two rows would
 * each cost the band its height separately.
 *
 * It holds no state and makes no decision: whether there is anything to show
 * is the caller's, which is what keeps rule 3 true of the two halves together
 * rather than of each on its own.
 */

export interface PreviewBarProps {
  /**
   * Tasks Progress, when this device has it on (FR-911) — and `undefined`, not
   * a component that will render nothing, when it does not. A JSX element is
   * truthy whatever it renders, so a caller that always passes one would give
   * the bar an empty row forever and quietly break FR-910.
   */
  progress?: ReactNode;
  /** The countdown chips, when any are in force (FR-902). Same rule. */
  countdowns?: ReactNode;
}

export function PreviewBar({ progress, countdowns }: PreviewBarProps) {
  if (!progress && !countdowns) return null;

  return (
    <div
      aria-label="Calendar preview"
      role="group"
      className="flex items-center gap-3 overflow-x-auto border-t border-(--fam-hairline) px-(--fam-edge-inset) py-1"
    >
      {progress}
      {countdowns}
    </div>
  );
}
