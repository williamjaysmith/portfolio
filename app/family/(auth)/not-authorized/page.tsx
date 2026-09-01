import type { Metadata } from "next";

import { signOut } from "@/lib/family/actions/auth";

export const metadata: Metadata = { title: "Not your household" };

/**
 * Where a signed-in account that is not on the allowlist lands (FR-003).
 *
 * It names no household, shows no family data, and offers only the way back
 * out — someone who reaches this page has proved nothing except that they have
 * a Google account.
 */
export default function NotAuthorizedPage() {
  return (
    <div className="flex flex-col gap-6 text-center">
      <h1 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-text-primary)">
        That Google account isn&rsquo;t part of this household.
      </h1>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        Ask a parent to add your address, then sign in again.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="min-h-[44px] w-full rounded-full bg-(--fam-primary-blue) px-6 py-3 text-(length:--fam-fs-body) font-medium text-white"
        >
          Try another account
        </button>
      </form>
    </div>
  );
}
