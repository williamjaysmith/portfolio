"use server";

/**
 * Tasks — the board's write surface (specs/003-family-tasks,
 * contracts/server-actions.md → "Tasks" and "Resolutions"): `createTask`,
 * `updateTask` and `deleteTask`, and the three resolution verbs —
 * `completeTaskOccurrence` (which is also FR-367's CLAIM, since the credit is
 * the whole of it), `skipTaskOccurrence` and `unresolveTaskOccurrence`, which
 * is FR-355's un-complete and FR-361's unskip in one write.
 *
 * `skipTaskOccurrence` authors NO second write: it exposes the `writeSkip()`
 * helper `deleteTask`'s "this occurrence" scope already commits through, which
 * is FR-364 — one record covers both acts — held as one code path rather than
 * as a convention two functions are asked to remember.
 *
 * **The guard splits with the verb** (FR-389). Creating, editing and deleting a
 * task are `requireParent()`; resolving one is `requireVerifiedActor()` plus
 * FR-351's ownership rule, which is the first rule in this app whose answer
 * depends on the RECORD and not on the actor's role alone.
 *
 * Four rules live here and are not repeated anywhere else:
 *
 *   - the resolution guard reads the role the database holds right now, never
 *     the role the cookie remembers (R323);
 *   - an occurrence is only ever judged real by `expandTaskDay`, the module the
 *     browser renders from, so client and server cannot disagree about what an
 *     occurrence is and a stale client cannot resolve — or delete — a phantom
 *     (R315);
 *   - `resolved_on` is the household-local date of the WRITE, taken from
 *     `household_settings.timezone` — never the client's, and never the
 *     occurrence's own date (FR-354, SC-308);
 *   - the rrule string is produced ONLY by the shared emitter, from the
 *     structured `TaskRepeatChoice` (R201/R301) — clients never send rule text,
 *     and `ruleFromTaskChoice` is deliberately NOT merged with the events
 *     `ruleFromChoice`: different unions, different constraints, and the part
 *     that is genuinely shared is `emitRule` itself.
 *
 * **There is no scope on an edit** (FR-331): tasks carry no per-occurrence
 * overrides, so an edit is an edit of the task and reaches every assignee.
 * Scopes exist on `deleteTask` alone, with FR-347's own asymmetry.
 *
 * There is no RPC on this path (R310 as superseded): a completion is one
 * INSERT, an undo is one DELETE, a truncating delete is one UPDATE, FR-370's
 * single claim is the occurrence key's unique index and FR-344's refusal is the
 * chain's foreign key. The one companion write is the streak checkpoint, whose
 * only half-state is a stale number FR-374 heals on the next resolution or undo
 * of that routine.
 */

import { z } from "zod";

import { addDays, localDateOf } from "../calendar/dates";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireParent, requireVerifiedActor } from "../guards";
import { nextSortOrder, SORT_GAP } from "../ordering";
import { ownsOccurrence, type OccurrenceTarget } from "../permissions";
import { ruleDatesIn } from "../recurrence/expand";
import { emitRule, parseRule, type RuleUntil, type RuleWeekday } from "../recurrence/grammar";
import { datePartsOf, epochDayOf } from "../recurrence/plain-date";
import {
  TASK_CURSOR_COLUMNS,
  TASK_RESOLUTION_COLUMNS,
  tasksSelect,
  toTask,
  toTaskCursor,
  toTaskResolution,
  type TaskCursorRow,
  type TaskResolutionRow,
  type TaskWithAssigneesRow,
} from "../rows";
import { expandTaskDay } from "../tasks/expand";
import { taskRepeatChoiceOf } from "../tasks/repeat";
import { resolutionAt, resolutionIndexOf, resolutionKeyOf } from "../tasks/resolutions";
import { nextStreak, type DayOutcome } from "../tasks/streaks";
import type {
  Actor,
  BoardOccurrence,
  OccurrenceKey,
  OccurrenceState,
  ResolutionStatus,
  Task,
  TaskCursor,
  TaskRepeatChoice,
  TaskResolution,
  TaskScope,
  WeekStart,
} from "../types";
import { parseOrThrow, taskInputSchema, type TaskInput } from "../validation";
import { adminFamily, loadProfile, mapDbError, touchActor } from "./shared";

const INVALID_ID = "Invalid id.";
const CREDIT_REQUIRED = "Choose who this one is for.";
const CREDIT_UNWANTED = "This task already belongs to someone.";
const NOT_YOURS = "That's not your task — only a parent can do it.";
const SUCCESSOR_RESOLVED =
  "The next time this came round has already been done — undo that one first.";
const LABEL_NOT_ASSIGNABLE = "A task can only be given to a person, not to a label.";
const SAVE_TO_TASK_BOX_ON_CREATE = "Saving to the task box is chosen when the task is created.";
const CONFIRM_REQUIRED = "Deleting needs to be confirmed.";
const SCOPE_REQUIRED = "Choose which of these this applies to.";
const SCOPE_ON_ONE_OFF = "This task doesn't repeat, so there is nothing to choose.";
const ROUTINE_SKIP_INSTEAD = "Use Skip to remove one day of a routine.";
const SKIP_ON_ONE_OFF = "This task doesn't repeat, so there is nothing to skip.";
const OCCURRENCE_REQUIRED = "Say which one this applies to.";
const KEY_IS_ANOTHER_TASK = "That occurrence belongs to a different task.";

