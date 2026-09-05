"use server";

/**
 * The Task Box — reusable templates (specs/003-family-tasks,
 * contracts/server-actions.md → "The Task Box"): `createTaskBoxItem`,
 * `updateTaskBoxItem` and `deleteTaskBoxItem`.
 *
 * All three are `requireParent()` — FR-389's "managing Task Box templates" is
 * the fourth parent-only surface beside creating, editing and deleting a task,
 * and it is a parent-only verb in the same sense: refused on the server, so a
 * request that bypasses the sheet is refused exactly as a tap on a hidden
 * control would be.
 *
 * **Exactly four fields, on create and on edit** (FR-377, FR-380, and 004
 * FR-401 for the fourth): a title, an optional emoji, a type and a star value.
 * A template holds no description, date, repeat or assignment — those are what
 * FR-378's create form asks for when a template is chosen. The star value is
 * the column Phase 3 reserved and refused (its SC-319); Phase 4 made it the
 * template's fourth field — stored, returned and editable, with blank and 0
 * both stored as null and 501 refused by the schema (004 FR-402, SC-418) — and
 * it is what FR-378's form pre-fills alongside the other three (004 FR-404).
 *
 * Two things this module deliberately does NOT do:
 *
 *   - **Adding from a template is not an action** (FR-378). Choosing one opens
 *     the ordinary create form pre-filled with its three values, and the save
 *     is `createTask` like any other. Saving *to* the box is a flag on
 *     `createTask` (FR-379), not a call here.
 *   - **A delete follows no link** (FR-381, US4-12). Tasks already created from
 *     a template are untouched structurally rather than by an ordering this
 *     function remembers: nothing in `family.tasks` references
 *     `family.task_box_items`, because `createTask` copies the template's
 *     values and keeps no reference. What the delete needs, then, is only
 *     FR-381's confirmation — the irreversible-deletion warning's answer.
 *
 * The edit parses the MERGED template through the create schema rather than a
 * patch schema of its own, which is `updateTask`'s discipline: there is one
 * list of allowed fields, so a `scope`, a date or anything else a client
 * invents is refused by the same strict object, and a refusal lands against its
 * own top-level field for the form to show (FR-330).
 */

import { z } from "zod";

import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireParent } from "../guards";
import { TASK_BOX_COLUMNS, toTaskBoxItem, type TaskBoxItemRow } from "../rows";
import type { Actor, TaskBoxItem } from "../types";
import { parseOrThrow, taskBoxItemSchema, type TaskBoxItemInput } from "../validation";
import { adminFamily, mapDbError, touchActor } from "./shared";

const INVALID_ID = "Invalid id.";
const CONFIRM_REQUIRED = "Deleting a template can't be undone — confirm to delete it.";

/**
 * The edit envelope. The patch is carried as bare keys and judged as part of
 * the merged template below, so there is no second list of allowed fields to
 * drift away from `taskBoxItemSchema`'s.
 */
const updateTaskBoxItemSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  patch: z.record(z.string(), z.unknown(), { error: "That edit didn't look right." }),
});

/** FR-381: a literal `true`, so a missing flag is a refusal and not a default. */
const deleteTaskBoxItemSchema = z.strictObject({
  id: z.uuid({ error: INVALID_ID }),
  confirm: z.literal(true, { error: CONFIRM_REQUIRED }),
});

/** The columns a template write carries: FR-377's three and 004 FR-401's fourth. */
type TemplateWrite = Record<string, string | number | boolean | null>;

/**
 * The four columns an insert or an update writes — the whole field set. The
 * schema has already folded a blank or 0 star value into null (004 FR-402).
 */
function templateColumns(input: TaskBoxItemInput): TemplateWrite {
  return {
    summary: input.summary,
    emoji: input.emoji ?? null,
    routine: input.routine,
    reward_points: input.rewardPoints ?? null,
  };
}

/**
 * One template in one household. Scoping by household here is the tenancy check
 * (FR-390): under the service role there is no RLS, and a template belonging to
 * another household must read as absent rather than as forbidden.
 */
async function loadTemplate(householdId: string, id: string): Promise<TaskBoxItem> {
  const { data, error } = await adminFamily()
    .from("task_box_items")
    .select(TASK_BOX_COLUMNS)
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toTaskBoxItem(data as unknown as TaskBoxItemRow);
}

/**
 * The stored template with the patch laid over it, judged as a whole template.
 * The stored star value is part of the base, so a patch of another field keeps
 * it (004 FR-401); an unknown key — a date, an assignment, the raw column name
 * — survives the spread into `taskBoxItemSchema`'s strict object and is refused
 * there (FR-330).
 */
function mergedTemplate(item: TaskBoxItem, patch: Record<string, unknown>): TaskBoxItemInput {
  return parseOrThrow(taskBoxItemSchema, {
    summary: item.summary,
    emoji: item.emoji,
    routine: item.routine,
    rewardPoints: item.rewardPoints,
    ...patch,
  });
}

/** Both writes return the stored row, so the sheet redraws from the database. */
async function writeTemplate(
  actor: Actor,
  columns: TemplateWrite,
  id: string | null,
): Promise<TaskBoxItem> {
  const table = adminFamily().from("task_box_items");
  const write =
    id === null
      ? table.insert({
          household_id: actor.householdId,
          ...columns,
          created_by: actor.profileId,
          updated_by: actor.profileId,
        })
      : table
          .update({ ...columns, updated_by: actor.profileId })
          .eq("id", id)
          .eq("household_id", actor.householdId);

  const { data, error } = await write.select(TASK_BOX_COLUMNS).single();
  if (error) throw mapDbError(error);
  return toTaskBoxItem(data as unknown as TaskBoxItemRow);
}

/**
 * FR-377's three fields, 004 FR-401's fourth, and nothing else. `created_by`
 * and `updated_by` are the punch-in, never anything in the payload (FR-330,
 * Assumption 3).
 */
export async function createTaskBoxItem(
  input: TaskBoxItemInput,
): Promise<ActionResult<TaskBoxItem>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(taskBoxItemSchema, input);

    const item = await writeTemplate(actor, templateColumns(parsed), null);
    await touchActor(actor);
    return item;
  });
}

/**
 * FR-380's edit: the title, the emoji, the type and the star value — the four
 * fields the form offers (004 FR-401), and the same four the create takes.
 * Editing a template's value touches no ledger row: templates earn nothing
 * themselves, and a task already made from one keeps its own value.
 */
export async function updateTaskBoxItem(input: {
  id: string;
  patch: Partial<TaskBoxItemInput>;
}): Promise<ActionResult<TaskBoxItem>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(updateTaskBoxItemSchema, input);
    const existing = await loadTemplate(actor.householdId, parsed.id);
    const merged = mergedTemplate(existing, parsed.patch);

    const item = await writeTemplate(actor, templateColumns(merged), parsed.id);
    await touchActor(actor);
    return item;
  });
}

/**
 * FR-381: permanent, and confirmed behind the warning that says so. Tasks
 * already created from this template are untouched — no column references it,
 * so there is nothing for the delete to reach.
 */
export async function deleteTaskBoxItem(input: {
  id: string;
  confirm: boolean;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(deleteTaskBoxItemSchema, input);
    // A template of another household reads as absent, never as forbidden.
    await loadTemplate(actor.householdId, parsed.id);

    const { error } = await adminFamily()
      .from("task_box_items")
      .delete()
      .eq("id", parsed.id)
      .eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);

    await touchActor(actor);
    return null;
  });
}
