"use client";

import Link from "next/link";

import { useCountdownSwitches } from "@/app/family/(app)/calendar/components/useCountdownSwitches";
import { localDateOf } from "@/lib/family/calendar/dates";
import type { TaskCounters } from "@/lib/family/tasks/counters";

import { useNow } from "./Clock";
import { useFamily } from "./FamilyProvider";
import { ProfileChip } from "./ProfileChip";
import { useTaskProgress } from "./useTaskProgress";

/**
 * The row of family chips under the top bar (FR-032), filtered by this device's
 * show/hide choice (FR-033), each carrying today's chore count (FR-911,
 * FR-912). It is the only horizontally scrolling region in the shell — the page
 * itself never scrolls sideways (SC-006).
 *
 * **This is the one row.** 009 drew the counts in a second row of the same
 * faces above the calendar; the operator reported the duplication and asked for
 * them combined here, so `TasksProgressRow` is gone for good.
 *
 * **The per-device switch, however, came back** — gating the COUNT rather than a
 * row (see `useCountdownSwitches`). Off by default, which is what retires 014's
 * stated cost: the chip row is in the shell, so a read issued here is a read
 * paid for on Lists and Meals too, and with the switch off there is no read.
 *
 * **The switch and the clock are both mount gates**, and both have to be.
 * `useTaskProgress` runs only inside `CountingChips`, which exists only once
 * the device has asked for counts AND the household's today is known — so the
 * server render and the first paint issue nothing. Passing a placeholder date
 * instead is the 012 bug: `useTaskReads` fetched an epoch week on every load of
 * every tab because `"1970-01-01"` looked like a real day. `hidden` or
 * `enabled: false` would be the same mistake in a different place.
 *
 * Three of the four reads are keyed by the household alone (003 R314), so when
 * the switch IS on the Tasks tab shares this cache rather than duplicating it,
 * and a chore ticked on either surface moves both.
 */

function ChipScroller({ counters }: { counters: (profileId: string) => TaskCounters | null | undefined }) {
  const { visibleProfiles, avatarUrls } = useFamily();

  return (
    // A scrolling region has to be focusable, or on a phone the people past
    // the right edge cannot be reached from a keyboard at all — and a focus
    // stop with no accessible name is announced as nothing (SC-009).
    <div
      role="group"
      aria-label="Family"
      tabIndex={0}
      className="flex h-(--fam-chiprow-h) items-center gap-4 overflow-x-auto px-(--fam-edge-inset)"
    >
      {visibleProfiles.map((profile) => (
        <ProfileChip
          key={profile.id}
          category={profile}
          photoUrl={avatarUrls[profile.id]}
          counters={counters(profile.id)}
        />
      ))}
    </div>
  );
}

/** THIS COMPONENT IS THE `enabled`: mounting it is what issues the reads. */
function CountingChips({ todayDate, zone }: { todayDate: string; zone: string }) {
  const { householdId, settings } = useFamily();
  const { counters } = useTaskProgress({
    householdId,
    todayDate,
    zone,
    startWeekOn: settings.startWeekOn,
  });
  return <ChipScroller counters={counters} />;
}

export function ProfileChipRow() {
  const { profiles, settings } = useFamily();
  const { switches } = useCountdownSwitches();
  const now = useNow();
  const todayDate = now === null ? null : localDateOf(settings.timezone, now.getTime());

  if (profiles.length === 0) {
    return (
      <div className="flex h-(--fam-chiprow-h) items-center px-(--fam-edge-inset)">
        <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
          Nobody&rsquo;s here yet —{" "}
          <Link href="/family/settings" className="underline">
            add the family in Settings
          </Link>
          .
        </p>
      </div>
    );
  }

  // `undefined`, not `null`: the device has asked for no counts, so the chips
  // carry no slot at all rather than a blank one waiting to fill.
  if (!switches.taskProgress) return <ChipScroller counters={() => undefined} />;
  if (todayDate === null) return <ChipScroller counters={() => null} />;
  return <CountingChips todayDate={todayDate} zone={settings.timezone} />;
}
