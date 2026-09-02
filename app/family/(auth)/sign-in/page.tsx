import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMember } from "@/lib/family/guards";

import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The only door in (FR-001, FR-002, FR-004).
 *
 * One shared household account, so one password field and nothing else — no
 * address to type, no provider to choose, no way to sign up. Public sign-up is
 * disabled at the Auth API and refused again by the Before-User-Created hook,
 * so the only account that exists is the one the seed script created.
 */
export default async function SignInPage() {
  // Already in? Don't make them look at a password box.
  if (await getMember()) redirect("/family/calendar");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center font-(family-name:--fam-font-serif) text-(length:--fam-fs-date) text-(--fam-text-primary)">
        Family calendar
      </h1>
      <SignInForm />
      <p className="text-center text-(length:--fam-fs-small) text-(--fam-text-secondary)">
        Only household accounts can sign in.
      </p>
    </div>
  );
}
