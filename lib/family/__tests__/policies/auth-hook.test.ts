import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPool } from "./helpers";

/**
 * The Before-User-Created hook (FR-004, D18).
 *
 * GoTrue calls it as `supabase_auth_admin`, and `family.household_users` has
 * row-level security with a policy for `authenticated` only. If the function
 * ran as its caller it would see an empty allowlist whatever the table holds,
 * refuse every sign-up, and lock the household out of its own app — so
 * SECURITY DEFINER is a behavioural requirement here, not a style choice.
 */
describe("hook_restrict_signup", () => {
  const pool = createPool();
  const HOUSEHOLD = "00000000-0000-4000-8000-000000000001";
  const ALLOWED = "hook-allowed@test.local";

  beforeAll(async () => {
    await pool.query(
      "insert into family.household_users (household_id, email) values ($1, $2) on conflict (email) do nothing",
      [HOUSEHOLD, ALLOWED],
    );
  });

  afterAll(async () => {
    await pool.query("delete from family.household_users where email = $1", [ALLOWED]);
    await pool.end();
  });

  it("runs as its owner, so row-level security cannot blind the allowlist lookup", async () => {
    const { rows } = await pool.query(
      `select p.prosecdef from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'family' and p.proname = 'hook_restrict_signup'`,
    );
    expect(rows[0].prosecdef).toBe(true);
  });

  it("admits an allowlisted address", async () => {
    const { rows } = await pool.query(
      `select family.hook_restrict_signup(jsonb_build_object('user', jsonb_build_object('email', $1::text))) as verdict`,
      [ALLOWED],
    );
    expect(rows[0].verdict).toEqual({});
  });

  it("matches the address case-insensitively, the way a provider may send it", async () => {
    const { rows } = await pool.query(
      `select family.hook_restrict_signup(jsonb_build_object('user', jsonb_build_object('email', $1::text))) as verdict`,
      [ALLOWED.toUpperCase()],
    );
    expect(rows[0].verdict).toEqual({});
  });

  it("refuses an address that is not on the allowlist", async () => {
    const { rows } = await pool.query(
      `select family.hook_restrict_signup('{"user":{"email":"stranger@example.com"}}'::jsonb) as verdict`,
    );
    expect(rows[0].verdict.error.http_code).toBe(403);
  });

  it("refuses a payload with no address at all", async () => {
    const { rows } = await pool.query(
      `select family.hook_restrict_signup('{"user":{}}'::jsonb) as verdict`,
    );
    expect(rows[0].verdict.error.http_code).toBe(403);
  });

  it("is callable by the auth admin and by nobody else", async () => {
    const { rows } = await pool.query(
      `select
         has_function_privilege('supabase_auth_admin', 'family.hook_restrict_signup(jsonb)', 'execute') as auth_admin,
         has_function_privilege('authenticated',       'family.hook_restrict_signup(jsonb)', 'execute') as authenticated,
         has_function_privilege('anon',                'family.hook_restrict_signup(jsonb)', 'execute') as anon`,
    );
    expect(rows[0]).toEqual({ auth_admin: true, authenticated: false, anon: false });
  });
});
