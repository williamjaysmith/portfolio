/**
 * Pure authorization rules for /family (FR-015, FR-018, D5, D6).
 *
 * This module decides; it never fetches. Callers (the guards and actions)
 * supply the verified actor and the household state, and the DB triggers
 * enforce the same "last parent" invariant as a backstop — the checks here
 * exist so the UI and the actions can refuse early with a precise reason.
 *
 * Phase 3 adds the app's first RECORD-dependent rule (FR-351, R323): a member
 * may resolve only their own occurrences and claim up-for-grabs only for
 * themselves, so `PermissionContext` carries the target. On the client that
 * decision is affordance ONLY — FR-350 puts the gate on the server "rather than
 * by hiding controls", so the completion circle stays rendered and tappable and
 * nothing here ever pre-refuses a tap.
 *
 * Phase 4 adds the second record-dependent rule (FR-424, R410): a redemption
 * names the Profile it credits, and `mayRedeemFor` is FR-351 applied to that
 * noun — a member for themselves, a parent for anyone. The four things a parent
 * does TO the economy (FR-419, FR-435) are plain parent-only verbs.
 */

import type { Category, Role } from "./types";

export type Operation =
  | "read"
  | "punch_in"
  | "punch_out"
  | "manage_categories"
  | "reorder_categories"
  | "delete_category"
  | "upload_avatar"
  | "update_settings"
  | "set_pin"
  | "clear_pin"
  // Phase 3's verbs, split by FR-389: the first two are a parent's, the last
  // two are open to any punched-in Profile within FR-351's ownership rule.
  | "manage_tasks"
  | "manage_task_box"
  | "resolve_occurrence"
  | "reorder_routines"
  // Phase 4's verbs (R410): the first four are a parent's (FR-419, FR-435); the
  // last two are decided by `mayRedeemFor` on the Profile the redemption credits.
  | "reward.create"
  | "reward.edit"
  | "reward.delete"
  | "stars.adjust"
  | "reward.redeem"
  | "reward.unredeem"
  // Phase 5's verbs (005 FR-534, R505): every list write is any punched-in
  // Profile's; the one gate is a Parents only list, decided on `parentsOnly`.
  | "list.create"
  | "list.write"
  // Phase 6's verbs (006 FR-639, FR-640): meals and recipes are any punched-in
  // Profile's, like lists; a mealtime's name and colour are a household setting,
  // and a parent's, like a Label's.
  | "meal.write"
  | "recipe.write"
  | "mealtime.edit";

/**
 * The record a target-aware operation touches (FR-351) — the first rule in this
 * app whose answer is not settled by the actor's role alone.
 *
 * A routine reorder names the column's Profile as `assigneeId` and is never up
 * for grabs; a resolution names the occurrence's own chain owner.
 */
export interface OccurrenceTarget {
  /** FR-365: an up-for-grabs task carries no assignee and belongs to nobody. */
  upForGrabs: boolean;
  /** The chain OWNER; null on an unclaimed up-for-grabs occurrence (FR-353). */
  assigneeId: string | null;
  /**
   * The Profile this write would credit — the claim on a completion, the stored
   * credit on an undo. Absent means the credit is the chain owner (FR-368).
   */
  creditProfileId?: string | null;
}

export interface PermissionContext {
  /** Whether the household currently has at least one profile with role `parent`. */
  householdHasParent: boolean;
  /** Read only by the target-aware operations; every other one ignores it. */
  target?: OccurrenceTarget;
  /**
   * The Profile a redemption or unredemption would credit (FR-424) — read only
   * by `reward.redeem` and `reward.unredeem`; every other operation ignores it.
   */
  redeemFor?: string;
  /**
   * Whether the list a write is about is Parents only (005 FR-514) — read only
   * by `list.write`; every other operation ignores it. Absent means "a plain
   * list", which every punched-in Profile may write.
   */
  parentsOnly?: boolean;
}

/** A member's answer depends on the record, so the actor carries its identity. */
export interface PermissionActor {
  role: Role;
  /** Absent when the caller knows only the role — such an actor owns nothing. */
  profileId?: string;
}

export type Decision = { allowed: true } | { allowed: false; reason: "NO_ACTOR" | "FORBIDDEN" };

/** Anyone signed in can read and can punch in or out — no actor needed. */
const OPEN_OPERATIONS: ReadonlySet<Operation> = new Set<Operation>([
  "read",
  "punch_in",
  "punch_out",
]);

/**
 * What an actor-less request may do:
 * - `set_pin`: FR-018 keeps PIN setup reachable when nobody is punched in
 *   (residual risk recorded in the spec assumptions, D5).
 * - `manage_categories`: only while the household has no parent at all, so a
 *   fresh household can create its first parent profile (bootstrap, D6).
 */
function decideWithoutActor(op: Operation, ctx: PermissionContext): Decision {
  if (op === "set_pin") return { allowed: true };
  if (op === "manage_categories" && !ctx.householdHasParent) return { allowed: true };
  return { allowed: false, reason: "NO_ACTOR" };
}

/** The operations FR-389 opens to a member, each within FR-351's ownership rule. */
const TARGET_AWARE: ReadonlySet<Operation> = new Set<Operation>([
  "resolve_occurrence",
  "reorder_routines",
]);

/**
 * FR-351, stated once: a member may resolve an occurrence whose chain owner is
 * their own Profile, and may claim an unclaimed up-for-grabs occurrence only
 * crediting themselves. A parent never reaches here — a parent may do any of it
 * for anyone.
 */
