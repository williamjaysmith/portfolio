"use client";

import {
  FIRST_FREE_FACET,
  FallingSprite,
  fallsOf,
  SHOWER_LAYER,
  SPRITE_SIZE,
  unitOf,
  useShowerClock,
} from "./shower";

/**
 * FR-439's emoji rain (004 T047 — R408, R416; 07 §7.1): the celebration that
 * plays once, over the **whole** screen of the device whose completion made
 * every occurrence in one Profile's column for the day complete — "the screen
 * will burst into a fun explosion of emojis"; Skylight's own name for it is
 * "randomized emoji rain" — ending on its own a few seconds later.
 *
 * **It decides nothing.** The Tasks board (T048) computes `listCompletesWith`
 * from the pre-write counters at tap time, mounts this on that write's
 * success and unmounts it on `onDone`; a completion that arrives from another
 * device is data, and data never mounts this (R408, Assumption 12). A skip
 * finishes no list, so a skip never mounts it either. The layer is decoration
 * for the sighted only — `aria-hidden`, `inert`, off the pointer — and says
 * nothing the darkened cards do not already say.
 *
 * **Reduced motion is nothing, not less** (FR-439, FR-445): under the shipped
 * hook the component renders no layer at all and reports `onDone` at once.
 *
 * **Random, but fixed.** The palette is a small fixed set of cheerful emoji —
 * things a family would celebrate with, nothing that reads as a task's own
 * emoji or a Profile's — and each sprite's pick is one more facet of the same
 * index hash that places it (`shower.tsx`): the same count rains the same
 * emoji in the same places twice, so a test can read them off the DOM and a
 * re-render cannot reshuffle them mid-fall. It looks random because the hash
 * mixes well; it IS a fixed pattern, and that is a feature.
 *
 * **Sized as text.** An emoji is a glyph, so the token formula sets
 * `font-size` here where `StarConfetti` sets `width`; `leading-none` makes the
 * line box the glyph's own, so `--fam-sprite-min/-max` measure the emoji as
 * they measure a star.
 */

/** 07 §7.1 — "density looks like 60–100 stars"; the suggested implementation says 60–90. */
const DEFAULT_COUNT = 80;

/**
 * The palette [OURS]: cheerful, G-rated, each a single code point with a
 * default emoji presentation, so every sprite is exactly one glyph on every
 * platform and needs no variation selector.
 */
const PALETTE: readonly string[] = [
  "🎉", "🎊", "⭐", "🌟", "✨", "🎈", "🌈", "🦄",
  "🍭", "🍦", "🍩", "🧁", "🍓", "🍉", "🍪", "🍕",
  "🌸", "🌻", "🐶", "🐱", "🦋", "🐸", "🦖", "🚀",
  "🏆", "🥳", "🤩", "😄", "💖", "💫", "🎸", "🎨",
];

/** Which emoji sprite `index` is — the hash's next free facet, so the pick and the fall do not correlate. */
function emojiOf(index: number): string {
  return PALETTE[Math.floor(unitOf(index, FIRST_FREE_FACET) * PALETTE.length)];
}

const SPRITE = "absolute top-0 block select-none leading-none";
const SPRITE_STYLE = { fontSize: SPRITE_SIZE };

export interface EmojiRainProps {
  /**
   * Called once when the rain has ended — after the last sprite has faded, or
   * at once under a reduced-motion preference. The parent unmounts the
   * component in response. The latest callback is the one called; a new
   * identity on re-render does not restart the clock.
   */
  onDone: () => void;
  /** How many emoji. Defaults to 80 — 07 §7.1's density; the range the dossier reads is 60–90. */
  count?: number;
}

export function EmojiRain({ onDone, count = DEFAULT_COUNT }: EmojiRainProps) {
  const reducedMotion = useShowerClock(onDone);

  if (reducedMotion) return null;

  return (
    <div data-emoji-rain aria-hidden="true" inert className={SHOWER_LAYER}>
      {fallsOf(count).map((fall) => (
        <FallingSprite key={fall.index} fall={fall} className={SPRITE} style={SPRITE_STYLE}>
          {emojiOf(fall.index)}
        </FallingSprite>
      ))}
    </div>
  );
}
