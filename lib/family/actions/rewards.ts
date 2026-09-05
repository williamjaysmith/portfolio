"use server";

/**
 * Rewards — Phase 4 (specs/004-family-rewards, contracts/server-actions.md
 * §Rewards and §Redeeming): `createReward`, `updateReward` and `deleteReward`;
 * `redeemReward` and `unredeemReward`.
 *
 * The first three are `requireParent()` — FR-419: creating, editing and deleting a
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
 * **Redeeming is one statement each, with the money in triggers** (R403,
 * contracts §Redeeming). `redeemReward` and `unredeemReward` are
 * `requireVerifiedActor()` plus FR-424's target rule — a member for themselves,
 * a parent for any eligible Profile — judged by `assertMayRedeem` on the role
 * the DATABASE holds, so a parent demoted on another device is refused at once
 * (R323). The redeem is ONE insert carrying the reward, the Profile and the
 * punch-in; 026's `assert_redemption` locks the Profile's row, checks
 * eligibility, the one-time rule and the balance against the STORED cost, and
 * copies cost, name and household day onto the row (FR-428, FR-429, FR-430) —
 * which is why two devices in the same second reach exactly one row and one
 * `CONFLICT` (SC-409). The unredeem is ONE update setting `reversed_at`;
 * `record_redemption` refuses a second reversal and writes the refund as a
 * second ledger row, never an erasure (FR-431). The three refusals that speak
 * of a Profile (`P0005`–`P0007`) are re-worded here with their name.
 *
 * T045 (`adjustStars`) joins this module below.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireParent, requireVerifiedActor } from "../guards";
import { mayRedeemFor } from "../permissions";
import {
  REDEMPTION_COLUMNS,
  rewardsSelect,
  toRedemption,
  toReward,
  type RedemptionRow,
  type RewardWithEligibilitiesRow,
} from "../rows";
import type { Actor, Category, Redemption, Reward } from "../types";
import {
  deleteRewardSchema,
  parseOrThrow,
  redeemRewardSchema,
  rewardInputSchema,
  unredeemRewardSchema,
  updateRewardSchema,
  validateRewardPatch,
  type RewardInput,
} from "../validation";
import { adminFamily, loadProfile, mapDbError, touchActor } from "./shared";

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

/* ------------------------------------------------------------------------- *
 * FR-424: the target rule, applied once for redeem and unredeem.
 * ------------------------------------------------------------------------- */

const ALREADY_PUT_BACK = "That was already put back.";

/**
 * The Profile a redemption would credit, by household — the tenancy check
 * (FR-442): an id from another household, an unknown one and a Label all read
 * as absent, never as forbidden, before any rule is judged or any row written.
 * The row's label is what every refusal below names.
 */
async function loadTargetProfile(householdId: string, categoryId: string): Promise<Category> {
  const profile = await loadProfile(householdId, categoryId);
  if (!profile) throw new ActionFailure("NOT_FOUND");
  return profile;
}

/**
 * FR-424, beside `assertMayResolve`'s shape: a parent for anyone, a member for
 * themselves only. The role is the database's (`requireVerifiedActor`), never
 * the cookie's, and the refusal says whose reward it is and that a parent may
 * do it — the contract's words, for the unredeem too (FR-431).
 */
function assertMayRedeem(actor: Actor, target: Category): void {
  if (mayRedeemFor(actor, target.id)) return;
  throw new ActionFailure(
    "FORBIDDEN",
    `That's ${target.label}'s reward — only ${target.label} or a parent can redeem it.`,
  );
}

/**
 * The three refusals 026's `assert_redemption` raises ABOUT a Profile, in the
 * contract's words (§Shared result shape). Every other code — `P0002` for a
 * reward that is gone, a foreign key, the unexpected — is `mapDbError`'s.
 */
const NAMED_REFUSALS: Record<string, (name: string) => ActionFailure> = {
  P0005: (name) => new ActionFailure("FORBIDDEN", `That reward isn't for ${name}.`),
  P0006: (name) => new ActionFailure("CONFLICT", `${name} has already redeemed that.`),
  P0007: (name) => new ActionFailure("CONFLICT", `${name} no longer has enough stars for that.`),
};

