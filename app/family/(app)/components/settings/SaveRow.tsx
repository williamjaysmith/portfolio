"use client";

/**
 * The foot of a settings form: what went wrong, the Save button, and whether
 * it saved.
 *
 * Extracted for the same reason as `useSettingsSave` — two sections had it
 * character for character. The message is an `alert` because a refusal must
 * interrupt; the status is a polite `status` because "Saved" must not.
 */
export interface SaveRowProps {
  message: string | null;
  status: string | null;
  pending: boolean;
  disabled: boolean;
}

export function SaveRow({ message, status, pending, disabled }: SaveRowProps) {
  return (
    <>
      {message ? (
        <p role="alert" className="text-(length:--fam-fs-body)">
          {message}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={disabled || pending}
          className="min-h-[44px] rounded-full bg-(--fam-primary-blue) px-6 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-60"
        >
          Save
        </button>
        <span role="status" className="text-(length:--fam-fs-small) text-(--fam-text-secondary)">
          {status}
        </span>
      </div>
    </>
  );
}
