import { describe, expect, it } from "vitest";

import { fallsOf } from "../shower";

/**
 * T047 — the showers' shared scatter (R416; tokens.css "ONE vocabulary for
 * both showers"): every sprite's x, size, spin, delay and fall are read from
 * its index alone, inside 07 §7.1's [ESTIMATED] bounds, which the
 * `--fam-sprite-*` tokens also carry (reward-tokens.test.ts guards those).
 */

/** 07 §7.1 — "staggered start delays of 0–1.5 s". */
const STAGGER_MAX_S = 1.5;
/** 07 §7.1 — "translateY … over 2.5–4 s". */
const FALL_MIN_S = 2.5;
const FALL_MAX_S = 4;
/** 07 §7.1 — "a simultaneous rotate of ±180–540°". */
const SPIN_MIN_DEG = 180;
const SPIN_MAX_DEG = 540;

describe("fallsOf", () => {
  it("makes exactly `count` falls, keyed by their position in the list", () => {
    const falls = fallsOf(80);

    expect(falls).toHaveLength(80);
    expect(falls.map((fall) => fall.index)).toEqual(Array.from({ length: 80 }, (_, i) => i));
  });

  it("keeps every fall inside 07 §7.1's bounds", () => {
    for (const fall of fallsOf(80)) {
      expect(fall.x).toBeGreaterThanOrEqual(0);
      expect(fall.x).toBeLessThan(100);
      expect(fall.t).toBeGreaterThanOrEqual(0);
      expect(fall.t).toBeLessThan(1);
      expect(fall.delay).toBeGreaterThanOrEqual(0);
      expect(fall.delay).toBeLessThanOrEqual(STAGGER_MAX_S);
      expect(fall.fall).toBeGreaterThanOrEqual(FALL_MIN_S);
      expect(fall.fall).toBeLessThanOrEqual(FALL_MAX_S);
      const spin = Math.abs(fall.to - fall.from);
      expect(spin).toBeGreaterThanOrEqual(SPIN_MIN_DEG);
      expect(spin).toBeLessThanOrEqual(SPIN_MAX_DEG);
    }
  });

  it("spins some sprites clockwise and some the other way", () => {
    const directions = new Set(fallsOf(80).map((fall) => Math.sign(fall.to - fall.from)));

    expect(directions).toEqual(new Set([-1, 1]));
  });

  it("is the same list for the same count, every time", () => {
    expect(fallsOf(16)).toEqual(fallsOf(16));
    // The first sprites of a longer list are the first sprites of a shorter one.
    expect(fallsOf(80).slice(0, 16)).toEqual(fallsOf(16));
  });
});
