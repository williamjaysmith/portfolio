import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 005 T004's list tokens, guarded as arithmetic (FR-503, FR-541, SC-511;
 * 07 §3 the metrics table, §6.5 the annotated Lists layout).
 *
 * Geometry is read OUT of `app/family/tokens.css` so that a number changed in
 * the stylesheet fails here rather than on the wall tablet — the guard
 * `task-tokens.test.ts` and `reward-tokens.test.ts` already hold over the other
 * two boards' tokens. Every list metric is a photograph estimate (`[ESTIMATED]`)
 * and lives in the one file that owns metrics; no component writes a size.
 */

const TOKENS = readFileSync(resolve(process.cwd(), "app/family/tokens.css"), "utf8");

/** The FIRST declaration this token names — the `.family` one. */
function declarationOf(token: string): string {
  const found = new RegExp(`${token}:\\s*([^;]+);`).exec(TOKENS);
  if (found === null) throw new Error(`app/family/tokens.css declares no ${token}`);
  return found[1].trim();
}

describe("the list card — FR-502, FR-503; 07 §3, §6.5", () => {
  it("is the photographed ~495 wide, r ~28, with the ~38 gap between cards", () => {
    expect(declarationOf("--fam-list-card-w")).toBe("calc(495 * var(--fam-u))");
    expect(declarationOf("--fam-list-card-r")).toBe("calc(28 * var(--fam-u))");
    expect(declarationOf("--fam-list-card-gap")).toBe("calc(38 * var(--fam-u))");
  });

  it("gives the header ~100 and the footer ~110", () => {
    expect(declarationOf("--fam-list-header-h")).toBe("calc(100 * var(--fam-u))");
    expect(declarationOf("--fam-list-footer-h")).toBe("calc(110 * var(--fam-u))");
  });

  it("is wider than a task column, so the fit shows fewer cards than columns", () => {
    expect(declarationOf("--fam-task-col-w")).toBe("calc(400 * var(--fam-u))");
  });
});

describe("the item row — FR-518, FR-519, FR-541; 07 §3 'row 76', 'checkbox 63'", () => {
  it("is the photographed ~76 high with r ~14 and the ~38 row gap, floored at the touch target", () => {
    const row = declarationOf("--fam-list-row-h");
    expect(row).toContain("var(--fam-touch)");
    expect(row).toContain("calc(76 * var(--fam-u))");
    expect(declarationOf("--fam-list-row-r")).toBe("calc(14 * var(--fam-u))");
    expect(declarationOf("--fam-list-row-gap")).toBe("calc(38 * var(--fam-u))");
  });

  it("draws a rounded SQUARE checkbox of ~63 with r ~10, never below the touch floor", () => {
    const check = declarationOf("--fam-list-check");
    expect(check).toContain("var(--fam-touch)");
    expect(check).toContain("calc(63 * var(--fam-u))");
    expect(declarationOf("--fam-list-check-r")).toBe("calc(10 * var(--fam-u))");
  });

  it("gives the count badge the photographed ~53 circle", () => {
    expect(declarationOf("--fam-list-badge")).toBe("calc(53 * var(--fam-u))");
  });
});

describe("the two list type sizes — 07 §2.4 'List title 46', 'List item text 25'", () => {
  it("are on the text-scale rung with the 12px floor, like every other size", () => {
    expect(declarationOf("--fam-fs-list-title")).toBe("max(12px, calc(46 * var(--fam-t)))");
    expect(declarationOf("--fam-fs-list-item")).toBe("max(12px, calc(25 * var(--fam-t)))");
  });

  it("sit where the dossier puts them: the title above the page title, the item just above body", () => {
    expect(declarationOf("--fam-fs-title")).toBe("max(12px, calc(36 * var(--fam-t)))");
    expect(declarationOf("--fam-fs-body")).toBe("max(12px, calc(24 * var(--fam-t)))");
  });
});
