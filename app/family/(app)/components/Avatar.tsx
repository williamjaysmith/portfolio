"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

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
  // Always a circle, and always on the profile's own colour.
  const disc = `fam-profile fam-tint-100 flex shrink-0 items-center justify-center overflow-hidden rounded-full${
    ring ? " fam-ring" : ""
  }${sizeClassName ? ` ${sizeClassName}` : ""}`;
  // The rim is an INLINE padding rather than a `p-(--token)` utility, and that
  // is not a style preference: Tailwind generates a utility only for a class
  // string it finds when it scans, and this one it did not — the class was on
  // the element, the token resolved, and the computed padding was still 0, so
  // every face sat edge to edge with no colour showing. Inline, it cannot fail
  // to apply, and it is beside `--profile` which this element already sets.
  const discStyle = {
    ...(sizeClassName ? {} : { width: size, height: size }),
    padding: "var(--fam-avatar-face-inset)",
    ...profileVars(category.color),
  };
  // The face fills the disc's content box; the disc's padding IS the rim.
  const face = "h-full w-full rounded-full object-cover";

  if (category.avatarKind === "illustration" && isAvatarId(category.avatarId)) {
    return (
      <span aria-hidden="true" style={discStyle as CSSProperties} className={disc}>
        <Image src={avatarSrc(category.avatarId)} alt="" width={size} height={size} unoptimized className={face} />
      </span>
    );
  }

  if (category.avatarKind === "photo" && photoUrl) {
    return (
      <span aria-hidden="true" style={discStyle as CSSProperties} className={disc}>
        <Image src={photoUrl} alt="" width={size} height={size} unoptimized className={face} />
      </span>
    );
  }

  const glyph = category.isProfile
    ? initialsFor(category.label)
    : (category.emoji ?? initialsFor(category.label));

  return (
    <span
      aria-hidden="true"
      style={{
        ...discStyle,
        // The glyph sits on the full-strength accent (`fam-tint-100`), so the
        // ink is chosen from that colour: white is 1.37:1 on Sunshine and
        // 1.50:1 on Sprout, which is no fallback at all (FR-039).
        color: inkOn(category.color),
        fontSize: Math.round(size * 0.4),
      } as CSSProperties}
      className={`${disc} font-medium`}
    >
      {glyph}
    </span>
  );
}
