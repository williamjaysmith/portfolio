import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMealWindow } from "../useMealWindow";

/**
 * 013 T006 — the Meals grid's window as the board holds it.
 *
 * The pure arithmetic is proved next door (`lib/family/__tests__/unit/
 * meals-window.test.ts`). What can only be checked HERE is the state: that the
 * anchor is **initialised** from today and then **held**, which is 006's
 * midnight rule and the subtlest thing in the phase.
 *
 * **No browser test can check that rule.** The e2e clock helper refuses jumps
 * over three hours, because the session token is minted on the real clock (009's
 * finding). So a hook test moving a mocked clock past midnight is the only place
 * the guarantee exists, and if it is deleted the guarantee goes with it silently.
 *
 * The distinction it protects is one line of code and invisible otherwise: an
 * anchor *derived* from today re-anchors the window under somebody who is
 * mid-plan at midnight; an anchor *initialised* to today and then held does not.
 */

const ZONE = "America/Chicago";
/** A Thursday. 18:00 UTC is midday on the Chicago wall clock. */
const THURSDAY_MIDDAY = Date.parse("2026-09-10T18:00:00Z");
const THURSDAY = "2026-09-10";

function renderWindow(columns: number, initialToday = THURSDAY) {
  return renderHook(() => useMealWindow({ zone: ZONE, initialToday, columns }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(THURSDAY_MIDDAY));
});

describe("what it shows", () => {
  it("shows as many days as columns were measured, beginning on today", () => {
    const { result } = renderWindow(2);

    expect(result.current.dates).toEqual(["2026-09-10", "2026-09-11"]);
    expect(result.current.todayDate).toBe(THURSDAY);
  });

  it("begins on today at every width — the household's start-of-week no longer decides", () => {
    // The defect this phase fixes began here: the grid opened on the week's
    // first day, so a two-column phone opened on Sunday and Monday.
    for (const columns of [1, 2, 5, 7]) {
      const { result } = renderWindow(columns);
      expect(result.current.dates[0], `${columns} columns`).toBe(THURSDAY);
      expect(result.current.dates).toHaveLength(columns);
    }
  });

  it("names the days it shows", () => {
    expect(renderWindow(2).result.current.label).toBe("10–11 September");
    expect(renderWindow(7).result.current.label).toBe("10–16 September");
  });
});

describe("paging", () => {
  it("moves by exactly the width on show", () => {
    const { result } = renderWindow(2);

    act(() => result.current.page(1));
    expect(result.current.dates).toEqual(["2026-09-12", "2026-09-13"]);

    act(() => result.current.page(-1));
    expect(result.current.dates).toEqual(["2026-09-10", "2026-09-11"]);
  });

  it("moves seven days at seven columns — US2's wall tablet, with no special case", () => {
    const { result } = renderWindow(7);

    act(() => result.current.page(1));
    expect(result.current.dates[0]).toBe("2026-09-17");
  });

  it("moves one day at one column", () => {
    const { result } = renderWindow(1);

    act(() => result.current.page(1));
    expect(result.current.dates).toEqual(["2026-09-11"]);
  });

  it("returns to today, and says when it is already there", () => {
    const { result } = renderWindow(2);
    expect(result.current.isLiveWindow).toBe(true);

    act(() => result.current.page(1));
    expect(result.current.isLiveWindow).toBe(false);

    act(() => result.current.today());
    expect(result.current.dates[0]).toBe(THURSDAY);
    expect(result.current.isLiveWindow).toBe(true);
  });
});

describe("the midnight rule (FR-1308, 006's) — unprovable in a browser", () => {
  it("moves today's marker at midnight and leaves the window where it was put", () => {
    const { result, rerender } = renderWindow(2);
    expect(result.current.todayDate).toBe(THURSDAY);
    expect(result.current.dates).toEqual(["2026-09-10", "2026-09-11"]);

    // Past midnight, Chicago time. 2026-09-11T06:00Z is 01:00 on the 11th.
    // The shell's clock is a module-level store on a one-second interval, so
    // moving the system time is not enough — it has to be allowed to tick. That
    // is deliberate here: this exercises the real store the app uses rather than
    // a mock of it, so the rule is proved against the clock that ships.
    act(() => {
      vi.setSystemTime(new Date(Date.parse("2026-09-11T06:00:00Z")));
      vi.advanceTimersByTime(1_000);
    });
    rerender();

    // The marker followed the clock…
    expect(result.current.todayDate).toBe("2026-09-11");
    // …and the window did NOT. Somebody mid-plan is not re-anchored under.
    expect(result.current.dates).toEqual(["2026-09-10", "2026-09-11"]);
    // It is no longer the live window, so Today has something to do again.
    expect(result.current.isLiveWindow).toBe(false);
  });

  it("re-anchors on the NEW today when Today is used after midnight", () => {
    const { result, rerender } = renderWindow(2);
    act(() => {
      vi.setSystemTime(new Date(Date.parse("2026-09-11T06:00:00Z")));
      vi.advanceTimersByTime(1_000);
    });
    rerender();

    act(() => result.current.today());
    expect(result.current.dates).toEqual(["2026-09-11", "2026-09-12"]);
  });
});

describe("a width that changes under it", () => {
  it("keeps the day it begins on when a rotation changes how many fit", () => {
    // Edge case from the spec: the window's width changes; the day it starts on
    // must not jump about as a side effect.
    const { result, rerender } = renderHook(
      ({ columns }) => useMealWindow({ zone: ZONE, initialToday: THURSDAY, columns }),
      { initialProps: { columns: 2 } },
    );
    act(() => result.current.page(1));
    expect(result.current.dates[0]).toBe("2026-09-12");

    rerender({ columns: 5 });

    expect(result.current.dates[0]).toBe("2026-09-12");
    expect(result.current.dates).toHaveLength(5);
  });
});
