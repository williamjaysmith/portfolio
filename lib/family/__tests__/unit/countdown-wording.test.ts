import { describe, expect, it } from "vitest";

import {
  countdownChipLabel,
  countdownDetailLabel,
  countdownPhrase,
} from "@/lib/family/countdowns/wording";

/**
 * 009 Assumption 3 / FR-902 / FR-906. The wording is OURS — the reference's
 * literal chip text is [UNKNOWN] — so what this test pins is that the three
 * surfaces say the same thing, not that they match Skylight.
 */

describe("countdownPhrase", () => {
  it("says the number of days, plural", () => {
    expect(countdownPhrase("upcoming", 48)).toBe("48 days");
    expect(countdownPhrase("upcoming", 2)).toBe("2 days");
  });

  it("says one day in the singular", () => {
    expect(countdownPhrase("upcoming", 1)).toBe("1 day");
  });

  it("says Today on the day itself, never a zero (Assumption 5)", () => {
    expect(countdownPhrase("today", 0)).toBe("Today");
    expect(countdownPhrase("today", 0)).not.toMatch(/0/);
  });

  it("says Passed once the day is behind, never a negative", () => {
    expect(countdownPhrase("past", -3)).toBe("Passed");
    expect(countdownPhrase("past", -3)).not.toMatch(/-/);
  });
});

describe("the three surfaces agree", () => {
  it("puts the name first on a chip, so a bar of several can be scanned", () => {
    expect(countdownChipLabel("Vacation", countdownPhrase("upcoming", 48))).toBe(
      "Vacation · 48 days",
    );
  });

  it("omits the name in the details, where the title is already above it", () => {
    expect(countdownDetailLabel(countdownPhrase("upcoming", 48))).toBe("Countdown · 48 days");
  });

  it("carries the same phrase into both", () => {
    const phrase = countdownPhrase("today", 0);
    expect(countdownChipLabel("Vacation", phrase)).toContain(phrase);
    expect(countdownDetailLabel(phrase)).toContain(phrase);
  });
});
