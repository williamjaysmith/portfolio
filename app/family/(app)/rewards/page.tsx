import type { Metadata } from "next";

import { getMember } from "@/lib/family/guards";
import { fetchRedemptions, fetchRewards, fetchStarBalances } from "@/lib/family/queries";
import { createClient } from "@/lib/family/supabase/server";
import type { Redemption, Reward, StarBalance } from "@/lib/family/types";

import { RewardsBoard } from "./components/RewardsBoard";

export const metadata: Metadata = { title: "Rewards" };

/**
 * The Rewards tab (004 T031, FR-444): the Phase 1 placeholder replaced, in the
 * same place behind the same tab, label and star icon. A server component
 * that performs the tab's **three** reads under the signed-in session (RLS,
 * the server client — never the admin client) and seeds each as
 * `initialData` for its own key (R407), so the wall tablet's first paint is
 * the tab itself with no loading state.
 *
 * None of the three is day-dependent, so — unlike the Tasks board — there is
 * no clock to read and no window to agree on: the rewards, the balances view
 * and every redemption, standing and reversed, are the whole tab.
 *
 * The layout above is the gate: with no member it is already redirecting the
 * whole render to sign-in or not-authorized, so this page only has to decline
 * to fetch, never to decide the door.
 *
 * **The degradation path (constitution §VI)** is the Tasks page's. There is no
 * `error.tsx` under `app/`, so a failing read would throw the whole route —
 * and until 024–027 are pushed to the hosted project these reads hit tables
 * that do not exist. So the reads are taken together and a failure renders an
 * honest unavailable state with the tab's chrome intact. `Promise.all` is what
 * makes it all-or-nothing: a tab built from balances that loaded and rewards
 * that did not would be a *wrong* tab, which is worse than no tab.
 */

/** Everything the three reads produce, or nothing at all. */
interface RewardsData {
  rewards: Reward[];
  balances: StarBalance[];
  redemptions: Redemption[];
}

async function loadRewards(householdId: string): Promise<RewardsData | null> {
  try {
    const supabase = await createClient();
    const [rewards, balances, redemptions] = await Promise.all([
      fetchRewards(supabase, householdId),
      fetchStarBalances(supabase, householdId),
      fetchRedemptions(supabase, householdId),
    ]);
    return { rewards, balances, redemptions };
  } catch (error) {
    // Logged as a string server-side and never surfaced verbatim, exactly as
    // the action layer treats a database failure.
    console.error("[family] the rewards tab could not be read", error);
    return null;
  }
}

/** The honest empty-handed state: the tab, named, saying what is wrong. */
function RewardsUnavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-(--fam-edge-inset) text-center">
      <h1 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title) text-(--fam-text-primary)">
        Rewards
      </h1>
      <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        Rewards can&rsquo;t be loaded right now. Everything else still works.
      </p>
    </div>
  );
}

export default async function RewardsPage() {
  const member = await getMember();
  if (member === null) return null;

  const data = await loadRewards(member.householdId);
  if (data === null) return <RewardsUnavailable />;

  return (
    <RewardsBoard
      initialRewards={data.rewards}
      initialBalances={data.balances}
      initialRedemptions={data.redemptions}
    />
  );
}
