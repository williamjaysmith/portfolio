"use client";

import { useRef, useState } from "react";

import { CALENDAR_VIEWS, VIEW_LABELS, type CalendarView } from "@/lib/family/calendar/views";

/**
 * The calendar's view control (011 FR-1101).
 *
 * The reference's is **one button in the information bar whose label is the
 * currently active view** [VERIFIED](44738510847259) — not a segmented control
 * and not one button per view. Whether tapping it cycles or opens a picker is
 * `[UNKNOWN]`: the dossier records "cycles/opens a picker" and declines to
 * choose.
 *
 * **This opens a list** (spec Assumption 1). Cycling through three views to
 * reach the one you want means two wrong screens on a wall display somebody is
 * walking past; a list names them and takes one tap. The label still carries
 * the current view, which is the part the reference actually specifies.
 *
 * The list is a plain popover rather than a `<dialog>`: it is a three-item menu
 * beside its own button, not a modal, and the shell's dialog idiom would trap
 * focus for a choice that should be one tap in and one tap out.
 */

const PILL =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) items-center justify-center gap-2 " +
  "rounded-full bg-(--fam-pill-btn-bg) px-4 font-medium " +
  "text-(length:--fam-fs-pill) text-(--fam-text-muted)";

const ITEM =
  "flex min-h-(--fam-touch) w-full items-center rounded-(--fam-radius-pill) px-4 text-left " +
  "text-(length:--fam-fs-body) text-(--fam-text-primary)";

export interface ViewSwitcherProps {
  view: CalendarView;
  onChange: (next: CalendarView) => void;
}

export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function choose(next: CalendarView): void {
    setOpen(false);
    buttonRef.current?.focus();
    onChange(next);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        // The accessible name says what it DOES; the visible label says which
        // view is showing, which is the reference's own idiom.
        aria-label={`Change view — currently ${VIEW_LABELS[view]}`}
        onClick={() => setOpen((current) => !current)}
        // Above the outside-tap overlay below. Without this the overlay covers
        // the button while the menu is open, so a second tap on the control
        // that opened it does nothing — the household taps "Week" expecting the
        // menu to close and the menu stays put.
        className={`relative z-20 ${PILL}`}
      >
        {VIEW_LABELS[view]}
      </button>

      {open ? (
        <>
          {/* A tap anywhere else closes it, the way the reference's own
              detail panels dismiss (08:38). */}
          <button
            type="button"
            aria-label="Close the view menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <ul
            role="menu"
            aria-label="Calendar view"
            className="absolute right-0 top-full z-30 mt-1 w-40 rounded-(--fam-radius-modal) border border-(--fam-hairline) bg-(--fam-app-bg) p-1 shadow-lg"
          >
            {CALENDAR_VIEWS.map((option) => (
              <li key={option} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={option === view}
                  onClick={() => choose(option)}
                  className={ITEM}
                >
                  {VIEW_LABELS[option]}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
