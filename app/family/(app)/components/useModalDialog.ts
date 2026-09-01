"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Drives a native `<dialog>` from a boolean.
 *
 * `showModal()` is what gives the focus trap, the backdrop and Escape for
 * free; jsdom does not implement it, so every call is guarded rather than
 * assumed.
 */
export function useModalDialog(open: boolean): RefObject<HTMLDialogElement | null> {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    if (!open && dialog.open && typeof dialog.close === "function") dialog.close();
  }, [open]);

  return dialogRef;
}
