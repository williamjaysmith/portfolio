/**
 * Pure authorization rules for /family (FR-015, FR-018, D5, D6).
 *
 * This module decides; it never fetches. Callers (the guards and actions)
 * supply the verified actor and the household state, and the DB triggers
 * enforce the same "last parent" invariant as a backstop — the checks here
 * exist so the UI and the actions can refuse early with a precise reason.
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
  | "clear_pin";

export interface PermissionContext {
  /** Whether the household currently has at least one profile with role `parent`. */
  householdHasParent: boolean;
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

export function can(
  actor: { role: Role } | null,
  op: Operation,
  ctx: PermissionContext,
): Decision {
  if (OPEN_OPERATIONS.has(op)) return { allowed: true };
  if (actor === null) return decideWithoutActor(op, ctx);
  return actor.role === "parent" ? { allowed: true } : { allowed: false, reason: "FORBIDDEN" };
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
