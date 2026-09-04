/**
 * `expandWindow` — the ONE expansion entry point (R206, contracts "Read
 * path"): every renderer and every occurrence-validating server action turns
 * fetched `events` rows into `Occurrence`s HERE, so client and server can
 * never disagree about what an occurrence is. The fallow boundary makes the
 * recurrence internals unreachable except through this module, the actions'
 * emitter import and tests.
 *
 * Expansion is worked in the HOUSEHOLD's timezone whatever zone an event
 * carries (FR-219/FR-234 — `event.timezone` is provenance and is never read).
 *
 * The moved occurrence is handled completely, both directions, because every
 * series row arrives with ALL its exceptions embedded: an occurrence whose
 * override moved it out of the window is dropped by the effective-times
 * filter, and an occurrence whose override lands in the window is emitted
 * even when its original date falls outside the walked range (R206).
 *
 * Output order is deterministic — original date, then event id — for stable
 * memoization; renderers place blocks by `times`, never by this order.
 */

import {
  expandSeries,
  type LocalDateRange,
  type SeriesInput,
  type SeriesOccurrence,
} from "../recurrence/expand";
import { parseRule, type RuleUntil } from "../recurrence/grammar";
import { DAY_MS } from "../recurrence/plain-date";
import { addDays, diffDays, localDateOf, type WeekWindow } from "./dates";
import type { Event, EventTimes, Occurrence, RepeatChoice } from "../types";

/**
 * A stored rule read back as the form's structured choice (FR-231/232) —
 * the one place client code turns rule text into anything, so the details
 * view and the edit form describe a repeat without ever touching the grammar
 * (R201; the boundary seals `recurrence/` behind this module). `until` comes
 * back as the household-local date it admits — the expander's own reading of
 * an instant UNTIL — and a `null` rule is a one-off.
 */
export function repeatChoiceOf(rrule: string | null, householdTz: string): RepeatChoice {
  if (rrule === null) return { kind: "never" };
  const rule = parseRule(rrule);
  const until = untilDateOf(rule.until, householdTz);
  if (rule.freq === "DAILY") return { kind: "daily", until };
  if (rule.freq === "WEEKLY") return { kind: "weekly", weekdays: [...rule.byDay], until };
  // BYMONTHDAY is derived from the start on every write, never chosen.
  return { kind: "monthly", until };
}

function untilDateOf(until: RuleUntil | null, householdTz: string): string | null {
  if (until === null) return null;
  return until.kind === "date" ? until.date : localDateOf(householdTz, until.ms);
}

export function expandWindow(
  events: readonly Event[],
  window: WeekWindow,
  householdTz: string,
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  for (const event of events) {
    if (event.rrule === null) pushOneOff(occurrences, event, window, householdTz);
    else pushSeries(occurrences, event, event.rrule, window, householdTz);
  }
  return occurrences.sort(byOriginalDateThenEvent);
}

function pushOneOff(
  out: Occurrence[],
  event: Event,
  window: WeekWindow,
  householdTz: string,
): void {
  if (!intersectsWindow(event.times, window)) return;
  out.push({
    eventId: event.id,
    occurrenceDate: originalDateOf(event.times, householdTz),
    isRepeating: false,
    summary: event.summary,
    description: event.description,
    location: event.location,
    categoryIds: event.categoryIds,
    times: event.times,
  });
}

function pushSeries(
  out: Occurrence[],
  event: Event,
  rrule: string,
  window: WeekWindow,
  householdTz: string,
): void {
  const series: SeriesInput = {
    rrule,
    summary: event.summary,
    description: event.description,
    location: event.location,
    times: event.times,
    exceptions: event.exceptions,
  };
  const walk = walkRangeOf(event.times, window);
  const candidates = [
    ...expandSeries(series, walk, householdTz),
    ...movedInOccurrences(series, walk, window, householdTz),
  ];
  for (const occurrence of candidates) {
    if (!intersectsWindow(occurrence.times, window)) continue;
    out.push({
      eventId: event.id,
      occurrenceDate: occurrence.occurrenceDate,
      isRepeating: true,
      summary: occurrence.summary,
      description: occurrence.description,
      location: occurrence.location,
      categoryIds: event.categoryIds,
      times: occurrence.times,
    });
  }
}

/**
 * The local dates whose UNMOVED occurrences could intersect the window:
 * back-padded by the series' own span so a long or midnight-crossing
 * occurrence anchored before the window is still walked. No magic number —
 * the pad is derived from the duration (+1 day absorbs DST stretch).
 */
function walkRangeOf(times: EventTimes, window: WeekWindow): LocalDateRange {
  const padDays = times.allDay
    ? diffDays(times.startDate, times.endDate)
    : Math.ceil((Date.parse(times.endsAt) - Date.parse(times.startsAt)) / DAY_MS) + 1;
  return { start: addDays(window.startDate, -padDays), end: window.endDate };
}

/**
 * Occurrences whose override landed them in the window though their ORIGINAL
 * date lies outside the walked range (R206's moved-occurrence guarantee).
 * Re-expanding the single original date proves the exception names a real,
 * unskipped occurrence — a phantom row expands to nothing.
 */
function movedInOccurrences(
  series: SeriesInput,
  walk: LocalDateRange,
  window: WeekWindow,
  householdTz: string,
): SeriesOccurrence[] {
  const moved: SeriesOccurrence[] = [];
  for (const exception of series.exceptions) {
    if (exception.action !== "override" || exception.times === null) continue;
    // ISO dates compare lexicographically.
    if (exception.occurrenceDate >= walk.start && exception.occurrenceDate <= walk.end) continue;
    if (!intersectsWindow(exception.times, window)) continue;
    const date = exception.occurrenceDate;
    moved.push(...expandSeries(series, { start: date, end: date }, householdTz));
  }
  return moved;
}

function intersectsWindow(times: EventTimes, window: WeekWindow): boolean {
  if (times.allDay) {
    // Inclusive date pair against inclusive window dates (FR-225).
    return times.startDate <= window.endDate && times.endDate >= window.startDate;
  }
  // Instants against the half-open [startMs, endMs).
  return Date.parse(times.startsAt) < window.endMs && Date.parse(times.endsAt) > window.startMs;
}

/** The exception key (R204): the household-local date the times BEGIN on. */
function originalDateOf(times: EventTimes, householdTz: string): string {
  if (times.allDay) return times.startDate;
  return localDateOf(householdTz, Date.parse(times.startsAt));
}

function byOriginalDateThenEvent(a: Occurrence, b: Occurrence): number {
  const byDate = a.occurrenceDate.localeCompare(b.occurrenceDate);
  return byDate !== 0 ? byDate : a.eventId.localeCompare(b.eventId);
}
