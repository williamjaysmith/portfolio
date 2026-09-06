/**
 * What the Lists tab shows on THIS device, and to THIS punch-in (005 R505, R509;
 * FR-505, FR-514, FR-520, FR-535).
 *
 * Two rules, both display-only and both applied BELOW the counts (FR-505 — the
 * badge never moves when a device hides its checked items):
 *
 *   - `visibleListsOf`: a Parents only list is drawn wherever a parent is punched
 *     in and nowhere else — for a member, or for nobody, it is simply absent.
 *     This is the reference's "Hide on Device" mapped onto this project's identity
 *     (spec Assumption 5); the server refuses a member's WRITE with the same rule
 *     (contracts §Guards), and RLS is unchanged.
 *   - `itemsShownOf`: the per-device Completed switch hides checked items and
 *     nothing else (R509).
 *
 * Framework-free and pure.
 */

import type { List, ListFilters, ListItem, Role } from "../types";

/** The punched-in actor, as much of it as visibility needs; `null` when nobody is. */
export interface VisibilityActor {
  role: Role;
}

/** FR-514: every list for a parent; only the not-Parents-only ones for a member or for nobody. Order kept. */
export function visibleListsOf(lists: readonly List[], actor: VisibilityActor | null): List[] {
  if (actor?.role === "parent") return [...lists];
  return lists.filter((list) => !list.parentsOnly);
}

/** FR-520: the Completed switch off drops checked items, and nothing else. */
export function itemsShownOf(items: readonly ListItem[], switches: ListFilters): ListItem[] {
  if (switches.completed) return [...items];
  return items.filter((item) => item.checkedAt === null);
}
