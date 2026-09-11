"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { TaskCounters } from "@/lib/family/tasks/counters";
import type { Category } from "@/lib/family/types";

import { Avatar } from "./Avatar";

/**
 * The profile chip: a solid cap carrying the face, and a lighter body carrying
 * today's chore count — both derived from the profile's single stored colour at
 * 100 % and 40 % (FR-032, FR-036, FR-911, FR-912).
 *
 * **The body used to carry the NAME, and there used to be two of these rows.**
 * 009's Tasks Progress row drew the same faces again above the calendar, with
 * the name and the count. The operator reported the duplication from their
 * phone and asked for the two combined: *"I just dont even think we need names
 * besides the photo because we know who it is"*, and *"putting the task 0/0 up
 * next to the profile icons/photo and getting rid of the separate task progress
 * bar, sort of combining those ideas into one at the top"*. So the pill stayed,
 * the count took the name's place, and the second row is gone.
 *
 * **This is the reference's anatomy, finally.** `07-visual-design-system.md`
 * samples the chip label as "Dad 1/20" and the master map records avatar + name
 * + count; this component's Phase 1 docstring promised *"the per-profile task
 * counter is deferred to the Tasks phase"* and it never arrived. The one
 * divergence is dropping the name, which is the operator's call above.
 *
 * **The face FILLS the cap, and the cap is a slab.** The pill clips it, so the
 * cap takes the pill's curve on the left and meets the lighter body on a
 * straight vertical edge on the right — which is the join the operator asked
 * for: *"that nice straight line between the photo and the progress stat rather
 * than this circle around the profile photo"*. An intermediate version made the
 * cap a circle with the face inset by a 2px ring; it was tried and rejected.
 *
 * The width is `--fam-chip-cap-w`, **drawn for the first time here**. It is the
 * dossier's sampled cap ("≈ 22 % of the chip") and has sat in `tokens.css`
 * unused since Phase 1, while this component hardcoded `chip-h × 1.18` with a
 * 45px floor — the same number, written twice, one of them uncheckable.
 *
 * **FR-039 still holds — colour is not the only carrier.** The face is an
 * illustrated animal, an uploaded photo, or the person's initials. The name is
 * still rendered, `sr-only`, because `Avatar` is deliberately `alt=""` and
 * `aria-hidden` on the understanding that a name sat beside it — without this
 * span the chip announces as a bare "1/4" and the row (a focusable scroll
 * region, SC-009) says nothing about who is in it.
 *
 * **The count's slot is reserved, not sized to its content** — see
 * `--fam-chip-count-w`. `counters` is `null` until the household's clock
 * publishes and the reads land, and it renders as blank rather than as a
 * guessed number, because "0/0" that later becomes "1/4" is a lie held for a
 * few hundred milliseconds.
 */

export interface ProfileChipProps {
  category: Category;
  photoUrl?: string;
  /**
   * Today's completed-of-total, or `null` while the clock and the reads are
   * still coming. Never absent: a chip with no slot at all would shift.
   */
  counters: TaskCounters | null;
}

export function ProfileChip({ category, photoUrl, counters }: ProfileChipProps) {
  return (
    <div
      // React's CSSProperties has no room for custom properties; the value is
      // a plain string either way.
      style={profileVars(category.color) as CSSProperties}
      // `relative` is load-bearing, not decoration. The `sr-only` name below is
      // `position: absolute`, so without a positioned ancestor it resolves
      // against the INITIAL containing block — its static position inside the
      // horizontally scrolled chip row then extended the document's own scroll
      // width, and the phone's "no sideways scroll" journeys (SC-1111, T052)
      // failed with 208px of overflow that no visible element accounted for.
      className="fam-profile fam-tint-40 relative flex h-(--fam-chip-h) shrink-0 items-center overflow-hidden rounded-full"
    >
      <span className="fam-tint-100 flex h-full w-(--fam-chip-cap-w) shrink-0 items-center justify-center">
        <Avatar
          category={category}
          size={48}
          photoUrl={photoUrl}
          fill
          sizeClassName="h-full w-full"
        />
      </span>
      <span className="sr-only">{category.label}</span>
      <span
        aria-hidden={counters === null}
        // `box-content` so the reserved width is the DIGITS' width and the
        // padding sits outside it; with border-box the padding would eat into
        // the slot and a wide count would still push the pill open.
        className="box-content w-(--fam-chip-count-w) px-3 text-(length:--fam-fs-chip) font-medium tabular-nums text-(--fam-text-primary)"
      >
        {counters === null ? " " : `${counters.complete}/${counters.total}`}
      </span>
    </div>
  );
}
