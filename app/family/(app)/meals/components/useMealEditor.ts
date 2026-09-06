"use client";

import { useCallback, useEffect, useMemo } from "react";

import { itemsInWords } from "@/lib/family/lists/grouping";
import type { Meal, MealCategory, MealOccurrence, MealScope, Recipe } from "@/lib/family/types";

import { useWriteSurface, type WriteSurface } from "../../components/useWriteSurface";
import type { MealtimePatch } from "./CategoryForm";
import type { Slot } from "./MealCell";
import type { RecipeDeleteMode } from "./RecipeDeleteDialog";
import type { MealFormResult } from "./mealForm";
import type { RecipeFormMode, RecipeFormResult } from "./recipeDraft";
import type { MealWrites, WriteOutcome } from "./useMealWrites";

/**
 * The meal surfaces' state machine (006 plan §V): which one sheet, popover,
 * question or confirmation is open, and the verbs that move between them.
 * One at a time: the popover hands over to the others. Shared by the Meals
 * tab and the Week calendar (FR-636 — a token opens "the same popover"), so
 * it knows nothing of either grid: a surface names its occurrence by meal
 * and date, and `useLiveOccurrence` resolves that against whatever is on
 * show, closing quietly once the meal has gone.
 */

const GONE_MESSAGE = "That meal is no longer here.";

/** Which occurrence a surface is about — re-read live on every render, never a stale copy. */
export interface OccurrenceRef {
  mealId: string;
  occurrenceDate: string;
}

export type MealSurface =
  | { kind: "closed" }
  | { kind: "categories" }
  | { kind: "mealtime"; category: MealCategory }
  | { kind: "add"; slot: Slot }
  | { kind: "popover"; ref: OccurrenceRef }
  | { kind: "scope"; ref: OccurrenceRef; action: "edit" | "delete" }
  | { kind: "edit"; ref: OccurrenceRef; scope?: MealScope }
  | { kind: "delete"; ref: OccurrenceRef; scope?: MealScope }
  | { kind: "recipes"; recipeId: string | null }
  | { kind: "recipe-form"; mode: RecipeFormMode }
  | { kind: "recipe-delete"; recipeId: string }
  | { kind: "push"; recipeId: string };

const SURFACE_CLOSED: MealSurface = { kind: "closed" };

function refOf(surface: MealSurface): OccurrenceRef | null {
  return "ref" in surface ? surface.ref : null;
}

export interface PushInput {
  listId: string;
  texts: string[];
}

export interface RecipeVerbs {
  openRecipes: (recipeId: string | null) => void;
  openPush: (recipeId: string) => void;
  /** FR-632: one write, then the one-line confirmation on the board. */
  submitPush: (input: PushInput, listName: string) => Promise<WriteOutcome<{ added: number }>>;
  openRecipeForm: (mode: RecipeFormMode) => void;
  openRecipeDelete: (recipe: Recipe) => void;
  submitRecipe: (result: RecipeFormResult) => Promise<WriteOutcome<Recipe>>;
  confirmRecipeDelete: (recipe: Recipe, mode: RecipeDeleteMode) => Promise<void>;
}

export interface MealEditor extends RecipeVerbs {
  surface: MealSurface;
  notice: string | null;
  openCategories: () => void;
  openMealtime: (category: MealCategory) => void;
  openAdd: (slot: Slot) => void;
  openPopover: (occurrence: MealOccurrence) => void;
  /** Edit or Delete from the popover: the scope question first for a repeating occurrence (FR-629). */
  startEdit: (occurrence: MealOccurrence) => void;
  startDelete: (occurrence: MealOccurrence) => void;
  chooseScope: (scope: MealScope) => void;
  close: () => void;
  closeQuietly: () => void;
  submitMealtime: (patch: MealtimePatch) => Promise<WriteOutcome<MealCategory>>;
  submitMeal: (occurrence: MealOccurrence | null, result: MealFormResult) => Promise<WriteOutcome<Meal>>;
  confirmDelete: (occurrence: MealOccurrence) => Promise<void>;
}

function refFor(occurrence: MealOccurrence): OccurrenceRef {
  return { mealId: occurrence.mealId, occurrenceDate: occurrence.occurrenceDate };
}