/**
 * The five-column occurrence key, strict: `resolved_on`, a status or any other
 * field a client might invent is refused rather than ignored, which is what
 * makes "the client never names the date" structural (SC-308).
 */
const occurrenceKeySchema = z.strictObject({
  taskId: z.uuid({ error: INVALID_ID }),
  assigneeId: z.uuid({ error: INVALID_ID }).nullable(),
  occurrenceDate: z.iso.date({ error: "Dates must look like 2026-10-06." }).nullable(),
  slot: z.enum(["morning", "afternoon", "evening"], { error: "Invalid time of day." }).nullable(),
  cyclePrev: z.uuid({ error: INVALID_ID }).nullable().optional(),
});

const completeOccurrenceSchema = z.strictObject({
  occurrence: occurrenceKeySchema,
  creditProfileId: z.uuid({ error: INVALID_ID }).optional(),
});

/** Skip and undo take the occurrence alone: neither of them names a Profile. */
const occurrenceOnlySchema = z.strictObject({ occurrence: occurrenceKeySchema });

/**
 * `updateTask`'s envelope. The patch is carried as bare keys and judged as part
 * of the MERGED shape below rather than field by field here — which is what
 * makes FR-331 structural: a `scope`, an occurrence key or anything else a
 * client invents survives the merge into `taskInputSchema`'s strict object and
 * is refused there, so there is no second list of allowed fields to drift.
 */
const updateTaskSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  patch: z.record(z.string(), z.unknown(), { error: "That edit didn't look right." }),
});

/** FR-347's three scopes, in the task surface's own words. */
const taskScopeSchema = z.enum(["this", "this_and_future", "all"], { error: SCOPE_REQUIRED });

const deleteTaskSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  // FR-258's precedent: a literal `true`, so a missing flag is a refusal.
  confirm: z.literal(true, { error: CONFIRM_REQUIRED }),
  scope: taskScopeSchema.optional(),
  occurrenceKey: occurrenceKeySchema.optional(),
});

/* ------------------------------------------------------------------------- *
 * Reads through the admin client — scoped by household, which IS the tenancy
 * check under the service role (FR-390).
 * ------------------------------------------------------------------------- */

/** What every expansion and every rule emission needs from the household. */
interface TaskHousehold {
  zone: string;
  /** `WKST` on weekly rules — the household's start-of-week (R303). */
  wkst: RuleWeekday;
}

const WKST_OF: Record<WeekStart, RuleWeekday> = { 0: "SU", 1: "MO" };

