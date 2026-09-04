import type { Metadata } from "next";

import { signOut } from "@/lib/family/actions/auth";

export const metadata: Metadata = { title: "Not your household" };

/**
 * Where a signed-in account that is not on the allowlist lands (FR-003).
 *
 * With a single shared household account this should be unreachable in normal
 * use — the only credential that exists belongs to the household. It still
 * exists because the (app) layout routes `NOT_A_MEMBER` here, which is what
 * happens if the allowlist row is ever removed while a session is live: better
 * a plain refusal than a redirect loop back to a sign-in that would succeed.
 *
 * It names no household and shows no family data.
 */
export default function NotAuthorizedPage() {
  return (
    <div className="flex flex-col gap-6 text-center">
      <h1 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-text-primary)">
        This account isn&rsquo;t part of the household.
      </h1>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        Its access has been removed. Sign in again if you think that&rsquo;s wrong.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="min-h-[44px] w-full rounded-full bg-(--fam-primary-blue) px-6 py-3 text-(length:--fam-fs-body) font-medium text-white"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
