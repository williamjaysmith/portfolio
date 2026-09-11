"use client";

import { ActorBadge } from "./ActorBadge";
import { Clock, formatDate, useNow } from "./Clock";
import { FilterSheet } from "./FilterSheet";
import { useFamily } from "./FamilyProvider";

/**
 * The top bar (FR-031): the time, and the date beside it when the household
 * asked for one. The right-hand pill slot holds the device filter and the
 * punch-in badge.
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
      className="flex min-h-(--fam-topbar-h) shrink-0 items-center gap-4 px-(--fam-edge-inset) py-(--fam-topbar-pad)"
    >
      <h1 className="sr-only">{household.name}</h1>
      <Clock
        format={settings.timeFormat}
        className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-date) text-(--fam-text-primary) tabular-nums"
      />
      {date === null ? null : (
        <span className="truncate text-(length:--fam-fs-clock) text-(--fam-text-secondary)">{date}</span>
      )}
      <div className="ml-auto flex items-center gap-3">
        <ActorBadge />
        <FilterSheet />
      </div>
    </header>
  );
}
