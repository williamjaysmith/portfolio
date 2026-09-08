import { describe, expect, it } from "vitest";

import {
  CELL_CAPACITY,
  cellFillFor,
  isInMonth,
  monthGridLength,
  monthGridStart,
  monthRows,
  spanSegmentsOf,
  timedByDay,
} from "@/lib/family/calendar/month";
import { addMonths, daysInMonth, pagedAnchor, windowFor } from "@/lib/family/calendar/views";
import type { Occurrence } from "@/lib/family/types";

/**
 * 011 R1105/R1107/R1108/R1109 — the month's arithmetic, with no clock, no React
 * and no measurement. This is where the phase's fidelity actually lives: no
 * image of the reference's Month view exists anywhere in the corpus (R1101), so
 * what can be got right is the documented behaviour and the dates.
 */

const CHICAGO = "America/Chicago";

function allDayOccurrence(
  eventId: string,
  startDate: string,
  endDate: string,
  summary = eventId,
): Occurrence {
  return {
    eventId,
    occurrenceDate: startDate,
    isRepeating: false,
    summary,
    description: null,
    location: null,
    categoryIds: [],
    times: { allDay: true, startDate, endDate },
  };
}

function timedOccurrence(eventId: string, date: string, startsAt: string): Occurrence {
  return {
    eventId,
    occurrenceDate: date,
    isRepeating: false,
    summary: eventId,
    description: null,
    location: null,
    categoryIds: [],
    times: { allDay: false, startsAt, endsAt: startsAt },
  };
}

describe("the grid's extent (R1107)", () => {
  it("starts on the household's own week start, not on the 1st", () => {
    // 2026-09-01 is a Tuesday. Sunday-start → 2026-08-30; Monday-start → 2026-08-31.
    expect(monthGridStart("2026-09-15", 0)).toBe("2026-08-30");
    expect(monthGridStart("2026-09-15", 1)).toBe("2026-08-31");
  });

  it("covers whole weeks, always a multiple of seven", () => {
    for (let month = 1; month <= 12; month += 1) {
      const date = `2026-${String(month).padStart(2, "0")}-10`;
      for (const startWeekOn of [0, 1] as const) {
        const length = monthGridLength(date, startWeekOn);
        expect(length % 7, `${date} start ${startWeekOn}`).toBe(0);
        expect([28, 35, 42]).toContain(length);
      }
    }
  });

  it("takes six rows only when the month needs six", () => {
    // August 2026 begins on a Saturday and has 31 days — six rows Sunday-start.
    expect(monthGridLength("2026-08-10", 0)).toBe(42);
  });

  it("takes FOUR rows when four is the truth, rather than padding to five", () => {
    // February 2026 begins on a Sunday and has 28 days: four whole weeks and
    // nothing more. Padding it would draw a row of another month for no reason
    // (R1107) — and on a wall display the taller cells are the better outcome.
    expect(monthGridLength("2026-02-10", 0)).toBe(28);
    // The same month on a Monday-start household is NOT four weeks: it starts
    // on the Sunday before, so it needs five rows.
    expect(monthGridLength("2026-02-10", 1)).toBe(35);
  });

  it("holds every day of the month it is drawn for, in every month of a year", () => {
    for (let month = 1; month <= 12; month += 1) {
      const anchor = `2028-${String(month).padStart(2, "0")}-10`;
      for (const startWeekOn of [0, 1] as const) {
        const start = monthGridStart(anchor, startWeekOn);
        const rows = monthRows(start, monthGridLength(anchor, startWeekOn));
        const days = rows.flat();
        const last = `${anchor.slice(0, 7)}-${String(daysInMonth(2028, month)).padStart(2, "0")}`;
        expect(days, `${anchor} start ${startWeekOn}`).toContain(`${anchor.slice(0, 7)}-01`);
        expect(days, `${anchor} start ${startWeekOn}`).toContain(last);
      }
    }
  });

  it("covers a leap February", () => {
    const start = monthGridStart("2028-02-10", 0);
    const days = monthRows(start, monthGridLength("2028-02-10", 0)).flat();
    expect(days).toContain("2028-02-29");
  });

  it("makes rows of exactly seven consecutive days", () => {
    const rows = monthRows("2026-08-30", 42);
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row).toHaveLength(7);
    expect(rows[0][0]).toBe("2026-08-30");
    expect(rows[5][6]).toBe("2026-10-10");
  });

  it("knows which cells are the neighbours' days", () => {
    expect(isInMonth("2026-08-30", "2026-09-15")).toBe(false);
    expect(isInMonth("2026-09-01", "2026-09-15")).toBe(true);
    expect(isInMonth("2026-10-01", "2026-09-15")).toBe(false);
  });
});

