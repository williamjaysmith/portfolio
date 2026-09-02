"use client";

import { useActionState } from "react";

import { signIn } from "@/lib/family/actions/auth";
import type { ActionResult } from "@/lib/family/errors";

const ERROR_ID = "sign-in-error";
const PASSWORD_ID = "sign-in-password";

// A text input's outline is its only affordance, so it is a control boundary
// (WCAG 1.4.11, 3:1) rather than a hairline divider.
const FIELD =
  "min-h-[44px] w-full rounded-xl border border-(--fam-control-border) bg-(--fam-app-bg) px-3 text-(length:--fam-fs-body) text-(--fam-text-primary)";

const BUTTON =
  "min-h-[44px] w-full rounded-full bg-(--fam-primary-blue) px-6 py-3 text-(length:--fam-fs-body) font-medium text-white transition-opacity disabled:opacity-60";

function errorOf(state: ActionResult<null> | null): string | null {
  return state && !state.ok ? state.message : null;
}

/**
 * The whole sign-in surface: one password, nothing else (FR-002).
 *
 * The household shares a single Supabase account, so there is no address to
 * type and none to display — the server pairs the password with the account it
 * holds in configuration. The form state that comes back carries a message and
 * nothing more, so the password is never echoed into the document, and one
 * message covers every kind of failure so nobody can probe for an account.
 *
 * `useActionState` keeps the form working before hydration: without JavaScript
 * the browser posts to the same server action.
 */
export function SignInForm() {
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    signIn,
    null,
  );
  const error = errorOf(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label
        htmlFor={PASSWORD_ID}
        className="text-(length:--fam-fs-small) font-medium text-(--fam-text-muted)"
      >
        Household password
      </label>
      <input
        id={PASSWORD_ID}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ERROR_ID : undefined}
        className={FIELD}
      />
      <button type="submit" disabled={pending} aria-busy={pending} className={BUTTON}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {/* Always rendered so the layout does not jump, and so a screen reader is
          already watching the region when the message arrives. */}
      <p
        id={ERROR_ID}
        role="alert"
        className="min-h-[1.5em] text-center text-(length:--fam-fs-small) text-(--fam-danger)"
      >
        {error}
      </p>
    </form>
  );
}
