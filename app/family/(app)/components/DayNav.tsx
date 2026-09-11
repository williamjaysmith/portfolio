"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one ‹ Today › cluster, shared by every tab that moves through days.
 *
 * **014 extracted it because the tabs had drifted.** The Calendar drew its
 * arrows as wide pills with Today between them, right-aligned; Meals drew
 * circular arrows side by side, on the left, with the range label between them
 * and Today pushed to the far right. Same three controls, two different
 * shapes and two different orders. The operator's call: *"multiple tabs use an
 * arrow/Today button setup and i think they should at least look the same"*.
 *
 * What was chosen, and why:
 *
 * · **Circular arrows** (Meals'), not pills (the Calendar's). An icon-only
 *   control in a `px-4` pill is a wide box around a small glyph; a circle at
 *   `--fam-touch` is the same target and reads as one thing. It also buys back
 *   width, which the wrapping below needs.
 * · **`‹ Today ›`** (the Calendar's), not `‹ ›  …  Today`. Today is where you
 *   return to, so it belongs between the two directions rather than at the
 *   opposite end of the row from them.
 * · **The label leads**, where Meals had it in the middle. A range reads as a
 *   heading for the row, and only Meals has one — the Calendar's dates are in
 *   its day headers.
 *
 * **The row still wraps, and that is load-bearing** (011). The Calendar puts a
 * view switcher and a search box on this row too, and five controls do not fit
 * 320px in one line — they used to overflow off the left edge, the same class
 * of defect the household reported from a real iPhone in Phase 7.
 *
 * **The arrows' distance is the caller's word**, not this component's: "week",
 * "3 days", "day", "month". Both tabs already derive it from what is drawn
 * (013 FR-1306, 011 FR-1104), and the browser journeys read those labels, so
 * the phrasing "Previous {distance}" is fixed here and the noun is not.
 */

const ARROW = "grid h-(--fam-touch) w-(--fam-touch) shrink-0 place-items-center rounded-full bg-(--fam-pill-btn-bg) text-(--fam-text-muted)";

const TODAY =
  "flex min-h-(--fam-touch) shrink-0 items-center rounded-full bg-(--fam-pill-btn-bg) px-4 " +
  "text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted) disabled:opacity-50";

export interface DayNavProps {
  /** The arrows' step, in words: "week", "3 days", "day", "month". */
  distance: string;
  /** The range or day on show, where a tab draws one. The Calendar does not — its dates are in its headers. */
  label?: string;
  /**
   * Marks the label as the live day (`aria-current="date"`). The Tasks board's
   * date is the only thing on screen that says which day it is showing, so it
   * is also what shows the midnight rollover happening (003 FR-315, SC-314) —
   * that was the one thing its own copy of this row carried that the others
   * did not, and it is kept rather than flattened away.
   */
  labelIsToday?: boolean;
  /** True when the window already begins on today, so Today has nothing to do. */
  todayDisabled?: boolean;
  onPage: (direction: -1 | 1) => void;
  onToday: () => void;
  /** Other controls belonging to this row — the view switcher, the search box. */
  children?: ReactNode;
}

export function DayNav({
  distance,
  label,
  labelIsToday = false,
  todayDisabled = false,
  onPage,
  onToday,
  children,
}: DayNavProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-(--fam-edge-inset) pt-2 sm:gap-3">
      {label === undefined ? null : (
        <p
          aria-current={labelIsToday ? "date" : undefined}
          // `aria-live` so paging announces where you landed, on every tab that
          // draws a label — Meals had this, Tasks did not.
          aria-live="polite"
          className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
        >
          {label}
        </p>
      )}
      {/*
       * `ml-auto` on the cluster and not on Today: the whole group travels to
       * the right edge together, so the arrows never end up separated from the
       * button they bracket when the row wraps.
       *
       * **`flex-nowrap` and `min-w-0`, measured.** At 390px the Calendar's
       * five controls wanted 423px (children 391 + four 8px gaps) in a 370px
       * row, so the cluster wrapped onto a second line — 53px short. A
       * `flex-wrap` container WRAPS rather than shrinks, so the search box sat
       * at its full 174px while the row grew taller. Denying the wrap here lets
       * the one growable child give up those 53px instead; the OUTER row still
       * wraps, which is 011's protection against the controls overflowing off
       * the left edge, so nothing is lost at widths where even shrinking cannot
       * save it.
       */}
      <div className="ml-auto flex min-w-0 flex-nowrap items-center justify-end gap-2 sm:gap-3">
        {children}
        <button type="button" aria-label={`Previous ${distance}`} onClick={() => onPage(-1)} className={ARROW}>
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <button type="button" onClick={onToday} disabled={todayDisabled} className={TODAY}>
          Today
        </button>
        <button type="button" aria-label={`Next ${distance}`} onClick={() => onPage(1)} className={ARROW}>
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
    </div>
  );
}
