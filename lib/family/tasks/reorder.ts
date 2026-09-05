/**
 * The pure half of both reorders (FR-309, FR-310, R321).
 *
 * A drop on this board is a LIST reorder: an item leaves one index and arrives
 * at another, and everything else keeps the position it had. There is no
 * geometry here — no rectangles, no pointer coordinates, no drop targets —
 * because neither reorder has any: the column drag moves a Profile among
 * Profiles and the routine drag moves a routine among that Profile's routines
 * in one section, and both are answered by two integers.
 *
 * `lib/family/drag-state.ts` is deliberately NOT reused. Its reducer is a
 * distance-slop machine built for a gesture FR-253 forbids a timed hold in, and
 * its states carry hour-grid geometry; press-and-hold is the opposite gesture,
 * and widening that machine would put a hold timer inside the one thing that
 * exists to have none.
 *
 * The numeric part is Phase 1's, unchanged: `sortOrderBetween` puts the moved
 * row between its new neighbours so **one row is written per drop**, and
 * `needsRebalance` / `rebalance` respace the whole set only once repeated
 * midpoints have finally exhausted the gap. That "only once" is the whole
 * point — a renumbering cascade on every drop is N writes where one will do.
 *
 * Two consumers, each taking the half it needs:
 *
 *   - the column drag reads `order`, because Phase 1's `reorderCategories`
 *     takes the complete ordered id list and rebalances every row itself;
 *   - `moveRoutine` reads `writes`, because it writes `task_assignees.sort_order`
 *     directly.
 *
 * Framework-free and pure: no React, no DOM, and the input list is never
 * mutated.
 */

import { needsRebalance, rebalance, sortOrderBetween } from "../ordering";

/** One row of an ordered list — a Profile's column, or a routine in a section. */
export interface ReorderItem {
  id: string;
  sortOrder: number;
}

/** A drop: which index the item left, and which index it arrived at. */
export interface ReorderInput {
  /** The list as it reads NOW, in ascending `sortOrder`. */
  items: readonly ReorderItem[];
  fromIndex: number;
  /** The index in the list as it will read AFTER the move. */
  toIndex: number;
}

/** One `sort_order` to store. */
export interface ReorderWrite {
  id: string;
  sortOrder: number;
}

export interface Reorder {
  /** The ids in the order the list now reads — what the board paints. */
  order: string[];
  /**
   * Usually exactly ONE row: the item that moved. Every row only when the
   * midpoint had no room left and the set was respaced.
   */
  writes: ReorderWrite[];
  /** Whether this drop was the one that had to respace (`needsRebalance`). */
  rebalanced: boolean;
}

/**
 * Where a drop leaves the list, and what to store for it — or `null` when the
 * move is not one: an index outside the list, an index that is not a whole
 * number, or an item dropped exactly where it already was. `null` means "write
 * nothing", never "write something else", so a mis-aimed gesture and a
 * malformed payload both settle by doing nothing at all.
 */
export function reorderList({ items, fromIndex, toIndex }: ReorderInput): Reorder | null {
  if (!isIndex(fromIndex, items.length) || !isIndex(toIndex, items.length)) return null;
  if (fromIndex === toIndex) return null;

  const moved = items[fromIndex];
  const next = [...items];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  const order = next.map((one) => one.id);
  const sortOrder = sortOrderBetween(
    next[toIndex - 1]?.sortOrder ?? null,
    next[toIndex + 1]?.sortOrder ?? null,
  );

  const settled = next.map((one) => (one.id === moved.id ? sortOrder : one.sortOrder));
  if (needsRebalance(settled)) return { order, writes: rebalance(order), rebalanced: true };
  return { order, writes: [{ id: moved.id, sortOrder }], rebalanced: false };
}

/** A whole number naming a position in a list of `length` items. */
function isIndex(value: number, length: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < length;
}
