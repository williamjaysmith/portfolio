import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_VIEW } from "@/lib/family/calendar/views";

import { resetCalendarView, useCalendarView } from "../useCalendarView";

/**
 * 011 R1111 / FR-1102 — the per-device view choice.
 *
 * What is worth pinning is not that a setter sets: it is that an unreadable or
 * unrecognised stored value leaves the calendar working on the default rather
 * than throwing, because a private window, cleared site data and a key written
 * by a future version all produce exactly that.
 */

describe("useCalendarView", () => {
  beforeEach(() => {
    localStorage.clear();
    resetCalendarView();
  });

  it("starts on the default when this device has never chosen", () => {
    const { result } = renderHook(() => useCalendarView());
    expect(result.current.view).toBe(DEFAULT_VIEW);
    expect(result.current.persistent).toBe(true);
  });

  it("remembers a choice in this device's own storage", () => {
    const { result } = renderHook(() => useCalendarView());
    act(() => result.current.setView("month"));

    expect(result.current.view).toBe("month");
    expect(JSON.parse(localStorage.getItem("family:calendar-view:v1") ?? "{}")).toEqual({
      view: "month",
    });
  });

  it("reads the stored choice back on a fresh mount", () => {
    localStorage.setItem("family:calendar-view:v1", JSON.stringify({ view: "day" }));
    resetCalendarView();

    const { result } = renderHook(() => useCalendarView());
    expect(result.current.view).toBe("day");
  });

  it("publishes a change to every mounted reader, not just the one that set it", () => {
    const first = renderHook(() => useCalendarView());
    const second = renderHook(() => useCalendarView());

    act(() => first.result.current.setView("month"));
    expect(second.result.current.view).toBe("month");
  });

  it("falls back to the default for a value it does not recognise", () => {
    // What a future version's "schedule" — or a hand-edited key — looks like.
    localStorage.setItem("family:calendar-view:v1", JSON.stringify({ view: "schedule" }));
    resetCalendarView();

    const { result } = renderHook(() => useCalendarView());
    expect(result.current.view).toBe(DEFAULT_VIEW);
  });

  it("falls back to the default for a value that is not JSON at all", () => {
    localStorage.setItem("family:calendar-view:v1", "not json");
    resetCalendarView();

    const { result } = renderHook(() => useCalendarView());
    expect(result.current.view).toBe(DEFAULT_VIEW);
    // The read threw, so this device cannot be trusted to remember.
    expect(result.current.persistent).toBe(false);
  });

  it("does nothing when set to the view already showing", () => {
    const { result } = renderHook(() => useCalendarView());
    act(() => result.current.setView(DEFAULT_VIEW));
    expect(localStorage.getItem("family:calendar-view:v1")).toBeNull();
  });
});
