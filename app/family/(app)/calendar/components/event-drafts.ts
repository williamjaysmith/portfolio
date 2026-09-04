import { addDays, diffDays, localDateOf, weekWindowOf } from "@/lib/family/calendar/dates";
import { repeatChoiceOf } from "@/lib/family/calendar/expand";
import type {
  Event,
  EventInput,
  EventPatch,
  EventTimes,
  Occurrence,
  RepeatChoice,
  Weekday,
} from "@/lib/family/types";
import { WEEKDAYS } from "@/lib/family/types";

import { wallMinutesOf } from "./NowLine";
import type { EventDraft, EventFormSeed } from "./useEventForm";

/**
 * The pure translations between the grid, the form and the actions (T050):
 *
 * - `slotSeedOf`   — a tapped empty slot → the form's prefill (FR-255);
 * - `seedOf`       — a tapped occurrence → the edit form's prefill;
 * - `patchOf`      — the edit form's submission → only what CHANGED, so a
 *                    `scope: 'this'` patch carries nothing series-only
 *                    (FR-239/287) and an untouched field is never rewritten;
 * - `rebasedOnSeries` — a time change chosen for ALL events, re-anchored
 *                    onto the series' own start so the whole series moves
 *                    by the same amount instead of restarting at the
 *                    occurrence that was edited.
 *
 * Two clocks meet here. The grid and the stored data speak the HOUSEHOLD
 * zone (FR-219/284); the form's date and time boxes speak the DEVICE's wall
 * clock (T046). On the wall tablet they agree; on a phone abroad the tapped
 * 14:00 slot must still save as the household's 14:00, so every seed converts
 * household wall time → instant → device wall time, and the form's own
 * `toInstant` walks the road back (US2-16).
 */

/** FR-255: an event started from a slot lasts one hour by default. */
const DEFAULT_DURATION_MINUTES = 60;
const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 1440;

