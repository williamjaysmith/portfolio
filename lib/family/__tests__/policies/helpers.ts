/**
 * Shared plumbing for the policy suite (the `policies` Vitest project).
 *
 * Runs only against the LOCAL Supabase stack (`supabase start`, ports from
 * supabase/config.toml). Two kinds of client:
 *   - supabase-js clients that go through Kong/PostgREST exactly like the app
 *     (anon key + no session = `anon`, signed-in user = `authenticated`,
 *     secret key = `service_role`), so grants and RLS are exercised for real;
 *   - a `pg` pool on the direct database connection (as `postgres`) for
 *     privilege catalogue queries, fixture rows and clock manipulation.
 *
 * Fixture ids are created once per run in `global-setup.ts` and handed to
 * test files through Vitest's `provide`/`inject`.
 */

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { inject } from "vitest";

export interface FixtureUser {
  id: string;
  email: string;
  password: string;
}

export interface PolicyFixtures {
  /** Short random tag — every email, household name and label carries it. */
  run: string;
  householdId: string;
  /**
   * A parent profile that lives for the whole run, so per-file cleanup can
   * delete the profiles it created without tripping the last-parent guard.
   */
  anchorParentId: string;
  users: {
    /** On the allowlist of `householdId`. */
    a: FixtureUser;
    /** Also on the allowlist of `householdId`. */
    b: FixtureUser;
    /** A confirmed account that is on no allowlist at all. */
    stranger: FixtureUser;
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    familyFixtures: PolicyFixtures;
  }
}

const host = process.env.SUPABASE_LOCAL_HOST ?? "127.0.0.1";
const port = process.env.SUPABASE_LOCAL_PORT ?? "55321";

/**
 * Local stack coordinates. The key defaults are the CLI's fixed local
 * constants (identical on every machine); `supabase status -o env` prints the
 * live values if they ever differ.
 */
/**
 * The local stack's keys are public constants the CLI mints identically
 * everywhere, but they carry a real key's shape, so they are not committed:
 * `supabase status -o env` prints them and the quickstart puts them in
 * `.env.local`, which this suite is run with.
 *
 * Absence is reported by `assertLocalKeys` at the start of a run rather than
 * thrown here, because these files are IMPORTED even when the suite is skipped
 * for a missing stack — throwing at import would break collection instead of
 * explaining itself.
 */
function localKey(name: string): string {
  return process.env[name] ?? "";
}

/** Call from a `beforeAll`: turns a missing key into the fix, not a 401. */
export function assertLocalKeys(): void {
  const missing = LOCAL_KEY_VARS.filter((name) => !process.env[name]);
  if (missing.length === 0) return;
  throw new Error(
    `${missing.join(" and ")} unset. Run \`supabase start\`, copy the keys out of ` +
      "`supabase status -o env` into .env.local, and run this suite with that file sourced " +
      "(`set -a; . ./.env.local; set +a`).",
  );
}

const LOCAL_KEY_VARS = ["SUPABASE_LOCAL_PUBLISHABLE_KEY", "SUPABASE_LOCAL_SECRET_KEY"] as const;

export const LOCAL = {
  url: process.env.SUPABASE_LOCAL_URL ?? `http://${host}:${port}`,
  publishableKey: localKey("SUPABASE_LOCAL_PUBLISHABLE_KEY"),
  secretKey: localKey("SUPABASE_LOCAL_SECRET_KEY"),
  dbUrl:
    process.env.SUPABASE_LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
} as const;

// Every client keeps its session in its own memory, so members, strangers and
// the admin never bleed into each other.
const NO_PERSIST = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/** `service_role` through Kong — what `createAdminClient()` is in the app. */
export function adminClient(): SupabaseClient {
  assertLocalKeys();
  return createClient(LOCAL.url, LOCAL.secretKey, NO_PERSIST);
}

/** Publishable key and no session — the `anon` role. */
export function anonClient(): SupabaseClient {
  return createClient(LOCAL.url, LOCAL.publishableKey, NO_PERSIST);
}

/** Publishable key with a password session — the `authenticated` role, `auth.uid()` = the user. */
export async function userClient(user: Pick<FixtureUser, "email" | "password">): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw error;
  return client;
}

/** Direct connection as `postgres` — catalogue queries, fixtures, clock manipulation. */
export function createPool(): Pool {
  assertLocalKeys();
  return new Pool({ connectionString: LOCAL.dbUrl, max: 2 });
}

export function fixtures(): PolicyFixtures {
  return inject("familyFixtures");
}

export function testEmail(tag: string, run: string): string {
  return `${tag}+${run}@test.local`;
}

/** Inserts a household plus its settings row; returns the household id. */
export async function insertHousehold(pool: Pool, name: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.households (name) values ($1) returning id",
    [name],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.households returned no row");
  await pool.query("insert into family.household_settings (household_id) values ($1)", [row.id]);
  return row.id;
}

export async function deleteHousehold(pool: Pool, householdId: string): Promise<void> {
  await pool.query("delete from family.households where id = $1", [householdId]);
}

export interface CategorySeed {
  householdId: string;
  label: string;
  color: string;
  role?: "parent" | "member";
  isProfile?: boolean;
}

/** Inserts a category as `postgres` (bypasses grants, not constraints); returns its id. */
export async function insertCategory(pool: Pool, seed: CategorySeed): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.categories (household_id, label, color, role, is_profile) " +
      "values ($1, $2, $3, $4, $5) returning id",
    [seed.householdId, seed.label, seed.color, seed.role ?? "member", seed.isProfile ?? true],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.categories returned no row");
  return row.id;
}

/** Creates confirmed password accounts through the Auth admin API. */
export async function createUsers(admin: SupabaseClient, emails: readonly string[]): Promise<FixtureUser[]> {
  const users: FixtureUser[] = [];
  for (const email of emails) {
    const password = `pw-${randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    if (!data.user) throw new Error(`auth.admin.createUser returned no user for ${email}`);
    users.push({ id: data.user.id, email, password });
  }
  return users;
}

export async function deleteUsers(admin: SupabaseClient, ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
}
