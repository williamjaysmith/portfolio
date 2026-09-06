"use client";

import { useRef, useState } from "react";

import type { Recipe } from "@/lib/family/types";

import { useModalDialog } from "../../components/useModalDialog";

/**
 * Deleting a recipe (006 FR-616; 26902065343771 — "delete just the recipe
 * (meals already planned with it remain on the Meal Plan), or delete 'This
 * recipe and planned meals'"): exactly the reference's two choices, worded
 * with the meal count so the household knows what goes, and a confirmation
 * that says it cannot be undone (constitution §VI). "Keep it" is focused
 * first, as every confirmation here is.
 */

export type RecipeDeleteMode = "recipe" | "recipe_and_meals";

export interface RecipeDeleteDialogProps {
  recipe: Recipe;
  /** How many planned meals reference it — what the second choice takes with it. */
  mealCount: number;
  pending?: boolean;
  onConfirm: (mode: RecipeDeleteMode) => void;
  onCancel: () => void;
}

/** "The 1 planned meal stays" / "The 2 planned meals stay": the count with its verb agreeing. */
function mealsInWords(count: number, verb: [one: string, many: string]): string {
  return count === 1 ? `The 1 planned meal ${verb[0]}` : `The ${count} planned meals ${verb[1]}`;
}

const CHOICE = "flex min-h-(--fam-touch) cursor-pointer items-center gap-3 rounded-lg px-2 text-(length:--fam-fs-body)";

export function RecipeDeleteDialog({ recipe, mealCount, pending = false, onConfirm, onCancel }: RecipeDeleteDialogProps) {
  const [mode, setMode] = useState<RecipeDeleteMode>("recipe");
  const keepRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalDialog(true, keepRef);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="recipe-delete-title"
      aria-describedby="recipe-delete-body"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-(--fam-radius-modal) bg-(--fam-app-bg) p-6 text-(--fam-text-primary) backdrop:bg-black/30"
    >
      <h2 id="recipe-delete-title" className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
        Delete {recipe.name}?
      </h2>
      <p id="recipe-delete-body" className="mt-2 text-(length:--fam-fs-body) text-(--fam-text-secondary)">
        This can&rsquo;t be undone.
      </p>
      <div role="radiogroup" aria-labelledby="recipe-delete-title" className="mt-4">
        <label className={CHOICE}>
          <input type="radio" name="recipe-delete" checked={mode === "recipe"} onChange={() => setMode("recipe")} className="size-5 accent-(--fam-primary-blue)" />
          <span>
            Just the recipe
            <span className="block text-(length:--fam-fs-small) text-(--fam-text-secondary)">
              {mealCount === 0 ? "It leaves the library." : `${mealsInWords(mealCount, ["stays", "stay"])} on the plan.`}
            </span>
          </span>
        </label>
        <label className={CHOICE}>
          <input type="radio" name="recipe-delete" checked={mode === "recipe_and_meals"} onChange={() => setMode("recipe_and_meals")} className="size-5 accent-(--fam-primary-blue)" />
          <span>
            This recipe and planned meals
            <span className="block text-(length:--fam-fs-small) text-(--fam-text-secondary)">
              {mealCount === 0 ? "Nothing is planned with it." : `${mealsInWords(mealCount, ["goes", "go"])} too.`}
            </span>
          </span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button
          ref={keepRef}
          type="button"
          onClick={onCancel}
          className="min-h-(--fam-touch) rounded-full border border-(--fam-hairline) px-5 text-(length:--fam-fs-body) font-medium"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={() => onConfirm(mode)}
          disabled={pending}
          className="min-h-(--fam-touch) rounded-full bg-(--fam-danger) px-5 text-(length:--fam-fs-body) font-medium text-white disabled:opacity-60"
        >
          Delete for good
        </button>
      </div>
    </dialog>
  );
}
