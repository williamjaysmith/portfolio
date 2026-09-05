import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetRewardFilters,
  useRewardFilters,
} from "@/app/family/(app)/rewards/components/useRewardFilters";

/**
 * T030 / R409 — the third per-device store: the Rewards tab's one **Redeemed**
 * switch (FR-426).
 *
 * Off by default, so a Profile's column lists only unredeemed rewards until it
 * is on (FR-425). It rides the `useTaskFilters` pattern under a key of its own
 * (`family:reward-filters:v1`) rather than widening the task-filters object —
 * a device's stored task switches must never be reparsed against a different
 * shape. Display only: the choice is per device, never leaves it and changes
 * no stored data; constitution §VI says unavailable storage degrades to
 * in-memory rather than crashing.
 */

const STORAGE_KEY = "family:reward-filters:v1";

describe("useRewardFilters — the one switch", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRewardFilters();
  });

  it("starts with Redeemed OFF, so only unredeemed rewards show (FR-425, FR-426)", () => {
    const { result } = renderHook(() => useRewardFilters());

    expect(result.current.filters).toEqual({ redeemed: false });
    expect(result.current.persistent).toBe(true);
  });

  it("turns the switch on, which reveals the muted history cards", () => {
    const { result } = renderHook(() => useRewardFilters());

    act(() => result.current.setRedeemed(true));

    expect(result.current.filters).toEqual({ redeemed: true });
  });

  it("turns the switch back off", () => {
    const { result } = renderHook(() => useRewardFilters());

    act(() => result.current.setRedeemed(true));
    act(() => result.current.setRedeemed(false));

    expect(result.current.filters.redeemed).toBe(false);
  });

  it("keeps the snapshot's identity when set to what it already was", () => {
    const { result } = renderHook(() => useRewardFilters());
    const first = result.current.filters;

    act(() => result.current.setRedeemed(false));

    expect(result.current.filters).toBe(first);
  });

  it("hands a NEW object out on a real change, so a memo below it invalidates", () => {
    const { result } = renderHook(() => useRewardFilters());
    const first = result.current.filters;

    act(() => result.current.setRedeemed(true));

    expect(result.current.filters).not.toBe(first);
  });
});

describe("useRewardFilters — per-device persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRewardFilters();
  });

  it("writes the switch under its own key, not the task board's or the calendar's", () => {
    const { result } = renderHook(() => useRewardFilters());

    act(() => result.current.setRedeemed(true));

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({ redeemed: true });
    expect(localStorage.getItem("family:task-filters:v1")).toBeNull();
    expect(localStorage.getItem("family:hidden-categories:v1")).toBeNull();
  });

  it("reads an existing choice back on a fresh mount", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ redeemed: true }));
    resetRewardFilters();

    const { result } = renderHook(() => useRewardFilters());

    expect(result.current.filters).toEqual({ redeemed: true });
  });

  it("falls back to the default when the stored value is missing or the wrong type", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ redeemed: "yes" }));
    resetRewardFilters();

    const { result } = renderHook(() => useRewardFilters());

    expect(result.current.filters).toEqual({ redeemed: false });
    expect(result.current.persistent).toBe(true);
  });

  it("ignores stored state that is not an object at all", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["redeemed"]));
    resetRewardFilters();

    const { result } = renderHook(() => useRewardFilters());

    expect(result.current.filters.redeemed).toBe(false);
  });

  it("ignores corrupt stored state rather than crashing", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    resetRewardFilters();

    const { result } = renderHook(() => useRewardFilters());

    expect(result.current.filters.redeemed).toBe(false);
    expect(result.current.persistent).toBe(false);
  });
});

describe("useRewardFilters — storage that will not have it (constitution §VI)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRewardFilters();
  });

  it("keeps working in memory when a write is refused, and says so", () => {
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    const { result } = renderHook(() => useRewardFilters());
    act(() => result.current.setRedeemed(true));

    expect(result.current.filters.redeemed).toBe(true);
    expect(result.current.persistent).toBe(false);
    setItem.mockRestore();
  });

  it("keeps working in memory when the read is refused too", () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage is disabled");
    });
    resetRewardFilters();

    const { result } = renderHook(() => useRewardFilters());

    expect(result.current.filters.redeemed).toBe(false);
    expect(result.current.persistent).toBe(false);
    getItem.mockRestore();
  });
});

describe("useRewardFilters — one store, every subscriber", () => {
  beforeEach(() => {
    localStorage.clear();
    resetRewardFilters();
  });

  it("publishes a change to every mounted reader (the tab's chrome and each column)", () => {
    const chrome = renderHook(() => useRewardFilters());
    const column = renderHook(() => useRewardFilters());

    act(() => chrome.result.current.setRedeemed(true));

    expect(column.result.current.filters.redeemed).toBe(true);
  });

  it("keeps its callback stable, so a memo below it is not invalidated by a render", () => {
    const { result, rerender } = renderHook(() => useRewardFilters());
    const first = result.current.setRedeemed;

    rerender();

    expect(result.current.setRedeemed).toBe(first);
  });

  it("leaves the task board's switches alone — a different store under a different key", () => {
    localStorage.setItem(
      "family:task-filters:v1",
      JSON.stringify({ completed: true, late: true, skipped: false, upForGrabs: true }),
    );
    const { result } = renderHook(() => useRewardFilters());

    act(() => result.current.setRedeemed(true));

    expect(JSON.parse(localStorage.getItem("family:task-filters:v1") ?? "null")).toEqual({
      completed: true,
      late: true,
      skipped: false,
      upForGrabs: true,
    });
  });
});
