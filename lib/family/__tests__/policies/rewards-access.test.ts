/**
 * T009 / SC-416 per path: `rewards`, `reward_eligibilities`, `star_entries`,
 * `redemptions` and the `star_balances` view each read as a member (rows
 * arrive), as an authenticated non-member (`[]`) and anonymously (HTTP 401,
 * SQLSTATE 42501). **No client write path exists** on any of the four tables
 * (FR-442): authenticated INSERT/UPDATE/DELETE all fail 42501 with nothing
 * written, because every star write goes through a server action holding the
 * secret key — the ledger's money rules live in triggers the browser can never
 * address directly. The view is `security_invoker`, so a member reading it sums
 * only their own household's entries under `is_member()` rather than every
 * household's as the view's owner.
 *
 * The `events-access` / `tasks-access` pattern: fixture rows are inserted by
 * this file as `postgres`, never taken from the seed, and a second household
 * carries a full row set on every path so "returns nothing" is proven against
 * rows that really exist.
 *
 * RED by design until T012 resets the stack onto 024–027: the fixtures fail
 * with `42P01` while the four tables do not exist.
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
  insertCategory,
  insertHousehold,
  userClient,
} from "./helpers";

// Table → the columns a probe selects; RLS decides whether rows come back.
const REWARD_TABLES = {
  rewards: "id, household_id",
  reward_eligibilities: "reward_id, category_id, household_id",
  star_entries: "id, household_id",
  redemptions: "id, reward_id, household_id",
} as const;

const BALANCE_VIEW = "star_balances";
const BALANCE_COLUMNS = "household_id, category_id, balance";

/** The reward costs 5, the Profile is given 10 and redeems once: a balance of 5. */
const REWARD_COST = 5;
const STARS_GIVEN = 10;

/** One Profile's whole star row set — a reward they can redeem, and its redemption. */
interface RewardFixture {
  rewardId: string;
  entryId: string;
  redemptionId: string;
}

async function insertOne(pool: Pool, sql: string, values: readonly unknown[]): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(sql, [...values]);
  const [row] = rows;
  if (!row) throw new Error(`${sql} returned no row`);
  return row.id;
}

/** Inserts the whole set as `postgres` (bypasses grants, not constraints or triggers). */
async function insertRewardFixture(
  pool: Pool,
  householdId: string,
  profileId: string,
  tag: string,
): Promise<RewardFixture> {
  const rewardId = await insertOne(
    pool,
    "insert into family.rewards (household_id, name, point_value, respawn_on_redemption) " +
      "values ($1, $2, $3, true) returning id",
    [householdId, `Bake cookies ${tag}`, REWARD_COST],
  );
  await pool.query(
    "insert into family.reward_eligibilities (household_id, reward_id, category_id) values ($1, $2, $3)",
    [householdId, rewardId, profileId],
  );
  const entryId = await insertOne(
    pool,
    "insert into family.star_entries (household_id, category_id, amount, kind, created_by, entered_on) " +
      "values ($1, $2, $3, 'adjustment', $2, current_date) returning id",
    [householdId, profileId, STARS_GIVEN],
  );
  // The trigger copies the cost, the name and the day; the debit follows.
  const redemptionId = await insertOne(
    pool,
    "insert into family.redemptions (household_id, reward_id, category_id, redeemed_by) " +
      "values ($1, $2, $3, $3) returning id",
    [householdId, rewardId, profileId],
  );
  return { rewardId, entryId, redemptionId };
}

/** The raw REST shape quickstart's SC-416 row documents: publishable key, no session. */
async function restProbe(path: string): Promise<{ status: number; code: string | undefined }> {
  const response = await fetch(`${LOCAL.url}/rest/v1/${path}`, {
    headers: { apikey: LOCAL.publishableKey, "Accept-Profile": "family" },
  });
  const body = (await response.json()) as { code?: string };
  return { status: response.status, code: body.code };
}

