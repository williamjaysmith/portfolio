import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { INK_DARK, INK_LIGHT, PALETTE, contrastRatio, mixWithWhite } from "@/lib/family/colors";

/**
 * T037's reward tokens, guarded as arithmetic (FR-413, FR-420, FR-423, FR-425,
 * FR-432, FR-438, FR-445; 07 §3.8, §4.12, §4.13, §7.1).
 *
 * Geometry is read OUT of `app/family/tokens.css` so that a number changed in
 * the stylesheet fails here rather than on the wall tablet — the guard
 * `task-tokens.test.ts` already holds over the board's tokens. The two colour
 * claims (the bar label's ink, the muted card's ink) are made across all
 * twenty palette colours, not against one specimen.
 */

const TOKENS = readFileSync(resolve(process.cwd(), "app/family/tokens.css"), "utf8");

/** WCAG 1.4.3 for text. */
const TEXT_CONTRAST = 4.5;

/** The FIRST declaration this token names — the `.family` one, before any reduced-motion override. */
function declarationOf(token: string): string {
  const found = new RegExp(`${token}:\\s*([^;]+);`).exec(TOKENS);
  if (found === null) throw new Error(`app/family/tokens.css declares no ${token}`);
  return found[1].trim();
}

/** The first literal hex declared for a token. */
function hexOf(token: string): string {
  const found = new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})\\b`).exec(TOKENS);
  if (found === null) throw new Error(`${token} is not declared as a literal hex`);
  return found[1];
}

/** A `<n>ms` declaration as a number of milliseconds. */
function millisecondsOf(token: string): number {
  const found = /^(\d+(?:\.\d+)?)ms$/.exec(declarationOf(token));
  if (found === null) throw new Error(`${token} is not declared in ms`);
  return Number(found[1]);
}

/** `color-mix(in srgb, a p%, b)` in sRGB — an opaque ink composited over a ground. */
function composite(ink: string, ground: string, alpha: number): string {
  const parse = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [top, under] = [parse(ink), parse(ground)];
  const mixed = top.map((channel, index) =>
    Math.round(channel * alpha + under[index] * (1 - alpha)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** The body of the `prefers-reduced-motion: reduce` block. */
function reducedMotionBlock(): string {
  const found = /prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/.exec(TOKENS);
  if (found === null) throw new Error("tokens.css has no reduced-motion block");
  return found[0];
}

describe("the reward card — FR-423, FR-425, 07 §4.12", () => {
  it("is rounder than a task card, at the photographed 24", () => {
    expect(declarationOf("--fam-reward-card-r")).toBe("calc(24 * var(--fam-u))");
    expect(declarationOf("--fam-radius-card")).toBe("calc(20 * var(--fam-u))");
  });

  it("draws the emoji at ~110 and the title on the text-scale rung with the 12px floor", () => {
    expect(declarationOf("--fam-reward-emoji")).toBe("calc(110 * var(--fam-u))");
    expect(declarationOf("--fam-fs-reward-title")).toBe("max(12px, calc(30 * var(--fam-t)))");
  });

  it("mutes the redeemed card by INK, because fading the primary ink falls below AA", () => {
    expect(declarationOf("--fam-reward-muted-ink")).toBe("var(--fam-text-secondary)");
    const ground = hexOf("--fam-app-bg");
    expect(contrastRatio(hexOf("--fam-text-secondary"), ground)).toBeGreaterThanOrEqual(
      TEXT_CONTRAST,
    );
    // The alternative — the shipped past-event dim applied to the whole card —
    // composites the primary ink to ~3.9:1 on white. Fine for an emoji, not for text.
    const dim = Number(declarationOf("--fam-past-dim"));
    expect(contrastRatio(composite(INK_DARK, ground, dim), ground)).toBeLessThan(TEXT_CONTRAST);
  });
});

describe("the progress bar — FR-420, FR-423, FR-445", () => {
  it("is a 44-unit full pill", () => {
    expect(declarationOf("--fam-reward-bar-h")).toBe("calc(44 * var(--fam-u))");
    expect(declarationOf("--fam-reward-bar-r")).toBe("calc(22 * var(--fam-u))");
  });

  it("carries the primary ink on the 40 % track half, for every palette colour", () => {
    expect(declarationOf("--fam-reward-bar-ink")).toBe("var(--fam-text-primary)");
    for (const hex of PALETTE) {
      expect(contrastRatio(mixWithWhite(hex, 0.4), INK_DARK)).toBeGreaterThanOrEqual(
        TEXT_CONTRAST,
      );
    }
  });

  it("cannot give the 100 % fill half a static ink — some accents need white", () => {
    // Why RewardCard sets --fam-reward-bar-fill-ink from inkOn() on the accent
    // it drew, exactly as TaskCard sets --fam-task-ink (FR-398).
    expect(declarationOf("--fam-reward-bar-fill-ink")).toBe("var(--fam-text-primary)");
    const needsLight = PALETTE.filter((hex) => contrastRatio(hex, INK_DARK) < TEXT_CONTRAST);
    expect(needsLight.length).toBeGreaterThan(0);
    for (const hex of needsLight) {
      expect(contrastRatio(hex, INK_LIGHT)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });

  it("never draws the Redeem button below the 44-point touch floor", () => {
    expect(declarationOf("--fam-reward-redeem-h")).toContain("var(--fam-touch)");
    expect(declarationOf("--fam-reward-redeem-h")).toContain("var(--fam-reward-bar-h)");
  });
});

describe("the redeem modal — FR-432, FR-438, 07 §3.8, §4.13", () => {
  it("is the sampled 540 × 700 at the reference unit", () => {
    expect(declarationOf("--fam-redeem-modal-w")).toBe("calc(540 * var(--fam-u))");
    expect(declarationOf("--fam-redeem-modal-h")).toBe("calc(700 * var(--fam-u))");
  });

  it("reuses the shipped modal radius, which is already the photographed 40", () => {
    expect(declarationOf("--fam-redeem-modal-r")).toBe("var(--fam-radius-modal)");
    expect(declarationOf("--fam-radius-modal")).toBe("calc(40 * var(--fam-u))");
  });

  it("floors both buttons at the touch target and keeps them full pills", () => {
    for (const button of ["--fam-redeem-btn-h", "--fam-redeem-btn-secondary-h"]) {
      expect(declarationOf(button)).toContain("var(--fam-touch)");
    }
    expect(declarationOf("--fam-redeem-btn-r")).toBe("calc(var(--fam-redeem-btn-h) / 2)");
    expect(declarationOf("--fam-redeem-btn-secondary-r")).toBe(
      "calc(var(--fam-redeem-btn-secondary-h) / 2)",
    );
  });

  it("warms the backdrop with the verified star gold, translucent, rather than dimming it", () => {
    const found = /^rgb\((\d+) (\d+) (\d+) \/ (0\.\d+)\)$/.exec(declarationOf("--fam-redeem-wash"));
    expect(found).not.toBeNull();
    const [r, g, b] = [found?.[1], found?.[2], found?.[3]].map((channel) =>
      Number(channel).toString(16).padStart(2, "0"),
    );
    expect(`#${r}${g}${b}`.toUpperCase()).toBe(hexOf("--fam-star-gold"));
    expect(Number(found?.[4])).toBeLessThan(0.5);
  });
});

describe("the celebration sprites — FR-438, FR-439, 07 §7.1", () => {
  it("range from 28 to 48 at the reference unit", () => {
    expect(declarationOf("--fam-sprite-min")).toBe("calc(28 * var(--fam-u))");
    expect(declarationOf("--fam-sprite-max")).toBe("calc(48 * var(--fam-u))");
  });

  it("fall for 2.5–4 s, staggered by up to 1.5 s", () => {
    const min = millisecondsOf("--fam-sprite-fall-min");
    const max = millisecondsOf("--fam-sprite-fall-max");
    expect(min).toBeGreaterThanOrEqual(2500);
    expect(max).toBeLessThanOrEqual(4000);
    expect(min).toBeLessThan(max);
    expect(millisecondsOf("--fam-sprite-stagger-max")).toBeLessThanOrEqual(1500);
  });

  it("collapse every duration this phase adds under reduced motion (FR-445)", () => {
    const reduced = reducedMotionBlock();
    for (const token of [
      "--fam-sprite-fall-min",
      "--fam-sprite-fall-max",
      "--fam-sprite-stagger-max",
      "--fam-sprite-fade-ms",
      "--fam-reward-bar-ms",
    ]) {
      expect(reduced).toContain(token);
    }
  });
});
