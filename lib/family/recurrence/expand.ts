/**
 * `expandSeries` — the stateless date-walk that turns one stored series into
 * its occurrences over a household-local date range (FR-234/235/236, R202) —
 * and `ruleDatesIn`, the date-only primitive it is built on: ONE rule walk,
 * two consumers (R304). Events add times to those dates; the tasks board
 * takes them bare, so nothing invents a clock time for a routine that has none.
 *
 * The walk is per LOCAL date in the household's zone: the series start is
 * converted to household wall clock once, rule-matching dates within
 * [anchor, UNTIL] produce occurrences at that wall time, and each is
 * converted back to an instant through `zone.ts` — so the gap policy
 * (02:30 → 03:00, FR-235) and the fold policy (first instant, FR-236) are
 * inherited, never reimplemented. Duration is applied in INSTANT space, so
 * an occurrence running through a repeated hour keeps its true elapsed time.
 *
 * UNTIL inclusivity is a local-date comparison (R201): an occurrence is kept
 * while its household-zone date ≤ UNTIL's household-zone date — which is what
 * keeps a genuine Skylight `T235959Z` rule's until-date evening occurrence.
 *
 * Exceptions are applied here (R204): a `skip` drops its date; an `override`
 * merges its non-null fields, with time replacing as a whole pair. The
 * closed grammar guarantees at most one occurrence per local date, so the
 * date alone keys an exception. The emitted `occurrenceDate` is always the
 * ORIGINAL date — a time override never moves the key.
 *
 * Callers go through `lib/family/calendar/expand.ts` (the fallow boundary);
 * only that module, the actions and tests may import this file.
 */

import { parseRule, type RecurrenceRule, type RuleUntil } from "./grammar";
import { instantToWall, wallToInstant, type WallTime } from "./zone";
import {
  DAY_MS,
  datePartsOf,
  epochDayOf,
  isoOfEpochDay,
  monthsBetween,
  weekdayIndexOf,
  weekStartDay,
} from "./plain-date";
import { WEEKDAYS, type EventTimes, type ExceptionAction, type Weekday } from "../types";

/** Inclusive household-local date range to walk, both ends `YYYY-MM-DD`. */
export interface LocalDateRange {
  start: string;
  end: string;
}

/** The slice of an exception row the expansion needs (`EventException` satisfies it). */
export interface SeriesException {
  /** The occurrence's ORIGINAL household-local date — THE key (R204). */
  occurrenceDate: string;
  action: ExceptionAction;
  summary: string | null;
  description: string | null;
  location: string | null;
  times: EventTimes | null;
}

/** The slice of a series row the expansion needs (`Event` satisfies it, `rrule` narrowed). */
export interface SeriesInput {
  rrule: string;
  summary: string;
  description: string | null;
  location: string | null;
  times: EventTimes;
  exceptions: readonly SeriesException[];
}

/** One computed occurrence; field values are effective — any override is merged. */
export interface SeriesOccurrence {
  occurrenceDate: string;
  summary: string;
  description: string | null;
  location: string | null;
  times: EventTimes;
}

type Anchor =
  | { allDay: false; day: number; wall: WallTime; durationMs: number }
  | { allDay: true; day: number; spanDays: number };

/**
 * The household-local dates a rule produces in `range`, counting intervals
 * from `anchorDate` — the ONE rule walk (R304). `expandSeries` adds times to
 * these dates; the tasks board takes them as they are, so a routine with no
 * clock time never has a start instant invented for it.
 *
 * `zone` is here because UNTIL inclusivity is a LOCAL-DATE comparison (R201):
 * a timed rule's `UNTIL` is a UTC instant, and which household day that falls
 * on is the whole question a `T235959Z` rule asks.
 */
export function ruleDatesIn(
  rule: RecurrenceRule,
  anchorDate: string,
  range: LocalDateRange,
  zone: string,
): string[] {
  const anchorDay = epochDayOf(anchorDate);
  // Clamped at the anchor: a series has no occurrence before its own start.
  const firstDay = Math.max(epochDayOf(range.start), anchorDay);
  const lastDay = Math.min(epochDayOf(range.end), lastDayUnder(rule.until, zone));
  const dates: string[] = [];
  for (let day = firstDay; day <= lastDay; day += 1) {
    if (dateMatches(rule, day, anchorDay)) dates.push(isoOfEpochDay(day));
  }
  return dates;
}

