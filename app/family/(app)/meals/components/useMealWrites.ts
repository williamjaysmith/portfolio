"use client";

import { useCallback } from "react";

import { addListItems } from "@/lib/family/actions/lists";
import {
  createRecipe,
  deleteMeal,
  deleteRecipe,
  planMeal,
  updateMeal,
  updateMealCategory,
  updateRecipe,
} from "@/lib/family/actions/meals";
import type { PaletteColor } from "@/lib/family/colors";
import type { ActionResult } from "@/lib/family/errors";
import type { Meal, MealCategory, MealOccurrence, MealScope, Recipe, RepeatChoice, RecipeChoice } from "@/lib/family/types";

import { useSerialisedWrites } from "../../components/useSerialisedWrites";

/**
 * The Meals tab's writes (006 R604, R608): `useSerialisedWrites` with this
 * tab's verbs and keys on top, exactly as the Lists tab's `useListWrites` is.
 * Every write goes `withActor(run)` — the punch-in at the moment of the tap
 * (FR-639) — and is pessimistic: the surface shows busy for one round trip
 * and then paints from the refetch. Nothing is written to the cache by hand,
 * nothing is queued offline, and a dismissed punch-in (`NO_ACTOR`) is the one
 * silence in `notice` (FR-642).
 *
 * Keys: `meal:<id>` for one meal's writes, `plan:<slot>` for a slot's add,
 * `recipe:<id>` / `recipe:new`, `mealtime:<id>`, `push:<listId>`.
 */

export type WriteOutcome<T> = ActionResult<T> | null;

export interface MealPatch {
  date?: string;
  categoryId?: string;
  note?: string | null;
  recipeId?: string;
  repeat?: RepeatChoice;
}

export interface PlanInput {
  date: string;
  categoryId: string;
  recipe: RecipeChoice;
  note?: string;
  repeat?: RepeatChoice;
}

export interface RecipeInput {
  name: string;
  categoryId: string;
  text: string;
}

export function mealKeyOf(occurrence: Pick<MealOccurrence, "mealId">): string {
  return `meal:${occurrence.mealId}`;
}

export function recipeKeyOf(recipe: Pick<Recipe, "id">): string {
  return `recipe:${recipe.id}`;
}

export interface MealWrites {
  busyKeys: ReadonlySet<string>;
  notice: string | null;
  clearNotice: () => void;
  plan: (input: PlanInput) => Promise<WriteOutcome<Meal>>;
  update: (occurrence: MealOccurrence, patch: MealPatch, scope?: MealScope) => Promise<WriteOutcome<Meal>>;
  remove: (occurrence: MealOccurrence, scope?: MealScope) => Promise<WriteOutcome<null>>;
  createRecipe: (input: RecipeInput) => Promise<WriteOutcome<Recipe>>;
  updateRecipe: (recipe: Pick<Recipe, "id">, patch: Partial<RecipeInput>) => Promise<WriteOutcome<Recipe>>;
  deleteRecipe: (recipe: Pick<Recipe, "id">, mode: "recipe" | "recipe_and_meals") => Promise<WriteOutcome<{ removedMeals: number }>>;
  updateMealtime: (
    category: Pick<MealCategory, "id">,
    patch: { name?: string; color?: PaletteColor },
  ) => Promise<WriteOutcome<MealCategory>>;
  pushToList: (listId: string, texts: string[]) => Promise<WriteOutcome<{ added: number }>>;
}

export function useMealWrites(): MealWrites {
  const { busyKeys, notice, clearNotice, commit } = useSerialisedWrites();

  const plan = useCallback(
    async (input: PlanInput) => commit(`plan:${input.date}|${input.categoryId}`, () => planMeal(input)),
    [commit],
  );
  const update = useCallback(
    async (occurrence: MealOccurrence, patch: MealPatch, scope?: MealScope) =>
      commit(mealKeyOf(occurrence), () =>
        updateMeal({ id: occurrence.mealId, occurrenceDate: occurrence.occurrenceDate, scope, patch }),
      ),
    [commit],
  );
  const remove = useCallback(
    async (occurrence: MealOccurrence, scope?: MealScope) =>
      commit(mealKeyOf(occurrence), () =>
        deleteMeal({ id: occurrence.mealId, occurrenceDate: occurrence.occurrenceDate, scope, confirm: true }),
      ),
    [commit],
  );
  const create = useCallback(async (input: RecipeInput) => commit("recipe:new", () => createRecipe(input)), [commit]);
  const edit = useCallback(
    async (recipe: Pick<Recipe, "id">, patch: Partial<RecipeInput>) =>
      commit(recipeKeyOf(recipe), () => updateRecipe({ id: recipe.id, patch })),
    [commit],
  );
  const destroy = useCallback(
    async (recipe: Pick<Recipe, "id">, mode: "recipe" | "recipe_and_meals") =>
      commit(recipeKeyOf(recipe), () => deleteRecipe({ id: recipe.id, mode, confirm: true })),
    [commit],
  );
  const updateMealtime = useCallback(
    async (category: Pick<MealCategory, "id">, patch: { name?: string; color?: PaletteColor }) =>
      commit(`mealtime:${category.id}`, () => updateMealCategory({ id: category.id, patch })),
    [commit],
  );
  const pushToList = useCallback(
    async (listId: string, texts: string[]) => commit(`push:${listId}`, () => addListItems({ listId, texts })),
    [commit],
  );

  return {
    busyKeys,
    notice,
    clearNotice,
    plan,
    update,
    remove,
    createRecipe: create,
    updateRecipe: edit,
    deleteRecipe: destroy,
    updateMealtime,
    pushToList,
  };
}
