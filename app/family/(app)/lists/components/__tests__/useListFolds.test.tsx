import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { foldKeyOf, resetListFolds, useListFolds } from "../useListFolds";

/** 005 T041 — the folded sections, per device, keyed by list and section (FR-531). */
describe("useListFolds", () => {
  beforeEach(() => {
    localStorage.clear();
    resetListFolds();
  });

  it("folds and unfolds one list's section without touching another list's section of the same name", () => {
    const { result } = renderHook(() => useListFolds());
    expect(result.current.isFolded("g", "Dairy")).toBe(false);

    act(() => result.current.toggle("g", "Dairy"));
    expect(result.current.isFolded("g", "Dairy")).toBe(true);
    expect(result.current.isFolded("t", "Dairy")).toBe(false);
    expect(JSON.parse(localStorage.getItem("family:list-folds:v1") ?? "[]")).toEqual([foldKeyOf("g", "Dairy")]);

    act(() => result.current.toggle("g", "Dairy"));
    expect(result.current.isFolded("g", "Dairy")).toBe(false);
    expect(result.current.persistent).toBe(true);
  });
});
