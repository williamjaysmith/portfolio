import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetDeviceVisibility, useDeviceVisibility } from "../useDeviceVisibility";

const STORAGE_KEY = "family:hidden-categories:v1";

/**
 * FR-033: showing and hiding profiles is a per-device choice, and constitution
 * §VI: unavailable storage degrades to in-memory rather than crashing.
 */
describe("useDeviceVisibility", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDeviceVisibility();
  });

  it("starts with everyone visible", () => {
    const { result } = renderHook(() => useDeviceVisibility());
    expect(result.current.hiddenIds.size).toBe(0);
    expect(result.current.persistent).toBe(true);
  });

  it("persists a hidden profile to this device only", () => {
    const { result } = renderHook(() => useDeviceVisibility());
    act(() => result.current.setHidden("kid", true));

    expect(result.current.hiddenIds.has("kid")).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual(["kid"]);
  });

  it("reads an existing choice back on a fresh mount", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["sam"]));
    resetDeviceVisibility();

    const { result } = renderHook(() => useDeviceVisibility());
    expect(result.current.hiddenIds.has("sam")).toBe(true);
  });

  it("shows everyone again", () => {
    const { result } = renderHook(() => useDeviceVisibility());
    act(() => result.current.setHidden("kid", true));
    act(() => result.current.showAll());

    expect(result.current.hiddenIds.size).toBe(0);
  });

  it("prunes ids that no longer exist, so a deleted profile cannot stay hidden", () => {
    const { result } = renderHook(() => useDeviceVisibility());
    act(() => result.current.setHidden("gone", true));
    act(() => result.current.pruneTo(["alex", "sam"]));

    expect(result.current.hiddenIds.size).toBe(0);
  });

  it("ignores corrupt stored state rather than crashing", () => {
    localStorage.setItem(STORAGE_KEY, "not json");
    resetDeviceVisibility();

    const { result } = renderHook(() => useDeviceVisibility());
    expect(result.current.hiddenIds.size).toBe(0);
  });

  it("keeps working in memory when storage refuses to write", () => {
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    const { result } = renderHook(() => useDeviceVisibility());
    act(() => result.current.setHidden("kid", true));

    expect(result.current.hiddenIds.has("kid")).toBe(true);
    expect(result.current.persistent).toBe(false);
    setItem.mockRestore();
  });
});
