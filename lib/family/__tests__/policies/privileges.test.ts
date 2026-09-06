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
 *
 * T010 — the Phase 4 delta (004's data-model "Privilege matrix (delta)"): the
 * four star tables (`rewards`, `reward_eligibilities`, `star_entries`,
 * `redemptions`) take the same shape; `family.star_balances`, the second view,
 * is SELECT for authenticated and service_role and nothing for anon, and is
 * `security_invoker` so it sums under the caller's own RLS; `household_today`
 * and the six trigger functions of 024–026 are callable by nobody — they run
 * only inside `security definer` trigger bodies; and the four tables sit on
 * `supabase_realtime` at the default replica identity, so a DELETE payload
 * carries a key and never a reward's name (FR-442, SC-416, R411).
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
  "rewards",
  "reward_eligibilities",
  "star_entries",
  "redemptions",
  "lists",
  "list_items",
  "meal_categories",
  "recipes",
  "meals",
  "meal_exceptions",
] as const;
type Table = (typeof TABLES)[number];

/** The two relations in the schema that are views, so they are checked on their own. */
const VIEWS = ["family.task_cursors", "family.star_balances"] as const;

/** Realtime: the four Phase 4 tables join the channel (027), replica identity left at default. */
const REWARD_TABLES = ["rewards", "reward_eligibilities", "star_entries", "redemptions"] as const;

/** Realtime: the two Phase 5 tables join the channel (029), replica identity left at default. */
const LIST_TABLES = ["lists", "list_items"] as const;

/** Realtime: the four Phase 6 tables join the channel (033), replica identity left at default. */
const MEAL_TABLES = ["meal_categories", "recipes", "meals", "meal_exceptions"] as const;

const FUNCTIONS = [
  "assert_event_timezone",
  "assert_profile_account_is_member",
  "assert_redemption",
  "assert_reward_eligibility",
  "assert_settings_timezone",
  "assert_star_adjustment",
  "assert_task_assignee",
  "assert_task_resolution",
  "assert_up_for_grabs_is_unassigned",
  "can_read_avatar",
  "claim_membership",
  "clear_pin",
  "credit_task_resolution",
  "guard_last_parent",
  "hook_restrict_signup",
  "household_today",
  "is_member",
  "my_household",
  "record_redemption",
  "retract_task_resolution",
  "seed_default_lists",
  "seed_default_meal_categories",
  "seed_task_box",
  "set_pin",
  "split_event_series",
  "split_meal_series",
  "sync_has_pin",
  "touch_updated_at",
  "verify_pin",
] as const;
type Fn = (typeof FUNCTIONS)[number];

/** 024–026: one helper and six trigger bodies, each `revoke all … from public`. */
const REWARD_FUNCTIONS: readonly Fn[] = [
  "household_today",
  "assert_reward_eligibility",
  "credit_task_resolution",
  "retract_task_resolution",
  "assert_star_adjustment",
  "assert_redemption",
  "record_redemption",
];

