import type { ReactNode } from "react";

/**
 * The `<h2>` that opens each block of Settings.
 *
 * **One component because there were five copies of its class string**, in
 * `HouseholdSection`, `NotificationsSection`, `CategorySection`, `ReloadSection`
 * and `SettingsScreen`'s own Account block — identical, and each one a place the
 * next change could miss. The operator asked for these to read as section
 * starts (*"lets also bolden each header title in the settings so they stand out
 * as new sections"*), and a weight applied in five places is a weight that
 * drifts in five places.
 *
 * **`font-semibold`, and its own size rung.** The serif at `--fam-fs-section`
 * was the same weight as the body text under it, so a heading announced a new
 * block by size alone — which on a long scrolling page is not enough to find
 * the edges of anything. It now takes `--fam-fs-settings-section`, one step up
 * (32 against 28), because Settings has no other structure to navigate by: a
 * section heading inside a tab already has the tab around it.
 *
 * The `id` stays the caller's: every one of these is the target of its
 * section's `aria-labelledby`, so it is part of that section's accessible name
 * rather than decoration this component could invent.
 */
export function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-settings-section) font-semibold"
    >
      {children}
    </h2>
  );
}
