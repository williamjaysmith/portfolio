/**
 * The result shape every /family server action returns
 * (contracts/server-actions.md → "Shared result shape").
 *
 * Errors are never thrown across the server-action boundary as exceptions, so
 * a failure cannot leak a stack trace into the client. Inside the server,
 * guards and actions throw `ActionFailure`; `runAction` converts it.
 *
 * Framework-free so client components can import the types and messages.
 */

export type ActionError =
  | "NOT_AUTHENTICATED" // no Supabase session
  | "NOT_A_MEMBER" // signed in, but not on the allowlist
  | "NO_ACTOR" // nobody punched in (or cookie expired / tampered — not distinguished)
  | "FORBIDDEN" // punched in, but not allowed to do this
  | "BAD_PIN"
  | "PIN_LOCKED"
  | "NO_PIN" // that profile cannot be an actor
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAVAILABLE"; // database unreachable — never silently succeeds

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError; message: string; fieldErrors?: FieldErrors };

/** User-safe default copy per error. Actions may override `message` with something more specific. */
export const ACTION_MESSAGES: Record<ActionError, string> = {
  NOT_AUTHENTICATED: "You're signed out. Sign in again to continue.",
  NOT_A_MEMBER: "That account isn't part of this household.",
  NO_ACTOR: "Punch in to make changes.",
  FORBIDDEN: "Only a parent can change this.",
  BAD_PIN: "That PIN isn't right.",
  PIN_LOCKED: "Too many tries. Wait a few minutes and try again.",
  NO_PIN: "That profile doesn't have a PIN yet.",
  VALIDATION: "Some of that didn't look right — check the highlighted fields.",
  NOT_FOUND: "That's no longer here.",
  CONFLICT: "That change isn't allowed right now.",
  UNAVAILABLE: "Can't reach the house right now. Try again in a moment.",
};

export class ActionFailure extends Error {
  readonly code: ActionError;
  readonly fieldErrors?: FieldErrors;

  constructor(code: ActionError, message?: string, fieldErrors?: FieldErrors) {
    super(message ?? ACTION_MESSAGES[code]);
    this.name = "ActionFailure";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ActionError,
  message?: string,
  fieldErrors?: FieldErrors,
): ActionResult<never> {
  const base = { ok: false as const, error: code, message: message ?? ACTION_MESSAGES[code] };
  return fieldErrors ? { ...base, fieldErrors } : base;
}

/**
 * Next.js signals `redirect()` / `notFound()` by throwing; those must pass
 * through untouched or the framework never sees them.
 */
function isFrameworkSignal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_")
  );
}

/**
 * Wrap an action body: `ActionFailure` → `{ ok: false }`, anything else →
 * `UNAVAILABLE` (logged server-side, never surfaced verbatim).
 */
export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await body());
  } catch (error) {
    if (isFrameworkSignal(error)) throw error;
    if (error instanceof ActionFailure) {
      return fail(error.code, error.message, error.fieldErrors);
    }
    console.error("[family] action failed", error);
    return fail("UNAVAILABLE");
  }
}
