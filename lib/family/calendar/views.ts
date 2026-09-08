/**
 * The calendar's views, and what each one's window is (011 R1105).
 *
 * The reference offers four — Day, Week, Month and Schedule
 * [VERIFIED](44738510847259). This project ships three; Schedule is deferred
 * with its cost written into the spec's Out of Scope, because it is not a
 * fourth renderer but a fourth renderer plus two household settings and a
 * gesture whose meaning the sources leave unresolved (R1113).
 *
 * The point of this module is that **a view is only a window shape**. Every
 * view fetches and expands through the same `viewWindowOf` and the same
 * `expandWindow`; what differs is how many consecutive days the window covers
 * and which day it starts on. Nothing here knows how anything is drawn.
 */

import type { WeekStart } from "../types";

import { addDays, viewWindowOf, type DateWindow } from "./dates";
import { monthGridStart, monthGridLength } from "./month";

/** The views this project draws. Schedule is the reference's fourth (R1113). */
export const CALENDAR_VIEWS = ["day", "week", "month"] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** The view a device shows until somebody chooses otherwise. */
export const DEFAULT_VIEW: CalendarView = "week";

/** What each view is called, in the switcher and in its own label. */
export const VIEW_LABELS: Readonly<Record<CalendarView, string>> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export function isCalendarView(value: unknown): value is CalendarView {
  return typeof value === "string" && (CALENDAR_VIEWS as readonly string[]).includes(value);
}

/**
 * The window a view draws, from the day it is anchored on.
 *
 * `columns` is the week's measured column count and is ignored by the other
 * two — a day is one day and a month is its own arithmetic. It is passed
 * rather than read so this stays pure.
 */
export function windowFor(
  view: CalendarView,
  anchorDate: string,
  zone: string,
  options: { columns: number; startWeekOn: WeekStart },
): DateWindow {
  if (view === "day") return viewWindowOf(anchorDate, 1, zone);
  if (view === "month") {
    const start = monthGridStart(anchorDate, options.startWeekOn);
    return viewWindowOf(start, monthGridLength(anchorDate, options.startWeekOn), zone);
  }
  return viewWindowOf(anchorDate, options.columns, zone);
}

/**
 * One page later (`1`) or earlier (`-1`) from `anchorDate`, in the units the
 * view moves in (R1106).
 *
 * A week moves by its own width, so consecutive pages abut and no day is shown
 * twice — Phase 2's rule, unchanged. A day moves by a day. **A month moves by
 * a calendar month**, which is the one case a day count cannot express: months
 * are 28 to 31 days.
 */
export function pagedAnchor(
  view: CalendarView,
  anchorDate: string,
  direction: -1 | 1,
  options: { columns: number },
): string {
  if (view === "day") return addDays(anchorDate, direction);
  if (view === "month") return addMonths(anchorDate, direction);
  return addDays(anchorDate, direction * options.columns);
}

/**
 * The day a view anchors on when it is showing "today" (R1106).
 *
 * A week snaps through its own start-of-week rule, which Phase 2 owns; a day
 * is today; a month is today too, because the grid derives its own first day
 * from whichever day it is anchored on.
 */
export function anchorForToday(
  view: CalendarView,
  todayDate: string,
  weekAnchor: string,
): string {
  return view === "week" ? weekAnchor : todayDate;
}

/**
 * A calendar month later or earlier, clamped to the target month's length.
 *
 * The 31st of January minus a month is the 28th of February, not the 3rd of
 * March. JavaScript's own `Date` overflows instead, which is why this is
 * written out rather than delegated.
 */
export function addMonths(date: string, months: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));

  const zeroBased = month - 1 + months;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12;

  const lastDay = daysInMonth(targetYear, targetMonth + 1);
  return `${pad4(targetYear)}-${pad2(targetMonth + 1)}-${pad2(Math.min(day, lastDay))}`;
}

/** Days in a 1-based month, leap years included. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad4(value: number): string {
  return String(value).padStart(4, "0");
}
