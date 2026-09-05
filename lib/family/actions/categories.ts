"use server";

/**
 * Profiles and Labels (contracts → "Profiles and Labels"; FR-019 … FR-027).
 * `deleteCategory` carries two later amendments: 003 FR-391's orphaned-task
 * cleanup and 004 FR-443's orphaned-reward cleanup, one posture, two tables.
 *
 * All writes go through here rather than straight from the browser, because
 * row-level security can see WHICH ACCOUNT is asking but not WHICH FAMILY
 * MEMBER is standing at the tablet. The actor comes from the signed cookie —
 * never from an argument.
 */

import { revalidatePath } from "next/cache";

import { clearActor } from "../actor";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireMember, requireParent, requireParentOrBootstrap } from "../guards";
import { nextSortOrder, rebalance } from "../ordering";
import { bootstrapRole, canChangeRole, canDelete } from "../permissions";
import { CATEGORY_COLUMNS, toCategory, type CategoryRow } from "../rows";
import { createAdminClient } from "../supabase/admin";
import type { Category, CategoryInput, CategoryPatch } from "../types";
import { categoryInputSchema, parseOrThrow, reorderSchema, validateCategoryPatch } from "../validation";
import { adminFamily, mapDbError, touchActor } from "./shared";

/** Snake-cased columns for an INSERT/UPDATE — every field the patch may carry. */
type CategoryWrite = Record<string, string | number | boolean | null>;

async function loadHouseholdCategories(householdId: string): Promise<Category[]> {
  const { data, error } = await adminFamily()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true });
  if (error) throw mapDbError(error);
  return ((data ?? []) as unknown as CategoryRow[]).map(toCategory);
}

async function loadCategory(householdId: string, id: string): Promise<Category> {
  const { data, error } = await adminFamily()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toCategory(data as unknown as CategoryRow);
}

/** An avatar is an illustration OR a photo OR nothing — never a mix (003 CHECK). */
function avatarColumns(avatar: CategoryInput["avatar"]): CategoryWrite {
  if (avatar === undefined) return {};
  if (avatar === null) return { avatar_kind: null, avatar_id: null, avatar_path: null };
  return { avatar_kind: "illustration", avatar_id: avatar.id, avatar_path: null };
}

/** Patch field → its column. `avatar` is handled separately: it spans three columns. */
const CATEGORY_FIELDS = {
  label: "label",
  color: "color",
  emoji: "emoji",
  birthday: "birthday",
  dietaryPrefs: "dietary_prefs",
  role: "role",
  showOnTasks: "show_on_tasks",
} as const satisfies Partial<Record<keyof CategoryPatch, string>>;

function patchColumns(patch: CategoryPatch): CategoryWrite {
  const columns: CategoryWrite = { ...avatarColumns(patch.avatar) };
  for (const [field, column] of Object.entries(CATEGORY_FIELDS)) {
    const value = patch[field as keyof typeof CATEGORY_FIELDS];
    if (value !== undefined) columns[column] = value;
  }
  return columns;
}

/** Storage objects are removed on a best-effort basis; a stale file is not worth failing a delete. */
async function removeAvatarObject(path: string | null): Promise<void> {
  if (!path) return;
  try {
    // Storage lives on the root client, not on a schema-scoped one.
    await createAdminClient().storage.from("family-avatars").remove([path]);
  } catch {
    // Ignored: the row is the source of truth, the object is derived.
  }
}

