/**
 * The privilege inventory (DECISIONS §4). Read straight from the catalogue as
 * `postgres`, then spot-checked through the API. Any grant that is not in the
 * matrix — a new `t` for anon, a helper callable by authenticated, a way for
 * service_role to read a PIN hash — fails here before it ships.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { adminClient, createPool, fixtures, userClient } from "./helpers";

const TABLES = [
  "households",
  "household_users",
  "categories",
  "household_settings",
  "profile_pins",
] as const;
type Table = (typeof TABLES)[number];

const FUNCTIONS = [
  "assert_profile_account_is_member",
  "can_read_avatar",
  "claim_membership",
  "clear_pin",
  "guard_last_parent",
  "hook_restrict_signup",
  "is_member",
  "my_household",
  "set_pin",
  "sync_has_pin",
  "touch_updated_at",
  "verify_pin",
] as const;
type Fn = (typeof FUNCTIONS)[number];

interface TablePrivileges {
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
}

const NONE: TablePrivileges = { select: false, insert: false, update: false, delete: false };
const READ: TablePrivileges = { select: true, insert: false, update: false, delete: false };
const ALL: TablePrivileges = { select: true, insert: true, update: true, delete: true };

function tableMatrix(spec: Partial<Record<Table, TablePrivileges>>): Record<Table, TablePrivileges> {
  return Object.fromEntries(TABLES.map((table) => [table, spec[table] ?? NONE])) as Record<
    Table,
    TablePrivileges
  >;
}

function executeMatrix(allowed: readonly Fn[]): Record<Fn, boolean> {
  return Object.fromEntries(FUNCTIONS.map((fn) => [fn, allowed.includes(fn)])) as Record<Fn, boolean>;
}

async function schemaUsage(pool: Pool, role: string): Promise<boolean> {
  const { rows } = await pool.query<{ usage: boolean }>(
    "select has_schema_privilege($1, 'family', 'USAGE') as usage",
    [role],
  );
  return rows[0]?.usage ?? false;
}

async function tablePrivileges(pool: Pool, role: string): Promise<Record<Table, TablePrivileges>> {
  const entries = await Promise.all(
    TABLES.map(async (table) => {
      const { rows } = await pool.query<TablePrivileges>(
        "select has_table_privilege($1, $2, 'SELECT') as select, " +
          "has_table_privilege($1, $2, 'INSERT') as insert, " +
          "has_table_privilege($1, $2, 'UPDATE') as update, " +
          "has_table_privilege($1, $2, 'DELETE') as delete",
        [role, `family.${table}`],
      );
      return [table, rows[0] ?? NONE] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Table, TablePrivileges>;
}

/** Every function in the schema (so an unexpected new one shows up as an extra key). */
async function executePrivileges(pool: Pool, role: string): Promise<Record<string, boolean>> {
  const { rows } = await pool.query<{ proname: string; execute: boolean }>(
    "select p.proname, has_function_privilege($1, p.oid, 'EXECUTE') as execute " +
      "from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
      "where n.nspname = 'family' order by p.proname",
    [role],
  );
  return Object.fromEntries(rows.map((row) => [row.proname, row.execute]));
}

describe("privileges: the grant matrix", () => {
  const fx = fixtures();
  let pool: Pool;

  beforeAll(() => {
    pool = createPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("the schema holds exactly the expected functions", async () => {
    const inventory = await executePrivileges(pool, "postgres");
    expect(Object.keys(inventory).sort()).toEqual([...FUNCTIONS].sort());
  });

  it("anon has nothing: no usage, no table privilege, no execute", async () => {
    expect(await schemaUsage(pool, "anon")).toBe(false);
    expect(await tablePrivileges(pool, "anon")).toEqual(tableMatrix({}));
    expect(await executePrivileges(pool, "anon")).toEqual(executeMatrix([]));
  });

  it("authenticated: usage, SELECT on the four tables, execute on the four helpers, nothing on profile_pins", async () => {
    expect(await schemaUsage(pool, "authenticated")).toBe(true);
    expect(await tablePrivileges(pool, "authenticated")).toEqual(
      tableMatrix({
        households: READ,
        household_users: READ,
        categories: READ,
        household_settings: READ,
      }),
    );
    expect(await executePrivileges(pool, "authenticated")).toEqual(
      executeMatrix(["is_member", "my_household", "claim_membership", "can_read_avatar"]),
    );
  });

  it("service_role: usage, ALL on the four tables, the PIN functions — and nothing on profile_pins", async () => {
    expect(await schemaUsage(pool, "service_role")).toBe(true);
    expect(await tablePrivileges(pool, "service_role")).toEqual(
      tableMatrix({
        households: ALL,
        household_users: ALL,
        categories: ALL,
        household_settings: ALL,
      }),
    );
    expect(await executePrivileges(pool, "service_role")).toEqual(
      executeMatrix(["set_pin", "verify_pin", "clear_pin", "is_member", "my_household"]),
    );
  });

  it("supabase_auth_admin: usage, SELECT on the allowlist, execute on the signup hook only", async () => {
    expect(await schemaUsage(pool, "supabase_auth_admin")).toBe(true);
    expect(await tablePrivileges(pool, "supabase_auth_admin")).toEqual(
      tableMatrix({ household_users: READ }),
    );
    expect(await executePrivileges(pool, "supabase_auth_admin")).toEqual(
      executeMatrix(["hook_restrict_signup"]),
    );
  });

  it("profile_pins is unreadable through the API by a member and by the secret key", async () => {
    const member = await userClient(fx.users.a);
    const asMember = await member.schema("family").from("profile_pins").select("profile_id");
    expect(asMember.error?.code).toBe("42501");
    expect(asMember.data).toBeNull();

    const asAdmin = await adminClient().schema("family").from("profile_pins").select("profile_id");
    expect(asAdmin.error?.code).toBe("42501");
    expect(asAdmin.data).toBeNull();
  });
});