async function loadHousehold(householdId: string): Promise<TaskHousehold> {
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

/** An id outside the caller's household is `NOT_FOUND`, never `FORBIDDEN`. */
async function loadTask(householdId: string, taskId: string): Promise<Task> {
  const { data, error } = await adminFamily()
    .from("tasks")
    .select(tasksSelect())
    .eq("id", taskId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toTask(data as unknown as TaskWithAssigneesRow);
}

/**
 * Every stored resolution of ONE task: the expander's input, the occurrence
 * lookup and the streak's day, from a single bounded read.
 */
async function loadResolutions(householdId: string, taskId: string): Promise<TaskResolution[]> {
  const { data, error } = await adminFamily()
    .from("task_resolutions")
    .select(TASK_RESOLUTION_COLUMNS)
    .eq("household_id", householdId)
    .eq("task_id", taskId);
  if (error) throw mapDbError(error);
  return ((data ?? []) as unknown as TaskResolutionRow[]).map(toTaskResolution);
}

/** The tail of this task's Completed Date chains — the derived open occurrence (R309). */
async function loadCursors(householdId: string, taskId: string): Promise<TaskCursor[]> {
  const { data, error } = await adminFamily()
    .from("task_cursors")
    .select(TASK_CURSOR_COLUMNS)
    .eq("household_id", householdId)
    .eq("task_id", taskId);
  if (error) throw mapDbError(error);
  return ((data ?? []) as unknown as TaskCursorRow[]).map(toTaskCursor);
}

/* ------------------------------------------------------------------------- *
 * The occurrence: judged by the module the browser renders from (R315).
 * ------------------------------------------------------------------------- */

/** Everything the occurrence-scoped verbs need, read once before any writes. */
interface OccurrenceContext {
  task: Task;
  /** The household zone this expansion was walked in — a truncating delete needs it too. */
  zone: string;
  /** The household-local date of this write — `resolved_on` and the streak's "now". */
  todayDate: string;
  /** The instant `todayDate` was taken at, so the stored pair cannot disagree. */
  at: Date;
  /** The stored row settling this occurrence, or null while it is outstanding. */
  stored: TaskResolution | null;
  /** That day's occurrences of this task, as they stood BEFORE the write. */
  day: BoardOccurrence[];
}

function sameOccurrence(occurrence: BoardOccurrence, key: OccurrenceKey): boolean {
  return (
    resolutionKeyOf({
      taskId: occurrence.taskId,
      assigneeId: occurrence.assigneeId,
      occurrenceDate: occurrence.scheduledDate,
      slot: occurrence.slot,
      cyclePrev: occurrence.cyclePrev,
    }) === resolutionKeyOf(key)
  );
}

/**
 * Which board day to expand. An occurrence with a date is drawn on it; an
 * Anytime chore has none, so an outstanding one is drawn on today and a
 * resolved one only on the day it was resolved (FR-328).
 */
function dayToExpand(key: OccurrenceKey, stored: TaskResolution | null, today: string): string {
  return key.occurrenceDate ?? stored?.resolvedOn ?? today;
}

async function loadOccurrence(
  householdId: string,
  key: OccurrenceKey,
): Promise<OccurrenceContext> {
  const { zone } = await loadHousehold(householdId);
  const at = new Date();
  const todayDate = localDateOf(zone, at.getTime());
  const task = await loadTask(householdId, key.taskId);
  const resolutions = await loadResolutions(householdId, key.taskId);
  const cursors = await loadCursors(householdId, key.taskId);

  const stored = resolutionAt(resolutionIndexOf(resolutions), key);
  const displayedDate = dayToExpand(key, stored, todayDate);
  const day = expandTaskDay([task], resolutions, cursors, { displayedDate, todayDate, zone });
  if (!day.some((one) => sameOccurrence(one, key))) throw new ActionFailure("NOT_FOUND");
  return { task, zone, todayDate, at, stored, day };
}

/* ------------------------------------------------------------------------- *
 * FR-351: the ownership rule, applied once for both verbs.
 * ------------------------------------------------------------------------- */

/**
 * The refusal names whose task it is and that a parent may do it (FR-351). An
 * occurrence belonging to nobody — an unclaimed up-for-grabs one — has no name
 * to give, so it falls back to the plain sentence.
 */
async function refuse(householdId: string, ownerId: string | null): Promise<never> {
  const owner = ownerId === null ? null : await loadProfile(householdId, ownerId);
  if (!owner) throw new ActionFailure("FORBIDDEN", NOT_YOURS);
  throw new ActionFailure(
    "FORBIDDEN",
    `That's ${owner.label}'s task — only ${owner.label} or a parent can do it.`,
  );
}

async function assertMayResolve(
  actor: Actor,
  target: OccurrenceTarget,
  householdId: string,
): Promise<void> {
  if (actor.role === "parent") return;
  if (ownsOccurrence({ profileId: actor.profileId }, target)) return;
  await refuse(householdId, target.assigneeId ?? target.creditProfileId ?? null);
}

/**
 * FR-359: Skip exists for routines and repeating chores only. The insert
 * trigger refuses the same row (migration 019), so this is the message rather
 * than the guarantee — a one-off has no second occurrence for a skip to make
 * room for, and skipping it would just be deleting it under another name.
 */
function requireSkippable(task: Task): void {
  if (task.routine || taskRepeats(task)) return;
  throw new ActionFailure("VALIDATION", SKIP_ON_ONE_OFF, { occurrence: [SKIP_ON_ONE_OFF] });
}

/**
 * FR-351 as it reads for a SKIP. An unclaimed up-for-grabs occurrence belongs
 * to nobody, so it excludes nobody: anybody punched in may skip it, and doing
 * so skips it for the whole household (FR-363, FR-368, US3-12). Every other
 * chain has an owner, and the ordinary rule applies to it unchanged.
 */
async function assertMaySkip(
  actor: Actor,
  task: Task,
  key: OccurrenceKey,
  householdId: string,
): Promise<void> {
  if (task.upForGrabs) return;
  await assertMayResolve(actor, { upForGrabs: false, assigneeId: key.assigneeId }, householdId);
}

/**
 * FR-368: a completion is never anonymous, and on an assigned task the credit
 * IS the assignee — so naming one there is a mistake worth telling the caller
 * about rather than silently dropping.
 */
function creditFor(task: Task, creditProfileId: string | null): string | null {
  if (task.upForGrabs) {
    if (creditProfileId === null) {
      throw new ActionFailure("VALIDATION", CREDIT_REQUIRED, { creditProfileId: [CREDIT_REQUIRED] });
    }
    return creditProfileId;
  }
  if (creditProfileId !== null) {
    throw new ActionFailure("VALIDATION", CREDIT_UNWANTED, { creditProfileId: [CREDIT_UNWANTED] });
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * FR-371/373/374: the streak checkpoint, the second statement.
 * ------------------------------------------------------------------------- */

/**
 * The routine's day for that person as the write leaves it, beside the same day
 * as it stood before — `context.day` is the expansion from before the write, so
 * the two differ only at the occurrence just resolved.
 */
function dayOutcomeOf(
  context: OccurrenceContext,
  key: OccurrenceKey,
  date: string,
  state: OccurrenceState,
): DayOutcome {
  const mine = context.day.filter((one) => one.assigneeId === key.assigneeId);
  return {
    date,
    todayDate: context.todayDate,
    states: mine.map((one) => (sameOccurrence(one, key) ? state : one.state)),
    statesBefore: mine.map((one) => one.state),
  };
}

/**
 * Written from a value computed before the resolution, so two devices resolving
 * different slots of one routine in the same second can leave the number one
 * slot behind — R310's recorded residual. A failure here must NOT fail a write
 * that already succeeded: the badge is stale, the board is right, and FR-374
 * heals it on the next resolution or undo of that routine.
 */
async function writeStreak(
  actor: Actor,
  context: OccurrenceContext,
  key: OccurrenceKey,
  state: OccurrenceState,
): Promise<void> {
  const { task } = context;
  if (!task.routine || !task.trackHabit) return;
  if (key.assigneeId === null || key.occurrenceDate === null) return;
  const assignee = task.assignees.find((one) => one.categoryId === key.assigneeId);
  if (!assignee) return;

  const next = nextStreak(
    { count: assignee.streakCount, through: assignee.streakThrough },
    dayOutcomeOf(context, key, key.occurrenceDate, state),
  );
  const { error } = await adminFamily()
    .from("task_assignees")
    .update({ streak_count: next.count, streak_through: next.through })
    .eq("household_id", actor.householdId)
    .eq("task_id", key.taskId)
    .eq("category_id", key.assigneeId);
  if (error) console.error("[family] streak checkpoint not written", error);
}

/* ------------------------------------------------------------------------- *
 * The two writes.
 * ------------------------------------------------------------------------- */

/**
 * FR-370's lost claim and an ordinary double-tap are one path: re-read the
 * winning row and report the state it stored, naming the Profile credited.
 */
async function conflictFor(householdId: string, key: OccurrenceKey): Promise<ActionFailure> {
  const stored = resolutionAt(
    resolutionIndexOf(await loadResolutions(householdId, key.taskId)),
    key,
  );
  if (!stored) return new ActionFailure("CONFLICT");
  if (stored.status === "skipped") return new ActionFailure("CONFLICT", "That one is already skipped.");
  const credited = stored.categoryId === null ? null : await loadProfile(householdId, stored.categoryId);
  if (!credited) return new ActionFailure("CONFLICT", "That one is already done.");
  return new ActionFailure("CONFLICT", `${credited.label} already did that one.`);
}

/**
 * FR-353's five-column identity and FR-354's full record, in one INSERT — the
 * ONE row shape both statuses are written through, so a completion and a skip
 * cannot record different things about the same occurrence (FR-360, FR-364).
 */
async function insertResolution(
  actor: Actor,
  context: OccurrenceContext,
  key: OccurrenceKey,
  status: ResolutionStatus,
  /** The Profile CREDITED — a claim names one, an assigned task IS one, an unclaimed skip has none. */
  credit: string | null,
): Promise<TaskResolution> {
  const { data, error } = await adminFamily()
    .from("task_resolutions")
    .insert({
      household_id: actor.householdId,
      task_id: key.taskId,
      occurrence_date: key.occurrenceDate,
      occurrence_slot: key.slot,
      assignee_id: key.assigneeId,
      category_id: credit,
      cycle_prev: key.cyclePrev ?? null,
      status,
      // Both taken server-side from one instant: the day it was ticked, never
      // the day it was due (FR-354, SC-308).
      resolved_on: context.todayDate,
      resolved_at: context.at.toISOString(),
      // The punched-in actor, who may not be the Profile credited (Assumption 3).
      created_by: actor.profileId,
    })
    .select(TASK_RESOLUTION_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw await conflictFor(actor.householdId, key);
    throw mapDbError(error);
  }
  return toTaskResolution(data as unknown as TaskResolutionRow);
}

/**
 * FR-364: "delete this occurrence" and Skip are ONE write, and this is it —
 * `skipTaskOccurrence` above is this helper with a guard and a streak step in
 * front of it, and authors no second write, so the two verbs cannot drift. On a
 * Completed Date chore the row ADVANCES the cycle by the configured delay
 * (FR-362), exactly as a completion does.
 */
async function writeSkip(
  actor: Actor,
  context: OccurrenceContext,
  key: OccurrenceKey,
): Promise<TaskResolution> {
  // An unclaimed up-for-grabs occurrence belongs to nobody, so it is skipped
  // for nobody (FR-363, FR-368); every other chain credits its own owner.
  const credit = context.task.upForGrabs ? null : key.assigneeId;
  return insertResolution(actor, context, key, "skipped", credit);
}

/**
 * FR-344: the chain's `no action` foreign key refuses a single-row delete whose
 * cycle already has a successor, so a concurrent completion of the next cycle
 * cannot slip between a check and the write.
 */
async function deleteResolution(householdId: string, stored: TaskResolution): Promise<void> {
  const { error } = await adminFamily()
    .from("task_resolutions")
    .delete()
    .eq("id", stored.id)
    .eq("household_id", householdId);
  if (!error) return;
  if (error.code === "23503") throw new ActionFailure("CONFLICT", SUCCESSOR_RESOLVED);
  throw mapDbError(error);
}

/**
 * A tick, and FR-367's claim: one INSERT carrying the occurrence's identity and
 * the full record. The payload is written inline rather than as a named
 * interface because a `"use server"` module may export only async functions, so
 * a named one could not travel with the action to its callers.
 */
export async function completeTaskOccurrence(input: {
  occurrence: OccurrenceKey;
  /** Required iff the task is up for grabs, forbidden otherwise (FR-368). */
  creditProfileId?: string;
}): Promise<ActionResult<TaskResolution>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(completeOccurrenceSchema, input);
    const key = parsed.occurrence;
    const context = await loadOccurrence(actor.householdId, key);

    const credit = creditFor(context.task, parsed.creditProfileId ?? null);
    await assertMayResolve(
      actor,
      { upForGrabs: context.task.upForGrabs, assigneeId: key.assigneeId, creditProfileId: credit },
      actor.householdId,
    );

    const resolution = await insertResolution(
      actor,
      context,
      key,
      "complete",
      credit ?? key.assigneeId,
    );
    await writeStreak(actor, context, key, "complete");
    await touchActor(actor);
    return resolution;
  });
}

/**
 * FR-359's Skip, committed through the SAME `writeSkip` a "this occurrence"
 * delete uses (FR-364) — this action adds a guard and a streak step, and no
 * second write, so the two verbs cannot drift apart.
 *
 * Three consequences follow from the row rather than from code here: the
 * occurrence leaves the day's total and the ring, because the counters are
 * computed over unresolved-plus-completed and this row is neither (FR-360); a
 * Completed Date chore's cycle advances from the SKIP date by the configured
 * delay, because the chain tail moved (FR-362); and the skip is per occurrence
 * and per assignee, because the chain owner is in the key (FR-363). The one
 * deliberate write is the streak: `streak_through` advances while
 * `streak_count` holds, which a bare counter could not express (FR-373).
 */
export async function skipTaskOccurrence(input: {
  occurrence: OccurrenceKey;
}): Promise<ActionResult<TaskResolution>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(occurrenceOnlySchema, input);
    const key = parsed.occurrence;
    const context = await loadOccurrence(actor.householdId, key);

    requireSkippable(context.task);
    await assertMaySkip(actor, context.task, key, actor.householdId);

    const resolution = await writeSkip(actor, context, key);
    await writeStreak(actor, context, key, "skipped");
    await touchActor(actor);
    return resolution;
  });
}

