/**
 * 005 T009 / SC-509 per path: `lists` and `list_items` each read as a member
 * (rows arrive), as an authenticated non-member (`[]`) and anonymously (HTTP 401,
 * SQLSTATE 42501). **No client write path exists** on either table (FR-539):
 * authenticated INSERT/UPDATE/DELETE all fail 42501 with nothing written, because
 * every list write goes through a server action holding the secret key. And the
 * one function this phase adds, `seed_default_lists`, is not callable by `anon`
 * or `authenticated` through the API (42501) — only the seed script's secret key
 * reaches it.
 *
 * Nothing here hides a Parents only list from a member's READ: RLS is by
 * household, the punch-in is the app's layer, and the spec says so (Assumption
 * 5, R505). The action-level refusal is `lists-actions.test.ts`'s.
 *
 * The `rewards-access` pattern: fixture rows are inserted by this file as
 * `postgres`, never taken from the seed, and a second household carries a full
 * row set on every path so "returns nothing" is proven against rows that really
 * exist.
 *
 * RED by design until T011 resets the stack onto 028–029: the fixtures fail
 * with `42P01` while the two tables do not exist.
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
const LIST_TABLES = {
  lists: "id, household_id",
  list_items: "id, list_id, household_id",
} as const;

/** One household's whole row set — a list, and an item on it. */
interface ListFixture {
  listId: string;
  itemId: string;
}

async function insertOne(pool: Pool, sql: string, values: readonly unknown[]): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(sql, [...values]);
  const [row] = rows;
  if (!row) throw new Error(`${sql} returned no row`);
  return row.id;
}

/** Inserts the whole set as `postgres` (bypasses grants, not constraints). */
async function insertListFixture(
  pool: Pool,
  householdId: string,
  profileId: string,
  tag: string,
): Promise<ListFixture> {
  const listId = await insertOne(
    pool,
    "insert into family.lists (household_id, name, kind, color, parents_only, created_by) " +
      "values ($1, $2, 'grocery', '#B6E085', true, $3) returning id",
    [householdId, `Party ${tag}`, profileId],
  );
  const itemId = await insertOne(
    pool,
    "insert into family.list_items (household_id, list_id, text, created_by) values ($1, $2, $3, $4) returning id",
    [householdId, listId, `Cake ${tag}`, profileId],
  );
  return { listId, itemId };
}

/** The raw REST shape quickstart's SC-509 row documents: publishable key, no session. */
async function restProbe(path: string): Promise<{ status: number; code: string | undefined }> {
  const response = await fetch(`${LOCAL.url}/rest/v1/${path}`, {
    headers: { apikey: LOCAL.publishableKey, "Accept-Profile": "family" },
  });
  const body = (await response.json()) as { code?: string };
  return { status: response.status, code: body.code };
}

