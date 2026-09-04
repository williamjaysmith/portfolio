"use server";

/**
 * Events — the week calendar's write surface (specs/002-family-week-calendar,
 * contracts/server-actions.md → "Events"): `createEvent`, `updateEvent`,
 * `deleteEvent`. There is no drag action: a drag commit is `updateEvent` with
 * a scope and new times (R205/R208 — one write path, one validation surface).
 *
 * Every write is `requireActor()` and none is parent-only (FR-270/272). The
 * punched-in profile, read from the signed cookie, is the attribution
 * (FR-271) — never anything in the payload. Zod runs before anything reaches
 * the database; the constraints of 010–012 are the second line, not the first.
 *
 * Two invariants live here and nowhere else:
 *   - the rrule string is produced ONLY by the grammar's emitter, from the
 *     structured `RepeatChoice` (R201) — clients never send rule text;
 *   - an occurrence is only ever judged real by `expandWindow`, the module the
 *     browser renders from, so client and server cannot disagree about what
 *     an occurrence is (contracts, "Read path").
 */

import type { z } from "zod";

import { addDays, diffDays, localDateOf, type DateWindow } from "../calendar/dates";
import { expandWindow } from "../calendar/expand";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireActor } from "../guards";
import { emitRule, parseRule, type RuleUntil, type RuleWeekday } from "../recurrence/grammar";
import { datePartsOf, epochDayOf } from "../recurrence/plain-date";
import { wallToInstant } from "../recurrence/zone";
import {
  eventsSelect,
  toEvent,
  type EventWithRelationsRow,
} from "../rows";
import {
  WEEKDAYS,
  type Actor,
  type DeleteEventInput,
  type Event,
  type EventException,
  type EventInput,
  type EventTimes,
  type ExceptionAction,
  type Occurrence,
  type RepeatChoice,
  type Scope,
  type UpdateEventInput,
  type WeekStart,
} from "../types";
import {
  deleteEventInputSchema,
  parseOrThrow,
  updateEventInputSchema,
  validateEventInput,
} from "../validation";
import { adminFamily, mapDbError, touchActor } from "./shared";

type UpdateInput = z.output<typeof updateEventInputSchema>;
type Patch = UpdateInput["patch"];
type DeleteInput = z.output<typeof deleteEventInputSchema>;

/** Snake-cased columns for an INSERT/UPDATE/UPSERT. */
type EventWrite = Record<string, string | boolean | null>;

/** What every expansion and every rule emission needs from the household (FR-284, R201). */
interface HouseholdZone {
  zone: string;
  /** `WKST` on weekly rules — the household's start-of-week. */
  wkst: RuleWeekday;
}

/** The exception row's payload — exactly FR-239's four; `null` = inherit from the series. */
interface ExceptionPayload {
  summary: string | null;
  description: string | null;
  location: string | null;
  times: EventTimes | null;
}

const WKST_OF: Record<WeekStart, RuleWeekday> = { 0: "SU", 1: "MO" };

// The same embed the week read uses: ordered links and EVERY exception (R206).
const EVENT_WITH_RELATIONS = eventsSelect();

const NO_PAIRS: EventWrite = { starts_at: null, ends_at: null, start_date: null, end_date: null };
const EMPTY_PAYLOAD: ExceptionPayload = { summary: null, description: null, location: null, times: null };
const TEXT_FIELDS = ["summary", "description", "location"] as const;

const UNTIL_BEFORE_START = "The repeat can't end before the event starts.";
const SCOPE_REQUIRED = "Choose which events this applies to.";
const SCOPE_ON_ONE_OFF = "This event doesn't repeat, so there is nothing to choose.";
const OCCURRENCE_REQUIRED = "Say which occurrence this applies to.";

/* ------------------------------------------------------------------------- *
 * Reads through the admin client — scoped by household, which IS the tenancy
 * check under the service role.
 * ------------------------------------------------------------------------- */

async function loadHouseholdZone(householdId: string): Promise<HouseholdZone> {
  const { data, error } = await adminFamily()
    .from("household_settings")
    .select("timezone, start_week_on")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND", "This household has no settings row.");
  const row = data as unknown as { timezone: string; start_week_on: WeekStart };
  return { zone: row.timezone, wkst: WKST_OF[row.start_week_on] };
}

/** The admin re-read of contracts step 1: an id outside the household is `NOT_FOUND`, never `FORBIDDEN`. */
async function loadEvent(householdId: string, id: string): Promise<Event> {
  const { data, error } = await adminFamily()
    .from("events")
    .select(EVENT_WITH_RELATIONS)
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toEvent(data as unknown as EventWithRelationsRow);
}

