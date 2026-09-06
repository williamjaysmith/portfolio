"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";

import { groupedRowsOf, uncheckedCountOf, type CardRow } from "@/lib/family/lists/grouping";
import { dropOf, rowsInOrder, type DropTarget } from "@/lib/family/lists/reorder";
import { profileVars } from "@/lib/family/colors";
import type { Reorder } from "@/lib/family/tasks/reorder";
import type { List, ListItem } from "@/lib/family/types";

import { previewed, useListReorder } from "../../components/useListReorder";
import { AddItemBox } from "./AddItemBox";
import { ListCardHeader } from "./ListCardHeader";
import { ListItemRow } from "./ListItemRow";
import { AddSectionFooter, SectionHeader } from "./SectionHeader";
import type { ListFolds } from "./useListFolds";
import { addKeyOf, itemKeyOf, type WriteOutcome } from "./useListWrites";

/**
 * One list's card (005 FR-503, FR-504, FR-523, FR-530–FR-532; dossier 07 §6.5):
 * the panel at the list's colour @20 %, the header, the "Add item" box, the
 * flat sequence of rows — ungrouped items, then each section's header over its
 * items (`groupedRowsOf`, R502), a folded section showing its header only — and
 * the "Add section" footer.
 *
 * **The reorder is the shipped press-and-hold machine** (R508): one
 * `useListReorder` over the flat rows, with the headers as rows that can be
 * landed beside but never lifted (`handleSelector`), the keyboard pick-up off
 * (Enter and Space belong to the checkbox and the text — the sheet's Move
 * up/down is the keyboard's path, FR-541), and `dropOf` reading the section
 * and the neighbours off the machine's new order. A drop is one write.
 *
 * The accent is set once here as `--profile` (FR-504). The badge counts the FULL
 * set; the rows are the SHOWN set (FR-505, FR-520).
 */

export interface ListCardProps {
  list: List;
  /** Every item of this list — what the badge and the section counts read. */
  items: readonly ListItem[];
  /** The items this device draws (`itemsShownOf`); the badge does not read it. */
  shownItems: readonly ListItem[];
  busyKeys: ReadonlySet<string>;
  folds: ListFolds;
  onAdd: (list: List, text: string) => Promise<WriteOutcome<ListItem>>;
  onToggle: (item: ListItem, checked: boolean) => void;
  onOpenItem: (item: ListItem) => void;
  onMove: (item: ListItem, target: DropTarget) => void;
  onEdit: (list: List) => void;
  onMenu: (list: List) => void;
  onSectionMenu: (list: List, section: string) => void;
  onAddSection: (list: List) => void;
  /** The pager stands down while a row is in hand (R508). */
  onReorderActive?: (active: boolean) => void;
  /** The card's menu "Add item" focuses the box through this. */
  registerAddInput?: (listId: string, node: HTMLInputElement | null) => void;
}

const CLIENT_GAP = 1000;

/** The rows the machine sees: every row of the sequence, spaced for the shared reducer. */
function reorderItemsOf(rows: readonly CardRow[]) {
  return rows.map((row, index) => ({ id: row.id, sortOrder: (index + 1) * CLIENT_GAP }));
}

function labelOfRow(rows: readonly CardRow[], id: string): string {
  const row = rows.find((one) => one.id === id);
  if (row === undefined) return "";
  return row.kind === "item" ? row.item.text : row.section;
}

/** The item id under a press, if the press landed on an item row. */
function pressedItemOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("[data-item]")?.dataset.item ?? null;
}

/** The flat sequence with a folded section's rows taken out — the header stays (FR-531). */
function unfoldedRowsOf(rows: readonly CardRow[], listId: string, folds: ListFolds): CardRow[] {
  return rows.filter((row) => row.kind === "header" || row.item.section === null || !folds.isFolded(listId, row.item.section));
}

export function ListCard(props: ListCardProps) {
  const { list, items, shownItems, busyKeys, folds, onMove, onReorderActive } = props;
  const rows = useMemo(() => groupedRowsOf(shownItems), [shownItems]);
  const count = useMemo(() => uncheckedCountOf(items), [items]);
  const [pressed, setPressed] = useState<string | null>(null);

  const onDrop = useCallback(
    (move: Reorder, movedId: string) => {
      const target = dropOf(rowsInOrder(rows, move.order), movedId);
      const item = shownItems.find((one) => one.id === movedId);
      if (target !== null && item !== undefined) onMove(item, target);
    },
    [rows, shownItems, onMove],
  );

  const reorder = useListReorder({
    items: useMemo(() => reorderItemsOf(rows), [rows]),
    axis: "vertical",
    rowSelector: "[data-list-row]",
    handleSelector: "[data-item-handle]",
    labelOf: (id) => labelOfRow(rows, id),
    enabled: true,
    keyboard: false,
    onDrop,
  });

  // The pager stands down while a row is in hand; the pointer marks the lifted row.
  const active = reorder.active;
  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLElement>) => setPressed(pressedItemOf(event.target)),
    [],
  );
  useEffect(() => onReorderActive?.(active), [active, onReorderActive]);

  const drawn = unfoldedRowsOf(previewed(rows, reorder.order, (row) => row.id), list.id, folds);
  const lifted = active ? pressed : null;

  return (
    <section
      aria-label={list.name}
      data-list={list.id}
      style={profileVars(list.color) as CSSProperties}
      className="fam-profile fam-tint-20 flex h-full min-h-0 w-full min-w-0 flex-col gap-2 rounded-(--fam-list-card-r) pb-2"
    >
      <ListCardHeader list={list} count={count} onEdit={props.onEdit} onMenu={props.onMenu} />
      <AddItemBox
        listName={list.name}
        pending={busyKeys.has(addKeyOf(list))}
        onAdd={(text) => props.onAdd(list, text)}
        inputRef={props.registerAddInput ? (node) => props.registerAddInput?.(list.id, node) : undefined}
      />
      <ul
        {...reorder.containerProps}
        onPointerDownCapture={onPointerDownCapture}
        data-column-body
        style={active ? { touchAction: "none" } : undefined}
        className="fam-task-scroll flex min-h-0 flex-1 flex-col gap-(--fam-list-row-gap) overflow-y-auto px-(--fam-task-col-pad)"
      >
        {drawn.map((row) =>
          row.kind === "header" ? (
            <SectionHeader
              key={row.id}
              section={row.section}
              count={row.count}
              folded={folds.isFolded(list.id, row.section)}
              onToggleFold={() => folds.toggle(list.id, row.section)}
              onMenu={() => props.onSectionMenu(list, row.section)}
            />
          ) : (
            <ListItemRow
              key={row.id}
              item={row.item}
              busy={busyKeys.has(itemKeyOf(row.item))}
              lifted={lifted === row.id}
              onToggle={props.onToggle}
              onOpen={props.onOpenItem}
            />
          ),
        )}
      </ul>
      <p role="status" aria-live="polite" className="sr-only">
        {reorder.announcement}
      </p>
      <AddSectionFooter onAdd={() => props.onAddSection(list)} />
    </section>
  );
}
