import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isLocalSupabase } from "@/lib/family/env";
import { getMember } from "@/lib/family/guards";

import { DevSignIn } from "./DevSignIn";
import { GoogleSignInButton } from "./GoogleSignInButton";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The email/password form is a local-stack affordance (D21). The decision is
 * made on the server, from the build mode and the Supabase URL, so a hosted
 * build never ships the form no matter what the browser asks for.
 */
function devSignInAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    isLocalSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  );
}

/**
 * The only door in (FR-001, FR-002, FR-004). There is no sign-up: an account
 * that is not already on the household allowlist gets no further than the
 * callback.
 */
export default async function SignInPage() {
  // Already in? Don't make them look at a sign-in button.
  if (await getMember()) redirect("/family/calendar");

  const showDevSignIn = devSignInAllowed();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center font-(family-name:--fam-font-serif) text-(length:--fam-fs-date) text-(--fam-text-primary)">
        Family calendar
      </h1>
      <GoogleSignInButton />
      <p className="text-center text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        Only household accounts can sign in.
      </p>
      {showDevSignIn ? <DevSignIn /> : null}
    </div>
  );
}
