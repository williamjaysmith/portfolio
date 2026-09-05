import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INK_LIGHT,
  PALETTE,
  contrastRatio,
  inkOn,
  mixWithWhite,
  type PaletteColor,
} from "@/lib/family/colors";

/**
 * T038's board tokens, guarded as arithmetic (FR-304, FR-348, FR-349, FR-398).
 *
 * The three-rung tint ladder is a family's own colour composited on white, and
 * the palette spans Sunshine (luminance 0.72) to Deep River (0.08). Every claim
 * this suite makes is therefore made across all twenty sanctioned colours, not
 * against one specimen: a value that reads on Deep River and vanishes on
 * Sunshine has not been chosen, it has been guessed.
 *
 * The derivation percentages are read OUT of `app/family/tokens.css` rather
 * than restated here, so changing a number in the stylesheet fails this suite
 * instead of the wall tablet — the same guard `colors.test.ts` holds over the
 * palette itself.
 */

const TOKENS = readFileSync(resolve(process.cwd(), "app/family/tokens.css"), "utf8");

/** WCAG 1.4.3 for text and the white checkmark; 1.4.11 for a control's parts. */
const TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;

/**
 * `color-mix(in srgb, hex p%, black)` — every channel scaled by `p`. CSS keeps
 * the un-rounded channel; rounding here moves a ratio by well under 0.01.
 */
function deepen(hex: string, strength: number): string {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const mixed = channels.map((channel) => Math.round(channel * strength));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** `color-mix(in srgb, a p%, b)` in sRGB — the two-colour form of the same rule. */
function blend(a: string, b: string, strength: number): string {
  const parse = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const [first, second] = [parse(a), parse(b)];
  const mixed = first.map((channel, index) =>
    Math.round(channel * strength + second[index] * (1 - strength)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** The one declaration this token names, or a failure that names the token. */
function declarationOf(token: string): string {
  const found = new RegExp(`${token}:\\s*([^;]+);`).exec(TOKENS);
  if (found === null) throw new Error(`app/family/tokens.css declares no ${token}`);
  return found[1].trim();
}

/** A `color-mix` percentage, as the fraction the arithmetic above takes. */
function strengthOf(token: string): number {
  const found = /(\d+)%/.exec(declarationOf(token));
  if (found === null) throw new Error(`${token} is not a color-mix percentage`);
  return Number(found[1]) / 100;
}

const DEEP_STRENGTH = strengthOf("--fam-profile-deep");
const RING_OFF_STRENGTH = strengthOf("--fam-task-ring-off");

const tint = (hex: PaletteColor, strength: number) => mixWithWhite(hex, strength);
const deepOf = (hex: PaletteColor) => deepen(hex, DEEP_STRENGTH);

describe("the profile tint ladder — FR-304, FR-349", () => {
  it("uses the shipped 20 / 40 / 100 rungs and adds no fourth", () => {
    expect(declarationOf("--fam-profile-20")).toContain("20%");
    expect(declarationOf("--fam-profile-40")).toContain("40%");
    expect(declarationOf("--fam-profile-100")).toBe("var(--profile)");
  });

  it("keeps card text at 4.5:1 on BOTH card tints, for every palette colour (FR-398)", () => {
    for (const hex of PALETTE) {
      const incomplete = tint(hex, 0.4);
      const complete = tint(hex, 1);
      expect(contrastRatio(incomplete, inkOn(incomplete))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      expect(contrastRatio(complete, inkOn(complete))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });

  it("never needs the light ink on the 40 % rung — an incomplete card is always dark-inked", () => {
    // Why the incomplete card can take a static ink and the completed one cannot.
    for (const hex of PALETTE) {
      expect(inkOn(tint(hex, 0.4))).not.toBe(INK_LIGHT);
    }
  });

  it("keeps the 20 % header panel's text at 4.5:1 on the primary ink (FR-304)", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(tint(hex, 0.2), inkOn(tint(hex, 0.2)))).toBeGreaterThanOrEqual(
        TEXT_CONTRAST,
      );
    }
  });
});

describe("the completed disc — FR-348, FR-398", () => {
  it("is the profile's OWN accent drawn deeper, never another hue", () => {
    expect(declarationOf("--fam-profile-deep")).toBe(
      `color-mix(in srgb, var(--profile) ${DEEP_STRENGTH * 100}%, black)`,
    );
  });

  it("carries a white checkmark at 4.5:1, for every palette colour", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(deepOf(hex), INK_LIGHT)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });

  it("stays perceivable on the completed card's own full-strength fill (1.4.11)", () => {
    // Either half of the control clears 3:1 against the card: the disc itself
    // on a light accent, the white check on a dark one. Deepening a colour
    // that is already dark cannot separate it, which is why both count.
    for (const hex of PALETTE) {
      const disc = contrastRatio(deepOf(hex), hex);
      const check = contrastRatio(INK_LIGHT, hex);
      expect(Math.max(disc, check)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    }
  });

  it("is visibly deeper than the incomplete card it replaces", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(deepOf(hex), tint(hex, 0.4))).toBeGreaterThanOrEqual(
        NON_TEXT_CONTRAST,
      );
    }
  });
});

describe("the header toggles' ring states — FR-306, FR-307", () => {
  it("draws an ON ring at 3:1 against the 20 % panel it sits on", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(deepOf(hex), tint(hex, 0.2))).toBeGreaterThanOrEqual(
        NON_TEXT_CONTRAST,
      );
    }
  });

  it("fades the OFF ring to 40 %, and keeps the two states 3:1 apart", () => {
    expect(RING_OFF_STRENGTH).toBe(0.4);
    for (const hex of PALETTE) {
      const on = deepOf(hex);
      const off = blend(on, tint(hex, 0.2), RING_OFF_STRENGTH);
      expect(contrastRatio(on, off)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    }
  });

  it("puts the toggle's own label in the panel ink, so an off toggle is still a control", () => {
    // The faded ring reads as state; it is NOT what makes the control
    // perceivable, because a 40 % fade of anything cannot clear 3:1 on the
    // rung it was faded toward. The label carries that, at 12:1 or better.
    expect(declarationOf("--fam-task-toggle-ink")).toBe("var(--fam-text-primary)");
    for (const hex of PALETTE) {
      expect(contrastRatio(tint(hex, 0.2), "#1A1A1A")).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });
});

