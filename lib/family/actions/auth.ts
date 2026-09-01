"use server";

/**
 * Sign-out (contracts/server-actions.md → `signOut`).
 *
 * No guard: leaving needs no actor and no membership. The punch-in cookie is
 * cleared FIRST so parent A's actor never survives into member B's session on
 * a shared tablet (D11). `redirect()` throws a framework signal, so it stays
 * outside the try/catch.
 */

import { redirect } from "next/navigation";

import { clearActor } from "../actor";
import { createClient } from "../supabase/server";

export async function signOut(): Promise<never> {
  try {
    await clearActor();
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // The sign-in page is still the right destination: proxy.ts refreshes or
    // rejects whatever session is left, and the page re-checks membership.
  }
  redirect("/family/sign-in");
}
