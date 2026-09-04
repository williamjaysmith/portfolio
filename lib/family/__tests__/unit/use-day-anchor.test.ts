import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDayAnchor } from "@/app/family/(app)/tasks/components/useDayAnchor";
import type { UseDayAnchorOptions } from "@/app/family/(app)/tasks/components/useDayAnchor";

/**
 * FR-315 / R322: the displayed day is a `{today | pinned}` anchor DERIVED from
 * Phase 1's minute-resolution clock store, read in the HOUSEHOLD's zone. While
 * `today`, midnight rolls the displayed day, the carry key and everything the
 * counters are computed from, by derivation alone — no reload, no interaction,
 * and no timer of this hook's own (SC-314). A pinned day renders nothing that
 * depends on `now`, so midnight cannot pull a person away from the day they
 * navigated to. Previous/Next pin an absolute date exactly one day away and
 * Today returns to the live anchor (FR-303).
 *
 * The clock: Saturday 2026-09-05 23:59 in America/Chicago (CDT, UTC-5) is
 * 2026-09-06T04:59:00Z — the UTC calendar is already on Sunday, so any
 * derivation that ignores the household zone rolls a day early. One minute
 * later the household crosses midnight.
 */

const BEFORE_MIDNIGHT = new Date("2026-09-06T04:59:00Z"); // Sat 23:59 Chicago
const AFTER_MIDNIGHT = new Date("2026-09-06T05:00:30Z"); // Sun 00:00 Chicago

const CHICAGO: UseDayAnchorOptions = {
  zone: "America/Chicago",
  initialDate: "2026-09-05",
};

/** Cross the household midnight: move the mocked clock, let the shared store tick. */
async function rollPastMidnight(): Promise<void> {
  vi.setSystemTime(AFTER_MIDNIGHT);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
}

describe("useDayAnchor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_MIDNIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on today, read in the household zone rather than UTC", () => {
    const { result } = renderHook(() => useDayAnchor(CHICAGO));

    expect(result.current.anchor).toEqual({ kind: "today" });
    expect(result.current.todayDate).toBe("2026-09-05");
    expect(result.current.displayedDate).toBe("2026-09-05");
    expect(result.current.isToday).toBe(true);
  });

  it("reads the household zone, not the device's", () => {
    // Tokyo (UTC+9) is already Sunday afternoon at the same instant — a
    // device-local reading cannot satisfy both this test and the one above.
    const { result } = renderHook(() =>
      useDayAnchor({ zone: "Asia/Tokyo", initialDate: "2026-09-06" }),
    );

    expect(result.current.todayDate).toBe("2026-09-06");
    expect(result.current.displayedDate).toBe("2026-09-06");
  });

  it("rolls the displayed day and the carry key at the household midnight, untouched", async () => {
    const { result } = renderHook(() => useDayAnchor(CHICAGO));
    expect(result.current.displayedDate).toBe("2026-09-05");

    await rollPastMidnight();

    // SC-314: nobody interacted; the board is simply on the new day, and
    // `todayDate` — the carry read's key (FR-357) — moved with it.
    expect(result.current.displayedDate).toBe("2026-09-06");
    expect(result.current.todayDate).toBe("2026-09-06");
    expect(result.current.isToday).toBe(true);
    expect(result.current.anchor).toEqual({ kind: "today" });
  });

  it("leaves a pinned day untouched by midnight — nothing pinned derives from now", async () => {
    const { result } = renderHook(() => useDayAnchor(CHICAGO));

    act(() => result.current.step(-1));
    expect(result.current.anchor).toEqual({ kind: "pinned", date: "2026-09-04" });
    const pinned = result.current.anchor;

    await rollPastMidnight();

    expect(result.current.displayedDate).toBe("2026-09-04");
    // A property of the TYPE, not a timing accident: the anchor object itself
    // never changed, so no render of the pinned day ever consulted the clock.
    expect(result.current.anchor).toBe(pinned);
  });

  it("does not pull a person back even when they pinned today's own date", async () => {
    // The sharpest reading of FR-315: Previous then Next lands on today's
    // date but is still navigation. Midnight must not advance it, and the day
    // must stop counting as today — which is exactly what turns the carry
    // read off (FR-357).
    const { result } = renderHook(() => useDayAnchor(CHICAGO));

    act(() => result.current.step(-1));
    act(() => result.current.step(1));
    expect(result.current.anchor).toEqual({ kind: "pinned", date: "2026-09-05" });
    expect(result.current.isToday).toBe(true);

    await rollPastMidnight();

    expect(result.current.displayedDate).toBe("2026-09-05");
    expect(result.current.todayDate).toBe("2026-09-06");
    expect(result.current.isToday).toBe(false);
  });

  it("steps exactly one day per tap, in both directions", () => {
    const { result } = renderHook(() => useDayAnchor(CHICAGO));

    act(() => result.current.step(1));
    expect(result.current.displayedDate).toBe("2026-09-06");
    act(() => result.current.step(1));
    expect(result.current.displayedDate).toBe("2026-09-07");
    act(() => result.current.step(-1));
    expect(result.current.displayedDate).toBe("2026-09-06");
    expect(result.current.isToday).toBe(false);
  });

  it("steps across a month boundary by the calendar, not by arithmetic on the day", () => {
    const { result } = renderHook(() =>
      useDayAnchor({ ...CHICAGO, initialDate: "2026-09-05" }),
    );

    for (let day = 0; day < 26; day += 1) act(() => result.current.step(1));

    expect(result.current.displayedDate).toBe("2026-10-01");
  });

  it("returns to today, live again, from anywhere", async () => {
    const { result } = renderHook(() => useDayAnchor(CHICAGO));

    act(() => result.current.step(-1));
    act(() => result.current.step(-1));
    expect(result.current.anchor.kind).toBe("pinned");

    act(() => result.current.goToToday());
    expect(result.current.anchor).toEqual({ kind: "today" });
    expect(result.current.displayedDate).toBe("2026-09-05");

    // And it is LIVE again, not merely re-pinned to today's date.
    await rollPastMidnight();
    expect(result.current.displayedDate).toBe("2026-09-06");
  });

  it("keeps a stable step and goToToday identity across a clock tick", async () => {
    const { result } = renderHook(() => useDayAnchor(CHICAGO));
    const goToToday = result.current.goToToday;

    await rollPastMidnight();

    expect(result.current.goToToday).toBe(goToToday);
  });

  it("serves the server-rendered date until the client clock publishes (R314)", () => {
    // The server has no clock the client will agree with, so `useNow` renders
    // `null` — the wall tablet's first paint is still the board, on the day
    // the server computed in the household zone, with no loading state.
    function Probe() {
      const { displayedDate, todayDate, isToday } = useDayAnchor(CHICAGO);
      return createElement("output", null, `${displayedDate}|${todayDate}|${isToday}`);
    }

    expect(renderToStaticMarkup(createElement(Probe))).toContain(
      "2026-09-05|2026-09-05|true",
    );
  });

  it("adds no timer of its own — only the shared clock store ticks (R322)", () => {
    renderHook(() => useDayAnchor(CHICAGO));

    expect(vi.getTimerCount()).toBe(1);
  });
});
