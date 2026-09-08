import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

  it("draws one row carrying both halves, never two rows", () => {
    render(
      <PreviewBar
        progress={<span>Ana 2/5</span>}
        countdowns={<CountdownChips shown={[statusAt(13, "Vacation")]} total={1} />}
      />,
    );

    const bar = screen.getByRole("group", { name: "Calendar preview" });
    expect(bar).toContainElement(screen.getByText("Ana 2/5"));
    expect(bar).toContainElement(screen.getByText("Vacation · 13 days"));
  });
});

describe("CountdownChips", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<CountdownChips shown={[]} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names each countdown and how far away it is", () => {
    render(
      <CountdownChips
        shown={[statusAt(13, "Vacation"), statusAt(1, "Dentist"), statusAt(0, "Birthday")]}
        total={3}
      />,
    );

    expect(screen.getByText("Vacation · 13 days")).toBeInTheDocument();
    expect(screen.getByText("Dentist · 1 day")).toBeInTheDocument();
    expect(screen.getByText("Birthday · Today")).toBeInTheDocument();
  });

  it("is a plain group, not a button, while there is no list to open", () => {
    render(<CountdownChips shown={[statusAt(13, "Vacation")]} total={1} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("group", { name: "Countdowns — 1 countdown" })).toBeInTheDocument();
  });

  it("carries no automatic emoji (009 R914, divergence 4)", () => {
    const { container } = render(<CountdownChips shown={[statusAt(13, "Vacation")]} total={1} />);
    expect(container.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
