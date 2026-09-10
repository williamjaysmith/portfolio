const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * How the Meals grid words a day (006 FR-625, FR-646).
 *
 * **This file used to own the grid's week, and no longer does.** It held
 * `weekDatesOf`, `shiftWeek` and `weekLabelOf`, and its header stated 006
 * Assumption 3 as settled: *"the seven days from the household's start day, a
 * whole week at a time — a planning grid, not the calendar's rolling window
 * anchored on today"*.
 *
 * **013 reversed that assumption**, because the devices the household actually
 * uses contradicted it: on a phone two of the seven columns fit, so arrows that
 * moved a week skipped five days per step and the household's own report was
 * that the tab "doesn't really navigate days the way calendar view does". The
 * window now lives in `window.ts` — a first day and a measured count — and
 * `weekLabelOf` went with it as `windowLabelOf`, since it always rendered a day
 * RANGE rather than a week's name and only the name was lying.
 *
 * The reference's 7-column grid is `[VERIFIED]` and untouched by any of that.
 * What changed is navigation, which the research had marked `[UNKNOWN]` and
 * inferred should match the Calendar tab.
 *
 * What is left here is the wording of a single day, which no model of the window
 * affects.
 */

function partsOf(date: string): { day: number; month: string } {
  return { day: Number(date.slice(8, 10)), month: MONTHS[Number(date.slice(5, 7)) - 1] };
}


const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayIndexOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "Wednesday 9 September" — a cell's and a popover's date in words (FR-625, FR-646). */
export function dayWordsOf(date: string): string {
  const { day, month } = partsOf(date);
  return `${WEEKDAYS_LONG[weekdayIndexOf(date)]} ${day} ${month}`;
}

/** "Wed" and "9" — a day column's header. */
export function dayHeaderOf(date: string): { weekday: string; numeral: string } {
  return { weekday: WEEKDAYS_SHORT[weekdayIndexOf(date)], numeral: String(partsOf(date).day) };
}
