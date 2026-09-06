import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  familyKeys,
  fetchMealCategories,
  fetchMeals,
  fetchRecipes,
  useMealCategories,
  useMeals,
  useRecipes,
} from "@/lib/family/queries";
import { MEAL_CATEGORY_COLUMNS, RECIPE_COLUMNS, mealsSelect } from "@/lib/family/rows";

/**
 * 006 T015 — the three reads (R605): keys prefix-shaped under `familyKeys.all`
 * so the realtime sweep reaches them, named columns (the meals select with its
 * exceptions embed), the household filter, and each read's own order — the
 * mealtimes by position, the recipes by name, the meals by date.
 */

interface Response {
  data: unknown;
  error: { message: string } | null;
}

function fakeClient(response: Response = { data: [], error: null }) {
  const calls: unknown[][] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  const query = {
    eq: record("eq"),
    order: record("order"),
    then(resolve: (value: Response) => void) {
      resolve(response);
    },
  };
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  const schema = vi.fn(() => ({ from }));
  return { supabase: { schema } as unknown as SupabaseClient, schema, from, select, calls };
}

describe("familyKeys", () => {
  it("shapes the three meals keys under the sweep prefix", () => {
    expect(familyKeys.mealCategories("h")).toEqual(["family", "meal-categories", "h"]);
    expect(familyKeys.recipes("h")).toEqual(["family", "recipes", "h"]);
    expect(familyKeys.meals("h")).toEqual(["family", "meals", "h"]);
    for (const key of [familyKeys.mealCategories("h"), familyKeys.recipes("h"), familyKeys.meals("h")]) {
      expect(key.slice(0, familyKeys.all.length)).toEqual(familyKeys.all);
    }
  });
});

describe("the reads", () => {
  it("reads the mealtimes by position under the household filter", async () => {
    const fake = fakeClient();
    await fetchMealCategories(fake.supabase, "h");
    expect(fake.schema).toHaveBeenCalledWith("family");
    expect(fake.from).toHaveBeenCalledWith("meal_categories");
    expect(fake.select).toHaveBeenCalledWith(MEAL_CATEGORY_COLUMNS);
    expect(fake.calls).toEqual([
      ["eq", "household_id", "h"],
      ["order", "position", { ascending: true }],
    ]);
  });

  it("reads the recipes by name then age", async () => {
    const fake = fakeClient();
    await fetchRecipes(fake.supabase, "h");
    expect(fake.from).toHaveBeenCalledWith("recipes");
    expect(fake.select).toHaveBeenCalledWith(RECIPE_COLUMNS);
    expect(fake.calls.filter((call) => call[0] === "order").map((call) => call[1])).toEqual(["name", "created_at"]);
  });

  it("reads the meals with the exceptions embed by date then age, and maps the rows", async () => {
    const fake = fakeClient({
      data: [
        {
          id: "m1",
          household_id: "h",
          date: "2026-09-11",
          category_id: "c",
          recipe_id: "r",
          note: null,
          rrule: null,
          created_by: null,
          updated_by: null,
          created_at: "2026-09-06T00:00:00.000Z",
          updated_at: "2026-09-06T00:00:00.000Z",
          meal_exceptions: [],
        },
      ],
      error: null,
    });
    const meals = await fetchMeals(fake.supabase, "h");
    expect(fake.from).toHaveBeenCalledWith("meals");
    expect(fake.select).toHaveBeenCalledWith(mealsSelect());
    expect(fake.calls.filter((call) => call[0] === "order").map((call) => call[1])).toEqual(["date", "created_at"]);
    expect(meals).toEqual([expect.objectContaining({ id: "m1", householdId: "h", exceptions: [] })]);
  });

  it("throws the store's message on an error", async () => {
    const fake = fakeClient({ data: null, error: { message: "boom" } });
    await expect(fetchRecipes(fake.supabase, "h")).rejects.toThrow("boom");
  });
});

describe("the hooks", () => {
  function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return createElement(QueryClientProvider, { client }, children);
  }

  it("seed their own keys from initialData", () => {
    const categories = renderHook(() => useMealCategories("h", []), { wrapper });
    expect(categories.result.current.data).toEqual([]);
    const recipes = renderHook(() => useRecipes("h", []), { wrapper });
    expect(recipes.result.current.data).toEqual([]);
    const meals = renderHook(() => useMeals("h", []), { wrapper });
    expect(meals.result.current.data).toEqual([]);
  });
});
