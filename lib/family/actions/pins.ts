"use server";

/**
 * PIN management (FR-018, SC-010).
 *
 * `setProfilePin` is gated on WHERE THE HOUSEHOLD IS, not on a fixed rule:
 *
 *   no parent has a PIN yet  → a signed-in member may set one, no actor needed
 *   a parent has a PIN       → a punched-in PARENT is required
 *
 * The first case is the no-lockout rule: requiring an actor when nobody can
 * punch in would leave the household permanently read-only, and a signed-in
 * account on the allowlist is already proof of family membership. The second
 * closes the window as soon as it can be closed — once a parent can identify
 * themselves, a child (or a visitor) at the always-signed-in tablet can no
 * longer reset a parent's PIN and take over their profile.
 *
 * A punched-in member is refused in both cases (FR-015).
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

/**
 * Whether anyone who could authorise this is able to punch in yet. While the
 * answer is no, the household would otherwise be stuck: SC-010 says it must be
 * able to restore itself without developer intervention.
 */
async function aParentCanPunchIn(householdId: string): Promise<boolean> {
  const { count, error } = await adminFamily()
    .from("categories")
    .select("id", { head: true, count: "exact" })
    .eq("household_id", householdId)
    .eq("is_profile", true)
    .eq("role", "parent")
    .eq("has_pin", true);
  if (error) throw mapDbError(error);
  return (count ?? 0) > 0;
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

    // Actor-less is allowed only while no parent could punch in to do it.
    if (!actor && (await aParentCanPunchIn(householdId))) {
      throw new ActionFailure("NO_ACTOR");
    }

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
