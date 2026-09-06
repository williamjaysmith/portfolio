"use client";

import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";

/**
 * A section's header row (005 FR-530, FR-531, FR-533; `shot05` — "Bakery ···
 * 2 items ⌃"): the name, its count of unchecked items, a chevron that folds the
 * section's rows away on this device, and the `•••` that opens Rename / Remove
 * section. It is a ROW of the card's flat sequence (`data-list-row`) so a drop
 * can land beside it, and never a handle, so it cannot be lifted (R508).
 *
 * `AddSectionFooter` is the same header in its placeholder state (FR-503;
 * `gallery/07` — "Add section (0) ⌃"): the label in the muted serif, a count of
 * 0, the chevron — and a tap begins Add section.
 */

function itemsInWords(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

const ROW = "flex min-h-(--fam-touch) items-center gap-2 px-3 pt-2 text-(length:--fam-fs-small) text-(--fam-text-muted)";
const ICON_BUTTON = "grid h-(--fam-touch) w-(--fam-touch) shrink-0 place-items-center rounded-full";

export interface SectionHeaderProps {
  section: string;
  /** `sectionCountOf` — the unchecked items under it. */
  count: number;
  folded: boolean;
  onToggleFold: () => void;
  onMenu: () => void;
}

export function SectionHeader({ section, count, folded, onToggleFold, onMenu }: SectionHeaderProps) {
  return (
    <li data-list-row data-section-row={section} className={ROW}>
      <button
        type="button"
        aria-expanded={!folded}
        aria-label={`${folded ? "Unfold" : "Fold"} ${section}`}
        onClick={onToggleFold}
        className={ICON_BUTTON}
      >
        {folded ? <ChevronDown aria-hidden="true" size={20} /> : <ChevronUp aria-hidden="true" size={20} />}
      </button>
      <span className="min-w-0 flex-1 truncate font-medium text-(--fam-text-primary)">{section}</span>
      <span className="tabular-nums">{itemsInWords(count)}</span>
      <button type="button" aria-label={`${section} menu`} onClick={onMenu} className={ICON_BUTTON}>
        <MoreHorizontal aria-hidden="true" size={20} />
      </button>
    </li>
  );
}

export function AddSectionFooter({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      data-add-section
      onClick={onAdd}
      className="mx-(--fam-task-col-pad) flex min-h-(--fam-touch) items-center gap-2 rounded-(--fam-list-row-r) px-3 text-(length:--fam-fs-small) text-(--fam-text-muted)"
    >
      <ChevronUp aria-hidden="true" size={20} />
      <span className="flex-1 text-left font-(family-name:--fam-font-serif) text-(length:--fam-fs-body)">Add section</span>
      <span aria-hidden="true" className="tabular-nums">
        0 items
      </span>
    </button>
  );
}
