"use client";

import type { FieldErrors } from "@/lib/family/errors";

/**
 * How every `/family` form ends: the line a refusal with no field lands on,
 * then Cancel and Save. A field-anchored refusal is shown at its field, so the
 * line stays empty rather than saying the same sentence twice; `empty:hidden`
 * collapses it until there is something to say.
 *
 * Save is the form's submit button — the caller's `<form onSubmit>` runs the
 * commit — and is held while a submit is pending so a double tap cannot send
 * the same reward twice.
 */
export interface FormFooterProps {
  errors: FieldErrors;
  message: string | null;
  pending: boolean;
  onClose: () => void;
}

const BUTTON = "min-h-(--fam-touch) rounded-full px-5 text-(length:--fam-fs-body) font-medium";

export function FormFooter({ errors, message, pending, onClose }: FormFooterProps) {
  const anchored = Object.keys(errors).length > 0;
  return (
    <>
      <p
        role="alert"
        className="empty:hidden text-(length:--fam-fs-body) text-(--fam-text-primary)"
      >
        {anchored ? null : message}
      </p>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className={`${BUTTON} border border-(--fam-hairline)`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className={`${BUTTON} bg-(--fam-primary-blue) text-white disabled:opacity-60`}
        >
          Save
        </button>
      </div>
    </>
  );
}
