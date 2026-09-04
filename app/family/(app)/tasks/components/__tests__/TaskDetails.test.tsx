import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { ActorSession, BoardOccurrence, Category } from "@/lib/family/types";

import {
  makeActor,
  makeCategory,
  stubDialog,
} from "../../../components/__tests__/family-test-utils";
import { TaskDetails, dayInWords, scheduleInWords } from "../TaskDetails";

/**
 * T045 — the details view a tap on the card BODY opens (FR-352, US1-8).
 *
 * Two rules are load-bearing here and are each asserted rather than assumed:
 *
 *   - the completion action is ALWAYS offered, whoever is punched in, because
 *     FR-350 puts the gate on the server "rather than by hiding controls" — a
 *     member tapping another's task must reach the refusal, not a missing
 *     button;
 *   - Edit and Delete are affordances over `permissions.can` (FR-389), so they
 *     are a parent's and appear only once the surface behind them exists.
 *
 * Skip is absent on purpose: it needs `skipTaskOccurrence`, which arrives with
 * US3 (T063). Unskip is here because the shipped `CompleteCircle` already
 * offers it on a skipped card and it is the same DELETE as un-complete.
 */

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-09-04";

function profile(id: string, label: string, overrides: Partial<Category> = {}): Category {
  return makeCategory({ id, label, color: PALETTE[1], role: "member", ...overrides });
}

const CATEGORIES: Category[] = [
  profile(CLEO, "Cleo"),
  profile(BEN, "Ben"),
  profile("44444444-4444-4444-8444-444444444444", "Ana", { role: "parent" }),
];

function occurrence(overrides: Partial<BoardOccurrence> = {}): BoardOccurrence {
  return {
    taskId: "22222222-2222-4222-8222-222222222222",
    assigneeId: CLEO,
    scheduledDate: TODAY,
    slot: null,
    cyclePrev: null,
    displayedDate: TODAY,
    isLate: false,
    summary: "Feed the cat",
    description: null,
    emoji: null,
    routine: false,
    upForGrabs: false,
    trackHabit: false,
    dueTime: null,
    dueAt: null,
    isRepeating: false,
    taskCreatedAt: "2026-08-01T12:00:00.000Z",
    state: "unresolved",
    creditedCategoryId: null,
    ...overrides,
  };
}

interface RenderOptions {
  occurrence?: BoardOccurrence;
  actor?: ActorSession | null;
  busy?: boolean;
  notice?: string | null;
  writable?: boolean;
}

function renderDetails(options: RenderOptions = {}) {
  const onResolve = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <TaskDetails
      occurrence={options.occurrence ?? occurrence()}
      categories={CATEGORIES}
      actor={options.actor ?? null}
      timeFormat="12h"
      busy={options.busy}
      notice={options.notice ?? null}
      onResolve={onResolve}
      // The write surface arrives at T057; until then the board hands over no
      // handlers and the two controls have nothing to open.
      onEdit={options.writable ? onEdit : undefined}
      onDelete={options.writable ? onDelete : undefined}
      onClose={onClose}
    />,
  );
  return { onResolve, onEdit, onDelete, onClose };
}

beforeAll(() => {
  stubDialog();
});

describe("scheduleInWords", () => {
  it("names an anytime chore's absence of a date (FR-328)", () => {
    expect(scheduleInWords(occurrence({ scheduledDate: null }), "12h")).toBe("Anytime");
  });

  it("names an all-day chore's day, and a timed chore's clock (FR-325)", () => {
    expect(scheduleInWords(occurrence(), "12h")).toBe("Friday, September 4, 2026 · All day");
    expect(scheduleInWords(occurrence({ dueTime: "18:00" }), "12h")).toBe(
      "Friday, September 4, 2026 at 6:00 PM",
    );
    expect(scheduleInWords(occurrence({ dueTime: "18:00" }), "24h")).toBe(
      "Friday, September 4, 2026 at 18:00",
    );
  });

  it("names a routine occurrence by the slot it was generated for (FR-336)", () => {
    expect(scheduleInWords(occurrence({ routine: true, slot: "morning" }), "12h")).toBe(
      "Morning · Friday, September 4, 2026",
    );
  });

  it("keeps a late occurrence's OWN due date and says it is late (FR-358)", () => {
    const late = occurrence({ scheduledDate: "2026-09-01", displayedDate: TODAY, isLate: true });
    expect(scheduleInWords(late, "12h")).toBe(
      "Tuesday, September 1, 2026 · All day · Late",
    );
  });

  it("says a repeating task repeats, without naming a rule the client never sees", () => {
    expect(scheduleInWords(occurrence({ isRepeating: true }), "12h")).toContain("Repeats");
  });
});

