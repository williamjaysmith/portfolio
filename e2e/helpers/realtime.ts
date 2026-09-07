import { Client } from "pg";

import { localDatabaseUrl } from "./stack";

/**
 * 007 T016 — can this environment carry a live update at all? (FR-725, R710)
 *
 * During Phases 5 and 6 a browser on the local stack never landed a row in
 * `realtime.subscription`, while a Node client subscribed fine — an
 * environment gap, not an application defect. A suite that quietly passed in
 * that state would be worse than no suite, so the two-browser journeys ask
 * this first and skip with the reason printed when the answer is no.
 *
 * It answers a question and asserts nothing. It is the suite's only database
 * access, and it is a read.
 */

export interface LiveUpdateSupport {
  available: boolean;
  reason: string;
}

const NO_STACK = "the local Supabase stack is not running";
const NO_SUBSCRIPTION =
  "this stack does not deliver live updates to a browser — no realtime subscription was registered " +
  "after both pages had mounted (seen since Phase 5 with the local realtime image; verify on the " +
  "hosted project by hand)";

/** How many live subscriptions the database currently holds. `null` if it cannot be asked. */
export async function subscriptionCount(): Promise<number | null> {
  const url = await localDatabaseUrl();
  if (url === null) return null;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const { rows } = await client.query<{ count: string }>("select count(*)::text as count from realtime.subscription");
    return Number(rows[0]?.count ?? 0);
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Called once both browsers have a `/family` page mounted: if the database
 * holds no subscription by then, nothing this suite does will make one appear.
 */
export async function liveUpdateSupport(): Promise<LiveUpdateSupport> {
  const count = await subscriptionCount();
  if (count === null) return { available: false, reason: NO_STACK };
  return count > 0 ? { available: true, reason: "" } : { available: false, reason: NO_SUBSCRIPTION };
}
