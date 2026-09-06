"use server";

/**
 * The Meals tab's seven server actions (006 contracts/server-actions.md; R603,
 * R604). Every one is `requireVerifiedActor()` — any role — scoped by the
 * actor's household on every query, one statement per write except the split
 * (a function, for 015's atomicity reason). `updateMealCategory` alone
 * re-checks `parent` (FR-640). A recipe is one record; a meal references it
 * (Assumption 9); "Just the recipe" is `removed_at` (R601).
 *
 * Scopes (FR-629, FR-630): a one-time meal takes none; a repeating one
 * requires one — `this` is an exception row on the occurrence's ORIGINAL
 * date, `this_and_future` a split (or the whole series from its first
 * occurrence), `all` the row itself. A recipe changes at series scopes only.
 */

import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireVerifiedActor } from "../guards";
import { isFirstOccurrenceOf, occurrenceOn } from "../meals/expand";
import { assertMealRuleReachable, mealRuleOf, reanchoredMealRule, truncatedMealRule } from "../meals/repeat";
import { can } from "../permissions";
import {
  MEAL_CATEGORY_COLUMNS,
  RECIPE_COLUMNS,
  mealsSelect,
  toMeal,
  toMealCategory,
  toRecipe,
  type MealCategoryRow,
  type MealRow,
  type RecipeRow,
} from "../rows";
import type { PaletteColor } from "../colors";
import type { Actor, Meal, MealCategory, MealOccurrence, Recipe, RepeatChoice, WeekStart } from "../types";
import {
  MEALTIME_NAME_TAKEN,
  createRecipeSchema,
  deleteMealSchema,
  deleteRecipeSchema,
  parseOrThrow,
  planMealSchema,
  updateMealCategorySchema,
  updateMealSchema,
  updateRecipeSchema,
  type PlanMealInput,
  type UpdateMealInput,
} from "../validation";
import { adminFamily, loadHouseholdZone, mapDbError, touchActor, type HouseholdZone } from "./shared";

const SCOPE_FOR_SERIES = "Choose a scope for a repeating meal.";
const NO_SCOPE_FOR_ONE_OFF = "A one-time meal has no scope.";
const NAME_KEY = "meal_categories_name_key";

type Write = Record<string, string | number | null>;

/* ------------------------------------------------------------------ loads -- */

async function loadCategory(householdId: string, id: string): Promise<MealCategory> {
  const { data, error } = await adminFamily()
    .from("meal_categories")
    .select(MEAL_CATEGORY_COLUMNS)
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toMealCategory(data as unknown as MealCategoryRow);
}

/** A recipe of this household; a removed one is `NOT_FOUND` unless the caller says otherwise (R601). */
async function loadRecipe(householdId: string, id: string, allowRemoved = false): Promise<Recipe> {
  const { data, error } = await adminFamily()
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  const recipe = toRecipe(data as unknown as RecipeRow);
  if (recipe.removedAt !== null && !allowRemoved) throw new ActionFailure("NOT_FOUND");
  return recipe;
}

/** A meal with its exceptions — what every scope decision reads. */
async function loadMeal(householdId: string, id: string): Promise<Meal> {
  const { data, error } = await adminFamily()
    .from("meals")
    .select(mealsSelect())
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  return toMeal(data as unknown as MealRow);
}

/** Contracts: `occurrenceDate` must name an occurrence the expander produces, else `NOT_FOUND`. */
function requireOccurrence(meal: Meal, occurrenceDate: string, zone: string): MealOccurrence {
  const found = occurrenceOn(meal, occurrenceDate, zone);
  if (found === null) throw new ActionFailure("NOT_FOUND");
  return found;
}

function weekStartOf(household: HouseholdZone): WeekStart {
  return household.wkst === "MO" ? 1 : 0;
}

/* ------------------------------------------------------------- mealtimes -- */

export async function updateMealCategory(input: {
  id: string;
  patch: { name?: string; color?: PaletteColor };
}): Promise<ActionResult<MealCategory>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    if (!can(actor, "mealtime.edit", { householdHasParent: true }).allowed) throw new ActionFailure("FORBIDDEN");
    const parsed = parseOrThrow(updateMealCategorySchema, input);
    const category = await loadCategory(actor.householdId, parsed.id);

    const patch: Write = { updated_by: actor.profileId };
    if (parsed.patch.name !== undefined) patch.name = parsed.patch.name;
    if (parsed.patch.color !== undefined) patch.color = parsed.patch.color;
    const { data, error } = await adminFamily()
      .from("meal_categories")
      .update(patch)
      .eq("id", category.id)
      .eq("household_id", actor.householdId)
      .select(MEAL_CATEGORY_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505" && error.message.includes(NAME_KEY)) {
        throw new ActionFailure("CONFLICT", MEALTIME_NAME_TAKEN, { name: [MEALTIME_NAME_TAKEN] });
      }
      throw mapDbError(error);
    }
    await touchActor(actor);
    return toMealCategory(data as unknown as MealCategoryRow);
  });
}

