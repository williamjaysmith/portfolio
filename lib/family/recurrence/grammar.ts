/**
 * The closed recurrence grammar (research R201, FR-231/232/233): strict parser
 * and the SOLE canonical emitter of `events.rrule` strings.
 *
 * Grammar, field order fixed:
 *   FREQ=DAILY|WEEKLY|MONTHLY ;INTERVAL=1 [;UNTIL=…] [;WKST=…] [;BYDAY=…|;BYMONTHDAY=…]
 *
 * - `INTERVAL=1` is always written and is the only interval accepted.
 * - `COUNT` and any part outside the grammar are refused (FR-232's DB CHECK is
 *   the backstop, this parser is the contract).
 * - `WKST` is legal on WEEKLY rules only; `BYDAY` (WEEKLY) and `BYMONTHDAY`
 *   (MONTHLY) are always explicit so a stored rule is self-describing.
 * - `UNTIL` is a plain `YYYYMMDD` date for all-day series and a
 *   `YYYYMMDDTHHMMSSZ` UTC instant (the household-zone end of the chosen day)
 *   for timed series; inclusivity is the expander's job, by local-date
 *   comparison, never decided here.
 * - The observed reference rule
 *   `FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU`
 *   must survive parse→emit byte-for-byte (FR-233).
 *
 * Clients never produce rule strings; only server actions call `emitRule`.
 * A parse failure is a bug (a stored rule outside the grammar), so both
 * directions throw plain `Error`s rather than returning result shapes.
 *
 * Framework-free: no imports at all.
 */

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type RuleWeekday = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

export type RuleUntil =
  | { kind: "date"; date: string } // "YYYY-MM-DD" — all-day series
  | { kind: "instant"; ms: number }; // whole-second UTC epoch — timed series

export type RecurrenceRule =
  | { freq: "DAILY"; until: RuleUntil | null }
  | { freq: "WEEKLY"; until: RuleUntil | null; wkst: RuleWeekday | null; byDay: RuleWeekday[] }
  | { freq: "MONTHLY"; until: RuleUntil | null; byMonthDay: number };

const WEEKDAYS: readonly RuleWeekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const UNTIL_DATE = /^(\d{4})(\d{2})(\d{2})$/;
const UNTIL_INSTANT = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
// One day 1–31, no leading zero, no list — "on the date", singular (FR-231).
const BY_MONTH_DAY = /^([1-9]|[12][0-9]|3[01])$/;
const EMITTED_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Part {
  key: string;
  value: string;
}

/** Parse a stored rule. Throws on anything outside the closed grammar. */
export function parseRule(text: string): RecurrenceRule {
  const parts = toParts(text);
  let index = 0;
  const demand = (key: string): string => {
    const part = parts[index];
    if (!part || part.key !== key) {
      throw new Error(`expected ${key}, found "${part?.key ?? "nothing"}" in rule "${text}"`);
    }
    index += 1;
    return part.value;
  };
  const optional = (key: string): string | null =>
    parts[index]?.key === key ? demand(key) : null;

  const freq = parseFrequency(demand("FREQ"));
  const interval = demand("INTERVAL");
  if (interval !== "1") {
    throw new Error(`INTERVAL=${interval} refused — the closed grammar admits INTERVAL=1 only`);
  }
  const untilRaw = optional("UNTIL");
  const wkstRaw = optional("WKST");
  if (wkstRaw !== null && freq !== "WEEKLY") {
    throw new Error(`WKST is weekly-only in the closed grammar, found it on FREQ=${freq}`);
  }
  const rule = finishRule(freq, untilRaw === null ? null : parseUntil(untilRaw), wkstRaw, demand);
  const leftover = parts[index];
  if (leftover) throw new Error(`unexpected part "${leftover.key}" in rule "${text}"`);
  return rule;
}

