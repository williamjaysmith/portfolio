"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { TaskCounters } from "@/lib/family/tasks/counters";
import type { Category } from "@/lib/family/types";

import { Avatar } from "./Avatar";

/**
 * The profile chip: a circle carrying the face, and — only when this device has
 * **Task progress** switched on — a lighter pill growing out of it with today's
 * chore count (FR-032, FR-036, FR-911, FR-912). Both colours come from the
 * profile's single stored one, at 100 % and 40 %.
 *
 * **Three shapes were tried here, and the third is the operator's.** Phase 1
 * drew a pill whose body carried the NAME, with 009 drawing the same faces
 * AGAIN in a Tasks Progress row above the calendar. 014 merged the two — the
 * count took the name's place, and the cap became a straight-edged slab so the
 * face met the body on a vertical line (*"that nice straight line between the
 * photo and the progress stat"*). Then, from a phone with real photographs
 * loaded: *"the circular photos run off the edge and square off, they should
 * follow the same size as their background color circle"*, and *"on calendar
 * view its just the colored circle with user photos fitting nice in that circle
 * by default … but you can in filter turn on 'show task progress' … where then
 * the task stat comes out similar to how it is now (but the user photo
 * background color stays a circle, not the straight dividing line)"*.
 *
 * So: **the cap is a circle, always.** It is `--fam-chip-h` square, so with no
 * count the chip simply IS that circle, and with a count it is that same circle
 * sitting on a 40 % pill. A photograph is clipped to it rather than squared off
 * against a slab edge; an illustration or a set of initials shows the colour
 * through, which is what keeps colour a carrier at all (FR-039).
 *
 * **`--fam-chip-cap-w` is no longer drawn**, and that is the point — a circle's
 * width is its height, so there is nothing left to drift. The sampled cap width
 * described the slab, and the slab is gone.
 *
 * **FR-039 still holds.** The face is an illustrated animal, an uploaded photo,
 * or the person's initials. The name is rendered `sr-only` because `Avatar` is
 * deliberately `alt=""` and `aria-hidden` on the understanding that a name sat
 * beside it — without this span a chip with no count announces as NOTHING, and
 * the row it sits in is a focusable scroll region (SC-009).
 *
 * **The count's slot is reserved, not sized to its content** — see
 * `--fam-chip-count-w`. `counters` is `null` while the clock and the reads are
 * still coming, and renders blank rather than as a guessed number, because
 * "0/0" that becomes "1/4" is a lie held for a few hundred milliseconds.
 */

export interface ProfileChipProps {
  category: Category;
  photoUrl?: string;
  /**
   * Three states, and they are different things:
   *
   * · `undefined` — this device has Task progress switched **off**. No body,
   *   no slot, no task read was ever issued: the chip is the bare circle.
   * · `null` — switched on, but the household's clock or the reads have not
   *   landed. The slot is held open and blank so the chip does not resize
   *   under the reader.
   * · a count — switched on and known.
   */
  counters?: TaskCounters | null;
}

export function ProfileChip({ category, photoUrl, counters }: ProfileChipProps) {
  const showsProgress = counters !== undefined;

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
      //
      // The 40 % body is painted only when there IS a body. With progress off
      // the circle is the whole chip, so a pill tint behind it would show as a
      // faint square halo at the circle's corners.
      className={`fam-profile relative flex h-(--fam-chip-h) shrink-0 items-center rounded-full ${
        showsProgress ? "fam-tint-40" : ""
      }`}
    >
      {/* The circle IS the avatar. The coloured disc, the rim and the crop all
          live in `Avatar` now, so every surface that draws a face gets them —
          this chip had them first and the two boards had never had them at
          all. */}
      <Avatar
        category={category}
        size={48}
        photoUrl={photoUrl}
        sizeClassName="h-(--fam-chip-h) w-(--fam-chip-h)"
      />
      <span className="sr-only">{category.label}</span>
      {showsProgress ? (
        <span
          aria-hidden={counters === null}
          // `box-content` so the reserved width is the DIGITS' width and the
          // padding sits outside it; with border-box the padding would eat into
          // the slot and a wide count would still push the pill open.
          className="box-content w-(--fam-chip-count-w) px-3 text-(length:--fam-fs-chip) font-medium tabular-nums text-(--fam-text-primary)"
        >
          {counters === null ? " " : `${counters.complete}/${counters.total}`}
        </span>
      ) : null}
    </div>
  );
}