/* --------------------------------------------------------------- recipes -- */

async function insertRecipe(actor: Actor, name: string, categoryId: string, text: string): Promise<Recipe> {
  const { data, error } = await adminFamily()
    .from("recipes")
    .insert({ household_id: actor.householdId, name, category_id: categoryId, text, created_by: actor.profileId, updated_by: actor.profileId })
    .select(RECIPE_COLUMNS)
    .single();
  if (error) throw mapDbError(error);
  return toRecipe(data as unknown as RecipeRow);
}

export async function createRecipe(input: { name: string; categoryId: string; text?: string }): Promise<ActionResult<Recipe>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(createRecipeSchema, input);
    const category = await loadCategory(actor.householdId, parsed.categoryId);
    const recipe = await insertRecipe(actor, parsed.name, category.id, parsed.text ?? "");
    await touchActor(actor);
    return recipe;
  });
}

export async function updateRecipe(input: {
  id: string;
  patch: { name?: string; categoryId?: string; text?: string };
}): Promise<ActionResult<Recipe>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(updateRecipeSchema, input);
    const recipe = await loadRecipe(actor.householdId, parsed.id);
    if (parsed.patch.categoryId !== undefined) await loadCategory(actor.householdId, parsed.patch.categoryId);

    const patch: Write = { updated_by: actor.profileId };
    if (parsed.patch.name !== undefined) patch.name = parsed.patch.name;
    if (parsed.patch.categoryId !== undefined) patch.category_id = parsed.patch.categoryId;
    if (parsed.patch.text !== undefined) patch.text = parsed.patch.text;
    const { data, error } = await adminFamily()
      .from("recipes")
      .update(patch)
      .eq("id", recipe.id)
      .eq("household_id", actor.householdId)
      .select(RECIPE_COLUMNS)
      .single();
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return toRecipe(data as unknown as RecipeRow);
  });
}

/** How many meals reference a recipe — what the second delete choice takes with it. */
async function mealCountOf(householdId: string, recipeId: string): Promise<number> {
  const { count, error } = await adminFamily()
    .from("meals")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", recipeId)
    .eq("household_id", householdId);
  if (error) throw mapDbError(error);
  return count ?? 0;
}

export async function deleteRecipe(input: {
  id: string;
  mode: "recipe" | "recipe_and_meals";
  confirm: true;
}): Promise<ActionResult<{ removedMeals: number }>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(deleteRecipeSchema, input);
    const recipe = await loadRecipe(actor.householdId, parsed.id, parsed.mode === "recipe_and_meals");

    if (parsed.mode === "recipe") {
      const { error } = await adminFamily()
        .from("recipes")
        .update({ removed_at: new Date().toISOString(), updated_by: actor.profileId })
        .eq("id", recipe.id)
        .eq("household_id", actor.householdId);
      if (error) throw mapDbError(error);
      await touchActor(actor);
      return { removedMeals: 0 };
    }

    const removedMeals = await mealCountOf(actor.householdId, recipe.id);
    const { error } = await adminFamily().from("recipes").delete().eq("id", recipe.id).eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return { removedMeals };
  });
}

/* ----------------------------------------------------------------- meals -- */

/** The recipe a plan names: an existing one of the household, or a new entry made in the slot's mealtime (FR-622). */
async function recipeOfChoice(actor: Actor, choice: PlanMealInput["recipe"], categoryId: string): Promise<string> {
  if (choice.kind === "existing") return (await loadRecipe(actor.householdId, choice.id)).id;
  return (await insertRecipe(actor, choice.name, categoryId, choice.text ?? "")).id;
}

function ruleOf(repeat: RepeatChoice | undefined, date: string, household: HouseholdZone): string | null {
  return repeat === undefined ? null : mealRuleOf(repeat, date, weekStartOf(household));
}

export async function planMeal(input: PlanMealInput): Promise<ActionResult<Meal>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(planMealSchema, input);
    const household = await loadHouseholdZone(actor.householdId);
    const category = await loadCategory(actor.householdId, parsed.categoryId);
    const recipeId = await recipeOfChoice(actor, parsed.recipe, category.id);
    const rrule = ruleOf(parsed.repeat, parsed.date, household);

    const { data, error } = await adminFamily()
      .from("meals")
      .insert({
        household_id: actor.householdId,
        date: parsed.date,
        category_id: category.id,
        recipe_id: recipeId,
        note: parsed.note ?? null,
        rrule,
        created_by: actor.profileId,
        updated_by: actor.profileId,
      })
      .select("id")
      .single();
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return loadMeal(actor.householdId, (data as { id: string }).id);
  });
}

