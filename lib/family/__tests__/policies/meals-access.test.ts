/**
 * 006 T010 / SC-609 per path: `meal_categories`, `recipes`, `meals` and
 * `meal_exceptions` each read as a member (rows arrive), as an authenticated
 * non-member (`[]`) and anonymously (HTTP 401, SQLSTATE 42501). **No client
 * write path exists** on any of the four (FR-644): authenticated
 * INSERT/UPDATE/DELETE all fail 42501 with nothing written, because every meals
 * write goes through a server action holding the secret key. And the two
 * functions this phase adds are not callable by `anon` or `authenticated`
 * through the API (42501).
 *
 * The `lists-access` pattern: fixture rows are inserted by this file as
 * `postgres`, never taken from the seed, and a second household carries a full
 * row set on every path so "returns nothing" is proven against rows that really
 * exist.
 *
 * RED by design until T012 resets the stack onto 030–033.
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
const MEAL_TABLES = {
  meal_categories: "id, household_id",
  recipes: "id, household_id",
  meals: "id, household_id",
  meal_exceptions: "id, meal_id, household_id",
} as const;

/** One household's whole row set — a mealtime, a recipe, a meal, an exception. */
interface MealFixture {
  categoryId: string;
  recipeId: string;
  mealId: string;
  exceptionId: string;
}

async function insertOne(pool: Pool, sql: string, values: readonly unknown[]): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(sql, [...values]);
  const [row] = rows;
  if (!row) throw new Error(`${sql} returned no row`);
  return row.id;
}

/** Inserts the whole set as `postgres` (bypasses grants, not constraints). */
async function insertMealFixture(pool: Pool, householdId: string, profileId: string, tag: string): Promise<MealFixture> {
  const categoryId = await insertOne(
    pool,
    "insert into family.meal_categories (household_id, name, color, position, created_by) " +
      "values ($1, $2, '#915EA1', 9, $3) returning id",
    [householdId, `Supper ${tag}`, profileId],
  );
  const recipeId = await insertOne(
    pool,
    "insert into family.recipes (household_id, name, category_id, text, created_by) values ($1, $2, $3, '', $4) returning id",
    [householdId, `Stew ${tag}`, categoryId, profileId],
  );
  const mealId = await insertOne(
    pool,
    "insert into family.meals (household_id, date, category_id, recipe_id, rrule, created_by) " +
      "values ($1, '2026-09-04', $2, $3, 'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR', $4) returning id",
    [householdId, categoryId, recipeId, profileId],
  );
  const exceptionId = await insertOne(
    pool,
    "insert into family.meal_exceptions (household_id, meal_id, occurrence_date, action, created_by) " +
      "values ($1, $2, '2026-09-11', 'skip', $3) returning id",
    [householdId, mealId, profileId],
  );
  return { categoryId, recipeId, mealId, exceptionId };
}

/** The raw REST shape quickstart's SC-609 row documents: publishable key, no session. */
async function restProbe(path: string): Promise<{ status: number; code: string | undefined }> {
  const response = await fetch(`${LOCAL.url}/rest/v1/${path}`, {
    headers: { apikey: LOCAL.publishableKey, "Accept-Profile": "family" },
  });
  const body = (await response.json()) as { code?: string };
  return { status: response.status, code: body.code };
}

