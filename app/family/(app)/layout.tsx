import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { readActor } from "@/lib/family/actor";
import { ttlSecondsOf } from "@/lib/family/actor-token";
import { ActionFailure } from "@/lib/family/errors";
import { requireMember, type Member } from "@/lib/family/guards";
import { fetchCategories, fetchHousehold, fetchSettings } from "@/lib/family/queries";
import { createClient } from "@/lib/family/supabase/server";
import type {
  Actor,
  ActorSession,
  Category,
  Household,
  HouseholdSettings,
} from "@/lib/family/types";

import { AppShell } from "./components/AppShell";
import { FamilyProvider, type FamilyInitialData } from "./components/FamilyProvider";

/**
 * The gate for everything inside the shell.
 *
 * `proxy.ts` already bounced signed-out visitors, but it is explicitly NOT the
 * authorization boundary (research R1) — this re-checks, and so does every
 * server action underneath. Household data is fetched under the user's own
 * session (RLS), never with the admin client.
 */

const SIGN_IN = "/family/sign-in";
const NOT_AUTHORIZED = "/family/not-authorized";

type GateResult =
  | { kind: "ok"; initial: FamilyInitialData }
  | { kind: "redirect"; to: string };

interface HouseholdData {
  household: Household;
  settings: HouseholdSettings;
  categories: Category[];
}

/**
 * The three rows the shell renders from. `null` means RLS handed a member an
 * empty household — the row is gone, so there is nothing to be a member of.
 */
async function loadHousehold(householdId: string): Promise<HouseholdData | null> {
  const supabase = await createClient();
  const [household, settings, categories] = await Promise.all([
    fetchHousehold(supabase, householdId),
    fetchSettings(supabase, householdId),
    fetchCategories(supabase, householdId),
  ]);
  if (!household || !settings) return null;
  return { household, settings, categories };
}

/**
 * A cookie only still speaks for someone when it was minted for THIS signed-in
 * account, in THIS household, and has not run out (D11/D12). A cookie that
 * outlived a sign-out — or came from another account on a shared tablet — must
 * not punch anybody in.
 */
function cookieIsCurrent(cookie: Actor, member: Member, ttlSeconds: number): boolean {
  return (
    cookie.userId === member.user.id &&
    cookie.householdId === member.householdId &&
    ttlSeconds > 0
  );
}

/**
 * The actor the client is told about, built from the cookie but described by
 * the profile row: a profile deleted while punched in leaves no actor at all.
 */
function toActorSession(
  cookie: Actor | null,
  categories: readonly Category[],
  member: Member,
): ActorSession | null {
  if (!cookie) return null;
  const ttlSeconds = ttlSecondsOf(cookie);
  const profile = categories.find((category) => category.id === cookie.profileId);
  if (!profile || !cookieIsCurrent(cookie, member, ttlSeconds)) return null;

  return {
    profileId: profile.id,
    label: profile.label,
    color: profile.color,
    role: profile.role,
    expiresAt: new Date(cookie.expiresAt).toISOString(),
    ttlSeconds,
  };
}

/**
 * Which door a failed gate leads to: an account that is simply not on the
 * allowlist gets told so, everything else (no session, expired, unavailable)
 * gets the sign-in page.
 */
function redirectFor(error: unknown): GateResult {
  if (error instanceof ActionFailure && error.code === "NOT_A_MEMBER") {
    return { kind: "redirect", to: NOT_AUTHORIZED };
  }
  return { kind: "redirect", to: SIGN_IN };
}

async function loadShell(): Promise<GateResult> {
  try {
    const member = await requireMember();
    const data = await loadHousehold(member.householdId);
    if (!data) return { kind: "redirect", to: NOT_AUTHORIZED };

    return {
      kind: "ok",
      initial: {
        householdId: member.householdId,
        ...data,
        actor: toActorSession(await readActor(), data.categories, member),
        userEmail: member.user.email,
      },
    };
  } catch (error) {
    return redirectFor(error);
  }
}

export default async function FamilyAppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const result = await loadShell();
  // redirect() throws a framework signal, so it stays outside the try/catch.
  if (result.kind === "redirect") redirect(result.to);

  return (
    <FamilyProvider initial={result.initial}>
      <AppShell>{children}</AppShell>
    </FamilyProvider>
  );
}
