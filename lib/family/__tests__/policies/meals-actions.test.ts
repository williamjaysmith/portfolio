/**
 * 006 T026 — the eight meals actions end to end (contracts/server-actions.md),
 * every call off-interface, on the `lists-actions` plumbing: Next's cookie
 * store is an in-memory jar, the request's Supabase session is a real
 * signed-in client, and everything else (the guards, the signed actor cookie,
 * the admin client, RLS, 030–032's constraints, the split function) is
 * production code.
 *
 * Covered here:
 *   - nobody punched in → `NO_ACTOR`, nothing written;
 *   - `updateMealCategory`: a parent renames and recolours; a member is
 *     `FORBIDDEN`; a taken name (case-insensitive) is `CONFLICT` on `name`
 *     (FR-610, FR-640);
 *   - `createRecipe` / `updateRecipe` as a member; a removed recipe is
 *     `NOT_FOUND` to edit or plan (FR-615, R601);
 *   - `deleteRecipe` both ways: "recipe" marks and keeps the meals, "recipe
 *     and meals" cascades and counts (FR-616);
 *   - `planMeal` with an existing recipe and with a New Entry that also saves
 *     one in the slot's mealtime; with a repeat; an until before the date and
 *     a removed recipe refused (FR-622, FR-627);
 *   - `updateMeal`: a one-off takes no scope; `this` writes and merges an
 *     override, and refuses a recipe change; `this_and_future` on the first
 *     occurrence edits the row, otherwise splits — head truncated, tail with
 *     the patch, exceptions re-homed; `all` edits the row, and `never` clears
 *     the exceptions (FR-629, FR-630);
 *   - `deleteMeal`: one-off; `this` skips (an override becomes a skip);
 *     `this_and_future` truncates; `all` removes the row (FR-626, FR-629);
 *   - a wrong `occurrenceDate` → `NOT_FOUND`; tenancy → `NOT_FOUND` everywhere;
 *   - `addListItems`: N rows in order after the last, ungrouped, attributed; a
 *     Parents only list is `NOT_FOUND` to a member (FR-632).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import * as listsModule from "@/lib/family/actions/lists";
import * as mealsModule from "@/lib/family/actions/meals";
import type { ActionError, ActionResult } from "@/lib/family/errors";
import {
  LOCAL,
  adminClient,
  createPool,
  createUsers,
  deleteHousehold,
  deleteUsers,
  fixtures,
  insertCategory,
  insertHousehold,
  testEmail,
  userClient,
  type FixtureUser,
} from "./helpers";

const state = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  client: null as SupabaseClient | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));
vi.mock("next/headers", () => {
  const read = (name: string) => {
    const value = state.cookies.get(name);
    return value === undefined ? undefined : { name, value };
  };
  const jar = {
    get: read,
    getAll: () => [...state.cookies].map(([name, value]) => ({ name, value })),
    has: (name: string) => state.cookies.has(name),
    set(name: string, value: string, options?: { maxAge?: number }) {
      if (options?.maxAge === 0) state.cookies.delete(name);
      else state.cookies.set(name, value);
      return jar;
    },
    delete(name: string) {
      state.cookies.delete(name);
      return jar;
    },
  };
  return { cookies: async () => jar, headers: async () => new Headers() };
});
vi.mock("@/lib/family/supabase/server", () => ({
  createClient: async () => {
    if (!state.client) throw new Error("meals-actions.test: no signed-in client selected");
    return state.client;
  },
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");

const meals = mealsModule;
const lists = listsModule;

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

function expectFailure(result: ActionResult<unknown>, code: ActionError): string {
  expect(result).toMatchObject({ ok: false, error: code });
  return result.ok ? "" : result.message;
}

function expectFieldError(result: ActionResult<unknown>, code: ActionError, field: string): void {
  expect(result).toMatchObject({ ok: false, error: code });
  expect(Object.keys(result.ok ? {} : (result.fieldErrors ?? {}))).toContain(field);
}

const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000ff";
const FRIDAYS = "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR";

interface StoredMeal {
  id: string;
  date: string;
  category_id: string;
  recipe_id: string;
  note: string | null;
  rrule: string | null;
  updated_by: string | null;
}

interface StoredException {
  meal_id: string;
  occurrence_date: string;
  action: string;
  date: string | null;
  category_id: string | null;
  note: string | null;
}

describe("meals: the eight actions, open to every punched-in Profile save the mealtime pencil", () => {
  const fx = fixtures();
  const run = fx.run;
  const ANA_PIN = "8181";
  const CLEO_PIN = "8383";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  let anaId: string;
  let cleoId: string;
  /** The seeded four, by name. */
  let mealtime: Record<"Breakfast" | "Lunch" | "Dinner" | "Snack", string>;
  /** Re-seeded before every test. */
  let spaghettiId: string;
  let pizzaId: string;
  let removedId: string;
  let wednesdayId: string;
  let pizzaSeriesId: string;
  let groceryId: string;
  let partyId: string;
  let foreignRecipeId: string;
  let foreignCategoryId: string;

  async function one<T extends { id: string }>(sql: string, values: unknown[]): Promise<string> {
    const { rows } = await pool.query<T>(sql, values);
    const [row] = rows;
    if (!row) throw new Error(`${sql} returned no row`);
    return row.id;
  }

  const insertRecipe = (targetHousehold: string, categoryId: string, name: string, text = "", removed = false) =>
    one(
      "insert into family.recipes (household_id, name, category_id, text, removed_at, created_by) values ($1, $2, $3, $4, $5, $6) returning id",
      [targetHousehold, name, categoryId, text, removed ? new Date().toISOString() : null, targetHousehold === householdId ? anaId : null],
    );

  const insertMeal = (categoryId: string, recipeId: string, date: string, rrule: string | null = null, note: string | null = null) =>
    one(
      "insert into family.meals (household_id, date, category_id, recipe_id, note, rrule, created_by, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $7) returning id",
      [householdId, date, categoryId, recipeId, note, rrule, anaId],
    );

  async function storedMeal(id: string): Promise<StoredMeal | undefined> {
    const { rows } = await pool.query<StoredMeal>(
      "select id, date::text as date, category_id, recipe_id, note, rrule, updated_by from family.meals where id = $1",
      [id],
    );
    return rows[0];
  }

  async function storedMealsOf(recipeId: string): Promise<StoredMeal[]> {
    const { rows } = await pool.query<StoredMeal>(
      "select id, date::text as date, category_id, recipe_id, note, rrule, updated_by from family.meals where recipe_id = $1 order by date",
      [recipeId],
    );
    return rows;
  }

  async function storedExceptions(mealId: string): Promise<StoredException[]> {
    const { rows } = await pool.query<StoredException>(
      "select meal_id, occurrence_date::text as occurrence_date, action, date::text as date, category_id, note " +
        "from family.meal_exceptions where meal_id = $1 order by occurrence_date",
      [mealId],
    );
    return rows;
  }

  async function storedRecipe(id: string): Promise<{ name: string; category_id: string; text: string; removed_at: string | null } | undefined> {
    const { rows } = await pool.query("select name, category_id, text, removed_at from family.recipes where id = $1", [id]);
    return rows[0];
  }

  async function givePin(profileId: string, pin: string): Promise<void> {
    const { error } = await admin.schema("family").rpc("set_pin", { p_user_id: user.id, p_profile: profileId, p_pin: pin });
    if (error) throw error;
  }

  async function punchInAs(profileId: string, pin: string): Promise<void> {
    state.cookies.clear();
    expectOk(await punchIn(profileId, pin));
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-meals-actions`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-meals-actions-other`);
    await pool.query("update family.household_settings set timezone = 'America/Chicago' where household_id = $1", [householdId]);

    const email = testEmail("meals-actions", run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [householdId, email]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error("expected one fixture account");
    user = created;

    anaId = await insertCategory(pool, { householdId, label: `Ana ${run}`, color: "#2178AF", role: "parent" });
    cleoId = await insertCategory(pool, { householdId, label: `Cleo ${run}`, color: "#93D1E6" });

    await pool.query("select family.seed_default_meal_categories($1)", [householdId]);
    await pool.query("select family.seed_default_meal_categories($1)", [otherHouseholdId]);
    const { rows } = await pool.query<{ id: string; name: string }>("select id, name from family.meal_categories where household_id = $1", [householdId]);
    mealtime = Object.fromEntries(rows.map((row) => [row.name, row.id])) as typeof mealtime;
    const foreign = await pool.query<{ id: string }>("select id from family.meal_categories where household_id = $1 limit 1", [otherHouseholdId]);
    foreignCategoryId = foreign.rows[0].id;
    foreignRecipeId = await insertRecipe(otherHouseholdId, foreignCategoryId, `Foreign ${run}`);

    groceryId = await one(
      "insert into family.lists (household_id, name, kind, color, parents_only, sort_order, created_by) values ($1, $2, 'grocery', '#B6E085', false, 1000, $3) returning id",
      [householdId, `Grocery ${run}`, anaId],
    );
    partyId = await one(
      "insert into family.lists (household_id, name, kind, color, parents_only, sort_order, created_by) values ($1, $2, 'other', '#D5B6EC', true, 2000, $3) returning id",
      [householdId, `Party ${run}`, anaId],
    );
    await pool.query("insert into family.list_items (household_id, list_id, text, sort_order, created_by) values ($1, $2, 'Eggs', 1000, $3)", [householdId, groceryId, anaId]);

    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(anaId, ANA_PIN);
    await givePin(cleoId, CLEO_PIN);
  });

  beforeEach(async () => {
    // Meals and exceptions cascade with their recipes.
    await pool.query("delete from family.recipes where household_id = $1", [householdId]);
    spaghettiId = await insertRecipe(householdId, mealtime.Dinner, `Spaghetti ${run}`, "500 g spaghetti\n1 onion");
    pizzaId = await insertRecipe(householdId, mealtime.Dinner, `Pizza ${run}`);
    removedId = await insertRecipe(householdId, mealtime.Dinner, `Old stew ${run}`, "", true);
    wednesdayId = await insertMeal(mealtime.Dinner, spaghettiId, "2026-09-09", null, "Ben cooks");
    pizzaSeriesId = await insertMeal(mealtime.Dinner, pizzaId, "2026-09-04", FRIDAYS);
    state.cookies.clear();
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteHousehold(pool, otherHouseholdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  // ── nobody ────────────────────────────────────────────────────────────────

  describe("with nobody punched in every verb is NO_ACTOR and nothing is written", () => {
    it("planMeal, updateMeal, deleteMeal, createRecipe, updateMealCategory, addListItems", async () => {
      expectFailure(await meals.planMeal({ date: "2026-09-10", categoryId: mealtime.Lunch, recipe: { kind: "existing", id: spaghettiId } }), "NO_ACTOR");
      expectFailure(await meals.updateMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", patch: { note: "x" } }), "NO_ACTOR");
      expectFailure(await meals.deleteMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", confirm: true }), "NO_ACTOR");
      expectFailure(await meals.createRecipe({ name: "Toast", categoryId: mealtime.Breakfast }), "NO_ACTOR");
      expectFailure(await meals.updateMealCategory({ id: mealtime.Snack, patch: { name: "Tea" } }), "NO_ACTOR");
      expectFailure(await lists.addListItems({ listId: groceryId, texts: ["Milk"] }), "NO_ACTOR");
      expect((await storedMeal(wednesdayId))?.note).toBe("Ben cooks");
      expect((await storedMealsOf(spaghettiId)).length).toBe(1);
    });
  });

  // ── mealtimes ─────────────────────────────────────────────────────────────

  describe("updateMealCategory (FR-610, FR-612, FR-640)", () => {
    it("renames and recolours as a parent, and the change carries the meals planned in it", async () => {
      await punchInAs(anaId, ANA_PIN);
      const updated = expectOk(await meals.updateMealCategory({ id: mealtime.Snack, patch: { name: "  Tea ", color: "#FDC36D" } }));
      expect(updated).toMatchObject({ id: mealtime.Snack, name: "Tea", color: "#FDC36D", updatedBy: anaId });
      const dinner = expectOk(await meals.updateMealCategory({ id: mealtime.Dinner, patch: { name: "Supper" } }));
      expect(dinner.name).toBe("Supper");
      expect((await storedMeal(wednesdayId))?.category_id).toBe(mealtime.Dinner);
      expectOk(await meals.updateMealCategory({ id: mealtime.Dinner, patch: { name: "Dinner" } }));
      expectOk(await meals.updateMealCategory({ id: mealtime.Snack, patch: { name: "Snack" } }));
    });

    it("is FORBIDDEN to a member, and a taken name is CONFLICT on the field", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      expectFailure(await meals.updateMealCategory({ id: mealtime.Snack, patch: { name: "Tea" } }), "FORBIDDEN");
      await punchInAs(anaId, ANA_PIN);
      expectFieldError(await meals.updateMealCategory({ id: mealtime.Snack, patch: { name: "dinner" } }), "CONFLICT", "name");
      expectFailure(await meals.updateMealCategory({ id: foreignCategoryId, patch: { name: "Mine now" } }), "NOT_FOUND");
      expectFailure(await meals.updateMealCategory({ id: mealtime.Snack, patch: {} }), "VALIDATION");
    });
  });

  // ── recipes ───────────────────────────────────────────────────────────────

  describe("recipes as a member (FR-613–FR-616)", () => {
    beforeEach(async () => {
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("creates and edits a recipe, attributed; a removed one is NOT_FOUND to edit", async () => {
      const made = expectOk(await meals.createRecipe({ name: " Toast ", categoryId: mealtime.Breakfast, text: "bread\nbutter" }));
      expect(made).toMatchObject({ name: "Toast", categoryId: mealtime.Breakfast, text: "bread\nbutter", removedAt: null, createdBy: cleoId });
      const edited = expectOk(await meals.updateRecipe({ id: made.id, patch: { categoryId: mealtime.Snack, text: "bread\nbutter\njam" } }));
      expect(edited).toMatchObject({ categoryId: mealtime.Snack, text: "bread\nbutter\njam", updatedBy: cleoId });
      expectFailure(await meals.updateRecipe({ id: removedId, patch: { name: "Newer stew" } }), "NOT_FOUND");
      expectFailure(await meals.updateRecipe({ id: foreignRecipeId, patch: { name: "Mine" } }), "NOT_FOUND");
      expectFailure(await meals.createRecipe({ name: "Cross", categoryId: foreignCategoryId }), "NOT_FOUND");
    });

    it("deleteRecipe 'recipe' marks it removed and keeps its meals; 'recipe_and_meals' cascades and counts", async () => {
      const keep = expectOk(await meals.deleteRecipe({ id: spaghettiId, mode: "recipe", confirm: true }));
      expect(keep).toEqual({ removedMeals: 0 });
      expect((await storedRecipe(spaghettiId))?.removed_at).not.toBeNull();
      expect(await storedMeal(wednesdayId)).toBeDefined();
      expectFailure(await meals.deleteRecipe({ id: spaghettiId, mode: "recipe", confirm: true }), "NOT_FOUND");

      const gone = expectOk(await meals.deleteRecipe({ id: pizzaId, mode: "recipe_and_meals", confirm: true }));
      expect(gone).toEqual({ removedMeals: 1 });
      expect(await storedRecipe(pizzaId)).toBeUndefined();
      expect(await storedMeal(pizzaSeriesId)).toBeUndefined();
      // The already-removed recipe can still go for good with its meals.
      expect(expectOk(await meals.deleteRecipe({ id: spaghettiId, mode: "recipe_and_meals", confirm: true }))).toEqual({ removedMeals: 1 });
      expect(await storedMeal(wednesdayId)).toBeUndefined();
    });
  });

  // ── planning ──────────────────────────────────────────────────────────────

  describe("planMeal (FR-622, FR-624, FR-627)", () => {
    beforeEach(async () => {
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("plans an existing recipe into a slot with a note, attributed", async () => {
      const meal = expectOk(await meals.planMeal({ date: "2026-09-10", categoryId: mealtime.Lunch, recipe: { kind: "existing", id: spaghettiId }, note: " leftovers " }));
      expect(meal).toMatchObject({ date: "2026-09-10", categoryId: mealtime.Lunch, recipeId: spaghettiId, note: "leftovers", rrule: null, exceptions: [], createdBy: cleoId });
    });

    it("a New Entry saves a recipe in the slot's mealtime and plans it", async () => {
      const meal = expectOk(await meals.planMeal({ date: "2026-09-10", categoryId: mealtime.Breakfast, recipe: { kind: "new", name: "🥞 Pancakes", text: "flour\neggs" } }));
      const recipe = await storedRecipe(meal.recipeId);
      expect(recipe).toMatchObject({ name: "🥞 Pancakes", category_id: mealtime.Breakfast, text: "flour\neggs", removed_at: null });
    });

    it("stores a repeat as the calendar's rule with a date UNTIL, and refuses an end before the date", async () => {
      const meal = expectOk(
        await meals.planMeal({
          date: "2026-09-11",
          categoryId: mealtime.Dinner,
          recipe: { kind: "existing", id: pizzaId },
          repeat: { kind: "weekly", weekdays: ["FR"], until: "2026-12-31" },
        }),
      );
      expect(meal.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;UNTIL=20261231;WKST=SU;BYDAY=FR");
      expectFieldError(
        await meals.planMeal({ date: "2026-09-11", categoryId: mealtime.Dinner, recipe: { kind: "existing", id: pizzaId }, repeat: { kind: "daily", until: "2026-09-10" } }),
        "VALIDATION",
        "repeat",
      );
    });

    it("refuses a removed recipe, a foreign recipe and a foreign mealtime", async () => {
      expectFailure(await meals.planMeal({ date: "2026-09-10", categoryId: mealtime.Dinner, recipe: { kind: "existing", id: removedId } }), "NOT_FOUND");
      expectFailure(await meals.planMeal({ date: "2026-09-10", categoryId: mealtime.Dinner, recipe: { kind: "existing", id: foreignRecipeId } }), "NOT_FOUND");
      expectFailure(await meals.planMeal({ date: "2026-09-10", categoryId: foreignCategoryId, recipe: { kind: "existing", id: spaghettiId } }), "NOT_FOUND");
    });
  });

  // ── editing ───────────────────────────────────────────────────────────────

  describe("updateMeal (FR-626, FR-629, FR-630)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("edits a one-off in place and refuses a scope on it; a wrong occurrence date is NOT_FOUND", async () => {
      const moved = expectOk(await meals.updateMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", patch: { date: "2026-09-10", categoryId: mealtime.Lunch, note: null } }));
      expect(moved).toMatchObject({ date: "2026-09-10", categoryId: mealtime.Lunch, note: null, updatedBy: anaId });
      expectFieldError(await meals.updateMeal({ id: wednesdayId, occurrenceDate: "2026-09-10", scope: "all", patch: { note: "x" } }), "VALIDATION", "scope");
      expectFailure(await meals.updateMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", patch: { note: "x" } }), "NOT_FOUND");
      expectFailure(await meals.updateMeal({ id: UNKNOWN_ID, occurrenceDate: "2026-09-09", patch: { note: "x" } }), "NOT_FOUND");
    });

    it("turns a one-off into a series, and a series into a one-off with its exceptions gone", async () => {
      const series = expectOk(await meals.updateMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", patch: { repeat: { kind: "weekly", weekdays: ["WE"] } } }));
      expect(series.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=WE");
      expectOk(await meals.deleteMeal({ id: wednesdayId, occurrenceDate: "2026-09-16", scope: "this", confirm: true }));
      expect((await storedExceptions(wednesdayId)).length).toBe(1);
      const single = expectOk(await meals.updateMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", scope: "all", patch: { repeat: { kind: "never" } } }));
      expect(single.rrule).toBeNull();
      expect(await storedExceptions(wednesdayId)).toEqual([]);
    });

    it("requires a scope on a series; at 'this' writes an override, merges a second, and refuses a recipe change", async () => {
      expectFieldError(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-11", patch: { note: "x" } }), "VALIDATION", "scope");
      expectOk(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-11", scope: "this", patch: { date: "2026-09-12" } }));
      expectOk(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-11", scope: "this", patch: { note: "movie night" } }));
      expect(await storedExceptions(pizzaSeriesId)).toEqual([
        { meal_id: pizzaSeriesId, occurrence_date: "2026-09-11", action: "override", date: "2026-09-12", category_id: null, note: "movie night" },
      ]);
      expectOk(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-11", scope: "this", patch: { note: null } }));
      expect((await storedExceptions(pizzaSeriesId))[0].note).toBe("");
      expectFieldError(
        await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-18", scope: "this", patch: { recipeId: spaghettiId } }),
        "VALIDATION",
        "patch",
      );
      expect((await storedMeal(pizzaSeriesId))?.rrule).toBe(FRIDAYS);
    });

    it("'this and future' on the first occurrence edits the row; later it splits, re-homing exceptions", async () => {
      const whole = expectOk(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-04", scope: "this_and_future", patch: { note: "every Friday" } }));
      expect(whole.id).toBe(pizzaSeriesId);
      expect(whole.note).toBe("every Friday");

      expectOk(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-11", scope: "this", confirm: true }));
      expectOk(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-10-02", scope: "this", confirm: true }));
      const tail = expectOk(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-25", scope: "this_and_future", patch: { categoryId: mealtime.Lunch, recipeId: spaghettiId } }));
      expect(tail.id).not.toBe(pizzaSeriesId);
      expect(tail).toMatchObject({ date: "2026-09-25", categoryId: mealtime.Lunch, recipeId: spaghettiId, rrule: FRIDAYS, note: "every Friday" });
      expect((await storedMeal(pizzaSeriesId))?.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;UNTIL=20260924;WKST=SU;BYDAY=FR");
      expect((await storedExceptions(pizzaSeriesId)).map((row) => row.occurrence_date)).toEqual(["2026-09-11"]);
      expect((await storedExceptions(tail.id)).map((row) => row.occurrence_date)).toEqual(["2026-10-02"]);
    });

    it("'all' edits the row and re-anchors a moved series", async () => {
      const moved = expectOk(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-18", scope: "all", patch: { date: "2026-09-05", note: "Saturdays now", repeat: { kind: "weekly", weekdays: ["SA"] } } }));
      expect(moved).toMatchObject({ id: pizzaSeriesId, date: "2026-09-05", note: "Saturdays now", rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=SA" });
    });
  });

  // ── deleting ──────────────────────────────────────────────────────────────

  describe("deleteMeal (FR-626, FR-629)", () => {
    beforeEach(async () => {
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("removes a one-off, needs confirm, and refuses a scope on it", async () => {
      expectFailure(await meals.deleteMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", confirm: false as unknown as true }), "VALIDATION");
      expectFieldError(await meals.deleteMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", scope: "all", confirm: true }), "VALIDATION", "scope");
      expectOk(await meals.deleteMeal({ id: wednesdayId, occurrenceDate: "2026-09-09", confirm: true }));
      expect(await storedMeal(wednesdayId)).toBeUndefined();
      expect(await storedRecipe(spaghettiId)).toBeDefined();
    });

    it("'this' skips the occurrence — an override there becomes the skip", async () => {
      expectOk(await meals.updateMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-11", scope: "this", patch: { note: "x" } }));
      expectOk(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-11", scope: "this", confirm: true }));
      expect(await storedExceptions(pizzaSeriesId)).toEqual([
        { meal_id: pizzaSeriesId, occurrence_date: "2026-09-11", action: "skip", date: null, category_id: null, note: null },
      ]);
      expect(await storedMeal(pizzaSeriesId)).toBeDefined();
    });

    it("'this and future' truncates the rule and drops later exceptions; on the first occurrence removes the row", async () => {
      expectOk(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-10-02", scope: "this", confirm: true }));
      expectOk(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-25", scope: "this_and_future", confirm: true }));
      expect((await storedMeal(pizzaSeriesId))?.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;UNTIL=20260924;WKST=SU;BYDAY=FR");
      expect(await storedExceptions(pizzaSeriesId)).toEqual([]);
      expectOk(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-04", scope: "this_and_future", confirm: true }));
      expect(await storedMeal(pizzaSeriesId)).toBeUndefined();
    });

    it("'all' removes the series; a non-occurrence is NOT_FOUND", async () => {
      expectFailure(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-10", scope: "all", confirm: true }), "NOT_FOUND");
      expectOk(await meals.deleteMeal({ id: pizzaSeriesId, occurrenceDate: "2026-09-18", scope: "all", confirm: true }));
      expect(await storedMeal(pizzaSeriesId)).toBeUndefined();
    });
  });

  // ── the push ──────────────────────────────────────────────────────────────

  describe("addListItems (FR-632)", () => {
    it("appends the lines in order after the last item, ungrouped and attributed, in one write", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const added = expectOk(await lists.addListItems({ listId: groceryId, texts: ["500 g spaghetti", " 1 onion ", "parmesan"] }));
      expect(added).toEqual({ added: 3 });
      const { rows } = await pool.query<{ text: string; section: string | null; sort_order: string; created_by: string | null; checked_at: string | null }>(
        "select text, section, sort_order::text as sort_order, created_by, checked_at::text as checked_at from family.list_items where list_id = $1 order by sort_order",
        [groceryId],
      );
      expect(rows.map((row) => row.text)).toEqual(["Eggs", "500 g spaghetti", "1 onion", "parmesan"]);
      expect(rows.slice(1).every((row) => row.section === null && row.created_by === cleoId && row.checked_at === null)).toBe(true);
      expect(rows.map((row) => Number(row.sort_order))).toEqual([1000, 2000, 3000, 4000]);
    });

    it("is NOT_FOUND on a Parents only list for a member, and lands for a parent", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      expectFailure(await lists.addListItems({ listId: partyId, texts: ["Candles"] }), "NOT_FOUND");
      await punchInAs(anaId, ANA_PIN);
      expect(expectOk(await lists.addListItems({ listId: partyId, texts: ["Candles"] }))).toEqual({ added: 1 });
      expectFailure(await lists.addListItems({ listId: groceryId, texts: [] }), "VALIDATION");
    });
  });
});
