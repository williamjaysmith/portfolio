"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Where a dialog aims the keyboard once it is open, for the return-focus
 * dance below.
 *
 * A ref focuses that exact element (a Cancel or Close button held by the
 * caller); a CSS selector is run against the dialog's own subtree for a
 * target that is not held in a ref (a pre-checked radio); `true` opts into
 * the dance with no specific target, leaving the initial focus to
 * `showModal()`'s own default.
 */
export type ModalDialogFocus = RefObject<HTMLElement | null> | string | true;

function focusTargetOf(dialog: HTMLDialogElement, focus: ModalDialogFocus): HTMLElement | null {
  if (focus === true) return null;
  if (typeof focus === "string") return dialog.querySelector<HTMLElement>(focus);
  return focus.current;
}

/**
 * Drives a native `<dialog>` from a boolean.
 *
 * `showModal()` is what gives the focus trap, the backdrop and Escape for
 * free; jsdom does not implement it, so every call is guarded rather than
 * assumed.
 *
 * `initialFocus`, when given, additionally runs the return-focus dance a
 * dialog needs when it is UNMOUNTED rather than closed: nothing hands focus
 * back on its own in that case (Phase 1's SC-009 keyboard guarantee), so
 * whatever had the keyboard before the dialog appeared is captured before
 * `showModal()` can steal it, an initial target (if any) is focused once the
 * dialog is open, and on unmount focus returns to that opener if it is still
 * in the document. Leave `initialFocus` unset for a dialog that toggles
 * `open` instead of unmounting (`FilterSheet`, `PunchInSheet`) — those keep
 * their own opener and get the plain show/close behaviour this hook has
 * always had.
 */
export function useModalDialog(
  open: boolean,
  initialFocus?: ModalDialogFocus,
): RefObject<HTMLDialogElement | null> {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (initialFocus === undefined) {
      if (open && !dialog.open && typeof dialog.showModal === "function") dialog.showModal();
      if (!open && dialog.open && typeof dialog.close === "function") dialog.close();
      return;
    }
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
    focusTargetOf(dialog, initialFocus)?.focus();

    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [open, initialFocus]);

  return dialogRef;
}
