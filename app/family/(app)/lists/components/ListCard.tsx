"use client";

import { useMemo, type CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import { groupedRowsOf, uncheckedCountOf, type CardRow } from "@/lib/family/lists/grouping";
import type { List, ListItem } from "@/lib/family/types";

import { AddItemBox } from "./AddItemBox";
import { ListCardHeader } from "./ListCardHeader";
import { ListItemRow } from "./ListItemRow";
import { addKeyOf, itemKeyOf, type WriteOutcome } from "./useListWrites";

/**
 * One list's card (005 FR-503, FR-504; dossier 07 §6.5): the panel at the
 * list's colour @20 %, the header, the "Add item" box, the flat sequence of
 * rows — ungrouped items, then each section's header over its items
 * (`groupedRowsOf`, R502) — and the "Add section" footer.
 *
 * The accent is set once here as `--profile` (FR-504): the panel is the 20 %
 * tint, a row the 40 %, the badge the full colour — the shipped ladder, never a
 * hand-picked tint. The card is handed the list's items and draws everything
 * from them; the badge counts the unchecked ones (`uncheckedCountOf`) from the
 * FULL set, while the rows it draws are the SHOWN set — so a device hiding its
 * checked items never moves a number (FR-505, FR-520).
 */

export interface ListCardProps {
  list: List;
  /** Every item of this list — what the badge and the section counts read. */
  items: readonly ListItem[];
  /** The items this device draws (`itemsShownOf`); the badge does not read it. */
  shownItems: readonly ListItem[];
  busyKeys: ReadonlySet<string>;
  onAdd: (list: List, text: string) => Promise<WriteOutcome<ListItem>>;
  onToggle: (item: ListItem, checked: boolean) => void;
  onOpenItem: (item: ListItem) => void;
  onEdit: (list: List) => void;
  onMenu: (list: List) => void;
  onAddSection: (list: List) => void;
  /** The card's menu "Add item" focuses the box through this. */
  registerAddInput?: (listId: string, node: HTMLInputElement | null) => void;
}

/** A section's header row — the fold, the count and the menu arrive with T042. */
function SectionRow({ row }: { row: Extract<CardRow, { kind: "header" }> }) {
  return (
    <li
      data-list-row
      data-section-row={row.section}
      className="flex min-h-(--fam-touch) items-center justify-between px-3 pt-2 text-(length:--fam-fs-small) font-medium text-(--fam-text-muted)"
    >
      <span>{row.section}</span>
      <span>{row.count === 1 ? "1 item" : `${row.count} items`}</span>
    </li>
  );
}

export function ListCard({
  list,
  items,
  shownItems,
  busyKeys,
  onAdd,
  onToggle,
  onOpenItem,
  onEdit,
  onMenu,
  onAddSection,
  registerAddInput,
}: ListCardProps) {
  const rows = useMemo(() => groupedRowsOf(shownItems), [shownItems]);
  const count = useMemo(() => uncheckedCountOf(items), [items]);

  return (
    <section
      aria-label={list.name}
      data-list={list.id}
      style={profileVars(list.color) as CSSProperties}
      className="fam-profile fam-tint-20 flex h-full min-h-0 w-full min-w-0 flex-col gap-2 rounded-(--fam-list-card-r) pb-2"
    >
      <ListCardHeader list={list} count={count} onEdit={onEdit} onMenu={onMenu} />
      <AddItemBox
        listName={list.name}
        pending={busyKeys.has(addKeyOf(list))}
        onAdd={(text) => onAdd(list, text)}
        inputRef={registerAddInput ? (node) => registerAddInput(list.id, node) : undefined}
      />
      <ul
        data-column-body
        className="fam-task-scroll flex min-h-0 flex-1 flex-col gap-(--fam-list-row-gap) overflow-y-auto px-(--fam-task-col-pad)"
      >
        {rows.map((row) =>
          row.kind === "header" ? (
            <SectionRow key={row.id} row={row} />
          ) : (
            <ListItemRow
              key={row.id}
              item={row.item}
              busy={busyKeys.has(itemKeyOf(row.item))}
              onToggle={onToggle}
              onOpen={onOpenItem}
            />
          ),
        )}
      </ul>
      <button
        type="button"
        data-add-section
        onClick={() => onAddSection(list)}
        className="mx-(--fam-task-col-pad) flex min-h-(--fam-touch) items-center justify-between rounded-(--fam-list-row-r) px-3 font-(family-name:--fam-font-serif) text-(length:--fam-fs-body) text-(--fam-text-muted)"
      >
        <span>Add section</span>
        <span aria-hidden="true">+</span>
      </button>
    </section>
  );
}
