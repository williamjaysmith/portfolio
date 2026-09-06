"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The grid's week controls (006 FR-603; R606): the week's label between
 * previous and next, and **Today** — the arrows are the keyboard path the
 * pager's swipe has none of. Inferred from the calendar (dossier 03 §8) and
 * adopted; a planning grid moves a week at a time.
 */

export interface WeekNavProps {
  label: string;
  /** True while the shown week holds today — Today then has nothing to do. */
  isCurrentWeek: boolean;
  onPage: (direction: -1 | 1) => void;
  onToday: () => void;
}

const ICON = "grid h-(--fam-touch) w-(--fam-touch) place-items-center rounded-full bg-(--fam-pill-btn-bg)";
const PILL =
  "flex min-h-(--fam-touch) items-center rounded-full bg-(--fam-pill-btn-bg) px-4 text-(length:--fam-fs-pill) " +
  "font-medium text-(--fam-text-muted) disabled:opacity-50";

export function WeekNav({ label, isCurrentWeek, onPage, onToday }: WeekNavProps) {
  return (
    <div className="flex items-center gap-2 px-(--fam-edge-inset)">
      <button type="button" aria-label="Previous week" onClick={() => onPage(-1)} className={ICON}>
        <ChevronLeft aria-hidden="true" size={22} />
      </button>
      <button type="button" aria-label="Next week" onClick={() => onPage(1)} className={ICON}>
        <ChevronRight aria-hidden="true" size={22} />
      </button>
      <p aria-live="polite" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)">
        {label}
      </p>
      <button type="button" onClick={onToday} disabled={isCurrentWeek} className={`${PILL} ml-auto`}>
        Today
      </button>
    </div>
  );
}
