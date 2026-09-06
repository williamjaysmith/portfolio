"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { MealCategory } from "@/lib/family/types";

/**
 * The mealtime rail at the grid's left (006 FR-602; R606): the shown
 * mealtimes' names, rotated to read upward down a ~40-unit column, each row
 * exactly a cell tall so the rail lines up with every day column beside it.
 * The names are real text in a list — a screen reader reads "Breakfast,
 * Lunch, Dinner, Snack" — and the rotation is CSS.
 */

export interface MealRailProps {
  categories: readonly MealCategory[];
  /** Space above the first row, matching the day columns' header. */
  headerClassName: string;
}

const RAIL_ROW =
  "fam-profile flex h-(--fam-meal-cell-h) w-(--fam-meal-rail-w) shrink-0 items-center justify-center " +
  "rounded-(--fam-meal-cell-r) bg-(--fam-profile-40)";

export function MealRail({ categories, headerClassName }: MealRailProps) {
  return (
    <ul aria-label="Mealtimes" className="flex shrink-0 flex-col gap-(--fam-meal-gap-y)">
      <li aria-hidden="true" className={headerClassName} />
      {categories.map((category) => (
        <li key={category.id} data-mealtime={category.id} style={profileVars(category.color) as CSSProperties} className={RAIL_ROW}>
          <span
            className="whitespace-nowrap text-(length:--fam-fs-small) font-medium text-(--fam-text-primary) [writing-mode:vertical-rl] rotate-180"
          >
            {category.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