/**
 * FR-355's un-complete and FR-361's unskip, which are the same write: the row
 * is REMOVED, not marked, so the occurrence goes back to outstanding and an
 * undone claim returns to Up for Grabs belonging to nobody (FR-369).
 */
export async function unresolveTaskOccurrence(input: {
  occurrence: OccurrenceKey;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(occurrenceOnlySchema, input);
    const key = parsed.occurrence;
    const context = await loadOccurrence(actor.householdId, key);
    // Deleted by another device between the read and the tap (FR-393).
    if (!context.stored) throw new ActionFailure("NOT_FOUND");

    await assertMayResolve(
      actor,
      {
        upForGrabs: context.task.upForGrabs,
        assigneeId: key.assigneeId,
        // The stored credit is what an undo withdraws (FR-369).
        creditProfileId: context.stored.categoryId,
      },
      actor.householdId,
    );

    await deleteResolution(actor.householdId, context.stored);
    await writeStreak(actor, context, key, "unresolved");
    await touchActor(actor);
    return null;
  });
}

/* ------------------------------------------------------------------------- *
 * The task record: its columns, its rule and its assignees (T050–T052).
 * ------------------------------------------------------------------------- */

/** Snake-cased columns for an INSERT or an UPDATE of `family.tasks`. */
type TaskWrite = Record<string, string | number | boolean | null | string[]>;