describe("the cell's capacity (R1108)", () => {
  it("shows everything up to three", () => {
    expect(cellFillFor(0)).toEqual({ shown: 0, hidden: 0 });
    expect(cellFillFor(1)).toEqual({ shown: 1, hidden: 0 });
    expect(cellFillFor(CELL_CAPACITY)).toEqual({ shown: 3, hidden: 0 });
  });

  it("steps DOWN to two the moment there is a fourth", () => {
    // The documented behaviour, and the reason this is a function: at four the
    // cell shows fewer than it did at three, to make room for the indicator.
    expect(cellFillFor(4)).toEqual({ shown: 2, hidden: 2 });
  });

  it("keeps showing two however many there are, and counts the rest", () => {
    expect(cellFillFor(9)).toEqual({ shown: 2, hidden: 7 });
    expect(cellFillFor(40)).toEqual({ shown: 2, hidden: 38 });
  });

  it("never reports a negative", () => {
    expect(cellFillFor(-1)).toEqual({ shown: 0, hidden: 0 });
  });
});

describe("spanning bars (R1109)", () => {
  // A six-row grid: 2026-08-30 (Sunday) through 2026-10-10.
  const GRID = "2026-08-30";
  const LENGTH = 42;

  it("draws a within-row span as one segment", () => {
    const segments = spanSegmentsOf(allDayOccurrence("e1", "2026-09-01", "2026-09-03"), GRID, LENGTH);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      row: 0,
      startColumn: 2,
      endColumn: 4,
      continuesLeft: false,
      continuesRight: false,
    });
  });

  it("cuts a span crossing a week boundary into one segment per row", () => {
    // Fri 2026-09-04 → Tue 2026-09-08 crosses the Sat/Sun break.
    const segments = spanSegmentsOf(allDayOccurrence("e2", "2026-09-04", "2026-09-08"), GRID, LENGTH);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ row: 0, startColumn: 5, endColumn: 6, continuesRight: true });
    expect(segments[1]).toMatchObject({ row: 1, startColumn: 0, endColumn: 2, continuesLeft: true });
  });

  it("marks the middle rows of a long span as continuing both ways", () => {
    const segments = spanSegmentsOf(allDayOccurrence("e3", "2026-09-01", "2026-09-30"), GRID, LENGTH);
    expect(segments.length).toBeGreaterThan(2);
    const middle = segments[1];
    expect(middle.continuesLeft).toBe(true);
    expect(middle.continuesRight).toBe(true);
    expect(middle.startColumn).toBe(0);
    expect(middle.endColumn).toBe(6);
  });

  it("clamps to the grid and says it continues, rather than dropping the event", () => {
    const before = spanSegmentsOf(allDayOccurrence("e4", "2026-08-01", "2026-09-02"), GRID, LENGTH);
    expect(before[0]).toMatchObject({ row: 0, startColumn: 0, continuesLeft: true });

    const after = spanSegmentsOf(allDayOccurrence("e5", "2026-10-08", "2026-11-20"), GRID, LENGTH);
    expect(after[after.length - 1].continuesRight).toBe(true);
  });

  it("draws nothing for a span that misses the grid entirely", () => {
    expect(spanSegmentsOf(allDayOccurrence("e6", "2026-01-01", "2026-01-05"), GRID, LENGTH)).toEqual([]);
    expect(spanSegmentsOf(allDayOccurrence("e7", "2027-01-01", "2027-01-05"), GRID, LENGTH)).toEqual([]);
  });

  it("draws nothing for a timed occurrence — spans are all-day only", () => {
    expect(spanSegmentsOf(timedOccurrence("e8", "2026-09-01", "2026-09-01T14:00:00.000Z"), GRID, LENGTH)).toEqual([]);
  });

  it("covers exactly the days the event covers, with no gap and no overlap", () => {
    const segments = spanSegmentsOf(allDayOccurrence("e9", "2026-09-02", "2026-09-19"), GRID, LENGTH);
    const covered = segments.reduce(
      (total, segment) => total + (segment.endColumn - segment.startColumn + 1),
      0,
    );
    expect(covered).toBe(18);
  });
});

