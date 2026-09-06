"use client";

import { filterRecipes } from "@/lib/family/meals/library";
import type { MealCategory, Recipe } from "@/lib/family/types";

import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import type { MealDraft } from "./mealForm";

/**
 * The meal sheet's recipe (006 FR-622; 41418036777371 — "choose 'From Recipes'
 * (pick a saved recipe) or 'New Entry'"): two pills, then either the library
 * filtered by a mealtime chip (the slot's first) and a search box, each recipe
 * a radio row — or a name and an optional text that also become a recipe.
 * Removed recipes never appear (FR-618).
 */

export interface RecipePickerProps {
  draft: MealDraft;
  set: <K extends keyof MealDraft>(key: K, value: MealDraft[K]) => void;
  recipes: readonly Recipe[];
  categories: readonly MealCategory[];
  /** Edit mode offers the library only — a New Entry is a plan's (contracts). */
  allowNew: boolean;
  chip: string | null;
  onChip: (categoryId: string | null) => void;
  query: string;
  onQuery: (query: string) => void;
  errors: readonly string[] | undefined;
}

const PILL =
  "flex min-h-(--fam-touch) cursor-pointer items-center rounded-full bg-(--fam-pill-btn-bg) px-4 " +
  "text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted) has-checked:bg-(--fam-text-primary) has-checked:text-(--fam-app-bg)";
const CHIP = "flex min-h-(--fam-touch) cursor-pointer items-center rounded-full border border-(--fam-hairline) px-3 text-(length:--fam-fs-small) has-checked:bg-(--fam-text-primary) has-checked:text-(--fam-app-bg)";
const ROW = "flex min-h-(--fam-touch) cursor-pointer items-center gap-3 text-(length:--fam-fs-body)";

function SourcePills({ draft, set, allowNew }: Pick<RecipePickerProps, "draft" | "set" | "allowNew">) {
  if (!allowNew) return null;
  return (
    <fieldset className="flex gap-2">
      <legend className="sr-only">Recipe</legend>
      {(["existing", "new"] as const).map((source) => (
        <label key={source} className={PILL}>
          <input type="radio" name="recipe-source" value={source} checked={draft.source === source} onChange={() => set("source", source)} className="sr-only" />
          {source === "existing" ? "From Recipes" : "New Entry"}
        </label>
      ))}
    </fieldset>
  );
}

function Library({ draft, set, recipes, categories, chip, onChip, query, onQuery }: Omit<RecipePickerProps, "allowNew" | "errors">) {
  const shown = filterRecipes(recipes, { categoryId: chip, query });
  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Mealtime</legend>
        <label className={CHIP}>
          <input type="radio" name="recipe-chip" checked={chip === null} onChange={() => onChip(null)} className="sr-only" />
          All
        </label>
        {categories.map((category) => (
          <label key={category.id} className={CHIP}>
            <input type="radio" name="recipe-chip" checked={chip === category.id} onChange={() => onChip(category.id)} className="sr-only" />
            {category.name}
          </label>
        ))}
      </fieldset>
      <input type="search" aria-label="Search recipes" placeholder="Search" value={query} onChange={(event) => onQuery(event.target.value)} className={FIELD} />
      <fieldset className="flex max-h-[40vh] flex-col overflow-y-auto">
        <legend className="sr-only">Recipes</legend>
        {shown.length === 0 ? (
          <p className="py-2 text-(length:--fam-fs-small) text-(--fam-text-secondary)">No recipes match.</p>
        ) : (
          shown.map((recipe) => (
            <label key={recipe.id} className={ROW}>
              <input type="radio" name="recipe" value={recipe.id} checked={draft.recipeId === recipe.id} onChange={() => set("recipeId", recipe.id)} className="h-5 w-5" />
              <span className="min-w-0 flex-1 truncate">{recipe.name}</span>
            </label>
          ))
        )}
      </fieldset>
    </div>
  );
}

function NewEntry({ draft, set }: Pick<RecipePickerProps, "draft" | "set">) {
  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL}>
        What are we eating?
        <input value={draft.newName} onChange={(event) => set("newName", event.target.value)} maxLength={120} className={FIELD} />
      </label>
      <label className={LABEL}>
        Ingredients and instructions (optional)
        <textarea value={draft.newText} onChange={(event) => set("newText", event.target.value)} rows={4} maxLength={10_000} className={FIELD} />
      </label>
    </div>
  );
}

export function RecipePicker(props: RecipePickerProps) {
  const { draft, errors } = props;
  return (
    <div className="flex flex-col gap-2">
      <SourcePills draft={draft} set={props.set} allowNew={props.allowNew} />
      {draft.source === "new" && props.allowNew ? <NewEntry draft={draft} set={props.set} /> : <Library {...props} />}
      <FieldError messages={errors === undefined ? undefined : [...errors]} />
    </div>
  );
}
