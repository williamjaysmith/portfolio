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

/**
 * 012 — why this helper now clears before it counts.
 *
 * `realtime.subscription` rows OUTLIVE the socket that made them: twenty
 * survived the page that created them navigating to `about:blank`, and were
 * still there two hundred seconds later with nothing connected. So a count
 * taken on a machine that has ever run the app answers "yes, live updates
 * work here" forever, whatever the truth.
 *
 * That is not a theoretical complaint. It is exactly what happened: the
 * two-browser journeys had been SKIPPING on the strength of rows belonging to
 * no one, and so never reported that a filtered `postgres_changes` binding had
 * been discarding the whole channel since Phase 1. A check that cannot fail is
 * worse than no check, because it is read as a pass.
 *
 * Clearing first makes the count mean what it says: these rows were registered
 * by THIS run's browsers. The table is ephemeral session state — realtime
 * rewrites it on every join — so deleting it costs a live client nothing but a
 * re-subscribe, and the suite owns the stack it runs against.
 */
export async function clearStaleSubscriptions(): Promise<void> {
  const url = await localDatabaseUrl();
  if (url === null) return;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("delete from realtime.subscription");
  } catch {
    // Not fatal: the count below is then merely as trustworthy as it used to be.
  } finally {
    await client.end().catch(() => undefined);
  }
}

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
 * **Must be called once both browsers have a `/family` page mounted** — if the
 * database holds no subscription by then, nothing this suite does will make one
 * appear.
 *
 * That sentence was here before 012 and was not true of the code: the fixture
 * handed the test a value, and Playwright resolves fixtures BEFORE the test
 * body, so the count was always taken before either page had navigated. It now
 * hands over this function instead, so the moment of asking is the journey's to
 * choose and the comment above describes what happens.
 */
export async function liveUpdateSupport(): Promise<LiveUpdateSupport> {
  const count = await subscriptionCount();
  if (count === null) return { available: false, reason: NO_STACK };
  return count > 0 ? { available: true, reason: "" } : { available: false, reason: NO_SUBSCRIPTION };
}
