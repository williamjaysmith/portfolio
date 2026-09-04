import { describe, expect, it } from "vitest";
import {
  epochDayOf,
  isoOfEpochDay,
  monthsBetween,
  weekdayIndexOf,
  weekStartDay,
} from "@/lib/family/recurrence/plain-date";

/**
 * T014 — the two epoch-day helpers hoisted into the shared date vocabulary
 * (R303): `weekStartDay`, which `calendar/dates.ts`'s `weekStartOf` is now a
 * thin wrapper over, and `monthsBetween`, which the anchor-relative monthly
 * predicate counts intervals with. Both are pure integer arithmetic on
 * UTC-midnight day counters, so neither can see a DST transition.
 */

/** `weekStartDay` expressed on plain dates, the form the tables read in. */
function weekStartOfDate(date: string, startWeekOn: number): string {
  return isoOfEpochDay(weekStartDay(epochDayOf(date), startWeekOn));
}

function monthsBetweenDates(from: string, to: string): number {
  return monthsBetween(epochDayOf(from), epochDayOf(to));
}

describe("weekStartDay", () => {
  it.each([
    ["2026-09-09", 0, "2026-09-06"], // Wednesday → Sunday
    ["2026-09-06", 0, "2026-09-06"], // Sunday → itself
    ["2026-09-12", 0, "2026-09-06"], // Saturday → the Sunday six days back
    ["2026-09-06", 1, "2026-08-31"], // Sunday → the previous Monday
    ["2026-09-07", 1, "2026-09-07"], // Monday → itself
    ["2026-09-13", 1, "2026-09-07"], // the next Sunday → the same Monday
  ])("%s with start-of-week %i is %s", (date, startWeekOn, expected) => {
    expect(weekStartOfDate(date, startWeekOn)).toBe(expected);
  });

  it("lands on the named weekday and never moves more than six days back", () => {
    const day = epochDayOf("2026-09-09");
    for (let startWeekOn = 0; startWeekOn < 7; startWeekOn += 1) {
      const start = weekStartDay(day, startWeekOn);
      expect(weekdayIndexOf(start)).toBe(startWeekOn);
      expect(day - start).toBeGreaterThanOrEqual(0);
      expect(day - start).toBeLessThan(7);
    }
  });

  it("is idempotent — a week start is its own week start", () => {
    const start = weekStartDay(epochDayOf("2026-09-09"), 0);
    expect(weekStartDay(start, 0)).toBe(start);
  });

  it("puts two dates seven days apart in adjacent weeks, whatever the start", () => {
    const day = epochDayOf("2026-03-08"); // the spring-forward Sunday
    for (let startWeekOn = 0; startWeekOn < 7; startWeekOn += 1) {
      expect(weekStartDay(day + 7, startWeekOn) - weekStartDay(day, startWeekOn)).toBe(7);
    }
  });
});

describe("monthsBetween", () => {
  it.each([
    ["2026-01-15", "2026-01-15", 0],
    ["2026-01-01", "2026-01-31", 0], // calendar months, not elapsed days
    ["2026-01-31", "2026-02-01", 1], // one day apart, one month apart
    ["2026-01-31", "2026-01-01", 0],
    ["2026-12-01", "2027-01-01", 1], // across the year boundary
    ["2027-01-01", "2026-12-01", -1], // signed: `to` before `from`
    ["2026-01-15", "2029-01-15", 36],
    ["2026-02-28", "2026-08-31", 6],
  ])("from %s to %s is %i months", (from, to, expected) => {
    expect(monthsBetweenDates(from, to)).toBe(expected);
  });

  it("counts every month of a two-year walk exactly once", () => {
    const counts = new Set<number>();
    for (let day = epochDayOf("2026-01-01"); day <= epochDayOf("2027-12-31"); day += 1) {
      counts.add(monthsBetween(epochDayOf("2026-01-01"), day));
    }
    expect([...counts].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 24 }, (_value, index) => index),
    );
  });
});
