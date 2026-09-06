"use client";

import { useMemo } from "react";

import { visibleListsOf } from "@/lib/family/lists/visibility";
import { dietaryNotesOf, type DietaryNote } from "@/lib/family/meals/dietary";
import { dayWordsOf } from "@/lib/family/meals/week";
import { useLists } from "@/lib/family/queries";
import type { List, Meal, MealCategory, MealOccurrence, Recipe } from "@/lib/family/types";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useFamily } from "../../components/FamilyProvider";
import { ScopeDialog } from "../../components/ScopeDialog";
import { AddToListSheet } from "./AddToListSheet";
import { MealPopover } from "./MealPopover";
import { MealSheet } from "./MealSheet";
import { RecipeDeleteDialog } from "./RecipeDeleteDialog";
import { RecipeForm } from "./RecipeForm";
import { RecipePane } from "./RecipePane";
import type { MealFormMode } from "./mealForm";
import { useLiveOccurrence, useMealEditor, type MealEditor } from "./useMealEditor";
import { mealKeyOf, recipeKeyOf, useMealWrites, type MealWrites } from "./useMealWrites";

/**
 * Every meal surface but the mealtime ones (006 US2–US4): the add and edit
 * sheets, the popover, the scope question, the delete confirmation, the
 * recipes pane with its form and its two-way delete, and Add to List. The
 * Meals tab mounts them under its grid; the Week calendar mounts the very same
 * under its token row (FR-636), each handing in what it has on show. The
 * model is one hook so the two hosts cannot drift: the queue, the editor, the
 * live occurrence, the dietary notes and the lists the actor may push onto.
 */

export interface MealSurfaceInputs {
  categories: readonly MealCategory[];
  recipes: readonly Recipe[];
  meals: readonly Meal[];
  /** The occurrences on show — what an open surface's meal is resolved against. */
  occurrences: readonly MealOccurrence[];
  /** Where Plan Meal from a recipe's detail lands (FR-621): the household's today. */
  todayDate: string;
}

export interface MealSurfaceModel extends MealSurfaceInputs {
  editor: MealEditor;
  writes: MealWrites;
  occurrence: MealOccurrence | null;
  /** Every recipe's name by id, removed ones included — a planned meal keeps its name (FR-616). */
  recipeNames: ReadonlyMap<string, string>;
  notes: readonly DietaryNote[];
  visibleLists: readonly List[];
  /** The one line the host shows: the editor's, else the queue's. */
  notice: string | null;
}

const NO_LISTS: List[] = [];

export function useMealSurfaceModel(inputs: MealSurfaceInputs): MealSurfaceModel {
  const { householdId, profiles, actor } = useFamily();
  const writes = useMealWrites();
  const editor = useMealEditor(writes);
  const occurrence = useLiveOccurrence(editor, inputs.occurrences);
  const notes = useMemo(() => dietaryNotesOf(profiles), [profiles]);
  const lists = useLists(householdId);
  const listRows = lists.data ?? NO_LISTS;
  const visibleLists = useMemo(() => visibleListsOf(listRows, actor), [listRows, actor]);
  const recipeNames = useMemo(() => new Map(inputs.recipes.map((recipe) => [recipe.id, recipe.name])), [inputs.recipes]);
  return { ...inputs, editor, writes, occurrence, recipeNames, notes, visibleLists, notice: editor.notice ?? writes.notice };
}

function categoryOf(m: MealSurfaceModel, id: string): MealCategory | undefined {
  return m.categories.find((one) => one.id === id);
}

/** The sheet's mode for the open surface — the live occurrence and its row, or the slot. */
function formModeOf(m: MealSurfaceModel): MealFormMode | null {
  const { surface } = m.editor;
  if (surface.kind === "add") return { kind: "add", ...surface.slot };
  if (surface.kind !== "edit" || m.occurrence === null) return null;
  const meal = m.meals.find((one) => one.id === m.occurrence?.mealId);
  return meal === undefined ? null : { kind: "edit", occurrence: m.occurrence, meal, scope: surface.scope };
}

