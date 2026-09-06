import type { MealCategory, MealOccurrence } from "../types";

/**
 * What this device draws (006 FR-611, FR-635, FR-637, R609): the mealtimes it
 * has not hidden, in position order, and — for the calendar — each day's
 * meals in mealtime order, or none at all while Show Meals is off. Display
 * only: nothing here is ever written to the household.
 */

export function shownCategoriesOf(categories: readonly MealCategory[], hiddenIds: ReadonlySet<string>): MealCategory[] {
  return [...categories].filter((category) => !hiddenIds.has(category.id)).sort((a, b) => a.position - b.position);
}

/** The calendar's tokens by day (FR-634): mealtime order, then planning order. */
export function mealTokensOf(
  occurrences: readonly MealOccurrence[],
  categories: readonly MealCategory[],
  hiddenIds: ReadonlySet<string>,
  showMeals: boolean,
): Map<string, MealOccurrence[]> {
  const byDate = new Map<string, MealOccurrence[]>();
  if (!showMeals) return byDate;
  const positionOf = new Map(shownCategoriesOf(categories, hiddenIds).map((category) => [category.id, category.position]));
  for (const occurrence of occurrences) {
    if (!positionOf.has(occurrence.categoryId)) continue;
    const day = byDate.get(occurrence.date);
    if (day === undefined) byDate.set(occurrence.date, [occurrence]);
    else day.push(occurrence);
  }
  for (const day of byDate.values()) {
    day.sort((a, b) => {
      const byPosition = (positionOf.get(a.categoryId) ?? 0) - (positionOf.get(b.categoryId) ?? 0);
      if (byPosition !== 0) return byPosition;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
  }
  return byDate;
}
