"use server";

/**
 * Tasks — the board's write surface (specs/003-family-tasks,
 * contracts/server-actions.md → "Resolutions"). This file carries the two
 * resolution verbs US1 needs: `completeTaskOccurrence` and
 * `unresolveTaskOccurrence`, which is FR-355's un-complete and FR-361's unskip
 * in one write.
 *
 * Three rules live here and are not repeated anywhere else:
 *
 *   - the guard is `requireVerifiedActor()` + FR-351's ownership rule, so the
 *     answer depends on the RECORD and on the role the database holds right
 *     now, never on the role the cookie remembers (R323);
 *   - an occurrence is only ever judged real by `expandTaskDay`, the module the
 *     browser renders from, so client and server cannot disagree about what an
 *     occurrence is and a stale client cannot resolve a phantom (R315);
 *   - `resolved_on` is the household-local date of the WRITE, taken from
 *     `household_settings.timezone` — never the client's, and never the
 *     occurrence's own date (FR-354, SC-308).
 *
 * There is no RPC on this path (R310 as superseded): a completion is one
 * INSERT, an undo is one DELETE, FR-370's single claim is the occurrence key's
 * unique index and FR-344's refusal is the chain's foreign key. The one
 * companion write is the streak checkpoint, whose only half-state is a stale
 * number FR-374 heals on the next resolution or undo of that routine.
 */

import { z } from "zod";

import { localDateOf } from "../calendar/dates";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireVerifiedActor } from "../guards";
import { ownsOccurrence, type OccurrenceTarget } from "../permissions";
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
import { resolutionAt, resolutionIndexOf, resolutionKeyOf } from "../tasks/resolutions";
import { nextStreak, type DayOutcome } from "../tasks/streaks";
import type {
  Actor,
  BoardOccurrence,
  OccurrenceKey,
  OccurrenceState,
  Task,
  TaskCursor,
  TaskResolution,
} from "../types";
import { parseOrThrow } from "../validation";
import { adminFamily, loadProfile, mapDbError, touchActor } from "./shared";

const INVALID_ID = "Invalid id.";
const CREDIT_REQUIRED = "Choose who this one is for.";
const CREDIT_UNWANTED = "This task already belongs to someone.";
const NOT_YOURS = "That's not your task — only a parent can do it.";
const SUCCESSOR_RESOLVED =
  "The next time this came round has already been done — undo that one first.";

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

const unresolveOccurrenceSchema = z.strictObject({ occurrence: occurrenceKeySchema });

/* ------------------------------------------------------------------------- *
 * Reads through the admin client — scoped by household, which IS the tenancy
 * check under the service role (FR-390).
 * ------------------------------------------------------------------------- */

async function loadZone(householdId: string): Promise<string> {
  const { data, error } = await adminFamily()
    .from("household_settings")
    .select("timezone")
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND", "This household has no settings row.");
  return (data as unknown as { timezone: string }).timezone;
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

/** Everything both verbs need, read once before either writes. */
interface OccurrenceContext {
  task: Task;
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
  const zone = await loadZone(householdId);
  const at = new Date();
  const todayDate = localDateOf(zone, at.getTime());
  const task = await loadTask(householdId, key.taskId);
  const resolutions = await loadResolutions(householdId, key.taskId);
  const cursors = await loadCursors(householdId, key.taskId);

  const stored = resolutionAt(resolutionIndexOf(resolutions), key);
  const displayedDate = dayToExpand(key, stored, todayDate);
  const day = expandTaskDay([task], resolutions, cursors, { displayedDate, todayDate, zone });
  if (!day.some((one) => sameOccurrence(one, key))) throw new ActionFailure("NOT_FOUND");
  return { task, todayDate, at, stored, day };
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

/** FR-353's five-column identity and FR-354's full record, in one INSERT. */
async function insertResolution(
  actor: Actor,
  context: OccurrenceContext,
  key: OccurrenceKey,
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
      // The Profile CREDITED — a claim names one, an assigned task IS one.
      category_id: credit ?? key.assigneeId,
      cycle_prev: key.cyclePrev ?? null,
      status: "complete",
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

    const resolution = await insertResolution(actor, context, key, credit);
    await writeStreak(actor, context, key, "complete");
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
    const parsed = parseOrThrow(unresolveOccurrenceSchema, input);
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
