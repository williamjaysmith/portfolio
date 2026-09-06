"use client";

import { useRef } from "react";

import { useModalDialog } from "../../components/useModalDialog";

/**
 * The action sheet behind a card's — or a section header's — `•••` (005 R510;
 * FR-511, FR-512, FR-521, FR-528, FR-533). A native `<dialog>` on the shipped
 * modal idiom rather than a popover: one overlay idiom for the whole app, 44 px
 * rows a hand can hit on the wall, focus trapped and returned, Escape closes.
 *
 * Purely presentational: the parent decides which entries exist (a list's five,
 * a section's two), what each does, and which are disabled (Clear Completed at
 * zero). The reference's list menu is verified to hold "Add item", "Edit list",
 * "Add section" and "Clear Completed" (37275069922971, 44739335665051,
 * 51482785426075); Delete list is this project's (Assumption 14).
 */

export interface ListMenuEntry {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Drawn in the danger ink: Delete list, Remove section. */
  danger?: boolean;
}

export interface ListMenuProps {
  /** What the sheet is about — the list's or the section's name. */
  title: string;
  entries: readonly ListMenuEntry[];
  onClose: () => void;
}

const ROW =
  "flex min-h-(--fam-touch) w-full items-center rounded-xl px-3 text-left text-(length:--fam-fs-body) " +
  "hover:bg-(--fam-pill-btn-bg) disabled:opacity-50";

export function ListMenu({ title, entries, onClose }: ListMenuProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, firstRef);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="list-menu-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,22rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-4 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="list-menu-title"
        className="px-3 pb-2 font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
      >
        {title}
      </h2>
      <ul className="flex flex-col">
        {entries.map((entry, index) => (
          <li key={entry.label}>
            <button
              ref={index === 0 ? firstRef : undefined}
              type="button"
              disabled={entry.disabled}
              onClick={() => {
                onClose();
                entry.onSelect();
              }}
              className={`${ROW} ${entry.danger ? "text-(--fam-danger)" : ""}`}
            >
              {entry.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
