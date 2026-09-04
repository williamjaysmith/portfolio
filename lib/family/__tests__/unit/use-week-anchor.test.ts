import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWeekAnchor } from "@/app/family/(app)/calendar/components/useWeekAnchor";
import type { UseWeekAnchorOptions } from "@/app/family/(app)/calendar/components/useWeekAnchor";
import { addDays, diffDays } from "@/lib/family/calendar/dates";

/**
 * FR-210 / R210: the displayed window is a `{today | pinned}` anchor DERIVED
 * from Phase 1's minute-resolution clock store in the HOUSEHOLD's zone. While
 * `today`, midnight rolls the marker and the window by derivation alone; a
 * pinned window renders nothing that depends on `now`, so midnight cannot
 * touch it. Today (FR-281) returns to the live anchor, which begins on today.
 *
 * The paging rule this file exists to protect: ONE page moves the anchor by
 * exactly the number of columns on show. Three columns step three days, seven
 * step seven — so consecutive pages abut, nothing is skipped between them and
 * nothing is shown twice. (Before this, the arrows always stepped seven days
 * and a three-column phone never saw four days out of every seven.)
 *
 * The clock: Saturday 2026-09-05 23:59 in America/Chicago (CDT, UTC-5) is
 * 2026-09-06T04:59:00Z — the UTC calendar is already on Sunday, so any
 * derivation that ignores the household zone rolls a day early. One minute
 * later the household crosses midnight.
 */

const BEFORE_MIDNIGHT = new Date("2026-09-06T04:59:00Z"); // Sat 23:59 Chicago
const AFTER_MIDNIGHT = new Date("2026-09-06T05:00:30Z"); // Sun 00:00 Chicago

const CHICAGO: UseWeekAnchorOptions = {
  zone: "America/Chicago",
  startWeekOn: 0,
  columns: 7,
  initialAnchorDate: "2026-08-30",
};

/** Cross the household midnight: move the mocked clock, let the store tick. */
async function rollPastMidnight(): Promise<void> {
  vi.setSystemTime(AFTER_MIDNIGHT);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
}

/** The days a window of `columns` starting at `anchorDate` puts on screen. */
function visibleDates(anchorDate: string, columns: number): string[] {
  return Array.from({ length: columns }, (_, day) => addDays(anchorDate, day));
}

