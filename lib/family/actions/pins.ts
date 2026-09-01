"use server";

/**
 * PIN management (FR-018, SC-010, D5).
 *
 * `setProfilePin` is deliberately NOT parent-gated. If every profile lacked a
 * PIN, requiring an actor to set one would leave the household permanently
 * read-only — a signed-in account on the allowlist is already proof of family
 * membership. It IS refused for a punched-in member, because a child who has
 * identified themselves must not be able to take over a parent's profile.
 *
 * The residual risk (anyone standing at a signed-in tablet with nobody punched
 * in can set a PIN) is recorded in spec.md → Assumptions.
 */

import { readActor } from "../actor";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireMember, requireParent } from "../guards";
import type { Role } from "../types";
import { parseOrThrow, pinSchema } from "../validation";
import { adminFamily, mapDbError, touchActor } from "./shared";

/** The database role of the punched-in profile, or `null` when nobody is. */
async function currentActorRole(userId: string, householdId: string): Promise<Role | null> {
  const actor = await readActor();
  if (!actor || actor.userId !== userId || actor.householdId !== householdId) return null;

  const { data, error } = await adminFamily()
    .from("categories")
    .select("id, role, is_profile, household_id")
    .eq("id", actor.profileId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);

  const row = data as { role: Role; is_profile: boolean } | null;
  if (!row || !row.is_profile) return null;
  return row.role;
}

export async function setProfilePin(
  profileId: string,
  pin: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { user, householdId } = await requireMember();
    if ((await currentActorRole(user.id, householdId)) === "member") {
      throw new ActionFailure("FORBIDDEN");
    }
    const newPin = parseOrThrow(pinSchema, pin);

    const { error } = await adminFamily().rpc("set_pin", {
      p_user_id: user.id,
      p_profile: profileId,
      p_pin: newPin,
    });
    if (error) throw mapDbError(error);
    return null;
  });
}

/** Removing a PIN makes a profile unselectable (FR-017), so it stays parent-only. */
export async function clearProfilePin(profileId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireParent();

    const { error } = await adminFamily().rpc("clear_pin", {
      p_user_id: actor.userId,
      p_profile: profileId,
    });
    if (error) throw mapDbError(error);

    await touchActor(actor);
    return null;
  });
}
