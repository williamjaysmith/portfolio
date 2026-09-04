import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Clock, formatDate } from "../Clock";

/**
 * FR-031: the clock stays accurate and the date rolls over at midnight
 * without a reload.
 */
describe("Clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 12-hour time without a leading zero", () => {
    vi.setSystemTime(new Date(2026, 2, 22, 8, 5));
    render(<Clock format="12h" />);
    expect(screen.getByText("8:05 AM")).toBeInTheDocument();
  });

  it("renders 24-hour time zero-padded", () => {
    vi.setSystemTime(new Date(2026, 2, 22, 8, 5));
    render(<Clock format="24h" />);
    expect(screen.getByText("08:05")).toBeInTheDocument();
  });

  it("shows 12 rather than 0 at midnight and noon", () => {
    vi.setSystemTime(new Date(2026, 2, 22, 0, 0));
    const { unmount } = render(<Clock format="12h" />);
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    unmount();

    vi.setSystemTime(new Date(2026, 2, 22, 12, 0));
    render(<Clock format="12h" />);
    expect(screen.getByText("12:00 PM")).toBeInTheDocument();
  });

  it("advances across a minute boundary without a reload", async () => {
    vi.setSystemTime(new Date(2026, 2, 22, 8, 59));
    render(<Clock format="24h" />);
    expect(screen.getByText("08:59")).toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 2, 22, 9, 0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("formats the date the way the top bar shows it", () => {
    expect(formatDate(new Date(2026, 2, 22))).toBe("Sun, Mar 22");
  });
});