/** The tapped occurrence together with the row it expands from — what every write round-trips. */
export interface EditTarget {
  occurrence: Occurrence;
  event: Event;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** The device's wall-clock date and time of an instant — the form's vocabulary. */
function deviceWallOf(instantMs: number): { date: string; time: string } {
  const at = new Date(instantMs);
  return {
    date: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`,
    time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
  };
}

/** Wall minutes of an instant counted from `date`'s midnight in the zone — past 1440 on the next day. */
function wallMinutesFrom(zone: string, date: string, instantMs: number): number {
  return diffDays(date, localDateOf(zone, instantMs)) * MINUTES_PER_DAY + wallMinutesOf(zone, instantMs);
}

/**
 * The instant of a household wall time. `weekWindowOf` already knows the
 * zone's midnight of any date; the minutes are added as elapsed time and
 * corrected once against the wall clock, so a DST day's missing or repeated
 * hour never lands the slot an hour off its label (FR-235/236).
 */
export function householdWallInstant(zone: string, date: string, minutes: number): number {
  const guess = weekWindowOf(date, zone).startMs + minutes * MINUTE_MS;
  return guess + (minutes - wallMinutesFrom(zone, date, guess)) * MINUTE_MS;
}

/** FR-255: that day, that 15-minute slot, one hour long — in the form's device clock. */
export function slotSeedOf(zone: string, date: string, minutes: number): EventFormSeed {
  const startMs = householdWallInstant(zone, date, minutes);
  const start = deviceWallOf(startMs);
  const end = deviceWallOf(startMs + DEFAULT_DURATION_MINUTES * MINUTE_MS);
  return {
    allDay: false,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  };
}

type DraftTimes = Pick<EventDraft, "allDay" | "startDate" | "endDate"> &
  Partial<Pick<EventDraft, "startTime" | "endTime">>;

/** Stored times → the form's boxes; an all-day pair keeps the hidden time boxes at their defaults. */
function draftTimesOf(times: EventTimes): DraftTimes {
  if (times.allDay) return { allDay: true, startDate: times.startDate, endDate: times.endDate };
  const start = deviceWallOf(Date.parse(times.startsAt));
  const end = deviceWallOf(Date.parse(times.endsAt));
  return {
    allDay: false,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
  };
}

function untilOf(repeat: RepeatChoice): string {
  return repeat.kind === "never" ? "" : (repeat.until ?? "");
}

/** The edit form's prefill: the occurrence's EFFECTIVE fields (any override already merged). */
export function seedOf({ occurrence, event }: EditTarget, zone: string): EventFormSeed {
  const repeat = repeatChoiceOf(event.rrule, zone);
  return {
    summary: occurrence.summary,
    ...draftTimesOf(occurrence.times),
    repeatKind: repeat.kind,
    weekdays: repeat.kind === "weekly" ? [...repeat.weekdays] : [],
    until: untilOf(repeat),
    categoryIds: [...occurrence.categoryIds],
    location: occurrence.location ?? "",
    notes: occurrence.description ?? "",
  };
}

/* ------------------------------------------------------------------------- *
 * The diff
 * ------------------------------------------------------------------------- */

function sameInstant(a: string, b: string): boolean {
  return Date.parse(a) === Date.parse(b);
}

function sameTimes(a: EventTimes, b: EventTimes): boolean {
  if (a.allDay && b.allDay) return a.startDate === b.startDate && a.endDate === b.endDate;
  if (!a.allDay && !b.allDay) {
    return sameInstant(a.startsAt, b.startsAt) && sameInstant(a.endsAt, b.endsAt);
  }
  return false;
}

/** Sunday-first, whatever order a shifted or hand-picked set arrived in. */
function sortedWeekdays(days: readonly Weekday[]): Weekday[] {
  return [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

function sameRepeat(a: RepeatChoice, b: RepeatChoice): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "never" || b.kind === "never") return true;
  if ((a.until ?? null) !== (b.until ?? null)) return false;
  if (a.kind !== "weekly" || b.kind !== "weekly") return true;
  return sortedWeekdays(a.weekdays).join(",") === sortedWeekdays(b.weekdays).join(",");
}

/** The same SET of ids — the stored link order is the draw order at write time and is not a change. */
function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** The whole pair a submission carries, `allDay` included, in the patch's shape. */
function patchTimesOf(input: EventInput): Partial<EventTimes> {
  if (input.allDay) return { allDay: true, startDate: input.startDate, endDate: input.endDate };
  return { allDay: false, startsAt: input.startsAt, endsAt: input.endsAt };
}

/**
 * Only what the person changed, judged against what the form showed them —
 * the occurrence's effective values for its own fields, the series for the
 * repeat. An empty patch means nothing to write.
 */
export function patchOf(input: EventInput, { occurrence, event }: EditTarget, zone: string): EventPatch {
  const patch: EventPatch = {};
  if (input.summary !== occurrence.summary) patch.summary = input.summary;
  const description = input.description ?? null;
  if (description !== occurrence.description) patch.description = description;
  const location = input.location ?? null;
  if (location !== occurrence.location) patch.location = location;
  if (!sameTimes(input, occurrence.times)) Object.assign(patch, patchTimesOf(input));
  if (!sameRepeat(input.repeat, repeatChoiceOf(event.rrule, zone))) patch.repeat = input.repeat;
  if (!sameIdSet(input.categoryIds, occurrence.categoryIds)) {
    patch.categoryIds = [...input.categoryIds];
  }
  return patch;
}

export function isEmptyPatch(patch: EventPatch): boolean {
  return Object.keys(patch).length === 0;
}

/**
 * FR-287 / FR-239: Profiles and Labels and the repeat belong to the series,
 * so a change touching them cannot be scoped to one event — the scope
 * question must not offer "This event".
 */
export function touchesSeriesFields(patch: EventPatch): boolean {
  return patch.categoryIds !== undefined || patch.repeat !== undefined;
}

/** `patchTimesOf` always writes `allDay` beside its pair, so the flag alone says whether times changed. */
function hasTimes(patch: EventPatch): boolean {
  return patch.allDay !== undefined;
}

/** The patch's series fields alone — `EventPatch`'s time half is a union, so it is rebuilt, not spread. */
function withoutTimes(patch: EventPatch): EventPatch {
  const rest: EventPatch = {};
  if (patch.summary !== undefined) rest.summary = patch.summary;
  if (patch.description !== undefined) rest.description = patch.description;
  if (patch.location !== undefined) rest.location = patch.location;
  if (patch.repeat !== undefined) rest.repeat = patch.repeat;
  if (patch.categoryIds !== undefined) rest.categoryIds = patch.categoryIds;
  return rest;
}

/** The household-local date an event's times begin on — the series' anchor. */
function startDateOf(times: EventTimes, zone: string): string {
  return times.allDay ? times.startDate : localDateOf(zone, Date.parse(times.startsAt));
}

/**
 * The submitted times carried onto the series' anchor: the same day shift
 * the person made to the occurrence they edited, the submitted wall time
 * and duration. Without this, "All events" with a new time would move the
 * series' start to the edited occurrence's date and every earlier
 * occurrence would vanish.
 */
function timesOnAnchor(input: EventInput, target: EditTarget, zone: string): EventTimes {
  const editedDate = startDateOf(target.occurrence.times, zone);
  const anchorDate = startDateOf(target.event.times, zone);
  const newDate = addDays(anchorDate, diffDays(editedDate, startDateOf(input, zone)));
  if (input.allDay) {
    return {
      allDay: true,
      startDate: newDate,
      endDate: addDays(newDate, diffDays(input.startDate, input.endDate)),
    };
  }
  const startMs = Date.parse(input.startsAt);
  const anchoredStart = householdWallInstant(zone, newDate, wallMinutesOf(zone, startMs));
  return {
    allDay: false,
    startsAt: new Date(anchoredStart).toISOString(),
    endsAt: new Date(anchoredStart + (Date.parse(input.endsAt) - startMs)).toISOString(),
  };
}

/** A patch bound for scope `all` on a series: its time change re-anchored onto the series' start. */
export function rebasedOnSeries(
  patch: EventPatch,
  input: EventInput,
  target: EditTarget,
  zone: string,
): EventPatch {
  if (!hasTimes(patch) || target.event.rrule === null) return patch;
  return { ...withoutTimes(patch), ...timesOnAnchor(input, target, zone) };
}
