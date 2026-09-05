"use server";

/**
 * Rewards — Phase 4 (specs/004-family-rewards, contracts/server-actions.md
 * §Rewards): `createReward`, `updateReward` and `deleteReward`.
 *
 * All three are `requireParent()` — FR-419: creating, editing and deleting a
 * reward are parent-only, and refused on the server, so a request that bypasses
 * the form is refused exactly as a tap on a hidden control would be. The
 * affordances in `permissions.ts` (`reward.create` / `reward.edit` /
 * `reward.delete`) decide what is SHOWN; these decide what HAPPENS.
 *
 * **One reward, a table of eligibilities** (R404, FR-417): the row carries the
 * six fields FR-415 fixes, and `family.reward_eligibilities` carries one row per
 * eligible Profile — never a Label (FR-414), which the action refuses first and
 * 024's trigger refuses second. Progress is not stored anywhere: it is the
 * Profile's balance against the reward's cost (FR-420), so a cost edit moves
 * every bar at once and touches no redemption's stored cost — a redemption
 * copied the cost as it was (FR-428), and nothing here reaches into that table.
 *
 * The edit parses the MERGED reward through the create schema
 * (`validateRewardPatch`) rather than a patch schema of its own — `updateTask`'s
 * discipline: one list of allowed fields, so an emptied Profile list is refused
 * by the same `min(1)` the create carries (FR-415), a balance or a redemption
 * date a client invents is refused by the same strict object, and a refusal
 * lands against its own top-level field for the form to show. The eligibilities
 * are then rewritten as a **set difference** — delete the removed, insert the
 * added — so a surviving Profile's link row is the same row and their standing
 * redemption is untouched (FR-418).
 *
 * The delete is one statement behind FR-418's confirmation: eligibilities and
 * redemptions cascade (026's FK), the ledger's entries do not — they carry the
 * reward's name and cost by copy and the redemption by an id without a foreign
 * key, so a deleted reward's stars stay spent and the balance stays where it
 * was (FR-421, FR-411, R405).
 *
 * T039 (`redeemReward`, `unredeemReward`) and T045 (`adjustStars`) join this
 * module below.
 */

import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireParent } from "../guards";
import { rewardsSelect, toReward, type RewardWithEligibilitiesRow } from "../rows";
import type { Actor, Reward } from "../types";
import {
  deleteRewardSchema,
  parseOrThrow,
  rewardInputSchema,
  updateRewardSchema,
  validateRewardPatch,
  type RewardInput,
} from "../validation";
import { adminFamily, mapDbError, touchActor } from "./shared";

const LABEL_NOT_ELIGIBLE = "A reward can only be for a person, not for a label.";

// One embed, joined rather than concatenated, for the reason `tasksSelect` is.
const REWARD_SELECT = rewardsSelect();

/** The five columns a reward write carries — FR-415's six fields less the Profiles. */
type RewardWrite = Record<string, string | number | boolean | null>;

function rewardColumns(input: RewardInput): RewardWrite {
  return {
    name: input.name,
    description: input.description ?? null,
    emoji: input.emoji ?? null,
    point_value: input.pointValue,
    respawn_on_redemption: input.respawnOnRedemption,
  };
}

/**
 * One reward in one household, with its eligibilities. Scoping by household
 * here is the tenancy check (FR-442): under the service role there is no RLS,
 * and a reward belonging to another household must read as absent rather than
 * as forbidden.
 */
async function loadReward(householdId: string, id: string): Promise<Reward> {
  const { data, error } = await adminFamily()
    .from("rewards")
    .select(REWARD_SELECT)
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toReward(data as unknown as RewardWithEligibilitiesRow);
}

/** What one of the household's categories is — a Profile, or a Label. */
type CategoryKind = "profile" | "label";

/**
 * Every category of this household by kind — a handful of rows, read whole
 * rather than probed by id, so the eligibility check below can judge each
 * requested id against the same map. An id from another household is simply
 * absent: under the service role there is no RLS, so the household filter here
 * is the tenancy check (FR-442).
 */
async function householdCategoryKinds(householdId: string): Promise<Map<string, CategoryKind>> {
  const { data, error } = await adminFamily()
    .from("categories")
    .select("id, is_profile")
    .eq("household_id", householdId);
  if (error) throw mapDbError(error);
  const kinds = new Map<string, CategoryKind>();
  for (const row of (data ?? []) as unknown as { id: string; is_profile: boolean }[]) {
    kinds.set(row.id, row.is_profile ? "profile" : "label");
  }
  return kinds;
}

/**
 * FR-414 / FR-415: a reward may be for a Profile and never for a Label, and an
 * id from another household is `NOT_FOUND` rather than `FORBIDDEN` — nothing
 * confirms that a row exists somewhere else. Judged per id, in the order the
 * form sent them. Runs BEFORE the reward row is written, so a refused create
 * leaves no reward eligible for nobody (data-model invariant 7); 024's trigger
 * is the second line.
 */
