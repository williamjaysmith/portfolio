"use client";

import { inkOn } from "@/lib/family/colors";
import { MoreHorizontal } from "lucide-react";

import type { List } from "@/lib/family/types";

/**
 * A card's header (005 FR-503, FR-505; dossier 07 §6.5 "Grocery List (5)"):
 * the name in the serif face, a round count badge in the list's saturated
 * colour with a white numeral, and the `•••` that opens the list's menu.
 * The badge counts the unchecked items and never moves when a device hides
 * its checked ones (FR-505). Tapping the name edits the list, as the
 * reference does (37275069922971 — "tap the list name … to change Title, List
 * Type, or Color").
 */

export interface ListCardHeaderProps {
  list: List;
  /** FR-505: `uncheckedCountOf` the list's items. */
  count: number;
  onEdit: (list: List) => void;
  onMenu: (list: List) => void;
}

function toDoWords(count: number): string {
  return `${count} to do`;
}

export function ListCardHeader({ list, count, onEdit, onMenu }: ListCardHeaderProps) {
  return (
    <header
      role="group"
      aria-label={list.name}
      className="flex min-h-(--fam-list-header-h) items-center gap-3 px-(--fam-task-header-pad)"
    >
      <button
        type="button"
        onClick={() => onEdit(list)}
        className="min-h-(--fam-touch) min-w-0 flex-1 truncate text-left font-(family-name:--fam-font-serif) text-(length:--fam-fs-list-title)"
      >
        {list.name}
      </button>
      <span
        data-count-badge
        role="img"
        aria-label={toDoWords(count)}
        // The badge is filled with the list's own colour, and half the palette
        // is light: white on Sprout reads at 1.7:1. The ink is chosen against
        // the fill, as every other tinted surface in the app chooses it
        // (`inkOn`, FR-039; found by 007's sweep).
        style={{ color: inkOn(list.color) }}
        className="grid h-(--fam-list-badge) w-(--fam-list-badge) shrink-0 place-items-center rounded-full bg-(--fam-profile-100) text-(length:--fam-fs-body) font-medium tabular-nums"
      >
        {count}
      </span>
      <button
        type="button"
        aria-label={`${list.name} menu`}
        onClick={() => onMenu(list)}
        className="grid h-(--fam-touch) w-(--fam-touch) shrink-0 place-items-center rounded-full hover:bg-(--fam-app-bg)"
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
    </header>
  );
}
