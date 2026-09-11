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
 * The tint ladder is a family's own colour composited on white — TWO rungs, 100
 * and 40, since the operator asked for one consistent scheme across every tab
 * (it was 100 / 40 / 20 plus a fourth mixed with BLACK for the board's arcs,
 * rings and discs, which is what made the same person read as a different
 * colour here than on the calendar). The palette spans Sunshine (luminance
 * 0.72) to Deep River (0.08). Every claim
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

/** The one declaration this token names, or a failure that names the token. */
function declarationOf(token: string): string {
  const found = new RegExp(`${token}:\\s*([^;]+);`).exec(TOKENS);
  if (found === null) throw new Error(`app/family/tokens.css declares no ${token}`);
  return found[1].trim();
}

/** True when the stylesheet declares this token at all. */
function declares(token: string): boolean {
  return new RegExp(`${token}:\\s*[^;]+;`).test(TOKENS);
}

const tint = (hex: PaletteColor, strength: number) => mixWithWhite(hex, strength);

describe("the profile tint ladder — FR-304, FR-349", () => {
  /**
   * The point of this test is the NEGATIVE half. A third or fourth rung is
   * exactly how the app drifted into showing one person as two colours, and the
   * only way that cannot come back is for the extra rungs not to exist.
   */
  it("is two rungs and only two", () => {
    expect(declarationOf("--fam-profile-40")).toContain("40%");
    expect(declarationOf("--fam-profile-100")).toBe("var(--profile)");
    expect(declares("--fam-profile-20")).toBe(false);
    expect(declares("--fam-profile-deep")).toBe(false);
    expect(declares("--fam-task-ring-off")).toBe(false);
  });

  /**
   * What made collapsing the ladder safe. Anything drawing a glyph ON the
   * 100 % rung used to hardcode `white`, which the black-mixed rung could
   * carry; on the accent itself white is 1.37:1 on Sunshine. The ink is
   * carried in by `profileVars` now and chosen per colour.
   */
  it("carries an ink that is readable ON the full-strength rung, for every accent", () => {
    expect(declarationOf("--fam-profile-ink")).toBe("var(--profile-ink, var(--fam-text-primary))");
    for (const hex of PALETTE) {
      expect(contrastRatio(hex, inkOn(hex))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
    // And it genuinely has to switch: a static white would fail on some.
    expect(PALETTE.some((hex) => inkOn(hex) !== INK_LIGHT)).toBe(true);
    expect(PALETTE.some((hex) => inkOn(hex) === INK_LIGHT)).toBe(true);
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

  it("keeps the header panel's text at 4.5:1 on the primary ink (FR-304)", () => {
    // The panel is the 40 % rung now — the same lighter shade the calendar's
    // chip body draws, which is the whole of the operator's ask.
    for (const hex of PALETTE) {
      expect(contrastRatio(tint(hex, 0.4), inkOn(tint(hex, 0.4)))).toBeGreaterThanOrEqual(
        TEXT_CONTRAST,
      );
    }
  });
});

describe("the completed disc — FR-348, FR-398", () => {
  it("carries a checkmark at 4.5:1 on the accent itself, for every palette colour", () => {
    // The old disc was the accent mixed with black under a hardcoded white
    // check. It is the accent, under --fam-profile-ink.
    for (const hex of PALETTE) {
      expect(contrastRatio(hex, inkOn(hex))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });

  /**
   * A completed card is filled at 100 %, and so is the disc on it — the same
   * colour, no separation at all (1.0:1). The old disc was mixed with black and
   * stood out on its own. What replaces that is the disc's EDGE, which is the
   * accent's own ink, so it clears 4.5:1 on the card for every one of the
   * twenty — better than the disc ever did, where six of them relied on a white
   * check at 1.37:1.
   */
  it("outlines itself on the completed card it sits on, for every palette colour", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(hex, hex)).toBe(1);
      expect(contrastRatio(inkOn(hex), hex)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });
});

describe("the header toggles' ring states — FR-306, FR-307", () => {
  it("draws OFF as the PAGE rather than a third shade of the accent", () => {
    expect(declarationOf("--fam-task-progress-track")).toBe("var(--fam-app-bg)");
  });

  /**
   * **The honest limit of two rungs, asserted rather than hidden.** The old ON
   * ring was mixed with black precisely so it cleared 3:1 against its own panel
   * on all twenty accents. A full-strength ring on a 40 % panel does not: the
   * pale end of the palette is where it fails, and this test names how many so
   * that nobody re-reads the collapse as free.
   *
   * What carries the control instead is unchanged and still measured below —
   * the label's ink, and the OFF ring being thinner as well as a different
   * colour (--fam-task-ring-w-off).
   */
  it("separates an ON ring from its panel on the darker accents, and not the palest", () => {
    const separated = PALETTE.filter(
      (hex) => contrastRatio(hex, tint(hex, 0.4)) >= NON_TEXT_CONTRAST,
    );
    expect(separated.length).toBeGreaterThan(0);
    expect(separated.length).toBeLessThan(PALETTE.length);
  });

  it("puts the toggle's own label in the panel ink, so an off toggle is still a control", () => {
    // The ring reads as state; it is NOT what makes the control perceivable.
    // The label carries that, on the 40 % panel, at 4.5:1 or better.
    expect(declarationOf("--fam-task-toggle-ink")).toBe("var(--fam-text-primary)");
    for (const hex of PALETTE) {
      expect(contrastRatio(tint(hex, 0.4), "#1A1A1A")).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
  });
});

describe("the late treatment — FR-358, Assumption 22", () => {
  /** The fill is declared as `var(--fam-accent-coral)`; the arithmetic needs the hex behind it. */
  const late = declarationOf("--fam-accent-coral").split(/\s/)[0];

  /**
   * **This test used to assert the opposite, and the reversal is the point.**
   * The fill was a derived ochre so that a late mark could not be read as
   * `--fam-danger`'s "delete this" (Assumption 22). The operator read the ochre
   * as a mistake rather than a distinction and asked for the app's red twice —
   * once for `--fam-danger`, which is that same coral darkened 30 % and still
   * reads brown, and then for the coral itself, which is the red actually on
   * screen (the today badge, the now-line). What separates a late mark from a
   * destructive one is no longer hue: one is a PILL ON A CARD and the other a
   * BUTTON IN A DIALOG, and nothing draws them near each other.
   */
  it("is the verified coral the rest of the app already wears", () => {
    expect(declarationOf("--fam-late-fill")).toBe("var(--fam-accent-coral)");
  });

  /**
   * And the ink had to move with it. White on the coral is 2.98:1 — the badge
   * would have been a red pill with unreadable text, which is the trap the
   * today badge's own digit already fell into once (visual brief §13).
   */
  it("carries the DARK ink at 4.5:1, because white does not survive the coral", () => {
    expect(declarationOf("--fam-late-ink")).toBe("var(--fam-text-primary)");
    expect(contrastRatio(late, "#1A1A1A")).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    expect(contrastRatio(late, INK_LIGHT)).toBeLessThan(TEXT_CONTRAST);
  });

  /**
   * **The fill now separates the pill from NO card at all**, at either tint —
   * the ochre managed it on every one (worst 4.34:1). That is the price of
   * matching the app's red, and it is stated here rather than left to be
   * discovered: the edge is not a fallback for the awkward colours any more, it
   * is the only thing holding the pill's boundary on all twenty. The next test
   * is what makes that safe.
   */
  it("no longer separates from any card by its fill — the edge carries all of it", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(late, tint(hex, 0.4))).toBeLessThan(NON_TEXT_CONTRAST);
      expect(contrastRatio(late, hex)).toBeLessThan(NON_TEXT_CONTRAST);
    }
  });

  it("takes its edge from the card's own ink, which is 4.5:1 on that card by construction", () => {
    // `--fam-task-ink` is the ink TaskCard chose for the fill it actually drew
    // (FR-398), so the edge clears AA against the card on every accent at both
    // tints — which is the guarantee the fill gave up.
    expect(declarationOf("--fam-late-edge")).toBe("var(--fam-task-ink)");
    for (const hex of PALETTE) {
      for (const strength of [0.4, 1]) {
        const card = tint(hex, strength);
        expect(contrastRatio(card, inkOn(card))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
      }
    }
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
