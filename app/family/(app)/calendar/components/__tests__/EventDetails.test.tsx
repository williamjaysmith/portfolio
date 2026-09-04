import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PALETTE } from "@/lib/family/colors";
import type { Occurrence } from "@/lib/family/types";

import { makeCategory, stubDialog } from "../../../components/__tests__/family-test-utils";
import { EventDetails, type EventDetailsProps } from "../EventDetails";

/**
 * T047 — the details surface of FR-256/257: true times whatever the block's
 * drawn height (FR-218), the repeat in words, Profiles and Labels by name and
 * colour in draw order, location and notes only when present, and the
 * reference rows this build deliberately lacks (invitees FR-229, reminders
 * FR-230, countdown FR-228) nowhere at all. Every intent leaves through a
 * callback — the component imports no action.
 */

const ZONE = "America/Chicago";

function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    eventId: "event-1",
    occurrenceDate: "2026-09-04",
    isRepeating: false,
    summary: "Grocery Run",
    description: null,
    location: null,
    categoryIds: [],
    // 9:00 – 9:15 AM in America/Chicago (CDT, UTC-5) — a 15-minute event the
    // grid draws at the FR-218 minimum height.
    times: {
      allDay: false,
      startsAt: "2026-09-04T14:00:00.000Z",
      endsAt: "2026-09-04T14:15:00.000Z",
    },
    ...overrides,
  };
}

function renderDetails(overrides: Partial<EventDetailsProps> = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <EventDetails
      occurrence={makeOccurrence()}
      repeat={{ kind: "never" }}
      categories={[]}
      zone={ZONE}
      timeFormat="12h"
      onEdit={onEdit}
      onDelete={onDelete}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onEdit, onDelete, onClose };
}

