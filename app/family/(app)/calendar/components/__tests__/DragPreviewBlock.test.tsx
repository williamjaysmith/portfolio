import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MINUTES_PER_DAY, type TimedPlacement } from "@/lib/family/week-geometry";
import type { LayoutMetrics } from "@/lib/family/calendar/layout";
import type { Occurrence } from "@/lib/family/types";

import {
  DragPreviewBlock,
  SETTLE_SECONDS,
  ghostSegmentOf,
  settleTransitionOf,
} from "../DragPreviewBlock";

/**
 * T056 — the snapped in-grid ghost (R205): `EventBlock`'s own rendering at
 * the candidate's slot, hidden from assistive tech (the keyboard path's
 * `aria-live` announces the new slot instead, T058) and untouchable by the
 * pointer, with the settle tween gated on `useReducedMotion()` (FR-252).
 *
 * The geometry is the injected measurement, as everywhere in this layer:
 * 2 px per minute, one title line of 18 px in 16 px of padding.
 */

const METRICS: LayoutMetrics = {
  columnWidth: 200,
  pxPerMinute: 2,
  titleLineHeight: 18,
  blockPaddingY: 16,
};

const PIANO: Occurrence = {
  eventId: "evt-piano",
  occurrenceDate: "2026-09-07",
  isRepeating: true,
  summary: "Piano",
  description: null,
  location: null,
  categoryIds: ["cat-cleo"],
  times: {
    allDay: false,
    startsAt: "2026-09-07T22:00:00.000Z",
    endsAt: "2026-09-07T22:45:00.000Z",
  },
};

/** 09:00–10:00 in column 2 — 60 minutes at 2 px each. */
const CANDIDATE: TimedPlacement = {
  allDay: false,
  columnIndex: 2,
  startMinutes: 540,
  endMinutes: 600,
};

function renderGhost(placement: TimedPlacement = CANDIDATE) {
  return render(
    <DragPreviewBlock
      occurrence={PIANO}
      placement={placement}
      date="2026-09-08"
      fills={["#2178AF"]}
      metrics={METRICS}
      zone="America/Chicago"
      timeFormat="12h"
    />,
  );
}

describe("ghostSegmentOf", () => {
  it("places the ghost from the candidate's minutes and the measured ruler", () => {
    const segment = ghostSegmentOf(PIANO, CANDIDATE, "2026-09-08", METRICS);

    expect(segment.height).toBe(120);
    expect(segment.top).toBe(0);
    expect(segment.startMinutes).toBe(540);
    expect(segment.endMinutes).toBe(600);
    expect(segment.columnIndex).toBe(2);
    expect(segment.date).toBe("2026-09-08");
    // The ghost owns its whole wrapper — the cluster fractions are the
    // layout's business, never the preview's.
    expect(segment.leftFraction).toBe(0);
    expect(segment.widthFraction).toBe(1);
  });

  it("never draws a ghost under the FR-218 minimum block height", () => {
    const short = ghostSegmentOf(
      PIANO,
      { ...CANDIDATE, endMinutes: 545 },
      "2026-09-08",
      METRICS,
    );

    expect(short.height).toBe(44);
  });

  it("opens the edges a candidate that crosses midnight continues through (FR-217)", () => {
    const crosser = ghostSegmentOf(
      PIANO,
      { ...CANDIDATE, startMinutes: 1320, endMinutes: MINUTES_PER_DAY + 60 },
      "2026-09-08",
      METRICS,
    );

    expect(crosser.continuesToNext).toBe(true);
    expect(crosser.continuesFromPrevious).toBe(false);

    const tail = ghostSegmentOf(PIANO, { ...CANDIDATE, startMinutes: -60 }, "2026-09-08", METRICS);
    expect(tail.continuesFromPrevious).toBe(true);
  });
});

describe("settleTransitionOf", () => {
  it("tweens the settle at the drag layer's own duration", () => {
    expect(settleTransitionOf(false)).toEqual({
      type: "tween",
      duration: SETTLE_SECONDS,
      ease: "easeOut",
    });
  });

  it("collapses to no motion at all under a reduced-motion preference (FR-252)", () => {
    expect(settleTransitionOf(true)).toEqual({ duration: 0 });
    // `useReducedMotion()` answers `null` before it has read the preference.
    expect(settleTransitionOf(null)).toEqual({
      type: "tween",
      duration: SETTLE_SECONDS,
      ease: "easeOut",
    });
  });
});

describe("DragPreviewBlock", () => {
  it("renders the dragged event's own block at the candidate slot", () => {
    renderGhost();

    const block = screen.getByRole("button", { hidden: true });
    expect(block).toHaveTextContent("Piano");
    expect(block.style.height).toBe("120px");
    expect(block.style.backgroundColor).not.toBe("");
  });

  it("hides the ghost from assistive tech and from the pointer", () => {
    const { container } = renderGhost();

    const ghost = container.querySelector('[aria-hidden="true"]');
    expect(ghost).not.toBeNull();
    expect(ghost?.className).toContain("pointer-events-none");
    // Inert: the copy must never become a second tab stop for the same event.
    expect(ghost?.hasAttribute("inert")).toBe(true);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
