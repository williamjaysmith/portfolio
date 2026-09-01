/**
 * The 20-colour category palette and the tint math derived from it.
 *
 * Skylight's `GET /api/colors` returns exactly these 20 values in this order
 * (docs/research/skylight/07-visual-design-system.md §1.1) and rejects any
 * other hex server-side; the `family.palette_color` domain mirrors that in the
 * database and `paletteColorSchema` mirrors it at the action boundary.
 *
 * Every profile-tinted surface is ONE accent composited on white at a fixed
 * opacity per role (§1.4): 100 % block / chip cap, 40 % chip body, 20 % column
 * header. `mixWithWhite` is that formula for places CSS `color-mix()` cannot
 * reach (tests, canvas, e-mail); the UI itself uses `--profile` + `color-mix`.
 *
 * Framework-free: no imports at all.
 */

export const PALETTE = [
  "#FDC36D",
  "#FBD97E",
  "#CE812D",
  "#FDB305",
  "#F3B075",
  "#CF632E",
  "#F66951",
  "#FBA994",
  "#CB434C",
  "#D5B6EC",
  "#A8D4D3",
  "#93D1E6",
  "#00526D",
  "#2178AF",
  "#82D7DD",
  "#2D8086",
  "#B6E085",
  "#408257",
  "#DADADA",
  "#915EA1",
] as const;

export type PaletteColor = (typeof PALETTE)[number];

export const PALETTE_NAMES: Record<PaletteColor, string> = {
  "#FDC36D": "Orange",
  "#FBD97E": "Sunshine",
  "#CE812D": "Ochre",
  "#FDB305": "Deep Sunshine",
  "#F3B075": "Clementine",
  "#CF632E": "Deep Clementine",
  "#F66951": "Coral",
  "#FBA994": "Grapefruit",
  "#CB434C": "Deep Grapefruit",
  "#D5B6EC": "Lavender",
  "#A8D4D3": "Cyan",
  "#93D1E6": "River",
  "#00526D": "Deep River",
  "#2178AF": "Blue",
  "#82D7DD": "Sky",
  "#2D8086": "Deep Sky",
  "#B6E085": "Sprout",
  "#408257": "Deep Sprout",
  "#DADADA": "Charcoal",
  "#915EA1": "Deep Lavender",
};

const PALETTE_SET: ReadonlySet<string> = new Set(PALETTE);

/** Exact, case-sensitive membership — run `normalizeHex` first for user input. */
export function isPaletteColor(value: unknown): value is PaletteColor {
  return typeof value === "string" && PALETTE_SET.has(value);
}

/** Trim + uppercase. Keeps a leading `#` but never adds one. */
export function normalizeHex(value: string): string {
  return value.trim().toUpperCase();
}

const HEX_RGB = /^#?([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/;

function parseHex(hex: string): [number, number, number] {
  const match = HEX_RGB.exec(normalizeHex(hex));
  if (!match) {
    throw new RangeError(`Expected a #RRGGBB colour, got "${hex}"`);
  }
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function toHexByte(channel: number): string {
  return channel.toString(16).toUpperCase().padStart(2, "0");
}

/**
 * Composite `hex` over white in sRGB: `round(s * c + (1 - s) * 255)` per channel.
 * `strength` 1 returns the colour itself; 0 returns white.
 */
export function mixWithWhite(hex: string, strength: number): string {
  const s = Math.min(1, Math.max(0, strength));
  const mixed = parseHex(hex).map((channel) => Math.round(s * channel + (1 - s) * 255));
  return `#${mixed.map(toHexByte).join("")}`;
}

/** The three tint roles from the design system: 100 % / 40 % / 20 % on white. */
export function tints(hex: PaletteColor): { full: string; medium: string; faint: string } {
  return {
    full: hex,
    medium: mixWithWhite(hex, 0.4),
    faint: mixWithWhite(hex, 0.2),
  };
}

/** Inline-style object that sets the accent the `.fam-profile` tints derive from. */
export function profileVars(hex: PaletteColor): { "--profile": string } {
  return { "--profile": hex };
}

/**
 * Default avatar text: first letter of the first two words, uppercased.
 * Uses code points (not UTF-16 units) so a name starting with an astral
 * character still yields one visible glyph.
 */
export function initialsFor(label: string): string {
  return label
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join("");
}
