"use server";

/**
 * Rewards — Phase 4 (specs/004-family-rewards, contracts/server-actions.md
 * §Rewards, §Redeeming and §Giving stars by hand): `createReward`,
 * `updateReward` and `deleteReward`; `redeemReward` and `unredeemReward`;
 * `adjustStars`.
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
 * **Giving stars by hand is ONE multi-row INSERT** (R403, contracts §Giving
 * stars by hand, FR-434–FR-436). `adjustStars` is `requireParent()` — FR-435:
 * a member is refused on every path, for themselves included — and writes one
 * `adjustment` row per chosen Profile, in id order, in one statement. 025's
 * `assert_star_adjustment` locks each Profile's row and refuses the row that
 * would end below zero with `P0004`; a multi-row INSERT is one statement, so
 * that refusal rolls back EVERY chosen Profile's row — the one who could have
 * afforded it included (SC-412). The action re-words `P0004` with the name of
 * the FIRST Profile in id order whose balance would end below zero, against the
 * `amount` field, so the sheet's before-and-after table can flag the row. The
 * answer is the chosen Profiles' rows of `star_balances` — the truth the
 * table's arithmetic (`beforeAndAfterOf`) is checked against.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { localDateOf } from "../calendar/dates";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireParent, requireVerifiedActor } from "../guards";
import { mayRedeemFor } from "../permissions";
import { balanceMapOf, beforeAndAfterOf } from "../rewards/stars";
import {
  REDEMPTION_COLUMNS,
  STAR_BALANCE_COLUMNS,
  rewardsSelect,
  toRedemption,
  toReward,
  toStarBalance,
  type RedemptionRow,
  type RewardWithEligibilitiesRow,
  type StarBalanceRow,
} from "../rows";
import type { Actor, Category, Redemption, Reward, StarBalance } from "../types";
import {
  adjustStarsSchema,
  deleteRewardSchema,
  parseOrThrow,
  redeemRewardSchema,
  rewardInputSchema,
  unredeemRewardSchema,
  updateRewardSchema,
  validateRewardPatch,
  type RewardInput,
} from "../validation";
import { adminFamily, loadHouseholdZone, loadProfile, mapDbError, touchActor } from "./shared";

const LABEL_NOT_ELIGIBLE = "A reward can only be for a person, not for a label.";
const LABEL_GETS_NO_STARS = "Stars can only be given to a person, not to a label.";

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

/** What one of the household's categories is — a Profile, or a Label — and what it is called. */
interface HouseholdCategory {
  kind: "profile" | "label";
  label: string;
}

/** A Profile a write is about to name: the id the row carries, the label a refusal speaks of. */
interface NamedProfile {
  id: string;
  label: string;
}

/**
 * Every category of this household by kind and name — a handful of rows, read
 * whole rather than probed by id, so the checks below can judge each requested
 * id against the same map. An id from another household is simply absent:
 * under the service role there is no RLS, so the household filter here is the
 * tenancy check (FR-442).
 */
async function householdCategories(householdId: string): Promise<Map<string, HouseholdCategory>> {
  const { data, error } = await adminFamily()
    .from("categories")
    .select("id, label, is_profile")
    .eq("household_id", householdId);
  if (error) throw mapDbError(error);
  const categories = new Map<string, HouseholdCategory>();
  const rows = (data ?? []) as unknown as { id: string; label: string; is_profile: boolean }[];
  for (const row of rows) {
    categories.set(row.id, { kind: row.is_profile ? "profile" : "label", label: row.label });
  }
  return categories;
}

/**
 * The requested ids as Profiles of this household, or the refusal: an id from
 * another household is `NOT_FOUND` rather than `FORBIDDEN` — nothing confirms
 * that a row exists somewhere else (FR-442) — and a Label is `VALIDATION`
 * against `categoryIds` in the caller's words (FR-414). Judged per id, in the
 * order the form sent them; the Profiles come back in that order too.
 */
async function requireProfiles(
  householdId: string,
  ids: readonly string[],
  labelRefusal: string,
): Promise<NamedProfile[]> {
  const categories = await householdCategories(householdId);
  return ids.map((id) => {
    const category = categories.get(id);
    if (category === undefined) throw new ActionFailure("NOT_FOUND");
    if (category.kind === "label") {
      throw new ActionFailure("VALIDATION", labelRefusal, { categoryIds: [labelRefusal] });
    }
    return { id, label: category.label };
  });
}

/**
 * FR-414 / FR-415: a reward may be for a Profile and never for a Label. Runs
 * BEFORE the reward row is written, so a refused create leaves no reward
 * eligible for nobody (data-model invariant 7); 024's trigger is the second
 * line.
 */
