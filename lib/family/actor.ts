import "server-only";

/**
 * The punch-in cookie (D11). The cookie is the ONLY source of "who is punched
 * in" — never a profile id from a request body.
 *
 * Write and clear only from Server Actions / Route Handlers; Next.js cannot set
 * cookies while rendering a Server Component.
 */

import { cookies } from "next/headers";

import { signActorToken, verifyActorToken, type ActorClaims } from "./actor-token";
import { serverSecrets } from "./env";
import type { Actor } from "./types";

const ACTOR_COOKIE = "family_actor";

/**
 * Identical on every write AND on clear: a `Path=/family` cookie is not
 * replaced by a `Path=/` deletion, which is why `clearActor` never uses
 * `cookies().delete()`. `secure` is off outside production because Safari
 * drops Secure cookies on http://localhost.
 */
function cookieAttributes() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/family",
  };
}

/** `null` for a missing, expired, tampered or foreign cookie — no distinction is signalled. */
export async function readActor(): Promise<Actor | null> {
  const token = (await cookies()).get(ACTOR_COOKIE)?.value;
  if (!token) return null;
  return verifyActorToken(token, serverSecrets().actorSecret);
}

export async function writeActor(
  claims: ActorClaims,
  ttlSeconds: number,
): Promise<{ expiresAt: number }> {
  const { token, expiresAt } = await signActorToken(
    claims,
    serverSecrets().actorSecret,
    ttlSeconds,
  );
  (await cookies()).set(ACTOR_COOKIE, token, { ...cookieAttributes(), maxAge: ttlSeconds });
  return { expiresAt };
}

export async function clearActor(): Promise<void> {
  (await cookies()).set(ACTOR_COOKIE, "", { ...cookieAttributes(), maxAge: 0 });
}
