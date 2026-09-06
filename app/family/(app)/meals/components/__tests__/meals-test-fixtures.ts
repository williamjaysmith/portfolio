import type { Meal, MealCategory, MealException, MealOccurrence, Recipe } from "@/lib/family/types";

/** The example household's mealtimes, recipes and a week of meals, for the RTL suites. */

export const HOUSEHOLD = "household-1";
export const BREAKFAST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const LUNCH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
export const DINNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
export const SNACK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";

const STAMP = "2026-09-01T10:00:00.000Z";

export function categoryOf(id: string, name: string, position: number, color: MealCategory["color"]): MealCategory {
  return { id, householdId: HOUSEHOLD, name, color, position, createdBy: null, updatedBy: null, createdAt: STAMP, updatedAt: STAMP };
}

export const CATEGORIES: MealCategory[] = [
  categoryOf(BREAKFAST, "Breakfast", 1, "#A8D4D3"),
  categoryOf(LUNCH, "Lunch", 2, "#F66951"),
  categoryOf(DINNER, "Dinner", 3, "#915EA1"),
  categoryOf(SNACK, "Snack", 4, "#FDC36D"),
];

let recipeCount = 0;
export function recipeOf(name: string, categoryId: string, overrides: Partial<Recipe> = {}): Recipe {
  recipeCount += 1;
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb${String(recipeCount).padStart(3, "0")}`,
    householdId: HOUSEHOLD,
    name,
    categoryId,
    text: "",
    removedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

let mealCount = 0;
export function mealOf(date: string, categoryId: string, recipeId: string, overrides: Partial<Meal> = {}): Meal {
  mealCount += 1;
  return {
    id: `cccccccc-cccc-4ccc-8ccc-ccccccccc${String(mealCount).padStart(3, "0")}`,
    householdId: HOUSEHOLD,
    date,
    categoryId,
    recipeId,
    note: null,
    rrule: null,
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: `2026-09-01T10:00:${String(mealCount).padStart(2, "0")}.000Z`,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function exceptionOf(mealId: string, occurrenceDate: string, overrides: Partial<MealException> = {}): MealException {
  return {
    id: `ex-${mealId}-${occurrenceDate}`,
    mealId,
    householdId: HOUSEHOLD,
    occurrenceDate,
    action: "skip",
    date: null,
    categoryId: null,
    note: null,
    createdBy: null,
    updatedBy: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

/** A drawn meal as the popover and chips receive it. */
export function occurrenceOf(meal: Meal, overrides: Partial<MealOccurrence> = {}): MealOccurrence {
  return {
    mealId: meal.id,
    occurrenceDate: meal.date,
    isRepeating: meal.rrule !== null,
    date: meal.date,
    categoryId: meal.categoryId,
    recipeId: meal.recipeId,
    note: meal.note,
    createdAt: meal.createdAt,
    ...overrides,
  };
}
