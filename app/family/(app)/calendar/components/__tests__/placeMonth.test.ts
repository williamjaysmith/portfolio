import { describe, expect, it } from "vitest";

import { viewWindowOf } from "@/lib/family/calendar/dates";
import type { Occurrence } from "@/lib/family/types";

import { placeMonth } from "../useMonthOccurrences";

/**
 * 011 — the month's placement layer: occurrences and a window in, drawable rows
 * and bars out.
 *
 * The two properties worth pinning are the ones a careless implementation gets
 * wrong in a way nobody notices until a busy month: an all-day event must be
 * counted ONCE (as a span, never also in the cell's timed list, or every
 * overflow number is wrong), and the "+ More" list must show the WHOLE day
 * rather than only the half the cell had room for.
 */

const CHICAGO = "America/Chicago";
// Sunday 2026-08-30 through Saturday 2026-10-10 — September's six-row grid.
const WINDOW = viewWindowOf("2026-08-30", 42, CHICAGO);
const MONTH = "2026-09-15";

function timed(id: string, date: string, hour: number): Occurrence {
  const at = `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  return {
    eventId: id,
    occurrenceDate: date,
    isRepeating: false,
    summary: id,
    description: null,
    location: null,
    categoryIds: [],
    times: { allDay: false, startsAt: at, endsAt: at },
  };
}

function span(id: string, startDate: string, endDate: string): Occurrence {
  return {
    eventId: id,
    occurrenceDate: startDate,
    isRepeating: false,
    summary: id,
    description: null,
    location: null,
    categoryIds: [],
    times: { allDay: true, startDate, endDate },
  };
}

const cellOn = (rows: ReturnType<typeof placeMonth>["rows"], date: string) =>
  rows.flat().find((cell) => cell.date === date);

describe("placeMonth", () => {
  it("lays the window out as week rows of seven", () => {
    const { rows } = placeMonth([], WINDOW, MONTH);
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row).toHaveLength(7);
    expect(rows[0][0].date).toBe("2026-08-30");
  });

  it("marks the neighbours' days as out of month", () => {
    const { rows } = placeMonth([], WINDOW, MONTH);
    expect(cellOn(rows, "2026-08-31")?.inMonth).toBe(false);
    expect(cellOn(rows, "2026-09-01")?.inMonth).toBe(true);
    expect(cellOn(rows, "2026-10-01")?.inMonth).toBe(false);
  });

  it("puts a day's timed events in its cell, in start order", () => {
    const { rows } = placeMonth(
      [timed("late", "2026-09-03", 20), timed("early", "2026-09-03", 14)],
      WINDOW,
      MONTH,
    );
    expect(cellOn(rows, "2026-09-03")?.timed.map((one) => one.eventId)).toEqual(["early", "late"]);
  });

  it("applies the documented capacity, stepping down to two at four", () => {
    const four = [14, 15, 16, 17].map((hour) => timed(`e${hour}`, "2026-09-03", hour));
    const { rows } = placeMonth(four, WINDOW, MONTH);
    expect(cellOn(rows, "2026-09-03")).toMatchObject({ shown: 2, hidden: 2 });

    const three = four.slice(0, 3);
    expect(cellOn(placeMonth(three, WINDOW, MONTH).rows, "2026-09-03")).toMatchObject({
      shown: 3,
      hidden: 0,
    });
  });

  it("counts an all-day event ONCE, as a span — never also in the cell's list", () => {
    // The bug this guards: counting a span in its days' timed lists too, which
    // makes every overflow number on those days wrong.
    const { rows, segments } = placeMonth([span("holiday", "2026-09-01", "2026-09-04")], WINDOW, MONTH);

    expect(segments).toHaveLength(1);
    for (const date of ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]) {
      expect(cellOn(rows, date)?.timed, date).toEqual([]);
      expect(cellOn(rows, date)?.hidden, date).toBe(0);
    }
  });

  it("still lists the span in the day's full list, where a household expects it", () => {
    const { rows } = placeMonth(
      [span("holiday", "2026-09-01", "2026-09-04"), timed("dentist", "2026-09-02", 14)],
      WINDOW,
      MONTH,
    );
    expect(cellOn(rows, "2026-09-02")?.all.map((one) => one.eventId)).toEqual([
      "holiday",
      "dentist",
    ]);
  });

  it("gives the full list every event of the day, not only the shown ones", () => {
    const nine = Array.from({ length: 9 }, (_unused, index) =>
      timed(`e${index}`, "2026-09-03", 9 + index),
    );
    const { rows } = placeMonth(nine, WINDOW, MONTH);
    const cell = cellOn(rows, "2026-09-03");

    expect(cell).toMatchObject({ shown: 2, hidden: 7 });
    expect(cell?.all).toHaveLength(9);
  });

  it("cuts a span crossing a week row into one segment per row", () => {
    const { segments } = placeMonth([span("trip", "2026-09-04", "2026-09-08")], WINDOW, MONTH);
    expect(segments).toHaveLength(2);
    expect(segments[0].row).toBe(0);
    expect(segments[1].row).toBe(1);
  });

  it("draws nothing and breaks nothing for an empty month", () => {
    const { rows, segments } = placeMonth([], WINDOW, MONTH);
    expect(segments).toEqual([]);
    expect(rows.flat().every((cell) => cell.timed.length === 0 && cell.hidden === 0)).toBe(true);
  });
});
