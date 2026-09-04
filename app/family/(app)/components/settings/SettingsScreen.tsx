"use client";

import { signOut } from "@/lib/family/actions/auth";

import { useFamily } from "../FamilyProvider";
import { CategorySection } from "./CategorySection";
import { HouseholdSection } from "./HouseholdSection";

/**
 * Settings (FR-043).
 *
 * The screen itself is readable by anyone signed in — hiding it would hide
 * household content, which FR-008 says is free to view. "Parents only" applies
 * to the controls that change something, and the server is what enforces it.
 */
export function SettingsScreen() {
  const { userEmail } = useFamily();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-(--fam-edge-inset) pb-24">
      <HouseholdSection />
      <CategorySection kind="profile" />
      <CategorySection kind="label" />

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2
          id="account-heading"
          className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)"
        >
          Account
        </h2>
        <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          Signed in as {userEmail ?? "this device"}
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="min-h-[44px] rounded-full border border-(--fam-hairline) px-6 text-(length:--fam-fs-body) font-medium"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
