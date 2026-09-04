import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeContext, withFamily } from "../../../components/__tests__/family-test-utils";
import { WeekView } from "../WeekView";

// The write surface's actions reach the server-only admin client; nothing
// here writes, so the module is stubbed at the boundary.
vi.mock("@/lib/family/actions/events", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

/**
 * T033 — the orchestrator's week navigation (FR-281, Contradiction 1): the
 * ‹ / Today / › pill cluster steps a WHOLE anchored week per press whatever
 * the column count, and Today returns to the live week's slice containing
 * today. Placement, colours and scrolling are verified by running the app
 * (T035) — these tests pin the state wiring the pills drive.
 *
 * The clock: Wednesday 2026-09-02 13:00 in America/Chicago (the test-utils
 * household zone) is 2026-09-02T18:00:00Z, so the current Sunday-start week
 * begins 2026-08-30. jsdom measures nothing, so the grid renders its
 * pre-measurement seven columns — the full week as one slice.
 */

const INITIAL_WEEK = "2026-08-30";

function renderWeek() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      {withFamily(
        makeContext(),
        <WeekView initialWeekStart={INITIAL_WEEK} initialEvents={[]} />,
      )}
    </QueryClientProvider>,
  );
}

async function press(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("WeekView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T18:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the previous / Today / next pill cluster (FR-281)", () => {
    renderWeek();

    expect(screen.getByRole("button", { name: "Previous week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeInTheDocument();
  });

  it("steps a whole anchored week per arrow press", async () => {
    renderWeek();
    // Aug 31 sits only in the initial week's header.
    expect(screen.getByText("31")).toBeInTheDocument();

    await press("Next week");
    expect(screen.queryByText("31")).not.toBeInTheDocument();
    // The next Sunday-start week runs Sep 6–12.
    expect(screen.getByText("12")).toBeInTheDocument();

    await press("Previous week");
    expect(screen.getByText("31")).toBeInTheDocument();
  });

  it("Today returns to the live week with today badged", async () => {
    renderWeek();
    await press("Next week");
    expect(screen.queryByText("31")).not.toBeInTheDocument();

    await press("Today");

    expect(screen.getByText("31")).toBeInTheDocument();
    const todayCell = document.querySelector('[aria-current="date"]');
    expect(todayCell?.textContent).toContain("Wed");
    expect(todayCell?.textContent).toContain("2");
  });
});
