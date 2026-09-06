"use client";

import { useCallback } from "react";

import {
  addListItem,
  clearCompletedItems,
  deleteListItem,
  moveListItem,
  removeSection,
  renameSection,
  sectionItems,
  setListItemChecked,
} from "@/lib/family/actions/lists";
import type { ActionResult } from "@/lib/family/errors";
import type { DropTarget } from "@/lib/family/lists/reorder";
import type { List, ListItem } from "@/lib/family/types";

import { useSerialisedWrites } from "../../components/useSerialisedWrites";

/**
 * The Lists tab's item and section writes (005 R510; FR-516–FR-533, FR-537):
 * `useSerialisedWrites` with this tab's verbs and keys on top, exactly as the
 * Tasks board's `useTaskResolve` and the Rewards tab's `useRedeem` are.
 *
 * Every write goes `withActor(run)` — the punch-in at the moment of the tap
 * (FR-534) — and is pessimistic: the row or card shows busy for one round trip
 * and then paints from the refetch. Nothing is written to the cache by hand,
 * nothing is queued offline, and a dismissed punch-in (`NO_ACTOR`) is the one
 * silence in `notice` (FR-537).
 *
 * Keys: `item:<id>` for one row's writes (a second tap on the same row while it
 * is writing is refused synchronously, `null`), `add:<listId>` for the card's
 * box, `list:<listId>` for a whole-list write (Clear Completed), and
 * `section:<listId>` for the section operations. List create/edit/delete are
 * the form's and go through the write surface, not this queue.
 */

export type WriteOutcome<T> = ActionResult<T> | null;

export function itemKeyOf(item: Pick<ListItem, "id">): string {
  return `item:${item.id}`;
}

export function addKeyOf(list: Pick<List, "id">): string {
  return `add:${list.id}`;
}

function listKeyOf(list: Pick<List, "id">): string {
  return `list:${list.id}`;
}

function sectionKeyOf(list: Pick<List, "id">): string {
  return `section:${list.id}`;
}

export interface ListWrites {
  busyKeys: ReadonlySet<string>;
  notice: string | null;
  clearNotice: () => void;
  /** FR-516: one item, at the end of the list's ungrouped items. */
  add: (list: Pick<List, "id">, text: string) => Promise<WriteOutcome<ListItem>>;
  /** FR-518 / R503: a state, not a toggle — idempotent on the server. */
  setChecked: (item: Pick<ListItem, "id">, checked: boolean) => Promise<WriteOutcome<ListItem>>;
  /** FR-522. */
  remove: (item: Pick<ListItem, "id">) => Promise<WriteOutcome<null>>;
  /** FR-523 / FR-532: the drop `dropOf` computed — order and section in one write. */
  move: (item: Pick<ListItem, "id">, target: DropTarget) => Promise<WriteOutcome<ListItem>>;
  /** FR-521: after the confirmation. */
  clearCompleted: (list: Pick<List, "id">) => Promise<WriteOutcome<{ removed: number }>>;
  /** FR-528: Add section / Move items. */
  sectionItems: (
    list: Pick<List, "id">,
    name: string,
    itemIds: readonly string[],
  ) => Promise<WriteOutcome<{ section: string; moved: number }>>;
  /** FR-533. */
  renameSection: (
    list: Pick<List, "id">,
    from: string,
    to: string,
  ) => Promise<WriteOutcome<{ section: string; renamed: number }>>;
  /** FR-533: the items stay. */
  removeSection: (list: Pick<List, "id">, name: string) => Promise<WriteOutcome<{ ungrouped: number }>>;
}

export function useListWrites(): ListWrites {
  const { busyKeys, notice, clearNotice, commit } = useSerialisedWrites();

  // Each is `async` so the queue's synchronous refusal of a repeated tap (`null`)
  // arrives the same way its answer does: as the promise's value.
  const add = useCallback(
    async (list: Pick<List, "id">, text: string) =>
      commit(addKeyOf(list), () => addListItem({ listId: list.id, text })),
    [commit],
  );
  const setChecked = useCallback(
    async (item: Pick<ListItem, "id">, checked: boolean) =>
      commit(itemKeyOf(item), () => setListItemChecked({ id: item.id, checked })),
    [commit],
  );
  const remove = useCallback(
    async (item: Pick<ListItem, "id">) => commit(itemKeyOf(item), () => deleteListItem({ id: item.id })),
    [commit],
  );
  const move = useCallback(
    async (item: Pick<ListItem, "id">, target: DropTarget) =>
      commit(itemKeyOf(item), () => moveListItem({ id: item.id, ...target })),
    [commit],
  );
  const clearCompleted = useCallback(
    async (list: Pick<List, "id">) =>
      commit(listKeyOf(list), () => clearCompletedItems({ listId: list.id, confirm: true })),
    [commit],
  );
  const section = useCallback(
    async (list: Pick<List, "id">, name: string, itemIds: readonly string[]) =>
      commit(sectionKeyOf(list), () => sectionItems({ listId: list.id, name, itemIds: [...itemIds] })),
    [commit],
  );
  const rename = useCallback(
    async (list: Pick<List, "id">, from: string, to: string) =>
      commit(sectionKeyOf(list), () => renameSection({ listId: list.id, from, to })),
    [commit],
  );
  const removeOne = useCallback(
    async (list: Pick<List, "id">, name: string) =>
      commit(sectionKeyOf(list), () => removeSection({ listId: list.id, name })),
    [commit],
  );

  return {
    busyKeys,
    notice,
    clearNotice,
    add,
    setChecked,
    remove,
    move,
    clearCompleted,
    sectionItems: section,
    renameSection: rename,
    removeSection: removeOne,
  };
}
