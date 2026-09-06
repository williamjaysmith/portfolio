"use client";

import { useMemo } from "react";

import type { DateWindow } from "@/lib/family/calendar/dates";
import { expandMeals } from "@/lib/family/meals/expand";
import { mealTokensOf } from "@/lib/family/meals/visibility";
import { useMealCategories, useMeals, useRecipes } from "@/lib/family/queries";
import type { Meal, MealCategory, MealOccurrence, Recipe } from "@/lib/family/types";

import { useMealSurfaceModel, type MealSurfaceModel } from "../../meals/components/MealSurfaces";
import { useCalendarMealSwitch } from "../../meals/components/useCalendarMealSwitch";
import { useHiddenMealtimes } from "../../meals/components/useHiddenMealtimes";

/**
 * Meals on the Week calendar (006 FR-634–FR-637, R611): the household's three
 * meal reads — the same cache entries the Meals tab holds, so a write on
 * either tab lands on both — expanded over the calendar's displayed window
 * with the calendar's own rule walk, then cut to what this device shows: the
 * hidden mealtimes (FR-637) and the Show Meals switch (FR-635). The surfaces
 * are the Meals tab's own model, so a token's popover is the same popover
 * (FR-636).
 */

export interface CalendarMealSeeds {
  categories: MealCategory[];
  recipes: Recipe[];
  meals: Meal[];
}

export interface CalendarMealsOptions {
  householdId: string;
  /** The displayed window, household-local first and last day. */
  window: DateWindow;
  zone: string;
  /** The live household-local today; `null` before the first tick. */
  todayDate: string | null;
  /** The server-fetched rows — the no-flicker first paint (R207). */
  initial: CalendarMealSeeds;
}

export interface CalendarMeals {
  /** Each day's tokens in mealtime order — empty when Show Meals is off. */
  tokens: ReadonlyMap<string, MealOccurrence[]>;
  categoriesById: ReadonlyMap<string, MealCategory>;
  surfaces: MealSurfaceModel;
}

const NO_CATEGORIES: MealCategory[] = [];
const NO_RECIPES: Recipe[] = [];
const NO_MEALS: Meal[] = [];

export function useCalendarMeals({ householdId, window, zone, todayDate, initial }: CalendarMealsOptions): CalendarMeals {
  const categories = useMealCategories(householdId, initial.categories);
  const recipes = useRecipes(householdId, initial.recipes);
  const meals = useMeals(householdId, initial.meals);
  const { hiddenIds } = useHiddenMealtimes();
  const { showMeals } = useCalendarMealSwitch();
  const categoryRows = categories.data ?? NO_CATEGORIES;
  const recipeRows = recipes.data ?? NO_RECIPES;
  const mealRows = meals.data ?? NO_MEALS;

  const { startDate, endDate } = window;
  const occurrences = useMemo(
    () => expandMeals(mealRows, { start: startDate, end: endDate }, zone),
    [mealRows, startDate, endDate, zone],
  );
  const tokens = useMemo(
    () => mealTokensOf(occurrences, categoryRows, hiddenIds, showMeals),
    [occurrences, categoryRows, hiddenIds, showMeals],
  );
  const categoriesById = useMemo(() => new Map(categoryRows.map((category) => [category.id, category])), [categoryRows]);
  const surfaces = useMealSurfaceModel({
    categories: categoryRows,
    recipes: recipeRows,
    meals: mealRows,
    occurrences,
    todayDate: todayDate ?? startDate,
  });

  return { tokens, categoriesById, surfaces };
}