type MealPatch = UpdateMealInput["patch"];

/** The scope a meal takes: none for a one-off, one of the three for a series (FR-629). */
function requireScope(meal: Meal, scope: UpdateMealInput["scope"]): UpdateMealInput["scope"] {
  if (meal.rrule === null) {
    if (scope !== undefined) throw new ActionFailure("VALIDATION", NO_SCOPE_FOR_ONE_OFF, { scope: [NO_SCOPE_FOR_ONE_OFF] });
    return undefined;
  }
  if (scope === undefined) throw new ActionFailure("VALIDATION", SCOPE_FOR_SERIES, { scope: [SCOPE_FOR_SERIES] });
  return scope;
}

/** Every reference a patch carries must be the household's. */
async function assertPatchReferences(actor: Actor, patch: MealPatch): Promise<void> {
  if (patch.categoryId !== undefined) await loadCategory(actor.householdId, patch.categoryId);
  if (patch.recipeId !== undefined) await loadRecipe(actor.householdId, patch.recipeId);
}

/** The whole row as the patch leaves it (scope `all`, or a one-off): the rule follows the date and the repeat. */
function rowColumnsOf(meal: Meal, patch: MealPatch, household: HouseholdZone, actor: Actor): Write {
  const date = patch.date ?? meal.date;
  const columns: Write = { updated_by: actor.profileId, date };
  if (patch.categoryId !== undefined) columns.category_id = patch.categoryId;
  if (patch.recipeId !== undefined) columns.recipe_id = patch.recipeId;
  if (patch.note !== undefined) columns.note = patch.note;
  if (patch.repeat !== undefined) columns.rrule = ruleOf(patch.repeat, date, household);
  else if (meal.rrule !== null && patch.date !== undefined) columns.rrule = reanchoredMealRule(meal.rrule, meal.date, date);
  if (typeof columns.rrule === "string") assertMealRuleReachable(columns.rrule, date);
  return columns;
}

async function deleteExceptionsOf(householdId: string, mealId: string, from?: string): Promise<void> {
  let query = adminFamily().from("meal_exceptions").delete().eq("meal_id", mealId).eq("household_id", householdId);
  if (from !== undefined) query = query.gte("occurrence_date", from);
  const { error } = await query;
  if (error) throw mapDbError(error);
}

/** Scope `all` and the one-off: one UPDATE; a series turned one-off keeps no exceptions. */
async function updateWholeRow(meal: Meal, patch: MealPatch, actor: Actor, household: HouseholdZone): Promise<void> {
  const columns = rowColumnsOf(meal, patch, household, actor);
  const { error } = await adminFamily().from("meals").update(columns).eq("id", meal.id).eq("household_id", actor.householdId);
  if (error) throw mapDbError(error);
  if (meal.rrule !== null && columns.rrule === null) await deleteExceptionsOf(actor.householdId, meal.id);
}

/** Scope `this`: an override on the occurrence's original date, merged over any it already had. */
async function overrideThis(meal: Meal, occurrence: MealOccurrence, patch: MealPatch, actor: Actor): Promise<void> {
  const existing = meal.exceptions.find((one) => one.occurrenceDate === occurrence.occurrenceDate);
  const row = {
    household_id: actor.householdId,
    meal_id: meal.id,
    occurrence_date: occurrence.occurrenceDate,
    action: "override",
    date: patch.date ?? existing?.date ?? null,
    category_id: patch.categoryId ?? existing?.categoryId ?? null,
    // `null` in the patch clears the note: stored as '' so the expander can tell it from "inherit".
    note: patch.note === undefined ? (existing?.note ?? null) : (patch.note ?? ""),
    created_by: existing?.createdBy ?? actor.profileId,
    updated_by: actor.profileId,
  };
  const { error } = await adminFamily().from("meal_exceptions").upsert(row, { onConflict: "meal_id,occurrence_date" });
  if (error) throw mapDbError(error);
}

