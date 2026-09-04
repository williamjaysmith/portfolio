import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TimedSegment } from "@/lib/family/calendar/layout";
import { INK_DARK, INK_LIGHT, PALETTE } from "@/lib/family/colors";
import type { Occurrence } from "@/lib/family/types";

import { EventBlock } from "../EventBlock";

/**
 * T031 — the three renderings of FR-211/212/213 with FR-214's ink, plus the
 * FR-217 midnight pair. The block is presentational: layout.ts already decided
 * its rectangle, colors.ts already knows its ink — these tests pin that the
 * component obeys both and invents nothing.
 */

const ZONE = "America/Chicago";
const BLUE = PALETTE[13]; // #2178AF — dark fill, white ink (FR-214)
const SPROUT = PALETTE[16]; // #B6E085 — pale fill, dark ink

function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    eventId: "event-1",
    occurrenceDate: "2026-09-04",
    isRepeating: false,
    summary: "Grocery Run",
    description: null,
    location: null,
    categoryIds: [],
    // 9:30 – 10:15 AM in America/Chicago (CDT, UTC-5).
    times: {
      allDay: false,
      startsAt: "2026-09-04T14:30:00.000Z",
      endsAt: "2026-09-04T15:15:00.000Z",
    },
    ...overrides,
  };
}

function makeSegment(
  occurrence: Occurrence,
  overrides: Partial<TimedSegment> = {},
): TimedSegment {
  return {
    occurrence,
    columnIndex: 0,
    date: "2026-09-04",
    startMinutes: 570,
    endMinutes: 615,
    continuesFromPrevious: false,
    continuesToNext: false,
    top: 1852.5,
    height: 146.25,
    leftFraction: 0,
    widthFraction: 1,
    ...overrides,
  };
}

function renderBlock(
  occurrence: Occurrence,
  fills: readonly (typeof PALETTE)[number][],
  overrides: Partial<TimedSegment> = {},
  dimmed = false,
) {
  return render(
    <EventBlock
      segment={makeSegment(occurrence, overrides)}
      fills={fills}
      dimmed={dimmed}
      zone={ZONE}
      timeFormat="12h"
    />,
  );
}

describe("EventBlock", () => {
  it("renders a single-category event as one solid block inked against its fill (FR-211/214)", () => {
    renderBlock(makeOccurrence(), [BLUE]);

    const block = screen.getByRole("button", { name: /Grocery Run/ });
    expect(block).toHaveAttribute("data-variant", "single");
    expect(block).toHaveStyle({ backgroundColor: BLUE, color: INK_LIGHT });
    expect(block).toHaveTextContent("9:30 AM – 10:15 AM");
    // The rectangle is layout's, verbatim (FR-204/218).
    expect(block).toHaveStyle({ top: "1852.5px", height: "146.25px" });
  });

  it("renders a multi-category event striped with the title on the leftmost solid segment (FR-212)", () => {
    renderBlock(makeOccurrence({ summary: "Cousins Visit" }), [BLUE, SPROUT]);

    const block = screen.getByRole("button", { name: /Cousins Visit/ });
    expect(block).toHaveAttribute("data-variant", "striped");
    // The title sits on a solid run of the FIRST colour, and the ink is
    // chosen against that same colour (FR-214) — white on Blue.
    const title = screen.getByText("Cousins Visit");
    expect(title).toHaveStyle({ backgroundColor: BLUE });
    expect(block).toHaveStyle({ color: INK_LIGHT });
  });

  it("renders a no-category event neutrally — light fill, thin border, dark ink (FR-213)", () => {
    renderBlock(makeOccurrence({ summary: "Dentist" }), []);

    const block = screen.getByRole("button", { name: /Dentist/ });
    expect(block).toHaveAttribute("data-variant", "neutral");
    expect(block.className).toContain("bg-(--fam-event-neutral-fill)");
    expect(block.className).toContain("border-(--fam-event-neutral-border)");
    expect(block).toHaveStyle({ color: INK_DARK });
  });

  it("labels every midnight segment with the one event's true full range (FR-217)", () => {
    // Fri 22:00 → Sat 01:00 in America/Chicago (CDT, UTC-5).
    const crosser = makeOccurrence({
      summary: "Late Train",
      times: {
        allDay: false,
        startsAt: "2026-09-05T03:00:00.000Z",
        endsAt: "2026-09-05T06:00:00.000Z",
      },
    });
    render(
      <>
        <EventBlock
          segment={makeSegment(crosser, {
            date: "2026-09-04",
            startMinutes: 1320,
            endMinutes: 1440,
            continuesToNext: true,
          })}
          fills={[BLUE]}
          dimmed={false}
          zone={ZONE}
          timeFormat="12h"
        />
        <EventBlock
          segment={makeSegment(crosser, {
            columnIndex: 1,
            date: "2026-09-05",
            startMinutes: 0,
            endMinutes: 60,
            continuesFromPrevious: true,
            top: 0,
          })}
          fills={[BLUE]}
          dimmed={false}
          zone={ZONE}
          timeFormat="12h"
        />
      </>,
    );

    // Both segments present the SAME event: same title, same true times —
    // never a per-column clip like "12:00 AM – 1:00 AM".
    const segments = screen.getAllByRole("button", { name: /Late Train/ });
    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      expect(segment).toHaveTextContent("10:00 PM – 1:00 AM");
    }
  });

  it("is a focusable button that dims via the token when past (FR-215/263)", () => {
    renderBlock(makeOccurrence(), [SPROUT], {}, true);

    const block = screen.getByRole("button", { name: /Grocery Run/ });
    expect(block).toHaveAttribute("type", "button");
    expect(block.className).toContain("opacity-(--fam-past-dim)");
    block.focus();
    expect(block).toHaveFocus();
    // Read-only render: no opener, so a press does nothing at all.
    expect(() => fireEvent.click(block)).not.toThrow();
  });

  it("reports its occurrence on press so the details surface can open (FR-256/257)", () => {
    const occurrence = makeOccurrence();
    const onOpen = vi.fn();
    render(
      <EventBlock
        segment={makeSegment(occurrence)}
        fills={[BLUE]}
        dimmed={false}
        zone={ZONE}
        timeFormat="12h"
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Grocery Run/ }));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(occurrence);
  });
});
