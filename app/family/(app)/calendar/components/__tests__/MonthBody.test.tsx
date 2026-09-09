import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { useWeekEvents } from "@/lib/family/queries";
import type { Event } from "@/lib/family/types";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { MonthBody } from "../MonthBody";

/**
 * 011 — the Month body, and the property that matters most about it:
 * **mounting is the condition.**
 *
 * An earlier version called `useMonthOccurrences` unconditionally from the
 * screen's model, so the WEEK view fetched and expanded a 35-to-42-day window
 * on every calendar load — while a comment two lines above claimed it did not.
 * That is what these first two cases exist to stop coming back.
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return { ...actual, useWeekEvents: vi.fn() };
});

vi.mock("../../../components/useDeviceVisibility", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../components/useDeviceVisibility")>();
  return { ...actual, useDeviceVisibility: () => ({ hiddenIds: new Set<string>() }) };
});

const CHICAGO = "America/Chicago";

function eventOn(id: string, date: string, hour: number): Event {
  const at = `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  return {
    id,
    householdId: "household-1",
    summary: id,
    description: null,
    location: null,
    timezone: CHICAGO,
    rrule: null,
    countdownEnabled: false,
    reminder: { mode: "inherit" },
    categoryIds: [],
    exceptions: [],
    times: { allDay: false, startsAt: at, endsAt: at },
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderBody(events: Event[]) {
  (useWeekEvents as unknown as Mock).mockReturnValue({
    data: events,
    isPending: false,
    error: null,
  });
  const onOpenDay = vi.fn();
  const onOpenTarget = vi.fn();
  render(
    <MonthBody
      householdId="household-1"
      anchorDate="2026-09-15"
      zone={CHICAGO}
      startWeekOn={0}
      todayDate="2026-09-15"
      timeFormat="12h"
      colorsById={{}}
      onOpenDay={onOpenDay}
      onOpenTarget={onOpenTarget}
      previewBar={<div>preview</div>}
      notices={<div>notices</div>}
    />,
  );
  return { onOpenDay, onOpenTarget };
}

describe("MonthBody", () => {
  beforeEach(() => {
    stubDialog();
    (useWeekEvents as unknown as Mock).mockClear();
  });

  it("issues NO read until it is mounted — the week must not fetch a month", () => {
    render(<div />);
    expect(useWeekEvents as unknown as Mock).not.toHaveBeenCalled();
  });

  it("issues its read the moment it mounts", () => {
    renderBody([]);
    expect(useWeekEvents as unknown as Mock).toHaveBeenCalled();
  });

  it("draws the month, its preview bar and its notices", () => {
    renderBody([]);
    expect(screen.getByRole("group", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByText("preview")).toBeInTheDocument();
    expect(screen.getByText("notices")).toBeInTheDocument();
  });

  it("opens a day when a cell is chosen (FR-1113)", () => {
    const { onOpenDay } = renderBody([]);
    fireEvent.click(screen.getByRole("button", { name: "Open 2026-09-15" }));
    expect(onOpenDay).toHaveBeenCalledWith("2026-09-15");
  });

  it("opens an event through a TARGET, not a lookup the week's window could not answer", () => {
    const { onOpenTarget } = renderBody([eventOn("Dentist", "2026-09-15", 14)]);
    fireEvent.click(screen.getByRole("button", { name: /Dentist/ }));

    expect(onOpenTarget).toHaveBeenCalledTimes(1);
    expect(onOpenTarget.mock.calls[0][0]).toMatchObject({
      event: { id: "Dentist" },
      occurrence: { occurrenceDate: "2026-09-15" },
    });
  });

  it("opens the day's full list from a cell's overflow, and closes it again", () => {
    const four = [14, 15, 16, 17].map((hour) => eventOn(`e${hour}`, "2026-09-15", hour));
    renderBody(four);

    fireEvent.click(screen.getByRole("button", { name: /more on 2026-09-15/ }));
    const list = screen.getByRole("dialog");
    expect(list).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
