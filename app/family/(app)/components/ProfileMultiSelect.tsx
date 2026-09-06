"use client";

import type { Category } from "@/lib/family/types";

/**
 * A chip per Profile, more than one allowed — the multi-select a task's
 * assignment and a reward's eligibility both are. The caller decides WHICH
 * Profiles are offered (a Label never is; a Profile off the Tasks tab is not
 * assignable a task) and owns the chosen list; this only draws it.
 *
 * Each chip is a real checkbox behind its label, so it is keyboard-operable
 * and named by the Profile it stands for; the colour dot is decoration.
 */
export interface ProfileMultiSelectProps {
  profiles: readonly Category[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
}

const CHIP =
  "flex min-h-(--fam-touch) items-center gap-2 rounded-full border border-(--fam-hairline) px-3 text-(length:--fam-fs-body)";

export function ProfileMultiSelect({ profiles, selectedIds, onToggle }: ProfileMultiSelectProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {profiles.map((profile) => (
        <label key={profile.id} className={CHIP}>
          <input
            type="checkbox"
            checked={selectedIds.includes(profile.id)}
            onChange={() => onToggle(profile.id)}
            className="h-5 w-5"
          />
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: profile.color }}
          />
          {profile.label}
        </label>
      ))}
    </div>
  );
}
