"use server";

/**
 * The household door, in and out (contracts/server-actions.md → `signIn`, `signOut`).
 *
 * The household shares ONE Supabase account (FR-002). Its address is
 * configuration the browser never sees; the only thing a person types is the
 * password, and **Supabase validates it** — this app never holds, hashes or
 * compares it. The account is only a door: who is *acting* is decided by the
 * punch-in PINs inside.
 *
 * `redirect()` throws a framework signal, so it always sits outside try/catch.
 */

import { redirect } from "next/navigation";

import { clearActor } from "../actor";
import { familyAccountEmail } from "../env";
import { fail, type ActionResult } from "../errors";
import { createClient } from "../supabase/server";

const HOME = "/family/calendar";

/**
 * The ONLY thing a failed sign-in ever says. A wrong password, an account that
 * does not exist, a disabled account and an empty field are indistinguishable
 * from out here: anything finer would tell a stranger which half they got
 * right, and the address is not theirs to learn.
 */
const WRONG_PASSWORD = "That password isn't right.";

function passwordFrom(formData: FormData): string {
  const entry = formData.get("password");
  return typeof entry === "string" ? entry : "";
}

/**
 * Signature is `useActionState`'s (`(previousState, formData) => nextState`),
 * so `app/family/(auth)/sign-in/SignInForm.tsx` can pass it straight to the
 * hook and the form still submits without JavaScript.
 *
 * The returned state carries a message and nothing else — never the password,
 * never the account address, never Supabase's own wording.
 */
export async function signIn(
  _previousState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const password = passwordFrom(formData);
  // Saves a round-trip and a rate-limit slot; the answer would be the same.
  if (password.length === 0) return fail("NOT_AUTHENTICATED", WRONG_PASSWORD);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: familyAccountEmail(),
      password,
    });
    if (error) return fail("NOT_AUTHENTICATED", WRONG_PASSWORD);
    // A new session means a new person at the tablet: whoever was punched in
    // before must not be inherited by whoever just opened the door (D11).
    await clearActor();
  } catch (cause) {
    // The message only (a missing env var, a network failure) — never the
    // caught object, which a future client could grow a request body onto.
    const reason = cause instanceof Error ? cause.message : "unknown error";
    console.error("[family] sign-in failed before Supabase answered:", reason);
    return fail("UNAVAILABLE");
  }
  redirect(HOME);
}

/**
 * No guard: leaving needs no actor and no membership. The punch-in cookie is
 * cleared FIRST so parent A's actor never survives into member B's session on
 * a shared tablet (D11).
 */
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