/** The recipe library's verbs and the push (US3, US4), on the same one surface. */
function useRecipeVerbs(writes: MealWrites, ws: WriteSurface<MealSurface>): RecipeVerbs {
  const { surface, open, setSurface, setNotice } = ws;

  const openRecipes = useCallback((recipeId: string | null) => open({ kind: "recipes", recipeId }), [open]);
  const openPush = useCallback((recipeId: string) => setSurface({ kind: "push", recipeId }), [setSurface]);
  const submitPush = useCallback(
    async (input: PushInput, listName: string) => {
      const result = await writes.pushToList(input.listId, input.texts);
      if (result?.ok) setNotice(`${itemsInWords(result.data.added)} added to ${listName}.`);
      return result;
    },
    [writes, setNotice],
  );
  const openRecipeForm = useCallback((mode: RecipeFormMode) => setSurface({ kind: "recipe-form", mode }), [setSurface]);
  const openRecipeDelete = useCallback((recipe: Recipe) => setSurface({ kind: "recipe-delete", recipeId: recipe.id }), [setSurface]);
  const submitRecipe = useCallback(
    async (result: RecipeFormResult) => {
      if (surface.kind !== "recipe-form") return null;
      if (result.kind === "create") return writes.createRecipe(result.input);
      return surface.mode.kind === "edit" ? writes.updateRecipe(surface.mode.recipe, result.patch) : null;
    },
    [surface, writes],
  );
  const confirmRecipeDelete = useCallback(
    async (recipe: Recipe, mode: RecipeDeleteMode) => {
      // Back to the pane, on nothing: the recipe is leaving the list either way.
      setSurface({ kind: "recipes", recipeId: null });
      await writes.deleteRecipe(recipe, mode);
    },
    [setSurface, writes],
  );

  return { openRecipes, openPush, submitPush, openRecipeForm, openRecipeDelete, submitRecipe, confirmRecipeDelete };
}

export function useMealEditor(writes: MealWrites): MealEditor {
  const ws = useWriteSurface<MealSurface>(SURFACE_CLOSED, GONE_MESSAGE);
  const { surface, notice, open, setSurface, close } = ws;
  const recipes = useRecipeVerbs(writes, ws);

  const openCategories = useCallback(() => open({ kind: "categories" }), [open]);
  const openMealtime = useCallback((category: MealCategory) => open({ kind: "mealtime", category }), [open]);
  const openAdd = useCallback((slot: Slot) => open({ kind: "add", slot }), [open]);
  const openPopover = useCallback((occurrence: MealOccurrence) => open({ kind: "popover", ref: refFor(occurrence) }), [open]);
  const startEdit = useCallback(
    (occurrence: MealOccurrence) =>
      setSurface(occurrence.isRepeating ? { kind: "scope", ref: refFor(occurrence), action: "edit" } : { kind: "edit", ref: refFor(occurrence) }),
    [setSurface],
  );
  const startDelete = useCallback(
    (occurrence: MealOccurrence) =>
      setSurface(occurrence.isRepeating ? { kind: "scope", ref: refFor(occurrence), action: "delete" } : { kind: "delete", ref: refFor(occurrence) }),
    [setSurface],
  );
  const chooseScope = useCallback(
    (scope: MealScope) => setSurface((current) => (current.kind === "scope" ? { kind: current.action, ref: current.ref, scope } : current)),
    [setSurface],
  );

  const submitMealtime = useCallback(
    async (patch: MealtimePatch) => (surface.kind === "mealtime" ? writes.updateMealtime(surface.category, patch) : null),
    [surface, writes],
  );
  const submitMeal = useCallback(
    async (occurrence: MealOccurrence | null, result: MealFormResult) => {
      if (result.kind === "plan") return writes.plan(result.input);
      if (occurrence === null || surface.kind !== "edit") return null;
      return writes.update(occurrence, result.patch, surface.scope);
    },
    [surface, writes],
  );
  const confirmDelete = useCallback(
    async (occurrence: MealOccurrence) => {
      if (surface.kind !== "delete") return;
      const { scope } = surface;
      close();
      await writes.remove(occurrence, scope);
    },
    [surface, close, writes],
  );

  return {
    surface,
    notice,
    openCategories,
    openMealtime,
    openAdd,
    openPopover,
    startEdit,
    startDelete,
    chooseScope,
    close,
    closeQuietly: close,
    ...recipes,
    submitMealtime,
    submitMeal,
    confirmDelete,
  };
}

/** The live occurrence a surface is about — `null` once it has gone, which closes the surface quietly. */
export function useLiveOccurrence(editor: MealEditor, occurrences: readonly MealOccurrence[]): MealOccurrence | null {
  const ref = refOf(editor.surface);
  const live = useMemo(
    () => (ref === null ? null : (occurrences.find((one) => one.mealId === ref.mealId && one.occurrenceDate === ref.occurrenceDate) ?? null)),
    [ref, occurrences],
  );
  const { closeQuietly } = editor;
  const gone = ref !== null && live === null;
  useEffect(() => {
    if (gone) closeQuietly();
  }, [gone, closeQuietly]);
  return live;
}