/** Every id must be a category of this household (contracts, "Shared input shapes"). */
async function assertCategoriesInHousehold(
  householdId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { count, error } = await adminFamily()
    .from("categories")
    .select("id", { head: true, count: "exact" })
    .eq("household_id", householdId)
    .in("id", [...ids]);
  if (error) throw mapDbError(error);
  if ((count ?? 0) !== ids.length) throw new ActionFailure("NOT_FOUND");
}

/* ------------------------------------------------------------------------- *
 * Dates and rules — the emitter is the only producer of rule text (R201).
 * ------------------------------------------------------------------------- */

function wallMs(zone: string, date: string, hour: number, minute: number, second: number): number {
  return wallToInstant(zone, { ...datePartsOf(epochDayOf(date)), hour, minute, second });
}

function dayOfMonth(date: string): number {
  return datePartsOf(epochDayOf(date)).day;
}

/** The household-local date an event's times begin on — its anchor, and the exception key (R204). */
function startDateOf(times: EventTimes, zone: string): string {
  return times.allDay ? times.startDate : localDateOf(zone, Date.parse(times.startsAt));
}

/**
 * UNTIL in the form the grammar fixes per shape: a plain date for an all-day
 * series, the household-zone end of the chosen day for a timed one (R201).
 */
function untilOn(date: string, allDay: boolean, zone: string): RuleUntil {
  return allDay ? { kind: "date", date } : { kind: "instant", ms: wallMs(zone, date, 23, 59, 59) };
}

/** UNTIL as the household-local date it admits — the expander's own reading. */
function untilDateOf(until: RuleUntil, zone: string): string {
  return until.kind === "date" ? until.date : localDateOf(zone, until.ms);
}

/** A stored UNTIL keeps its form unless the series changed shape (contracts, "Rule/start coherence"). */
function retimedUntil(until: RuleUntil | null, allDay: boolean, zone: string): RuleUntil | null {
  if (until === null || (until.kind === "date") === allDay) return until;
  return untilOn(untilDateOf(until, zone), allDay, zone);
}

/** The structured choice (FR-231/232) → the one canonical rule string, or `null` for a one-off. */
function ruleFromChoice(
  choice: RepeatChoice,
  times: EventTimes,
  household: HouseholdZone,
): string | null {
  if (choice.kind === "never") return null;
  const untilDate = choice.until ?? null;
  const until = untilDate === null ? null : untilOn(untilDate, times.allDay, household.zone);
  // INTERVAL is stamped here, never sent: `RepeatChoice` carries no interval,
  // so the calendar's rules stay at 1 while the grammar admits 1–99 (R301).
  if (choice.kind === "daily") return emitRule({ freq: "DAILY", interval: 1, until });
  if (choice.kind === "weekly") {
    return emitRule({
      freq: "WEEKLY",
      interval: 1,
      until,
      wkst: household.wkst,
      byDay: [...choice.weekdays],
    });
  }
  // BYMONTHDAY is derived from the start, never sent.
  return emitRule({
    freq: "MONTHLY",
    interval: 1,
    until,
    byMonthDay: dayOfMonth(startDateOf(times, household.zone)),
  });
}

function shiftWeekday(day: RuleWeekday, delta: number): RuleWeekday {
  return WEEKDAYS[(((WEEKDAYS.indexOf(day) + delta) % 7) + 7) % 7];
}

/**
 * Re-derive a stored rule's anchor parts for a moved start, so rule and
 * start never disagree (the emitter's invariant, R201): BYMONTHDAY from the
 * new day-of-month, a weekly BYDAY set shifted by the move's day delta, UNTIL
 * re-formed when `all_day` changed.
 */
function reanchorRule(rrule: string, from: EventTimes, to: EventTimes, zone: string): string {
  const rule = parseRule(rrule);
  const until = retimedUntil(rule.until, to.allDay, zone);
  if (rule.freq === "DAILY") return emitRule({ freq: "DAILY", interval: 1, until });
  if (rule.freq === "MONTHLY") {
    return emitRule({
      freq: "MONTHLY",
      interval: 1,
      until,
      byMonthDay: dayOfMonth(startDateOf(to, zone)),
    });
  }
  const delta = diffDays(startDateOf(from, zone), startDateOf(to, zone));
  return emitRule({ ...rule, until, byDay: rule.byDay.map((day) => shiftWeekday(day, delta)) });
}

