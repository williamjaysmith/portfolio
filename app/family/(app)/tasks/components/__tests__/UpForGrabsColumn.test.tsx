import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BoardOccurrence } from "@/lib/family/types";

import {
  UP_FOR_GRABS_COLUMN_ID,
  UP_FOR_GRABS_TITLE,
  UpForGrabsColumn,
} from "../UpForGrabsColumn";
import type { SectionToggles } from "../useSectionToggles";

/**
 * T043 — the left-most column that belongs to nobody (FR-308, Assumption 16).
 *
 * Everything asserted here is an ABSENCE as much as a presence: no avatar, no
 * progress ring and no profile tint, because there is no Profile to draw them
 * from. A build that reuses `ProfileColumn` with a placeholder Profile passes
 * the count test and fails these.
 */

const TODAY = "2026-09-04";
const ALL_ON: SectionToggles = { morning: true, afternoon: true, evening: true, chores: true };

let sequence = 0;

function unclaimed(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  sequence += 1;
  return {
    rewardPoints: null,
    taskId: `grab-${sequence}`,
    assigneeId: null,
    scheduledDate: TODAY,
    slot: null,
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: `Chore ${sequence}`,
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: true,
    trackHabit: false,
    dueTime: null,
    dueAt: null,
    isRepeating: false,
    taskCreatedAt: `2026-08-0${(sequence % 9) + 1}T12:00:00.000Z`,
    state: "unresolved",
    creditedCategoryId: null,
    ...overrides,
  };
}

function renderColumn(options: {
  all: readonly BoardOccurrence[];
  visible?: readonly BoardOccurrence[];
  toggles?: SectionToggles;
}) {
  const onToggleSection = vi.fn();
  const onOpen = vi.fn();
  const onResolve = vi.fn();
  render(
    <UpForGrabsColumn
      allOccurrences={options.all}
      occurrences={options.visible ?? options.all}
      toggles={options.toggles ?? ALL_ON}
      onToggleSection={onToggleSection}
      onOpen={onOpen}
      onResolve={onResolve}
    />,
  );
  return { onToggleSection, onOpen, onResolve };
}

function header(): HTMLElement {
  return screen.getByRole("group", { name: UP_FOR_GRABS_TITLE });
}

describe("UpForGrabsColumn", () => {
  it("exposes a stable column key for the per-column section toggles", () => {
    expect(UP_FOR_GRABS_COLUMN_ID).toBe("up-for-grabs");
    expect(UP_FOR_GRABS_TITLE).toBe("Up for Grabs");
  });

  it("heads itself with its own name and a count of unclaimed occurrences (FR-308)", () => {
    renderColumn({
      all: [unclaimed(), unclaimed(), unclaimed({ state: "complete", creditedCategoryId: "cleo" })],
    });

    expect(screen.getByText(UP_FOR_GRABS_TITLE)).toBeInTheDocument();
    // A claim IS a resolution, so the claimed one has already left this count.
    expect(within(header()).getByText("2")).toBeInTheDocument();
  });

  it("counts the UNFILTERED board, never the list it draws (R317, FR-384)", () => {
    const one = unclaimed();
    const two = unclaimed();
    renderColumn({ all: [one, two], visible: [one] });

    expect(within(header()).getByText("2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: two.summary })).not.toBeInTheDocument();
  });

  it("carries no avatar, no progress ring and no profile accent (FR-308, Assumption 16)", () => {
    renderColumn({ all: [unclaimed()] });

    const region = screen.getByRole("region", { name: UP_FOR_GRABS_TITLE });
    expect(region.querySelector("[data-progress-ring]")).toBeNull();
    expect(region.className).not.toContain("fam-profile");
    expect(header().className).not.toContain("fam-tint-20");
    expect(region.style.getPropertyValue("--profile")).toBe("");
  });

  it("draws its cards neutrally, outside the profile tint ladder (FR-308)", () => {
    const one = unclaimed({ summary: "Empty the dishwasher" });
    renderColumn({ all: [one] });

    const card = screen.getByRole("button", { name: "Empty the dishwasher" }).closest(
      "[data-task-card]",
    );
    expect(card).toHaveAttribute("data-variant", "neutral");
    expect(card?.className).not.toContain("fam-tint-40");
  });

  it("keeps a completion circle on every card — the claim is the server's answer (FR-350)", () => {
    renderColumn({ all: [unclaimed({ summary: "Empty the dishwasher" })] });
    expect(
      screen.getByRole("button", { name: "Complete Empty the dishwasher" }),
    ).toBeInTheDocument();
  });

  it("renders an empty state when nothing is going spare", () => {
    renderColumn({ all: [] });

    expect(within(header()).getByText("0")).toBeInTheDocument();
    expect(screen.getByText(/nothing/i)).toBeInTheDocument();
  });
});