describe("EventDetails", () => {
  beforeEach(() => {
    stubDialog();
  });

  it("shows the TRUE stored span of a min-height block (FR-218/FR-256)", () => {
    renderDetails();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Grocery Run" })).toBeInTheDocument();
    // The grid drew this 15-minute event 44 pt tall; the details never lie.
    expect(dialog).toHaveTextContent("Friday, September 4, 2026, 9:00 AM – 9:15 AM");
  });

  it("names both dates of a midnight-crossing event (FR-217's one event)", () => {
    renderDetails({
      occurrence: makeOccurrence({
        // Fri 22:00 → Sat 01:00 in America/Chicago.
        times: {
          allDay: false,
          startsAt: "2026-09-05T03:00:00.000Z",
          endsAt: "2026-09-05T06:00:00.000Z",
        },
      }),
    });

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Friday, September 4, 2026, 10:00 PM – Saturday, September 5, 2026, 1:00 AM",
    );
  });

  it("renders a multi-day all-day event with its inclusive end date (FR-225)", () => {
    renderDetails({
      occurrence: makeOccurrence({
        times: { allDay: true, startDate: "2026-10-05", endDate: "2026-10-07" },
      }),
    });

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Monday, October 5, 2026 – Wednesday, October 7, 2026 · All day",
    );
  });

  it("renders a single all-day date without a range", () => {
    renderDetails({
      occurrence: makeOccurrence({
        times: { allDay: true, startDate: "2026-10-05", endDate: "2026-10-05" },
      }),
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Monday, October 5, 2026 · All day");
    expect(dialog).not.toHaveTextContent("–");
  });

  it("respects the household's 24-hour clock", () => {
    renderDetails({ timeFormat: "24h" });

    expect(screen.getByRole("dialog")).toHaveTextContent("09:00 – 09:15");
  });

  it("describes a weekly repeat with its end date in words (FR-231/232/256)", () => {
    renderDetails({
      occurrence: makeOccurrence({ isRepeating: true, occurrenceDate: "2026-10-06" }),
      repeat: { kind: "weekly", weekdays: ["TU"], until: "2026-12-15" },
    });

    expect(screen.getByText("Repeats")).toBeInTheDocument();
    expect(
      screen.getByText("Every week on Tuesday until December 15, 2026"),
    ).toBeInTheDocument();
  });

  it("joins several weekdays in words", () => {
    renderDetails({
      repeat: { kind: "weekly", weekdays: ["MO", "WE", "FR"] },
    });

    expect(screen.getByText("Every week on Monday, Wednesday and Friday")).toBeInTheDocument();
  });

  it("describes an endless daily repeat without an until clause", () => {
    renderDetails({ repeat: { kind: "daily" } });

    expect(screen.getByText("Every day")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).not.toHaveTextContent("until");
  });

  it.each([
    ["2026-10-06", "Every month on the 6th"],
    ["2026-10-03", "Every month on the 3rd"],
    ["2026-10-22", "Every month on the 22nd"],
    ["2026-10-13", "Every month on the 13th"],
    ["2026-10-31", "Every month on the 31st"],
  ])("speaks the monthly ordinal from the occurrence's original date (%s)", (date, words) => {
    renderDetails({
      occurrence: makeOccurrence({ isRepeating: true, occurrenceDate: date }),
      repeat: { kind: "monthly" },
    });

    expect(screen.getByText(words)).toBeInTheDocument();
  });

  it("renders no repeat row at all on a one-off", () => {
    renderDetails({ repeat: { kind: "never" } });

    expect(screen.queryByText("Repeats")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Every/)).not.toBeInTheDocument();
  });

  it("lists assigned Profiles and Labels by name and colour in draw order (FR-227/256)", () => {
    const cleo = makeCategory({ id: "cleo", label: "Cleo", color: PALETTE[13] });
    const binDay = makeCategory({
      id: "bin-day",
      label: "Bin day",
      color: PALETTE[16],
      isProfile: false,
    });
    renderDetails({
      occurrence: makeOccurrence({ categoryIds: ["bin-day", "cleo", "ghost"] }),
      categories: [cleo, binDay],
    });

    const items = within(screen.getByRole("list", { name: "Assigned to" })).getAllByRole(
      "listitem",
    );
    // Draw order, not household order; the unknown id drops out silently.
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Bin day");
    expect(items[1]).toHaveTextContent("Cleo");
    expect(items[0].querySelector("span[aria-hidden]")).toHaveStyle({
      backgroundColor: PALETTE[16],
    });
    expect(items[1].querySelector("span[aria-hidden]")).toHaveStyle({
      backgroundColor: PALETTE[13],
    });
  });

  it("renders no assigned list for a category-less event (FR-213)", () => {
    renderDetails();

    expect(screen.queryByRole("list", { name: "Assigned to" })).not.toBeInTheDocument();
  });

  it("shows location and notes when the event carries them (FR-221/256)", () => {
    renderDetails({
      occurrence: makeOccurrence({
        location: "Rec centre",
        description: "Bring the swim bag",
      }),
    });

    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Rec centre")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Bring the swim bag")).toBeInTheDocument();
  });

  it("renders nothing for absent location and notes", () => {
    renderDetails();

    expect(screen.queryByText("Location")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
  });

  it("has no invitee, reminder or countdown row anywhere (FR-229/230/228)", () => {
    renderDetails({
      occurrence: makeOccurrence({ location: "Rec centre", description: "Notes text" }),
      repeat: { kind: "daily" },
      categories: [makeCategory()],
    });

    const text = screen.getByRole("dialog").textContent ?? "";
    expect(text).not.toMatch(/invit/i);
    expect(text).not.toMatch(/remind/i);
    expect(text).not.toMatch(/countdown/i);
  });

  it("reaches editing through the Edit button only (FR-257)", () => {
    const { onEdit, onDelete, onClose } = renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hands Delete to the parent's confirmation flow (FR-258)", () => {
    const { onDelete } = renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("closes through the Close button and through Escape", () => {
    const { onClose } = renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape arrives as the dialog's native cancel event.
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("opens with focus on the safe control, Phase 1's dialog idiom", () => {
    renderDetails();

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });
});
