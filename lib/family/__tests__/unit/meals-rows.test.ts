import { describe, expect, it } from "vitest";

import {
  MEAL_CATEGORY_COLUMNS,
  MEAL_COLUMNS,
  MEAL_EXCEPTION_COLUMNS,
  RECIPE_COLUMNS,
  mealsSelect,
  toMeal,
  toMealCategory,
  toRecipe,
  type MealCategoryRow,
  type MealRow,
  type RecipeRow,
} from "@/lib/family/rows";

/**
 * 006 T013 — the three mappers and their column lists (data-model §030–032).
 * Every column is carried across by name, the exceptions ride embedded on the
 * meal, and the select is one joined array, never two adjacent literals.
 */

const CATEGORY: MealCategoryRow = {
  id: "cat-1",
  household_id: "hh",
  name: "Dinner",
  color: "#915EA1",
  position: 3,
  created_by: null,
  updated_by: "ana",
  created_at: "2026-09-06T10:00:00.000Z",
  updated_at: "2026-09-06T10:05:00.000Z",
};

const RECIPE: RecipeRow = {
  id: "rec-1",
  household_id: "hh",
  name: "🍝 Spaghetti",
  category_id: "cat-1",
  text: "500 g spaghetti\n1 onion",
  removed_at: null,
  created_by: "ana",
  updated_by: null,
  created_at: "2026-09-06T10:00:00.000Z",
  updated_at: "2026-09-06T10:00:00.000Z",
};

const MEAL: MealRow = {
  id: "meal-1",
  household_id: "hh",
  date: "2026-09-11",
  category_id: "cat-1",
  recipe_id: "rec-1",
  note: "Ben cooks",
  rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR",
  created_by: "ana",
  updated_by: "ana",
  created_at: "2026-09-06T10:00:00.000Z",
  updated_at: "2026-09-06T10:00:00.000Z",
  meal_exceptions: [
    {
      id: "ex-1",
      household_id: "hh",
      meal_id: "meal-1",
      occurrence_date: "2026-09-18",
      action: "override",
      date: "2026-09-19",
      category_id: null,
      note: "",
      created_by: "ana",
      updated_by: null,
      created_at: "2026-09-06T11:00:00.000Z",
      updated_at: "2026-09-06T11:00:00.000Z",
    },
  ],
};

describe("toMealCategory / toRecipe / toMeal", () => {
  it("maps a mealtime by name", () => {
    expect(toMealCategory(CATEGORY)).toEqual({
      id: "cat-1",
      householdId: "hh",
      name: "Dinner",
      color: "#915EA1",
      position: 3,
      createdBy: null,
      updatedBy: "ana",
      createdAt: "2026-09-06T10:00:00.000Z",
      updatedAt: "2026-09-06T10:05:00.000Z",
    });
  });

  it("maps a recipe, removedAt included", () => {
    expect(toRecipe(RECIPE)).toMatchObject({ id: "rec-1", categoryId: "cat-1", text: "500 g spaghetti\n1 onion", removedAt: null });
    expect(toRecipe({ ...RECIPE, removed_at: "2026-09-07T00:00:00.000Z" }).removedAt).toBe("2026-09-07T00:00:00.000Z");
  });

  it("maps a meal with its embedded exceptions, and an empty list when none arrive", () => {
    const meal = toMeal(MEAL);
    expect(meal).toMatchObject({ id: "meal-1", date: "2026-09-11", recipeId: "rec-1", note: "Ben cooks", rrule: MEAL.rrule });
    expect(meal.exceptions).toEqual([
      expect.objectContaining({ id: "ex-1", mealId: "meal-1", occurrenceDate: "2026-09-18", action: "override", date: "2026-09-19", note: "" }),
    ]);
    expect(toMeal({ ...MEAL, meal_exceptions: undefined as unknown as MealRow["meal_exceptions"] }).exceptions).toEqual([]);
  });
});

describe("the column lists", () => {
  it("name every mapped column and never select *", () => {
    for (const columns of [MEAL_CATEGORY_COLUMNS, RECIPE_COLUMNS, MEAL_COLUMNS, MEAL_EXCEPTION_COLUMNS]) {
      expect(columns).not.toContain("*");
      expect(columns).toContain("household_id");
    }
    expect(MEAL_COLUMNS).toContain("rrule");
    expect(MEAL_EXCEPTION_COLUMNS).toContain("occurrence_date");
  });

  it("builds the meals select as one joined string with the exceptions embed", () => {
    const select = mealsSelect();
    expect(select.startsWith(MEAL_COLUMNS)).toBe(true);
    expect(select).toContain(`,meal_exceptions(${MEAL_EXCEPTION_COLUMNS})`);
  });
});
