import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { BoardOccurrence, Category } from "@/lib/family/types";

import { ProfileColumn } from "../ProfileColumn";
import type { SectionToggles } from "../useSectionToggles";

/**
 * T042 — one column per Profile (FR-301), its header (FR-304, FR-305), its
 * four toggles (FR-306, FR-307, FR-397), its four sections (FR-302) and the
 * empty column that must still render (FR-316).
 *
 * The load-bearing test in this file is the R317 one: the column is handed
 * TWO lists — the whole board's unfiltered occurrences, which is the only
 * thing the counters ever see, and the visible slice it draws. A build that
 * counts the drawn list passes every other test here and fails that one,
 * which is exactly the bug FR-384/FR-386/SC-310 forbid.
 */

const SUNSHINE = PALETTE[1];
const CLEO = "11111111-1111-4111-8111-111111111111";
const TODAY = "2026-09-04";

const ALL_ON: SectionToggles = { morning: true, afternoon: true, evening: true, chores: true };

function profile(overrides: Partial<Category> = {}): Category {
  return {
    id: CLEO,
    householdId: "household-1",
    label: "Cleo",
    color: SUNSHINE,
    isProfile: true,
    avatarKind: null,
    avatarId: null,
    avatarPath: null,
    birthday: null,
    dietaryPrefs: null,
    role: "member",
    userId: null,
    emoji: null,
    showOnTasks: true,
    sortOrder: 1,
    hasPin: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

let sequence = 0;

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  sequence += 1;
  return {
    taskId: `task-${sequence}`,
    assigneeId: CLEO,
    scheduledDate: TODAY,
    slot: null,
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: `Task ${sequence}`,
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
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
    <ProfileColumn
      category={profile()}
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

/** The whole column — one region per Profile (FR-301). */
function column(): HTMLElement {
  return screen.getByRole("region", { name: "Cleo" });
}

/** The header panel, which is where every number and every toggle lives. */
function header(): HTMLElement {
  return screen.getByRole("group", { name: "Cleo" });
}

/** One of FR-302's four sections. */
function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

describe("ProfileColumn", () => {
  it("heads the column with the Profile's name on its own 20 % panel (FR-304)", () => {
    renderColumn({ all: [occurrence()] });

    expect(screen.getByText("Cleo")).toBeInTheDocument();
    expect(column().className).toContain("fam-profile");
    expect(column().style.getPropertyValue("--profile")).toBe(SUNSHINE);
    expect(header().className).toContain("fam-tint-20");
  });

  it("shows a completed-of-total count and a ring around the avatar (FR-305)", () => {
    renderColumn({
      all: [
        occurrence({ state: "complete", creditedCategoryId: CLEO }),
        occurrence(),
        occurrence(),
      ],
    });

    expect(within(header()).getByText("1/3")).toBeInTheDocument();
    const ring = header().querySelector("[data-progress-ring]");
    expect(ring).not.toBeNull();
    expect(Number(ring?.getAttribute("data-fraction"))).toBeCloseTo(1 / 3, 5);
  });

  it("counts the UNFILTERED board, never the list it draws (R317, FR-384, SC-310)", () => {
    const complete = occurrence({ state: "complete", creditedCategoryId: CLEO });
    const outstanding = occurrence();
    const alsoOutstanding = occurrence();

    // The "Completed tasks" filter is off: only the two outstanding ones are
    // drawn, and the count must not move because of it.
    renderColumn({
      all: [complete, outstanding, alsoOutstanding],
      visible: [outstanding, alsoOutstanding],
    });

    expect(within(header()).getByText("1/3")).toBeInTheDocument();
    expect(screen.queryByText(complete.summary)).not.toBeInTheDocument();
  });

  it("drops a skipped occurrence from the denominator, not from the board (FR-360)", () => {
    renderColumn({
      all: [occurrence({ state: "skipped" }), occurrence(), occurrence()],
    });
    expect(within(header()).getByText("0/2")).toBeInTheDocument();
  });

  it("groups occurrences into the four sections by their own slot (FR-302, FR-336)", () => {
    const morning = occurrence({ slot: "morning", routine: true, summary: "Brush teeth" });
    const evening = occurrence({ slot: "evening", routine: true, summary: "Read a book" });
    const chore = occurrence({ summary: "Feed the cat" });
    renderColumn({ all: [morning, evening, chore] });

    // Addressed by the title on the card, because a routine's own name also
    // carries FR-312's progress once the column has computed it.
    expect(within(section("Morning")).getByText("Brush teeth")).toBeInTheDocument();
    expect(within(section("Evening")).getByText("Read a book")).toBeInTheDocument();
    expect(within(section("Chores")).getByText("Feed the cat")).toBeInTheDocument();
  });

  it("hides a section whose toggle is off and keeps the others (FR-306, FR-307)", () => {
    renderColumn({
      all: [
        occurrence({ slot: "morning", routine: true, summary: "Brush teeth" }),
        occurrence({ slot: "evening", routine: true, summary: "Read a book" }),
      ],
      toggles: { ...ALL_ON, evening: false },
    });

    expect(screen.getByText("Brush teeth")).toBeInTheDocument();
    expect(screen.queryByText("Read a book")).not.toBeInTheDocument();
  });

  it("offers four independent toggles at the touch floor (FR-306, FR-307, FR-397)", () => {
    const { onToggleSection } = renderColumn({
      all: [occurrence()],
      toggles: { ...ALL_ON, afternoon: false },
    });

    for (const label of ["Morning", "Afternoon", "Evening", "Chores"]) {
      const toggle = within(header()).getByRole("button", { name: label });
      // The token is itself `max(var(--fam-touch), …)`, so the 44-point floor
      // travels with the token instead of being restated per control.
      expect(toggle.className).toContain("min-h-(--fam-task-toggle-hit)");
      expect(toggle.className).toContain("min-w-(--fam-task-toggle-hit)");
    }
    expect(within(header()).getByRole("button", { name: "Morning" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(header()).getByRole("button", { name: "Afternoon" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(within(header()).getByRole("button", { name: "Evening" }));
    expect(onToggleSection).toHaveBeenCalledWith("evening");
  });

  it("draws the Chores toggle as a full ring whether it is on or off (FR-306)", () => {
    renderColumn({ all: [occurrence()], toggles: { ...ALL_ON, chores: false, evening: false } });

    const chores = within(header()).getByRole("button", { name: "Chores" });
    const evening = within(header()).getByRole("button", { name: "Evening" });
    // Geometry only: Chores never draws the partial arc an off time-of-day
    // toggle draws, but it is still visibly off.
    expect(chores).toHaveAttribute("data-ring", "full");
    expect(chores).toHaveAttribute("aria-pressed", "false");
    expect(evening).toHaveAttribute("data-ring", "partial");
  });

  it("renders a Profile with nothing to do, header and all (FR-316)", () => {
    renderColumn({ all: [] });

    expect(screen.getByText("Cleo")).toBeInTheDocument();
    expect(within(header()).getByText("0/0")).toBeInTheDocument();
    expect(screen.getByText(/nothing/i)).toBeInTheDocument();
    // A ring exists at 0/0 too, or the column reads as broken rather than free.
    expect(header().querySelector("[data-progress-ring]")).not.toBeNull();
  });

  it("gives each routine its own progress for the displayed day, from the unfiltered list (FR-312)", () => {
    const morning = occurrence({
      taskId: "brush",
      slot: "morning",
      routine: true,
      summary: "Brush teeth",
      state: "complete",
      creditedCategoryId: CLEO,
    });
    const evening: BoardOccurrence = { ...morning, slot: "evening", state: "unresolved" };
    // A third occurrence keeps the column count (1/3) different from the
    // routine's own (1/2), so neither number can be read for the other.
    renderColumn({ all: [morning, evening, occurrence()], visible: [evening] });

    expect(within(header()).getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("scrolls inside itself so the page never scrolls sideways (FR-394)", () => {
    renderColumn({ all: [occurrence()] });
    const scroller = column().querySelector("[data-column-body]");
    expect(scroller?.className).toContain("overflow-y-auto");
  });
});
