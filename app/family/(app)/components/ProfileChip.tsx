"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { Category } from "@/lib/family/types";

import { Avatar } from "./Avatar";

/**
 * The profile chip: a solid cap carrying the avatar, and a lighter body
 * carrying the name — both derived from the profile's single stored colour at
 * 100 % and 40 % (FR-036).
 *
 * The avatar sits at ~70 % of the cap so the full-strength colour reads as a
 * ring around it; an avatar sized to the whole cap would hide the very thing
 * the cap exists to show.
 *
 * The name is always present, so colour is never the only way to tell people
 * apart (FR-039). The per-profile task counter is deferred to the Tasks phase.
 */

export interface ProfileChipProps {
  category: Category;
  photoUrl?: string;
}

export function ProfileChip({ category, photoUrl }: ProfileChipProps) {
  return (
    <div
      // React's CSSProperties has no room for custom properties; the value is
      // a plain string either way.
      style={profileVars(category.color) as CSSProperties}
      className="fam-profile fam-tint-40 flex h-(--fam-chip-h) min-h-[38px] shrink-0 items-center overflow-hidden rounded-full"
    >
      <span className="fam-tint-100 flex h-full w-[calc(var(--fam-chip-h)*1.18)] min-w-[45px] items-center justify-center">
        <Avatar
          category={category}
          size={48}
          photoUrl={photoUrl}
          sizeClassName="h-[70%] w-auto aspect-square"
        />
      </span>
      <span className="whitespace-nowrap px-4 text-(length:--fam-fs-chip) font-medium text-(--fam-text-primary)">
        {category.label}
      </span>
    </div>
  );
}
