import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { BoardOccurrence } from "@/lib/family/types";

import { SECTION_LABELS, SECTION_ORDER, SectionGroup } from "../SectionGroup";

/**
 * T042 — FR-302's section, on its own.
 *
 * The split is `sectionsOf`'s and the order inside Chores is FR-311's, both
 * already proved in `tasks-layout.test.ts`; what is asserted here is that the
 * renderer keeps the order it is handed and invents no grouping of its own.
 */

const SUNSHINE = PALETTE[1];
const TODAY = "2026-09-04";

let sequence = 0;

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  sequence += 1;
  return {
    taskId: `task-${sequence}`,
    assigneeId: "cleo",
    scheduledDate: TODAY,
    slot: "morning",
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: `Task ${sequence}`,
    description: null,
    emoji: null,
    routine: true,
    upForGrabs: false,
    trackHabit: false,
    dueTime: null,
    dueAt: null,
    isRepeating: true,
    taskCreatedAt: "2026-08-01T12:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
    ...overrides,
  };
}

function renderGroup(occurrences: readonly BoardOccurrence[]) {
  const onOpen = vi.fn();
  const onResolve = vi.fn();
  render(
    <SectionGroup
      section="morning"
      occurrences={occurrences}
      accent={SUNSHINE}
      onOpen={onOpen}
      onResolve={onResolve}
    />,
  );
  return { onOpen, onResolve };
}

describe("SECTION_ORDER / SECTION_LABELS", () => {
  it("names FR-302's four sections in the order a column draws them", () => {
    expect(SECTION_ORDER).toEqual(["morning", "afternoon", "evening", "chores"]);
    expect(SECTION_ORDER.map((section) => SECTION_LABELS[section])).toEqual([
      "Morning",
      "Afternoon",
      "Evening",
      "Chores",
    ]);
  });
});

describe("SectionGroup", () => {
  it("heads the section and draws one card per occurrence, in the order given (FR-302)", () => {
    const first = occurrence({ summary: "Brush teeth" });
    const second = occurrence({ summary: "Get dressed" });
    renderGroup([first, second]);

    const group = screen.getByRole("region", { name: "Morning" });
    expect(within(group).getByRole("heading", { name: "Morning" })).toBeInTheDocument();
    const titles = within(group)
      .getAllByRole("listitem")
      .map((card) => card.textContent);
    expect(titles).toEqual(["Brush teeth", "Get dressed"]);
  });

  it("draws nothing at all when the section is empty", () => {
    renderGroup([]);
    expect(screen.queryByRole("region", { name: "Morning" })).not.toBeInTheDocument();
  });

  it("marks exactly the occurrence whose write is in flight as busy (FR-393)", () => {
    const busy = occurrence({ taskId: "busy-one", summary: "Brush teeth" });
    const idle = occurrence({ taskId: "idle-one", summary: "Get dressed" });
    const onOpen = vi.fn();
    const onResolve = vi.fn();
    render(
      <SectionGroup
        section="morning"
        occurrences={[busy, idle]}
        accent={SUNSHINE}
        // The key is the occurrence's own five-column identity (FR-353), so a
        // routine's other slot on the same day is NOT the one in flight.
        busyKey={`busy-one|cleo|${TODAY}|morning|`}
        onOpen={onOpen}
        onResolve={onResolve}
      />,
    );

    expect(screen.getByRole("button", { name: "Complete Brush teeth" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Complete Get dressed" })).not.toHaveAttribute(
      "aria-busy",
    );
  });
});
