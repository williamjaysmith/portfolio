"use client";

import { useState } from "react";

import { createClient } from "@/lib/family/supabase/client";

const OPENING = "Opening Google…";
const FAILED = "Couldn't start Google sign-in. Try again.";

/**
 * Starts the PKCE flow in the browser: @supabase/ssr writes the code verifier
 * cookie, then navigates to Google. The code lands on
 * `/family/auth/callback`, which exchanges it on the server (FR-002).
 */
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/family/auth/callback`,
        // A shared tablet may hold several Google accounts — always ask which.
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setError(FAILED);
      setPending(false);
    }
    // On success the browser has already left for Google; stay pending.
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        className="min-h-[44px] w-full rounded-full bg-(--fam-primary-blue) px-6 py-3 text-(length:--fam-fs-body) font-medium text-white transition-opacity disabled:opacity-60"
      >
        Continue with Google
      </button>
      <p role="status" className="min-h-[1.5em] text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        {pending && !error ? OPENING : null}
      </p>
      {error ? (
        <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-text-primary)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
