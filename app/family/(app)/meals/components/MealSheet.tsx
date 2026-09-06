"use client";

import { useState } from "react";

import type { DietaryNote } from "@/lib/family/meals/dietary";
import { activeRecipes } from "@/lib/family/meals/library";
import { dayWordsOf } from "@/lib/family/meals/week";
import type { MealCategory, Recipe, Weekday } from "@/lib/family/types";

import { FormDialog } from "../../components/FormDialog";
import { FormFooter } from "../../components/FormFooter";
import { RepeatFieldset, type RepeatKind } from "../../components/RepeatFieldset";
import { toggled, type SubmitOutcome } from "../../components/formSubmit";
import { FIELD, FieldError, LABEL } from "../../components/settings/CategoryFields";
import { useSheetForm } from "../../components/useSheetForm";
import { DietaryNotes } from "./DietaryNotes";
import { MealtimeSelect } from "./MealtimeSelect";
import { RecipePicker } from "./RecipePicker";
import { mealDraftOf, mealPatchOf, planInputOf, type MealDraft, type MealFormMode, type MealFormResult } from "./mealForm";

/**
 * Plan or edit a meal (006 FR-622, FR-624, FR-626, FR-627, FR-638; R608): the
 * date, the mealtime, the recipe — From Recipes or a New Entry — the note,
 * Repeats on the shared fieldset, and every Profile's dietary note beneath.
 * On an edit only what changed travels; at scope `this` the recipe and the
 * repeat are not offered (FR-630). The commit is the caller's, through the
 * queue and `withActor`.
 */

export interface MealSheetProps {
  mode: MealFormMode;
  categories: readonly MealCategory[];
  recipes: readonly Recipe[];
  notes: readonly DietaryNote[];
  onSubmit: (result: MealFormResult) => Promise<SubmitOutcome>;
  onClose: () => void;
}

function titleOf(mode: MealFormMode, categories: readonly MealCategory[]): string {
  if (mode.kind === "edit") return "Edit meal";
  const mealtime = categories.find((one) => one.id === mode.categoryId)?.name ?? "meal";
  return `Add to ${mealtime}, ${dayWordsOf(mode.date)}`;
}

function resultOf(draft: MealDraft, mode: MealFormMode): MealFormResult {
  return mode.kind === "add" ? { kind: "plan", input: planInputOf(draft) } : { kind: "patch", patch: mealPatchOf(draft, mode) };
}

export function MealSheet({ mode, categories, recipes, notes, onSubmit, onClose }: MealSheetProps) {
  const form = useSheetForm<MealDraft, MealFormResult>(() => mealDraftOf(mode), (draft) => resultOf(draft, mode), onSubmit, onClose);
  const { draft, set, update, submission } = form;
  const [chip, setChip] = useState<string | null>(draft.categoryId);
  const [query, setQuery] = useState("");
  const seriesFields = mode.kind === "add" || mode.scope !== "this";

  const repeatForm = {
    draft,
    setRepeatKind: (kind: RepeatKind) => set("repeatKind", kind),
    toggleWeekday: (day: Weekday) => update((current) => ({ ...current, weekdays: toggled([...current.weekdays], day) })),
    set: (key: "until", value: string) => set(key, value),
    errors: submission.errors,
  };

  return (
    <FormDialog titleId="meal-sheet-title" title={titleOf(mode, categories)} onClose={onClose}>
      <form onSubmit={form.handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={LABEL}>
              Date
              <input type="date" value={draft.date} onChange={(event) => set("date", event.target.value)} className={FIELD} />
            </label>
            <FieldError messages={submission.errors.date} />
          </div>
          <MealtimeSelect value={draft.categoryId} categories={categories} onChange={(id) => set("categoryId", id)} errors={submission.errors.categoryId} />
        </div>

        {seriesFields ? (
          <RecipePicker
            draft={draft}
            set={set}
            recipes={activeRecipes(recipes)}
            categories={categories}
            allowNew={mode.kind === "add"}
            chip={chip}
            onChip={setChip}
            query={query}
            onQuery={setQuery}
            errors={submission.errors.recipe}
          />
        ) : null}

        <div className="flex flex-col gap-1">
          <label className={LABEL}>
            Note (optional)
            <input value={draft.note} onChange={(event) => set("note", event.target.value)} maxLength={200} className={FIELD} />
          </label>
          <FieldError messages={submission.errors.note} />
        </div>

        {seriesFields ? <RepeatFieldset form={repeatForm} /> : null}

        <DietaryNotes notes={notes} />

        <FormFooter errors={submission.errors} message={submission.message} pending={submission.pending} onClose={onClose} />
      </form>
    </FormDialog>
  );
}