/**
 * `UNTIL` in the DATE form for tasks (contracts, "Shared input shapes"): the
 * occurrence key is a plain date and the expander walks local dates, so the
 * instant form would encode a precision no task read ever uses.
 */
function taskUntilOf(until: string | null | undefined): RuleUntil | null {
  return until === null || until === undefined ? null : { kind: "date", date: until };
}

/**
 * The structured choice → the one canonical rule string, through the shared
 * emitter (R201/R301). `never` and `after_completion` are not rules at all: the
 * first repeats nothing and the second writes the `renew_after_*` triple below.
 * An Anytime chore has no anchor to walk from, so it has no rule either — which
 * is what `task_repeat_needs_an_anchor` makes structural.
 */
function ruleFromTaskChoice(
  choice: TaskRepeatChoice,
  startsOn: string | null,
  wkst: RuleWeekday,
): string | null {
  if (choice.kind === "never" || choice.kind === "after_completion") return null;
  if (startsOn === null) return null;
  const until = taskUntilOf(choice.until);
  if (choice.kind === "daily") return emitRule({ freq: "DAILY", interval: choice.interval, until });
  if (choice.kind === "weekly") {
    // WKST is REQUIRED above interval 1 — it is what fixes week parity (R303).
    return emitRule({
      freq: "WEEKLY",
      interval: choice.interval,
      until,
      wkst,
      byDay: [...choice.weekdays],
    });
  }
  // BYMONTHDAY is derived from the anchor, never sent (the events precedent).
  return emitRule({
    freq: "MONTHLY",
    interval: choice.interval,
    until,
    byMonthDay: datePartsOf(epochDayOf(startsOn)).day,
  });
}

/** The cursor mode's three columns, explicitly nulled in rule mode (017's CHECKs). */
function renewColumnsOf(choice: TaskRepeatChoice): TaskWrite {
  if (choice.kind !== "after_completion") {
    return { renew_after_amount: null, renew_after_unit: null, renew_until: null };
  }
  return {
    renew_after_amount: choice.amount,
    renew_after_unit: choice.unit,
    renew_until: choice.until ?? null,
  };
}

/**
 * Every column a task carries, from the validated input. `reward_points` is
 * absent by construction, not merely unset: nothing this phase writes, reads or
 * accepts it (FR-329, SC-319).
 */
function taskColumnsOf(input: TaskInput, wkst: RuleWeekday): TaskWrite {
  const startsOn = input.startsOn ?? null;
  return {
    summary: input.summary,
    description: input.description ?? null,
    emoji: input.emoji ?? null,
    routine: input.routine,
    up_for_grabs: input.upForGrabs ?? false,
    track_habit: input.trackHabit ?? false,
    starts_on: startsOn,
    due_time: input.dueTime ?? null,
    times_of_day: input.timesOfDay ?? [],
    rrule: ruleFromTaskChoice(input.repeat, startsOn, wkst),
    ...renewColumnsOf(input.repeat),
  };
}

