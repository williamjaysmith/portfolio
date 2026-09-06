import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 006 T006's meals tokens, guarded as arithmetic (FR-604, SC-611; 07 §3.7 the
 * metrics table, §1.6 the category colours).
 *
 * Geometry is read OUT of `app/family/tokens.css` so that a number changed in
 * the stylesheet fails here rather than on the wall tablet — the guard the
 * task, reward and list tokens already have. Every meals metric is a
 * photograph estimate (`[ESTIMATED]`, the cell height and gaps `[SAMPLED]`) and
 * lives in the one file that owns metrics; no component writes a size.
 */

const TOKENS = readFileSync(resolve(process.cwd(), "app/family/tokens.css"), "utf8");

/** The FIRST declaration this token names — the `.family` one. */
function declarationOf(token: string): string {
  const found = new RegExp(`${token}:\\s*([^;]+);`).exec(TOKENS);
  if (found === null) throw new Error(`app/family/tokens.css declares no ${token}`);
  return found[1].trim();
}

describe("the meal cell — FR-602, FR-604; 07 §3.7", () => {
  it("is the photographed ~235 × ~250 with r ~25", () => {
    expect(declarationOf("--fam-meal-cell-w")).toBe("calc(235 * var(--fam-u))");
    expect(declarationOf("--fam-meal-cell-h")).toBe("calc(250 * var(--fam-u))");
    expect(declarationOf("--fam-meal-cell-r")).toBe("calc(25 * var(--fam-u))");
  });

  it("sits ~20 apart across and ~38 apart down", () => {
    expect(declarationOf("--fam-meal-gap-x")).toBe("calc(20 * var(--fam-u))");
    expect(declarationOf("--fam-meal-gap-y")).toBe("calc(38 * var(--fam-u))");
  });

  it("seven cells and six gaps fit a 1920 wall beside the ~40 rail (07 §3.7's derivation)", () => {
    expect(declarationOf("--fam-meal-rail-w")).toBe("calc(40 * var(--fam-u))");
    expect(7 * 235 + 6 * 20 + 40).toBeLessThanOrEqual(1818);
  });
});

describe("the popover — FR-625; 07 §3.7", () => {
  it("is the photographed ~700 wide with r ~32", () => {
    expect(declarationOf("--fam-meal-popover-w")).toBe("calc(700 * var(--fam-u))");
    expect(declarationOf("--fam-meal-popover-r")).toBe("calc(32 * var(--fam-u))");
  });
});

describe("the type — 07 §2.4 'Meal-cell label 30'", () => {
  it("gives a chip's name its own sampled size, floored at 12px", () => {
    expect(declarationOf("--fam-fs-meal-cell")).toBe("max(12px, calc(30 * var(--fam-t)))");
  });
});