async function assertEligibleAreProfiles(
  householdId: string,
  ids: readonly string[],
): Promise<void> {
  await requireProfiles(householdId, ids, LABEL_NOT_ELIGIBLE);
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

/* ------------------------------------------------------------------------- *
 * FR-434–FR-436: giving stars by hand — one statement for every chosen Profile.
 * ------------------------------------------------------------------------- */

function overdrawMessage(name: string): string {
  return `That would leave ${name} below zero.`;
}

/** The chosen Profiles in id order — the INSERT's order, the trigger's, and the answer's. */
function inIdOrder(profiles: readonly NamedProfile[]): NamedProfile[] {
  return [...profiles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The chosen Profiles' rows of `star_balances`, in id order — the action's
 * answer, and the balances a `P0004` is re-worded from (SC-412). Every Profile
 * has a row: the view sums over `categories`, so a Profile who has never had a
 * star reads 0 rather than nothing.
 */
async function loadBalances(householdId: string, ids: readonly string[]): Promise<StarBalance[]> {
  const { data, error } = await adminFamily()
    .from("star_balances")
    .select(STAR_BALANCE_COLUMNS)
    .eq("household_id", householdId)
    .in("category_id", [...ids])
    .order("category_id");
  if (error) throw mapDbError(error);
  return ((data ?? []) as unknown as StarBalanceRow[]).map(toStarBalance);
}

/**
 * `P0004` re-worded with the Profile it refused (contracts §Shared result
 * shape), against `amount` so the sheet flags the row. The trigger judges the
 * rows in INSERT order — id order — and raises at the first that would end
 * below zero; nothing was written, so the same arithmetic over the balances as
 * they stand (`beforeAndAfterOf`, the sheet's own table) finds that row again.
 * Should another device have moved a balance in the meantime so that no row
 * reads below zero any more, the refusal is reported as the database's plain
 * `VALIDATION` rather than pinned on a Profile it no longer fits.
 */
async function overdrawFailure(
  error: PostgrestError,
  householdId: string,
  chosen: readonly NamedProfile[],
  amount: number,
): Promise<ActionFailure> {
  const ids = chosen.map((one) => one.id);
  const balances = balanceMapOf(await loadBalances(householdId, ids));
  const at = beforeAndAfterOf(balances, ids, amount).rows.findIndex((row) => row.belowZero);
  const refused = chosen[at];
  if (refused === undefined) return mapDbError(error);
  const message = overdrawMessage(refused.label);
  return new ActionFailure("VALIDATION", message, { amount: [message] });
}

/**
 * Contracts §adjustStars: ONE multi-row INSERT — one `adjustment` row per
 * Profile carrying the amount, the punch-in and the household day, and nothing
 * of an occurrence, a redemption or a title (025's kind shape). One statement
 * is one transaction: 025's trigger refusing any row rolls back every row, so
 * a parent giving −5 to two children never takes from the one who could
 * afford it (FR-436, SC-412).
 */
async function insertAdjustments(
  actor: Actor,
  chosen: readonly NamedProfile[],
  amount: number,
  enteredOn: string,
): Promise<void> {
  const rows = chosen.map((one) => ({
    household_id: actor.householdId,
    category_id: one.id,
    amount,
    kind: "adjustment",
    summary: null,
    created_by: actor.profileId,
    entered_on: enteredOn,
  }));
  const { error } = await adminFamily().from("star_entries").insert(rows);
  if (!error) return;
  if (error.code !== "P0004") throw mapDbError(error);
  throw await overdrawFailure(error, actor.householdId, chosen, amount);
}

/**
 * FR-434–FR-436: a parent, one whole amount in −500…500 and never 0 (the
 * schema's refusal, 025's CHECK the second line), one or more Profiles of this
 * household judged per id, the household's day — never the device's (FR-433) —
 * then one statement. Returns the resulting balances of exactly the chosen
 * Profiles, in id order, so the sheet redraws from what the database holds.
 */
export async function adjustStars(input: {
  categoryIds: string[];
  amount: number;
}): Promise<ActionResult<StarBalance[]>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(adjustStarsSchema, input);
    const chosen = inIdOrder(
      await requireProfiles(actor.householdId, parsed.categoryIds, LABEL_GETS_NO_STARS),
    );
    const { zone } = await loadHouseholdZone(actor.householdId);

    await insertAdjustments(actor, chosen, parsed.amount, localDateOf(zone, Date.now()));
    await touchActor(actor);
    return loadBalances(actor.householdId, chosen.map((one) => one.id));
  });
}