describe("useWeekAnchor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_MIDNIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives the window from the household zone, not UTC", () => {
    const { result } = renderHook(() => useWeekAnchor(CHICAGO));

    expect(result.current.anchor.kind).toBe("today");
    expect(result.current.todayDate).toBe("2026-09-05");
    // START_ON_CURRENT_DAY: the window anchors ON today, not the preceding
    // Sunday — the household-zone read is still what decides WHICH date that
    // is, which is what this test protects.
    expect(result.current.anchorDate).toBe("2026-09-05");
  });

  it("derives the window from the household zone, not the device's", () => {
    // Tokyo (UTC+9) is already Sunday afternoon at the same instant — a
    // device-local reading cannot satisfy both this test and the one above.
    const { result } = renderHook(() =>
      useWeekAnchor({ ...CHICAGO, zone: "Asia/Tokyo", initialAnchorDate: "2026-09-06" }),
    );

    expect(result.current.todayDate).toBe("2026-09-06");
    expect(result.current.anchorDate).toBe("2026-09-06");
  });

  it("rolls today and the window over at the household midnight, no reload", async () => {
    const { result } = renderHook(() => useWeekAnchor(CHICAGO));
    expect(result.current.anchorDate).toBe("2026-09-05");

    await rollPastMidnight();

    expect(result.current.todayDate).toBe("2026-09-06");
    expect(result.current.anchorDate).toBe("2026-09-06");
    expect(result.current.anchor.kind).toBe("today");
  });

  it("leaves a pinned window untouched by midnight — nothing pinned derives from now", async () => {
    const { result } = renderHook(() => useWeekAnchor(CHICAGO));

    // Today anchors at "2026-09-05"; one page back at seven columns is
    // exactly seven days earlier.
    act(() => result.current.page(-1));
    expect(result.current.anchor).toEqual({ kind: "pinned", date: "2026-08-29" });
    const pinned = result.current.anchor;

    await rollPastMidnight();

    expect(result.current.anchorDate).toBe("2026-08-29");
    // Type-level property, not a timing accident: the anchor object itself
    // never changed, so no render of the pinned window saw the clock.
    expect(result.current.anchor).toBe(pinned);
  });

  it("steps exactly `columns` days per page, at three, five and seven columns", () => {
    for (const columns of [3, 5, 7]) {
      const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns }));
      expect(result.current.anchorDate).toBe("2026-09-05");

      act(() => result.current.page(1));
      expect(result.current.anchorDate).toBe(addDays("2026-09-05", columns));

      act(() => result.current.page(1));
      expect(result.current.anchorDate).toBe(addDays("2026-09-05", 2 * columns));

      act(() => result.current.page(-1));
      expect(result.current.anchorDate).toBe(addDays("2026-09-05", columns));
    }
  });

  it("skips no day and repeats none across consecutive pages, at every column count", () => {
    // The bug, stated as a property: on a phone the old seven-day step left
    // Monday–Thursday unreachable, and the pulled-back last slice showed two
    // days a second time. Walking four pages must lay the days end to end.
    for (const columns of [3, 5, 7]) {
      const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns }));
      const seen: string[] = [];

      for (let step = 0; step < 4; step += 1) {
        seen.push(...visibleDates(result.current.anchorDate, columns));
        act(() => result.current.page(1));
      }

      expect(new Set(seen).size).toBe(seen.length); // nothing shown twice
      for (let day = 1; day < seen.length; day += 1) {
        expect(diffDays(seen[day - 1], seen[day])).toBe(1); // nothing skipped
      }
    }
  });

  it("walks back through exactly the days it walked forward over", () => {
    const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns: 3 }));
    const start = result.current.anchorDate;

    act(() => result.current.page(1));
    act(() => result.current.page(1));
    act(() => result.current.page(-1));
    act(() => result.current.page(-1));

    expect(result.current.anchorDate).toBe(start);
  });

  it("keeps the anchored first day when the column count changes", () => {
    // A rotation changes how MANY days are shown, never which day the window
    // begins on — the window grows to the right and the next page steps by
    // the new count.
    const { result, rerender } = renderHook(
      (options: UseWeekAnchorOptions) => useWeekAnchor(options),
      { initialProps: { ...CHICAGO, columns: 3 } },
    );

    act(() => result.current.page(1));
    expect(result.current.anchorDate).toBe("2026-09-08");

    rerender({ ...CHICAGO, columns: 7 });
    expect(result.current.anchorDate).toBe("2026-09-08");

    act(() => result.current.page(1));
    expect(result.current.anchorDate).toBe("2026-09-15");
  });

  it("returns to today, live again, from anywhere", () => {
    const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns: 3 }));

    act(() => result.current.page(1));
    act(() => result.current.page(1));
    expect(result.current.anchor.kind).toBe("pinned");

    act(() => result.current.goToToday());

    expect(result.current.anchor.kind).toBe("today");
    expect(result.current.anchorDate).toBe("2026-09-05");
    expect(result.current.todayDate).toBe("2026-09-05");
  });

  it("anchors the window on today itself, so today is always the leftmost column", () => {
    // The direct assertion of the toggle's own contract (dates.ts):
    // `weekAnchorOf` returns the date unchanged, so the window is
    // `[today, today+1, …]` and today sits at offset 0 no matter which weekday
    // it falls on — unlike the old Sunday-start anchor.
    const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns: 3 }));

    expect(result.current.todayDate).toBe("2026-09-05"); // Saturday
    expect(result.current.anchorDate).toBe(result.current.todayDate);
  });

  it("adds no timers of its own — only the shared clock store ticks (R210)", () => {
    renderHook(() => useWeekAnchor(CHICAGO));

    expect(vi.getTimerCount()).toBe(1);
  });
});
