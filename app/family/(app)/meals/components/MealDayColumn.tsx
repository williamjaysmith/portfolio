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
 *
 * **The grid lines (014)**, the operator's ask: "the same type of light gray
 * divider lines as the calendar view, so you can visualize across days easier".
 *
 * Every rule is absolutely positioned and OUT OF FLOW, never a border. The
 * column's width is MEASURED — 013 takes `layout.perRow` from
 * `--fam-meal-cell-w` against the strip — so a pixel of border per column is
 * exactly how a seven-column wall tablet quietly starts drawing six.
 *
 * They are positioned against the CELLS rather than computed from the column's
 * top, which is the correction that made them line up. A first attempt drew the
 * mealtime rules as a repeating background on the strip, offset by
 * `--fam-dayheader-h`; it was a whole `--fam-meal-gap-y` out, because the
 * header and the first cell are flex siblings with a gap between them, and it
 * could not see the strip's own padding either. A rule that hangs off its own
 * cell cannot drift from it.
 *
 * · **the day divider** runs the column's left edge, half a column gap out, and
 *   starts BELOW the day header — the calendar's `DayColumn` borders its left
 *   edge and its header band is a separate element above, which is the look
 *   asked for. It is a divider BETWEEN days, so the first column on screen does
 *   not draw one (`dividerBefore`): a rule there would sit against the mealtime
 *   rail and fence the grid off from its own row labels. Nor does anything
 *   follow the last day. Six rules for seven days.
 * · **the mealtime rules** hang half a row gap under each cell but the last, and
 *   reach half a column gap past both sides, so consecutive days' segments meet
 *   across the gap and read as one line across the week — and meet the day
 *   dividers square.
 */

export interface MealDayColumnProps {
  date: string;
  /**
   * Draw the rule that separates this day from the one before it. False for the
   * leftmost column on screen — see the docstring.
   */
  dividerBefore: boolean;
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

export function MealDayColumn({ date, dividerBefore, todayDate, categories, slots, recipeNames, onAdd, onAddAnother, onOpen }: MealDayColumnProps) {
  const { weekday, numeral } = dayHeaderOf(date);
  const isToday = date === todayDate;
  return (
    <section aria-label={dayWordsOf(date)} data-day={date} className="relative flex min-w-0 flex-col gap-(--fam-meal-gap-y)">
      {dividerBefore ? (
        <span
          aria-hidden="true"
          style={{ transform: "translateX(calc(var(--fam-meal-gap-x) / -2))" }}
          className="pointer-events-none absolute bottom-0 left-0 top-(--fam-dayheader-h) w-px bg-(--fam-hairline)"
        />
      ) : null}
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
      {categories.map((category, index) => (
        <div key={category.id} className="relative">
          <MealCell
            date={date}
            category={category}
            meals={slots.get(slotKeyOf(date, category.id)) ?? NO_MEALS}
            recipeNames={recipeNames}
            onAdd={onAdd}
            onAddAnother={onAddAnother}
            onOpen={onOpen}
          />
          {index < categories.length - 1 ? (
            <span
              aria-hidden="true"
              style={{
                bottom: "calc(var(--fam-meal-gap-y) / -2)",
                left: "calc(var(--fam-meal-gap-x) / -2)",
                right: "calc(var(--fam-meal-gap-x) / -2)",
              }}
              className="pointer-events-none absolute h-px bg-(--fam-hairline)"
            />
          ) : null}
        </div>
      ))}
    </section>
  );
}
