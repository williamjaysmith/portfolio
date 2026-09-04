import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_COLUMN_COUNT } from "@/lib/family/week-geometry";

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
 * The pager is replaced by its SEAM — a control that asks for one page later,
 * exactly as a released swipe does. framer's pan needs real animation frames
 * and this file runs on a mocked clock; what a gesture means (left = one page
 * later, once per gesture, never from a block) is settled against real pointer
 * events in `WeekPager.test.tsx`. What is proved here is the other half: the
 * swipe's step and the arrow's are the same step.
 */
vi.mock("../WeekPager", () => ({
  WeekPager: ({ onPage, children }: { onPage: (d: -1 | 1) => void; children: ReactNode }) => (
    <div data-testid="pager">
      <button type="button" onClick={() => onPage(1)}>
        swipe left
      </button>
      {children}
    </div>
  ),
}));

/**
 * T033 — the orchestrator's navigation (FR-281, Contradiction 1): the
 * ‹ / Today / › pill cluster and the swipe move the view by ONE PAGE, which is
 * however many day columns are on show, and Today returns to the live window
 * that begins on today.
 *
 * This is the file that pins the bug the rolling window fixed: the arrows used
 * to step a fixed seven days whatever the column count, so a three-column phone
 * jumped over four days it could never reach. jsdom measures nothing, so the
 * grid here renders its pre-measurement `DEFAULT_COLUMN_COUNT` columns and one
 * page is that many days — the phone's three-column case is proved on the pure
 * anchor (`use-week-anchor.test.ts`), where the column count can be injected.
 *
 * The clock: Wednesday 2026-09-02 13:00 in America/Chicago (the test-utils
 * household zone) is 2026-09-02T18:00:00Z, so the live window begins ON that
 * date and runs 2026-09-02..2026-09-08. `INITIAL_ANCHOR` below is deliberately
 * a DIFFERENT, stale date — it stands in for a server render from an earlier
 * request, and its day numbers must NOT appear once the client clock has ticked
 * (which, with `useNow`'s synchronous first snapshot, is before this
 * component's first paint in these tests) — proving the live, today-anchored
 * window drives the render rather than the prop.
 */

const INITIAL_ANCHOR = "2026-08-30";
const PAGE_LABEL = { next: `Next ${DEFAULT_COLUMN_COUNT} days`, previous: `Previous ${DEFAULT_COLUMN_COUNT} days` };

function renderWeek() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      {withFamily(
        makeContext(),
        <WeekView initialAnchorDate={INITIAL_ANCHOR} initialEvents={[]} />,
      )}
    </QueryClientProvider>,
  );
}

async function press(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/**
 * The day-header line's cells, e.g. `["Wed2", "Thu3", …]` — the rendered dates
 * as the household sees them. It is the first `.grid` in the strip; its leading
 * cell is the hour-gutter spacer, which is `aria-hidden` and dropped here.
 */
function headerDays(): string[] {
  const header = document.querySelector("div.grid");
  if (header === null) throw new Error("the week header did not render");
  return Array.from(header.children)
    .filter((cell) => cell.getAttribute("aria-hidden") !== "true")
    .map((cell) => cell.textContent ?? "");
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

    // The arrows say how far they go, because that now depends on the device.
    expect(screen.getByRole("button", { name: PAGE_LABEL.previous })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: PAGE_LABEL.next })).toBeInTheDocument();
  });

  it("steps exactly one page per arrow press", async () => {
    renderWeek();
    // The live window is Sep 2–8; Sep 8 sits only in this page's header.
    expect(headerDays()).toHaveLength(DEFAULT_COLUMN_COUNT);
    expect(screen.getByText("8")).toBeInTheDocument();

    await press(PAGE_LABEL.next);
    expect(screen.queryByText("8")).not.toBeInTheDocument();
    // Exactly one page later: Sep 9–15.
    expect(screen.getByText("15")).toBeInTheDocument();

    await press(PAGE_LABEL.previous);
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("leaves no day between one page and the next, and repeats none", async () => {
    renderWeek();
    const first = headerDays();

    await press(PAGE_LABEL.next);
    const second = headerDays();

    // Sep 2–8 then Sep 9–15: the pages abut, so nothing is unreachable and
    // nothing is drawn twice.
    expect(first).toEqual(["Wed2", "Thu3", "Fri4", "Sat5", "Sun6", "Mon7", "Tue8"]);
    expect(second).toEqual(["Wed9", "Thu10", "Fri11", "Sat12", "Sun13", "Mon14", "Tue15"]);
    expect(first.filter((day) => second.includes(day))).toEqual([]);
  });

  it("moves a swipe and an arrow press the same distance (FR-279/281)", async () => {
    renderWeek();
    const home = headerDays();

    await press(PAGE_LABEL.next);
    const byArrow = headerDays();
    expect(byArrow).not.toEqual(home);

    await press("Today");
    expect(headerDays()).toEqual(home);

    await press("swipe left"); // the pager's one-page-later step

    expect(headerDays()).toEqual(byArrow);
  });

  it("pages the whole strip together — headers, band and grid (FR-279)", () => {
    renderWeek();

    // The day header is INSIDE the pager, so a swipe carries the dates, the
    // all-day band and the hour grid as one thing.
    const pager = screen.getByTestId("pager");
    expect(within(pager).getByText("Wed")).toBeInTheDocument();
  });

  it("Today returns to the live window with today badged", async () => {
    renderWeek();
    await press(PAGE_LABEL.next);
    expect(screen.queryByText("8")).not.toBeInTheDocument();

    await press("Today");

    expect(screen.getByText("8")).toBeInTheDocument();
    const todayCell = document.querySelector('[aria-current="date"]');
    expect(todayCell?.textContent).toContain("Wed");
    expect(todayCell?.textContent).toContain("2");
  });
});
