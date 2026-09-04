import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real `fail`, not the test helper's: only this one carries `fieldErrors`,
// which is what a VALIDATION result from the server actually looks like.
import { fail } from "@/lib/family/errors";
import type { Category, EventInput } from "@/lib/family/types";

import { ok } from "../../../components/__tests__/action-result";
import {
  makeCategory,
  makeContext,
  stubDialog,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { EventForm, type EventFormProps } from "../EventForm";

/**
 * T046 — the write surface's form, driven against a mocked `onSubmit` (the
 * real actions arrive with T050): FR-259's field order; the all-day swap
 * (US2-3); the end's own date with instant comparison (FR-222/226,
 * Assumption 43); the four repeat choices with an optional end (FR-231/232);
 * the combined draw-order picker (FR-260/227); field-anchored refusals that
 * preserve every other entry (FR-262); and the device-zone provenance stamp
 * (FR-224).
 */

const DRAW_ORDER: Category[] = [
  makeCategory({ id: "11111111-1111-4111-8111-111111111111", label: "Alex", sortOrder: 1000 }),
  makeCategory({
    id: "22222222-2222-4222-8222-222222222222",
    label: "Cleo",
    role: "member",
    sortOrder: 2000,
  }),
  makeCategory({
    id: "33333333-3333-4333-8333-333333333333",
    label: "Soccer",
    isProfile: false,
    role: "member",
    sortOrder: 3000,
  }),
];

function renderForm(overrides: Partial<EventFormProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(ok(null));
  const onClose = vi.fn();
  render(
    withFamily(
      makeContext({ categories: DRAW_ORDER }),
      <EventForm
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

/** Fills the fields every valid submit needs; dates/times layered on top. */
function fillTitle(value = "Dinner"): void {
  type(screen.getByLabelText("Title"), value);
}

function setTimed(startDate: string, startTime: string, endDate: string, endTime: string): void {
  type(screen.getByLabelText("Start date"), startDate);
  type(screen.getByLabelText("Start time"), startTime);
  type(screen.getByLabelText("End date"), endDate);
  type(screen.getByLabelText("End time"), endTime);
}

function submitted(onSubmit: ReturnType<typeof vi.fn>): EventInput {
  return onSubmit.mock.calls[0][0] as EventInput;
}

function expectBefore(earlier: HTMLElement, later: HTMLElement): void {
  const position = earlier.compareDocumentPosition(later);
  expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("EventForm", () => {
  beforeEach(() => {
    stubDialog();
  });

  it("presents the fields in FR-259's order", () => {
    renderForm();

    const inOrder = [
      screen.getByLabelText("Title"),
      screen.getByRole("switch", { name: "All day" }),
      screen.getByLabelText("Start date"),
      screen.getByLabelText("End date"),
      screen.getByLabelText("Repeats"),
      screen.getByRole("group", { name: "Profiles & Labels" }),
      screen.getByLabelText("Location (optional)"),
      screen.getByLabelText("Notes (optional)"),
    ];
    for (let i = 0; i < inOrder.length - 1; i += 1) {
      expectBefore(inOrder[i], inOrder[i + 1]);
    }
  });

  it("offers none of the excluded inputs: emails, reminders, timezone, photo/voice", () => {
    renderForm();

    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByLabelText(/reminder/i)).toBeNull();
    expect(screen.queryByLabelText(/timezone/i)).toBeNull();
    expect(screen.queryByLabelText(/photo|voice/i)).toBeNull();
  });

  describe("the all-day switch (US2-3)", () => {
    it("starts timed, with a time and a date for each edge", () => {
      renderForm();

      expect(screen.getByLabelText("Start time")).toBeInTheDocument();
      expect(screen.getByLabelText("End time")).toBeInTheDocument();
      expect(screen.getByLabelText("End date")).toBeInTheDocument();
    });

    it("swaps the time controls for date controls when switched on", () => {
      renderForm();

      fireEvent.click(screen.getByRole("switch", { name: "All day" }));

      expect(screen.queryByLabelText("Start time")).toBeNull();
      expect(screen.queryByLabelText("End time")).toBeNull();
      expect(screen.getByLabelText("Start date")).toBeInTheDocument();
      expect(screen.getByLabelText("End date")).toBeInTheDocument();
    });

    it("submits an all-day event as plain dates", async () => {
      const { onSubmit, onClose } = renderForm();

      fillTitle("Fall fair");
      fireEvent.click(screen.getByRole("switch", { name: "All day" }));
      type(screen.getByLabelText("Start date"), "2026-10-09");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(submitted(onSubmit)).toMatchObject({
        allDay: true,
        startDate: "2026-10-09",
        endDate: "2026-10-09",
      });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe("the end's own date (FR-222/226, Assumption 43)", () => {
    it("defaults the end date to the start's until it is set apart", () => {
      renderForm();

      type(screen.getByLabelText("Start date"), "2026-10-09");
      expect(screen.getByLabelText("End date")).toHaveValue("2026-10-09");

      type(screen.getByLabelText("End date"), "2026-10-10");
      type(screen.getByLabelText("Start date"), "2026-10-16");
      expect(screen.getByLabelText("End date")).toHaveValue("2026-10-10");
    });

    it("saves Friday 22:00 → Saturday 01:00, stamped with the device zone", async () => {
      const { onSubmit, onClose } = renderForm();

      fillTitle("Night drive");
      setTimed("2026-10-09", "22:00", "2026-10-10", "01:00");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(submitted(onSubmit)).toEqual({
        allDay: false,
        startsAt: new Date(2026, 9, 9, 22, 0).toISOString(),
        endsAt: new Date(2026, 9, 10, 1, 0).toISOString(),
        summary: "Night drive",
        description: null,
        location: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        repeat: { kind: "never" },
        categoryIds: [],
      });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("refuses 09:00 → 08:00 the same day against the end field, preserving the rest", async () => {
      const { onSubmit } = renderForm();

      fillTitle("Standup");
      type(screen.getByLabelText("Location (optional)"), "Kitchen");
      setTimed("2026-10-09", "09:00", "2026-10-09", "08:00");
      clickSave();

      const fieldset = screen.getByLabelText("End time").closest("fieldset");
      expect(fieldset).not.toBeNull();
      await within(fieldset!).findByText("The end must be after the start.");
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("Standup")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Kitchen")).toBeInTheDocument();
    });
  });

  describe("the repeat picker (FR-231/232, US2-6)", () => {
    it("offers exactly the four choices, defaulting Never with no until field", () => {
      renderForm();

      const options = within(screen.getByLabelText("Repeats")).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual([
        "Never",
        "Every day",
        "Every week on chosen weekdays",
        "Every month on the date",
      ]);
      expect(screen.getByLabelText("Repeats")).toHaveValue("never");
      expect(screen.queryByLabelText("Repeats until (optional)")).toBeNull();
      expect(screen.queryByRole("checkbox", { name: "Monday" })).toBeNull();
    });

    it("submits a weekly repeat on the chosen weekdays with its end date", async () => {
      const { onSubmit, onClose } = renderForm();

      fillTitle("Piano");
      setTimed("2026-10-09", "16:00", "2026-10-09", "17:00"); // a Friday
      type(screen.getByLabelText("Repeats"), "weekly");
      // The start's weekday is pre-checked; add Monday.
      expect(screen.getByRole("checkbox", { name: "Friday" })).toBeChecked();
      fireEvent.click(screen.getByRole("checkbox", { name: "Monday" }));
      type(screen.getByLabelText("Repeats until (optional)"), "2026-12-15");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(submitted(onSubmit).repeat).toEqual({
        kind: "weekly",
        weekdays: ["MO", "FR"],
        until: "2026-12-15",
      });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("submits daily with no until as a never-ending series", async () => {
      const { onSubmit, onClose } = renderForm();

      fillTitle("Vitamins");
      setTimed("2026-10-09", "08:00", "2026-10-09", "08:15");
      type(screen.getByLabelText("Repeats"), "daily");
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(submitted(onSubmit).repeat).toEqual({ kind: "daily", until: null });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("refuses an until before the start, against the repeat field", async () => {
      const { onSubmit } = renderForm();

      fillTitle("Piano");
      setTimed("2026-10-09", "16:00", "2026-10-09", "17:00");
      type(screen.getByLabelText("Repeats"), "monthly");
      type(screen.getByLabelText("Repeats until (optional)"), "2026-10-01");
      clickSave();

      const fieldset = screen.getByLabelText("Repeats").closest("fieldset");
      expect(fieldset).not.toBeNull();
      await within(fieldset!).findByText("The repeat can't end before the event starts.");
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("the combined Profiles & Labels picker (FR-260/227)", () => {
    it("lists Profiles and Labels together, in draw order", () => {
      renderForm();

      const picker = screen.getByRole("group", { name: "Profiles & Labels" });
      const names = within(picker)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent);
      expect(names).toEqual(["Alex", "Cleo", "Soccer"]);
    });

    it("submits the selection in draw order, not click order", async () => {
      const { onSubmit, onClose } = renderForm();

      fillTitle("Practice");
      setTimed("2026-10-09", "16:00", "2026-10-09", "17:00");
      fireEvent.click(screen.getByRole("checkbox", { name: "Cleo" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Alex" }));
      clickSave();

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(submitted(onSubmit).categoryIds).toEqual([
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ]);
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe("refused saves (FR-262)", () => {
    it("lands a server refusal on its field and keeps the form open with entries intact", async () => {
      const onSubmit = vi
        .fn()
        .mockResolvedValue(
          fail("VALIDATION", "Title must be 120 characters or fewer.", {
            summary: ["Title must be 120 characters or fewer."],
          }),
        );
      const { onClose } = renderForm({ onSubmit });

      fillTitle("Dinner");
      type(screen.getByLabelText("Notes (optional)"), "Bring dessert");
      setTimed("2026-10-09", "18:00", "2026-10-09", "19:00");
      clickSave();

      await screen.findAllByText("Title must be 120 characters or fewer.");
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("Dinner")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bring dessert")).toBeInTheDocument();
    });
  });
});
