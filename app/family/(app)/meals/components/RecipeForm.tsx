"use client";

import type { DietaryNote } from "@/lib/family/meals/dietary";
import type { MealCategory } from "@/lib/family/types";

import { FormDialog } from "../../components/FormDialog";
import { FormFooter } from "../../components/FormFooter";
import type { SubmitOutcome } from "../../components/formSubmit";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useSheetForm } from "../../components/useSheetForm";
import { DietaryNotes } from "./DietaryNotes";
import { MealtimeSelect } from "./MealtimeSelect";
import { NameField } from "./NameField";
import { recipeDraftOf, recipeFormResultOf, type RecipeDraft, type RecipeFormMode, type RecipeFormResult } from "./recipeDraft";

/**
 * Create or edit a recipe (006 FR-613, FR-615, FR-638; 43810243302811 —
 * "Name… Category, and a combined 'Instructions or ingredients' text
 * field"): the three fields the reference has, the dietary notes beneath. On
 * an edit only what changed travels. The commit is the caller's, through the
 * queue and `withActor`.
 */

export interface RecipeFormProps {
  mode: RecipeFormMode;
  categories: readonly MealCategory[];
  notes: readonly DietaryNote[];
  onSubmit: (result: RecipeFormResult) => Promise<SubmitOutcome>;
  onClose: () => void;
}

export function RecipeForm({ mode, categories, notes, onSubmit, onClose }: RecipeFormProps) {
  const form = useSheetForm<RecipeDraft, RecipeFormResult>(
    () => recipeDraftOf(mode),
    (draft) => recipeFormResultOf(draft, mode),
    onSubmit,
    onClose,
  );
  const { draft, set, submission } = form;

  return (
    <FormDialog titleId="recipe-form-title" title={mode.kind === "create" ? "New recipe" : `Edit ${mode.recipe.name}`} onClose={onClose}>
      <form onSubmit={form.handleSubmit} className="mt-4 flex flex-col gap-4">
        <NameField label="What are we eating?" value={draft.name} maxLength={120} onChange={(value) => set("name", value)} errors={submission.errors.name} />
        <MealtimeSelect value={draft.categoryId} categories={categories} onChange={(id) => set("categoryId", id)} errors={submission.errors.categoryId} />
        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Instructions or ingredients
            <textarea value={draft.text} onChange={(event) => set("text", event.target.value)} rows={8} maxLength={10_000} className={FIELD} />
          </label>
          <FieldError messages={submission.errors.text} />
        </div>
        <DietaryNotes notes={notes} />
        <FormFooter errors={submission.errors} message={submission.message} pending={submission.pending} onClose={onClose} />
      </form>
    </FormDialog>
  );
}
