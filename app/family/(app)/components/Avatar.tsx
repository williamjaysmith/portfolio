"use client";

import Image from "next/image";

import { avatarSrc, isAvatarId } from "@/lib/family/avatars";
import { initialsFor, profileVars } from "@/lib/family/colors";
import type { Category } from "@/lib/family/types";

/**
 * A category's face: an illustrated animal, an uploaded photo, an emoji for a
 * Label, or initials on the category's own colour when it has none — the
 * reference product's own default.
 *
 * `alt=""` throughout: the name is always rendered beside the avatar, so
 * announcing it twice would be noise (FR-039 — colour is never the only
 * carrier, but neither is the picture).
 *
 * Both images are `unoptimized`: the illustrations are already tiny SVGs, and
 * a photo's URL is a short-lived signed one that must not be cached past its
 * expiry by the image optimizer.
 */

export interface AvatarProps {
  category: Category;
  /** Rendered size in CSS pixels. */
  size?: number;
  /** Signed URL for a photo avatar; falls back to initials while it loads. */
  photoUrl?: string;
  /** Draw the profile-coloured ring used on chips. */
  ring?: boolean;
  /** Tailwind sizing that overrides `size` — for a chip cap that scales with the shell. */
  sizeClassName?: string;
}

export function Avatar({
  category,
  size = 48,
  photoUrl,
  ring = false,
  sizeClassName,
}: AvatarProps) {
  const className = `shrink-0 rounded-full object-cover${ring ? " fam-ring" : ""}${
    sizeClassName ? ` ${sizeClassName}` : ""
  }`;

  if (category.avatarKind === "illustration" && isAvatarId(category.avatarId)) {
    return (
      <Image
        src={avatarSrc(category.avatarId)}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={className}
        aria-hidden="true"
      />
    );
  }

  if (category.avatarKind === "photo" && photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={className}
        aria-hidden="true"
      />
    );
  }

  const glyph = category.isProfile
    ? initialsFor(category.label)
    : (category.emoji ?? initialsFor(category.label));

  return (
    <span
      aria-hidden="true"
      style={{
        ...(sizeClassName ? {} : { width: size, height: size }),
        ...profileVars(category.color),
        fontSize: Math.round(size * 0.4),
      }}
      className={`fam-profile fam-tint-100 flex shrink-0 items-center justify-center rounded-full font-medium text-white${
        ring ? " fam-ring" : ""
      }${sizeClassName ? ` ${sizeClassName}` : ""}`}
    >
      {glyph}
    </span>
  );
}
