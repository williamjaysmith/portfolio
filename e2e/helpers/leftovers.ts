import { Client } from "pg";

import { localDatabaseUrl } from "./stack";

/**
 * 012 — removes what a journey created, whether or not the journey got to the
 * end.
 *
 * **The problem this exists for.** harness.md §4 rule 3 already says "create
 * your own with `unique` and remove it at the end", and every writing journey
 * does. But a journey that FAILS never reaches its cleanup, so its rows outlive
 * it — and the next journey inherits them.
 *
 * That is not theoretical. Measured twice:
 *
 *   - `calendar.spec:91` failed on a one-shot `count()` race, so its daily
 *     repeat stayed in the database drawing a block at the default hour on every
 *     day. `preview-bar.spec:125` then created two more events at that hour,
 *     three in one slot overflowed into "+n more", and its own event stopped
 *     being a button anyone could find. It passes 3/3 alone.
 *   - A later run left **22 events against the seed's 13** and failed seven
 *     journeys, all on one project, all downstream of one early drag failure.
 *
 * So a single flaky journey was taking six others down with it, and the failing
 * SET moved between runs because which journey flaked first moved. That is most
 * of what made this suite unreadable since `011`.
 *
 * **This does not hide a failure.** The journey that failed still fails. It just
 * stops being contagious.
 *
 * **It runs only after a FAILURE**, and that is a cost decision measured the hard
 * way. A passing journey removes its own rows, so running this after every test
 * did nothing fifteen-sixteenths of the time — and a Postgres connection plus
 * fifteen deletes after each of 143 tests took the suite from 8.5 minutes to
 * 19.5 and failed twenty-seven journeys on timeouts it had introduced itself. A
 * teardown that costs more than the cascade it prevents is not worth having.
 *
 * **It is a WRITE, and the only one in the suite.** Everything else here reads.
 * It is confined to the local stack by `localDatabaseUrl`, which is the same
 * guard the rest of the harness uses, and it can never name the hosted project.
 */

/**
 * Seeded rows carry deterministic ids from a fixed prefix; anything else was made
 * by a journey. That is the whole test, and it is why the seed being
 * deterministic (harness.md §3) is load-bearing for more than readability.
 */
const SEED_ID_PREFIX = "00000000-";

/**
 * The tables a journey can add to, children first where a cascade would not
 * reach them.
 *
 * **`profile_pins` is deliberately NOT here.** PINs are created by the setup
 * project through Settings, not by a journey, and the seed never sets any
 * (harness.md §3) — so every row in it looks like a leftover and deleting them
 * would silently break every punch-in in the run after the first.
 */
const JOURNEY_TABLES: readonly string[] = [
  "event_exceptions",
  "events",
  "meal_exceptions",
  "meals",
  "recipes",
  "list_items",
  "lists",
  "task_resolutions",
  "task_box_items",
  "tasks",
  "star_entries",
  "redemptions",
  "reward_eligibilities",
  "rewards",
  "categories",
];

/** What was left behind, by table — empty when a journey cleaned up after itself. */
export type Leftovers = Record<string, number>;

/**
 * Deletes every non-seeded row from the tables a journey can write to, and
 * answers what it removed so a caller may report it.
 *
 * Silent when the stack is not up: the suite has already failed for a better
 * reason by then.
 */
export async function clearLeftovers(): Promise<Leftovers> {
  const url = await localDatabaseUrl();
  if (url === null) return {};

  const client = new Client({ connectionString: url });
  const removed: Leftovers = {};
  try {
    await client.connect();
    for (const table of JOURNEY_TABLES) {
      const { rowCount } = await client.query(
        `delete from family.${table} where id::text not like $1`,
        [`${SEED_ID_PREFIX}%`],
      );
      if (rowCount !== null && rowCount > 0) removed[table] = rowCount;
    }
  } catch {
    // Not fatal. A teardown that throws would replace a journey's real failure
    // with its own, which is the one thing this must never do.
  } finally {
    await client.end().catch(() => undefined);
  }
  return removed;
}
