"use client";

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
 * **It cycles.** 011 opened a list instead, reasoning that cycling costs two
 * wrong screens to reach the third view on a wall display somebody is walking
 * past. Shipped, that reasoning lost to a phone: the operator's report is that
 * the menu *"is off the page on my small phone"*, which makes the control not
 * merely slower but unusable on the device it matters most on. A cycle has no
 * popover to fit, no overlay to tap through, and no placement to get wrong at
 * 320px.
 *
 * The cost is named rather than waved away: reaching Month from Day is two taps.
 * Three views make that a ceiling of two, and the view is remembered per device
 * (`useCalendarView`), so a household that lives in Month pays it once.
 *
 * Week stays the default (`DEFAULT_VIEW`), and the order is `CALENDAR_VIEWS`
 * itself — Day, Week, Month — so the cycle reads as widening the window and
 * wrapping, rather than as an arbitrary rotation.
 */

const PILL =
  "flex min-h-(--fam-touch) min-w-(--fam-touch) items-center justify-center gap-2 " +
  "rounded-full bg-(--fam-pill-btn-bg) px-4 font-medium " +
  "text-(length:--fam-fs-pill) text-(--fam-text-muted)";

export interface ViewSwitcherProps {
  view: CalendarView;
  onChange: (next: CalendarView) => void;
}

/** The next view in `CALENDAR_VIEWS`, wrapping Month back round to Day. */
export function nextView(view: CalendarView): CalendarView {
  const at = CALENDAR_VIEWS.indexOf(view);
  return CALENDAR_VIEWS[(at + 1) % CALENDAR_VIEWS.length];
}

export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  const next = nextView(view);

  return (
    <button
      type="button"
      // The accessible name says what is showing AND what one tap will do,
      // because with no menu to open there is nothing else to discover it from.
      // The visible label stays the current view, which is the part the
      // reference actually specifies.
      aria-label={`Calendar view: ${VIEW_LABELS[view]}. Tap for ${VIEW_LABELS[next]}.`}
      onClick={() => onChange(next)}
      className={PILL}
    >
      {VIEW_LABELS[view]}
    </button>
  );
}
