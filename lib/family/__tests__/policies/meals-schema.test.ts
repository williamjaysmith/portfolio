/**
 * 006 T009: the Meals schema pinned at the store — migrations 030–032 as
 * data-model.md writes them — exercised through the secret key the way the
 * server actions write, so every refusal surfaces as the SQLSTATE the actions
 * must map and every named constraint is shown doing its job on a real row.
 *
 * Covered here:
 *   - **mealtimes** (FR-608–FR-612): the name bounds; the case-insensitive
 *     unique name; the unique position; a palette colour only;
 *     `seed_default_meal_categories` → 4 with the exact rows, then 0;
 *   - **recipes** (FR-613, FR-616): the name and text bounds; `removed_at`
 *     nullable; a mealtime of another household refused by the composite FK;
 *     a mealtime referenced by a recipe cannot be deleted (restrict);
 *   - **meals and exceptions** (FR-622–FR-630): the note bound; the rule
 *     grammar (a date UNTIL accepted, COUNT and an instant UNTIL refused); one
 *     exception per occurrence; the payload shapes; the cascades — a recipe
 *     row delete takes its meals and their exceptions; attribution nulls when
 *     a Profile goes; the touch trigger;
 *   - **`split_meal_series`** (R603): head truncated, tail inserted from the
 *     payload, exceptions on/after the cut re-homed, and nothing changed when
 *     the tail payload is refused (one transaction).
 *
 * Fixture rows are created here in a run-tagged household of this file's own,
 * never taken from the seed, so nothing here can drift with — or damage — the
 * seeded tab.
 *
 * RED by design until T012 resets the stack onto 030–033: every write below
 * fails with `42P01` (no such relation) while the tables do not exist.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import {
  adminClient,
  createPool,
  deleteHousehold,
  fixtures,
  insertCategory,
  insertHousehold,
} from "./helpers";

interface StoreRefusal {
  code: string;
  message: string;
}

function expectRefusal(error: StoreRefusal | null, sqlstate: string, detail: string): void {
  expect(error?.code, detail).toBe(sqlstate);
  expect(error?.message, detail).toContain(detail);
}

const CATEGORY_COLUMNS = "id, name, color, position, created_by, updated_by, updated_at";
const RECIPE_COLUMNS = "id, name, category_id, text, removed_at, created_by, updated_by";
const MEAL_COLUMNS = "id, date, category_id, recipe_id, note, rrule, created_by, updated_by";
const EXCEPTION_COLUMNS = "id, meal_id, occurrence_date, action, date, category_id, note";

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  position: number;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
}
interface RecipeRow {
  id: string;
  name: string;
  category_id: string;
  text: string;
  removed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}
interface MealRow {
  id: string;
  date: string;
  category_id: string;
  recipe_id: string;
  note: string | null;
  rrule: string | null;
  created_by: string | null;
  updated_by: string | null;
}
interface ExceptionRow {
  id: string;
  meal_id: string;
  occurrence_date: string;
  action: string;
  date: string | null;
  category_id: string | null;
  note: string | null;
}

describe("meals schema: four tables, their constraints, the cascades and the two functions", () => {
  const fx = fixtures();
  let pool: Pool;
  let admin: SupabaseClient;
  let householdId: string;
  let anaId: string;
  /** The seeded four, by name. */
  let mealtimes: Map<string, CategoryRow>;

  const table = (name: string) => admin.schema("family").from(name);

  const insertCategoryRow = (row: Record<string, unknown>) =>
    table("meal_categories")
      .insert({ household_id: householdId, color: "#A8D4D3", created_by: anaId, updated_by: anaId, ...row })
      .select(CATEGORY_COLUMNS)
      .single();

  const insertRecipe = (row: Record<string, unknown>) =>
    table("recipes")
      .insert({
        household_id: householdId,
        category_id: mealtimes.get("Dinner")?.id,
        created_by: anaId,
        updated_by: anaId,
        ...row,
      })
      .select(RECIPE_COLUMNS)
      .single();

  async function createRecipe(name: string, row: Record<string, unknown> = {}): Promise<RecipeRow> {
    const { data, error } = await insertRecipe({ name: `${name} ${fx.run}`, ...row });
    if (error) throw error;
    return data as RecipeRow;
  }

  const insertMeal = (row: Record<string, unknown>) =>
    table("meals")
      .insert({
        household_id: householdId,
        category_id: mealtimes.get("Dinner")?.id,
        created_by: anaId,
        updated_by: anaId,
        ...row,
      })
      .select(MEAL_COLUMNS)
      .single();

  async function createMeal(recipeId: string, date: string, row: Record<string, unknown> = {}): Promise<MealRow> {
    const { data, error } = await insertMeal({ recipe_id: recipeId, date, ...row });
    if (error) throw error;
    return data as MealRow;
  }

  const insertException = (mealId: string, row: Record<string, unknown>) =>
    table("meal_exceptions")
      .insert({ household_id: householdId, meal_id: mealId, created_by: anaId, ...row })
      .select(EXCEPTION_COLUMNS)
      .single();

  async function readExceptions(mealId: string): Promise<ExceptionRow[]> {
    const { data, error } = await table("meal_exceptions").select(EXCEPTION_COLUMNS).eq("meal_id", mealId);
    if (error) throw error;
    return data as ExceptionRow[];
  }

  async function readMeal(id: string): Promise<MealRow | null> {
    const { data, error } = await table("meals").select(MEAL_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data as MealRow | null;
  }

  async function seedMealtimes(forHousehold: string): Promise<number> {
    const { rows } = await pool.query<{ seeded: number }>(
      "select family.seed_default_meal_categories($1) as seeded",
      [forHousehold],
    );
    return rows[0].seeded;
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();
    householdId = await insertHousehold(pool, `test-${fx.run}-meals-schema`);
    anaId = await insertCategory(pool, { householdId, label: `Ana ${fx.run}`, color: "#915EA1", role: "parent" });
    expect(await seedMealtimes(householdId)).toBe(4);
    const { data, error } = await table("meal_categories").select(CATEGORY_COLUMNS).eq("household_id", householdId);
    if (error) throw error;
    mealtimes = new Map((data as CategoryRow[]).map((row) => [row.name, row]));
  });

  afterAll(async () => {
    try {
      await deleteHousehold(pool, householdId);
    } finally {
      await pool.end();
    }
  });

  // ── mealtimes ─────────────────────────────────────────────────────────────

  describe("the four mealtimes (FR-608–FR-612)", () => {
    it("are seeded exactly once — the reference's names, the live colours, positions 1–4", () => {
      expect([...mealtimes.values()].sort((a, b) => a.position - b.position).map((row) => [row.name, row.color, row.position])).toEqual([
        ["Breakfast", "#A8D4D3", 1],
        ["Lunch", "#F66951", 2],
        ["Dinner", "#915EA1", 3],
        ["Snack", "#FDC36D", 4],
      ]);
    });

    it("seeds nothing for a household that already has mealtimes", async () => {
      expect(await seedMealtimes(householdId)).toBe(0);
      const { count } = await table("meal_categories").select("id", { count: "exact", head: true }).eq("household_id", householdId);
      expect(count).toBe(4);
    });

    it("refuses a blank, spaces-only or 41-character name", async () => {
      expectRefusal((await insertCategoryRow({ name: "", position: 9 })).error, "23514", "meal_categories_name_check");
      expectRefusal((await insertCategoryRow({ name: "   ", position: 9 })).error, "23514", "meal_categories_name_check");
      expectRefusal((await insertCategoryRow({ name: "x".repeat(41), position: 9 })).error, "23514", "meal_categories_name_check");
    });

    it("refuses a name already used, compared trimmed and case-insensitively (FR-610)", async () => {
      expectRefusal((await insertCategoryRow({ name: "dinner", position: 9 })).error, "23505", "meal_categories_name_key");
      expectRefusal((await insertCategoryRow({ name: " Snack ", position: 9 })).error, "23505", "meal_categories_name_key");
    });

    it("refuses a taken position and an off-palette colour", async () => {
      expectRefusal((await insertCategoryRow({ name: `Fifth ${fx.run}`, position: 1 })).error, "23505", "meal_categories_position_key");
      const offPalette = await insertCategoryRow({ name: `Fifth ${fx.run}`, position: 9, color: "#123456" });
      expect(offPalette.error?.code).toBe("23514");
      expect(offPalette.error?.message).toContain("palette_color");
    });

    it("cannot be deleted while a recipe names it (restrict), and moves updated_at on a rename", async () => {
      const dinner = mealtimes.get("Dinner") as CategoryRow;
      await createRecipe("Holds dinner");
      const { error } = await table("meal_categories").delete().eq("id", dinner.id);
      expectRefusal(error, "23503", "recipes_category_fk");

      await new Promise((resolve) => setTimeout(resolve, 20));
      const renamed = await table("meal_categories").update({ name: `Supper ${fx.run}` }).eq("id", dinner.id).select("updated_at").single();
      expect(renamed.error).toBeNull();
      expect(new Date((renamed.data as { updated_at: string }).updated_at).getTime()).toBeGreaterThan(new Date(dinner.updated_at).getTime());
      await table("meal_categories").update({ name: "Dinner" }).eq("id", dinner.id);
    });
  });

  // ── recipes ───────────────────────────────────────────────────────────────

  describe("a recipe's shape (FR-613, FR-616)", () => {
    it("refuses a blank or 121-character name and a text over 10 000; accepts the empty text", async () => {
      expectRefusal((await insertRecipe({ name: "" })).error, "23514", "recipes_name_check");
      expectRefusal((await insertRecipe({ name: "x".repeat(121) })).error, "23514", "recipes_name_check");
      expectRefusal((await insertRecipe({ name: `Long ${fx.run}`, text: "x".repeat(10001) })).error, "23514", "recipes_text_check");
      const recipe = await createRecipe("Bare");
      expect(recipe.text).toBe("");
      expect(recipe.removed_at).toBeNull();
      expect(recipe.created_by).toBe(anaId);
    });

    it("refuses a mealtime of another household — the composite FK", async () => {
      const otherHousehold = await insertHousehold(pool, `test-${fx.run}-meals-other`);
      try {
        await seedMealtimes(otherHousehold);
        const { rows } = await pool.query<{ id: string }>("select id from family.meal_categories where household_id = $1 limit 1", [otherHousehold]);
        expectRefusal((await insertRecipe({ name: `Cross ${fx.run}`, category_id: rows[0].id })).error, "23503", "recipes_category_fk");
      } finally {
        await deleteHousehold(pool, otherHousehold);
      }
    });

    it("marks 'Just the recipe' with removed_at and keeps the row readable", async () => {
      const recipe = await createRecipe("Removed");
      const { data, error } = await table("recipes").update({ removed_at: new Date().toISOString() }).eq("id", recipe.id).select("removed_at").single();
      expect(error).toBeNull();
      expect((data as { removed_at: string | null }).removed_at).not.toBeNull();
    });
  });

  // ── meals and exceptions ──────────────────────────────────────────────────

  describe("a meal's shape (FR-622–FR-628)", () => {
    let recipe: RecipeRow;
    beforeAll(async () => {
      recipe = await createRecipe("Planned");
    });

    it("refuses a blank or 201-character note; accepts none and 200", async () => {
      expectRefusal((await insertMeal({ recipe_id: recipe.id, date: "2026-09-09", note: "" })).error, "23514", "meals_note_check");
      expectRefusal((await insertMeal({ recipe_id: recipe.id, date: "2026-09-09", note: "x".repeat(201) })).error, "23514", "meals_note_check");
      const meal = await createMeal(recipe.id, "2026-09-09", { note: "y".repeat(200) });
      expect(meal.note?.length).toBe(200);
      expect(meal.rrule).toBeNull();
    });

    it("accepts the calendar's grammar with a date UNTIL and refuses COUNT, an instant UNTIL and a bare rule", async () => {
      const weekly = await createMeal(recipe.id, "2026-09-11", { rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20261231" });
      expect(weekly.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20261231");
      expectRefusal((await insertMeal({ recipe_id: recipe.id, date: "2026-09-11", rrule: "FREQ=WEEKLY;INTERVAL=1;COUNT=4" })).error, "23514", "meals_rrule_check");
      expectRefusal((await insertMeal({ recipe_id: recipe.id, date: "2026-09-11", rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261231T235959Z" })).error, "23514", "meals_rrule_check");
      expectRefusal((await insertMeal({ recipe_id: recipe.id, date: "2026-09-11", rrule: "FREQ=WEEKLY" })).error, "23514", "meals_rrule_check");
    });

    it("keeps one exception per occurrence, a skip empty and an override with a payload", async () => {
      const series = await createMeal(recipe.id, "2026-09-04", { rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
      expect((await insertException(series.id, { occurrence_date: "2026-09-11", action: "skip" })).error).toBeNull();
      expectRefusal(
        (await insertException(series.id, { occurrence_date: "2026-09-11", action: "override", date: "2026-09-12" })).error,
        "23505",
        "meal_exceptions_occurrence_key",
      );
      expectRefusal(
        (await insertException(series.id, { occurrence_date: "2026-09-18", action: "skip", date: "2026-09-19" })).error,
        "23514",
        "meal_exception_payload_shape",
      );
      expectRefusal(
        (await insertException(series.id, { occurrence_date: "2026-09-18", action: "override" })).error,
        "23514",
        "meal_exception_payload_shape",
      );
      expectRefusal(
        (await insertException(series.id, { occurrence_date: "2026-09-18", action: "move", date: "2026-09-19" })).error,
        "23514",
        "meal_exceptions_action_check",
      );
      const moved = await insertException(series.id, { occurrence_date: "2026-09-18", action: "override", date: "2026-09-19", note: "" });
      expect(moved.error).toBeNull();
    });

    it("cascades a recipe delete to its meals and their exceptions — FR-616's second choice", async () => {
      const doomed = await createRecipe("Doomed");
      const series = await createMeal(doomed.id, "2026-10-02", { rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
      await insertException(series.id, { occurrence_date: "2026-10-09", action: "skip" });
      const { error } = await table("recipes").delete().eq("id", doomed.id);
      expect(error).toBeNull();
      expect(await readMeal(series.id)).toBeNull();
      expect(await readExceptions(series.id)).toEqual([]);
    });

    it("keeps every row and nulls the attribution when the Profile who planned goes (FR-645)", async () => {
      const cook = await insertCategory(pool, { householdId, label: `Cook ${fx.run}`, color: "#B6E085" });
      const recipeByCook = await createRecipe("By cook", { created_by: cook, updated_by: cook });
      const meal = await createMeal(recipeByCook.id, "2026-09-20", { created_by: cook, updated_by: cook });
      await pool.query("delete from family.categories where id = $1", [cook]);
      const after = await readMeal(meal.id);
      expect(after).not.toBeNull();
      expect(after?.created_by).toBeNull();
      expect(after?.updated_by).toBeNull();
      const { data } = await table("recipes").select("created_by").eq("id", recipeByCook.id).single();
      expect((data as { created_by: string | null }).created_by).toBeNull();
    });
  });

  // ── the split ─────────────────────────────────────────────────────────────

  describe("split_meal_series (R603, FR-629)", () => {
    async function split(mealId: string, headRule: string, cut: string, tail: Record<string, unknown>) {
      return pool.query<{ tail: string }>(
        "select family.split_meal_series($1, $2, $3, $4, $5, $6::jsonb) as tail",
        [householdId, mealId, anaId, headRule, cut, JSON.stringify(tail)],
      );
    }

    it("truncates the head, inserts the tail, and re-homes the exceptions on or after the cut", async () => {
      const recipe = await createRecipe("Pizza");
      const head = await createMeal(recipe.id, "2026-09-04", { rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20261231" });
      await insertException(head.id, { occurrence_date: "2026-09-11", action: "skip" });
      await insertException(head.id, { occurrence_date: "2026-10-02", action: "skip" });

      const { rows } = await split(head.id, "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20260924", "2026-09-25", {
        date: "2026-09-25",
        category_id: mealtimes.get("Lunch")?.id,
        recipe_id: recipe.id,
        note: "moved to lunch",
        rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20261231",
      });
      const tailId = rows[0].tail;

      expect((await readMeal(head.id))?.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20260924");
      const tail = await readMeal(tailId);
      expect(tail).toMatchObject({ date: "2026-09-25", category_id: mealtimes.get("Lunch")?.id, note: "moved to lunch", created_by: anaId });
      expect((await readExceptions(head.id)).map((row) => row.occurrence_date)).toEqual(["2026-09-11"]);
      expect((await readExceptions(tailId)).map((row) => row.occurrence_date)).toEqual(["2026-10-02"]);
    });

    it("changes nothing when the tail is refused — one transaction", async () => {
      const recipe = await createRecipe("Atomic");
      const head = await createMeal(recipe.id, "2026-09-04", { rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR" });
      await insertException(head.id, { occurrence_date: "2026-10-02", action: "skip" });
      await expect(
        split(head.id, "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20260924", "2026-09-25", {
          date: "2026-09-25",
          category_id: "00000000-0000-4000-8000-00000000dead",
          recipe_id: recipe.id,
          note: "",
          rrule: "",
        }),
      ).rejects.toMatchObject({ code: "23503" });
      expect((await readMeal(head.id))?.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=FR");
      expect((await readExceptions(head.id)).map((row) => row.occurrence_date)).toEqual(["2026-10-02"]);
    });

    it("refuses a head of another household", async () => {
      await expect(
        pool.query("select family.split_meal_series($1, $2, $3, $4, $5, $6::jsonb)", [
          "00000000-0000-4000-8000-00000000beef",
          "00000000-0000-4000-8000-00000000cafe",
          anaId,
          "FREQ=DAILY;INTERVAL=1",
          "2026-09-25",
          "{}",
        ]),
      ).rejects.toMatchObject({ code: "P0002" });
    });
  });
});
