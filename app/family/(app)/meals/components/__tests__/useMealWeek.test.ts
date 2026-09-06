import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMealWeek } from "../useMealWeek";

/**
 * 006 FR-603 and the spec's midnight edge case: the shown week is held — the
 * marker moves at midnight, the week does not jump on its own, Today brings
 * the new week — and the arrows page by whole weeks from wherever it is.
 */

let now: Date | null = null;
vi.mock("../../../components/Clock", () => ({ useNow: () => now }));

const options = { zone: "UTC", startWeekOn: 0 as const, initialToday: "2026-09-12" };

describe("useMealWeek", () => {
  beforeEach(() => {
    now = null;
  });

  it("anchors on the server's today, and pages by whole weeks", () => {
    const { result } = renderHook(() => useMealWeek(options));
    expect(result.current.dates[0]).toBe("2026-09-06");
    expect(result.current.isCurrentWeek).toBe(true);
    act(() => result.current.page(1));
    expect(result.current.dates[0]).toBe("2026-09-13");
    expect(result.current.isCurrentWeek).toBe(false);
    act(() => result.current.today());
    expect(result.current.dates[0]).toBe("2026-09-06");
  });

  it("moves only the marker at midnight; the week stays put until Today is pressed", () => {
    const { result, rerender } = renderHook(() => useMealWeek(options));
    now = new Date("2026-09-13T00:30:00Z");
    rerender();
    expect(result.current.todayDate).toBe("2026-09-13");
    expect(result.current.dates[0]).toBe("2026-09-06");
    expect(result.current.isCurrentWeek).toBe(false);
    act(() => result.current.today());
    expect(result.current.dates[0]).toBe("2026-09-13");
    expect(result.current.isCurrentWeek).toBe(true);
  });
});