/** Emit the one canonical string for a rule. Throws on inexpressible input. */
export function emitRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.freq}`, "INTERVAL=1"];
  if (rule.until !== null) parts.push(`UNTIL=${formatUntil(rule.until)}`);
  if (rule.freq === "WEEKLY") {
    if (rule.wkst !== null) parts.push(`WKST=${rule.wkst}`);
    parts.push(`BYDAY=${formatByDay(rule.byDay)}`);
  } else if (rule.freq === "MONTHLY") {
    parts.push(`BYMONTHDAY=${formatByMonthDay(rule.byMonthDay)}`);
  }
  return parts.join(";");
}

function toParts(text: string): Part[] {
  return text.split(";").map((piece) => {
    const eq = piece.indexOf("=");
    if (eq < 1 || eq === piece.length - 1) {
      throw new Error(`malformed part "${piece}" — every part is KEY=VALUE`);
    }
    return { key: piece.slice(0, eq), value: piece.slice(eq + 1) };
  });
}

function finishRule(
  freq: RecurrenceFrequency,
  until: RuleUntil | null,
  wkstRaw: string | null,
  demand: (key: string) => string,
): RecurrenceRule {
  if (freq === "DAILY") return { freq, until };
  if (freq === "WEEKLY") {
    return {
      freq,
      until,
      wkst: wkstRaw === null ? null : parseWeekday(wkstRaw),
      byDay: parseByDay(demand("BYDAY")),
    };
  }
  return { freq, until, byMonthDay: parseByMonthDay(demand("BYMONTHDAY")) };
}

function parseFrequency(value: string): RecurrenceFrequency {
  if (value === "DAILY" || value === "WEEKLY" || value === "MONTHLY") return value;
  throw new Error(`FREQ=${value} refused — only DAILY, WEEKLY and MONTHLY exist (FR-231)`);
}

function parseWeekday(value: string): RuleWeekday {
  const day = WEEKDAYS.find((token) => token === value);
  if (!day) throw new Error(`"${value}" is not a weekday token (SU…SA)`);
  return day;
}

function parseByDay(value: string): RuleWeekday[] {
  const days = value.split(",").map(parseWeekday);
  if (new Set(days).size !== days.length) {
    throw new Error(`BYDAY=${value} carries a duplicate weekday`);
  }
  return days;
}

function parseByMonthDay(value: string): number {
  if (!BY_MONTH_DAY.test(value)) {
    throw new Error(`BYMONTHDAY=${value} refused — one unpadded day-of-month 1–31`);
  }
  return Number(value);
}

function parseUntil(value: string): RuleUntil {
  const date = UNTIL_DATE.exec(value);
  if (date) {
    checkedUtcMs(Number(date[1]), Number(date[2]), Number(date[3]), 0, 0, 0);
    return { kind: "date", date: `${date[1]}-${date[2]}-${date[3]}` };
  }
  const instant = UNTIL_INSTANT.exec(value);
  if (instant) {
    const [, y, mo, d, h, mi, s] = instant.map(Number);
    return { kind: "instant", ms: checkedUtcMs(y, mo, d, h, mi, s) };
  }
  throw new Error(`UNTIL=${value} is neither YYYYMMDD nor YYYYMMDDTHHMMSSZ`);
}

function formatUntil(until: RuleUntil): string {
  if (until.kind === "date") {
    const match = EMITTED_DATE.exec(until.date);
    if (!match) throw new Error(`until date "${until.date}" is not YYYY-MM-DD`);
    checkedUtcMs(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, 0);
    return `${match[1]}${match[2]}${match[3]}`;
  }
  if (!Number.isInteger(until.ms) || until.ms % 1000 !== 0) {
    throw new Error("an until instant must be a whole-second UTC epoch — finer cannot round-trip");
  }
  const d = new Date(until.ms);
  const year = d.getUTCFullYear();
  if (year < 1000 || year > 9999) {
    throw new Error(`until instant year ${year} does not fit the four-digit UNTIL form`);
  }
  return (
    `${pad(year, 4)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}` +
    `T${pad(d.getUTCHours(), 2)}${pad(d.getUTCMinutes(), 2)}${pad(d.getUTCSeconds(), 2)}Z`
  );
}

function formatByDay(byDay: readonly RuleWeekday[]): string {
  if (byDay.length === 0) throw new Error("a weekly rule needs at least one weekday (FR-231)");
  if (new Set(byDay).size !== byDay.length) throw new Error("BYDAY carries a duplicate weekday");
  return byDay.join(",");
}

function formatByMonthDay(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`byMonthDay ${day} is outside 1–31`);
  }
  return String(day);
}

/** Date.UTC that refuses impossible fields (a rolled-over date is a lie). */
function checkedUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const probe = new Date(ms);
  const real =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    probe.getUTCHours() === hour &&
    probe.getUTCMinutes() === minute &&
    probe.getUTCSeconds() === second;
  if (!real) {
    throw new Error(`${year}-${month}-${day}T${hour}:${minute}:${second} is not a real UTC time`);
  }
  return ms;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
