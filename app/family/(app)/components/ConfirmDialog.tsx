"use client";

import { useRef } from "react";

import { useModalDialog } from "./useModalDialog";

/**
 * The Lists tab's confirmation (005 R510; FR-512, FR-521; constitution §VI):
 * one dialog for the two destructive verbs — Delete list and Clear Completed —
 * that states what will be lost and what will be kept, in the caller's words.
 * The calendar's `DeleteConfirm` is fixed to an event's title and one sentence;
 * this one takes its title, body and verb, because clearing three items and
 * deleting a list of four say different things.
 *
 * Purely presentational: the parent owns the write (its `confirm: true` is the
 * server-side twin of this dialog) and passes the intents in. Phase 1's dialog
 * idiom: native `showModal()`, Cancel focused first, Escape routed to
 * `onCancel`, both buttons at the touch floor.
 */

export interface ConfirmDialogProps {
  /** The question, e.g. `Delete “Party” and its 4 items?` */
  title: string;
  /** What is lost and what is kept. */
  body: string;
  /** The verb on the confirming button, e.g. "Delete for good" or "Clear 3 items". */
  confirmLabel: string;
  /** True while the parent's write is in flight — the confirming button locks. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, cancelRef);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="list-confirm-title"
      aria-describedby="list-confirm-body"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="list-confirm-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {title}
      </h2>
      <p id="list-confirm-body" className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        {body}
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending ? "true" : undefined}
          className="min-h-(--fam-touch) rounded-full bg-(--fam-danger) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
