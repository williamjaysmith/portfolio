"use client";

import type { MealCategory, MealOccurrence } from "@/lib/family/types";

import { MealChip } from "../../meals/components/MealChip";
import { headerGridTemplate } from "./WeekHeader";

/**
 * The calendar's meal tokens (006 FR-634, R611): one grid row on the day
 * headers' template, under the all-day band, holding each day's shown meals
 * as the Meals tab's compact chips in mealtime order. It sits outside the
 * drag layer — no pointer binding, so a token never lifts (FR-636) and the
 * events' drag is untouched. A week with nothing to show draws no row at all,
 * so the band keeps its height when Show Meals is off.
 */

export interface MealRowProps {
  columnDates: readonly string[];
  /** Each day's tokens, already cut to this device (hidden mealtimes, Show Meals). */
  tokens: ReadonlyMap<string, MealOccurrence[]>;
  categoriesById: ReadonlyMap<string, MealCategory>;
  recipeNames: ReadonlyMap<string, string>;
  onOpen: (occurrence: MealOccurrence) => void;
}

const NO_TOKENS: MealOccurrence[] = [];

export function MealRow({ columnDates, tokens, categoriesById, recipeNames, onOpen }: MealRowProps) {
  if (!columnDates.some((date) => (tokens.get(date)?.length ?? 0) > 0)) return null;
  return (
    <div role="list" aria-label="Meals" className="grid border-t border-(--fam-hairline)" style={headerGridTemplate(columnDates.length)}>
      <div aria-hidden="true" />
      {columnDates.map((date) => (
        <div key={date} role="listitem" className="flex min-w-0 flex-wrap gap-1 px-1 py-1">
          {(tokens.get(date) ?? NO_TOKENS).map((occurrence) => {
            const category = categoriesById.get(occurrence.categoryId);
            if (category === undefined) return null;
            return (
              <MealChip
                key={`${occurrence.mealId}:${occurrence.occurrenceDate}`}
                occurrence={occurrence}
                category={category}
                name={recipeNames.get(occurrence.recipeId) ?? "Recipe"}
                compact
                onOpen={onOpen}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
