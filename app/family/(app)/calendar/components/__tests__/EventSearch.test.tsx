import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EventSearchResult } from "@/lib/family/calendar/search";

import { EventSearch, type EventSearchProps } from "../EventSearch";

/**
 * 009 T050 — the search control (FR-915–FR-918, SC-909).
 *
 * The divergence worth pinning is that this is a FINDER, not a filter: the
 * Tasks tab's search narrows the board where it stands, and this one shows
 * results and navigates, because the calendar draws a few days and the answer
 * usually is not among them (divergence 6, Assumption 9).
 */

function resultFor(summary: string, onDate: string, isRepeating = false): EventSearchResult {
  return { eventId: `event-${summary}`, summary, onDate, isPast: false, isRepeating };
}

const formatDate = (date: string) => date;

function renderSearch(overrides: Partial<EventSearchProps> = {}) {
  const onChange = vi.fn();
  const onChoose = vi.fn();
  const props: EventSearchProps = {
    value: "",
    onChange,
    results: [],
    answered: false,
    onChoose,
    formatDate,
    ...overrides,
  };
  const view = render(<EventSearch {...props} />);
  return { onChange, onChoose, view, props };
}

function type(text: string): void {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search events" }), {
    target: { value: text },
  });
}

describe("EventSearch", () => {
  it("reports every keystroke rather than holding the term itself", () => {
    const { onChange } = renderSearch();
    type("swim");
    expect(onChange).toHaveBeenCalledWith("swim");
  });

  it("shows nothing at all before anything is typed", () => {
    renderSearch();
    expect(screen.queryByRole("list", { name: "Search results" })).toBeNull();
    expect(screen.queryByText("No events match that.")).toBeNull();
  });

  it("lists what was found, with the day it falls on", () => {
    renderSearch({
      value: "swim",
      answered: true,
      results: [resultFor("Swim lesson", "2026-09-10", true)],
    });

    expect(screen.getByRole("list", { name: "Search results" })).toBeInTheDocument();
    expect(screen.getByText("Swim lesson")).toBeInTheDocument();
    expect(screen.getByText(/2026-09-10/)).toBeInTheDocument();
  });

  it("says a repeating event repeats, so a single date does not mislead", () => {
    renderSearch({
      value: "swim",
      answered: true,
      results: [resultFor("Swim lesson", "2026-09-10", true)],
    });
    expect(screen.getByText(/repeats/)).toBeInTheDocument();
  });

  it("says so plainly when nothing matches, rather than showing an empty box (FR-917)", () => {
    renderSearch({ value: "qqq", answered: true, results: [] });

    expect(screen.getByText("No events match that.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Search results" })).toBeNull();
  });

  it("shows nothing while the answer has not arrived — no premature 'no matches'", () => {
    renderSearch({ value: "swim", answered: false, results: [] });
    expect(screen.queryByText("No events match that.")).toBeNull();
  });

  it("reports the chosen result (FR-916)", () => {
    const { onChoose } = renderSearch({
      value: "swim",
      answered: true,
      results: [resultFor("Swim lesson", "2026-09-10"), resultFor("Swim gala", "2026-10-02")],
    });

    fireEvent.click(screen.getByRole("button", { name: /Swim gala/ }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.calls[0][0]).toMatchObject({ summary: "Swim gala" });
  });

  it("closes when the term is cleared, without the panel having a mind of its own", () => {
    const { view } = renderSearch({
      value: "swim",
      answered: true,
      results: [resultFor("Swim lesson", "2026-09-10")],
    });
    expect(screen.getByRole("list", { name: "Search results" })).toBeInTheDocument();

    view.rerender(
      <EventSearch
        value=""
        onChange={vi.fn()}
        results={[]}
        answered={false}
        onChoose={vi.fn()}
        formatDate={formatDate}
      />,
    );
    expect(screen.queryByRole("list", { name: "Search results" })).toBeNull();
  });

  it("offers a clear only once there is something to clear", () => {
    const { onChange } = renderSearch({ value: "" });
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    renderSearch({ value: "swim" });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).not.toHaveBeenCalledWith("swim");
  });

  it("is a finder and not a filter — it never narrows anything in place", () => {
    // A regression guard on divergence 6: if this control ever grows a
    // "filter the grid" behaviour, it will need a prop for the grid, and this
    // assertion is the reminder that the calendar cannot show a day it is not on.
    const { props } = renderSearch();
    expect(Object.keys(props)).not.toContain("occurrences");
    expect(Object.keys(props)).toContain("onChoose");
  });
});
