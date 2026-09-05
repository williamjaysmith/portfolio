"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";

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
 * **Reduced motion is nothing, not less** (FR-438, FR-445): under the shipped
 * hook (`useReducedMotion`, the one `DragPreviewBlock` and `useSwipePan`
 * consult) the component renders no layer at all and reports `onDone` at
 * once, so a parent tying the warm wash to the shower's lifetime sees it end
 * the way it always ends — just immediately.
 *
 * **The scatter is a function of the index.** Every sprite's x, size, spin,
 * delay and fall are read from a small integer hash of its position in the
 * list, never from `Math.random`: the same count draws the same shower
 * twice, so a test can read the scatter off the DOM and a re-render cannot
 * reshuffle stars mid-fall. It looks random because the hash mixes well; it
 * IS a fixed pattern, and that is a feature.
 *
 * **Tokens are consumed, not re-declared** (R414). Colour is
 * `--fam-star-gold`; a sprite's size is tokens.css's own formula —
 * `min + (max − min) · --t` over `--fam-sprite-min/-max`, with `--t` set
 * inline — so the density reads the same on a phone as on the wall. The
 * clock below mirrors the stylesheet's `--fam-sprite-fall-*`,
 * `--fam-sprite-stagger-max` and `--fam-sprite-fade-ms` as the numbers framer
 * drives: reading them back out of the stylesheet at mount would cost a DOM
 * read and a second render for the same [ESTIMATED] figures, and the `onDone`
 * clock needs them as numbers regardless. `reward-tokens.test.ts` guards the
 * stylesheet's values, `StarConfetti.test` guards this file's. Under reduced
 * motion the stylesheet collapses those tokens too, but this component is
 * already gone by then.
 *
 * **Fixed to the viewport, and it must stay that way**: the layer is
 * `position: fixed; inset: 0`, so its containing block is the viewport only
 * while no ancestor is transformed. A parent that animates its own entrance
 * with framer (the redeem dialog) must animate an inner wrapper and mount
 * this layer OUTSIDE it — as the `<dialog>`'s direct child, which also keeps
 * the stars in the top layer over the columns AND the modal (tokens.css, the
 * sprites' note).
 */

/** 07 §7.1 — "density looks like 60–100 stars"; the suggested implementation says 60–90. */
const DEFAULT_COUNT = 80;

/**
 * The shower's clock, in seconds, mirroring `--fam-sprite-*` in tokens.css
 * (07 §7.1's "translateY … over 2.5–4 s, linear", "staggered start delays of
 * 0–1.5 s", "a short fade at the end" — all [ESTIMATED]).
 */
const FALL_MIN_S = 2.5;
const FALL_MAX_S = 4;
const STAGGER_MAX_S = 1.5;
const FADE_S = 0.4;

/** 07 §7.1 — "a simultaneous rotate of ±180–540°"; the sign is the sprite's own coin. */
const SPIN_MIN_DEG = 180;
const SPIN_MAX_DEG = 540;

/** The whole shower's length: the last-starting sprite's longest possible fall. */
const TOTAL_MS = (STAGGER_MAX_S + FALL_MAX_S) * 1000;

/** How far above and below the viewport a sprite starts and ends, so none pops in or out on screen. */
const START_Y = "-12vh";
const END_Y = "112vh";

/** The tokens.css formula for a sprite's size, `--t` being this sprite's point in [0, 1). */
const SIZE =
  "calc(var(--fam-sprite-min) + (var(--fam-sprite-max) - var(--fam-sprite-min)) * var(--t))";

const LAYER = "pointer-events-none fixed inset-0 z-30 overflow-hidden";
const SPRITE = "absolute top-0 block aspect-square text-(--fam-star-gold)";

/**
 * A deterministic point in [0, 1) for the `facet`th random of sprite `index`
 * — a 32-bit integer mix (multiply–xorshift), the same on every call, so the
 * scatter is a pure function of the list position and nothing else.
 */
function unitOf(index: number, facet: number): number {
  let hash = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(facet + 1, 0x85ebca77);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0x1_0000_0000;
}

/** `lo + (hi − lo) · t`. */
function between(lo: number, hi: number, t: number): number {
  return lo + (hi - lo) * t;
}

interface Sprite {
  /** Position in the list — the React key and the hash's seed. */
  index: number;
  /** Left edge, as a percentage of the viewport's width. */
  x: number;
  /** The size formula's `--t`. */
  t: number;
  /** Starting angle, degrees. */
  from: number;
  /** Ending angle — `from` plus or minus a 180–540° spin. */
  to: number;
  /** Start delay, seconds. */
  delay: number;
  /** Fall duration, seconds. */
  fall: number;
}

/** One sprite's whole scatter, from its index alone. */
function spriteOf(index: number): Sprite {
  const direction = unitOf(index, 5) < 0.5 ? -1 : 1;
  const from = unitOf(index, 2) * 360;
  return {
    index,
    x: unitOf(index, 0) * 100,
    t: unitOf(index, 1),
    from,
    to: from + direction * between(SPIN_MIN_DEG, SPIN_MAX_DEG, unitOf(index, 3)),
    delay: unitOf(index, 4) * STAGGER_MAX_S,
    fall: between(FALL_MIN_S, FALL_MAX_S, unitOf(index, 6)),
  };
}

/** The first `count` sprites — the same list for the same count, every time. */
function spritesOf(count: number): Sprite[] {
  return Array.from({ length: count }, (_, index) => spriteOf(index));
}

function StarSprite({ sprite }: { sprite: Sprite }) {
  // React's CSSProperties is closed over the CSS spec, so the inline custom
  // property that feeds the size formula needs the cast (TaskCard's pattern).
  const style = { left: `${sprite.x}%`, width: SIZE, "--t": sprite.t } as CSSProperties;
  const fadeStartsAt = sprite.delay + sprite.fall - FADE_S;
  return (
    <motion.span
      data-sprite
      className={SPRITE}
      style={style}
      initial={{ y: START_Y, rotate: sprite.from, opacity: 1 }}
      animate={{ y: END_Y, rotate: sprite.to, opacity: 0 }}
      transition={{
        y: { delay: sprite.delay, duration: sprite.fall, ease: "linear" },
        rotate: { delay: sprite.delay, duration: sprite.fall, ease: "linear" },
        opacity: { delay: fadeStartsAt, duration: FADE_S, ease: "linear" },
      }}
    >
      <Star fill="currentColor" className="h-full w-full" />
    </motion.span>
  );
}

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
  const reducedMotion = useReducedMotion();

  // The latest `onDone` without it being a dependency: the shower's length is
  // the shower's, not the parent's render cadence.
  const latestOnDone = useRef(onDone);
  useEffect(() => {
    latestOnDone.current = onDone;
  }, [onDone]);

  // One clock for the whole shower. `useReducedMotion()` answers `null`
  // before it has read the preference and may settle after mount; a settle
  // to `true` collapses the clock to "now", which is the same end, sooner.
  useEffect(() => {
    const timer = setTimeout(() => latestOnDone.current(), reducedMotion ? 0 : TOTAL_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div data-star-confetti aria-hidden="true" inert className={LAYER}>
      {spritesOf(count).map((sprite) => (
        <StarSprite key={sprite.index} sprite={sprite} />
      ))}
    </div>
  );
}
