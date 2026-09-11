import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CountdownStatus } from "@/lib/family/countdowns/target";

import { CountdownChips } from "../CountdownChips";
import { PreviewBar } from "../PreviewBar";

/**
 * 009 T024 — the bar's own two promises (FR-902, FR-907, FR-910, SC-906).
 *
 * The one that is easy to break is the second: an empty bar must take NO
 * vertical space, and a caller that always passes a JSX element would give it
 * a permanent empty row, because an element is truthy whatever it renders.
 * That is asserted here rather than left to the caller's discipline.
 */

function statusAt(days: number, summary: string): CountdownStatus {
  return {
    eventId: `event-${summary}`,
    summary,
    targetDate: "2026-09-20",
    days,
    state: days > 0 ? "upcoming" : days === 0 ? "today" : "past",
  };
}

describe("PreviewBar", () => {
  it("draws no row at all when it has nothing to say (FR-910, SC-906)", () => {
    const { container } = render(<PreviewBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("draws no row when handed something that renders nothing", () => {
    // The trap: `<CountdownChips shown={[]} .../>` is a truthy element that
    // renders null. The caller must pass `undefined`, and this is the test
    // that says so out loud.
    const { container } = render(<PreviewBar countdowns={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * 014: the bar used to carry Tasks Progress alongside the countdowns, and
   * this test asserted the two shared ONE row. The counts moved to the shell's
   * profile chips, so what is left to assert is that the countdowns get a
   * named row of their own.
   */
  it("draws one named row for the countdowns", () => {
    render(<PreviewBar countdowns={<CountdownChips countdowns={[statusAt(13, "Vacation")]} slots={3} />} />);

    const bar = screen.getByRole("group", { name: "Calendar preview" });
    expect(bar).toContainElement(screen.getByText("Vacation · 13 days"));
  });
});

describe("CountdownChips", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<CountdownChips countdowns={[]} slots={3} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names each countdown and how far away it is", () => {
    render(
      <CountdownChips
        countdowns={[statusAt(13, "Vacation"), statusAt(1, "Dentist"), statusAt(0, "Birthday")]}
        slots={3}
      />,
    );

    expect(screen.getByText("Vacation · 13 days")).toBeInTheDocument();
    expect(screen.getByText("Dentist · 1 day")).toBeInTheDocument();
    expect(screen.getByText("Birthday · Today")).toBeInTheDocument();
  });

  it("is a plain group, not a button, while there is no list to open", () => {
    render(<CountdownChips countdowns={[statusAt(13, "Vacation")]} slots={3} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("group", { name: "Countdowns — 1 countdown" })).toBeInTheDocument();
  });

  it("becomes one tap target opening the whole list (FR-909)", () => {
    const onOpenList = vi.fn();
    render(
      <CountdownChips
        countdowns={[statusAt(13, "Vacation"), statusAt(1, "Dentist")]}
        slots={3}
        onOpenList={onOpenList}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Countdowns — 2 countdowns" }));
    expect(onOpenList).toHaveBeenCalledTimes(1);
  });

  it("announces how many there are, not how many fit — the label must not rotate", () => {
    render(
      <CountdownChips
        countdowns={[statusAt(1, "A"), statusAt(2, "B"), statusAt(3, "C"), statusAt(4, "D")]}
        slots={1}
      />,
    );
    expect(screen.getByRole("group", { name: "Countdowns — 4 countdowns" })).toBeInTheDocument();
    // Only one holds a position, but the label counts them all.
    expect(screen.getAllByText(/·/)).toHaveLength(1);
  });

  it("carries no automatic emoji (009 R914, divergence 4)", () => {
    const { container } = render(<CountdownChips countdowns={[statusAt(13, "Vacation")]} slots={3} />);
    expect(container.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