/** The head's rule after a split or a truncating delete: UNTIL = the day before the cut. */
function truncatedRule(rrule: string, allDay: boolean, cut: string, zone: string): string {
  return emitRule({ ...parseRule(rrule), until: untilOn(addDays(cut, -1), allDay, zone) });
}

/** A rule whose UNTIL precedes its own start expands to nothing — refused, as on create. */
function assertRuleReachable(rrule: string | null, times: EventTimes, zone: string): void {
  if (rrule === null) return;
  const { until } = parseRule(rrule);
  if (until !== null && untilDateOf(until, zone) < startDateOf(times, zone)) {
    throw new ActionFailure("VALIDATION", UNTIL_BEFORE_START, { repeat: [UNTIL_BEFORE_START] });
  }
}

/* ------------------------------------------------------------------------- *
 * Occurrences — judged by the shared expander, never by a private walk.
 * ------------------------------------------------------------------------- */

function dateWindow(zone: string, from: string, to: string): DateWindow {
  return {
    startDate: from,
    endDate: to,
    startMs: wallMs(zone, from, 0, 0, 0),
    endMs: wallMs(zone, addDays(to, 1), 0, 0, 0),
  };
}

/**
 * The series with its overrides dropped and its skips kept: which dates hold
 * a real, unskipped occurrence — wherever an override may have DRAWN one,
 * since the key is the original date (R204), not the rendered one.
 */
function skeletonOf(event: Event): Event {
  return { ...event, exceptions: event.exceptions.filter((entry) => entry.action === "skip") };
}

/** The real, unskipped occurrences whose ORIGINAL dates fall in [from, to], with their nominal times. */
function occurrencesBetween(event: Event, from: string, to: string, zone: string): Occurrence[] {
  if (to < from) return [];
  return expandWindow([skeletonOf(event)], dateWindow(zone, from, to), zone).filter(
    (occurrence) => occurrence.occurrenceDate >= from && occurrence.occurrenceDate <= to,
  );
}

/** Contracts step 3: `occurrenceDate` must name a real, unskipped occurrence, else `NOT_FOUND`. */
function requireOccurrence(event: Event, date: string, zone: string): Occurrence {
  const found = occurrencesBetween(event, date, date, zone).find(
    (occurrence) => occurrence.occurrenceDate === date,
  );
  if (!found) throw new ActionFailure("NOT_FOUND");
  return found;
}

/** FR-241: nothing renders before `date`, so a split would leave an empty head. */
function isFirstOccurrence(event: Event, date: string, zone: string): boolean {
  const start = startDateOf(event.times, zone);
  return occurrencesBetween(event, start, addDays(date, -1), zone).length === 0;
}

/* ------------------------------------------------------------------------- *
 * Column shaping
 * ------------------------------------------------------------------------- */

/** Exactly one populated pair per shape — the opposite pair explicitly nulled (010/012 CHECKs). */
function pairColumns(times: EventTimes | null): EventWrite {
  if (times === null) return { ...NO_PAIRS };
  if (times.allDay) return { ...NO_PAIRS, start_date: times.startDate, end_date: times.endDate };
  return { ...NO_PAIRS, starts_at: times.startsAt, ends_at: times.endsAt };
}

function timeColumns(times: EventTimes): EventWrite {
  return { all_day: times.allDay, ...pairColumns(times) };
}

/** The whole pair a patch carries, if any — the schema guarantees no lone edge and one shape. */
function patchTimes(patch: Patch): EventTimes | null {
  if (patch.startsAt !== undefined && patch.endsAt !== undefined) {
    return { allDay: false, startsAt: patch.startsAt, endsAt: patch.endsAt };
  }
  if (patch.startDate !== undefined && patch.endDate !== undefined) {
    return { allDay: true, startDate: patch.startDate, endDate: patch.endDate };
  }
  return null;
}

function textColumns(patch: Patch): EventWrite {
  const columns: EventWrite = {};
  for (const field of TEXT_FIELDS) {
    const value = patch[field];
    if (value !== undefined) columns[field] = value;
  }
  return columns;
}

/** A patched value when given, the current one otherwise — `null` is a value, `undefined` is silence. */
function pick<T>(patched: T | undefined, current: T): T {
  return patched === undefined ? current : patched;
}

/* ------------------------------------------------------------------------- *
 * Writes
 * ------------------------------------------------------------------------- */