export function expandSeries(
  series: SeriesInput,
  range: LocalDateRange,
  zone: string,
): SeriesOccurrence[] {
  const rule = parseRule(series.rrule);
  const anchor = anchorOf(series.times, zone);
  const byDate = new Map(series.exceptions.map((entry) => [entry.occurrenceDate, entry]));

  const occurrences: SeriesOccurrence[] = [];
  for (const date of ruleDatesIn(rule, isoOfEpochDay(anchor.day), range, zone)) {
    const exception = byDate.get(date);
    if (exception?.action === "skip") continue;
    occurrences.push(occurrenceOn(series, anchor, epochDayOf(date), exception, zone));
  }
  return occurrences;
}

/** The series' own first occurrence, read in the household zone. */
function anchorOf(times: EventTimes, zone: string): Anchor {
  if (times.allDay) {
    return {
      allDay: true,
      day: epochDayOf(times.startDate),
      spanDays: epochDayOf(times.endDate) - epochDayOf(times.startDate),
    };
  }
  const startMs = parseInstant(times.startsAt);
  const wall = instantToWall(zone, startMs);
  return {
    allDay: false,
    day: epochDayOfWall(wall),
    wall,
    durationMs: parseInstant(times.endsAt) - startMs,
  };
}

/** The last epoch day UNTIL admits — by LOCAL date, never by instant (R201). */
function lastDayUnder(until: RuleUntil | null, zone: string): number {
  if (until === null) return Number.MAX_SAFE_INTEGER;
  if (until.kind === "date") return epochDayOf(until.date);
  return epochDayOfWall(instantToWall(zone, until.ms));
}

/**
 * Does `rule` produce an occurrence on this household-local day, counting
 * intervals from `anchorDay` — the series' own first date (R303)?
 *
 * Every arm collapses to Phase 2's predicate at `interval === 1`, because
 * `x % 1 === 0` for every integer; T015 asserts that over the whole reachable
 * domain rather than by inspection. `%` preserves the dividend's sign and
 * `-0 === 0`, so a day BEFORE the anchor is judged on the same lattice — no
 * floor-mod helper is needed.
 *
 * A day-of-month that a month does not have simply never matches, so
 * `BYMONTHDAY=31` at `INTERVAL=3` can leave a six-month gap. That is Phase 2's
 * behaviour widened, not a regression; clamping was refused (R303).
 */
export function dateMatches(rule: RecurrenceRule, day: number, anchorDay: number): boolean {
  if (rule.freq === "DAILY") return (day - anchorDay) % rule.interval === 0;
  if (rule.freq === "WEEKLY") return weeklyMatches(rule, day, anchorDay);
  return (
    datePartsOf(day).day === rule.byMonthDay &&
    monthsBetween(anchorDay, day) % rule.interval === 0
  );
}

type WeeklyRule = Extract<RecurrenceRule, { freq: "WEEKLY" }>;

function weeklyMatches(rule: WeeklyRule, day: number, anchorDay: number): boolean {
  if (!rule.byDay.includes(weekdayTokenOf(day))) return false;
  // The grammar admits a null WKST only at interval 1, where every week matches.
  if (rule.wkst === null) return true;
  const weekOne = WEEKDAYS.indexOf(rule.wkst);
  const weeks = (weekStartDay(day, weekOne) - weekStartDay(anchorDay, weekOne)) / 7;
  return weeks % rule.interval === 0;
}

function occurrenceOn(
  series: SeriesInput,
  anchor: Anchor,
  day: number,
  exception: SeriesException | undefined,
  zone: string,
): SeriesOccurrence {
  return {
    occurrenceDate: isoOfEpochDay(day),
    summary: exception?.summary ?? series.summary,
    description: exception?.description ?? series.description,
    location: exception?.location ?? series.location,
    // A time override replaces the whole pair (contracts step 4).
    times: exception?.times ?? nominalTimes(anchor, day, zone),
  };
}

/** The occurrence's times had no override touched it: anchor wall time on `day`. */
function nominalTimes(anchor: Anchor, day: number, zone: string): EventTimes {
  if (anchor.allDay) {
    return {
      allDay: true,
      startDate: isoOfEpochDay(day),
      endDate: isoOfEpochDay(day + anchor.spanDays),
    };
  }
  const parts = datePartsOf(day);
  const startMs = wallToInstant(zone, {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: anchor.wall.hour,
    minute: anchor.wall.minute,
    second: anchor.wall.second,
  });
  return {
    allDay: false,
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(startMs + anchor.durationMs).toISOString(),
  };
}

function weekdayTokenOf(day: number): Weekday {
  // WEEKDAYS is Sunday-first, matching getUTCDay's 0–6.
  return WEEKDAYS[weekdayIndexOf(day)];
}

function epochDayOfWall(wall: WallTime): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day) / DAY_MS;
}

function parseInstant(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`"${iso}" is not a parseable instant`);
  return ms;
}
