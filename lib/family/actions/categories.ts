"use server";

/**
 * Profiles and Labels (contracts → "Profiles and Labels"; FR-019 … FR-027).
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

    const { error } = await adminFamily()
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);

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
