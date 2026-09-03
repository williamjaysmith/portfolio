import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OverflowGroup } from "@/lib/family/calendar/layout";
import type { Occurrence } from "@/lib/family/types";

import { MoreOverflow } from "../MoreOverflow";

/**
 * T031 — FR-285's "+n more": the events layout could not draw abreast are
 * never unreachable. The control announces its count, and a tap lists every
 * collapsed event by title and true time.
 */

const ZONE = "America/Chicago";

function makeOccurrence(overrides: Partial<Occurrence>): Occurrence {
  return {
    eventId: "event-a",
    occurrenceDate: "2026-09-04",
    isRepeating: false,
    summary: "Standup",
    description: null,
    location: null,
    categoryIds: [],
    // 9:00 – 10:00 AM in America/Chicago (CDT, UTC-5).
    times: {
      allDay: false,
      startsAt: "2026-09-04T14:00:00.000Z",
      endsAt: "2026-09-04T15:00:00.000Z",
    },
    ...overrides,
  };
}

const group: OverflowGroup = {
  columnIndex: 0,
  date: "2026-09-04",
  top: 1755,
  height: 195,
  startMinutes: 540,
  endMinutes: 600,
  hiddenCount: 2,
  occurrences: [
    makeOccurrence({ eventId: "event-a", summary: "Standup" }),
    makeOccurrence({ eventId: "event-b", summary: "Vet Call" }),
  ],
};

function renderGroup() {
  return render(<MoreOverflow group={group} zone={ZONE} timeFormat="12h" />);
}

describe("MoreOverflow", () => {
  it("renders a tappable '+n more' control, collapsed by default (FR-285)", () => {
    renderGroup();

    const control = screen.getByRole("button", { name: "+2 more" });
    expect(control).toHaveAttribute("type", "button");
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Standup")).not.toBeInTheDocument();
  });

  it("lists every collapsed event by title and true time when tapped", () => {
    renderGroup();

    fireEvent.click(screen.getByRole("button", { name: "+2 more" }));

    expect(screen.getByRole("button", { name: "+2 more" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // Each listed row is itself a focusable control (FR-263); its press is
    // inert until T047 wires the details surface.
    const standup = screen.getByRole("button", { name: /Standup/ });
    expect(standup).toHaveTextContent("9:00 AM – 10:00 AM");
    expect(screen.getByRole("button", { name: /Vet Call/ })).toBeInTheDocument();
  });

  it("collapses again on a second tap", () => {
    renderGroup();

    const control = screen.getByRole("button", { name: "+2 more" });
    fireEvent.click(control);
    fireEvent.click(control);

    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Vet Call")).not.toBeInTheDocument();
  });
});