describe("lists access: SC-509 per path and the absent write path", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let otherHouseholdId: string;
  let mine: ListFixture;
  let theirs: ListFixture;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    stranger = await userClient(fx.users.stranger);

    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-lists-other`);
    const otherProfileId = await insertCategory(pool, {
      householdId: otherHouseholdId,
      label: `Other kid ${fx.run}`,
      color: "#B6E085",
    });
    theirs = await insertListFixture(pool, otherHouseholdId, otherProfileId, `other-${fx.run}`);
    mine = await insertListFixture(pool, fx.householdId, fx.anchorParentId, fx.run);
  });

  afterAll(async () => {
    try {
      await deleteHousehold(pool, otherHouseholdId);
      // Items cascade with the list. Scoped to the fixture household rather than
      // to `mine`, so a `beforeAll` that failed part-way still leaves nothing behind.
      await pool.query("delete from family.lists where household_id = $1", [fx.householdId]);
    } finally {
      await pool.end();
    }
  });

  it("a member reads their household's lists and items — Parents only included — and no other household's", async () => {
    for (const table of Object.keys(LIST_TABLES)) {
      const result = await member.schema("family").from(table).select("household_id");
      expect(result.error, table).toBeNull();
      expect(result.data?.length, table).toBeGreaterThan(0);
      expect(result.data?.every((row) => row.household_id === fx.householdId), table).toBe(true);
    }

    const lists = await member.schema("family").from("lists").select(LIST_TABLES.lists);
    expect(lists.data).toContainEqual({ id: mine.listId, household_id: fx.householdId });
    expect(lists.data?.some((row) => row.id === theirs.listId)).toBe(false);

    const items = await member.schema("family").from("list_items").select(LIST_TABLES.list_items);
    expect(items.data).toContainEqual({ id: mine.itemId, list_id: mine.listId, household_id: fx.householdId });
    expect(items.data?.some((row) => row.id === theirs.itemId)).toBe(false);
  });

  it("an authenticated non-member gets an empty set from both paths", async () => {
    for (const [table, columns] of Object.entries(LIST_TABLES)) {
      const result = await stranger.schema("family").from(table).select(columns);
      expect(result.error, table).toBeNull();
      expect(result.data, table).toEqual([]);
    }
  });

  it("anon with no session is refused on both paths: HTTP 401, SQLSTATE 42501", async () => {
    for (const path of Object.keys(LIST_TABLES)) {
      expect(await restProbe(`${path}?select=household_id`), path).toEqual({ status: 401, code: "42501" });
    }

    const anon = anonClient();
    for (const [table, columns] of Object.entries(LIST_TABLES)) {
      const result = await anon.schema("family").from(table).select(columns);
      expect(result.error?.code, table).toBe("42501");
      expect(result.data, table).toBeNull();
    }
  });

  it("authenticated INSERT is refused on both tables, nothing written (FR-539)", async () => {
    const probes: Record<string, Record<string, unknown>> = {
      lists: { household_id: fx.householdId, name: `Intruder ${fx.run}`, kind: "other", color: "#FDC36D" },
      list_items: { household_id: fx.householdId, list_id: mine.listId, text: `Intruder ${fx.run}` },
    };
    for (const [table, row] of Object.entries(probes)) {
      const result = await member.schema("family").from(table).insert(row);
      expect(result.error?.code, table).toBe("42501");
    }
    const { rows } = await pool.query("select count(*)::int as n from family.lists where name like $1", [`Intruder ${fx.run}%`]);
    expect(rows[0].n).toBe(0);
    const { rows: items } = await pool.query("select count(*)::int as n from family.list_items where text like $1", [
      `Intruder ${fx.run}%`,
    ]);
    expect(items[0].n).toBe(0);
  });

  it("authenticated UPDATE and DELETE are refused on both tables, nothing changed", async () => {
    const renamed = await member.schema("family").from("lists").update({ name: "Hijacked" }).eq("id", mine.listId);
    expect(renamed.error?.code).toBe("42501");
    const ticked = await member
      .schema("family")
      .from("list_items")
      .update({ checked_at: new Date().toISOString() })
      .eq("id", mine.itemId);
    expect(ticked.error?.code).toBe("42501");
    const removedItem = await member.schema("family").from("list_items").delete().eq("id", mine.itemId);
    expect(removedItem.error?.code).toBe("42501");
    const removedList = await member.schema("family").from("lists").delete().eq("id", mine.listId);
    expect(removedList.error?.code).toBe("42501");

    const { rows } = await pool.query<{ name: string }>("select name from family.lists where id = $1", [mine.listId]);
    expect(rows[0].name).toBe(`Party ${fx.run}`);
    const { rows: item } = await pool.query<{ checked_at: string | null }>(
      "select checked_at from family.list_items where id = $1",
      [mine.itemId],
    );
    expect(item).toHaveLength(1);
    expect(item[0].checked_at).toBeNull();
  });

  it("seed_default_lists is not callable through the API by anon or a member", async () => {
    const asMember = await member.schema("family").rpc("seed_default_lists", { p_household_id: fx.householdId });
    expect(asMember.error?.code).toBe("42501");
    const asAnon = await anonClient().schema("family").rpc("seed_default_lists", { p_household_id: fx.householdId });
    expect(asAnon.error?.code).toBe("42501");
    const { rows } = await pool.query<{ n: number }>(
      "select count(*)::int as n from family.lists where household_id = $1 and name in ('Grocery List', 'To-Do List')",
      [fx.householdId],
    );
    expect(rows[0].n).toBe(0);
  });
});
