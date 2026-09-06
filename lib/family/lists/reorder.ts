/**
 * Where a dropped list item lands (005 R502; FR-523, FR-524, FR-532).
 *
 * The card's rows are one flat sequence with the section headers IN it
 * (`groupedRowsOf`), and the shipped press-and-hold machine hands back that
 * sequence in its new order (`move.order`). This module reads the answer off
 * that sequence and nothing else:
 *
 *   - the nearest section header ABOVE the moved item decides its section — none
 *     above means ungrouped;
 *   - the nearest ITEMS above and below (headers skipped) decide the neighbours
 *     the server puts its `sort_order` between (`sortOrderBetween`, one write).
 *
 * So "drop it just under the Dairy header" makes it Dairy's first item, and
 * "drop it after Dairy's last item and before the next header" keeps it in
 * Dairy — the two gestures the reference documents, with no index arithmetic
 * of their own. `stepOf` is the keyboard's path (FR-541): one row up or down,
 * over headers too, answered by the same rule.
 *
 * Framework-free and pure: no React, no DOM, and no input array is ever mutated.
 */

import type { CardRow } from "./grouping";

/** What `moveListItem` is sent: the two neighbours and the section, all from the new sequence. */
export interface DropTarget {
  previousItemId: string | null;
  nextItemId: string | null;
  section: string | null;
}

/** The rows in the order `order` names them; rows `order` does not name are dropped, unknown ids skipped. */
export function rowsInOrder(rows: readonly CardRow[], order: readonly string[]): CardRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const placed = order.map((id) => byId.get(id)).filter((row): row is CardRow => row !== undefined);
  return placed.length === rows.length ? placed : [...rows];
}

function nearestItemId(rows: readonly CardRow[], from: number, step: -1 | 1): string | null {
  for (let i = from + step; i >= 0 && i < rows.length; i += step) {
    const row = rows[i];
    if (row.kind === "item") return row.id;
  }
  return null;
}

function sectionAbove(rows: readonly CardRow[], from: number): string | null {
  for (let i = from - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row.kind === "header") return row.section;
  }
  return null;
}

/**
 * The drop, read off the sequence AS IT WILL READ after the move. `null` when
 * `movedId` is not an item row of the sequence — a header cannot be moved, and a
 * stale id writes nothing.
 */
export function dropOf(rowsAfter: readonly CardRow[], movedId: string): DropTarget | null {
  const at = rowsAfter.findIndex((row) => row.id === movedId);
  if (at === -1 || rowsAfter[at].kind !== "item") return null;
  return {
    previousItemId: nearestItemId(rowsAfter, at, -1),
    nextItemId: nearestItemId(rowsAfter, at, 1),
    section: sectionAbove(rowsAfter, at),
  };
}

/**
 * FR-541's keyboard path: the item one row up (`-1`) or down (`1`) in the flat
 * sequence — across a header too, which is how it changes section — answered by
 * `dropOf` over the stepped sequence. `null` at either end, or for a non-item.
 */
export function stepOf(rows: readonly CardRow[], movedId: string, direction: -1 | 1): DropTarget | null {
  const at = rows.findIndex((row) => row.id === movedId);
  if (at === -1 || rows[at].kind !== "item") return null;
  const to = at + direction;
  if (to < 0 || to >= rows.length) return null;
  const stepped = [...rows];
  const [moved] = stepped.splice(at, 1);
  stepped.splice(to, 0, moved);
  return dropOf(stepped, movedId);
}
