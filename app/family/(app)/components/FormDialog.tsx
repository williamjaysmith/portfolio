"use client";

import type { ReactNode } from "react";

import { useModalDialog } from "./useModalDialog";

/**
 * The shipped sheet idiom in one place (006 R608): a native `<dialog>` on
 * `useModalDialog`, opened modal on mount, Escape closing through the caller,
 * the serif title the sheet is named by. Every form sheet — the meal, the
 * recipe, the mealtime, the push — is this wrapper around its own fields, so
 * the frame can never drift between them.
 */

export interface FormDialogProps {
  /** The id the title carries and the dialog is labelled by — unique per sheet. */
  titleId: string;
  title: string;
  onClose: () => void;
  /** Tailwind width class; the shipped form width unless a sheet is wider. */
  widthClassName?: string;
  /** A line under the title, when the sheet has one. */
  subtitle?: ReactNode;
  children: ReactNode;
}

export function FormDialog({ titleId, title, onClose, widthClassName = "w-[min(92vw,30rem)]", subtitle, children }: FormDialogProps) {
  const dialogRef = useModalDialog(true, true);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto ${widthClassName} rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30`}
    >
      <h2 id={titleId} className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {title}
      </h2>
      {subtitle}
      {children}
    </dialog>
  );
}