function redemptionFailure(error: PostgrestError, name: string): ActionFailure {
  const named = error.code ? NAMED_REFUSALS[error.code] : undefined;
  return named ? named(name) : mapDbError(error);
}

/** `P0008` — `record_redemption` refusing a second reversal (FR-431). */
function reversalFailure(error: PostgrestError): ActionFailure {
  if (error.code === "P0008") return new ActionFailure("CONFLICT", ALREADY_PUT_BACK);
  return mapDbError(error);
}

/**
 * Contracts §redeemReward: ONE insert carrying the reward, the Profile, the
 * household and the punch-in — and nothing else. The trigger fills
 * `point_value`, `reward_name` and `redeemed_on` from the stored reward and the
 * household day; the caller never supplies them (FR-428, FR-433). The row read
 * back is what the modal is rendered from (FR-432).
 */
async function insertRedemption(
  actor: Actor,
  rewardId: string,
  target: Category,
): Promise<Redemption> {
  const { data, error } = await adminFamily()
    .from("redemptions")
    .insert({
      household_id: actor.householdId,
      reward_id: rewardId,
      category_id: target.id,
      redeemed_by: actor.profileId,
    })
    .select(REDEMPTION_COLUMNS)
    .single();
  if (error) throw redemptionFailure(error, target.label);
  return toRedemption(data as unknown as RedemptionRow);
}

/** One redemption in one household — `loadReward`'s tenancy check, for a redemption. */
async function loadRedemption(householdId: string, id: string): Promise<Redemption> {
  const { data, error } = await adminFamily()
    .from("redemptions")
    .select(REDEMPTION_COLUMNS)
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toRedemption(data as unknown as RedemptionRow);
}

/**
 * Contracts §unredeemReward: ONE update setting `reversed_at` and `reversed_by`.
 * Deliberately NOT narrowed by `reversed_at is null` — a second reversal must
 * reach the trigger and come back as its `P0008`, the contract's `CONFLICT`,
 * rather than as a row that matched nothing. Two devices in the same second
 * serialise on the row itself, so exactly one refund is written (FR-431).
 */
async function reverseRedemption(actor: Actor, redemptionId: string): Promise<Redemption> {
  const { data, error } = await adminFamily()
    .from("redemptions")
    .update({ reversed_at: new Date().toISOString(), reversed_by: actor.profileId })
    .eq("id", redemptionId)
    .eq("household_id", actor.householdId)
    .select(REDEMPTION_COLUMNS)
    .single();
  if (error) throw reversalFailure(error);
  return toRedemption(data as unknown as RedemptionRow);
}

/**
 * FR-424, FR-428–FR-430: the punch-in, the two ids and nothing else; the
 * Profile re-read by household; the target rule; one insert. A reward another
 * device deleted first is the trigger's `P0002` → `NOT_FOUND` (FR-441).
 */
export async function redeemReward(input: {
  rewardId: string;
  categoryId: string;
}): Promise<ActionResult<Redemption>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(redeemRewardSchema, input);
    const target = await loadTargetProfile(actor.householdId, parsed.categoryId);
    assertMayRedeem(actor, target);

    const redemption = await insertRedemption(actor, parsed.rewardId, target);
    await touchActor(actor);
    return redemption;
  });
}

/**
 * FR-431: the same target rule, on the Profile the redemption credited — a
 * member may put back only their own, a parent anyone's — then one update.
 * Returns the reversed row, so the caller can show the refund it names.
 */
export async function unredeemReward(input: {
  redemptionId: string;
}): Promise<ActionResult<Redemption>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(unredeemRewardSchema, input);
    const redemption = await loadRedemption(actor.householdId, parsed.redemptionId);
    const target = await loadTargetProfile(actor.householdId, redemption.categoryId);
    assertMayRedeem(actor, target);

    const reversed = await reverseRedemption(actor, redemption.id);
    await touchActor(actor);
    return reversed;
  });
}
