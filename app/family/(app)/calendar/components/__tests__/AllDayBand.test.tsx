import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AllDayLayout } from "@/lib/family/calendar/layout";
import { PALETTE } from "@/lib/family/colors";
import type { Occurrence } from "@/lib/family/types";

import { AllDayBand } from "../AllDayBand";

/**
 * T050 — an all-day bar is a control like a block: a focusable button whose
 * press opens the occurrence's details (FR-256/263), reporting which
 * occurrence was tapped and never editing directly (FR-257).
 */

const camping: Occurrence = {
  eventId: "event-camping",
  occurrenceDate: "2026-09-18",
  isRepeating: false,
  summary: "Camping trip",
  description: null,
  location: null,
  categoryIds: ["ana"],
  times: { allDay: true, startDate: "2026-09-18", endDate: "2026-09-20" },
};

const layout: AllDayLayout = {
  bars: [
    {
      occurrence: camping,
      lane: 0,
      startColumn: 5,
      endColumn: 6,
      clippedStart: false,
      clippedEnd: true,
    },
  ],
  laneCount: 1,
};

const COLUMN_DATES = [
  "2026-09-13",
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
];

describe("AllDayBand", () => {
  it("draws each bar as a focusable button that opens its occurrence's details", () => {
    const onOpen = vi.fn();
    render(
      <AllDayBand
        columnDates={COLUMN_DATES}
        layout={layout}
        colorsById={{ ana: PALETTE[13] }}
        todayDate={null}
        onOpen={onOpen}
      />,
    );

    const bar = screen.getByRole("button", { name: "Camping trip" });
    expect(bar).toHaveAttribute("type", "button");
    bar.focus();
    expect(bar).toHaveFocus();

    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(camping);
  });

  it("stays inert without an opener, as on a read-only render", () => {
    render(
      <AllDayBand
        columnDates={COLUMN_DATES}
        layout={layout}
        colorsById={{ ana: PALETTE[13] }}
        todayDate={null}
      />,
    );

    expect(() => fireEvent.click(screen.getByRole("button", { name: "Camping trip" }))).not.toThrow();
  });
});
