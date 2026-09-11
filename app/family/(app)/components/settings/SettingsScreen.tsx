"use client";

import { signOut } from "@/lib/family/actions/auth";

import { useFamily } from "../FamilyProvider";
import { CategorySection } from "./CategorySection";
import { HouseholdSection } from "./HouseholdSection";
import { NotificationsSection } from "./NotificationsSection";
import { ReloadSection } from "./ReloadSection";
import { SectionHeading } from "./SectionHeading";
import { SettingsGate } from "./SettingsGate";

/**
 * Settings (FR-043).
 *
 * **Behind `SettingsGate` since the operator asked for it.** This screen used
 * to be readable by anyone signed in, on the reasoning that hiding it would
 * hide household content FR-008 says is free to view, with "parents only"
 * applying to the controls rather than the page. It is now a parent's tab. The
 * reasoning that changed, and the reason it is safe to change: the gate is a
 * door and not a lock — the server still enforces every write, exactly as it
 * did when it was the only thing doing so. See `SettingsGate`.
 */
export function SettingsScreen() {
  const { userEmail } = useFamily();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 p-(--fam-edge-inset) pb-24">
      <SettingsGate>
        <HouseholdSection />
        <NotificationsSection />
        <CategorySection kind="profile" />
        <CategorySection kind="label" />
      </SettingsGate>

      {/*
        **Outside the gate, both of them, and the Account block especially.**

        Sign out is the ACCOUNT's control, not the household's, and it is the
        only one in the app — so behind a parent's PIN it becomes a trap: a
        parent who forgets their PIN, or a household whose only parent is out,
        could not sign the device out at all. The browser pass found it the
        blunt way, by failing "signing out closes the door again" on all four
        devices. A door in front of the settings is a fence; a door in front of
        the way out is a lock.

        Reload is the same shape — a device-local escape hatch for a home-screen
        install that has no address bar (see `ReloadSection`). Gating the way to
        recover a wedged app behind the thing that might be wedged is backwards.
      */}
      <ReloadSection />

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <SectionHeading id="account-heading">Account</SectionHeading>
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
