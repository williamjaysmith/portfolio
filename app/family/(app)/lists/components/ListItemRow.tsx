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

/**
 * **A hairline under every row but the last.** The row's own fill is the card's
 * fill — both `fam-tint-40` — so a row had no edge of any kind and a list read
 * as text floating on a colour. The operator: *"i think the items could perhaps
 * be seperated by light lines just to make them easier to view"*, and then, on
 * the first attempt: *"not gray lines, light like white"*.
 *
 * White is right here and grey was not, because these rows sit on a COLOUR
 * rather than on the page. `--fam-hairline` is a grey mixed for the white app
 * background; on a 40 % tint it muddies rather than separates, while the app
 * background itself reads as a clean light rule on all twenty accents.
 *
 * `last:border-b-0` rather than a border on the top of each: a trailing rule
 * above "Add section" would read as a divider between the list and the footer,
 * which is a different claim.
 */
const ROW =
  "fam-tint-40 relative flex min-h-(--fam-list-row-h) items-center gap-3 rounded-(--fam-list-row-r) " +
  "border-b border-(--fam-app-bg) last:border-b-0 " +
  "px-3 text-(length:--fam-fs-list-item) select-none";

/**
 * **Round, and DRAWN at `--fam-list-check-d` inside a `--fam-list-check` target.**
 * It was a rounded square drawn at the full hit size, so a phone row carried a
 * 44px box — *"the checkboxes are way too big"*, and *"i would like the
 * checkboxes styled more like the tasks, radial check"*. The Tasks board's
 * `CompleteCircle` had this right from the start: 22px of circle inside a 44px
 * tap area (FR-397). This is the same split and the same token arithmetic, so
 * the two tabs now tick identically.
 *
 * The hit area is the LABEL around this box, not the box — see below.
 */
const BOX =
  "grid h-(--fam-list-check-d) w-(--fam-list-check-d) shrink-0 place-items-center rounded-full " +
  "border-2 border-(--fam-control-border) bg-(--fam-app-bg) transition-colors " +
  "peer-checked:border-(--fam-profile-100) peer-checked:bg-(--fam-profile-100) peer-checked:text-(--fam-profile-ink) " +
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
      {/* The LABEL is the tap target, and it has to be: the box inside it is
          drawn at --fam-list-check-d, which is 22px on a phone. FR-397's floor
          lives out here so shrinking the circle could not shrink the thing a
          finger has to hit. */}
      <label className="grid h-(--fam-list-check) w-(--fam-list-check) shrink-0 cursor-pointer place-items-center">
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