async function insertLinks(
  householdId: string,
  eventId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  // `position` = array index: the stripe draw order (FR-227).
  const rows = ids.map((category_id, position) => ({
    household_id: householdId,
    event_id: eventId,
    category_id,
    position,
  }));
  const { error } = await adminFamily().from("event_categories").insert(rows);
  if (error) throw mapDbError(error);
}

/** The link set is rewritten wholesale in draw order (contracts step 6). */
async function replaceLinks(event: Event, ids: readonly string[]): Promise<void> {
  const { error } = await adminFamily()
    .from("event_categories")
    .delete()
    .eq("event_id", event.id)
    .eq("household_id", event.householdId);
  if (error) throw mapDbError(error);
  await insertLinks(event.householdId, event.id, ids);
}

async function deleteExceptions(
  householdId: string,
  eventId: string,
  dates: { eq?: string; gte?: string } = {},
): Promise<void> {
  let query = adminFamily()
    .from("event_exceptions")
    .delete()
    .eq("event_id", eventId)
    .eq("household_id", householdId);
  if (dates.eq !== undefined) query = query.eq("occurrence_date", dates.eq);
  if (dates.gte !== undefined) query = query.gte("occurrence_date", dates.gte);
  const { error } = await query;
  if (error) throw mapDbError(error);
}

function exceptionOn(event: Event, date: string): EventException | undefined {
  return event.exceptions.find((entry) => entry.occurrenceDate === date);
}

/**
 * The one exception write, keyed by the occurrence's original date: an
 * override upsert (contracts step 4) or the skip that replaces any override
 * on that date (FR-240). Every payload column is explicit, so a skip nulls
 * what an override held and a time override always carries exactly one pair.
 */
async function writeException(
  event: Event,
  date: string,
  action: ExceptionAction,
  payload: ExceptionPayload,
  actor: Actor,
): Promise<void> {
  const row: EventWrite = {
    household_id: event.householdId,
    event_id: event.id,
    occurrence_date: date,
    action,
    summary: payload.summary,
    description: payload.description,
    location: payload.location,
    ...pairColumns(payload.times),
    // The creator is written once; every later write is the updater.
    ...(exceptionOn(event, date) ? {} : { created_by: actor.profileId }),
    updated_by: actor.profileId,
  };
  const { error } = await adminFamily()
    .from("event_exceptions")
    .upsert(row, { onConflict: "event_id,occurrence_date" });
  if (error) throw mapDbError(error);
}

/** The patch merged onto the existing override; time replaces as a whole pair (contracts step 4). */
function mergedOverride(existing: EventException | undefined, patch: Patch): ExceptionPayload {
  return {
    summary: pick(patch.summary, existing?.summary ?? null),
    description: pick(patch.description, existing?.description ?? null),
    location: pick(patch.location, existing?.location ?? null),
    times: patchTimes(patch) ?? existing?.times ?? null,
  };
}

/** Scope `this` (FR-239): the override row on the occurrence's original date. */
async function upsertOverride(
  event: Event,
  date: string,
  patch: Patch,
  actor: Actor,
): Promise<void> {
  const payload = mergedOverride(exceptionOn(event, date), patch);
  // Every field back to "inherit" is no override at all: the occurrence
  // reverts to its series rather than tripping 012's payload CHECK.
  if (Object.values(payload).every((value) => value === null)) {
    return deleteExceptions(event.householdId, event.id, { eq: date });
  }
  await writeException(event, date, "override", payload, actor);
}

/** The rule the segment carries after the patch: rebuilt from a repeat choice, re-anchored after a move, else kept. */
function segmentRule(
  event: Event,
  patch: Patch,
  times: EventTimes,
  household: HouseholdZone,
): string | null {
  if (patch.repeat !== undefined) return ruleFromChoice(patch.repeat, times, household);
  if (event.rrule === null || patchTimes(patch) === null) return event.rrule;
  return reanchorRule(event.rrule, event.times, times, household.zone);
}

/**
 * In place on the row the id names — a one-off (whose repeat field may turn
 * it into a series, contracts step 2) or a series segment at scope `all`
 * (step 6: after a split this reaches only the segment, FR-242).
 */
