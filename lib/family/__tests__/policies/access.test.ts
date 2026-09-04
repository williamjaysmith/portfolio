/**
 * T026 / SC-001 at the API: the allowlist claim, member reads, non-member
 * empty sets, and the anon refusal (D27) — all through Kong/PostgREST.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import {
  LOCAL,
  anonClient,
  createPool,
  deleteHousehold,
  fixtures,
  insertHousehold,
  testEmail,
  userClient,
} from "./helpers";

// Table → a column every role could name; RLS decides whether rows come back.
const TABLES = {
  households: "id",
  household_users: "id",
  categories: "id",
  household_settings: "household_id",
} as const;

describe("access: allowlist claim, RLS and the anon refusal", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let otherHouseholdId: string;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    stranger = await userClient(fx.users.stranger);
    // A second household with its own allowlist row proves the roster is scoped.
    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-other`);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      otherHouseholdId,
      testEmail("other", fx.run),
    ]);
  });

  afterAll(async () => {
    await deleteHousehold(pool, otherHouseholdId);
    await pool.end();
  });

  it("claim_membership binds the signed-in account to its allowlist row, idempotently", async () => {
    const first = await member.schema("family").rpc("claim_membership");
    expect(first.error).toBeNull();
    expect(first.data).toBe(fx.householdId);

    const { rows } = await pool.query<{ user_id: string | null; claimed: boolean }>(
      "select user_id, claimed_at is not null as claimed from family.household_users where email = $1",
      [fx.users.a.email],
    );
    expect(rows).toEqual([{ user_id: fx.users.a.id, claimed: true }]);

    const again = await member.schema("family").rpc("claim_membership");
    expect(again.data).toBe(fx.householdId);

    const mine = await member.schema("family").rpc("my_household");
    expect(mine.error).toBeNull();
    expect(mine.data).toBe(fx.householdId);
  });

  it("claim_membership returns null for a confirmed account that is on no allowlist", async () => {
    const claim = await stranger.schema("family").rpc("claim_membership");
    expect(claim.error).toBeNull();
    expect(claim.data).toBeNull();

    const mine = await stranger.schema("family").rpc("my_household");
    expect(mine.data).toBeNull();

    const { rows } = await pool.query("select 1 from family.household_users where user_id = $1", [
      fx.users.stranger.id,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("a member reads the household, its categories and its settings", async () => {
    const household = await member
      .schema("family")
      .from("households")
      .select("id, name")
      .eq("id", fx.householdId);
    expect(household.error).toBeNull();
    expect(household.data).toEqual([{ id: fx.householdId, name: `test-${fx.run}` }]);

    const categories = await member.schema("family").from("categories").select("id, household_id");
    expect(categories.error).toBeNull();
    expect(categories.data).toContainEqual({ id: fx.anchorParentId, household_id: fx.householdId });
    expect(categories.data?.every((row) => row.household_id === fx.householdId)).toBe(true);

    const settings = await member.schema("family").from("household_settings").select("household_id");
    expect(settings.error).toBeNull();
    expect(settings.data).toEqual([{ household_id: fx.householdId }]);
  });

  it("household_users shows a member only their own household's roster", async () => {
    const roster = await member.schema("family").from("household_users").select("household_id, email");
    expect(roster.error).toBeNull();
    const emails = roster.data?.map((row) => row.email).sort();
    expect(emails).toEqual([fx.users.a.email, fx.users.b.email].sort());
    expect(roster.data?.some((row) => row.household_id === otherHouseholdId)).toBe(false);
  });

  it("a signed-in non-member gets an empty set from every family table", async () => {
    for (const [table, column] of Object.entries(TABLES)) {
      const result = await stranger.schema("family").from(table).select(column);
      expect(result.error, table).toBeNull();
      expect(result.data, table).toEqual([]);
    }
  });

  it("anon with no session is refused at the schema: HTTP 401, SQLSTATE 42501", async () => {
    // Raw REST probe — the exact shape quickstart SC-001(c) documents.
    const response = await fetch(`${LOCAL.url}/rest/v1/categories?select=id`, {
      headers: { apikey: LOCAL.publishableKey, "Accept-Profile": "family" },
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("42501");

    // And the same through supabase-js, for every table.
    const anon = anonClient();
    for (const [table, column] of Object.entries(TABLES)) {
      const result = await anon.schema("family").from(table).select(column);
      expect(result.error?.code, table).toBe("42501");
      expect(result.data, table).toBeNull();
    }
  });
});
