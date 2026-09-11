"use client";

import Image from "next/image";

import { avatarSrc, isAvatarId } from "@/lib/family/avatars";
import { initialsFor, inkOn, profileVars } from "@/lib/family/colors";
import type { Category } from "@/lib/family/types";

/**
 * A category's face: an illustrated animal, an uploaded photo, an emoji for a
 * Label, or initials on the category's own colour when it has none — the
 * reference product's own default.
 *
 * `alt=""` throughout: the name is always rendered alongside the avatar, so
 * announcing it twice would be noise (FR-039 — colour is never the only
 * carrier, but neither is the picture). **A caller that draws no visible name
 * owes the reader an `sr-only` one** — `ProfileChip` is the case, and without
 * it that chip announces as nothing.
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
  /**
   * Fill the box instead of being a circle inside it — for the chip's cap,
   * which is a slab the pill itself clips, so the face meets the lighter body
   * on a STRAIGHT vertical edge (the operator's ask, 2026-09-10) rather than
   * floating as a circle in a coloured field.
   */
  fill?: boolean;
  /** Tailwind sizing that overrides `size` — for a chip cap that scales with the shell. */
  sizeClassName?: string;
}

export function Avatar({
  category,
  size = 48,
  photoUrl,
  ring = false,
  fill = false,
  sizeClassName,
}: AvatarProps) {
  const className = `shrink-0 object-cover${fill ? "" : " rounded-full"}${
    ring ? " fam-ring" : ""
  }${sizeClassName ? ` ${sizeClassName}` : ""}`;

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
        // The glyph sits on the full-strength accent (`fam-tint-100`), so the
        // ink is chosen from that colour: white is 1.37:1 on Sunshine and
        // 1.50:1 on Sprout, which is no fallback at all (FR-039).
        color: inkOn(category.color),
        fontSize: Math.round(size * 0.4),
      }}
      className={`fam-profile fam-tint-100 flex shrink-0 items-center justify-center font-medium${
        fill ? "" : " rounded-full"
      }${ring ? " fam-ring" : ""}${sizeClassName ? ` ${sizeClassName}` : ""}`}
    >
      {glyph}
    </span>
  );
}
