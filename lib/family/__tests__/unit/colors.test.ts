import { describe, it, expect } from "vitest";
import {
  INK_DARK,
  INK_LIGHT,
  PALETTE,
  PALETTE_NAMES,
  contrastRatio,
  eventInk,
  initialsFor,
  inkOn,
  isPaletteColor,
  mixWithWhite,
  normalizeHex,
  profileVars,
  tints,
} from "@/lib/family/colors";

describe("PALETTE", () => {
  it("has exactly the 20 reference colours, unique and uppercase", () => {
    expect(PALETTE).toHaveLength(20);
    expect(new Set(PALETTE).size).toBe(20);
    for (const hex of PALETTE) {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("keeps the API order", () => {
    expect(PALETTE[0]).toBe("#FDC36D");
    expect(PALETTE[13]).toBe("#2178AF");
    expect(PALETTE[19]).toBe("#915EA1");
  });

  it("names every entry", () => {
    expect(Object.keys(PALETTE_NAMES)).toHaveLength(20);
    for (const hex of PALETTE) {
      expect(PALETTE_NAMES[hex].length).toBeGreaterThan(0);
    }
    expect(PALETTE_NAMES["#FDC36D"]).toBe("Orange");
    expect(PALETTE_NAMES["#F66951"]).toBe("Coral");
    expect(PALETTE_NAMES["#2178AF"]).toBe("Blue");
    expect(PALETTE_NAMES["#DADADA"]).toBe("Charcoal");
    expect(PALETTE_NAMES["#915EA1"]).toBe("Deep Lavender");
  });
});

describe("isPaletteColor", () => {
  it("accepts every palette entry", () => {
    for (const hex of PALETTE) {
      expect(isPaletteColor(hex)).toBe(true);
    }
  });

  it("is exact and case-sensitive", () => {
    expect(isPaletteColor("#fdc36d")).toBe(false);
    expect(isPaletteColor(" #FDC36D")).toBe(false);
    expect(isPaletteColor("FDC36D")).toBe(false);
    expect(isPaletteColor("#FFFFFF")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isPaletteColor(42)).toBe(false);
    expect(isPaletteColor(null)).toBe(false);
    expect(isPaletteColor(undefined)).toBe(false);
    expect(isPaletteColor({ hex: "#FDC36D" })).toBe(false);
  });
});

describe("normalizeHex", () => {
  it("trims and uppercases, keeping the leading hash", () => {
    expect(normalizeHex("  #fdc36d ")).toBe("#FDC36D");
    expect(normalizeHex("#D5B6EC")).toBe("#D5B6EC");
  });

  it("does not invent a hash", () => {
    expect(normalizeHex("fdc36d")).toBe("FDC36D");
  });

  it("turns a lowercase palette value into a palette colour", () => {
    expect(isPaletteColor(normalizeHex("#fdc36d"))).toBe(true);
  });
});

describe("mixWithWhite", () => {
  it("composites on white per channel with rounding", () => {
    expect(mixWithWhite("#DFD3E1", 0.4)).toBe("#F2EDF3");
    expect(mixWithWhite("#D5B6EC", 0.4)).toBe("#EEE2F7");
    expect(mixWithWhite("#000000", 0)).toBe("#FFFFFF");
  });

  it("returns the colour itself at full strength, uppercased", () => {
    expect(mixWithWhite("#dfd3e1", 1)).toBe("#DFD3E1");
  });

  it("accepts a hex without the hash", () => {
    expect(mixWithWhite("DFD3E1", 0.4)).toBe("#F2EDF3");
  });

  it("throws on a malformed hex", () => {
    expect(() => mixWithWhite("#12", 0.4)).toThrow();
    expect(() => mixWithWhite("nope", 0.4)).toThrow();
    expect(() => mixWithWhite("#GGGGGG", 0.4)).toThrow();
  });
});

describe("tints", () => {
  it("derives full / medium / faint at 1 / 0.4 / 0.2", () => {
    const t = tints("#D5B6EC");
    expect(t.full).toBe("#D5B6EC");
    expect(t.medium).toBe("#EEE2F7");
    expect(t.faint).toBe(mixWithWhite("#D5B6EC", 0.2));
  });

  it("matches mixWithWhite for every palette colour", () => {
    for (const hex of PALETTE) {
      const t = tints(hex);
      expect(t).toEqual({
        full: hex,
        medium: mixWithWhite(hex, 0.4),
        faint: mixWithWhite(hex, 0.2),
      });
    }
  });
});

describe("profileVars", () => {
  it("exposes the accent as --profile", () => {
    expect(profileVars("#2178AF")).toEqual({ "--profile": "#2178AF" });
  });
});

describe("initialsFor", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(initialsFor("Will Smith")).toBe("WS");
    expect(initialsFor("mary jane watson")).toBe("MJ");
  });

  it("returns one letter for a single word", () => {
    expect(initialsFor("mom")).toBe("M");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(initialsFor("  mary   jane ")).toBe("MJ");
  });

  it("returns an empty string for blank input", () => {
    expect(initialsFor("")).toBe("");
    expect(initialsFor("   ")).toBe("");
  });

  it("handles non-ASCII first letters", () => {
    expect(initialsFor("élodie durand")).toBe("ÉD");
  });
});

