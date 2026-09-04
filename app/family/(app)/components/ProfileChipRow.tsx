"use client";

import Link from "next/link";

import { useFamily } from "./FamilyProvider";
import { ProfileChip } from "./ProfileChip";

/**
 * The row of family chips under the top bar (FR-032), filtered by this
 * device's show/hide choice (FR-033). It is the only horizontally scrolling
 * region in the shell — the page itself never scrolls sideways (SC-006).
 */
export function ProfileChipRow() {
  const { profiles, visibleProfiles, avatarUrls } = useFamily();

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
        <ProfileChip key={profile.id} category={profile} photoUrl={avatarUrls[profile.id]} />
      ))}
    </div>
  );
}
