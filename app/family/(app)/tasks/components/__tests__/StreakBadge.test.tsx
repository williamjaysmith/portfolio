import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { BoardOccurrence, Task, TaskAssignee } from "@/lib/family/types";

import { TaskCard } from "../TaskCard";
import { TaskStreaksProvider } from "../StreakBadge";

/**
 * T070 — FR-371/FR-372's habit streak, at its render site.
 *
 * The badge is tested THROUGH `TaskCard` on purpose: the whole of this task is
 * the badge plus the one place it is drawn, and the rule that matters most —
 * "never derived on the client" — is only observable as the card reading the
 * number the task rows carried and nothing else. Every case below moves the
 * stored `streak_count` and asserts what the card draws; none of them moves a
 * resolution, because no arrangement of resolutions may change this number.
 *
 * The streak RULE (what advances, holds and breaks a count) is
 * `tasks-streaks.test.ts`'s `nextStreak` table and SC-312's thirty days; it is
 * the resolve action that applies it. Nothing here re-implements a day of it.
 */

const HOUSEHOLD = "household-1";
const TODAY = "2026-09-04";
const CLEO = "cleo";
const ROUTINE = "task-brush";
const SUNSHINE = PALETTE[1];

function assigneeOf(overrides: Partial<TaskAssignee> = {}): TaskAssignee {
  return {
    taskId: ROUTINE,
    householdId: HOUSEHOLD,
    categoryId: CLEO,
    sortOrder: 1000,
    streakCount: 11,
    streakThrough: TODAY,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function taskOf(overrides: Partial<Task> = {}): Task {
  return {
    id: ROUTINE,
    householdId: HOUSEHOLD,
    summary: "Brush teeth",
    description: null,
    emoji: null,
    routine: true,
    upForGrabs: false,
    trackHabit: true,
    startsOn: "2026-08-01",
    dueTime: null,
    timesOfDay: ["morning"],
    rrule: "FREQ=DAILY;INTERVAL=1",
    renewAfterAmount: null,
    renewAfterUnit: null,
    renewUntil: null,
    rewardPoints: null,
    assignees: [assigneeOf()],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function occurrenceOf(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    rewardPoints: null,
    taskId: ROUTINE,
    assigneeId: CLEO,
    scheduledDate: TODAY,
    slot: "morning",
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: "Brush teeth",
    description: null,
    emoji: null,
    routine: true,
    upForGrabs: false,
    trackHabit: true,
    dueTime: null,
    dueAt: null,
    isRepeating: true,
    taskCreatedAt: "2026-08-01T12:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
    ...overrides,
  };
}

interface CardOptions {
  occurrence?: Partial<BoardOccurrence>;
  tasks?: Task[];
  /** Draw the card with no board above it at all — the default context. */
  bare?: boolean;
}

function renderCard(options: CardOptions = {}): void {
  const card = (
    <TaskCard
      occurrence={occurrenceOf(options.occurrence)}
      accent={SUNSHINE}
      onOpen={vi.fn()}
      onResolve={vi.fn()}
    />
  );
  render(
    options.bare === true ? (
      card
    ) : (
      <TaskStreaksProvider tasks={options.tasks ?? [taskOf()]}>{card}</TaskStreaksProvider>
    ),
  );
}

function badge(): HTMLElement | null {
  const found = document.querySelector("[data-streak-badge]");
  return found instanceof HTMLElement ? found : null;
}

function drawnBadge(): HTMLElement {
  const found = badge();
  if (found === null) throw new Error("no streak badge rendered");
  return found;
}

describe("StreakBadge (FR-371, FR-372, US4-6)", () => {
  it("reads the count stored with the task rows, beside the routine's name", () => {
    renderCard();

    expect(drawnBadge()).toHaveTextContent("11");
    // Beside the NAME, inside the body control, rather than out at the card's
    // edge where the late pill lives (FR-372).
    expect(drawnBadge().closest("button")).toBe(
      screen.getByRole("button", { name: "Brush teeth, 11 day streak" }),
    );
  });

  it("says the streak once, in the control's own name", () => {
    renderCard();

    // The body button carries an explicit accessible name, so the badge's
    // glyph and digits inside it must not try to be announced a second time.
    expect(drawnBadge()).toHaveAttribute("aria-hidden", "true");
  });

  it("reads each assignee's own count, never the task's (FR-324)", () => {
    renderCard({
      occurrence: { assigneeId: "ben" },
      tasks: [
        taskOf({
          assignees: [assigneeOf(), assigneeOf({ categoryId: "ben", streakCount: 3 })],
        }),
      ],
    });

    expect(drawnBadge()).toHaveTextContent("3");
  });

  it("draws nothing once the streak has reset (FR-373, US4-8)", () => {
    renderCard({ tasks: [taskOf({ assignees: [assigneeOf({ streakCount: 0 })] })] });

    // A run of zero days is not a run: the eleven going away IS the reset,
    // rather than a lightning bolt over a nought on every untouched routine.
    expect(badge()).toBeNull();
    expect(screen.getByRole("button", { name: "Brush teeth" })).toBeInTheDocument();
  });

  it("never appears on a chore, on any card, whatever is stored (FR-337)", () => {
    renderCard({
      occurrence: { routine: false, trackHabit: false, slot: null, isRepeating: false },
      tasks: [taskOf({ routine: false, trackHabit: false, timesOfDay: [] })],
    });

    expect(badge()).toBeNull();
  });

  it("stays off a routine whose Track Habit switch is off (FR-337)", () => {
    renderCard({
      occurrence: { trackHabit: false },
      tasks: [taskOf({ trackHabit: false })],
    });

    expect(badge()).toBeNull();
  });

  it("has nothing to read on an occurrence belonging to nobody (FR-308)", () => {
    renderCard({ occurrence: { assigneeId: null, upForGrabs: true } });

    expect(badge()).toBeNull();
  });

  it("has nothing to read when the task row has gone (FR-393)", () => {
    renderCard({ tasks: [] });

    expect(badge()).toBeNull();
  });

  it("draws nothing at all on a card with no board above it", () => {
    renderCard({ bare: true });

    expect(badge()).toBeNull();
  });

  it("consumes the shared badge geometry and the lightning bolt (Assumption 17)", () => {
    renderCard();
    const className = drawnBadge().className;

    // T038 owns these; this badge neither redefines nor extends them, and it
    // wears the same pill the late mark does so a card carrying both reads as
    // one family of marks.
    expect(className).toContain("h-(--fam-task-badge-h)");
    expect(className).toContain("rounded-(--fam-task-badge-r)");
    expect(className).toContain("px-(--fam-task-badge-pad)");
    expect(drawnBadge().querySelector("svg")).not.toBeNull();
  });
});
