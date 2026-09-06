import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDeviceKeySet } from "../useDeviceKeySet";

/**
 * 005 T041 — a per-device set of string keys (R509, FR-531): add, remove and
 * toggle reach storage under the store's own key; a corrupt value reads as
 * empty; a refusing storage keeps the session's set and reports it won't
 * persist. Each test builds its own store, so nothing leaks between them.
 */
describe("createDeviceKeySet", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts empty, toggles a key on and off, and writes the list to storage", () => {
    const store = createDeviceKeySet("test:keys");
    const { result } = renderHook(() => store.useKeys());
    expect(result.current.keys.size).toBe(0);
    expect(result.current.persistent).toBe(true);

    act(() => store.toggle("g dairy"));
    expect(result.current.keys.has("g dairy")).toBe(true);
    expect(store.has("g dairy")).toBe(true);
    expect(JSON.parse(localStorage.getItem("test:keys") ?? "[]")).toEqual(["g dairy"]);

    act(() => store.toggle("g dairy"));
    expect(result.current.keys.size).toBe(0);
    expect(JSON.parse(localStorage.getItem("test:keys") ?? "null")).toEqual([]);
  });

  it("reads a stored list back, ignores what is not a string, and treats a corrupt value as empty", () => {
    localStorage.setItem("test:keys", JSON.stringify(["a", 1, null, "b"]));
    const store = createDeviceKeySet("test:keys");
    expect([...renderHook(() => store.useKeys()).result.current.keys]).toEqual(["a", "b"]);

    localStorage.setItem("test:corrupt", "{not json");
    const corrupt = createDeviceKeySet("test:corrupt");
    expect(renderHook(() => corrupt.useKeys()).result.current.keys.size).toBe(0);
  });

  it("adding twice or removing a missing key changes nothing", () => {
    const store = createDeviceKeySet("test:keys");
    const { result } = renderHook(() => store.useKeys());
    act(() => {
      store.add("x");
      store.add("x");
      store.remove("y");
    });
    expect([...result.current.keys]).toEqual(["x"]);
  });

  it("keeps working for the session when storage refuses, and says it won't persist", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = createDeviceKeySet("test:keys");
    const { result } = renderHook(() => store.useKeys());
    act(() => store.add("x"));
    expect(result.current.keys.has("x")).toBe(true);
    expect(result.current.persistent).toBe(false);
  });

  it("resets to empty and re-reads storage on the next use", () => {
    const store = createDeviceKeySet("test:keys");
    const { result } = renderHook(() => store.useKeys());
    act(() => store.add("x"));
    localStorage.clear();
    act(() => store.reset());
    expect(result.current.keys.size).toBe(0);
  });
});
