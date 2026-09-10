"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The grid's window controls (006 FR-603, R606; 013 FR-1302, FR-1306): the days
 * on show between previous and next, and **Today**.
 *
 * **The arrows say how far they go, because that distance changes with the
 * screen** (013). They used to read "Previous week" / "Next week" always, under a
 * docstring that said "a planning grid moves a week at a time" — and on a phone
 * showing two of seven columns that label was describing a step which skipped
 * five days. Now the label is derived from the count, so it is "Previous 3 days"
 * where three are drawn and "Previous week" where seven are. A week is not a
 * special case; it is what seven days is called.
 *
 * The arrows remain the keyboard path the pager's swipe has none of — and since
 * 013 both move the same distance, so they are two ways to do one thing rather
 * than two things.
 */

export interface WeekNavProps {
  label: string;
  /** How many day columns are on show — what the arrows move, and how they say so. */
  columns: number;
  /** True while the window BEGINS on today — Today then has nothing to do. */
  isLiveWindow: boolean;
  onPage: (direction: -1 | 1) => void;
  onToday: () => void;
}

/**
 * "week" for seven days, "N days" otherwise — and "day" for one, because
 * "Previous 1 days" is the kind of string that makes an app feel unfinished.
 */
function distanceInWords(columns: number): string {
  if (columns === 7) return "week";
  if (columns === 1) return "day";
  return `${columns} days`;
}

const ICON = "grid h-(--fam-touch) w-(--fam-touch) place-items-center rounded-full bg-(--fam-pill-btn-bg)";
const PILL =
  "flex min-h-(--fam-touch) items-center rounded-full bg-(--fam-pill-btn-bg) px-4 text-(length:--fam-fs-pill) " +
  "font-medium text-(--fam-text-muted) disabled:opacity-50";

export function WeekNav({ label, columns, isLiveWindow, onPage, onToday }: WeekNavProps) {
  const distance = distanceInWords(columns);
  return (
    <div className="flex items-center gap-2 px-(--fam-edge-inset)">
      <button type="button" aria-label={`Previous ${distance}`} onClick={() => onPage(-1)} className={ICON}>
        <ChevronLeft aria-hidden="true" size={22} />
      </button>
      <button type="button" aria-label={`Next ${distance}`} onClick={() => onPage(1)} className={ICON}>
        <ChevronRight aria-hidden="true" size={22} />
      </button>
      <p aria-live="polite" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)">
        {label}
      </p>
      <button type="button" onClick={onToday} disabled={isLiveWindow} className={`${PILL} ml-auto`}>
        Today
      </button>
    </div>
  );
}