describe("the late treatment — FR-358, Assumption 22", () => {
  const late = declarationOf("--fam-late-fill");
  const danger = declarationOf("--fam-danger").split(/\s/)[0];

  it("is not the destructive-action colour", () => {
    expect(late).not.toBe(danger);
    // Ochre-derived (yellow-orange) against coral-derived (red): the two are
    // separated by hue, and the badge always carries the date it was due.
    expect(contrastRatio(late, danger)).toBeLessThan(NON_TEXT_CONTRAST);
  });

  it("carries white text at 4.5:1", () => {
    expect(contrastRatio(late, INK_LIGHT)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it("stays perceivable on every incomplete card (1.4.11)", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(late, tint(hex, 0.4))).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    }
  });

  it("takes its edge from the card's own ink, because a completed dark card swallows it", () => {
    // On a full-strength Deep River card the badge fill is 1.04:1 — invisible.
    // The edge is the card ink, which is 4.5:1 on that card by construction.
    expect(declarationOf("--fam-late-edge")).toBe("var(--fam-task-ink)");
    const swallowed = PALETTE.filter(
      (hex) => contrastRatio(late, hex) < NON_TEXT_CONTRAST,
    );
    expect(swallowed.length).toBeGreaterThan(0);
  });
});

describe("the board's measured geometry — FR-394, FR-396", () => {
  it("declares the reference column the layout table divides by", () => {
    // `tasks-layout.test.ts`'s four-viewport table assumes 400 units; this is
    // the declaration its probe actually measures.
    expect(declarationOf("--fam-task-col-w")).toBe("calc(400 * var(--fam-u))");
  });

  it("floors the completion circle's hit area at the 44-point touch target (FR-397)", () => {
    expect(declarationOf("--fam-task-circle-hit")).toContain("var(--fam-touch)");
  });
});

describe("the completion cross-fade — FR-349, FR-397", () => {
  it("collapses its duration under reduced motion, so script-driven motion opts in by reading it", () => {
    const reduced = /prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/.exec(TOKENS);
    expect(reduced).not.toBeNull();
    expect(reduced?.[0]).toContain("--fam-task-fade-ms");
  });
});
