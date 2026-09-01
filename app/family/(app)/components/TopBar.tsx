"use client";

import { ActorBadge } from "./ActorBadge";
import { Clock, formatDate, useNow } from "./Clock";
import { FilterSheet } from "./FilterSheet";
import { useFamily } from "./FamilyProvider";

/**
 * The top bar (FR-031): the household's name or today's date, per the
 * household setting, plus a clock that stays current across midnight. The
 * right-hand pill slot holds the device filter and the punch-in badge; the
 * view switcher arrives with the calendar in Phase 2.
 */
export function TopBar() {
  const { household, settings } = useFamily();
  const now = useNow();

  const heading = settings.showNameNotDate ? household.name : now ? formatDate(now) : " ";

  return (
    <header className="flex h-(--fam-topbar-h) shrink-0 items-center gap-4 px-(--fam-edge-inset)">
      <h1 className="truncate font-(family-name:--fam-font-serif) text-(length:--fam-fs-date) text-(--fam-text-primary)">
        {heading}
      </h1>
      <Clock format={settings.timeFormat} />
      <div className="ml-auto flex items-center gap-3">
        <ActorBadge />
        <FilterSheet />
      </div>
    </header>
  );
}