describe("contrastRatio", () => {
  it("is the WCAG 2.1 relative-luminance ratio, symmetric", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#2178AF", "#2178AF")).toBeCloseTo(1, 5);
  });

  it("accepts unnormalised input", () => {
    expect(contrastRatio(" #f66951 ", "FFFFFF")).toBeCloseTo(contrastRatio("#F66951", "#FFFFFF"), 10);
  });

  it("measures the two failures this guard exists for", () => {
    // The raw coral as text on the white app background: 2.98:1, under AA's 4.5:1.
    expect(contrastRatio("#F66951", "#FFFFFF")).toBeCloseTo(2.98, 2);
    // White initials on Sprout — the avatar default was effectively invisible.
    expect(contrastRatio("#B6E085", "#FFFFFF")).toBeCloseTo(1.5, 2);
  });
});

describe("inkOn", () => {
  it("gives every one of the 20 palette colours an ink that clears WCAG AA (FR-039)", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(hex, inkOn(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("picks the darker ink where white would disappear", () => {
    expect(inkOn("#B6E085")).toBe(INK_DARK); // Sprout — white is 1.50:1
    expect(inkOn("#FBD97E")).toBe(INK_DARK); // Sunshine — white is 1.37:1
    expect(inkOn("#DADADA")).toBe(INK_DARK); // Charcoal — white is 1.40:1
  });

  it("picks white where the dark ink would disappear", () => {
    expect(inkOn("#00526D")).toBe(INK_LIGHT); // Deep River — dark ink is 2.01:1
    expect(inkOn("#2178AF")).toBe(INK_LIGHT);
    expect(inkOn("#915EA1")).toBe(INK_LIGHT);
  });

  it("normalises its input", () => {
    expect(inkOn("#b6e085")).toBe(inkOn("#B6E085"));
  });
});

describe("eventInk", () => {
  // The six fills whose fixed dark ink lands under 4.5:1 and must flip to
  // white (FR-214). The visual brief lists nine "dark" palette values, but
  // that list is the set never photographed on an event block; measured, the
  // other three (Ochre 5.64:1, Deep Clementine 4.54:1, Coral 5.85:1) hold the
  // dark ink — flipping them would put white at 3.09:1 or worse and break
  // FR-214's own floor.
  const WHITE_INK_FILLS = [
    "#CB434C", // Deep Grapefruit — dark ink 3.69:1
    "#00526D", // Deep River — dark ink 2.01:1
    "#2178AF", // Blue — dark ink 3.62:1
    "#2D8086", // Deep Sky — dark ink 3.77:1
    "#408257", // Deep Sprout — dark ink 3.77:1
    "#915EA1", // Deep Lavender — dark ink 3.58:1
  ] as const;

  it("clears 4.5:1 against the block's own fill for every palette colour (FR-214)", () => {
    for (const hex of PALETTE) {
      expect(contrastRatio(hex, eventInk([hex]))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is inkOn under the hood — one mechanism for Profiles and Labels alike (FR-211)", () => {
    for (const hex of PALETTE) {
      expect(eventInk([hex])).toBe(inkOn(hex));
    }
  });

  it("takes the fill from the leftmost solid segment on a striped block (FR-214)", () => {
    for (const first of PALETTE) {
      for (const second of PALETTE) {
        expect(eventInk([first, second])).toBe(inkOn(first));
      }
    }
    // Deep River leads: white ink, whatever pastels follow.
    expect(eventInk(["#00526D", "#FBD97E", "#DADADA"])).toBe(INK_LIGHT);
    // Same colours, Sunshine leads: dark ink.
    expect(eventInk(["#FBD97E", "#00526D", "#DADADA"])).toBe(INK_DARK);
  });

  it("flips to white on exactly the dark fills where the dark ink fails 4.5:1", () => {
    const flipped = PALETTE.filter((hex) => eventInk([hex]) === INK_LIGHT);
    expect(flipped).toEqual([...WHITE_INK_FILLS]);
    for (const hex of WHITE_INK_FILLS) {
      expect(contrastRatio(hex, INK_DARK)).toBeLessThan(4.5);
      expect(contrastRatio(hex, INK_LIGHT)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses the dark ink for the neutral no-category block (FR-213)", () => {
    expect(eventInk([])).toBe(INK_DARK);
  });
});
