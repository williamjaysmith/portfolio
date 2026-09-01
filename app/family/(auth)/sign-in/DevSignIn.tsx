"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { createClient } from "@/lib/family/supabase/client";

/** The account `npm run family:seed -- --local` creates (D21). Not personal data. */
const DEV_EMAIL = "dev@family.local";

const FIELD =
  "min-h-[44px] w-full rounded-xl border border-(--fam-hairline) bg-(--fam-app-bg) px-3 text-(length:--fam-fs-body) text-(--fam-text-primary)";

/**
 * Email + password form for the LOCAL Supabase stack only. The sign-in page
 * decides on the server whether to render this at all (NODE_ENV and a
 * localhost Supabase URL), so the hosted build never shows it (D21).
 */
export function DevSignIn() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setPending(true);
    setError(null);
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setPending(false);
      return;
    }
    // The (app) layout claims membership on arrival (requireMember → claim_membership).
    router.replace("/family/calendar");
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-labelledby="dev-sign-in-title"
      className="mt-8 flex flex-col gap-3 rounded-(--fam-radius-card) border border-dashed border-(--fam-text-secondary) p-4"
    >
      <h2 id="dev-sign-in-title" className="text-(length:--fam-fs-small) font-medium uppercase tracking-wide text-(--fam-text-secondary)">
        Local development sign-in
      </h2>
      <label className="flex flex-col gap-1 text-(length:--fam-fs-small) text-(--fam-text-muted)">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={DEV_EMAIL}
          required
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 text-(length:--fam-fs-small) text-(--fam-text-muted)">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={FIELD} />
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="min-h-[44px] rounded-full border border-(--fam-hairline) bg-(--fam-btn-secondary-bg) px-6 py-2 text-(length:--fam-fs-body) font-medium text-(--fam-text-primary) disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in locally"}
      </button>
      {error ? (
        <p role="alert" className="text-(length:--fam-fs-small) text-(--fam-text-primary)">
          {error}
        </p>
      ) : null}
    </form>
  );
}
