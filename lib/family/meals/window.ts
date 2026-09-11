import { addDays } from "../calendar/dates";

/**
 * The Meals grid's window (013 FR-1301–FR-1304, FR-1307).
 *
 * **A first day and a count.** Everything the grid draws comes from those two
 * numbers: the days on screen, where a step lands, and what the label says.
 *
 * **What it replaced, and why.** Until 013 the grid held two independent states —
 * a seven-day week from the household's start day (`weekDatesOf`, paged ±7 by the
 * labelled arrows) and a separately-paged slice of those seven (paged one column
 * at a time by an unlabelled swipe). On the wall tablet all seven fit, the two
 * agreed, and the model looked fine. On a phone two columns fit and they
 * disagreed: the arrows moved seven days while two were on screen, so five days
 * per step were reachable only by a gesture nobody was told about. The operator's
 * report was that the tab "doesn't really navigate days the way calendar view
 * does".
 *
 * Making the two agree does not work, which is worth stating so nobody tries:
 * a page-sized step from Thursday inside a Sunday week runs past Saturday, and
 * rolling the anchor a week while resetting the slice **skips a day**. The window
 * stops being a slice of a week, so the week stops being the unit.
 *
 * **This reverses 006 Assumption 3** — "a whole week at a time — a planning grid,
 * not the calendar's rolling window anchored on today" — deliberately, on the
 * record, because the devices the household actually uses contradicted it. The
 * reference's 7-column grid is `[VERIFIED]` and untouched; its NAVIGATION was
 * `[UNKNOWN]`, and our own research inferred parity with the Calendar tab
 * (03-lists-meals-recipes.md:105), which is what this restores.
 *
 * The arithmetic lives here, pure, because two of its guarantees cannot be
 * checked anywhere else: abutment is a property of a sequence of steps that no
 * browser journey walks, and the midnight hold cannot be driven in a browser at
 * all (the e2e clock helper refuses jumps over three hours, 009).
 */

/** The `columns` consecutive days a window shows, beginning on its anchor. */
export function windowDatesOf(anchorDate: string, columns: number): string[] {
  if (!Number.isInteger(columns) || columns < 1) {
    // Zero would render an empty grid that merely looks like a loading state,
    // and the caller would have a bug nobody could see. Refused loudly instead.
    throw new Error(`a window needs at least one column, got ${columns}`);
  }
  return Array.from({ length: columns }, (_, index) => addDays(anchorDate, index));
}

/**
 * One step: the anchor moved by exactly the width on show.
 *
 * **That equality is the whole fix** (FR-1302, FR-1303). Because a step is the
 * window's own width, consecutive windows abut — the next begins the day after
 * the last one ended — so nothing is skipped and nothing repeats.
 *
 * Seven columns is not a special case. The wall tablet moves a week because a
 * week is the width it happens to fit; if this function ever needs a branch for
 * `columns === 7`, the rule has been misunderstood.
 */
export function shiftWindow(anchorDate: string, columns: number, direction: -1 | 1): string {
  return addDays(anchorDate, direction * columns);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function partsOf(date: string): { day: number; month: string; year: number } {
  return {
    day: Number(date.slice(8, 10)),
    month: MONTHS[Number(date.slice(5, 7)) - 1],
    year: Number(date.slice(0, 4)),
  };
}

/**
 * What the window is called: "10–11 September", "28 September – 4 October",
 * "28 December 2026 – 3 January 2027", or "10 September" for a single day.
 *
 * Moved here from `week.ts` and renamed from `weekLabelOf` (013 T004). Its
 * behaviour has not changed — it always rendered a day RANGE rather than a
 * week's name, so only the name was lying. Under a rolling window that name
 * would have been a second lie, after the arrows'.
 */
export function windowLabelOf(dates: readonly string[]): string {
  const first = partsOf(dates[0]);
  const last = partsOf(dates[dates.length - 1]);

  // One column fits: "10–10 September" would be absurd.
  if (dates.length === 1) return `${first.day} ${first.month}`;

  if (first.year !== last.year) {
    return `${first.day} ${first.month} ${first.year} – ${last.day} ${last.month} ${last.year}`;
  }
  if (first.month !== last.month) return `${first.day} ${first.month} – ${last.day} ${last.month}`;
  return `${first.day}–${last.day} ${first.month}`;
}

/**
 * The arrows' step in words: "week" for seven days, "day" for one, "N days"
 * otherwise (013 FR-1306).
 *
 * It lived in the Meals tab's own `WeekNav` until 014 replaced that with the
 * shared `DayNav`. It did NOT move into the shared component: the Calendar
 * names its own step (it has a Month view, which is not a count of days), so
 * the word is the caller's and this is the Meals caller's rule.
 *
 * "day" rather than "1 days" is the whole reason this is a function — a week is
 * not a special case, it is what seven days is called, and one day is what one
 * day is called.
 */
export function distanceInWords(columns: number): string {
  if (columns === 7) return "week";
  if (columns === 1) return "day";
  return `${columns} days`;
}
