import { addDays, diffDays } from "@/lib/family/calendar/dates";
import { ActionFailure } from "@/lib/family/errors";
import { mealRepeatChoiceOf } from "@/lib/family/meals/repeat";
import type { Meal, MealOccurrence, MealScope, RecipeChoice, RepeatChoice, Weekday } from "@/lib/family/types";
import { mealNoteSchema, parseOrThrow, recipeChoiceSchema } from "@/lib/family/validation";

import type { RepeatKind } from "../../components/RepeatFieldset";
import type { MealPatch, PlanInput } from "./useMealWrites";

/**
 * The meal sheet's draft and what it sends (006 FR-622, FR-624, FR-626,
 * FR-627): pure, so the sheet's rules — only what changed travels on an edit,
 * a New Entry needs a name, a repeat needs its weekdays — are table-tested
 * without a render. The repeat fields are the shared fieldset's shape.
 */

export interface MealDraft {
  date: string;
  categoryId: string;
  /** From Recipes or New Entry — the picker's mode. */
  source: "existing" | "new";
  recipeId: string | null;
  newName: string;
  newText: string;
  note: string;
  repeatKind: RepeatKind;
  weekdays: Weekday[];
  until: string;
}

export type MealFormMode =
  | { kind: "add"; date: string; categoryId: string; recipeId?: string }
  | { kind: "edit"; occurrence: MealOccurrence; meal: Meal; scope?: MealScope };

export type MealFormResult = { kind: "plan"; input: PlanInput } | { kind: "patch"; patch: MealPatch };

const CHOOSE_A_RECIPE = "Choose a recipe, or type a new entry.";
const NOTHING_TO_CHANGE = "Nothing to change.";

function repeatFieldsOf(rrule: string | null): Pick<MealDraft, "repeatKind" | "weekdays" | "until"> {
  const choice = mealRepeatChoiceOf(rrule);
  return {
    repeatKind: choice.kind,
    weekdays: choice.kind === "weekly" ? [...choice.weekdays] : [],
    until: (choice.kind !== "never" && choice.until) || "",
  };
}

export function mealDraftOf(mode: MealFormMode): MealDraft {
  if (mode.kind === "add") {
    return {
      date: mode.date,
      categoryId: mode.categoryId,
      source: "existing",
      recipeId: mode.recipeId ?? null,
      newName: "",
      newText: "",
      note: "",
      repeatKind: "never",
      weekdays: [],
      until: "",
    };
  }
  return {
    date: mode.occurrence.date,
    categoryId: mode.occurrence.categoryId,
    source: "existing",
    recipeId: mode.occurrence.recipeId,
    newName: "",
    newText: "",
    note: mode.occurrence.note ?? "",
    ...repeatFieldsOf(mode.meal.rrule),
  };
}

/** The shared fieldset's choice, as the actions take it. */
export function repeatChoiceOf(draft: Pick<MealDraft, "repeatKind" | "weekdays" | "until">): RepeatChoice {
  const until = draft.until === "" ? null : draft.until;
  switch (draft.repeatKind) {
    case "never":
      return { kind: "never" };
    case "daily":
      return { kind: "daily", until };
    case "weekly":
      return { kind: "weekly", weekdays: [...draft.weekdays], until };
    case "monthly":
      return { kind: "monthly", until };
  }
}

function recipeChoiceOf(draft: MealDraft): RecipeChoice {
  const raw: unknown =
    draft.source === "new"
      ? { kind: "new", name: draft.newName, text: draft.newText }
      : draft.recipeId === null
        ? null
        : { kind: "existing", id: draft.recipeId };
  if (raw === null) throw new ActionFailure("VALIDATION", CHOOSE_A_RECIPE, { recipe: [CHOOSE_A_RECIPE] });
  try {
    return parseOrThrow(recipeChoiceSchema, raw);
  } catch (error) {
    // The schema keys the name under the choice; the sheet shows it at the recipe field.
    if (error instanceof ActionFailure) throw new ActionFailure("VALIDATION", error.message, { recipe: [error.message] });
    throw error;
  }
}

/** Add: everything the sheet holds, as `planMeal` takes it. */
export function planInputOf(draft: MealDraft): PlanInput {
  const recipe = recipeChoiceOf(draft);
  const note = parseOrThrow(mealNoteSchema, draft.note);
  const repeat = repeatChoiceOf(draft);
  return {
    date: draft.date,
    categoryId: draft.categoryId,
    recipe,
    ...(note === null ? {} : { note }),
    ...(repeat.kind === "never" ? {} : { repeat }),
  };
}

function sameRepeat(a: RepeatChoice, b: RepeatChoice): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * At scope `all` on a series, the date the person changed is one occurrence's:
 * the series moves by the same delta from its own anchor, so every earlier
 * occurrence survives — the calendar's `rebasedOnSeries` (FR-629). At the
 * other scopes, and for a one-off, the new date is the date.
 */
function rebasedDate(date: string, mode: Extract<MealFormMode, { kind: "edit" }>): string {
  if (mode.scope !== "all" || mode.meal.rrule === null) return date;
  return addDays(mode.meal.date, diffDays(mode.occurrence.date, date));
}

/** Edit: only what changed (FR-626); at scope `this` the recipe and the repeat are not on offer (FR-630). */
export function mealPatchOf(draft: MealDraft, mode: Extract<MealFormMode, { kind: "edit" }>): MealPatch {
  const patch: MealPatch = {};
  if (draft.date !== mode.occurrence.date) patch.date = rebasedDate(draft.date, mode);
  if (draft.categoryId !== mode.occurrence.categoryId) patch.categoryId = draft.categoryId;
  const note = parseOrThrow(mealNoteSchema, draft.note);
  if (note !== mode.occurrence.note) patch.note = note;
  if (mode.scope !== "this") {
    if (draft.recipeId !== null && draft.recipeId !== mode.occurrence.recipeId) patch.recipeId = draft.recipeId;
    const repeat = repeatChoiceOf(draft);
    if (!sameRepeat(repeat, mealRepeatChoiceOf(mode.meal.rrule))) patch.repeat = repeat;
  }
  if (Object.keys(patch).length === 0) {
    throw new ActionFailure("VALIDATION", NOTHING_TO_CHANGE, { note: [NOTHING_TO_CHANGE] });
  }
  return patch;
}
