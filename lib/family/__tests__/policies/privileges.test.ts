/**
 * The privilege inventory (DECISIONS §4; Phase 2 delta per 002's data-model
 * privilege matrix). Read straight from the catalogue as `postgres`, then
 * spot-checked through the API. Any grant that is not in the matrix — a new
 * `t` for anon, a helper callable by authenticated, a way for service_role to
 * read a PIN hash — fails here before it ships. The calendar tables (`events`,
 * `event_categories`, `event_exceptions`) must show anon nothing /
 * authenticated SELECT / service_role ALL; `split_event_series` is
 * service_role-only; the two timezone trigger functions are callable by nobody.
 *
 * T009 — the Phase 3 delta (003's data-model "Privilege matrix (delta)"): the
 * four task tables (`tasks`, `task_assignees`, `task_resolutions`,
 * `task_box_items`) take the same anon nothing / authenticated SELECT /
 * service_role ALL shape; `family.task_cursors`, the schema's first view, is
 * SELECT for authenticated and service_role and nothing at all for anon;
 * `seed_task_box(uuid)` is service_role-only; and the three new trigger
 * functions are callable by nobody. Both arrays below grow, so any new `anon`
 * grant and any function added to the schema without a decision fail here
 * (FR-390, SC-305).
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
  "events",
  "event_categories",
  "event_exceptions",
  "tasks",
  "task_assignees",
  "task_resolutions",
  "task_box_items",
] as const;
type Table = (typeof TABLES)[number];

/** The one relation in the schema that is a view, so it is checked on its own. */
const CURSOR_VIEW = "family.task_cursors";

const FUNCTIONS = [
  "assert_event_timezone",
  "assert_profile_account_is_member",
  "assert_settings_timezone",
  "assert_task_assignee",
  "assert_task_resolution",
  "assert_up_for_grabs_is_unassigned",
  "can_read_avatar",
  "claim_membership",
  "clear_pin",
  "guard_last_parent",
  "hook_restrict_signup",
  "is_member",
  "my_household",
  "seed_task_box",
  "set_pin",
  "split_event_series",
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

/** One relation, one role — `has_table_privilege` answers for views too. */
async function relationPrivileges(
  pool: Pool,
  role: string,
  relation: string,
): Promise<TablePrivileges> {
  const { rows } = await pool.query<TablePrivileges>(
    "select has_table_privilege($1, $2, 'SELECT') as select, " +
      "has_table_privilege($1, $2, 'INSERT') as insert, " +
      "has_table_privilege($1, $2, 'UPDATE') as update, " +
      "has_table_privilege($1, $2, 'DELETE') as delete",
    [role, relation],
  );
  return rows[0] ?? NONE;
}

async function tablePrivileges(pool: Pool, role: string): Promise<Record<Table, TablePrivileges>> {
  const entries = await Promise.all(
    TABLES.map(
      async (table) => [table, await relationPrivileges(pool, role, `family.${table}`)] as const,
    ),
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

  it("authenticated: usage, SELECT on everything but profile_pins, execute on the four helpers", async () => {
    expect(await schemaUsage(pool, "authenticated")).toBe(true);
    expect(await tablePrivileges(pool, "authenticated")).toEqual(
      tableMatrix({
        households: READ,
        household_users: READ,
        categories: READ,
        household_settings: READ,
        events: READ,
        event_categories: READ,
        event_exceptions: READ,
        tasks: READ,
        task_assignees: READ,
        task_resolutions: READ,
        task_box_items: READ,
      }),
    );
    expect(await executePrivileges(pool, "authenticated")).toEqual(
      executeMatrix(["is_member", "my_household", "claim_membership", "can_read_avatar"]),
    );
  });

  it("service_role: usage, ALL on everything but profile_pins, the PIN functions, split and seed", async () => {
    expect(await schemaUsage(pool, "service_role")).toBe(true);
    expect(await tablePrivileges(pool, "service_role")).toEqual(
      tableMatrix({
        households: ALL,
        household_users: ALL,
        categories: ALL,
        household_settings: ALL,
        events: ALL,
        event_categories: ALL,
        event_exceptions: ALL,
        tasks: ALL,
        task_assignees: ALL,
        task_resolutions: ALL,
        task_box_items: ALL,
      }),
    );
    expect(await executePrivileges(pool, "service_role")).toEqual(
      executeMatrix([
        "set_pin",
        "verify_pin",
        "clear_pin",
        "is_member",
        "my_household",
        "split_event_series",
        "seed_task_box",
      ]),
    );
  });

  it("split_event_series executes for service_role only; the timezone triggers for nobody", async () => {
    // Data-model "Privilege matrix (delta)": only service_role may execute the
    // split; the two timezone triggers must never be grantable to any API role.
    for (const role of ["anon", "authenticated", "supabase_auth_admin"]) {
      const inventory = await executePrivileges(pool, role);
      expect(inventory.split_event_series, role).toBe(false);
    }
    expect((await executePrivileges(pool, "service_role")).split_event_series).toBe(true);
    for (const role of ["anon", "authenticated", "service_role", "supabase_auth_admin"]) {
      const inventory = await executePrivileges(pool, role);
      expect(inventory.assert_event_timezone, role).toBe(false);
      expect(inventory.assert_settings_timezone, role).toBe(false);
    }
  });

  it("seed_task_box executes for service_role only; the three task triggers for nobody", async () => {
    // 003's privilege matrix: the Task Box seed is reachable from the seed
    // script and any future bootstrap, both of which hold the secret key, and
    // from nothing a browser can address. The three assert_* functions are
    // trigger bodies: PostgreSQL grants EXECUTE to PUBLIC on creation, so the
    // migrations' explicit `revoke all … from public` is what this asserts.
    for (const role of ["anon", "authenticated", "supabase_auth_admin"]) {
      const inventory = await executePrivileges(pool, role);
      expect(inventory.seed_task_box, role).toBe(false);
    }
    expect((await executePrivileges(pool, "service_role")).seed_task_box).toBe(true);
    for (const role of ["anon", "authenticated", "service_role", "supabase_auth_admin"]) {
      const inventory = await executePrivileges(pool, role);
      expect(inventory.assert_task_assignee, role).toBe(false);
      expect(inventory.assert_up_for_grabs_is_unassigned, role).toBe(false);
      expect(inventory.assert_task_resolution, role).toBe(false);
    }
  });

  it("task_cursors: SELECT for authenticated and service_role, nothing for anon", async () => {
    expect(await relationPrivileges(pool, "anon", CURSOR_VIEW)).toEqual(NONE);
    expect(await relationPrivileges(pool, "authenticated", CURSOR_VIEW)).toEqual(READ);
    expect((await relationPrivileges(pool, "service_role", CURSOR_VIEW)).select).toBe(true);

    // 001's `alter default privileges … on tables` reaches views as well, so
    // service_role's write bits here are inherited rather than granted — and
    // they are inert: `distinct on` makes the view non-updatable, so no role
    // writes through it whatever the catalogue says.
    const { rows } = await pool.query<{ updatable: number }>(
      "select pg_relation_is_updatable($1::regclass, false) as updatable",
      [CURSOR_VIEW],
    );
    expect(rows[0]?.updatable).toBe(0);
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
