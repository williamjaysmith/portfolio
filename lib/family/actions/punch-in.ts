"use server";

/**
 * Punch-in: how someone becomes the actor (contracts → "Punch-in").
 *
 * The PIN is checked inside Postgres by `family.verify_pin`, so no hash ever
 * reaches this process. The verified session's user id is passed explicitly
 * because the function runs under the service role, where `auth.uid()` is
 * NULL (D3).
 */

import { clearActor, readActor, writeActor } from "../actor";
import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireActor, requireMember } from "../guards";
import type { Actor, ActorSession } from "../types";
import { pinSchema, parseOrThrow } from "../validation";
import { adminFamily, loadProfile, mapDbError, punchOutTtlSeconds, toActorSession } from "./shared";

/** `family.verify_pin` answers with a reason so the sheet can explain itself. */
type VerifyReason = "ok" | "bad_pin" | "locked" | "no_pin" | "forbidden" | "not_found";

const REASON_ERRORS: Record<Exclude<VerifyReason, "ok">, ActionFailure["code"]> = {
  bad_pin: "BAD_PIN",
  locked: "PIN_LOCKED",
  no_pin: "NO_PIN",
  // "Not a member" and "no such profile" are deliberately indistinguishable:
  // a wrong guess must not reveal that a profile exists.
  forbidden: "NOT_FOUND",
  not_found: "NOT_FOUND",
};

/** `returns table (...)` arrives as a one-row array. */
function firstRow(data: unknown): { ok: boolean; reason: VerifyReason } | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const { ok, reason } = row as { ok?: unknown; reason?: unknown };
  if (typeof ok !== "boolean" || typeof reason !== "string") return null;
  return { ok, reason: reason as VerifyReason };
}

export async function punchIn(profileId: string, pin: string): Promise<ActionResult<ActorSession>> {
  return runAction(async () => {
    // A punch-in IS how you become an actor, so membership is the only guard.
    const { user, householdId } = await requireMember();
    const candidate = parseOrThrow(pinSchema, pin);

    const { data, error } = await adminFamily().rpc("verify_pin", {
      p_user_id: user.id,
      p_profile: profileId,
      p_candidate: candidate,
    });
    if (error) throw mapDbError(error);

    const result = firstRow(data);
    if (!result) throw new ActionFailure("UNAVAILABLE");
    if (!result.ok) {
      throw new ActionFailure(REASON_ERRORS[result.reason as Exclude<VerifyReason, "ok">] ?? "UNAVAILABLE");
    }

    const profile = await loadProfile(householdId, profileId);
    if (!profile) throw new ActionFailure("NOT_FOUND");

    const ttlSeconds = await punchOutTtlSeconds(householdId);
    const { expiresAt } = await writeActor(
      { profileId, userId: user.id, householdId, role: profile.role },
      ttlSeconds,
    );

    const actor: Actor = {
      profileId,
      userId: user.id,
      householdId,
      role: profile.role,
      expiresAt,
    };
    return toActorSession(actor, profile);
  });
}

/** Idempotent, and deliberately unguarded beyond a session: leaving is always allowed. */
export async function punchOut(): Promise<ActionResult<null>> {
  return runAction(async () => {
    await clearActor();
    return null;
  });
}

/**
 * The shell calls this on every load and after a tab wakes up. A cookie whose
 * profile has since been deleted is cleared here, which is the "deleted while
 * punched in" edge case.
 */
export async function getActor(): Promise<ActionResult<ActorSession | null>> {
  return runAction(async () => {
    const { user, householdId } = await requireMember();
    const actor = await readActor();
    if (!actor || actor.userId !== user.id || actor.householdId !== householdId) return null;

    const profile = await loadProfile(householdId, actor.profileId);
    if (!profile) {
      await clearActor();
      return null;
    }
    return toActorSession({ ...actor, role: profile.role }, profile);
  });
}

/** Pushes the idle expiry forward — called by the heartbeat and after mutations. */
export async function extendActor(): Promise<ActionResult<ActorSession>> {
  return runAction(async () => {
    const actor = await requireActor();
    const profile = await loadProfile(actor.householdId, actor.profileId);
    if (!profile) {
      await clearActor();
      throw new ActionFailure("NO_ACTOR");
    }

    const ttlSeconds = await punchOutTtlSeconds(actor.householdId);
    const { expiresAt } = await writeActor(
      {
        profileId: actor.profileId,
        userId: actor.userId,
        householdId: actor.householdId,
        role: profile.role,
      },
      ttlSeconds,
    );
    return toActorSession({ ...actor, role: profile.role, expiresAt }, profile);
  });
}
