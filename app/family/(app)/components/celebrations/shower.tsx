"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * The two showers' one vocabulary (R416; tokens.css, the sprites' note: "ONE
 * vocabulary for both showers — the gold stars on redeem and the emoji rain on
 * a finished list — so they move alike"). `EmojiRain` (T047) is built on it;
 * `StarConfetti` (T042) carries the same clock and the same scatter inline and
 * can be cut down to these exports without changing a pixel.
 *
 * **The scatter is a function of the index.** Every sprite's x, size, spin,
 * delay and fall are read from a small integer hash of its position in the
 * list, never from `Math.random`: the same count draws the same shower
 * twice, so a test can read the scatter off the DOM and a re-render cannot
 * reshuffle sprites mid-fall. It looks random because the hash mixes well;
 * it IS a fixed pattern, and that is a feature. A shower that needs one more
 * random per sprite (which emoji, say) reads another facet of the same hash.
 *
 * **Tokens are consumed, not re-declared** (R414). A sprite's size is
 * tokens.css's own formula — `min + (max − min) · --t` over
 * `--fam-sprite-min/-max`, with `--t` set inline — so the density reads the
 * same on a phone as on the wall. The clock below mirrors the stylesheet's
 * `--fam-sprite-fall-*`, `--fam-sprite-stagger-max` and `--fam-sprite-fade-ms`
 * as the numbers framer drives: reading them back out of the stylesheet at
 * mount would cost a DOM read and a second render for the same [ESTIMATED]
 * figures, and the `onDone` clock needs them as numbers regardless.
 * `reward-tokens.test.ts` guards the stylesheet's values, `shower.test.ts`
 * guards this file's.
 *
 * **Reduced motion is nothing, not less** (FR-438, FR-439, FR-445): under the
 * shipped hook (`useReducedMotion`, the one `DragPreviewBlock` and
 * `useSwipePan` consult) a shower renders no layer at all and reports
 * `onDone` at once — `useShowerClock` answers `true` and the component
 * returns `null`.
 *
 * **Fixed to the viewport, and it must stay that way**: `SHOWER_LAYER` is
 * `position: fixed; inset: 0`, so its containing block is the viewport only
 * while no ancestor is transformed. A parent that animates its own entrance
 * with framer must animate an inner wrapper and mount the shower OUTSIDE it.
 */

/**
 * The showers' clock, in seconds, mirroring `--fam-sprite-*` in tokens.css
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
export const SPRITE_SIZE =
  "calc(var(--fam-sprite-min) + (var(--fam-sprite-max) - var(--fam-sprite-min)) * var(--t))";

/** The layer every shower falls in: over everything, under nobody's finger. */
export const SHOWER_LAYER = "pointer-events-none fixed inset-0 z-30 overflow-hidden";

/**
 * A deterministic point in [0, 1) for the `facet`th random of sprite `index`
 * — a 32-bit integer mix (multiply–xorshift), the same on every call, so the
 * scatter is a pure function of the list position and nothing else.
 */
export function unitOf(index: number, facet: number): number {
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

/** One sprite's whole fall, from its index alone. */
export interface Fall {
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

/**
 * The scatter reads facets 0–6 of the hash; a shower with one more random per
 * sprite reads from here up so it cannot correlate with the fall.
 */
export const FIRST_FREE_FACET = 7;

function fallOf(index: number): Fall {
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

/** The first `count` falls — the same list for the same count, every time. */
export function fallsOf(count: number): Fall[] {
  return Array.from({ length: count }, (_, index) => fallOf(index));
}

/**
 * One shower's clock: `onDone` once, when the last sprite has faded — or at
 * once under a reduced-motion preference. Answers whether motion is reduced,
 * in which case the caller renders nothing.
 *
 * The latest `onDone` is the one called and a new identity on re-render does
 * not restart the clock: the shower's length is the shower's, not the
 * parent's render cadence. `useReducedMotion()` answers `null` before it has
 * read the preference and may settle after mount; a settle to `true`
 * collapses the clock to "now", which is the same end, sooner.
 */
export function useShowerClock(onDone: () => void): boolean {
  const reducedMotion = useReducedMotion();

  const latestOnDone = useRef(onDone);
  useEffect(() => {
    latestOnDone.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => latestOnDone.current(), reducedMotion ? 0 : TOTAL_MS);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  return reducedMotion === true;
}

export interface FallingSpriteProps {
  fall: Fall;
  /** The sprite's own look — `absolute top-0 block` plus whatever it is made of. */
  className: string;
  /** How the sprite takes its size — `{ width: SPRITE_SIZE }` for a glyph, `{ fontSize: SPRITE_SIZE }` for text. */
  style: CSSProperties;
  children: ReactNode;
}

/**
 * One sprite falling once: linear from above the viewport to below it, spinning
 * as it goes, fading out over the last `--fam-sprite-fade-ms`. Position and
 * `--t` come from the fall; what it looks like comes from the caller.
 */
export function FallingSprite({ fall, className, style, children }: FallingSpriteProps) {
  // React's CSSProperties is closed over the CSS spec, so the inline custom
  // property that feeds the size formula needs the cast (TaskCard's pattern).
  const merged = { ...style, left: `${fall.x}%`, "--t": fall.t } as CSSProperties;
  const fadeStartsAt = fall.delay + fall.fall - FADE_S;
  return (
    <motion.span
      data-sprite
      className={className}
      style={merged}
      initial={{ y: START_Y, rotate: fall.from, opacity: 1 }}
      animate={{ y: END_Y, rotate: fall.to, opacity: 0 }}
      transition={{
        y: { delay: fall.delay, duration: fall.fall, ease: "linear" },
        rotate: { delay: fall.delay, duration: fall.fall, ease: "linear" },
        opacity: { delay: fadeStartsAt, duration: FADE_S, ease: "linear" },
      }}
    >
      {children}
    </motion.span>
  );
}
