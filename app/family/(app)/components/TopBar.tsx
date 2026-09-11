"use client";

import { ActorBadge } from "./ActorBadge";
import { formatDate, useNow } from "./Clock";
import { FilterSheet } from "./FilterSheet";
import { useFamily } from "./FamilyProvider";
import { TopBarSearchSlot } from "./TopBarSearch";

/**
 * The top bar (FR-031): the tab's search box, centred, with the date beside it
 * when the household asked for one. The right-hand pill slot holds the device
 * filter and the punch-in badge.
 *
 * **The clock is gone from here, and that is what made room.** On an iPhone SE
 * the search shared the ‹ Today › row with the view switcher and the arrows,
 * the row wrapped, and the Day/Week/Month switcher dropped out of reach. The
 * operator: *"we dont need the time because these devices already have a
 * clock"*. `useNow` is untouched and still drives everything that depends on
 * the household's minute — the chip row's mount gate, the day headers, the
 * now-line; only the PRINTED time went.
 *
 * **014 took the household's name off it**, on the operator's call: *"at the top
 * of our app we list our families name like 'our family', we dont need that, we
 * know who we are already, lets just put the time there"*. A wall display in
 * one family's kitchen does not need to be told whose kitchen it is.
 *
 * **The name is still the `<h1>`, `sr-only`.** It is the only page-level
 * heading in the shell, so deleting it outright would leave every tab with no
 * h1 at all — a screen reader loses its bearings and the accessibility sweep
 * loses a landmark. Promoting the TIME to h1 instead would announce "4:52 PM,
 * heading level 1", which names the clock rather than the page.
 *
 * `showNameNotDate` keeps its stored polarity and gets an honest label in
 * Settings: it now decides whether the DATE joins the time, since the name it
 * was named for is gone. No migration, no column rename.
 */
export function TopBar() {
  const { household, settings } = useFamily();
  const now = useNow();

  // The clock has no server snapshot the client will agree with, so the date is
  // unknown for the first paint and simply absent rather than guessed.
  const date = settings.showNameNotDate || !now ? null : formatDate(now);

  return (
    <header
      // `min-h` and not `h`: at the 0.5 unit floor the sampled 85 resolves to
      // 42.5px, which is less than the touch floor of the Filter pill inside
      // it. The bar now grows to fit its own controls plus the padding.
      className="flex min-h-(--fam-topbar-h) shrink-0 items-center gap-4 px-(--fam-edge-inset) pt-(--fam-topbar-pad-top) pb-(--fam-topbar-pad)"
    >
      <h1 className="sr-only">{household.name}</h1>
      {date === null ? null : (
        <span className="shrink-0 truncate text-(length:--fam-fs-clock) text-(--fam-text-secondary)">
          {date}
        </span>
      )}
      {/* The tab's own search, aligned LEFT. Centred was tried first and read as
          crooked, because the badges on the right take width the date on the
          left does not — so "centre of what is left over" is not the centre of
          the bar, and the eye measures against the bar. `min-w-0` so a long
          field gives way to the badges rather than pushing them off the edge. */}
      <TopBarSearchSlot className="flex min-w-0 flex-1 justify-start" />
      <div className="flex shrink-0 items-center gap-3">
        <ActorBadge />
        <FilterSheet />
      </div>
    </header>
  );
}
