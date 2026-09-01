import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { clearActor } from "@/lib/family/actor";
import { createClient } from "@/lib/family/supabase/server";

/**
 * The OAuth landing point (FR-003).
 *
 * Two things happen here and nowhere else: the PKCE code becomes a session,
 * and the account is matched against the household allowlist. An account that
 * is not on it is signed straight back out — it never reaches a page that
 * could render household data.
 *
 * There is deliberately no `next` parameter: an attacker-supplied redirect
 * target on an auth callback is an open redirect, and the app has exactly one
 * destination anyway.
 */

const SIGN_IN = "/family/sign-in";
const NOT_AUTHORIZED = "/family/not-authorized";
const HOME = "/family/calendar";

/** Behind a proxy the forwarded host is the one the browser actually used. */
function originOf(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  return forwardedHost
    ? `${request.nextUrl.protocol}//${forwardedHost}`
    : request.nextUrl.origin;
}

function destination(request: NextRequest, path: string): URL {
  return new URL(path, originOf(request));
}

type Callback =
  | { kind: "code"; code: string }
  | { kind: "reject"; to: string };

/** What the provider sent back, before anything is exchanged. */
function readCallback(params: URLSearchParams): Callback {
  // Google (or the Before-User-Created hook) refused: not our household.
  if (params.get("error")) return { kind: "reject", to: NOT_AUTHORIZED };

  const code = params.get("code");
  if (!code) return { kind: "reject", to: SIGN_IN };

  return { kind: "code", code };
}

/**
 * Binds this account to its allowlist row on first sign-in; null means the
 * address is not on the list (D1), which is the only thing the caller can act
 * on — a failed claim and an unlisted address end the same way.
 */
async function claimHousehold(supabase: SupabaseClient): Promise<string | null> {
  const claimed = await supabase.schema("family").rpc("claim_membership");
  if (claimed.error) return null;
  return typeof claimed.data === "string" ? claimed.data : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const go = (path: string) => NextResponse.redirect(destination(request, path));

  const callback = readCallback(request.nextUrl.searchParams);
  if (callback.kind === "reject") return go(callback.to);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
  if (error) return go(`${SIGN_IN}?error=oauth`);

  const householdId = await claimHousehold(supabase);
  if (householdId) return go(HOME);

  // Not on the allowlist: drop any actor cookie and end the session here.
  await clearActor();
  await supabase.auth.signOut();
  return go(NOT_AUTHORIZED);
}