export function ownsOccurrence(
  actor: { profileId: string },
  target: OccurrenceTarget,
): boolean {
  if (target.upForGrabs) {
    return target.assigneeId === null && target.creditProfileId === actor.profileId;
  }
  const credited = target.creditProfileId ?? actor.profileId;
  return target.assigneeId === actor.profileId && credited === actor.profileId;
}

/** The two verbs FR-424 decides on the Profile a redemption credits. */
const REDEEM_OPERATIONS: ReadonlySet<Operation> = new Set<Operation>([
  "reward.redeem",
  "reward.unredeem",
]);

/**
 * FR-424, stated once: a member may redeem (and unredeem, FR-431) only for
 * their own Profile, a parent for anyone, and nobody without an actor. An actor
 * whose identity the caller does not know owns no Profile, so a member without
 * a `profileId` is refused — a redemption is never anonymous.
 */
export function mayRedeemFor(actor: PermissionActor | null, targetCategoryId: string): boolean {
  if (actor === null) return false;
  if (actor.role === "parent") return true;
  return actor.profileId !== undefined && actor.profileId === targetCategoryId;
}

/** FR-351 for a member: the record must be theirs, and the caller must have supplied one. */
function memberOwnsTarget(actor: PermissionActor, ctx: PermissionContext): boolean {
  if (ctx.target === undefined || actor.profileId === undefined) return false;
  return ownsOccurrence({ profileId: actor.profileId }, ctx.target);
}

/** FR-424 for a member: the redemption must credit them, and the caller must have named a Profile. */
function memberMayRedeem(actor: PermissionActor, ctx: PermissionContext): boolean {
  return ctx.redeemFor !== undefined && mayRedeemFor(actor, ctx.redeemFor);
}

/**
 * 005 FR-534 / FR-535 for a member: any list is theirs to write — the Tasks and
 * Rewards tabs' parent-only verbs have no counterpart here — except a Parents
 * only one, which a member never sees and never touches (R505).
 */
export function memberMayWriteList(op: Operation, ctx: Pick<PermissionContext, "parentsOnly">): boolean {
  if (op === "list.create") return true;
  return op === "list.write" && ctx.parentsOnly !== true;
}

/** 006 FR-639 / FR-640 for a member: meals and recipes are theirs; a mealtime's name and colour are not. */
function memberMayWriteMeals(op: Operation): boolean {
  return op === "meal.write" || op === "recipe.write";
}

const MEAL_OPERATIONS: ReadonlySet<Operation> = new Set<Operation>(["meal.write", "recipe.write", "mealtime.edit"]);

/**
 * A member is refused every verb FR-389 and R410 reserve, and every target-aware
 * one whose record is not theirs — including one the caller supplied no record
 * for, since a decision with nothing to own cannot be an allowance. Lists are
 * the exception (005 FR-534): open, save for a Parents only list.
 */
function decideForMember(
  actor: PermissionActor,
  op: Operation,
  ctx: PermissionContext,
): Decision {
  let allowed = false;
  if (REDEEM_OPERATIONS.has(op)) allowed = memberMayRedeem(actor, ctx);
  else if (TARGET_AWARE.has(op)) allowed = memberOwnsTarget(actor, ctx);
  else if (MEAL_OPERATIONS.has(op)) allowed = memberMayWriteMeals(op);
  else allowed = memberMayWriteList(op, ctx);
  return allowed ? { allowed: true } : { allowed: false, reason: "FORBIDDEN" };
}

export function can(
  actor: PermissionActor | null,
  op: Operation,
  ctx: PermissionContext,
): Decision {
  if (OPEN_OPERATIONS.has(op)) return { allowed: true };
  if (actor === null) return decideWithoutActor(op, ctx);
  return actor.role === "parent" ? { allowed: true } : decideForMember(actor, op, ctx);
}

/** Labels can never count as parents, whatever their `role` column says. */
function isParentProfile(category: Pick<Category, "isProfile" | "role">): boolean {
  return category.isProfile && category.role === "parent";
}

/**
 * True when `target` is a parent profile and no OTHER profile in `all` is.
 * `all` is the household's category list; the target need not be in it.
 */
export function isLastParent(
  target: Pick<Category, "id" | "isProfile" | "role">,
  all: readonly Pick<Category, "id" | "isProfile" | "role">[],
): boolean {
  if (!isParentProfile(target)) return false;
  return !all.some((other) => other.id !== target.id && isParentProfile(other));
}

export function canDelete(
  target: Pick<Category, "id" | "isProfile" | "role">,
  all: readonly Pick<Category, "id" | "isProfile" | "role">[],
): { allowed: true } | { allowed: false; reason: "LAST_PARENT" } {
  return isLastParent(target, all) ? { allowed: false, reason: "LAST_PARENT" } : { allowed: true };
}

/** Promotion is always fine; demotion is refused when it would leave no parent. */
export function canChangeRole(
  target: Pick<Category, "id" | "isProfile" | "role">,
  newRole: Role,
  all: readonly Pick<Category, "id" | "isProfile" | "role">[],
): { allowed: true } | { allowed: false; reason: "LAST_PARENT" } {
  if (newRole === "parent") return { allowed: true };
  return canDelete(target, all);
}

/** The first profile in a parent-less household is always a parent (D6). */
export function bootstrapRole(input: { role?: Role }, ctx: PermissionContext): Role {
  if (!ctx.householdHasParent) return "parent";
  return input.role ?? "member";
}