async function updateSegment(
  event: Event,
  patch: Patch,
  actor: Actor,
  household: HouseholdZone,
): Promise<void> {
  const newTimes = patchTimes(patch);
  const times = newTimes ?? event.times;
  const rrule = segmentRule(event, patch, times, household);
  assertRuleReachable(rrule, times, household.zone);

  const { error } = await adminFamily()
    .from("events")
    .update({
      ...textColumns(patch),
      ...(newTimes === null ? {} : timeColumns(newTimes)),
      rrule,
      updated_by: actor.profileId,
    })
    .eq("id", event.id)
    .eq("household_id", event.householdId);
  if (error) throw mapDbError(error);

  if (patch.categoryIds !== undefined) await replaceLinks(event, patch.categoryIds);
  // A series turned one-off keeps no exceptions: inert now, and wrong if it
  // ever repeats again.
  if (rrule === null && event.rrule !== null) {
    await deleteExceptions(event.householdId, event.id);
  }
}

/**
 * Scope `this_and_future` off the first occurrence (contracts step 5): both
 * rule strings pre-computed here, the tail self-contained — start on the
 * chosen occurrence's NOMINAL slot with the patch applied, the original
 * UNTIL carried, provenance copied — then one transaction in
 * `family.split_event_series` (015), so a truncated head cannot exist
 * without its tail. Returns the tail's id.
 */
async function splitSeries(
  event: Event,
  rrule: string,
  patch: Patch,
  nominal: Occurrence,
  actor: Actor,
  household: HouseholdZone,
): Promise<string> {
  const cut = nominal.occurrenceDate;
  const tailTimes = patchTimes(patch) ?? nominal.times;
  const tailRule =
    patch.repeat === undefined
      ? reanchorRule(rrule, nominal.times, tailTimes, household.zone)
      : ruleFromChoice(patch.repeat, tailTimes, household);
  assertRuleReachable(tailRule, tailTimes, household.zone);

  const { data, error } = await adminFamily().rpc("split_event_series", {
    p_household_id: event.householdId,
    p_event_id: event.id,
    p_actor: actor.profileId,
    p_head_rrule: truncatedRule(rrule, event.times.allDay, cut, household.zone),
    p_cut: cut,
    p_tail_event: {
      summary: pick(patch.summary, event.summary),
      description: pick(patch.description, event.description),
      location: pick(patch.location, event.location),
      ...timeColumns(tailTimes),
      timezone: event.timezone,
      rrule: tailRule,
      countdown_enabled: event.countdownEnabled,
    },
    p_tail_category_ids: patch.categoryIds ?? event.categoryIds,
  });
  if (error) throw mapDbError(error);
  if (typeof data !== "string") throw new ActionFailure("UNAVAILABLE");

  // A tail that no longer repeats has nothing for its re-homed exceptions to key.
  if (tailRule === null) await deleteExceptions(event.householdId, data);
  return data;
}

/** FR-286: re-emit UNTIL = cut − 1 day. Runs FIRST, so a mid-failure leaves only inert rows (012). */
async function truncateSeries(
  event: Event,
  rrule: string,
  cut: string,
  actor: Actor,
  zone: string,
): Promise<void> {
  const { error } = await adminFamily()
    .from("events")
    .update({
      rrule: truncatedRule(rrule, event.times.allDay, cut, zone),
      updated_by: actor.profileId,
    })
    .eq("id", event.id)
    .eq("household_id", event.householdId);
  if (error) throw mapDbError(error);
}

/** The row goes; links and exceptions cascade (FR-243), so no skip ghost can outlive it. */
async function deleteRow(event: Event): Promise<void> {
  const { error } = await adminFamily()
    .from("events")
    .delete()
    .eq("id", event.id)
    .eq("household_id", event.householdId);
  if (error) throw mapDbError(error);
}

/* ------------------------------------------------------------------------- *
 * Scope discipline (FR-238/250): the server never infers a scope.
 * ------------------------------------------------------------------------- */

function requireScope(scope: Scope | undefined): Scope {
  if (scope === undefined) {
    throw new ActionFailure("VALIDATION", SCOPE_REQUIRED, { scope: [SCOPE_REQUIRED] });
  }
  return scope;
}

/** FR-238: a one-off takes no scope and names no occurrence. */
function requireNoScope(input: { scope?: Scope; occurrenceDate?: string }): void {
  if (input.scope !== undefined || input.occurrenceDate !== undefined) {
    throw new ActionFailure("VALIDATION", SCOPE_ON_ONE_OFF, { scope: [SCOPE_ON_ONE_OFF] });
  }
}