const API_ROLES = ["anon", "authenticated", "service_role", "supabase_auth_admin"] as const;

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
        rewards: READ,
        reward_eligibilities: READ,
        star_entries: READ,
        redemptions: READ,
        lists: READ,
        list_items: READ,
        meal_categories: READ,
        recipes: READ,
        meals: READ,
        meal_exceptions: READ,
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
        rewards: ALL,
        reward_eligibilities: ALL,
        star_entries: ALL,
        redemptions: ALL,
        lists: ALL,
        list_items: ALL,
        meal_categories: ALL,
        recipes: ALL,
        meals: ALL,
        meal_exceptions: ALL,
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
        "seed_default_lists",
        "seed_default_meal_categories",
        "split_meal_series",
      ]),
    );
  });

  it("seed_default_lists executes for service_role only (005 T010, data-model §Privilege matrix)", async () => {
    // 028's default lists are made by the seed script, which holds the secret
    // key, and by nothing a browser can address; the function is `security
    // definer`, so the explicit `revoke … from public, anon, authenticated` is
    // what this asserts.
    for (const role of ["anon", "authenticated", "supabase_auth_admin"]) {
      const inventory = await executePrivileges(pool, role);
      expect(inventory.seed_default_lists, role).toBe(false);
    }
    expect((await executePrivileges(pool, "service_role")).seed_default_lists).toBe(true);
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

  it("the seven reward functions execute for nobody — trigger bodies and their one helper (T010)", async () => {
    // 004's privilege matrix: `household_today` is called only from
    // `security definer` trigger bodies, which run as the owner, so it needs
    // no grant; the six trigger functions are the write path's second line
    // and must never be addressable by an API role. PostgreSQL grants EXECUTE
    // to PUBLIC on creation, so the migrations' explicit `revoke all … from
    // public` is what this asserts.
    for (const role of API_ROLES) {
      const inventory = await executePrivileges(pool, role);
      for (const fn of REWARD_FUNCTIONS) {
        expect(inventory[fn], `${role} ${fn}`).toBe(false);
      }
    }
  });

  it("the two views: SELECT for authenticated and service_role, nothing for anon, security_invoker", async () => {
    for (const view of VIEWS) {
      expect(await relationPrivileges(pool, "anon", view), view).toEqual(NONE);
      expect(await relationPrivileges(pool, "authenticated", view), view).toEqual(READ);
      expect((await relationPrivileges(pool, "service_role", view)).select, view).toBe(true);

      // 001's `alter default privileges … on tables` reaches views as well, so
      // service_role's write bits here are inherited rather than granted — and
      // they are inert: `distinct on` (task_cursors) and `group by`
      // (star_balances) make both views non-updatable, so no role writes
      // through them whatever the catalogue says.
      const { rows } = await pool.query<{ updatable: number; reloptions: string[] | null }>(
        "select pg_relation_is_updatable($1::regclass, false) as updatable, " +
          "(select reloptions from pg_class where oid = $1::regclass) as reloptions",
        [view],
      );
      expect(rows[0]?.updatable, view).toBe(0);
      // Without it a view is read with its OWNER's privileges, which would hand
      // every household's chain tails and balances to any authenticated caller.
      expect(rows[0]?.reloptions, view).toContain("security_invoker=true");
    }
  });

  it("the two lists tables are on supabase_realtime at the default replica identity (005 R506)", async () => {
    const { rows: publication } = await pool.query<{ puballtables: boolean }>(
      "select puballtables from pg_publication where pubname = 'supabase_realtime'",
    );
    expect(publication).toHaveLength(1);
    const { rows: published } = await pool.query<{ tablename: string }>(
      "select tablename from pg_publication_tables " +
        "where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = any($1::text[])",
      [[...LIST_TABLES]],
    );
    const covered = publication[0]?.puballtables === true || published.length === LIST_TABLES.length;
    expect(covered).toBe(true);
    const { rows: identities } = await pool.query<{ relname: string; relreplident: string }>(
      "select relname, relreplident from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'family' and relname = any($1::text[]) order by relname",
      [[...LIST_TABLES]],
    );
    expect(identities).toEqual([...LIST_TABLES].sort().map((relname) => ({ relname, relreplident: "d" })));
  });

  it("the four meals tables are on supabase_realtime at the default replica identity (006 R605)", async () => {
    const { rows: publication } = await pool.query<{ puballtables: boolean }>(
      "select puballtables from pg_publication where pubname = 'supabase_realtime'",
    );
    expect(publication).toHaveLength(1);
    const { rows: published } = await pool.query<{ tablename: string }>(
      "select tablename from pg_publication_tables " +
        "where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = any($1::text[])",
      [[...MEAL_TABLES]],
    );
    const covered = publication[0]?.puballtables === true || published.length === MEAL_TABLES.length;
    expect(covered).toBe(true);
    const { rows: identities } = await pool.query<{ relname: string; relreplident: string }>(
      "select relname, relreplident from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'family' and relname = any($1::text[]) order by relname",
      [[...MEAL_TABLES]],
    );
    expect(identities).toEqual([...MEAL_TABLES].sort().map((relname) => ({ relname, relreplident: "d" })));
  });

  it("the four reward tables are on supabase_realtime at the default replica identity (R411)", async () => {
    // A FOR ALL TABLES publication covers the schema without per-table rows
    // (the 009/022/027 guard), so the membership check allows either form.
    const { rows: publication } = await pool.query<{ puballtables: boolean }>(
      "select puballtables from pg_publication where pubname = 'supabase_realtime'",
    );
    expect(publication).toHaveLength(1);
    const { rows: published } = await pool.query<{ tablename: string }>(
      "select tablename from pg_publication_tables " +
        "where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = any($1::text[])",
      [[...REWARD_TABLES]],
    );
    const covered = publication[0]?.puballtables === true || published.length === REWARD_TABLES.length;
    expect(covered, published.map((row) => row.tablename).join(",")).toBe(true);

    // `d` = default (the primary key only): a DELETE payload must never carry a
    // deleted reward's name, the same rule 022 states for a deleted task's title.
    const { rows: identities } = await pool.query<{ relname: string; relreplident: string }>(
      "select c.relname, c.relreplident from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'family' and c.relname = any($1::text[]) order by c.relname",
      [[...REWARD_TABLES]],
    );
    expect(identities).toEqual(
      [...REWARD_TABLES].sort().map((relname) => ({ relname, relreplident: "d" })),
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
