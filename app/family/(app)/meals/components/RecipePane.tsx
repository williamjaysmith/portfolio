"use client";

import { ChevronLeft } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import { filterRecipes } from "@/lib/family/meals/library";
import type { MealCategory, Recipe } from "@/lib/family/types";

import { FormDialog } from "../../components/FormDialog";
import { FIELD } from "../../components/settings/CategoryFields";

/**
 * The recipes pane (006 FR-618–FR-621; 43810243302811 — "two-panel — left
 * panel lists all recipes, right panel shows the selected recipe's detail";
 * 44338446585115 — "category filter buttons at the top of the recipe list,
 * plus a keyword search box"): the library, folded into the Meals tab as a
 * pane rather than a tab (spec Assumption 2). Two panels beside each other
 * where the pane is wide (a container query), the detail over the list on a
 * phone with a way back. Removed recipes never appear.
 *
 * Purely presentational: the board holds which recipe is selected, so Open
 * Recipe from a meal's popover lands here on that recipe.
 */

export interface RecipePaneProps {
  recipes: readonly Recipe[];
  categories: readonly MealCategory[];
  selectedId: string | null;
  onSelect: (recipeId: string | null) => void;
  onNew: () => void;
  onPlan: (recipe: Recipe) => void;
  onAddToList: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onClose: () => void;
}

const CHIP =
  "flex min-h-(--fam-touch) cursor-pointer items-center rounded-full border border-(--fam-hairline) px-3 " +
  "text-(length:--fam-fs-small) has-checked:bg-(--fam-text-primary) has-checked:text-(--fam-app-bg)";
const ROW = "flex min-h-(--fam-touch) w-full items-center gap-3 rounded-xl px-2 text-left text-(length:--fam-fs-body) hover:bg-(--fam-pill-btn-bg)";
const ACTION =
  "flex min-h-(--fam-touch) items-center rounded-full bg-(--fam-btn-secondary-bg) px-4 text-(length:--fam-fs-body) font-medium";
const BADGE = "fam-profile grid size-8 shrink-0 place-items-center rounded-full bg-(--fam-profile-100) text-(length:--fam-fs-small) font-semibold text-white";

function Badge({ category }: { category: MealCategory | undefined }) {
  if (category === undefined) return null;
  return (
    <span aria-label={category.name} role="img" style={profileVars(category.color) as CSSProperties} className={BADGE}>
      {category.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function RecipeList({
  recipes,
  categories,
  selectedId,
  onSelect,
  onNew,
}: Pick<RecipePaneProps, "recipes" | "categories" | "selectedId" | "onSelect" | "onNew">) {
  const [chip, setChip] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const shown = filterRecipes(recipes, { categoryId: chip, query });
  const categoryOf = (id: string) => categories.find((one) => one.id === id);
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Mealtime</legend>
        <label className={CHIP}>
          <input type="radio" name="pane-chip" checked={chip === null} onChange={() => setChip(null)} className="sr-only" />
          All
        </label>
        {categories.map((category) => (
          <label key={category.id} className={CHIP}>
            <input type="radio" name="pane-chip" checked={chip === category.id} onChange={() => setChip(category.id)} className="sr-only" />
            {category.name}
          </label>
        ))}
      </fieldset>
      <input type="search" aria-label="Search recipes" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} className={FIELD} />
      <ul aria-label="Recipes" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {shown.map((recipe) => (
          <li key={recipe.id}>
            <button type="button" aria-current={recipe.id === selectedId ? "true" : undefined} onClick={() => onSelect(recipe.id)} className={ROW}>
              <Badge category={categoryOf(recipe.categoryId)} />
              <span className="min-w-0 flex-1 truncate">{recipe.name}</span>
            </button>
          </li>
        ))}
        {shown.length === 0 ? <li className="py-2 text-(length:--fam-fs-small) text-(--fam-text-secondary)">No recipes match.</li> : null}
      </ul>
      <button type="button" onClick={onNew} className="min-h-(--fam-touch) rounded-full bg-(--fam-primary-blue) px-5 text-(length:--fam-fs-body) font-medium text-white">
        New recipe
      </button>
    </div>
  );
}

function RecipeDetail({
  recipe,
  category,
  onBack,
  onPlan,
  onAddToList,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  category: MealCategory | undefined;
  onBack: () => void;
} & Pick<RecipePaneProps, "onPlan" | "onAddToList" | "onEdit" | "onDelete">) {
  return (
    <article aria-labelledby="recipe-detail-title" className="flex min-h-0 flex-col gap-3">
      <button type="button" onClick={onBack} className="flex min-h-(--fam-touch) items-center gap-1 self-start text-(length:--fam-fs-small) text-(--fam-text-muted) @lg:hidden">
        <ChevronLeft aria-hidden="true" size={18} />
        Recipes
      </button>
      <h3 id="recipe-detail-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)">
        {recipe.name}
      </h3>
      {category === undefined ? null : (
        <p className="flex items-center gap-2 text-(length:--fam-fs-small) text-(--fam-text-secondary)">
          <span aria-hidden="true" style={profileVars(category.color) as CSSProperties} className="fam-profile size-3 rounded-full bg-(--fam-profile-100)" />
          {category.name}
        </p>
      )}
      <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap font-(family-name:--fam-font-sans) text-(length:--fam-fs-body)">
        {recipe.text === "" ? <span className="text-(--fam-text-muted)">No ingredients or instructions yet.</span> : recipe.text}
      </pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onPlan(recipe)} className={ACTION}>
          Plan Meal
        </button>
        <button type="button" onClick={() => onAddToList(recipe)} className={ACTION}>
          Add to List
        </button>
        <button type="button" onClick={() => onEdit(recipe)} className={ACTION}>
          Edit
        </button>
        <button type="button" onClick={() => onDelete(recipe)} className={`${ACTION} text-(--fam-danger)`}>
          Delete
        </button>
      </div>
    </article>
  );
}

export function RecipePane(props: RecipePaneProps) {
  const { recipes, categories, selectedId, onSelect, onClose } = props;
  const selected = selectedId === null ? null : (recipes.find((one) => one.id === selectedId) ?? null);
  return (
    <FormDialog titleId="recipes-title" title="Recipes" onClose={onClose} widthClassName="w-[min(96vw,64rem)]">
      <div className="@container mt-4">
        <div className="grid gap-6 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className={selected === null ? "flex flex-col" : "hidden @lg:flex @lg:flex-col"}>
            <RecipeList recipes={recipes} categories={categories} selectedId={selectedId} onSelect={onSelect} onNew={props.onNew} />
          </div>
          <div className={selected === null ? "hidden @lg:block" : "block"}>
            {selected === null ? (
              <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">Choose a recipe to see it here.</p>
            ) : (
              <RecipeDetail
                recipe={selected}
                category={categories.find((one) => one.id === selected.categoryId)}
                onBack={() => onSelect(null)}
                onPlan={props.onPlan}
                onAddToList={props.onAddToList}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
              />
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium">
          Close
        </button>
      </div>
    </FormDialog>
  );
}