function refreshFamilyRoutes(): void {
  revalidatePath("/family", "layout");
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<Category>> {
  return runAction(async () => {
    // D6: a household with no parent yet lets a signed-in member create the
    // first one, so a fresh install is not a dead end.
    const { actor, bootstrap } = await requireParentOrBootstrap();
    // On the bootstrap path there is no actor to take the household from.
    const householdId = actor?.householdId ?? (await requireMember()).householdId;
    const parsed = parseOrThrow(categoryInputSchema, input);

    const existing = await loadHouseholdCategories(householdId);
    // Bootstrap always creates a person: a Label cannot be the first parent.
    // The kind is forced ONCE and everything else follows it — deriving the
    // role from what the caller asked for instead would write
    // `is_profile = true, role = 'member'`, leaving the household with no
    // parent and the bootstrap door open for ever.
    const isProfile = bootstrap || parsed.isProfile;
    const role = isProfile
      ? bootstrapRole({ role: parsed.role }, { householdHasParent: !bootstrap })
      : "member";

    const write: CategoryWrite = {
      household_id: householdId,
      label: parsed.label,
      color: parsed.color,
      is_profile: isProfile,
      role,
      show_on_tasks: parsed.showOnTasks ?? true,
      sort_order: nextSortOrder(existing),
      created_by: actor?.profileId ?? null,
      updated_by: actor?.profileId ?? null,
      // Person fields and a Label's emoji follow the FORCED kind: 003 rejects
      // a row that mixes them (`profile_has_no_emoji`,
      // `label_has_no_person_fields`), so a forced Profile drops the emoji
      // the caller sent rather than failing the insert.
      ...avatarColumns(isProfile ? (parsed.avatar ?? null) : null),
      emoji: isProfile ? null : (parsed.emoji ?? null),
      birthday: isProfile ? (parsed.birthday ?? null) : null,
      dietary_prefs: isProfile ? (parsed.dietaryPrefs ?? null) : null,
    };

    const { data, error } = await adminFamily()
      .from("categories")
      .insert(write)
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw mapDbError(error);

    await touchActor(actor);
    refreshFamilyRoutes();
    return toCategory(data as unknown as CategoryRow);
  });
}

export async function updateCategory(
  id: string,
  patch: CategoryPatch,
): Promise<ActionResult<Category>> {
  return runAction(async () => {
    const actor = await requireParent();
    const existing = await loadCategory(actor.householdId, id);
    const validated = validateCategoryPatch(existing, patch);

    if (validated.role !== undefined && validated.role !== existing.role) {
      const all = await loadHouseholdCategories(actor.householdId);
      const decision = canChangeRole(existing, validated.role, all);
      if (!decision.allowed) {
        throw new ActionFailure(
          "CONFLICT",
          "You can't demote the only parent. Make someone else a parent first.",
        );
      }
    }

    // Switching to an illustration (or to none) orphans the photo object.
    const dropsPhoto = validated.avatar !== undefined && existing.avatarKind === "photo";

    const { data, error } = await adminFamily()
      .from("categories")
      .update({ ...patchColumns(validated), updated_by: actor.profileId })
      .eq("id", id)
      .eq("household_id", actor.householdId)
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw mapDbError(error);

    if (dropsPhoto) await removeAvatarObject(existing.avatarPath);
    await touchActor(actor);
    refreshFamilyRoutes();
    return toCategory(data as unknown as CategoryRow);
  });
}

/**
 * A table linking a Profile to something that is orphaned without them — a
 * task they are assigned to (018), a reward they are eligible for (024) — and
 * the column naming that something. Both links cascade with the Profile, which
 * is why the ids are read BEFORE the delete and checked for company AFTER it.
 */
interface ProfileLink {
  readonly table: "task_assignees" | "reward_eligibilities";
  /** The column naming the linked thing — its id. */
  readonly column: "task_id" | "reward_id";
}

const TASK_ASSIGNMENTS: ProfileLink = { table: "task_assignees", column: "task_id" };
const REWARD_ELIGIBILITIES: ProfileLink = { table: "reward_eligibilities", column: "reward_id" };

/** The link rows as PostgREST returns them: one key, the column asked for. */
type LinkRow = Record<ProfileLink["column"], string>;

/** What the delete may orphan, read while the link rows still exist. */
interface OrphanCandidates {
  taskIds: string[];
  rewardIds: string[];
}

/** The linked ids that name this Profile — the candidates for orphaning. */
async function idsLinkedTo(
  householdId: string,
  link: ProfileLink,
  categoryId: string,
): Promise<string[]> {
  const { data, error } = await adminFamily()
    .from(link.table)
    .select(link.column)
    .eq("household_id", householdId)
    .eq("category_id", categoryId);
  if (error) throw mapDbError(error);
  return ((data ?? []) as unknown as LinkRow[]).map((row) => row[link.column]);
}

/** Of the candidates, the ones no link row names any more: nobody is left. */
async function orphansAmong(
  householdId: string,
  link: ProfileLink,
  candidateIds: readonly string[],
): Promise<string[]> {
  if (candidateIds.length === 0) return [];
  const { data, error } = await adminFamily()
    .from(link.table)
    .select(link.column)
    .eq("household_id", householdId)
    .in(link.column, [...candidateIds]);
  if (error) throw mapDbError(error);
  const stillLinked = new Set(
    ((data ?? []) as unknown as LinkRow[]).map((row) => row[link.column]),
  );
  return candidateIds.filter((id) => !stillLinked.has(id));
}

/**
 * 003 FR-391 — the tasks this Profile was assigned to and, 004 FR-443, the
 * rewards they were eligible for, both read BEFORE the delete, because the
 * cascades take the link rows with the Profile and there would be nothing
 * left to compute the orphans from afterwards.
 */
async function orphanCandidatesOf(
  householdId: string,
  categoryId: string,
): Promise<OrphanCandidates> {
  return {
    taskIds: await idsLinkedTo(householdId, TASK_ASSIGNMENTS, categoryId),
    rewardIds: await idsLinkedTo(householdId, REWARD_ELIGIBILITIES, categoryId),
  };
}

/**
 * 003 FR-391 / SC-317, the one destructive statement in Phase 3: after the
 * category delete — whose cascades take the assignments and that Profile's own
 * resolution chains — the tasks left with nobody to do them are deleted by id.
 * A task somebody else is also assigned to survives, with their history intact.
 *
 * **Up-for-grabs tasks are excluded**, and by construction as well as by the
 * clause: they legitimately have no assignee, and a chore becomes up-for-grabs
 * by an explicit choice, never by attrition.
 *
 * The two-statement residual is recorded rather than engineered around: a crash
 * between them leaves a task with no assignee on nobody's board — retained, not
 * lost, and repaired by re-running the cleanup (data-model, "accepted residual").
 */
async function deleteOrphanedTasks(
  householdId: string,
  candidateIds: readonly string[],
): Promise<void> {
  const orphaned = await orphansAmong(householdId, TASK_ASSIGNMENTS, candidateIds);
  if (orphaned.length === 0) return;

  const removal = await adminFamily()
    .from("tasks")
    .delete()
    .eq("household_id", householdId)
    .eq("up_for_grabs", false)
    .in("id", orphaned);
  if (removal.error) throw mapDbError(removal.error);
}

/**
 * 004 FR-443 / SC-419, Phase 4's cleanup in the same posture: after the
 * cascades have taken the Profile's eligibilities, entries and redemptions, the
 * rewards left for NOBODY are deleted by id — a card in no column is the
 * reward-shaped orphan, and it goes by the same reasoning as a task with no
 * assignee. A reward shared with another Profile survives on their column, with
 * their own balance against its cost and their own redemptions untouched (the
 * ledger keeps the deleted Profile's spending out of everyone else's sum by
 * construction: entries are per Profile).
 *
 * The same two-statement residual, accepted the same way: a crash between the
 * category delete and this one leaves a reward with no eligibility — retained,
 * not lost, and repaired by re-running the cleanup.
 */
async function deleteOrphanedRewards(
  householdId: string,
  candidateIds: readonly string[],
): Promise<void> {
  const orphaned = await orphansAmong(householdId, REWARD_ELIGIBILITIES, candidateIds);
  if (orphaned.length === 0) return;

  const removal = await adminFamily()
    .from("rewards")
    .delete()
    .eq("household_id", householdId)
    .in("id", orphaned);
  if (removal.error) throw mapDbError(removal.error);
}

/** After the delete: what nobody is left to do, then what nobody is left to spend on. */
async function deleteOrphans(householdId: string, candidates: OrphanCandidates): Promise<void> {
  await deleteOrphanedTasks(householdId, candidates.taskIds);
  await deleteOrphanedRewards(householdId, candidates.rewardIds);
}

export async function deleteCategory(
  id: string,
  opts: { confirm: boolean },
): Promise<ActionResult<{ actorCleared: boolean }>> {
  return runAction(async () => {
    // FR-026: deleting is always an explicit, confirmed act.
    if (!opts?.confirm) {
      throw new ActionFailure("VALIDATION", "Deleting needs to be confirmed.");
    }
    const actor = await requireParent();
    const existing = await loadCategory(actor.householdId, id);

    const all = await loadHouseholdCategories(actor.householdId);
    const decision = canDelete(existing, all);
    if (!decision.allowed) {
      throw new ActionFailure(
        "CONFLICT",
        "You can't delete the only parent. Make someone else a parent first.",
      );
    }

    // Read before the delete: the cascades remove the rows this is computed from.
    const candidates = await orphanCandidatesOf(actor.householdId, id);

    const { error } = await adminFamily()
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);

    // 003 FR-391: a task left with nobody to do it goes with the Profile;
    // 004 FR-443: so does a reward left with nobody to spend on it.
    await deleteOrphans(actor.householdId, candidates);
    await removeAvatarObject(existing.avatarPath);

    // Deleting yourself punches you out in the same response.
    const actorCleared = actor.profileId === id;
    if (actorCleared) {
      await clearActor();
    } else {
      await touchActor(actor);
    }
    refreshFamilyRoutes();
    return { actorCleared };
  });
}

export async function reorderCategories(orderedIds: string[]): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireParent();
    const ids = parseOrThrow(reorderSchema, orderedIds);

    const all = await loadHouseholdCategories(actor.householdId);
    const known = new Set(all.map((category) => category.id));
    if (ids.some((id) => !known.has(id))) throw new ActionFailure("NOT_FOUND");

    // Fractional indices are recomputed from scratch: idempotent, and one
    // write per row rather than a renumbering cascade.
    const updates = rebalance(ids);
    const results = await Promise.all(
      updates.map(({ id, sortOrder }) =>
        adminFamily()
          .from("categories")
          .update({ sort_order: sortOrder, updated_by: actor.profileId })
          .eq("id", id)
          .eq("household_id", actor.householdId),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw mapDbError(failed.error);

    await touchActor(actor);
    refreshFamilyRoutes();
    return null;
  });
}
