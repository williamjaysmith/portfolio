"use client";

import { Star } from "lucide-react";

import { FallingSprite, fallsOf, SHOWER_LAYER, SPRITE_SIZE, useShowerClock } from "./shower";

/**
 * FR-438's gold star shower (004 T042 — R408, R416; 07 §4.13, §7.1): the
 * celebration a successful redemption scatters over the **whole** screen of
 * the device that redeemed — the columns as well as the modal — ending on its
 * own a few seconds later.
 *
 * **It decides nothing.** `RedeemModal` (T041) mounts it on the local write's
 * success and unmounts it on `onDone`; a redemption that arrives from another
 * device is data, and data never mounts this (R408, Assumption 12). The layer
 * is decoration for the sighted only — `aria-hidden`, `inert`, off the
 * pointer — and says nothing the modal does not already say.
 *
 * Everything about HOW it falls — the deterministic scatter, the clock, the
 * reduced-motion collapse to nothing, the size formula over the tokens — is
 * `shower.tsx`'s, shared with `EmojiRain` so the two showers move alike. What
 * is this file's own is only what a sprite is made of: a filled lucide star in
 * `--fam-star-gold`, sized by width.
 *
 * **Fixed to the viewport, and it must stay that way**: the layer's containing
 * block is the viewport only while no ancestor is transformed, so the redeem
 * dialog animates an inner wrapper and mounts this as the `<dialog>`'s direct
 * child — which also keeps the stars in the top layer over the columns AND the
 * modal (tokens.css, the sprites' note).
 */

/** 07 §7.1 — "density looks like 60–100 stars"; the suggested implementation says 60–90. */
const DEFAULT_COUNT = 80;

const SPRITE = "absolute top-0 block aspect-square text-(--fam-star-gold)";
const SPRITE_STYLE = { width: SPRITE_SIZE };

export interface StarConfettiProps {
  /**
   * Called once when the shower has ended — after the last sprite has faded,
   * or at once under a reduced-motion preference. The parent unmounts the
   * component (and ends anything it tied to the shower, such as the warm
   * wash) in response. The latest callback is the one called; a new identity
   * on re-render does not restart the clock.
   */
  onDone: () => void;
  /** How many stars. Defaults to 80 — 07 §7.1's density; the range the dossier reads is 60–90. */
  count?: number;
}

export function StarConfetti({ onDone, count = DEFAULT_COUNT }: StarConfettiProps) {
  const reducedMotion = useShowerClock(onDone);
  if (reducedMotion) return null;

  return (
    <div data-star-confetti aria-hidden="true" inert className={SHOWER_LAYER}>
      {fallsOf(count).map((fall) => (
        <FallingSprite key={fall.index} fall={fall} className={SPRITE} style={SPRITE_STYLE}>
          <Star fill="currentColor" className="h-full w-full" />
        </FallingSprite>
      ))}
    </div>
  );
}
