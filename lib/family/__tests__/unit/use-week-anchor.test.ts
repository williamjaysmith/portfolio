import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWeekAnchor } from "@/app/family/(app)/calendar/components/useWeekAnchor";
import type { UseWeekAnchorOptions } from "@/app/family/(app)/calendar/components/useWeekAnchor";

/**
 * FR-210 / R210: the displayed week is a `{today | pinned}` anchor DERIVED
 * from Phase 1's minute-resolution clock store in the HOUSEHOLD's zone. While
 * `today`, midnight rolls the marker and — at a week boundary — the week, by
 * derivation alone; a pinned week renders nothing that depends on `now`, so
 * midnight cannot touch it. Today (FR-281) returns to the live anchor and the
 * slice of the current week containing today (FR-289).
 *
 * The clock: Saturday 2026-09-05 23:59 in America/Chicago (CDT, UTC-5) is
 * 2026-09-06T04:59:00Z — the UTC calendar is already on Sunday, so any
 * derivation that ignores the household zone rolls a day early. One minute
 * later the household crosses midnight AND a Sunday-start week boundary.
 */

const BEFORE_MIDNIGHT = new Date("2026-09-06T04:59:00Z"); // Sat 23:59 Chicago
const AFTER_MIDNIGHT = new Date("2026-09-06T05:00:30Z"); // Sun 00:00 Chicago

const CHICAGO: UseWeekAnchorOptions = {
  zone: "America/Chicago",
  startWeekOn: 0,
  columns: 7,
  initialWeekStart: "2026-08-30",
};

/** Cross the household midnight: move the mocked clock, let the store tick. */
async function rollPastMidnight(): Promise<void> {
  vi.setSystemTime(AFTER_MIDNIGHT);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
}

describe("useWeekAnchor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_MIDNIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives the week from the household zone, not UTC", () => {
    const { result } = renderHook(() => useWeekAnchor(CHICAGO));

    expect(result.current.anchor.kind).toBe("today");
    expect(result.current.todayDate).toBe("2026-09-05");
    expect(result.current.weekStart).toBe("2026-08-30");
  });

  it("derives the week from the household zone, not the device's", () => {
    // Tokyo (UTC+9) is already Sunday afternoon at the same instant — a
    // device-local reading cannot satisfy both this test and the one above.
    const { result } = renderHook(() =>
      useWeekAnchor({ ...CHICAGO, zone: "Asia/Tokyo", initialWeekStart: "2026-09-06" }),
    );

    expect(result.current.todayDate).toBe("2026-09-06");
    expect(result.current.weekStart).toBe("2026-09-06");
  });

  it("rolls today and the week over at the household midnight, no reload", async () => {
    const { result } = renderHook(() => useWeekAnchor(CHICAGO));
    expect(result.current.weekStart).toBe("2026-08-30");

    await rollPastMidnight();

    expect(result.current.todayDate).toBe("2026-09-06");
    expect(result.current.weekStart).toBe("2026-09-06");
    expect(result.current.anchor.kind).toBe("today");
  });

  it("leaves a pinned week untouched by midnight — nothing pinned derives from now", async () => {
    const { result } = renderHook(() => useWeekAnchor(CHICAGO));

    act(() => result.current.goToPreviousWeek());
    expect(result.current.anchor).toEqual({ kind: "pinned", weekStart: "2026-08-23" });
    const pinned = result.current.anchor;

    await rollPastMidnight();

    expect(result.current.weekStart).toBe("2026-08-23");
    // Type-level property, not a timing accident: the anchor object itself
    // never changed, so no render of the pinned week saw the clock.
    expect(result.current.anchor).toBe(pinned);
  });

  it("steps whole anchored weeks with the arrows, pinning each", () => {
    const { result } = renderHook(() => useWeekAnchor(CHICAGO));

    act(() => result.current.goToNextWeek());
    expect(result.current.anchor).toEqual({ kind: "pinned", weekStart: "2026-09-06" });

    act(() => result.current.goToNextWeek());
    expect(result.current.weekStart).toBe("2026-09-13");
  });

  it("resets to today and the slice containing today", () => {
    // Three columns tile a Sunday-start week as [0,3,4]; Saturday (offset 6)
    // lives only in the pulled-back last slice, index 2 (FR-289).
    const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns: 3 }));

    act(() => result.current.pinWeek("2026-10-04", 0));
    expect(result.current.weekStart).toBe("2026-10-04");
    expect(result.current.sliceIndex).toBe(0);

    act(() => result.current.goToToday());

    expect(result.current.anchor.kind).toBe("today");
    expect(result.current.weekStart).toBe("2026-08-30");
    expect(result.current.todayDate).toBe("2026-09-05");
    expect(result.current.sliceIndex).toBe(2);
  });

  it("resolves an ambiguous today-slice to the first match", () => {
    // Friday (offset 5) sits in both [3..5] and the pulled-back [4..6];
    // R211 says the first match wins — index 1.
    vi.setSystemTime(new Date("2026-09-05T04:59:00Z")); // Fri 23:59 Chicago
    const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns: 3 }));

    expect(result.current.todayDate).toBe("2026-09-04");
    expect(result.current.sliceIndex).toBe(1);
  });

  it("starts on the slice containing today", () => {
    const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns: 3 }));

    expect(result.current.sliceIndex).toBe(2);
    expect(result.current.sliceCount).toBe(3);
  });

  it("keeps a same-week slice choice unpinned, and keeps it across midnight", async () => {
    const { result } = renderHook(() => useWeekAnchor({ ...CHICAGO, columns: 3 }));

    act(() => result.current.setSliceIndex(0));
    expect(result.current.anchor.kind).toBe("today");
    expect(result.current.sliceIndex).toBe(0);

    await rollPastMidnight();

    // The week rolled (still the live anchor) but the chosen slice was the
    // user's navigation — it is not yanked back to today's slice.
    expect(result.current.weekStart).toBe("2026-09-06");
    expect(result.current.sliceIndex).toBe(0);
  });

  it("clamps the slice when the column count changes", () => {
    const { result, rerender } = renderHook(
      (options: UseWeekAnchorOptions) => useWeekAnchor(options),
      { initialProps: { ...CHICAGO, columns: 3 } },
    );

    act(() => result.current.setSliceIndex(2));
    expect(result.current.sliceIndex).toBe(2);

    rerender({ ...CHICAGO, columns: 7 });

    expect(result.current.sliceCount).toBe(1);
    expect(result.current.sliceIndex).toBe(0);
  });

  it("adds no timers of its own — only the shared clock store ticks (R210)", () => {
    renderHook(() => useWeekAnchor(CHICAGO));

    expect(vi.getTimerCount()).toBe(1);
  });
});
