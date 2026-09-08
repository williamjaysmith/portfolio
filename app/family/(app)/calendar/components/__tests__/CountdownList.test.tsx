import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CountdownStatus } from "@/lib/family/countdowns/target";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { CountdownList } from "../CountdownList";

/**
 * 009 T032 / FR-909. Tapping the bar opens "a full list of all active
 * countdowns" [VERIFIED](40459070511515) — the point being that the rotation
 * hides some, so the list must show every one.
 */

stubDialog();

function statusFor(summary: string, days: number): CountdownStatus {
  return {
    eventId: `event-${summary}`,
    summary,
    targetDate: "2026-09-20",
    days,
    state: days > 0 ? "upcoming" : days === 0 ? "today" : "past",
  };
}

function renderList(countdowns: CountdownStatus[]) {
  const onOpen = vi.fn();
  const onClose = vi.fn();
  render(<CountdownList countdowns={countdowns} onOpen={onOpen} onClose={onClose} />);
  return { onOpen, onClose };
}

describe("CountdownList", () => {
  it("lists EVERY active countdown, not only the ones the bar could fit", () => {
    renderList([
      statusFor("Vacation", 13),
      statusFor("Dentist", 1),
      statusFor("Birthday", 0),
      statusFor("Christmas", 109),
    ]);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    for (const name of ["Vacation", "Dentist", "Birthday", "Christmas"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("keeps the bar's order — soonest first, not re-sorted here", () => {
    renderList([statusFor("Dentist", 1), statusFor("Vacation", 13), statusFor("Christmas", 109)]);
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent ?? "");
    expect(rows[0]).toContain("Dentist");
    expect(rows[2]).toContain("Christmas");
  });

  it("says how far away each one is, in the same words as the chip", () => {
    renderList([statusFor("Dentist", 1), statusFor("Birthday", 0)]);
    expect(screen.getByText("1 day")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("reports the countdown a row opens", () => {
    const { onOpen } = renderList([statusFor("Vacation", 13), statusFor("Dentist", 1)]);
    fireEvent.click(screen.getByRole("button", { name: /Dentist/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0]).toMatchObject({ summary: "Dentist" });
  });

  it("says so plainly rather than showing an empty box", () => {
    renderList([]);
    expect(screen.getByText("Nothing to count down to yet.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("closes on its own control", () => {
    const { onClose } = renderList([statusFor("Vacation", 13)]);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
