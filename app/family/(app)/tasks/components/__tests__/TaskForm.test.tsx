import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real `fail`, not the test helper's: only this one carries `fieldErrors`,
// which is what a VALIDATION result from the server actually looks like.
import { fail } from "@/lib/family/errors";
import type { Category } from "@/lib/family/types";
import type { TaskInput } from "@/lib/family/validation";

import { ok } from "../../../components/__tests__/action-result";
import {
  makeCategory,
  makeContext,
  stubDialog,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { TaskForm, type TaskFormProps } from "../TaskForm";

/**
 * T053 — the create/edit form, driven against a mocked `onSubmit` (T057 hands
 * it the real actions through `withActor`).
 *
 * What is pinned here:
 *   - FR-330's field ORDER: title, emoji, description, assignment, task type,
 *     the type's own scheduling fields, Up for Grabs (chores only), Track Habit
 *     (routines only), "Save to task box";
 *   - the type toggle swapping a chore's Date/Time controls for a routine's
 *     repeat + weekdays + Morning/Afternoon/Evening (FR-333, FR-334, US2-7),
 *     with more than one weekday allowed and at least one slot required;
 *   - the chore's two MUTUALLY EXCLUSIVE repeat modes — Scheduled Date
 *     (Every [N] + day/week/month + a position within the unit + optional
 *     Repeats until, FR-340) and Completed Date (After → Immediately or Custom
 *     [N] + unit, FR-339, FR-342–FR-346);
 *   - monthly's day of the month shown READ-ONLY, derived from the chosen
 *     `startsOn` and never submitted — the contract's Zod table says the
 *     emitter derives BYMONTHDAY from the anchor;
 *   - the assignment picker listing PROFILES only, and withdrawing any Profile
 *     whose Show on Tasks tab switch is off (FR-313, FR-323, US2-6);
 *   - refusals landing against their field with every other entry preserved
 *     (FR-330, US2-4);
 *   - the three pieces of copy that are right but not obvious (R303);
 *   - and the absence check: no star value field anywhere (FR-329, SC-319).
 */

const ANA = "11111111-1111-4111-8111-111111111111";
const CLEO = "22222222-2222-4222-8222-222222222222";
const BEN = "33333333-3333-4333-8333-333333333333";
const BIN_DAY = "44444444-4444-4444-8444-444444444444";

const HOUSEHOLD: Category[] = [
  makeCategory({ id: ANA, label: "Ana", sortOrder: 1000 }),
  makeCategory({ id: CLEO, label: "Cleo", role: "member", sortOrder: 2000 }),
  // FR-313: switched off the Tasks tab, so the picker withdraws them.
  makeCategory({ id: BEN, label: "Ben", role: "member", showOnTasks: false, sortOrder: 3000 }),
  // FR-323: a Label is never assignable.
  makeCategory({ id: BIN_DAY, label: "Bin day", isProfile: false, sortOrder: 4000 }),
];

function renderForm(overrides: Partial<TaskFormProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(ok(null));
  const onClose = vi.fn();
  render(
    withFamily(
      makeContext({ categories: HOUSEHOLD }),
      <TaskForm
        mode={overrides.mode ?? "create"}
        seed={overrides.seed}
        onSubmit={overrides.onSubmit ?? onSubmit}
        onClose={overrides.onClose ?? onClose}
      />,
    ),
  );
  return { onSubmit, onClose };
}

function type(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

function clickSave(): void {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

function submitted(onSubmit: ReturnType<typeof vi.fn>): TaskInput {
  return onSubmit.mock.calls[0][0] as TaskInput;
}

function chooseType(label: "Chore" | "Routine"): void {
  fireEvent.click(screen.getByRole("radio", { name: label }));
}

function assign(name: string): void {
  fireEvent.click(screen.getByRole("checkbox", { name }));
}

/** The minimum a valid one-off chore needs. */
function fillOneOffChore(): void {
  type(screen.getByLabelText("Title"), "Feed the cat");
  assign("Cleo");
  type(screen.getByLabelText("Due date"), "2026-09-08");
}

function expectBefore(earlier: HTMLElement, later: HTMLElement): void {
  const position = earlier.compareDocumentPosition(later);
  expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("TaskForm", () => {
  beforeEach(() => {
    stubDialog();
  });

  /** FR-330's order, read off the rendered document rather than off the source. */
  it("lays the fields out in FR-330's order", () => {
    renderForm();
    const order = [
      screen.getByLabelText("Title"),
      screen.getByLabelText("Emoji (optional)"),
      screen.getByLabelText("Description (optional)"),
      screen.getByRole("group", { name: "Assign to" }),
      screen.getByRole("group", { name: "Task type" }),
      screen.getByRole("group", { name: "Schedule" }),
      screen.getByRole("switch", { name: "Up for Grabs" }),
      screen.getByRole("switch", { name: "Save to task box" }),
    ];
    for (let i = 1; i < order.length; i += 1) expectBefore(order[i - 1], order[i]);
  });

  describe("the assignment picker offers Profiles only (FR-313, FR-323, US2-6)", () => {
    it("lists the household's Profiles, never a Label, and never a withdrawn one", () => {
      renderForm();
      const picker = screen.getByRole("group", { name: "Assign to" });

      expect(within(picker).getByRole("checkbox", { name: "Ana" })).toBeInTheDocument();
      expect(within(picker).getByRole("checkbox", { name: "Cleo" })).toBeInTheDocument();
      // US2-6's own example: "Bin day" is a Label and is simply not offered.
      expect(within(picker).queryByRole("checkbox", { name: "Bin day" })).toBeNull();
      // FR-313: Show on Tasks tab is off, so Ben has no column and no entry here.
      expect(within(picker).queryByRole("checkbox", { name: "Ben" })).toBeNull();
    });

    it("submits the chosen ids in the household's own draw order", async () => {
      const { onSubmit } = renderForm();
      type(screen.getByLabelText("Title"), "Set the table");
      assign("Cleo");
      assign("Ana");
      type(screen.getByLabelText("Due date"), "2026-09-08");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).assigneeIds).toEqual([ANA, CLEO]);
    });
  });

  describe("the type toggle swaps one type's fields for the other's (FR-333, US2-7)", () => {
    it("a chore has a date and a time; a routine has neither", () => {
      renderForm();
      expect(screen.getByLabelText("Due date")).toBeInTheDocument();
      expect(screen.getByLabelText("Due time (optional)")).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Times of day" })).toBeNull();

      chooseType("Routine");
      expect(screen.queryByLabelText("Due date")).toBeNull();
      expect(screen.queryByLabelText("Due time (optional)")).toBeNull();
      expect(screen.getByLabelText("Starts on")).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Times of day" })).toBeInTheDocument();
    });

    it("Up for Grabs is a chore's switch and Track Habit is a routine's (FR-337, FR-338)", () => {
      renderForm();
      expect(screen.getByRole("switch", { name: "Up for Grabs" })).toBeInTheDocument();
      expect(screen.queryByRole("switch", { name: "Track Habit" })).toBeNull();

      chooseType("Routine");
      expect(screen.queryByRole("switch", { name: "Up for Grabs" })).toBeNull();
      expect(screen.getByRole("switch", { name: "Track Habit" })).toBeInTheDocument();
    });
  });

  describe("the routine's repeat: every N days, or weekly on chosen weekdays", () => {
    function fillRoutine(): void {
      type(screen.getByLabelText("Title"), "Brush teeth");
      assign("Cleo");
      chooseType("Routine");
      type(screen.getByLabelText("Starts on"), "2026-09-08");
    }

    it("saves 'every 2 days' with NO weekdays and one time of day (US2-7)", async () => {
      const { onSubmit } = renderForm();
      fillRoutine();
      type(screen.getByLabelText("Repeat every"), "2");
      // Days is the default unit, so no weekday control is offered at all.
      expect(screen.queryByRole("group", { name: "On these days" })).toBeNull();
      assign("Morning");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      const input = submitted(onSubmit);
      expect(input.routine).toBe(true);
      expect(input.repeat).toEqual({ kind: "daily", interval: 2, until: null });
      expect(input.timesOfDay).toEqual(["morning"]);
      expect(input.dueTime ?? null).toBeNull();
    });

    it("takes MORE THAN ONE weekday, and canonicalises the slot order", async () => {
      const { onSubmit } = renderForm();
      fillRoutine();
      type(screen.getByLabelText("Repeat unit"), "week");
      const weekdays = screen.getByRole("group", { name: "On these days" });
      fireEvent.click(within(weekdays).getByRole("checkbox", { name: "Wednesday" }));
      fireEvent.click(within(weekdays).getByRole("checkbox", { name: "Monday" }));
      assign("Evening");
      assign("Morning");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      const input = submitted(onSubmit);
      expect(input.repeat).toEqual({
        kind: "weekly",
        interval: 1,
        weekdays: ["MO", "WE"],
        until: null,
      });
      // 016's `task_slots_shape` spells the canonical order out; the form emits it.
      expect(input.timesOfDay).toEqual(["morning", "evening"]);
    });

    it("refuses a routine with no time of day, against its own field (FR-335)", async () => {
      const { onSubmit } = renderForm();
      fillRoutine();
      clickSave();

      await waitFor(() =>
        expect(screen.getByText("Pick at least one time of day.")).toBeInTheDocument(),
      );
      expect(onSubmit).not.toHaveBeenCalled();
      // Everything else the person typed is still there (FR-330).
      expect(screen.getByLabelText("Title")).toHaveValue("Brush teeth");
      expect(screen.getByRole("checkbox", { name: "Cleo" })).toBeChecked();
    });
  });

  describe("the chore's two repeat modes are mutually exclusive (FR-339)", () => {
    function fillRepeatingChore(mode: string): void {
      fillOneOffChore();
      fireEvent.click(screen.getByRole("radio", { name: mode }));
    }

    it("Scheduled Date offers Every [N] + a unit, and a position within the week", async () => {
      const { onSubmit } = renderForm();
      fillRepeatingChore("On a schedule");
      type(screen.getByLabelText("Repeat every"), "2");
      type(screen.getByLabelText("Repeat unit"), "week");
      const weekdays = screen.getByRole("group", { name: "On these days" });
      fireEvent.click(within(weekdays).getByRole("checkbox", { name: "Tuesday" }));
      type(screen.getByLabelText("Repeats until (optional)"), "2026-12-15");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).repeat).toEqual({
        kind: "weekly",
        interval: 2,
        weekdays: ["TU"],
        until: "2026-12-15",
      });
    });

    it("monthly shows the day of the month READ-ONLY and never submits it", async () => {
      const { onSubmit } = renderForm();
      fillRepeatingChore("On a schedule");
      type(screen.getByLabelText("Repeat unit"), "month");

      const derived = screen.getByLabelText("On day of the month");
      expect(derived).toHaveValue("8");
      expect(derived).toHaveAttribute("readonly");
      // Moving the anchor moves the derived day, because that is where it comes from.
      type(screen.getByLabelText("Due date"), "2026-09-30");
      expect(screen.getByLabelText("On day of the month")).toHaveValue("30");

      clickSave();
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).repeat).toEqual({ kind: "monthly", interval: 1, until: null });
    });

    it("Completed Date offers Immediately, or a custom delay, and never a schedule", async () => {
      const { onSubmit } = renderForm();
      fillRepeatingChore("After it's completed");
      expect(screen.queryByRole("group", { name: "On these days" })).toBeNull();

      fireEvent.click(screen.getByRole("radio", { name: "Custom" }));
      type(screen.getByLabelText("After how long"), "2");
      type(screen.getByLabelText("Delay unit"), "week");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).repeat).toEqual({
        kind: "after_completion",
        amount: 2,
        unit: "week",
        until: null,
      });
    });

    it("'Immediately' is a delay of zero, not the absence of one (FR-342)", async () => {
      const { onSubmit } = renderForm();
      fillRepeatingChore("After it's completed");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(submitted(onSubmit).repeat).toMatchObject({ kind: "after_completion", amount: 0 });
    });

    it("a chore that doesn't repeat submits `never` and no scheduling extras", async () => {
      const { onSubmit } = renderForm();
      fillOneOffChore();
      type(screen.getByLabelText("Due time (optional)"), "18:00");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      const input = submitted(onSubmit);
      expect(input.repeat).toEqual({ kind: "never" });
      expect(input.startsOn).toBe("2026-09-08");
      expect(input.dueTime).toBe("18:00");
      expect(input.timesOfDay).toEqual([]);
    });
  });

  describe("refusals land against their field and keep the rest (FR-330, US2-4)", () => {
    it("refuses an empty title locally, before the network is touched", async () => {
      const { onSubmit } = renderForm();
      assign("Cleo");
      type(screen.getByLabelText("Description (optional)"), "the tabby one");
      clickSave();

      await waitFor(() => expect(screen.getByText("Title is required.")).toBeInTheDocument());
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Description (optional)")).toHaveValue("the tabby one");
    });

    it("refuses no assignee with Up for Grabs off (US2-5)", async () => {
      renderForm();
      type(screen.getByLabelText("Title"), "Nobody's chore");
      clickSave();

      await waitFor(() =>
        expect(
          screen.getByText("Assign this to at least one Profile, or mark it Up for Grabs."),
        ).toBeInTheDocument(),
      );
    });

    it("takes Up for Grabs as the deliberate answer to 'nobody' (FR-365)", async () => {
      const { onSubmit } = renderForm();
      type(screen.getByLabelText("Title"), "Empty the dishwasher");
      fireEvent.click(screen.getByRole("switch", { name: "Up for Grabs" }));
      type(screen.getByLabelText("Due date"), "2026-09-08");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      const input = submitted(onSubmit);
      expect(input.upForGrabs).toBe(true);
      expect(input.assigneeIds).toEqual([]);
    });

    it("shows a server refusal against the field the server named", async () => {
      const onSubmit = vi
        .fn()
        .mockResolvedValue(fail("VALIDATION", "Nope.", { summary: ["That name is taken."] }));
      renderForm({ onSubmit });
      fillOneOffChore();
      clickSave();

      await waitFor(() => expect(screen.getByText("That name is taken.")).toBeInTheDocument());
      expect(screen.getByLabelText("Title")).toHaveValue("Feed the cat");
    });
  });

  describe("the copy that is right but not obvious (R303)", () => {
    it("says a changed delay moves the open occurrence, possibly into the past", () => {
      renderForm();
      fillOneOffChore();
      fireEvent.click(screen.getByRole("radio", { name: "After it's completed" }));

      expect(
        screen.getByText(/moves the next one the next time the board is read/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/only used until this has been done once/i)).toBeInTheDocument();
    });

    it("warns about the month a monthly repeat can skip", () => {
      renderForm();
      fillOneOffChore();
      fireEvent.click(screen.getByRole("radio", { name: "On a schedule" }));
      type(screen.getByLabelText("Repeat unit"), "month");

      expect(screen.getByText(/a month without that date is skipped/i)).toBeInTheDocument();
    });
  });

  describe("what the form does NOT have", () => {
    it("offers no star value on either type (FR-329, SC-319)", () => {
      const { onSubmit } = renderForm();
      const dialog = screen.getByRole("dialog");
      chooseType("Routine");
      // Word-bounded, so "Starts on" is not mistaken for a star value.
      expect(within(dialog).queryByText(/\bstars?\b/i)).toBeNull();
      expect(within(dialog).queryByText(/\bpoints?\b/i)).toBeNull();
      expect(within(dialog).queryByText(/\breward/i)).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("offers 'Save to task box' on create only — it is a create-time choice", () => {
      renderForm({ mode: "edit", seed: { summary: "Dishes", startsOn: "2026-09-08" } });
      expect(screen.queryByRole("switch", { name: "Save to task box" })).toBeNull();
      expect(screen.getByRole("heading", { name: "Edit task" })).toBeInTheDocument();
    });
  });

  it("closes without submitting when Cancel is pressed", () => {
    const { onSubmit, onClose } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