/** Scope `this_and_future` off the first occurrence: the split function, one transaction (R603). */
async function splitFrom(
  meal: Meal,
  occurrence: MealOccurrence,
  patch: MealPatch,
  actor: Actor,
  household: HouseholdZone,
): Promise<string> {
  const rrule = meal.rrule as string;
  const cut = occurrence.occurrenceDate;
  const tailDate = patch.date ?? cut;
  const tailRule =
    patch.repeat !== undefined ? ruleOf(patch.repeat, tailDate, household) : reanchoredMealRule(rrule, cut, tailDate);
  assertMealRuleReachable(tailRule, tailDate);
  const { data, error } = await adminFamily().rpc("split_meal_series", {
    p_household_id: actor.householdId,
    p_meal_id: meal.id,
    p_actor: actor.profileId,
    p_head_rrule: truncatedMealRule(rrule, cut),
    p_cut: cut,
    p_tail_meal: {
      date: tailDate,
      category_id: patch.categoryId ?? meal.categoryId,
      recipe_id: patch.recipeId ?? meal.recipeId,
      note: patch.note === undefined ? (meal.note ?? "") : (patch.note ?? ""),
      rrule: tailRule ?? "",
    },
  });
  if (error) throw mapDbError(error);
  if (typeof data !== "string") throw new ActionFailure("UNAVAILABLE");
  // A tail that no longer repeats has nothing for its re-homed exceptions to key.
  if (tailRule === null) await deleteExceptionsOf(actor.householdId, data);
  return data;
}

async function applyUpdate(meal: Meal, parsed: UpdateMealInput, actor: Actor, household: HouseholdZone): Promise<string> {
  const occurrence = requireOccurrence(meal, parsed.occurrenceDate, household.zone);
  const scope = requireScope(meal, parsed.scope);
  if (scope === "this") {
    await overrideThis(meal, occurrence, parsed.patch, actor);
    return meal.id;
  }
  if (scope === "this_and_future" && !isFirstOccurrenceOf(meal, occurrence.occurrenceDate, household.zone)) {
    return splitFrom(meal, occurrence, parsed.patch, actor, household);
  }
  await updateWholeRow(meal, parsed.patch, actor, household);
  return meal.id;
}

export async function updateMeal(input: UpdateMealInput): Promise<ActionResult<Meal>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(updateMealSchema, input);
    const household = await loadHouseholdZone(actor.householdId);
    const meal = await loadMeal(actor.householdId, parsed.id);
    await assertPatchReferences(actor, parsed.patch);

    const mealId = await applyUpdate(meal, parsed, actor, household);
    await touchActor(actor);
    return loadMeal(actor.householdId, mealId);
  });
}

async function deleteRow(householdId: string, mealId: string): Promise<void> {
  const { error } = await adminFamily().from("meals").delete().eq("id", mealId).eq("household_id", householdId);
  if (error) throw mapDbError(error);
}

/** Scope `this` on a delete: a skip on the original date; an override there becomes the skip. */
async function skipThis(meal: Meal, occurrence: MealOccurrence, actor: Actor): Promise<void> {
  const { error } = await adminFamily()
    .from("meal_exceptions")
    .upsert(
      {
        household_id: actor.householdId,
        meal_id: meal.id,
        occurrence_date: occurrence.occurrenceDate,
        action: "skip",
        date: null,
        category_id: null,
        note: null,
        created_by: actor.profileId,
        updated_by: actor.profileId,
      },
      { onConflict: "meal_id,occurrence_date" },
    );
  if (error) throw mapDbError(error);
}

/** Scope `this_and_future` off the first occurrence: the rule ends the day before, and later exceptions go. */
async function truncateFrom(meal: Meal, occurrence: MealOccurrence, actor: Actor): Promise<void> {
  const cut = occurrence.occurrenceDate;
  const { error } = await adminFamily()
    .from("meals")
    .update({ rrule: truncatedMealRule(meal.rrule as string, cut), updated_by: actor.profileId })
    .eq("id", meal.id)
    .eq("household_id", actor.householdId);
  if (error) throw mapDbError(error);
  await deleteExceptionsOf(actor.householdId, meal.id, cut);
}

async function applyDelete(meal: Meal, parsed: { occurrenceDate: string; scope?: UpdateMealInput["scope"] }, actor: Actor, zone: string): Promise<void> {
  const occurrence = requireOccurrence(meal, parsed.occurrenceDate, zone);
  const scope = requireScope(meal, parsed.scope);
  if (scope === "this") return skipThis(meal, occurrence, actor);
  if (scope === "this_and_future" && !isFirstOccurrenceOf(meal, occurrence.occurrenceDate, zone)) {
    return truncateFrom(meal, occurrence, actor);
  }
  return deleteRow(actor.householdId, meal.id);
}

export async function deleteMeal(input: {
  id: string;
  occurrenceDate: string;
  scope?: "this" | "this_and_future" | "all";
  confirm: true;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(deleteMealSchema, input);
    const household = await loadHouseholdZone(actor.householdId);
    const meal = await loadMeal(actor.householdId, parsed.id);

    await applyDelete(meal, parsed, actor, household.zone);
    await touchActor(actor);
    return null;
  });
}
