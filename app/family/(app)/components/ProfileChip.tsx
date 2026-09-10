"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { Category } from "@/lib/family/types";

import { Avatar } from "./Avatar";

/**
 * The profile chip: the person's face, ringed in their own colour (FR-032,
 * FR-036).
 *
 * **It used to be a pill** — a full-strength cap carrying the avatar at 70 % of
 * its height, then a 40 %-tint body carrying the name. The operator's call on
 * 2026-09-10 retired the body: *"I just dont even think we need names besides
 * the photo because we know who it is"*, and, on putting the chore count there
 * instead, *"id rather show some other valuable information or nothing, just
 * let it be a circle with our photo and the color"*. So the chip is the face
 * and the ring, and nothing else.
 *
 * **This is a deliberate divergence, not a fidelity claim.** The reference's
 * chip carries avatar + name + a count — `07-visual-design-system.md` samples
 * the label as "Dad 1/20" and the master map records the same. We are choosing
 * a quieter chip for a household of three who recognise each other's faces; the
 * count lives on the Tasks tab, where the board's own header draws it against
 * FR-305's ring.
 *
 * **FR-039 still holds — colour is not the only carrier.** The face is: an
 * illustrated animal, an uploaded photo, or the person's initials when they
 * have neither. The name is still rendered, `sr-only`, because `Avatar` is
 * deliberately `alt=""` and `aria-hidden` on the understanding that the name sat
 * beside it (see its docstring) — without this span the row would announce as a
 * focus stop containing nothing at all, and SC-009 requires it to say who is in
 * it.
 *
 * **The ring is `fam-ring`**, the sampled "2px ring in --profile" that
 * `tokens.css` marks *do not scale*, resolved through `.fam-profile` on this
 * element. `--fam-chip-h` is now the face's DIAMETER and carries its own 38px
 * floor, which this component used to hardcode. The old cap's
 * `--fam-chip-cap-w` / `--fam-chip-avatar` / `--fam-fs-chip` metrics are no
 * longer drawn; they stay in `tokens.css` as reference samples.
 */

export interface ProfileChipProps {
  category: Category;
  photoUrl?: string;
}

export function ProfileChip({ category, photoUrl }: ProfileChipProps) {
  return (
    // React's CSSProperties has no room for custom properties; the value is
    // a plain string either way. `.fam-profile` is what turns `--profile` into
    // the `--fam-profile-100` that `fam-ring` paints with.
    <span
      style={profileVars(category.color) as CSSProperties}
      className="fam-profile flex shrink-0 items-center"
    >
      <Avatar
        category={category}
        size={48}
        photoUrl={photoUrl}
        ring
        sizeClassName="h-(--fam-chip-h) w-auto aspect-square"
      />
      <span className="sr-only">{category.label}</span>
    </span>
  );
}
