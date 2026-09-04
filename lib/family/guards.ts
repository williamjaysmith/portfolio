import "server-only";

/**
 * The authorization layer every /family server action goes through (D10).
 *
 *   requireMember  — a verified Supabase session that is on the allowlist
 *   requireActor   — plus a valid punch-in cookie bound to THIS session
 *   requireParent  — plus the profile is, per the database right now, a parent
 *
 * The JWT in the cookie is a hint; the database is the truth. Guards throw
 * `ActionFailure` and `runAction` turns that into `{ ok: false }`.
 */

import { cache } from "react";

import { clearActor, readActor } from "./actor";
import { ActionFailure } from "./errors";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import type { Actor, Role } from "./types";

export interface Member {
  user: { id: string; email: string | null };
  householdId: string;
}

/** Columns `requireParent` re-reads — nothing personal, nothing PIN-related. */
interface ProfileCheckRow {
  id: string;
  household_id: string;
  role: Role;
  is_profile: boolean;
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isFailure(error: unknown, code: ActionFailure["code"]): boolean {
  return error instanceof ActionFailure && error.code === code;
}

/**
 * Memoised per request (React `cache`), so a layout and the actions it renders
 * share one `getClaims()` + one RPC round-trip.
 */
export const requireMember = cache(async (): Promise<Member> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims) throw new ActionFailure("NOT_AUTHENTICATED");

  const fam = supabase.schema("family");
  const mine = await fam.rpc("my_household");
  if (mine.error) throw new ActionFailure("UNAVAILABLE");
  let householdId = asId(mine.data);

  if (!householdId) {
    // First sign-in, or allowlisted after the account already existed.
    const claimed = await fam.rpc("claim_membership");
    if (claimed.error) throw new ActionFailure("UNAVAILABLE");
    householdId = asId(claimed.data);
  }
  if (!householdId) throw new ActionFailure("NOT_A_MEMBER");

  return {
    user: { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null },
    householdId,
  };
});

/** Non-throwing variant for layouts: `null` when signed out or not a member. */
export async function getMember(): Promise<Member | null> {
  try {
    return await requireMember();
  } catch (error) {
    if (isFailure(error, "NOT_AUTHENTICATED") || isFailure(error, "NOT_A_MEMBER")) return null;
    throw error;
  }
}

/**
 * A punch-in cookie is only honoured for the account and household it was
 * minted under — a cookie left behind by a previous sign-in on a shared device
 * is worthless to the next user.
 */
export async function requireActor(): Promise<Actor> {
  const member = await requireMember();
  const actor = await readActor();
  if (!actor || actor.userId !== member.user.id || actor.householdId !== member.householdId) {
    throw new ActionFailure("NO_ACTOR");
  }
  return actor;
}

async function readActorProfile(actor: Actor): Promise<ProfileCheckRow | null> {
  const { data, error } = await createAdminClient()
    .schema("family")
    .from("categories")
    .select("id, household_id, role, is_profile")
    .eq("id", actor.profileId)
    .maybeSingle();
  if (error) throw new ActionFailure("UNAVAILABLE");

  const row = data as ProfileCheckRow | null;
  if (!row || !row.is_profile || row.household_id !== actor.householdId) return null;
  return row;
}

async function clearActorQuietly(): Promise<void> {
  try {
    await clearActor();
  } catch {
    // Not in a cookie-writable context (a Server Component render). The cookie
    // is rejected on every subsequent check anyway and expires on its own.
  }
}

/**
 * Re-reads the profile row: a parent demoted or deleted on another device loses
 * the power immediately, not when the cookie expires. The returned actor
 * carries the database role.
 */
export async function requireParent(): Promise<Actor> {
  const actor = await requireActor();
  const profile = await readActorProfile(actor);
  if (!profile) {
    await clearActorQuietly();
    throw new ActionFailure("NO_ACTOR");
  }
  if (profile.role !== "parent") throw new ActionFailure("FORBIDDEN");
  return { ...actor, role: profile.role };
}

/**
 * D6 bootstrap: a household with no parent profile yet lets any signed-in
 * member act without punching in, so the first parent can be created. Closed
 * the moment a parent exists. A member actor is still refused (FORBIDDEN).
 */
export async function requireParentOrBootstrap(): Promise<{
  actor: Actor | null;
  bootstrap: boolean;
}> {
  const member = await requireMember();
  try {
    return { actor: await requireParent(), bootstrap: false };
  } catch (error) {
    if (isFailure(error, "NO_ACTOR") && !(await householdHasParent(member.householdId))) {
      return { actor: null, bootstrap: true };
    }
    throw error;
  }
}

async function householdHasParent(householdId: string): Promise<boolean> {
  const { count, error } = await createAdminClient()
    .schema("family")
    .from("categories")
    .select("id", { head: true, count: "exact" })
    .eq("household_id", householdId)
    .eq("is_profile", true)
    .eq("role", "parent");
  if (error) throw new ActionFailure("UNAVAILABLE");
  return (count ?? 0) > 0;
}
