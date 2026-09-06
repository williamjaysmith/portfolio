"use client";

import type { CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import type { MealCategory, MealOccurrence } from "@/lib/family/types";

/**
 * One planned meal as the grid and the calendar draw it (006 FR-604, FR-634;
 * R607, R611): the recipe's name on its mealtime's tint — the shipped ladder
 * with `--profile` = the mealtime's colour, never a hand-picked colour
 * (FR-605). A button named by the meal, so a screen reader hears "🍝
 * Spaghetti"; the mealtime is the row's, or the token row's order.
 *
 * `compact` is the calendar's token: the all-day pill height, one line.
 */

export interface MealChipProps {
  occurrence: MealOccurrence;
  category: MealCategory;
  /** The recipe's name — what the chip says; the caller resolves it once per render. */
  name: string;
  compact?: boolean;
  onOpen: (occurrence: MealOccurrence) => void;
}

const CHIP =
  "fam-profile w-full min-h-(--fam-touch) rounded-(--fam-list-row-r) bg-(--fam-profile-40) px-3 text-left " +
  "text-(--fam-text-primary) truncate";

export function MealChip({ occurrence, category, name, compact = false, onOpen }: MealChipProps) {
  return (
    <button
      type="button"
      data-meal={occurrence.mealId}
      data-occurrence={occurrence.occurrenceDate}
      title={occurrence.note ?? undefined}
      onClick={() => onOpen(occurrence)}
      style={profileVars(category.color) as CSSProperties}
      className={`${CHIP} ${compact ? "text-(length:--fam-fs-small)" : "py-2 text-(length:--fam-fs-meal-cell) font-medium"}`}
    >
      {name}
    </button>
  );
}
