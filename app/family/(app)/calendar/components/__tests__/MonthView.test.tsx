import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { viewWindowOf } from "@/lib/family/calendar/dates";
import type { Occurrence } from "@/lib/family/types";

import { MonthCell } from "../MonthCell";
import { MonthView } from "../MonthView";
import { placeMonth } from "../useMonthOccurrences";

/**
 * 011 FR-1109–FR-1113 — the month grid and its cells.
 *
 * No image of the reference's Month view exists anywhere in the corpus
 * (R1101), so what these cases pin is the documented BEHAVIOUR: the capacity
 * and its step down, the overflow control, the spanning bar being one bar per
 * week row rather than a chip per day, and a cell being a door to its day.
 */

const CHICAGO = "America/Chicago";
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

function renderMonth(occurrences: Occurrence[], startWeekOn: 0 | 1 = 0) {
  const placed = placeMonth(occurrences, WINDOW, MONTH);
  const onOpenDay = vi.fn();
  const onOpenList = vi.fn();
  const onOpen = vi.fn();
  const view = render(
    <MonthView
      rows={placed.rows}
      segments={placed.segments}
      startDate={WINDOW.startDate}
      todayDate="2026-09-15"
      startWeekOn={startWeekOn}
      zone={CHICAGO}
      timeFormat="12h"
      colorsById={{}}
      onOpenDay={onOpenDay}
      onOpenList={onOpenList}
      onOpen={onOpen}
    />,
  );
  return { onOpenDay, onOpenList, onOpen, container: view.container };
}

describe("MonthView", () => {
  it("draws the month as a grid of week rows", () => {
    renderMonth([]);
    expect(screen.getByRole("group", { name: "Month" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-month-cell]")).toHaveLength(42);
  });

  it("heads the columns with the household's own first day", () => {
    const { container } = renderMonth([], 0);
    const headings = [...container.querySelectorAll('[aria-hidden="true"] > div')];
    expect(headings[0]).toHaveTextContent("Sun");
  });

  it("rotates the headings for a Monday-start household", () => {
    const { container } = renderMonth([], 1);
    const headings = [...container.querySelectorAll('[aria-hidden="true"] > div')].map(
      (one) => one.textContent,
    );
    expect(headings[0]).toBe("Mon");
    expect(headings[6]).toBe("Sun");
  });

  it("marks today", () => {
    renderMonth([]);
    expect(document.querySelectorAll('[data-month-cell][aria-current="date"]')).toHaveLength(1);
  });

  it("does NOT claim to be an ARIA grid — it implements no arrow-key navigation", () => {
    renderMonth([]);
    // Claiming role="grid" promises two-dimensional keyboard navigation this
    // view does not have, and an earlier draft that did also produced an
    // invalid structure. Every cell's own control carries its full date.
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.getByRole("group", { name: "Month" })).toBeInTheDocument();
  });

  it("draws a multi-day event as ONE bar per week row, never a chip per day", () => {
    // Fri 2026-09-04 → Tue 2026-09-08 crosses one row break: two bars, not five.
    const { onOpenDay } = renderMonth([span("Holiday", "2026-09-04", "2026-09-08")]);
    const bars = screen.getAllByRole("button", { name: /Holiday/ });
    expect(bars).toHaveLength(2);

    // The continued one says so, so the second week is readable on its own.
    expect(bars[1]).toHaveTextContent("←");

    fireEvent.click(bars[0]);
    expect(onOpenDay).toHaveBeenCalledWith("2026-09-04");
  });

  it("opens the day when a date is chosen (FR-1113)", () => {
    const { onOpenDay } = renderMonth([]);
    fireEvent.click(screen.getByRole("button", { name: "Open 2026-09-15" }));
    expect(onOpenDay).toHaveBeenCalledWith("2026-09-15");
  });
});

describe("MonthCell", () => {
  function cellFor(occurrences: Occurrence[], date: string) {
    const placed = placeMonth(occurrences, WINDOW, MONTH);
    const cell = placed.rows.flat().find((one) => one.date === date);
    if (cell === undefined) throw new Error("no such cell");
    const onOpenDay = vi.fn();
    const onOpenList = vi.fn();
    const onOpen = vi.fn();
    render(
      <MonthCell
        cell={cell}
        isToday={false}
        zone={CHICAGO}
        timeFormat="12h"
        colorsById={{}}
        onOpenDay={onOpenDay}
        onOpenList={onOpenList}
        onOpen={onOpen}
      />,
    );
    return { onOpenDay, onOpenList, onOpen };
  }

  it("shows all three when there are three, and no overflow control", () => {
    cellFor([14, 15, 16].map((hour) => timed(`e${hour}`, "2026-09-03", hour)), "2026-09-03");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("shows TWO and a count when there are four (FR-1110)", () => {
    cellFor([14, 15, 16, 17].map((hour) => timed(`e${hour}`, "2026-09-03", hour)), "2026-09-03");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("counts accurately when there are many", () => {
    const nine = Array.from({ length: 9 }, (_unused, index) =>
      timed(`e${index}`, "2026-09-03", 9 + index),
    );
    cellFor(nine, "2026-09-03");
    expect(screen.getByText("+7 more")).toBeInTheDocument();
  });

  it("opens the day's full list from the overflow control (FR-1111)", () => {
    const { onOpenList } = cellFor(
      [14, 15, 16, 17].map((hour) => timed(`e${hour}`, "2026-09-03", hour)),
      "2026-09-03",
    );
    fireEvent.click(screen.getByRole("button", { name: "2 more on 2026-09-03" }));
    expect(onOpenList).toHaveBeenCalledWith("2026-09-03");
  });

  it("opens an event's own details when its chip is chosen", () => {
    const { onOpen } = cellFor([timed("Dentist", "2026-09-03", 14)], "2026-09-03");
    fireEvent.click(within(screen.getByRole("listitem")).getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("sets a neighbouring month's day back by its BACKGROUND, not by dimming its text", () => {
    // `opacity` on the whole cell pushed event titles below the contrast floor
    // — a real accessibility failure the browser pass caught.
    cellFor([], "2026-08-31");
    const cell = document.querySelector("[data-month-cell]");
    expect(cell?.className).not.toContain("opacity-50");
    expect(cell?.className).toContain("bg-(--fam-pill-btn-bg)/40");
  });
});
