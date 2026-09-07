"use client";

import { Check } from "lucide-react";

import type { ListItem } from "@/lib/family/types";

/**
 * One line of a list (005 FR-517–FR-519, FR-522, FR-523; 37275069922971,
 * dossier 07 §3 "checkbox rounded SQUARE ~63"): the text at the left, a
 * rounded SQUARE checkbox at the right — Lists use squares, Tasks circles.
 *
 * The checkbox is a real `<input type="checkbox">` named by the item's text,
 * so a screen reader hears "Milk, checkbox, checked"; the square is drawn
 * beside it and the input itself is visually hidden. Checked, the text greys
 * and strikes through and the box fills — the reference's exact description —
 * and the row stays where it was (FR-519).
 *
 * The text is a button that opens the item's sheet (FR-522). The whole row is
 * the press-and-hold handle (`data-item-handle`, FR-523); while lifted it draws
 * the reference's small pointer to its left in the accent coral.
 */

export interface ListItemRowProps {
  item: ListItem;
  /** FR-537: this row's write is in flight — the checkbox locks. */
  busy?: boolean;
  /** R508: the machine is carrying this row. */
  lifted?: boolean;
  onToggle: (item: ListItem, checked: boolean) => void;
  onOpen: (item: ListItem) => void;
}

const ROW =
  "fam-tint-40 relative flex min-h-(--fam-list-row-h) items-center gap-3 rounded-(--fam-list-row-r) " +
  "px-3 text-(length:--fam-fs-list-item) select-none";

const BOX =
  "grid h-(--fam-list-check) w-(--fam-list-check) shrink-0 place-items-center rounded-(--fam-list-check-r) " +
  "border-2 border-(--fam-control-border) bg-(--fam-app-bg) transition-colors " +
  "peer-checked:border-(--fam-profile-deep) peer-checked:bg-(--fam-profile-deep) peer-checked:text-white " +
  "peer-focus-visible:outline-3 peer-focus-visible:outline-(--fam-focus-ring) peer-disabled:opacity-60";

export function ListItemRow({ item, busy = false, lifted = false, onToggle, onOpen }: ListItemRowProps) {
  const checked = item.checkedAt !== null;
  return (
    <li
      data-list-row
      data-item-handle
      data-item={item.id}
      data-checked={checked ? "true" : undefined}
      data-lifted={lifted ? "true" : undefined}
      className={`${ROW} ${lifted ? "my-2 shadow-lg" : ""}`}
    >
      {lifted ? (
        <span
          aria-hidden="true"
          data-lift-pointer
          className="absolute top-1/2 -left-3 h-3 w-3 -translate-y-1/2 rotate-45 bg-(--fam-accent-coral)"
        />
      ) : null}
      <button
        type="button"
        onClick={() => onOpen(item)}
        // Done is said by the line through it and by the tick beside it. The
        // secondary ink on a tinted card fell just under the contrast floor
        // (4.35:1 against a list's own colour), so the text keeps its own ink
        // (007 FR-723).
        className={`min-h-(--fam-touch) min-w-0 flex-1 truncate text-left ${checked ? "line-through" : ""}`}
      >
        {item.text}
      </button>
      <label className="flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={busy}
          aria-label={item.text}
          aria-busy={busy ? "true" : undefined}
          onChange={(event) => onToggle(item, event.target.checked)}
          className="peer sr-only"
        />
        <span aria-hidden="true" data-check-box className={BOX}>
          {checked ? <Check className="h-1/2 w-1/2" strokeWidth={3} /> : null}
        </span>
      </label>
    </li>
  );
}