/**
 * FR-323 / US2-6: a task may be given to a Profile and never to a Label, and an
 * id from another household is `NOT_FOUND` rather than `FORBIDDEN` — nothing
 * confirms that a row exists somewhere else. 018's trigger is the second line.
 */
async function assertAssigneesAreProfiles(
  householdId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { data, error } = await adminFamily()
    .from("categories")
    .select("id, is_profile")
    .eq("household_id", householdId)
    .in("id", [...ids]);
  if (error) throw mapDbError(error);
  const rows = (data ?? []) as unknown as { id: string; is_profile: boolean }[];
  if (rows.length !== ids.length) throw new ActionFailure("NOT_FOUND");
  if (rows.some((row) => !row.is_profile)) {
    throw new ActionFailure("VALIDATION", LABEL_NOT_ASSIGNABLE, {
      assigneeIds: [LABEL_NOT_ASSIGNABLE],
    });
  }
}

/** The household's routine ids — the only tasks whose order is stored (FR-310, FR-311). */
async function routineTaskIds(householdId: string): Promise<Set<string>> {
  const { data, error } = await adminFamily()
    .from("tasks")
    .select("id")
    .eq("household_id", householdId)
    .eq("routine", true);
  if (error) throw mapDbError(error);
  return new Set(((data ?? []) as unknown as { id: string }[]).map((row) => row.id));
}

interface AssigneeOrderRow {
  task_id: string;
  category_id: string;
  sort_order: number | string;
}

async function assigneeOrdersOf(
  householdId: string,
  categoryIds: readonly string[],
): Promise<AssigneeOrderRow[]> {
  const { data, error } = await adminFamily()
    .from("task_assignees")
    .select("task_id, category_id, sort_order")
    .eq("household_id", householdId)
    .in("category_id", [...categoryIds]);
  if (error) throw mapDbError(error);
  return (data ?? []) as unknown as AssigneeOrderRow[];
}

/**
 * Where a new routine lands in each Profile's column: after everything already
 * there, through Phase 1's fractional helper (FR-310). Chores carry a
 * `sort_order` too — the column is not nullable — but their order is a fixed
 * rule of the read (FR-311), so only routines are consulted.
 */
async function nextSortOrdersFor(
  householdId: string,
  categoryIds: readonly string[],
): Promise<Map<string, number>> {
  const routines = await routineTaskIds(householdId);
  const rows = await assigneeOrdersOf(householdId, categoryIds);
  const orders = new Map<string, number>();
  for (const id of categoryIds) {
    const mine = rows
      .filter((row) => row.category_id === id && routines.has(row.task_id))
      .map((row) => ({ sortOrder: Number(row.sort_order) }));
    orders.set(id, nextSortOrder(mine));
  }
  return orders;
}

async function insertAssignees(
  householdId: string,
  taskId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const orders = await nextSortOrdersFor(householdId, ids);
  const rows = ids.map((category_id) => ({
    household_id: householdId,
    task_id: taskId,
    category_id,
    sort_order: orders.get(category_id) ?? SORT_GAP,
  }));
  const { error } = await adminFamily().from("task_assignees").insert(rows);
  if (error) throw mapDbError(error);
}

/** Removes some of a task's assignees, or — with no list — every one of them. */
async function deleteAssignees(
  householdId: string,
  taskId: string,
  categoryIds?: readonly string[],
): Promise<void> {
  let query = adminFamily()
    .from("task_assignees")
    .delete()
    .eq("household_id", householdId)
    .eq("task_id", taskId);
  if (categoryIds !== undefined) query = query.in("category_id", [...categoryIds]);
  const { error } = await query;
  if (error) throw mapDbError(error);
}

/**
 * Contracts step 4: the link set is rewritten wholesale, and an assignee who
 * survives the rewrite keeps the `sort_order` their column already gave them —
 * so editing a task's title cannot silently reshuffle somebody's routines.
 */
async function rewriteAssignees(task: Task, ids: readonly string[]): Promise<void> {
  const surviving = new Set(ids);
  const removed = task.assignees
    .map((one) => one.categoryId)
    .filter((id) => !surviving.has(id));
  if (removed.length > 0) await deleteAssignees(task.householdId, task.id, removed);
  const held = new Set(task.assignees.map((one) => one.categoryId));
  await insertAssignees(
    task.householdId,
    task.id,
    ids.filter((id) => !held.has(id)),
  );
}

/**
 * FR-365, and the ORDER the contract fixes: 018's
 * `assert_up_for_grabs_is_unassigned` refuses the flip while anybody is still
 * assigned, so the clear happens first, in the same action.
 */
async function applyUpForGrabsFlip(task: Task, merged: TaskInput): Promise<void> {
  if (merged.upForGrabs !== true || task.assignees.length === 0) return;
  await deleteAssignees(task.householdId, task.id);
}

/* ------------------------------------------------------------------------- *
 * The merged shape (contracts step 3) — FR-318's conversion, judged whole.
 * ------------------------------------------------------------------------- */

/** The stored task as the input a create would have carried — the merge's base. */
function taskInputOf(task: Task, zone: string): TaskInput {
  return {
    summary: task.summary,
    description: task.description,
    emoji: task.emoji,
    routine: task.routine,
    assigneeIds: [...task.assignees]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((one) => one.categoryId),
    upForGrabs: task.upForGrabs,
    trackHabit: task.trackHabit,
    startsOn: task.startsOn,
    dueTime: task.dueTime,
    timesOfDay: [...task.timesOfDay],
    repeat: taskRepeatChoiceOf(task, zone),
  };
}

