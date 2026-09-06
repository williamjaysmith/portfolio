"use client";

import { slotKeyOf } from "@/lib/family/meals/slots";
import { dayHeaderOf, dayWordsOf } from "@/lib/family/meals/week";
import type { MealCategory, MealOccurrence } from "@/lib/family/types";

import { MealCell, type Slot } from "./MealCell";

/**
 * One day of the grid (006 FR-602, FR-603): the day's header — the weekday
 * and the numeral, today's inside the calendar's filled coral circle (FR-209
 * reused) — over one cell per shown mealtime, in the rail's order, each a
 * cell tall so the rows line up across the strip.
 */

export interface MealDayColumnProps {
  date: string;
  todayDate: string;
  categories: readonly MealCategory[];
  slots: ReadonlyMap<string, MealOccurrence[]>;
  recipeNames: ReadonlyMap<string, string>;
  onAdd: (slot: Slot) => void;
  onAddAnother: (slot: Slot) => void;
  onOpen: (occurrence: MealOccurrence) => void;
}

/** The header's height, shared with the rail's blank first row so the rows align. */
export const DAY_HEADER_CLASS = "flex h-(--fam-dayheader-h) shrink-0 items-center justify-center gap-2";

const NO_MEALS: MealOccurrence[] = [];

export function MealDayColumn({ date, todayDate, categories, slots, recipeNames, onAdd, onAddAnother, onOpen }: MealDayColumnProps) {
  const { weekday, numeral } = dayHeaderOf(date);
  const isToday = date === todayDate;
  return (
    <section aria-label={dayWordsOf(date)} data-day={date} className="flex min-w-0 flex-col gap-(--fam-meal-gap-y)">
      <header aria-current={isToday ? "date" : undefined} className={DAY_HEADER_CLASS}>
        <span className="text-(length:--fam-fs-small) text-(--fam-text-muted)">{weekday}</span>
        <span
          className={
            isToday
              ? "flex size-(--fam-today-badge) items-center justify-center rounded-full bg-(--fam-accent-coral) font-semibold text-(length:--fam-fs-today-badge) text-(--fam-text-primary)"
              : "text-(length:--fam-fs-body) font-medium"
          }
        >
          {numeral}
        </span>
      </header>
      {categories.map((category) => (
        <MealCell
          key={category.id}
          date={date}
          category={category}
          meals={slots.get(slotKeyOf(date, category.id)) ?? NO_MEALS}
          recipeNames={recipeNames}
          onAdd={onAdd}
          onAddAnother={onAddAnother}
          onOpen={onOpen}
        />
      ))}
    </section>
  );
}
