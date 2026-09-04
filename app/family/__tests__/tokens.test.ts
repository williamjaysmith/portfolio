import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/lib/family/colors";

/**
 * FR-039 / SC-009: the token layer is where a contrast failure becomes a
 * hundred contrast failures, because every screen draws from it. These are the
 * measurements the comments in `tokens.css` claim — asserted here so a future
 * "just nudge the colour" cannot quietly drop the whole app below AA.
 *
 * WCAG 2.1 AA: 4.5:1 for body text (1.4.3), 3:1 for the boundary of a control
 * a person has to find in order to use it (1.4.11).
 */

const CSS = readFileSync(join(process.cwd(), "app/family/tokens.css"), "utf8");

/** The first literal hex declared for `--fam-<name>`. */
function token(name: string): string {
  const match = new RegExp(`--fam-${name}:\\s*(#[0-9A-Fa-f]{6})\\b`).exec(CSS);
  if (!match) throw new Error(`--fam-${name} is not declared as a literal hex in tokens.css`);
  return match[1];
}

describe("tokens.css text colours", () => {
  const background = token("app-bg");

  it("puts every text token above AA on the app background", () => {
    for (const name of ["text-primary", "text-secondary", "text-muted"]) {
      expect(contrastRatio(token(name), background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps --fam-danger legible as text and as a destructive fill", () => {
    // Both roles are the same measurement: the token against white — as ink on
    // the app background, and as the fill under a white "Delete" label.
    expect(contrastRatio(token("danger"), background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token("danger"), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the verified Skylight coral as the decorative accent, unchanged", () => {
    expect(token("accent-coral")).toBe("#F66951");
    // ...which is exactly why it cannot be the danger token: 2.98:1.
    expect(contrastRatio(token("accent-coral"), background)).toBeLessThan(4.5);
  });
});

describe("tokens.css control boundaries", () => {
  const background = token("app-bg");

  it("gives form controls a boundary that clears 3:1 (WCAG 1.4.11)", () => {
    expect(contrastRatio(token("control-border"), background)).toBeGreaterThanOrEqual(3);
  });

  it("leaves the hairline as decoration, which is all it can carry", () => {
    // 1.17:1 — fine for a divider between two things that are already
    // separated by layout, never enough to outline an empty input.
    expect(contrastRatio(token("hairline"), background)).toBeLessThan(3);
  });
});

describe("tokens.css text scale", () => {
  it("declares a rung for each stored text-size value (FR-038)", () => {
    for (const rung of ["small", "medium", "large"]) {
      expect(CSS).toContain(`[data-text-size="${rung}"]`);
    }
  });
});