describe("dayInWords", () => {
  it("reads a plain household date without shifting it across midnight", () => {
    expect(dayInWords("2026-01-01")).toBe("Thursday, January 1, 2026");
  });
});

describe("TaskDetails", () => {
  it("shows the title, emoji, description, who it is for and the schedule (FR-352, US1-8)", () => {
    renderDetails({
      occurrence: occurrence({
        emoji: "🐈",
        description: "Half a tin, morning and evening.",
        dueTime: "18:00",
      }),
    });

    expect(screen.getByRole("heading", { name: /Feed the cat/ })).toBeInTheDocument();
    expect(screen.getByText("🐈")).toBeInTheDocument();
    expect(screen.getByText("Half a tin, morning and evening.")).toBeInTheDocument();
    expect(screen.getByText("Cleo")).toBeInTheDocument();
    expect(screen.getByText(/6:00 PM/)).toBeInTheDocument();
  });

  it("names the column an unclaimed up-for-grabs occurrence sits in (FR-308)", () => {
    renderDetails({
      occurrence: occurrence({ assigneeId: null, upForGrabs: true }),
    });
    expect(screen.getByText("Up for Grabs")).toBeInTheDocument();
  });

  it("names the Profile a claim credited rather than the chain owner (FR-367)", () => {
    renderDetails({
      occurrence: occurrence({
        assigneeId: null,
        upForGrabs: true,
        state: "complete",
        creditedCategoryId: BEN,
      }),
    });
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.queryByText("Up for Grabs")).not.toBeInTheDocument();
  });

  it("offers the action the drawn state implies (FR-352)", () => {
    const { onResolve } = renderDetails();
    fireEvent.click(screen.getByRole("button", { name: "Mark as Complete" }));
    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it("offers Mark as Incomplete on a completed occurrence (US1-7)", () => {
    renderDetails({ occurrence: occurrence({ state: "complete", creditedCategoryId: CLEO }) });
    expect(screen.getByRole("button", { name: "Mark as Incomplete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Complete" })).not.toBeInTheDocument();
  });

  it("offers Unskip on a skipped occurrence, and never Skip in this phase (FR-361)", () => {
    renderDetails({ occurrence: occurrence({ state: "skipped" }) });
    expect(screen.getByRole("button", { name: "Unskip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
  });

  it("keeps the completion action rendered with nobody punched in (FR-350)", () => {
    renderDetails({ actor: null });
    // Hiding it would make the control the gate, which FR-350 forbids: the
    // punch-in has to arrive at the tap.
    expect(screen.getByRole("button", { name: "Mark as Complete" })).toBeEnabled();
  });

  it("stops a second tap while the write is in flight (FR-393)", () => {
    const { onResolve } = renderDetails({ busy: true });
    const action = screen.getByRole("button", { name: "Mark as Complete" });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("offers Edit and Delete to a parent only (FR-389)", () => {
    renderDetails({ actor: makeActor("parent"), writable: true });
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("offers neither to a punched-in member, nor to nobody at all (FR-389)", () => {
    renderDetails({ actor: makeActor("member"), writable: true });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    renderDetails({ actor: null, writable: true });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("shows a refusal where the tap happened (FR-351)", () => {
    const message = "That's Ben's task — only Ben or a parent can do it.";
    renderDetails({ notice: message });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("closes on the Close button", () => {
    const { onClose } = renderDetails();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