/** The schema already demands it for `this`/`this_and_future`; this keeps the type honest. */
function requireOccurrenceDate(input: { occurrenceDate?: string }): string {
  if (input.occurrenceDate === undefined) {
    throw new ActionFailure("VALIDATION", OCCURRENCE_REQUIRED, {
      occurrenceDate: [OCCURRENCE_REQUIRED],
    });
  }
  return input.occurrenceDate;
}

/** Contracts steps 2–6, in order. Returns the tail's id when a split happened. */
async function applyUpdate(
  event: Event,
  input: UpdateInput,
  actor: Actor,
  household: HouseholdZone,
): Promise<string | null> {
  if (event.rrule === null) {
    requireNoScope(input);
    await updateSegment(event, input.patch, actor, household);
    return null;
  }
  const scope = requireScope(input.scope);
  if (scope === "all") {
    await updateSegment(event, input.patch, actor, household);
    return null;
  }
  const occurrence = requireOccurrence(event, requireOccurrenceDate(input), household.zone);
  if (scope === "this") {
    await upsertOverride(event, occurrence.occurrenceDate, input.patch, actor);
    return null;
  }
  // FR-241: on the first occurrence `this_and_future` is silently `all`.
  if (isFirstOccurrence(event, occurrence.occurrenceDate, household.zone)) {
    await updateSegment(event, input.patch, actor, household);
    return null;
  }
  return splitSeries(event, event.rrule, input.patch, occurrence, actor, household);
}

/** The contract's delete table, by scope. */
async function applyDelete(
  event: Event,
  input: DeleteInput,
  actor: Actor,
  household: HouseholdZone,
): Promise<void> {
  if (event.rrule === null) {
    requireNoScope(input);
    return deleteRow(event);
  }
  const scope = requireScope(input.scope);
  if (scope === "all") return deleteRow(event);
  const { occurrenceDate } = requireOccurrence(
    event,
    requireOccurrenceDate(input),
    household.zone,
  );
  if (scope === "this") return writeException(event, occurrenceDate, "skip", EMPTY_PAYLOAD, actor);
  if (isFirstOccurrence(event, occurrenceDate, household.zone)) return deleteRow(event);
  await truncateSeries(event, event.rrule, occurrenceDate, actor, household.zone);
  await deleteExceptions(event.householdId, event.id, { gte: occurrenceDate });
}

/* ------------------------------------------------------------------------- *
 * The actions
 * ------------------------------------------------------------------------- */

export async function createEvent(input: EventInput): Promise<ActionResult<Event>> {
  return runAction(async () => {
    const actor = await requireActor();
    const household = await loadHouseholdZone(actor.householdId);
    const parsed = validateEventInput(input, household.zone);
    await assertCategoriesInHousehold(actor.householdId, parsed.categoryIds);

    const { data, error } = await adminFamily()
      .from("events")
      .insert({
        household_id: actor.householdId,
        summary: parsed.summary,
        description: parsed.description ?? null,
        location: parsed.location ?? null,
        ...timeColumns(parsed),
        // Provenance only (FR-224); nothing renders from it.
        timezone: parsed.timezone,
        rrule: ruleFromChoice(parsed.repeat, parsed, household),
        // `countdown_enabled` stays at its default (FR-228).
        created_by: actor.profileId,
        updated_by: actor.profileId,
      })
      .select("id")
      .single();
    if (error) throw mapDbError(error);
    const { id } = data as { id: string };

    await insertLinks(actor.householdId, id, parsed.categoryIds);
    await touchActor(actor);
    return loadEvent(actor.householdId, id);
  });
}

export async function updateEvent(
  input: UpdateEventInput,
): Promise<ActionResult<{ eventId: string; splitEventId: string | null }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const parsed = parseOrThrow(updateEventInputSchema, input);
    const household = await loadHouseholdZone(actor.householdId);
    const event = await loadEvent(actor.householdId, parsed.id);
    if (parsed.patch.categoryIds !== undefined) {
      await assertCategoriesInHousehold(actor.householdId, parsed.patch.categoryIds);
    }

    const splitEventId = await applyUpdate(event, parsed, actor, household);
    await touchActor(actor);
    return { eventId: event.id, splitEventId };
  });
}

export async function deleteEvent(input: DeleteEventInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    // FR-258: `confirm` is a literal `true` in the schema; once through, the delete is final.
    const parsed = parseOrThrow(deleteEventInputSchema, input);
    const household = await loadHouseholdZone(actor.householdId);
    const event = await loadEvent(actor.householdId, parsed.id);

    await applyDelete(event, parsed, actor, household);
    await touchActor(actor);
    return null;
  });
}
