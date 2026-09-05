import { describe, expect, it } from "vitest";

import { needsRebalance, SORT_GAP } from "@/lib/family/ordering";
import { reorderList, type ReorderItem } from "@/lib/family/tasks/reorder";

/**
 * T074 — the pure half of BOTH reorders (FR-309, FR-310, R321).
 *
 * A drop is a list reorder and nothing else: no geometry, no rectangles, no
 * canvas maths — a `fromIndex`, a `toIndex`, and the fractional index Phase 1
 * already ships. The two consumers are deliberately different shapes and this
 * one function serves both halves of each:
 *
 *   - the COLUMN drag (FR-309) uses `order`, because Phase 1's
 *     `reorderCategories` takes the complete ordered id list and rebalances
 *     every row itself;
 *   - the ROUTINE drag (FR-310) uses `writes`, because `moveRoutine` writes
 *     ONE `task_assignees.sort_order` from `sortOrderBetween` and respaces the
 *     Profile's set only when `needsRebalance` says the gap has collapsed.
 *
 * The invariant the whole thing exists for: **one row per drop**. A test that
 * asserts `writes.length === 1` on an ordinary move is asserting that a
 * renumbering cascade did not creep back in.
 */

/** A list at Phase 1's own spacing: 1000, 2000, 3000, 4000. */
function evenList(count: number): ReorderItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    sortOrder: SORT_GAP * (index + 1),
  }));
}

/** The ids as the list reads once `writes` have been applied to it. */
function storedOrder(items: readonly ReorderItem[]): string[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder).map((one) => one.id);
}

describe("reorderList: where a drop lands", () => {
  it("moves an item later and reports the order the list now reads", () => {
    const result = reorderList({ items: evenList(4), fromIndex: 0, toIndex: 2 });

    expect(result?.order).toEqual(["item-1", "item-2", "item-0", "item-3"]);
  });

  it("moves an item earlier", () => {
    const result = reorderList({ items: evenList(4), fromIndex: 3, toIndex: 1 });

    expect(result?.order).toEqual(["item-0", "item-3", "item-1", "item-2"]);
  });

  it("moves an item to the very front, below everything that exists", () => {
    const result = reorderList({ items: evenList(3), fromIndex: 2, toIndex: 0 });

    expect(result?.order).toEqual(["item-2", "item-0", "item-1"]);
    // `sortOrderBetween(null, 1000)` — a whole gap below the first neighbour.
    expect(result?.writes).toEqual([{ id: "item-2", sortOrder: 0 }]);
  });

  it("moves an item to the very end, above everything that exists", () => {
    const result = reorderList({ items: evenList(3), fromIndex: 0, toIndex: 2 });

    expect(result?.order).toEqual(["item-1", "item-2", "item-0"]);
    expect(result?.writes).toEqual([{ id: "item-0", sortOrder: 4000 }]);
  });
});

describe("reorderList: one row per drop, never a renumber (R321)", () => {
  it("writes exactly ONE row, the midpoint of its new neighbours", () => {
    const result = reorderList({ items: evenList(4), fromIndex: 0, toIndex: 2 });

    expect(result?.writes).toEqual([{ id: "item-0", sortOrder: 3500 }]);
    expect(result?.rebalanced).toBe(false);
  });

  it("leaves every other row's sort_order untouched", () => {
    const items = evenList(5);
    const result = reorderList({ items, fromIndex: 4, toIndex: 1 });

    expect(result?.writes.map((one) => one.id)).toEqual(["item-4"]);
    expect(items.map((one) => one.sortOrder)).toEqual([1000, 2000, 3000, 4000, 5000]);
  });

  it("never mutates the list it was handed", () => {
    const items = evenList(3);
    reorderList({ items, fromIndex: 0, toIndex: 2 });

    expect(items.map((one) => one.id)).toEqual(["item-0", "item-1", "item-2"]);
  });
});

describe("reorderList: the rebalance the fractional index eventually needs", () => {
  /** Two neighbours whose midpoint no longer has room between them. */
  const COLLIDED: ReorderItem[] = [
    { id: "a", sortOrder: 1000 },
    { id: "b", sortOrder: 2000 },
    { id: "c", sortOrder: 2000.0000001 },
    { id: "d", sortOrder: 2000.0000002 },
  ];

  it("respaces the whole set when the midpoint has run out of room", () => {
    const result = reorderList({ items: COLLIDED, fromIndex: 0, toIndex: 2 });

    expect(result?.rebalanced).toBe(true);
    expect(result?.writes).toEqual([
      { id: "b", sortOrder: 1000 },
      { id: "c", sortOrder: 2000 },
      { id: "a", sortOrder: 3000 },
      { id: "d", sortOrder: 4000 },
    ]);
  });

  it("respaces in the order the drop produced, so the drop is what the list keeps", () => {
    const result = reorderList({ items: COLLIDED, fromIndex: 0, toIndex: 2 });

    expect(result?.writes.map((one) => one.id)).toEqual(result?.order);
    expect(needsRebalance(result?.writes.map((one) => one.sortOrder) ?? [])).toBe(false);
  });

  it("does not respace a list whose gaps are still wide (the common case)", () => {
    const result = reorderList({ items: evenList(6), fromIndex: 5, toIndex: 0 });

    expect(result?.rebalanced).toBe(false);
    expect(result?.writes).toHaveLength(1);
  });
});

describe("reorderList: the moves that are not moves", () => {
  it("is null when the item is dropped where it already was", () => {
    expect(reorderList({ items: evenList(4), fromIndex: 2, toIndex: 2 })).toBeNull();
  });

  it("is null for a list of one — there is nowhere to put it", () => {
    expect(reorderList({ items: evenList(1), fromIndex: 0, toIndex: 0 })).toBeNull();
  });

  it("is null for an empty list", () => {
    expect(reorderList({ items: [], fromIndex: 0, toIndex: 0 })).toBeNull();
  });

  it("is null when either index is outside the list, rather than guessing", () => {
    const items = evenList(3);
    expect(reorderList({ items, fromIndex: 3, toIndex: 0 })).toBeNull();
    expect(reorderList({ items, fromIndex: -1, toIndex: 0 })).toBeNull();
    expect(reorderList({ items, fromIndex: 0, toIndex: 3 })).toBeNull();
    expect(reorderList({ items, fromIndex: 0, toIndex: -1 })).toBeNull();
  });

  it("is null when an index is not a whole number", () => {
    expect(reorderList({ items: evenList(3), fromIndex: 0.5, toIndex: 2 })).toBeNull();
  });
});

describe("reorderList: the order and the writes agree", () => {
  it("applying the write to the input reproduces the reported order", () => {
    const items = evenList(5);
    const result = reorderList({ items, fromIndex: 1, toIndex: 4 });
    const applied = items.map((one) => {
      const write = result?.writes.find((row) => row.id === one.id);
      return write ? { ...one, sortOrder: write.sortOrder } : one;
    });

    expect(storedOrder(applied)).toEqual(result?.order);
  });
});
