import type { MealOccurrence } from "../types";

/**
 * A slot is a date and a mealtime (006 FR-604): not a record, just the key the
 * grid's cells and the calendar's tokens group by. Within a slot meals keep
 * their planning order (Assumption 7) — the meal's creation, then its id, so
 * two devices draw the same stack.
 */

export function slotKeyOf(date: string, categoryId: string): string {
  return `${date}|${categoryId}`;
}

function byPlanning(a: MealOccurrence, b: MealOccurrence): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.mealId < b.mealId ? -1 : a.mealId > b.mealId ? 1 : 0;
}

export function slotsOf(occurrences: readonly MealOccurrence[]): Map<string, MealOccurrence[]> {
  const slots = new Map<string, MealOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = slotKeyOf(occurrence.date, occurrence.categoryId);
    const slot = slots.get(key);
    if (slot === undefined) slots.set(key, [occurrence]);
    else slot.push(occurrence);
  }
  for (const slot of slots.values()) slot.sort(byPlanning);
  return slots;
}
