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
import type { Actor } from "../types";
import { parseOrThrow, pinSchema } from "../validation";
import { adminFamily, loadProfile, mapDbError, touchActor } from "./shared";

/**
 * The punched-in actor, carrying the role the DATABASE gives it right now
 * (D10) — or `null` when nobody is punched in on this device.
 */
async function currentActor(userId: string, householdId: string): Promise<Actor | null> {
  const actor = await readActor();
  if (!actor || actor.userId !== userId || actor.householdId !== householdId) return null;

  const profile = await loadProfile(householdId, actor.profileId);
  if (!profile) return null;
  return { ...actor, role: profile.role };
}

/**
 * A profile id is not a capability. Handed straight to `set_pin`/`clear_pin`,
 * a REAL id from another household comes back 42501 → FORBIDDEN while an id
 * that names nothing comes back P0002 → NOT_FOUND: the difference alone tells
 * a prober which ids exist. Scoping the lookup to the caller's own household
 * makes the two indistinguishable.
 */
async function requireHouseholdProfile(householdId: string, profileId: string): Promise<void> {
  if (!(await loadProfile(householdId, profileId))) throw new ActionFailure("NOT_FOUND");
}

export async function setProfilePin(
  profileId: string,
  pin: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { user, householdId } = await requireMember();
    // Refused for a member actor whatever the id is, so this answer is never
    // itself a signal about the id.
    const actor = await currentActor(user.id, householdId);
    if (actor?.role === "member") throw new ActionFailure("FORBIDDEN");

    const newPin = parseOrThrow(pinSchema, pin);
    await requireHouseholdProfile(householdId, profileId);

    const { error } = await adminFamily().rpc("set_pin", {
      p_user_id: user.id,
      p_profile: profileId,
      p_pin: newPin,
    });
    if (error) throw mapDbError(error);

    // Setting several PINs in a row is one task at the tablet: each success
    // pushes the idle expiry forward (FR-013). A no-op with nobody punched in.
    await touchActor(actor);
    return null;
  });
}

/** Removing a PIN makes a profile unselectable (FR-017), so it stays parent-only. */
export async function clearProfilePin(profileId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireParent();
    await requireHouseholdProfile(actor.householdId, profileId);

    const { error } = await adminFamily().rpc("clear_pin", {
      p_user_id: actor.userId,
      p_profile: profileId,
    });
    if (error) throw mapDbError(error);

    await touchActor(actor);
    return null;
  });
}
