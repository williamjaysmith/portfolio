import { addDays } from "../calendar/dates";
import type { LocalDateRange } from "../recurrence/expand";
import { ruleDatesIn } from "../recurrence/expand";
import { parseRule } from "../recurrence/grammar";
import type { Meal, MealException, MealOccurrence } from "../types";

/**
 * The meals a range of days holds (006 FR-628, R602): one-offs that fall in
 * it, and every occurrence of every repeating meal — the calendar's ONE rule
 * walk (`ruleDatesIn`) applied to date-only series, with the meal's exceptions
 * applied by the occurrence's ORIGINAL date: a skip drops it, an override
 * draws it on another day, in another mealtime, or with another note.
 *
 * An override can carry an occurrence across the range's edge in either
 * direction, so a series is walked for its dates inside the range AND for the
 * overrides whose drawn date falls inside it — keyed, always, by the original.
 */

export type { LocalDateRange };

function inRange(date: string, range: LocalDateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** The occurrence a base date and its exception (if any) produce — or none, for a skip. */
function occurrenceOf(meal: Meal, occurrenceDate: string, exception: MealException | undefined): MealOccurrence | null {
  if (exception?.action === "skip") return null;
  return {
    mealId: meal.id,
    occurrenceDate,
    isRepeating: meal.rrule !== null,
    date: exception?.date ?? occurrenceDate,
    categoryId: exception?.categoryId ?? meal.categoryId,
    recipeId: meal.recipeId,
    note: noteOf(meal.note, exception),
    createdAt: meal.createdAt,
  };
}

/** `""` on an override clears the series' note for that occurrence; `null` inherits. */
function noteOf(seriesNote: string | null, exception: MealException | undefined): string | null {
  if (exception?.action !== "override" || exception.note === null) return seriesNote;
  return exception.note === "" ? null : exception.note;
}

/** Whether `date` is an occurrence of the series — a one-day walk. */
function isOccurrence(meal: Meal, rrule: string, date: string, zone: string): boolean {
  return ruleDatesIn(parseRule(rrule), meal.date, { start: date, end: date }, zone).length === 1;
}

function pushSeries(out: MealOccurrence[], meal: Meal, rrule: string, range: LocalDateRange, zone: string): void {
  const byDate = new Map(meal.exceptions.map((exception) => [exception.occurrenceDate, exception]));
  for (const date of ruleDatesIn(parseRule(rrule), meal.date, range, zone)) {
    const occurrence = occurrenceOf(meal, date, byDate.get(date));
    if (occurrence !== null && inRange(occurrence.date, range)) out.push(occurrence);
  }
  // Overrides moved INTO the range from outside it.
  for (const exception of meal.exceptions) {
    if (exception.action !== "override" || exception.date === null) continue;
    if (inRange(exception.occurrenceDate, range) || !inRange(exception.date, range)) continue;
    if (!isOccurrence(meal, rrule, exception.occurrenceDate, zone)) continue;
    const occurrence = occurrenceOf(meal, exception.occurrenceDate, exception);
    if (occurrence !== null) out.push(occurrence);
  }
}

function byDrawnDateThenPlanning(a: MealOccurrence, b: MealOccurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.mealId < b.mealId ? -1 : a.mealId > b.mealId ? 1 : 0;
}

export function expandMeals(meals: readonly Meal[], range: LocalDateRange, zone: string): MealOccurrence[] {
  const occurrences: MealOccurrence[] = [];
  for (const meal of meals) {
    if (meal.rrule === null) {
      if (inRange(meal.date, range)) {
        const one = occurrenceOf(meal, meal.date, undefined);
        if (one !== null) occurrences.push(one);
      }
    } else {
      pushSeries(occurrences, meal, meal.rrule, range, zone);
    }
  }
  return occurrences.sort(byDrawnDateThenPlanning);
}

/** The one occurrence of `meal` on `occurrenceDate`, or none — what a write must name (contracts). */
export function occurrenceOn(meal: Meal, occurrenceDate: string, zone: string): MealOccurrence | null {
  if (meal.rrule === null) {
    return meal.date === occurrenceDate ? occurrenceOf(meal, meal.date, undefined) : null;
  }
  if (!isOccurrence(meal, meal.rrule, occurrenceDate, zone)) return null;
  const exception = meal.exceptions.find((one) => one.occurrenceDate === occurrenceDate);
  return occurrenceOf(meal, occurrenceDate, exception);
}

/**
 * Whether `occurrenceDate` is the series' first remaining occurrence, judged
 * on the series' OWN dates (FR-629): a skipped earlier occurrence no longer
 * counts, but an earlier occurrence merely moved elsewhere by an override
 * still does — the drawn date is where it shows, not where it belongs. A
 * "this and future" write at the first occurrence means the whole series.
 */
export function isFirstOccurrenceOf(meal: Meal, occurrenceDate: string, zone: string): boolean {
  if (meal.rrule === null || occurrenceDate <= meal.date) return true;
  const skipped = new Set(meal.exceptions.filter((exception) => exception.action === "skip").map((exception) => exception.occurrenceDate));
  const earlier = ruleDatesIn(parseRule(meal.rrule), meal.date, { start: meal.date, end: addDays(occurrenceDate, -1) }, zone);
  return !earlier.some((date) => !skipped.has(date));
}
