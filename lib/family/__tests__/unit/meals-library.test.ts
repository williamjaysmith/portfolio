import { describe, expect, it } from "vitest";

import { activeRecipes, filterRecipes } from "@/lib/family/meals/library";
import type { Recipe } from "@/lib/family/types";

/** 006 T023 — the pane's list (FR-618, FR-619): removed out, one mealtime, every word in name or text. */

function recipe(id: string, name: string, categoryId: string, text = "", removedAt: string | null = null): Recipe {
  return {
    id,
    householdId: "hh",
    name,
    categoryId,
    text,
    removedAt,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

const RECIPES = [
  recipe("pancakes", "Pancakes", "breakfast", "2 cups flour\n2 eggs"),
  recipe("bread", "Banana bread", "snack", "3 ripe bananas\n200 g flour"),
  recipe("spaghetti", "🍝 Spaghetti", "dinner", "500 g spaghetti\nparmesan"),
  recipe("stew", "Old stew", "dinner", "", "2026-09-05T00:00:00.000Z"),
];

describe("activeRecipes", () => {
  it("leaves out a removed recipe", () => {
    expect(activeRecipes(RECIPES).map((one) => one.id)).toEqual(["pancakes", "bread", "spaghetti"]);
  });
});

describe("filterRecipes", () => {
  it("returns every active recipe for no chip and no query", () => {
    expect(filterRecipes(RECIPES, { categoryId: null, query: "" }).map((one) => one.id)).toEqual(["pancakes", "bread", "spaghetti"]);
  });

  it("keeps one mealtime under a chip", () => {
    expect(filterRecipes(RECIPES, { categoryId: "dinner", query: "" }).map((one) => one.id)).toEqual(["spaghetti"]);
  });

  it("matches every word of the query in the name or the text, case-insensitively", () => {
    expect(filterRecipes(RECIPES, { categoryId: null, query: "bread" }).map((one) => one.id)).toEqual(["bread"]);
    expect(filterRecipes(RECIPES, { categoryId: null, query: "FLOUR" }).map((one) => one.id)).toEqual(["pancakes", "bread"]);
    expect(filterRecipes(RECIPES, { categoryId: null, query: "flour eggs" }).map((one) => one.id)).toEqual(["pancakes"]);
    expect(filterRecipes(RECIPES, { categoryId: null, query: "  parmesan  " }).map((one) => one.id)).toEqual(["spaghetti"]);
    expect(filterRecipes(RECIPES, { categoryId: "snack", query: "flour" }).map((one) => one.id)).toEqual(["bread"]);
    expect(filterRecipes(RECIPES, { categoryId: null, query: "stew" })).toEqual([]);
  });
});
