/**
 * Epoch-day arithmetic on plain `YYYY-MM-DD` dates — the household-local
 * date vocabulary shared by the recurrence walk (`expand.ts`) and the
 * calendar's week maths (`calendar/dates.ts`), extracted so neither
 * reimplements it (quality-bars: no new duplication).
 *
 * An epoch day is a date's UTC-midnight ms divided by 86 400 000 — a pure
 * day counter. UTC has no transitions, so stepping by whole days can never
 * cross a DST boundary; zone semantics stay in `zone.ts` alone.
 *
 * Framework-free: no imports at all.
 */

export const DAY_MS = 86_400_000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01. Throws on anything but a real `YYYY-MM-DD` date. */
export function epochDayOf(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`"${date}" is not a YYYY-MM-DD date`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const probe = new Date(ms);
  // A rolled-over date (2026-02-30 → Mar 2) is a lie, not a parse.
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new Error(`"${date}" is not a real calendar date`);
  }
  return ms / DAY_MS;
}

export function isoOfEpochDay(day: number): string {
  const parts = datePartsOf(day);
  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
}

/** Calendar fields of an epoch day — month 1–12, matching `WallTime`. */
export function datePartsOf(day: number): { year: number; month: number; day: number } {
  const date = new Date(day * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayIndexOf(day: number): number {
  return new Date(day * DAY_MS).getUTCDay();
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
