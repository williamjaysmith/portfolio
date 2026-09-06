import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * 007 T011 — the local Supabase stack, and nothing else (FR-703).
 *
 * The address comes from the CLI's own `supabase status`, exactly as the
 * repository's `dev:local` and seed scripts read it, so this file holds no
 * address, key or flag that could point at the hosted project. A stack that is
 * down produces one clear line, not forty failed journeys.
 */

const NOT_RUNNING =
  "The local Supabase stack is not running. Start it with `supabase start` (this repository's stack " +
  "is on 553xx; another project owns 543xx), then run the suite again.";

/** Where the local stack answers, per the CLI. `null` when it is not running. */
export async function localStackUrl(): Promise<string | null> {
  try {
    const { stdout } = await run("supabase", ["status", "-o", "env"], { timeout: 30_000 });
    return stdout.match(/^API_URL="?([^"\n]+)"?$/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The Postgres address the live-update probe reads. `null` when the stack is down. */
export async function localDatabaseUrl(): Promise<string | null> {
  try {
    const { stdout } = await run("supabase", ["status", "-o", "env"], { timeout: 30_000 });
    return stdout.match(/^DB_URL="?([^"\n]+)"?$/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Stops the run with the one line that says what to do, rather than letting every journey fail. */
export async function requireLocalStack(): Promise<string> {
  const url = await localStackUrl();
  if (url === null) throw new Error(NOT_RUNNING);
  return url;
}

/**
 * The two commands every hand walk has used since Phase 1. Slow (about forty
 * seconds together) and therefore run once per suite, in the setup project —
 * never between journeys (R703).
 */
export async function resetAndSeed(): Promise<void> {
  await run("supabase", ["db", "reset"], { timeout: 300_000, maxBuffer: 32 * 1024 * 1024 });
  await run("npm", ["run", "family:seed", "--", "--local"], { timeout: 180_000, maxBuffer: 32 * 1024 * 1024 });
}
