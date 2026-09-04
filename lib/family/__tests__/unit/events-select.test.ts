import { describe, expect, it } from "vitest";

import { eventsSelect } from "@/lib/family/rows";

/**
 * Regression: this select shipped to production malformed. It was built as two
 * adjacent template literals and the production bundler folded them, losing the
 * `), ` between the two embeds, so every client-side week read came back
 * PGRST100 "unexpected end of input" while dev and the server render were fine.
 * The board showed "the week could not be loaded" and no edit appeared without a
 * reload. These assertions are about the STRING's shape, which is what broke —
 * not about the columns, which never did.
 */
describe("eventsSelect", () => {
  const select = eventsSelect();

  it("closes every embed it opens", () => {
    let depth = 0;
    for (const character of select) {
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });

  it("keeps the two embeds siblings, never nested", () => {
    expect(select).toContain("),event_exceptions(");
    expect(select).not.toMatch(/event_categories\((?:[^()]*)event_exceptions/);
  });

  it("separates every top-level part with a comma", () => {
    const topLevel = select.replace(/\([^()]*\)/g, "");
    expect(topLevel).not.toMatch(/[A-Za-z_]\s*[A-Za-z_]*\(/);
    for (const part of topLevel.split(",")) expect(part.trim()).not.toBe("");
  });
});