describe("rewards access: SC-416 per path and the absent write path", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let otherHouseholdId: string;
  let mine: RewardFixture;
  let theirs: RewardFixture;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    stranger = await userClient(fx.users.stranger);

    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-rewards-other`);
    const otherProfileId = await insertCategory(pool, {
      householdId: otherHouseholdId,
      label: `Other kid ${fx.run}`,
      color: "#B6E085",
    });
    theirs = await insertRewardFixture(pool, otherHouseholdId, otherProfileId, `other-${fx.run}`);
    mine = await insertRewardFixture(pool, fx.householdId, fx.anchorParentId, fx.run);
  });

  afterAll(async () => {
    try {
      await deleteHousehold(pool, otherHouseholdId);
      // Eligibilities and redemptions cascade with the reward; entries never do.
      // Scoped to the fixture household rather than to `mine`, so a `beforeAll`
      // that failed part-way still leaves nothing behind.
      await pool.query("delete from family.rewards where household_id = $1", [fx.householdId]);
      await pool.query("delete from family.star_entries where household_id = $1", [fx.householdId]);
    } finally {
      await pool.end();
    }
  });

  it("a member reads their household's star rows on every path — and no other household's", async () => {
    for (const table of Object.keys(REWARD_TABLES)) {
      const result = await member.schema("family").from(table).select("household_id");
      expect(result.error, table).toBeNull();
      expect(result.data?.length, table).toBeGreaterThan(0);
      expect(result.data?.every((row) => row.household_id === fx.householdId), table).toBe(true);
    }

    const rewards = await member.schema("family").from("rewards").select(REWARD_TABLES.rewards);
    expect(rewards.data).toContainEqual({ id: mine.rewardId, household_id: fx.householdId });
    expect(rewards.data?.some((row) => row.id === theirs.rewardId)).toBe(false);

    const eligibilities = await member
      .schema("family")
      .from("reward_eligibilities")
      .select(REWARD_TABLES.reward_eligibilities);
    expect(eligibilities.data).toContainEqual({
      reward_id: mine.rewardId,
      category_id: fx.anchorParentId,
      household_id: fx.householdId,
    });

    const entries = await member.schema("family").from("star_entries").select(REWARD_TABLES.star_entries);
    expect(entries.data).toContainEqual({ id: mine.entryId, household_id: fx.householdId });
    expect(entries.data?.some((row) => row.id === theirs.entryId)).toBe(false);

    const redemptions = await member.schema("family").from("redemptions").select(REWARD_TABLES.redemptions);
    expect(redemptions.data).toContainEqual({
      id: mine.redemptionId,
      reward_id: mine.rewardId,
      household_id: fx.householdId,
    });
    expect(redemptions.data?.some((row) => row.id === theirs.redemptionId)).toBe(false);
  });

  it("a member reads the balance view — their own Profiles, summed under their own RLS", async () => {
    const result = await member.schema("family").from(BALANCE_VIEW).select(BALANCE_COLUMNS);
    expect(result.error).toBeNull();
    expect(result.data).toContainEqual({
      household_id: fx.householdId,
      category_id: fx.anchorParentId,
      balance: STARS_GIVEN - REWARD_COST,
    });
    expect(result.data?.every((row) => row.household_id === fx.householdId)).toBe(true);
  });

  it("an authenticated non-member gets an empty set from every star path", async () => {
    for (const [table, columns] of Object.entries(REWARD_TABLES)) {
      const result = await stranger.schema("family").from(table).select(columns);
      expect(result.error, table).toBeNull();
      expect(result.data, table).toEqual([]);
    }
    const balances = await stranger.schema("family").from(BALANCE_VIEW).select(BALANCE_COLUMNS);
    expect(balances.error).toBeNull();
    expect(balances.data).toEqual([]);
  });

  it("anon with no session is refused on every star path: HTTP 401, SQLSTATE 42501", async () => {
    for (const path of [...Object.keys(REWARD_TABLES), BALANCE_VIEW]) {
      expect(await restProbe(`${path}?select=household_id`), path).toEqual({ status: 401, code: "42501" });
    }

    const anon = anonClient();
    for (const [table, columns] of Object.entries(REWARD_TABLES)) {
      const result = await anon.schema("family").from(table).select(columns);
      expect(result.error?.code, table).toBe("42501");
      expect(result.data, table).toBeNull();
    }
    const balances = await anon.schema("family").from(BALANCE_VIEW).select(BALANCE_COLUMNS);
    expect(balances.error?.code).toBe("42501");
    expect(balances.data).toBeNull();
  });

  it("authenticated INSERT is refused on every star table, nothing written (FR-442)", async () => {
    const probes: Record<string, Record<string, unknown>> = {
      rewards: { household_id: fx.householdId, name: `Intruder ${fx.run}`, point_value: 1 },
      reward_eligibilities: {
        household_id: fx.householdId,
        reward_id: mine.rewardId,
        category_id: fx.anchorParentId,
      },
      star_entries: {
        household_id: fx.householdId,
        category_id: fx.anchorParentId,
        amount: 500,
        kind: "adjustment",
        entered_on: "2026-09-29",
      },
      redemptions: {
        household_id: fx.householdId,
        reward_id: mine.rewardId,
        category_id: fx.anchorParentId,
        redeemed_by: fx.anchorParentId,
      },
    };

    for (const [table, row] of Object.entries(probes)) {
      const result = await member.schema("family").from(table).insert(row);
      expect(result.error?.code, table).toBe("42501");
    }

    const { rows } = await pool.query<{ rewards: string; entries: string; redemptions: string }>(
      "select (select count(*)::text from family.rewards where household_id = $1) as rewards, " +
        "(select count(*)::text from family.star_entries where household_id = $1) as entries, " +
        "(select count(*)::text from family.redemptions where household_id = $1) as redemptions",
      [fx.householdId],
    );
    // One reward, the given stars and the one debit, one redemption — as seeded.
    expect(rows[0]).toEqual({ rewards: "1", entries: "2", redemptions: "1" });
  });

  it("authenticated UPDATE and DELETE are refused on every star table, rows intact", async () => {
    const updates: [string, Record<string, unknown>, string, string][] = [
      ["rewards", { point_value: 1 }, "id", mine.rewardId],
      ["reward_eligibilities", { category_id: fx.anchorParentId }, "reward_id", mine.rewardId],
      ["star_entries", { amount: 500 }, "id", mine.entryId],
      ["redemptions", { reversed_at: "2026-09-29T00:00:00Z" }, "id", mine.redemptionId],
    ];

    for (const [table, patch, column, value] of updates) {
      const update = await member.schema("family").from(table).update(patch).eq(column, value);
      expect(update.error?.code, `${table} update`).toBe("42501");
      const remove = await member.schema("family").from(table).delete().eq(column, value);
      expect(remove.error?.code, `${table} delete`).toBe("42501");
    }

    const { rows } = await pool.query<{ point_value: number; amount: number; reversed_at: string | null }>(
      "select r.point_value, e.amount, d.reversed_at from family.rewards r, family.star_entries e, family.redemptions d " +
        "where r.id = $1 and e.id = $2 and d.id = $3",
      [mine.rewardId, mine.entryId, mine.redemptionId],
    );
    expect(rows[0]).toEqual({ point_value: REWARD_COST, amount: STARS_GIVEN, reversed_at: null });
  });
});
