"use client";

import type { TaskCounters } from "@/lib/family/tasks/counters";
import type { Category } from "@/lib/family/types";

import { Avatar } from "../../components/Avatar";
import { useFamily } from "../../components/FamilyProvider";
import { useTaskProgress } from "./useTaskProgress";

/**
 * Tasks Progress in the preview bar (009 FR-911, FR-912, FR-914, R905).
 *
 * The reference's Filter toggle "displays the task progress of visible profiles
 * above the events in all calendar views" [VERIFIED](36625171368987). The
 * literal format on the Calendar tab is `[UNKNOWN]` in every fetched source —
 * the dossier says so explicitly — so "avatar, name, completed-of-total" is
 * spec Assumption 4, not a match anybody verified.
 *
 * **THIS COMPONENT IS THE `enabled`.** It is rendered only while the device's
 * Tasks Progress switch is on, and `useTaskProgress` runs only because it
 * mounted — so with the switch off the calendar makes no task request at all.
 * That is the shipped `useTaskBox` idiom (R905) and it is why there is no
 * `enabled` flag anywhere below: mounting is the flag.
 *
 * **Visible Profiles, not the household.** `visibleProfiles` is the same
 * per-device hidden set the grid filters by (FR-911, 001 FR-033), so hiding
 * somebody takes their events and their progress together.
 *
 * The counters are `counters.ts`'s, imported and not re-derived (FR-912).
 */

const ENTRY =
  "flex min-h-(--fam-touch) shrink-0 items-center gap-2 text-(length:--fam-fs-pill) " +
  "text-(--fam-text-muted)";

function ProgressEntry({
  profile,
  counters,
  photoUrl,
}: {
  profile: Category;
  counters: TaskCounters;
  photoUrl?: string;
}) {
  return (
    <li className={ENTRY}>
      <Avatar category={profile} size={24} photoUrl={photoUrl} sizeClassName="h-6 w-6" />
      <span className="whitespace-nowrap">
        {profile.label}{" "}
        <span className="font-medium tabular-nums text-(--fam-text-primary)">
          {counters.complete}/{counters.total}
        </span>
      </span>
    </li>
  );
}

export interface TasksProgressRowProps {
  /** Household-local today; the row is not rendered before the clock publishes. */
  todayDate: string;
  zone: string;
}

export function TasksProgressRow({ todayDate, zone }: TasksProgressRowProps) {
  const { householdId, settings, visibleProfiles, avatarUrls } = useFamily();
  const { counters } = useTaskProgress({
    householdId,
    todayDate,
    zone,
    startWeekOn: settings.startWeekOn,
  });

  // Every Profile hidden on this device means nothing to say, which the bar
  // renders as no row at all rather than as an empty one (FR-910).
  if (visibleProfiles.length === 0) return null;

  return (
    <ul
      aria-label="Tasks Progress"
      className="flex min-w-0 shrink-0 items-center gap-4 overflow-x-auto"
    >
      {visibleProfiles.map((profile) => (
        <ProgressEntry
          key={profile.id}
          profile={profile}
          counters={counters(profile.id)}
          photoUrl={avatarUrls[profile.id]}
        />
      ))}
    </ul>
  );
}