function OccurrenceSurfaces({ m }: { m: MealSurfaceModel }) {
  const { editor, occurrence } = m;
  const { surface } = editor;
  if (occurrence === null) return null;
  const category = categoryOf(m, occurrence.categoryId);
  const name = m.recipeNames.get(occurrence.recipeId) ?? "Recipe";
  if (surface.kind === "popover" && category !== undefined) {
    return (
      <MealPopover
        occurrence={occurrence}
        recipeName={name}
        category={category}
        busy={m.writes.busyKeys.has(mealKeyOf(occurrence))}
        onOpenRecipe={() => editor.openRecipes(occurrence.recipeId)}
        onAddToList={() => editor.openPush(occurrence.recipeId)}
        onEdit={() => editor.startEdit(occurrence)}
        onDelete={() => editor.startDelete(occurrence)}
        onAddAnother={() => editor.openAdd({ date: occurrence.date, categoryId: occurrence.categoryId })}
        onClose={editor.close}
      />
    );
  }
  if (surface.kind === "scope") {
    return <ScopeDialog mode={surface.action} noun="meal" onChoose={editor.chooseScope} onCancel={editor.close} />;
  }
  if (surface.kind === "delete") {
    return (
      <ConfirmDialog
        title={`Delete ${name}?`}
        body={`${dayWordsOf(occurrence.date)}, ${category?.name ?? ""}. The recipe stays in the library.`}
        confirmLabel="Delete meal"
        pending={m.writes.busyKeys.has(mealKeyOf(occurrence))}
        onConfirm={() => void editor.confirmDelete(occurrence)}
        onCancel={editor.close}
      />
    );
  }
  return null;
}

/** How many planned meals (rows, not occurrences) reference a recipe — the delete dialog's count. */
function mealCountOf(meals: readonly Meal[], recipeId: string): number {
  return meals.filter((meal) => meal.recipeId === recipeId).length;
}

function RecipeSurfaces({ m }: { m: MealSurfaceModel }) {
  const { editor } = m;
  const { surface } = editor;
  if (surface.kind === "recipes") {
    return (
      <RecipePane
        recipes={m.recipes}
        categories={m.categories}
        selectedId={surface.recipeId}
        onSelect={editor.openRecipes}
        onNew={() => editor.openRecipeForm({ kind: "create", categoryId: m.categories[0]?.id ?? "" })}
        onPlan={(recipe) => editor.openAdd({ date: m.todayDate, categoryId: recipe.categoryId, recipeId: recipe.id })}
        onAddToList={(recipe) => editor.openPush(recipe.id)}
        onEdit={(recipe) => editor.openRecipeForm({ kind: "edit", recipe })}
        onDelete={editor.openRecipeDelete}
        onClose={editor.close}
      />
    );
  }
  if (surface.kind === "recipe-form") {
    return <RecipeForm mode={surface.mode} categories={m.categories} notes={m.notes} onSubmit={editor.submitRecipe} onClose={editor.close} />;
  }
  if (surface.kind === "recipe-delete") {
    const recipe = m.recipes.find((one) => one.id === surface.recipeId);
    if (recipe === undefined) return null;
    return (
      <RecipeDeleteDialog
        recipe={recipe}
        mealCount={mealCountOf(m.meals, recipe.id)}
        pending={m.writes.busyKeys.has(recipeKeyOf(recipe))}
        onConfirm={(mode) => void editor.confirmRecipeDelete(recipe, mode)}
        onCancel={() => editor.openRecipes(recipe.id)}
      />
    );
  }
  return null;
}

function PushSurface({ m }: { m: MealSurfaceModel }) {
  const { editor } = m;
  const { surface } = editor;
  if (surface.kind !== "push") return null;
  const recipe = m.recipes.find((one) => one.id === surface.recipeId);
  if (recipe === undefined) return null;
  return (
    <AddToListSheet
      recipeName={recipe.name}
      text={recipe.text}
      lists={m.visibleLists}
      onSubmit={(input) => editor.submitPush(input, m.visibleLists.find((list) => list.id === input.listId)?.name ?? "the list")}
      onClose={editor.close}
    />
  );
}

export function MealSurfaces({ m }: { m: MealSurfaceModel }) {
  const mode = formModeOf(m);
  if (mode !== null) {
    return (
      <MealSheet
        mode={mode}
        categories={m.categories}
        recipes={m.recipes}
        notes={m.notes}
        onSubmit={(result) => m.editor.submitMeal(m.occurrence, result)}
        onClose={m.editor.close}
      />
    );
  }
  return (
    <>
      <OccurrenceSurfaces m={m} />
      <RecipeSurfaces m={m} />
      <PushSurface m={m} />
    </>
  );
}
