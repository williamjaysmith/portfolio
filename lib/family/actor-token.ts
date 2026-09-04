/**
 * Mint and verify the punch-in ("actor") token that lives in the
 * `family_actor` cookie (D11, research F9).
 *
 * Pure: no cookies, no env, no clock of its own — the caller passes the
 * secret and (optionally) `now`, which keeps this fully unit-testable.
 * `verifyActorToken` never throws: every failure — expired, bad signature,
 * wrong secret, wrong audience, wrong algorithm, malformed, missing claims —
 * collapses to `null` so the caller cannot distinguish them (and neither can
 * an attacker).
 */

import { SignJWT, jwtVerify } from "jose";
import type { Actor, Role } from "./types";

export const ACTOR_AUDIENCE = "family-actor";

const ALGORITHM = "HS256";

export interface ActorClaims {
  profileId: string;
  /** The Supabase account the punch-in happened under; guards compare it to the session. */
  userId: string;
  householdId: string;
  role: Role;
}

function keyFor(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function epochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Sign `{ sub: profileId, uid, hid, role, aud, iat, exp }` with HS256.
 * `expiresAt` is epoch milliseconds, always a whole second (matches `exp`).
 */
export async function signActorToken(
  claims: ActorClaims,
  secret: string,
  ttlSeconds: number,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: number }> {
  const issuedAt = epochSeconds(now);
  const exp = issuedAt + ttlSeconds;
  const token = await new SignJWT({ uid: claims.userId, hid: claims.householdId, role: claims.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.profileId)
    .setAudience(ACTOR_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .sign(keyFor(secret));
  return { token, expiresAt: exp * 1000 };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRole(value: unknown): value is Role {
  return value === "parent" || value === "member";
}

/** Shape-check the verified payload; jose has already checked signature, alg, aud and exp. */
function toActor(payload: Record<string, unknown>): Actor | null {
  const { sub, uid, hid, role, exp } = payload;
  if (!isNonEmptyString(sub) || !isNonEmptyString(uid) || !isNonEmptyString(hid)) return null;
  if (!isRole(role) || typeof exp !== "number") return null;
  return { profileId: sub, userId: uid, householdId: hid, role, expiresAt: exp * 1000 };
}

export async function verifyActorToken(
  token: string,
  secret: string,
  now?: Date,
): Promise<Actor | null> {
  try {
    const { payload } = await jwtVerify(token, keyFor(secret), {
      algorithms: [ALGORITHM],
      audience: ACTOR_AUDIENCE,
      currentDate: now,
    });
    return toActor(payload);
  } catch {
    // jose throws a JOSEError subclass for expiry (JWTExpired), signature
    // (JWSSignatureVerificationFailed), alg (JOSEAlgNotAllowed), audience
    // (JWTClaimValidationFailed) and malformed input (JWSInvalid/JWTInvalid).
    // Anything else (an unusable key, a broken runtime) is equally "no actor",
    // so nothing is rethrown and nothing is distinguished.
    return null;
  }
}

/**
 * Whole seconds until the actor expires, rounded down so a client timer based
 * on it always fires before the cookie actually lapses. Never negative.
 */
export function ttlSecondsOf(actor: Actor, now: Date = new Date()): number {
  return Math.max(0, Math.floor((actor.expiresAt - now.getTime()) / 1000));
}
