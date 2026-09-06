import type { Recipe } from "../types";

/**
 * The recipes pane's list (006 FR-618, FR-619): removed recipes are out; a
 * mealtime chip keeps one mealtime; the search keeps recipes whose name OR
 * text contains every typed word, case-insensitively — an ingredient is what
 * a family searches for (spec Assumption 7).
 */

export interface RecipeFilter {
  categoryId: string | null;
  query: string;
}

/** Recipes still in the library — FR-616's first choice takes one out (R601). */
export function activeRecipes(recipes: readonly Recipe[]): Recipe[] {
  return recipes.filter((recipe) => recipe.removedAt === null);
}

function wordsOf(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
}

function matchesQuery(recipe: Recipe, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const haystack = `${recipe.name}\n${recipe.text}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function filterRecipes(recipes: readonly Recipe[], filter: RecipeFilter): Recipe[] {
  const words = wordsOf(filter.query);
  return activeRecipes(recipes).filter(
    (recipe) => (filter.categoryId === null || recipe.categoryId === filter.categoryId) && matchesQuery(recipe, words),
  );
}
