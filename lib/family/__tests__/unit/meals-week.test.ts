import { describe, expect, it } from "vitest";

import { dayHeaderOf, dayWordsOf, shiftWeek, visibleSliceOf, weekDatesOf, weekLabelOf } from "@/lib/family/meals/week";

/** 006 T021 — the grid's week (FR-602, FR-603, R606): from the household's start day, a week at a time. */

describe("weekDatesOf", () => {
  it("gives the seven days from the household's start day around any date of the week", () => {
    expect(weekDatesOf("2026-09-09", 0)).toEqual([
      "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12",
    ]);
    expect(weekDatesOf("2026-09-06", 0)[0]).toBe("2026-09-06");
    expect(weekDatesOf("2026-09-12", 0)[0]).toBe("2026-09-06");
    expect(weekDatesOf("2026-09-09", 1)).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13",
    ]);
    expect(weekDatesOf("2026-09-06", 1)[0]).toBe("2026-08-31");
  });
});

describe("shiftWeek", () => {
  it("moves a whole week either way", () => {
    expect(shiftWeek("2026-09-09", 1)).toBe("2026-09-16");
    expect(shiftWeek("2026-09-09", -2)).toBe("2026-08-26");
  });
});

describe("weekLabelOf", () => {
  it("reads as one month, two months, or two years", () => {
    expect(weekLabelOf(weekDatesOf("2026-09-09", 0))).toBe("6–12 September");
    expect(weekLabelOf(weekDatesOf("2026-09-30", 0))).toBe("27 September – 3 October");
    expect(weekLabelOf(weekDatesOf("2026-12-30", 0))).toBe("27 December 2026 – 2 January 2027");
  });
});

describe("visibleSliceOf", () => {
  const week = weekDatesOf("2026-09-09", 0);

  it("shows the whole week when it fits, and pages by what fits when it does not", () => {
    expect(visibleSliceOf(week, 7, 0)).toEqual(week);
    expect(visibleSliceOf(week, 3, 0)).toEqual(week.slice(0, 3));
    expect(visibleSliceOf(week, 3, 1)).toEqual(week.slice(3, 6));
    expect(visibleSliceOf(week, 3, 2)).toEqual(week.slice(6, 7));
  });

  it("never shows fewer than one day and clamps the page to the week", () => {
    expect(visibleSliceOf(week, 0, 0)).toEqual([week[0]]);
    expect(visibleSliceOf(week, 3, 9)).toEqual(week.slice(6, 7));
    expect(visibleSliceOf(week, 3, -1)).toEqual(week.slice(0, 3));
  });
});

describe("dayWordsOf / dayHeaderOf", () => {
  it("reads a date in words and as a column header", () => {
    expect(dayWordsOf("2026-09-09")).toBe("Wednesday 9 September");
    expect(dayWordsOf("2026-12-27")).toBe("Sunday 27 December");
    expect(dayHeaderOf("2026-09-09")).toEqual({ weekday: "Wed", numeral: "9" });
  });
});
