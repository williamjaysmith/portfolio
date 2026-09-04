/**
 * Fractional-index helpers for `categories.sort_order` (data-model.md 003,
 * divergence #5): a drag writes ONE row with the midpoint of its new
 * neighbours instead of renumbering the list. Repeated midpoints eventually
 * exhaust `numeric` precision, so `needsRebalance` / `rebalance` restore even
 * spacing when neighbours get too close.
 *
 * Framework-free: no imports at all.
 */

export const SORT_GAP = 1000;

/** Gap below which two neighbours are treated as colliding. */
const MIN_GAP = 1e-6;

/** Position for a new item appended after everything that exists. */
export function nextSortOrder(existing: readonly { sortOrder: number }[]): number {
  if (existing.length === 0) return SORT_GAP;
  let max = Number.NEGATIVE_INFINITY;
  for (const item of existing) {
    if (item.sortOrder > max) max = item.sortOrder;
  }
  return max + SORT_GAP;
}

/**
 * Position between two neighbours. `null` on either side means "no neighbour
 * there": before the first item, after the last, or into an empty list.
 */
export function sortOrderBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return SORT_GAP;
  if (prev === null) return (next as number) - SORT_GAP;
  if (next === null) return prev + SORT_GAP;
  return prev + (next - prev) / 2;
}

/** True when any two adjacent values (ascending order expected) are closer than `MIN_GAP`. */
export function needsRebalance(sorted: readonly number[]): boolean {
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] < MIN_GAP) return true;
  }
  return false;
}

/** Fresh, evenly spaced values in the given order: `SORT_GAP * (index + 1)`. */
export function rebalance(ids: readonly string[]): { id: string; sortOrder: number }[] {
  return ids.map((id, index) => ({ id, sortOrder: SORT_GAP * (index + 1) }));
}
