import { addDays, weekStartOf } from "../calendar/dates";
import type { WeekStart } from "../types";

/**
 * The Meals grid's week (006 FR-602, FR-603, R606): the seven days from the
 * household's start day, a whole week at a time — a planning grid, not the
 * calendar's rolling window anchored on today (spec Assumption 3).
 */

const WEEK_DAYS = 7;

/** The seven dates of the week `anchorDate` falls in, from the household's start day. */
export function weekDatesOf(anchorDate: string, startWeekOn: WeekStart): string[] {
  const start = weekStartOf(anchorDate, startWeekOn);
  return Array.from({ length: WEEK_DAYS }, (_, index) => addDays(start, index));
}

/** The same day `weeks` weeks away — the arrows' step. */
export function shiftWeek(anchorDate: string, weeks: number): string {
  return addDays(anchorDate, weeks * WEEK_DAYS);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function partsOf(date: string): { day: number; month: string; year: number } {
  return { day: Number(date.slice(8, 10)), month: MONTHS[Number(date.slice(5, 7)) - 1], year: Number(date.slice(0, 4)) };
}

/** "7–13 September", "28 September – 4 October", "28 December 2026 – 3 January 2027". */
export function weekLabelOf(dates: readonly string[]): string {
  const first = partsOf(dates[0]);
  const last = partsOf(dates[dates.length - 1]);
  if (first.year !== last.year) {
    return `${first.day} ${first.month} ${first.year} – ${last.day} ${last.month} ${last.year}`;
  }
  if (first.month !== last.month) return `${first.day} ${first.month} – ${last.day} ${last.month}`;
  return `${first.day}–${last.day} ${first.month}`;
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