describe("meals access: SC-609 per path and the absent write path", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let otherHouseholdId: string;
  let mine: MealFixture;
  let theirs: MealFixture;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    stranger = await userClient(fx.users.stranger);

    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-meals-other`);
    const otherProfileId = await insertCategory(pool, {
      householdId: otherHouseholdId,
      label: `Other kid ${fx.run}`,
      color: "#B6E085",
    });
    theirs = await insertMealFixture(pool, otherHouseholdId, otherProfileId, `other-${fx.run}`);
    mine = await insertMealFixture(pool, fx.householdId, fx.anchorParentId, fx.run);
  });

  afterAll(async () => {
    try {
      await deleteHousehold(pool, otherHouseholdId);
      // Meals and exceptions cascade with the recipe; the mealtime goes last.
      await pool.query("delete from family.recipes where household_id = $1 and name like $2", [fx.householdId, `Stew ${fx.run}%`]);
      await pool.query("delete from family.meal_categories where household_id = $1 and name like $2", [fx.householdId, `Supper ${fx.run}%`]);
    } finally {
      await pool.end();
    }
  });

  it("a member reads their household's rows on all four paths, and no other household's", async () => {
    for (const table of Object.keys(MEAL_TABLES)) {
      const result = await member.schema("family").from(table).select("household_id");
      expect(result.error, table).toBeNull();
      expect(result.data?.length, table).toBeGreaterThan(0);
      expect(result.data?.every((row) => row.household_id === fx.householdId), table).toBe(true);
    }
    const meals = await member.schema("family").from("meals").select("id");
    expect(meals.data?.some((row) => row.id === mine.mealId)).toBe(true);
    expect(meals.data?.some((row) => row.id === theirs.mealId)).toBe(false);
    const exceptions = await member.schema("family").from("meal_exceptions").select("id");
    expect(exceptions.data?.some((row) => row.id === mine.exceptionId)).toBe(true);
    expect(exceptions.data?.some((row) => row.id === theirs.exceptionId)).toBe(false);
  });

  it("an authenticated non-member gets an empty set from every path", async () => {
    for (const [table, columns] of Object.entries(MEAL_TABLES)) {
      const result = await stranger.schema("family").from(table).select(columns);
      expect(result.error, table).toBeNull();
      expect(result.data, table).toEqual([]);
    }
  });

  it("anon with no session is refused on every path: HTTP 401, SQLSTATE 42501", async () => {
    for (const path of Object.keys(MEAL_TABLES)) {
      expect(await restProbe(`${path}?select=household_id`), path).toEqual({ status: 401, code: "42501" });
    }
    const anon = anonClient();
    for (const [table, columns] of Object.entries(MEAL_TABLES)) {
      const result = await anon.schema("family").from(table).select(columns);
      expect(result.error?.code, table).toBe("42501");
      expect(result.data, table).toBeNull();
    }
  });

  it("authenticated INSERT, UPDATE and DELETE are refused on every table, nothing written (FR-644)", async () => {
    const inserts: Record<string, Record<string, unknown>> = {
      meal_categories: { household_id: fx.householdId, name: `Intruder ${fx.run}`, color: "#FDC36D", position: 8 },
      recipes: { household_id: fx.householdId, name: `Intruder ${fx.run}`, category_id: mine.categoryId },
      meals: { household_id: fx.householdId, date: "2026-09-05", category_id: mine.categoryId, recipe_id: mine.recipeId },
      meal_exceptions: { household_id: fx.householdId, meal_id: mine.mealId, occurrence_date: "2026-09-18", action: "skip" },
    };
    for (const [table, row] of Object.entries(inserts)) {
      expect((await member.schema("family").from(table).insert(row)).error?.code, table).toBe("42501");
    }
    expect((await member.schema("family").from("recipes").update({ name: "Hijacked" }).eq("id", mine.recipeId)).error?.code).toBe("42501");
    expect((await member.schema("family").from("meals").delete().eq("id", mine.mealId)).error?.code).toBe("42501");

    const { rows } = await pool.query("select count(*)::int as n from family.recipes where name in ($1, 'Hijacked')", [`Intruder ${fx.run}`]);
    expect(rows[0].n).toBe(0);
    const still = await pool.query("select count(*)::int as n from family.meals where id = $1", [mine.mealId]);
    expect(still.rows[0].n).toBe(1);
  });

  it("neither function is callable through the API by anon or authenticated", async () => {
    for (const client of [anonClient(), member]) {
      const seed = await client.schema("family").rpc("seed_default_meal_categories", { p_household_id: fx.householdId });
      expect(seed.error?.code).toBe("42501");
      const split = await client.schema("family").rpc("split_meal_series", {
        p_household_id: fx.householdId,
        p_meal_id: mine.mealId,
        p_actor: null,
        p_head_rrule: "FREQ=DAILY;INTERVAL=1",
        p_cut: "2026-09-11",
        p_tail_meal: {},
      });
      expect(split.error?.code).toBe("42501");
    }
  });
});
