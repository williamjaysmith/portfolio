"use client";

import { useEffect, useRef, useState } from "react";

import { deleteCategory } from "@/lib/family/actions/categories";
import { canDelete } from "@/lib/family/permissions";
import type { Category } from "@/lib/family/types";

import { useFamily } from "../FamilyProvider";

/**
 * Deleting is confirmed, and the dialog says exactly what goes and what stays
 * (FR-026, constitution §VI). The only parent cannot be deleted at all — the
 * database refuses it too, so this is an explanation, not the enforcement.
 */

export interface DeleteDialogProps {
  category: Category;
  onClose: () => void;
}

export function DeleteDialog({ category, onClose }: DeleteDialogProps) {
  const { profiles, actor, withActor } = useFamily();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Captured before the dialog takes the keyboard. This dialog is unmounted
    // rather than closed, so nothing hands focus back on its own: without this
    // it lands on <body> and the next Tab restarts from the top (SC-009).
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    cancelRef.current?.focus();

    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const lastParent = category.isProfile && !canDelete(category, profiles).allowed;
  const isSelf = actor?.profileId === category.id;

  async function confirm(): Promise<void> {
    setPending(true);
    setMessage(null);
    const result = await withActor(() => deleteCategory(category.id, { confirm: true }));
    setPending(false);
    if (result.ok) {
      onClose();
      return;
    }
    setMessage(result.message);
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="delete-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="delete-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {category.isProfile ? `Delete ${category.label}?` : `Delete the ${category.label} label?`}
      </h2>

      <p className="mt-3 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        {category.isProfile
          ? `This removes ${category.label}'s profile, colour, avatar and PIN. Anything assigned to ${category.label} in the future would be left unassigned. This can't be undone.`
          : `Items tagged only with ${category.label} would become untagged. This can't be undone.`}
      </p>

      {isSelf ? (
        <p className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          You&rsquo;re punched in as {category.label} — you&rsquo;ll be punched out.
        </p>
      ) : null}

      {lastParent ? (
        <p className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-primary)">
          You can&rsquo;t delete the only parent. Make someone else a parent first.
        </p>
      ) : null}

      {message ? (
        <p role="alert" className="mt-2 text-(length:--fam-fs-body)">
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending || lastParent}
          className="min-h-[44px] rounded-full bg-(--fam-danger) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-50"
        >
          Delete {category.label}
        </button>
      </div>
    </dialog>
  );
}
