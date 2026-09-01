"use client";

import Image from "next/image";

import { AVATAR_IDS, AVATAR_LABELS, avatarSrc, type AvatarId } from "@/lib/family/avatars";

/**
 * Choose an illustrated avatar, or none — in which case the profile shows its
 * initials on its own colour, the reference product's default (FR-022).
 *
 * Photo upload lives on the profile row in the list, not here, because it
 * needs a saved profile id to store against.
 */

export interface AvatarPickerProps {
  value: AvatarId | null;
  onChange: (value: AvatarId | null) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div role="radiogroup" aria-label="Avatar" className="flex flex-wrap gap-2">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="No avatar — use initials"
        onClick={() => onChange(null)}
        className={`flex h-[56px] w-[56px] items-center justify-center rounded-full border border-(--fam-hairline) text-(length:--fam-fs-small) text-(--fam-text-secondary) ${
          value === null ? "ring-2 ring-(--fam-text-primary) ring-offset-2" : ""
        }`}
      >
        Aa
      </button>
      {AVATAR_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={AVATAR_LABELS[id]}
          onClick={() => onChange(id)}
          className={`flex h-[56px] w-[56px] items-center justify-center rounded-full ${
            value === id ? "ring-2 ring-(--fam-text-primary) ring-offset-2" : ""
          }`}
        >
          <Image src={avatarSrc(id)} alt="" width={48} height={48} unoptimized aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
