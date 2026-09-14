"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import { cacheBustedUrl, isChunkLoadError } from "@/lib/family/recovery";

/**
 * The error boundary for every `/family` screen.
 *
 * **Why it was written.** The operator's phone showed "Application error: a
 * client-side exception has occurred while loading www.willsmith.dev" — Next's
 * own built-in fallback, which appears when an uncaught error reaches the root
 * with no boundary in between. There was no boundary anywhere in this repo, and
 * no error reporting, so the exception was never recorded and could not be
 * investigated afterwards. A five-lens hunt over the deployed diff produced
 * nine candidates and confirmed none of them. That is the problem this file
 * exists to stop repeating: whatever throws next is visible, named, and
 * reportable from the device it happened on.
 *
 * **It covers both route groups.** Sitting at the `family` segment, it catches
 * throws from `(app)` and `(auth)` alike — the six tabs and the sign-in page —
 * because both are its children. The one thing above it is
 * `app/family/layout.tsx` itself, whose whole body is a `<div>` carrying the
 * font variables; an error boundary cannot catch its own layout, and that
 * layout has nothing in it to throw.
 *
 * **A chunk failure reloads itself, once.** That is the single error where the
 * page genuinely cannot recover in place — the JS it is asking for is gone from
 * the CDN, and Turbopack caches the rejected load per URL so retrying returns
 * the same failure. Reloading is not a guess at a fix, it is the only one.
 * Everything else gets the screen, because silently reloading on an unknown
 * error would hide exactly the information this boundary was added to capture.
 *
 * **The once is load-bearing.** A reload loop on a device with no address bar
 * is worse than the error: the household would have no way to stop it and no
 * way to read what happened. The marker lives in `sessionStorage`, so it is
 * per-tab and clears when the standalone app is properly killed — a genuinely
 * new session gets its one automatic attempt, and a failing one falls through
 * to the screen instead of spinning.
 */

/** Per-tab, so a real relaunch is allowed one fresh attempt. */
const RECOVERED_KEY = "family:auto-reloaded";

/** `sessionStorage` throws in a private window and can be disabled outright. */
function alreadyRecovered(): boolean {
  try {
    return sessionStorage.getItem(RECOVERED_KEY) !== null;
  } catch {
    // No storage means no loop guard, and an unguarded auto-reload is the one
    // outcome worth refusing outright. Treat it as "already tried".
    return true;
  }
}

function markRecovered(): void {
  try {
    sessionStorage.setItem(RECOVERED_KEY, "1");
  } catch {
    // Unreachable in practice: alreadyRecovered() has returned false, so a get
    // succeeded. Swallowed rather than thrown — failing here would replace the
    // boundary with the framework default, which is what this file replaces.
  }
}

export default function FamilyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /**
   * Decided once, in a lazy initialiser, rather than by setting state from the
   * effect — which React 19's `set-state-in-effect` rule rejects, and rightly:
   * it would render the normal screen and then immediately re-render the
   * recovering one. The initialiser only READS (the marker is written by the
   * effect), so React's double-invocation under StrictMode computes the same
   * answer twice instead of racing itself.
   *
   * On a server render `sessionStorage` does not exist, `alreadyRecovered()`
   * catches and answers "yes", and this is false — the screen, never a
   * navigation.
   */
  const [recovering] = useState(() => isChunkLoadError(error) && !alreadyRecovered());

  useEffect(() => {
    // Logged unconditionally: on a home-screen app this may be the only trace,
    // and the name is what distinguishes a stale build from a real bug.
    console.error("[family] uncaught error", error.name, error.message, error.digest ?? "");

    if (!recovering) return;
    markRecovered();
    window.location.replace(cacheBustedUrl(window.location.href, Date.now()));
  }, [error, recovering]);

  const chunk = isChunkLoadError(error);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 p-(--fam-edge-inset) pt-16 text-center">
      <span
        aria-hidden="true"
        className="grid size-16 place-items-center rounded-full bg-(--fam-pill-btn-bg) text-(--fam-text-muted)"
      >
        <RotateCw size={28} strokeWidth={1.5} />
      </span>

      <h2 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        {recovering ? "Updating the app…" : "Something went wrong"}
      </h2>

      <p className="max-w-sm text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        {recovering
          ? "A new version was published while this was open. Fetching it now."
          : chunk
            ? "This device is running an old version and reloading did not pick up the new one."
            : "The calendar hit an error it could not carry on from. Reloading usually clears it."}
      </p>

      {!recovering && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-6 text-(length:--fam-fs-body) font-medium"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.replace(cacheBustedUrl(window.location.href, Date.now()))}
            className="min-h-(--fam-touch) rounded-full bg-(--fam-pill-btn-bg) px-6 text-(length:--fam-fs-body) font-medium text-(--fam-text-primary)"
          >
            Reload the app
          </button>
        </div>
      )}

      {/*
        The whole point of the boundary. A standalone home-screen app has no
        devtools and no console the household can reach, so the only way this
        error gets reported is if it is legible on the screen it happened on.
        Folded away so a scare screen stays calm, one tap from being read out.
      */}
      {!recovering && (
        <details className="mt-2 w-full max-w-sm text-left">
          <summary className="cursor-pointer text-(length:--fam-fs-body) text-(--fam-text-secondary)">
            What went wrong
          </summary>
          {/* `break-words`, not `wrap-anywhere`: the latter is Tailwind 4.1-only
              and nothing else here uses it, and this repo has already been bitten
              by a utility that silently generated no rule at all. */}
          <p className="mt-2 rounded-2xl bg-(--fam-pill-btn-bg) p-3 font-mono text-xs break-words text-(--fam-text-primary)">
            {error.name}: {error.message}
            {error.digest ? ` (${error.digest})` : ""}
          </p>
        </details>
      )}
    </div>
  );
}