describe("a day's timed occurrences", () => {
  it("groups them by day and orders them by start", () => {
    const byDay = timedByDay([
      timedOccurrence("late", "2026-09-01", "2026-09-01T20:00:00.000Z"),
      timedOccurrence("early", "2026-09-01", "2026-09-01T14:00:00.000Z"),
      timedOccurrence("other", "2026-09-02", "2026-09-02T14:00:00.000Z"),
    ]);
    expect(byDay.get("2026-09-01")?.map((one) => one.eventId)).toEqual(["early", "late"]);
    expect(byDay.get("2026-09-02")).toHaveLength(1);
  });

  it("leaves all-day occurrences out, so a cell's count is not doubled", () => {
    const byDay = timedByDay([allDayOccurrence("span", "2026-09-01", "2026-09-03")]);
    expect(byDay.size).toBe(0);
  });
});

describe("paging and windows (R1106)", () => {
  it("moves a month by a calendar month, from every month of a year", () => {
    for (let month = 1; month <= 12; month += 1) {
      const date = `2026-${String(month).padStart(2, "0")}-10`;
      const next = pagedAnchor("month", date, 1, { columns: 7 });
      const expected = month === 12 ? "2027-01-10" : `2026-${String(month + 1).padStart(2, "0")}-10`;
      expect(next, date).toBe(expected);
    }
  });

  it("crosses December into January and back", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2027-01-15", -1)).toBe("2026-12-15");
  });

  it("clamps to the target month's length rather than overflowing", () => {
    // The 31st of January minus a month is the 28th of February, not the 3rd
    // of March — which is what a naive Date would give.
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("moves a day by a day and a week by its own width", () => {
    expect(pagedAnchor("day", "2026-09-07", 1, { columns: 7 })).toBe("2026-09-08");
    expect(pagedAnchor("day", "2026-09-07", -1, { columns: 7 })).toBe("2026-09-06");
    expect(pagedAnchor("week", "2026-09-06", 1, { columns: 7 })).toBe("2026-09-13");
    expect(pagedAnchor("week", "2026-09-06", 1, { columns: 3 })).toBe("2026-09-09");
  });

  it("gives each view its own window from the same anchor", () => {
    const options = { columns: 7, startWeekOn: 0 as const };
    expect(windowFor("day", "2026-09-15", CHICAGO, options)).toMatchObject({
      startDate: "2026-09-15",
      endDate: "2026-09-15",
    });
    expect(windowFor("week", "2026-09-13", CHICAGO, options)).toMatchObject({
      startDate: "2026-09-13",
      endDate: "2026-09-19",
    });
    expect(windowFor("month", "2026-09-15", CHICAGO, options)).toMatchObject({
      startDate: "2026-08-30",
      endDate: "2026-10-03",
    });
  });
});