/**
 * Contracts step 3: the MERGED shape is validated, never the patch — which is
 * what makes a conversion demand the target type's own fields (FR-318, US2-8)
 * and what refuses a scope (FR-331), because anything the patch invents
 * survives into `taskInputSchema`'s strict object and is refused there.
 *
 * Two clearances, both the contract's: switching to a chore clears the slots and
 * the habit switch, which are unrepresentable on one; and turning Up for Grabs
 * on clears the assignees, because a task that belongs to nobody has none.
 */
function mergedTaskShape(task: Task, patch: Record<string, unknown>, zone: string): TaskInput {
  if ("saveToTaskBox" in patch) {
    throw new ActionFailure("VALIDATION", SAVE_TO_TASK_BOX_ON_CREATE, {
      saveToTaskBox: [SAVE_TO_TASK_BOX_ON_CREATE],
    });
  }
  const merged: Record<string, unknown> = { ...taskInputOf(task, zone), ...patch };
  if (task.routine && merged.routine === false) {
    merged.timesOfDay = [];
    merged.trackHabit = false;
  }
  if (merged.upForGrabs === true) merged.assigneeIds = [];
  return parseOrThrow(taskInputSchema, merged);
}

/* ------------------------------------------------------------------------- *
 * Scope discipline on a DELETE (FR-347): the server never infers a scope.
 * ------------------------------------------------------------------------- */

/** What a delete has been asked to do, once the scope table has been applied. */
type DeletePlan =
  | { scope: "all" }
  | { scope: "this" | "this_and_future"; key: OccurrenceKey };

function taskRepeats(task: Task): boolean {
  return task.rrule !== null || task.renewAfterAmount !== null;
}

function refuseScope(message: string): never {
  throw new ActionFailure("VALIDATION", message, { scope: [message] });
}

/**
 * FR-347's asymmetry, verified against the reference: a repeating chore offers
 * all three scopes, a routine offers `this_and_future` and `all` only — its
 * single occurrence is removed with Skip, which writes the same record anyway
 * (FR-359, FR-364) — and a one-off is asked no scope question at all.
 */
function requireTaskScope(
  task: Task,
  input: { scope?: TaskScope; occurrenceKey?: OccurrenceKey },
): DeletePlan {
  if (!taskRepeats(task)) {
    if (input.scope !== undefined || input.occurrenceKey !== undefined) {
      refuseScope(SCOPE_ON_ONE_OFF);
    }
    return { scope: "all" };
  }
  const scope = input.scope;
  if (scope === undefined) refuseScope(SCOPE_REQUIRED);
  if (scope === "this" && task.routine) refuseScope(ROUTINE_SKIP_INSTEAD);
  if (scope === "all") return { scope };
  const key = input.occurrenceKey;
  if (key === undefined) {
    throw new ActionFailure("VALIDATION", OCCURRENCE_REQUIRED, {
      occurrenceKey: [OCCURRENCE_REQUIRED],
    });
  }
  if (key.taskId !== task.id) {
    throw new ActionFailure("VALIDATION", KEY_IS_ANOTHER_TASK, {
      occurrenceKey: [KEY_IS_ANOTHER_TASK],
    });
  }
  return { scope, key };
}

/* ------------------------------------------------------------------------- *
 * The delete table (contracts §deleteTask).
 * ------------------------------------------------------------------------- */

/** The row goes; assignees and resolutions cascade, so no skip ghost outlives it. */
async function deleteTaskRow(task: Task): Promise<void> {
  const { error } = await adminFamily()
    .from("tasks")
    .delete()
    .eq("id", task.id)
    .eq("household_id", task.householdId);
  if (error) throw mapDbError(error);
}

/**
 * Is this the series' FIRST occurrence? In rule mode: does the rule produce
 * nothing at all before the cut. In cursor mode: is this the chain's head,
 * which the open occurrence says by carrying no previous cycle.
 */
function isFirstTaskOccurrence(task: Task, key: OccurrenceKey, zone: string): boolean {
  if (task.renewAfterAmount !== null) return (key.cyclePrev ?? null) === null;
  if (task.rrule === null || task.startsOn === null || key.occurrenceDate === null) return true;
  const before = { start: task.startsOn, end: addDays(key.occurrenceDate, -1) };
  return ruleDatesIn(parseRule(task.rrule), task.startsOn, before, zone).length === 0;
}

/**
 * `this_and_future`, the keeping half: rule mode re-emits `UNTIL` = the cut
 * minus a day through the one emitter; cursor mode sets `renew_until` to the
 * same date, which suppresses the open occurrence and everything after it.
 * Either way every earlier occurrence and every stored resolution survives —
 * there is no split, because tasks carry no per-occurrence overrides (FR-331).
 */
async function truncateRepeat(actor: Actor, task: Task, cut: string): Promise<void> {
  const lastDay = addDays(cut, -1);
  const columns: TaskWrite =
    task.rrule === null
      ? { renew_until: lastDay }
      : { rrule: emitRule({ ...parseRule(task.rrule), until: { kind: "date", date: lastDay } }) };
  const { error } = await adminFamily()
    .from("tasks")
    .update({ ...columns, updated_by: actor.profileId })
    .eq("id", task.id)
    .eq("household_id", task.householdId);
  if (error) throw mapDbError(error);
}

