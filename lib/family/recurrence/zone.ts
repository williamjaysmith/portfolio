/**
 * IANA-zone offset math on `Intl.DateTimeFormat` (research R202) — the one
 * place wall clocks and instants meet. `expand.ts` composes these; nothing
 * else may reimplement the gap/fold policy:
 *
 * - `wallToInstant` on a spring-forward GAP lands on the transition edge —
 *   the first valid time on that date (02:30 → 03:00 exactly, FR-235).
 * - `wallToInstant` on a fall-back FOLD takes the FIRST of the two instants
 *   (FR-236).
 *
 * Formatters are cached per zone: construction is the expensive part; a
 * week's expansion makes thousands of cheap `formatToParts` calls.
 *
 * This file is the future Temporal swap point: when Temporal is native in
 * every target, these three functions are the only surface to replace.
 *
 * Framework-free: no imports at all.
 */

/** A clock reading in some zone — month 1–12, hour 0–23. Never a UTC claim. */
export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  const cached = formatters.get(zone);
  if (cached) return cached;
  // h23 pins midnight to "00" — other hour cycles may print "24".
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatters.set(zone, formatter);
  return formatter;
}

/** The zone's wall-clock reading of a UTC instant (epoch ms). */
export function instantToWall(zone: string, instantMs: number): WallTime {
  const fields = new Map<string, number>();
  for (const part of formatterFor(zone).formatToParts(instantMs)) {
    if (part.type !== "literal") fields.set(part.type, Number(part.value));
  }
  return {
    year: fieldOf(fields, "year", zone),
    month: fieldOf(fields, "month", zone),
    day: fieldOf(fields, "day", zone),
    hour: fieldOf(fields, "hour", zone),
    minute: fieldOf(fields, "minute", zone),
    second: fieldOf(fields, "second", zone),
  };
}

/** UTC offset of `zone` at an instant, in ms (positive east of UTC). */
export function zoneOffsetMs(zone: string, instantMs: number): number {
  const wall = instantToWall(zone, instantMs);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  // The formatter reads whole seconds; compare at the same truncation.
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The instant (epoch ms) at which `zone`'s clock shows `wall`, under the
 * FR-235 (gap → transition edge) and FR-236 (fold → first instant) policy.
 */
export function wallToInstant(zone: string, wall: WallTime): number {
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  // Any transition affecting this wall time lies within ±24h (offsets are
  // bounded by ±14h), so the offsets a day either side are the only candidates.
  const before = zoneOffsetMs(zone, wallAsUtc - DAY_MS);
  const after = zoneOffsetMs(zone, wallAsUtc + DAY_MS);
  const valid = [...new Set([before, after])]
    .map((offset) => wallAsUtc - offset)
    .filter((instant) => zoneOffsetMs(zone, instant) === wallAsUtc - instant);
  // One candidate: normal time. Two: a fold — the FIRST instant (FR-236).
  if (valid.length > 0) return Math.min(...valid);
  return gapEdge(zone, wallAsUtc, before, after);
}

/**
 * The wall time sits in a spring-forward gap: return the transition instant —
 * the first valid time on that date (FR-235; 02:30 lands at 03:00 exactly).
 */
function gapEdge(zone: string, wallAsUtc: number, before: number, after: number): number {
  if (after <= before) {
    throw new Error(`zone "${zone}" produced a gap without a forward offset step`);
  }
  // offset(low) === before (pre-transition), offset(high) === after; binary
  // search converges on the exact ms where the offset steps.
  let low = wallAsUtc - after;
  let high = wallAsUtc - before;
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (zoneOffsetMs(zone, mid) === after) high = mid;
    else low = mid;
  }
  return high;
}

function fieldOf(fields: Map<string, number>, type: string, zone: string): number {
  const value = fields.get(type);
  if (value === undefined || Number.isNaN(value)) {
    throw new Error(`Intl produced no numeric "${type}" part for zone "${zone}"`);
  }
  return value;
}
