import { describe, it, expect } from "vitest";
import {
  SORT_GAP,
  needsRebalance,
  nextSortOrder,
  rebalance,
  sortOrderBetween,
} from "@/lib/family/ordering";

describe("SORT_GAP", () => {
  it("is 1000", () => {
    expect(SORT_GAP).toBe(1000);
  });
});

describe("nextSortOrder", () => {
  it("starts at one gap for an empty list", () => {
    expect(nextSortOrder([])).toBe(1000);
  });

  it("appends one gap past the current maximum regardless of input order", () => {
    expect(nextSortOrder([{ sortOrder: 1000 }, { sortOrder: 3000 }, { sortOrder: 2000 }])).toBe(4000);
  });

  it("works with fractional values", () => {
    expect(nextSortOrder([{ sortOrder: 1500.5 }])).toBe(2500.5);
  });
});

describe("sortOrderBetween", () => {
  it("returns the midpoint between two neighbours", () => {
    expect(sortOrderBetween(1000, 2000)).toBe(1500);
    expect(sortOrderBetween(1000, 1001)).toBe(1000.5);
  });

  it("moves one gap before the first item", () => {
    expect(sortOrderBetween(null, 1000)).toBe(0);
  });

  it("moves one gap after the last item", () => {
    expect(sortOrderBetween(2000, null)).toBe(3000);
  });

  it("returns one gap when the list is empty", () => {
    expect(sortOrderBetween(null, null)).toBe(1000);
  });
});

describe("needsRebalance", () => {
  it("is false for fewer than two items", () => {
    expect(needsRebalance([])).toBe(false);
    expect(needsRebalance([1000])).toBe(false);
  });

  it("is false while every adjacent gap is comfortable", () => {
    expect(needsRebalance([1000, 2000, 3000])).toBe(false);
    expect(needsRebalance([1000, 1000.001])).toBe(false);
  });

  it("is true when neighbours collide or nearly collide", () => {
    expect(needsRebalance([1000, 1000])).toBe(true);
    expect(needsRebalance([1000, 1000 + 1e-7])).toBe(true);
    expect(needsRebalance([1000, 2000, 2000.0000001, 3000])).toBe(true);
  });
});

describe("rebalance", () => {
  it("assigns evenly spaced values in the given order", () => {
    expect(rebalance(["a", "b", "c"])).toEqual([
      { id: "a", sortOrder: 1000 },
      { id: "b", sortOrder: 2000 },
      { id: "c", sortOrder: 3000 },
    ]);
  });

  it("returns an empty list for no ids", () => {
    expect(rebalance([])).toEqual([]);
  });

  it("produces a spacing that never needs rebalancing", () => {
    const orders = rebalance(["a", "b", "c", "d"]).map((r) => r.sortOrder);
    expect(needsRebalance(orders)).toBe(false);
  });
});