/**
 * On the series' FIRST occurrence `this_and_future` is promoted to `all` and the
 * row is deleted. Truncating there would set the end to the day before the start,
 * leaving a live `family.tasks` row that generates nothing, still appears in the
 * Task list surfaces and still counts against FR-391's assignee arithmetic —
 * the empty leading segment Phase 2's FR-241 exists to prevent.
 */
async function promoteOrTruncate(
  actor: Actor,
  context: OccurrenceContext,
  key: OccurrenceKey,
): Promise<void> {
  const { task } = context;
  if (isFirstTaskOccurrence(task, key, context.zone)) return deleteTaskRow(task);
  // An undated occurrence never repeats, so it never reaches here.
  if (key.occurrenceDate === null) return deleteTaskRow(task);
  await truncateRepeat(actor, task, key.occurrenceDate);
}

async function applyTaskDelete(actor: Actor, task: Task, plan: DeletePlan): Promise<void> {
  if (plan.scope === "all") return deleteTaskRow(task);
  // The occurrence is judged by the module the browser renders from, so a stale
  // client cannot delete a phantom (R315).
  const context = await loadOccurrence(actor.householdId, plan.key);
  if (plan.scope === "this") {
    await writeSkip(actor, context, plan.key);
    return;
  }
  await promoteOrTruncate(actor, context, plan.key);
}

/* ------------------------------------------------------------------------- *
 * The Task Box template a create may leave behind (FR-379).
 * ------------------------------------------------------------------------- */

/**
 * FR-377's exact three fields — title, emoji and type, nothing else — written in
 * the same action. A failure here does NOT fail the task: the household asked
 * for a task and got one, and the template is a convenience (FR-379, US2-14).
 */
async function saveTaskBoxTemplate(actor: Actor, input: TaskInput): Promise<void> {
  const { error } = await adminFamily()
    .from("task_box_items")
    .insert({
      household_id: actor.householdId,
      summary: input.summary,
      emoji: input.emoji ?? null,
      routine: input.routine,
      created_by: actor.profileId,
      updated_by: actor.profileId,
    });
  if (error) console.error("[family] task box template not saved", error);
}

/* ------------------------------------------------------------------------- *
 * The three parent-only actions (FR-389).
 * ------------------------------------------------------------------------- */

/**
 * One `family.tasks` row, one `task_assignees` row per assignee, and — when the
 * form asked — one Task Box template beside them. The rrule is emitted here and
 * never sent; `reward_points` is left at its default and accepted from nothing
 * (FR-329, SC-319).
 */
export async function createTask(input: TaskInput): Promise<ActionResult<Task>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(taskInputSchema, input);
    await assertAssigneesAreProfiles(actor.householdId, parsed.assigneeIds);
    const household = await loadHousehold(actor.householdId);

    const { data, error } = await adminFamily()
      .from("tasks")
      .insert({
        household_id: actor.householdId,
        ...taskColumnsOf(parsed, household.wkst),
        // The punch-in, never anything in the payload (FR-330, Assumption 3).
        created_by: actor.profileId,
        updated_by: actor.profileId,
      })
      .select("id")
      .single();
    if (error) throw mapDbError(error);
    const { id } = data as { id: string };

    await insertAssignees(actor.householdId, id, parsed.assigneeIds);
    if (parsed.saveToTaskBox === true) await saveTaskBoxTemplate(actor, parsed);
    await touchActor(actor);
    return loadTask(actor.householdId, id);
  });
}

/**
 * The contract's six steps in order: the admin re-read (FR-393's "deleted
 * elsewhere"), no scope ever (FR-331), the merged shape (FR-318), the assignee
 * rewrite with its ordered Up for Grabs clearance, and `updated_by` from the
 * actor. **No edit is refused because the task carries resolutions and none
 * deletes one** (FR-332): a stranded row is kept and simply not surfaced, which
 * is what deriving occurrences does for free.
 */
export async function updateTask(input: {
  id: string;
  patch: Partial<Omit<TaskInput, "saveToTaskBox">>;
}): Promise<ActionResult<Task>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(updateTaskSchema, input);
    const task = await loadTask(actor.householdId, parsed.id);
    const household = await loadHousehold(actor.householdId);

    const merged = mergedTaskShape(task, parsed.patch, household.zone);
    await assertAssigneesAreProfiles(actor.householdId, merged.assigneeIds);

    await applyUpForGrabsFlip(task, merged);
    const { error } = await adminFamily()
      .from("tasks")
      .update({ ...taskColumnsOf(merged, household.wkst), updated_by: actor.profileId })
      .eq("id", task.id)
      .eq("household_id", task.householdId);
    if (error) throw mapDbError(error);

    if ("assigneeIds" in parsed.patch) await rewriteAssignees(task, merged.assigneeIds);
    await touchActor(actor);
    return loadTask(actor.householdId, task.id);
  });
}

/**
 * FR-347's scope table, behind FR-258's confirmation. `this` writes the skip row
 * `skipTaskOccurrence` writes — one code path, one record (FR-364) — which on a
 * Completed Date chore therefore advances the cycle rather than killing the
 * chore for ever (FR-362).
 */
export async function deleteTask(input: {
  id: string;
  confirm: boolean;
  scope?: TaskScope;
  occurrenceKey?: OccurrenceKey;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(deleteTaskSchema, input);
    const task = await loadTask(actor.householdId, parsed.id);

    await applyTaskDelete(actor, task, requireTaskScope(task, parsed));
    await touchActor(actor);
    return null;
  });
}
