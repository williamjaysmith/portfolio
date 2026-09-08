/**
 * 008 T035: the calendar opens on the day a reminder points at (R815, FR-816).
 *
 * A banner links to `/family/calendar?on=YYYY-MM-DD`, and the anchor is seeded
 * from that parameter ONCE, in the state initialiser. Reading it on every
 * render would fight the pager — a person who arrived from a banner must be
 * able to page away from the day it sent them to, and the parameter is still
 * sitting in the URL while they do.
 *
 * The value comes off a URL, so it is checked for being a real date and not
 * merely a date-shaped string.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let params: URLSearchParams | null = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
}));

const { useWeekAnchor } = await import("../useWeekAnchor");
const { addDays } = await import("@/lib/family/calendar/dates");
const { addMonths } = await import("@/lib/family/calendar/views");

const ZONE = "America/Chicago";

function Probe({ view }: { view?: "day" | "week" | "month" } = {}) {
  const anchor = useWeekAnchor({
    zone: ZONE,
    startWeekOn: 0,
    columns: 7,
    initialAnchorDate: "2026-09-06",
    view,
  });
  return (
    <div>
      <span data-testid="anchor">{anchor.anchorDate}</span>
      <button type="button" onClick={() => anchor.page(1)}>
        Next
      </button>
      <button type="button" onClick={anchor.goToToday}>
        Today
      </button>
      <button type="button" onClick={() => anchor.openAt("2026-11-19")}>
        Open at
      </button>
    </div>
  );
}

function anchorDate(): string {
  return screen.getByTestId("anchor").textContent ?? "";
}

beforeEach(() => {
  params = new URLSearchParams();
  vi.useRealTimers();
});

/**
 * 009 T047 — `openAt(date)` (FR-909, FR-916, R909).
 *
 * The countdown list and the search both know which day they want and are
 * already on this tab, so they move the anchor in place. Distinct from `?on=`
 * above, which is 008's cross-ROUTE seed read once on mount: this one is called
 * repeatedly, and paging away from it must still work.
 */
/**
 * 011 R1106 — the anchor's TYPE, its `?on=` seed and `openAt` are identical
 * across views; only the STEP differs. These cases pin that the week's own
 * step is unchanged and that the other two move in their own units.
 */
describe("the paging step is the view's (011)", () => {
  /**
   * The live anchor begins on the household's TODAY, not on the seeded date —
   * `initialAnchorDate` is only what shows before the clock publishes. So each
   * case reads where it started and asserts the STEP, which is what R1106 is
   * about and what stays true on every day this suite is ever run.
   */
  function step(view?: "day" | "week" | "month"): { from: string; to: string } {
    const view_ = view === undefined ? <Probe /> : <Probe view={view} />;
    const rendered = render(view_);
    const from = anchorDate();
    act(() => screen.getByRole("button", { name: "Next" }).click());
    const to = anchorDate();
    rendered.unmount();
    return { from, to };
  }

  it("steps a week by its column count, exactly as it always did", () => {
    const { from, to } = step("week");
    expect(addDays(from, 7)).toBe(to);
  });

  it("steps a day by one day", () => {
    const { from, to } = step("day");
    expect(addDays(from, 1)).toBe(to);
  });

  it("steps a month by a calendar month, not by a day count", () => {
    const { from, to } = step("month");
    // `addMonths` itself is walked across all twelve months, both year
    // boundaries and a leap February in calendar-month.test.ts. What THIS case
    // proves is only that the month view's step goes through it — a day count
    // would agree by luck in some months (September has exactly 30) and be
    // wrong in others, so asserting a number here would be a flaky test.
    expect(addMonths(from, 1)).toBe(to);
  });

  it("defaults to the week's step when no view is given, so shipped callers are unchanged", () => {
    const { from, to } = step();
    expect(addDays(from, 7)).toBe(to);
  });
});

describe("openAt", () => {
  it("pins the window to the day it names", () => {
    render(<Probe />);
    act(() => screen.getByRole("button", { name: "Open at" }).click());
    expect(anchorDate()).toBe("2026-11-19");
  });

  it("does not trap the pager — the window steps on from there", () => {
    render(<Probe />);
    act(() => screen.getByRole("button", { name: "Open at" }).click());
    act(() => screen.getByRole("button", { name: "Next" }).click());
    expect(anchorDate()).toBe("2026-11-26");
  });

  it("gives Today back after it", () => {
    render(<Probe />);
    act(() => screen.getByRole("button", { name: "Open at" }).click());
    expect(anchorDate()).toBe("2026-11-19");

    act(() => screen.getByRole("button", { name: "Today" }).click());
    expect(anchorDate()).not.toBe("2026-11-19");
  });

  it("wins over a ?on= the household has already paged away from", () => {
    params = new URLSearchParams("on=2026-10-01");
    render(<Probe />);
    expect(anchorDate()).toBe("2026-10-01");

    act(() => screen.getByRole("button", { name: "Open at" }).click());
    expect(anchorDate()).toBe("2026-11-19");
  });
});

describe("?on=", () => {
  it("opens on the day it names", () => {
    params = new URLSearchParams("on=2026-11-19");
    render(<Probe />);
    expect(anchorDate()).toBe("2026-11-19");
  });

  it("is ignored when it is not there", () => {
    render(<Probe />);
    // No parameter: the live window, which begins on the server's date until
    // the client clock publishes.
    expect(anchorDate()).not.toBe("2026-11-19");
  });

  it("is ignored when it is not a date", () => {
    for (const value of ["tomorrow", "2026-13-01", "2026-02-31", "20261119", ""]) {
      params = new URLSearchParams(`on=${value}`);
      const view = render(<Probe />);
      expect(anchorDate(), value).not.toBe(value);
      view.unmount();
    }
  });

  it("is read once, and does not fight the pager", () => {
    params = new URLSearchParams("on=2026-11-19");
    render(<Probe />);
    expect(anchorDate()).toBe("2026-11-19");

    act(() => screen.getByRole("button", { name: "Next" }).click());
    expect(anchorDate()).toBe("2026-11-26");

    // The parameter is still in the URL, and a re-render must not pull the
    // window back to it.
    act(() => screen.getByRole("button", { name: "Next" }).click());
    expect(anchorDate()).toBe("2026-12-03");
  });

  it("lets Today win over it, because a person asked", () => {
    params = new URLSearchParams("on=2026-11-19");
    render(<Probe />);
    act(() => screen.getByRole("button", { name: "Today" }).click());
    expect(anchorDate()).not.toBe("2026-11-19");
  });

  it("survives having no router at all", () => {
    params = null;
    expect(() => render(<Probe />)).not.toThrow();
  });
});
