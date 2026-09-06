"use client";

import { dayWordsOf } from "@/lib/family/meals/week";
import type { MealCategory, MealOccurrence } from "@/lib/family/types";

import { MealChip } from "./MealChip";
import { useHoldPress } from "./useHoldPress";

/**
 * One slot of the grid (006 FR-604, FR-622, FR-623; R607): a date and a
 * mealtime. Empty, it is one button — "Wednesday 9 September, Dinner, empty"
 * — whose tap opens the add sheet for the slot. Filled, it is a group named
 * with its count, its meals stacked as chips in planning order; a
 * press-and-hold on it opens the same sheet to add another (the reference's
 * long-press), and the keyboard's path to that is the popover's "Add another
 * meal" (FR-646). The cell is washed in the mealtime's colour (FR-605).
 */

export interface Slot {
  date: string;
  categoryId: string;
  /** Plan Meal from a recipe's detail: the recipe already chosen (FR-621). */
  recipeId?: string;
}

export interface MealCellProps {
  date: string;
  category: MealCategory;
  meals: readonly MealOccurrence[];
  /** Recipe id → name, resolved once by the board. */
  recipeNames: ReadonlyMap<string, string>;
  onAdd: (slot: Slot) => void;
  onAddAnother: (slot: Slot) => void;
  onOpen: (occurrence: MealOccurrence) => void;
}

const CELL =
  "fam-profile flex h-(--fam-meal-cell-h) w-full flex-col gap-2 overflow-y-auto rounded-(--fam-meal-cell-r) " +
  "bg-(--fam-profile-20) p-2";

function countWords(count: number): string {
  if (count === 0) return "empty";
  return count === 1 ? "1 meal" : `${count} meals`;
}

export function MealCell({ date, category, meals, recipeNames, onAdd, onAddAnother, onOpen }: MealCellProps) {
  const slot: Slot = { date, categoryId: category.id };
  const label = `${dayWordsOf(date)}, ${category.name}, ${countWords(meals.length)}`;
  const hold = useHoldPress(() => onAddAnother(slot));

  if (meals.length === 0) {
    return (
      <button type="button" data-slot={`${date}|${category.id}`} aria-label={label} onClick={() => onAdd(slot)} className={CELL} />
    );
  }

  return (
    <div
      role="group"
      data-slot={`${date}|${category.id}`}
      aria-label={label}
      onPointerDown={hold.onPointerDown}
      onPointerMove={hold.onPointerMove}
      onPointerUp={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onClickCapture={(event) => {
        // The click that follows a hold that fired is the hold's, not a chip's.
        if (hold.consumeClick()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className={CELL}
    >
      {meals.map((occurrence) => (
        <MealChip
          key={`${occurrence.mealId}|${occurrence.occurrenceDate}`}
          occurrence={occurrence}
          category={category}
          name={recipeNames.get(occurrence.recipeId) ?? "Recipe"}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
