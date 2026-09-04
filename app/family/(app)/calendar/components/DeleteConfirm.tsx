"use client";

import { useEffect, useRef } from "react";

/**
 * The delete confirmation (T049, FR-258, US2-11): every delete asks first,
 * and once confirmed it is final — the copy promises no undo, restore or
 * trash because none exists anywhere in the calendar (SC-212). The verb is
 * "Delete", never "Remove", because nothing is kept anywhere to come back
 * from.
 *
 * Deliberately generic about what is affected: an event may carry no
 * categories at all (FR-213), and which occurrences go is the ScopeDialog's
 * question (T048), asked before this one — so this dialog names only the
 * event by its title and states finality.
 *
 * Purely presentational: the parent owns the actual `deleteEvent` call (its
 * `confirm: true` is the server-side twin of this dialog) and passes the
 * outcome intents in as callbacks; no action is imported. Modality is
 * Phase 1's dialog idiom (`DeleteDialog.tsx`): native `showModal()` for the
 * focus trap, Cancel focused first, Escape routed to `onCancel`, opener
 * refocused on unmount. Both buttons clear the 44 pt floor (FR-263).
 */

export interface DeleteConfirmProps {
  /** The tapped occurrence's title, quoted in the question. */
  summary: string;
  /** True while the parent's delete is in flight — the Delete button locks. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirm({ summary, pending = false, onConfirm, onCancel }: DeleteConfirmProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Captured before the dialog takes the keyboard: this dialog is unmounted
    // rather than closed, so nothing hands focus back on its own (SC-009).
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    cancelRef.current?.focus();

    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="delete-confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2
        id="delete-confirm-title"
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)"
      >
        Delete &ldquo;{summary}&rdquo;?
      </h2>

      <p className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        This is final &mdash; there&rsquo;s no way to get it back.
      </p>

      <div className="mt-5 flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="min-h-[44px] rounded-full bg-(--fam-danger) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </dialog>
  );
}