async function assertEligibleAreProfiles(
  householdId: string,
  ids: readonly string[],
): Promise<void> {
  const kinds = await householdCategoryKinds(householdId);
  for (const id of ids) {
    const kind = kinds.get(id);
    if (kind === undefined) throw new ActionFailure("NOT_FOUND");
    if (kind === "label") {
      throw new ActionFailure("VALIDATION", LABEL_NOT_ELIGIBLE, {
        categoryIds: [LABEL_NOT_ELIGIBLE],
      });
    }
  }
}

/**
 * The reward row alone, handing back its id: the returned `Reward` is re-read
 * with its eligibilities once those are in place, so the form redraws from
 * what the database holds. `created_by` and `updated_by` are the punch-in,
 * never anything in the payload.
 */
async function insertRewardRow(actor: Actor, columns: RewardWrite): Promise<string> {
  const { data, error } = await adminFamily()
    .from("rewards")
    .insert({
      household_id: actor.householdId,
      ...columns,
      created_by: actor.profileId,
      updated_by: actor.profileId,
    })
    .select("id")
    .single();
  if (error) throw mapDbError(error);
  return (data as { id: string }).id;
}

/**
 * The five columns and `updated_by`; `updated_at` is 024's `touch` trigger.
 * Selecting the id back turns a row that vanished between the re-read and the
 * write into `NOT_FOUND` (PGRST116) rather than a silent no-op.
 */
async function updateRewardRow(actor: Actor, id: string, columns: RewardWrite): Promise<void> {
  const { error } = await adminFamily()
    .from("rewards")
    .update({ ...columns, updated_by: actor.profileId })
    .eq("id", id)
    .eq("household_id", actor.householdId)
    .select("id")
    .single();
  if (error) throw mapDbError(error);
}

async function insertEligibilities(
  householdId: string,
  rewardId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const rows = ids.map((category_id) => ({
    household_id: householdId,
    reward_id: rewardId,
    category_id,
  }));
  const { error } = await adminFamily().from("reward_eligibilities").insert(rows);
  if (error) throw mapDbError(error);
}

async function deleteEligibilities(
  householdId: string,
  rewardId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await adminFamily()
    .from("reward_eligibilities")
    .delete()
    .eq("household_id", householdId)
    .eq("reward_id", rewardId)
    .in("category_id", [...ids]);
  if (error) throw mapDbError(error);
}

/**
 * Contracts §updateReward: the link set is rewritten as a set difference, so a
 * Profile who survives the rewrite keeps their row — and with it nothing about
 * their standing redemption is disturbed (FR-418). A delete-and-reinsert would
 * be the same set with a different history; this is the same rows.
 */
async function rewriteEligibilities(reward: Reward, ids: readonly string[]): Promise<void> {
  const wanted = new Set(ids);
  const held = new Set(reward.categoryIds);
  await deleteEligibilities(
    reward.householdId,
    reward.id,
    reward.categoryIds.filter((id) => !wanted.has(id)),
  );
  await insertEligibilities(
    reward.householdId,
    reward.id,
    ids.filter((id) => !held.has(id)),
  );
}

/**
 * FR-415's six fields and nothing else: one `rewards` row, then one
 * `reward_eligibilities` row per Profile, in that order. `created_by` and
 * `updated_by` are the punch-in, never anything in the payload.
 */
export async function createReward(input: RewardInput): Promise<ActionResult<Reward>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(rewardInputSchema, input);
    await assertEligibleAreProfiles(actor.householdId, parsed.categoryIds);

    const id = await insertRewardRow(actor, rewardColumns(parsed));
    await insertEligibilities(actor.householdId, id, parsed.categoryIds);
    await touchActor(actor);
    return loadReward(actor.householdId, id);
  });
}

/**
 * FR-418's edit of every field, eligible Profiles included: the admin re-read
 * (a reward another device deleted is `NOT_FOUND`), the merged shape judged
 * whole, the row, then the set-difference rewrite. Changing `pointValue`
 * changes no redemption's stored cost — nothing here touches `redemptions`
 * (FR-420, FR-428).
 */
export async function updateReward(input: {
  id: string;
  patch: Partial<RewardInput>;
}): Promise<ActionResult<Reward>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(updateRewardSchema, input);
    const existing = await loadReward(actor.householdId, parsed.id);
    const merged = validateRewardPatch(existing, parsed.patch);
    await assertEligibleAreProfiles(actor.householdId, merged.categoryIds);

    await updateRewardRow(actor, parsed.id, rewardColumns(merged));
    await rewriteEligibilities(existing, merged.categoryIds);
    await touchActor(actor);
    return loadReward(actor.householdId, parsed.id);
  });
}

/**
 * FR-418: permanent, and confirmed behind the warning that says so. One
 * DELETE; eligibilities and redemptions cascade, ledger entries stay — a
 * deleted reward's stars stay spent (FR-421).
 */
export async function deleteReward(input: {
  id: string;
  confirm: boolean;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(deleteRewardSchema, input);
    // A reward of another household reads as absent, never as forbidden.
    await loadReward(actor.householdId, parsed.id);

    const { error } = await adminFamily()
      .from("rewards")
      .delete()
      .eq("id", parsed.id)
      .eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);

    await touchActor(actor);
    return null;
  });
}
