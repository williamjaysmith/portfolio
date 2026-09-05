import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetTaskFilters,
  useTaskFilters,
} from "@/app/family/(app)/tasks/components/useTaskFilters";

/**
 * T067 / R319 — the second per-device store, deliberately separate from the
 * shipped `useDeviceVisibility`.
 *
 * The per-Profile toggle rides that store unchanged (a `Set<string>` of
 * category ids with prune-against-known semantics, so no shipped device's
 * preference is orphaned); these four booleans are a different type with no
 * pruning at all, under a key of their own. FR-361 puts **Skipped** off by
 * default and the other three on. Display only (FR-384): the choice is per
 * device, never leaves it and changes no stored data, and constitution §VI
 * says unavailable storage degrades to in-memory rather than crashing.
 */

const STORAGE_KEY = "family:task-filters:v1";

describe("useTaskFilters — the four switches", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskFilters();
  });

  it("starts with completed, late and up-for-grabs on and skipped OFF (FR-361)", () => {
    const { result } = renderHook(() => useTaskFilters());

    expect(result.current.filters).toEqual({
      completed: true,
      late: true,
      skipped: false,
      upForGrabs: true,
    });
    expect(result.current.persistent).toBe(true);
  });

  it("turns one switch off without touching the other three", () => {
    const { result } = renderHook(() => useTaskFilters());

    act(() => result.current.setFilter("completed", false));

    expect(result.current.filters).toEqual({
      completed: false,
      late: true,
      skipped: false,
      upForGrabs: true,
    });
  });

  it("turns the skipped switch on, which is the one that reveals rather than hides", () => {
    const { result } = renderHook(() => useTaskFilters());

    act(() => result.current.setFilter("skipped", true));

    expect(result.current.filters.skipped).toBe(true);
  });

  it("keeps the snapshot's identity when a switch is set to what it already was", () => {
    const { result } = renderHook(() => useTaskFilters());
    const first = result.current.filters;

    act(() => result.current.setFilter("late", true));

    expect(result.current.filters).toBe(first);
  });

  it("hands a NEW object out on a real change, so a memo below it invalidates", () => {
    const { result } = renderHook(() => useTaskFilters());
    const first = result.current.filters;

    act(() => result.current.setFilter("late", false));

    expect(result.current.filters).not.toBe(first);
  });
});

describe("useTaskFilters — Show all", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskFilters();
  });

  it("turns every switch ON, skipped included — showing all means all", () => {
    const { result } = renderHook(() => useTaskFilters());

    act(() => result.current.setFilter("completed", false));
    act(() => result.current.setFilter("upForGrabs", false));
    act(() => result.current.showAll());

    expect(result.current.filters).toEqual({
      completed: true,
      late: true,
      skipped: true,
      upForGrabs: true,
    });
  });

  it("does nothing at all when everything is already shown", () => {
    const { result } = renderHook(() => useTaskFilters());

    act(() => result.current.showAll());
    const shownAll = result.current.filters;
    act(() => result.current.showAll());

    expect(result.current.filters).toBe(shownAll);
  });
});

describe("useTaskFilters — per-device persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskFilters();
  });

  it("writes the four booleans under their own key, not the calendar's", () => {
    const { result } = renderHook(() => useTaskFilters());

    act(() => result.current.setFilter("skipped", true));

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      completed: true,
      late: true,
      skipped: true,
      upForGrabs: true,
    });
    expect(localStorage.getItem("family:hidden-categories:v1")).toBeNull();
  });

  it("reads an existing choice back on a fresh mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ completed: false, late: true, skipped: true, upForGrabs: false }),
    );
    resetTaskFilters();

    const { result } = renderHook(() => useTaskFilters());

    expect(result.current.filters).toEqual({
      completed: false,
      late: true,
      skipped: true,
      upForGrabs: false,
    });
  });

  it("falls back per switch when a stored value is missing or the wrong type", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: "no", skipped: true }));
    resetTaskFilters();

    const { result } = renderHook(() => useTaskFilters());

    expect(result.current.filters).toEqual({
      completed: true,
      late: true,
      skipped: true,
      upForGrabs: true,
    });
  });

  it("ignores stored state that is not an object at all", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["completed"]));
    resetTaskFilters();

    const { result } = renderHook(() => useTaskFilters());

    expect(result.current.filters.skipped).toBe(false);
  });

  it("ignores corrupt stored state rather than crashing", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    resetTaskFilters();

    const { result } = renderHook(() => useTaskFilters());

    expect(result.current.filters.completed).toBe(true);
    expect(result.current.persistent).toBe(false);
  });
});

describe("useTaskFilters — storage that will not have it (constitution §VI)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskFilters();
  });

  it("keeps working in memory when a write is refused, and says so", () => {
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    const { result } = renderHook(() => useTaskFilters());
    act(() => result.current.setFilter("skipped", true));

    expect(result.current.filters.skipped).toBe(true);
    expect(result.current.persistent).toBe(false);
    setItem.mockRestore();
  });

  it("keeps working in memory when the read is refused too", () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage is disabled");
    });
    resetTaskFilters();

    const { result } = renderHook(() => useTaskFilters());

    expect(result.current.filters.late).toBe(true);
    expect(result.current.persistent).toBe(false);
    getItem.mockRestore();
  });
});

describe("useTaskFilters — one store, every subscriber", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTaskFilters();
  });

  it("publishes a change to every mounted reader (the sheet and the board)", () => {
    const sheet = renderHook(() => useTaskFilters());
    const board = renderHook(() => useTaskFilters());

    act(() => sheet.result.current.setFilter("late", false));

    expect(board.result.current.filters.late).toBe(false);
  });

  it("keeps its callbacks stable, so a memo below it is not invalidated by a render", () => {
    const { result, rerender } = renderHook(() => useTaskFilters());
    const first = result.current.setFilter;
    const firstShowAll = result.current.showAll;

    rerender();

    expect(result.current.setFilter).toBe(first);
    expect(result.current.showAll).toBe(firstShowAll);
  });
});
