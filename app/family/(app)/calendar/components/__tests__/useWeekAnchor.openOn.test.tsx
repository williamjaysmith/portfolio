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

const ZONE = "America/Chicago";

function Probe() {
  const anchor = useWeekAnchor({
    zone: ZONE,
    startWeekOn: 0,
    columns: 7,
    initialAnchorDate: "2026-09-06",
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
