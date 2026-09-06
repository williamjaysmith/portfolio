"use client";

import { ActionFailure } from "@/lib/family/errors";
import type { PaletteColor } from "@/lib/family/colors";
import type { MealCategory } from "@/lib/family/types";
import { mealtimeNameSchema, parseOrThrow } from "@/lib/family/validation";

import { FormDialog } from "../../components/FormDialog";
import { FormFooter } from "../../components/FormFooter";
import type { SubmitOutcome } from "../../components/formSubmit";
import { FieldError } from "../../components/settings/CategoryFields";
import { ColorPicker } from "../../components/settings/ColorPicker";
import { useSheetForm } from "../../components/useSheetForm";
import { NameField } from "./NameField";

/**
 * The mealtime pencil (006 FR-610, FR-612, FR-640; 26902149028379 — "Tap the
 * pencil icon next to any category to change its color or rename it"): the
 * name and the colour, on the shipped form path. The colour is the settings
 * `ColorPicker` with the OTHER mealtimes as its duplicate warning. Who may save
 * is the server's decision — a parent's — and the sheet offers the pencil to
 * parents only.
 */

export interface MealtimePatch {
  name?: string;
  color?: PaletteColor;
}

export interface CategoryFormProps {
  category: MealCategory;
  /** Every mealtime, for the colour picker's duplicate warning. */
  categories: readonly MealCategory[];
  onSubmit: (patch: MealtimePatch) => Promise<SubmitOutcome>;
  onClose: () => void;
}

interface MealtimeDraft {
  name: string;
  color: PaletteColor;
}

const NOTHING_TO_CHANGE = "Nothing to change.";

/** Only what changed travels; nothing changed is a refusal, not a write. */
function patchOf(draft: MealtimeDraft, category: MealCategory): MealtimePatch {
  const name = parseOrThrow(mealtimeNameSchema, draft.name);
  const patch: MealtimePatch = {};
  if (name !== category.name) patch.name = name;
  if (draft.color !== category.color) patch.color = draft.color;
  if (patch.name === undefined && patch.color === undefined) {
    throw new ActionFailure("VALIDATION", NOTHING_TO_CHANGE, { name: [NOTHING_TO_CHANGE] });
  }
  return patch;
}

export function CategoryForm({ category, categories, onSubmit, onClose }: CategoryFormProps) {
  const form = useSheetForm<MealtimeDraft, MealtimePatch>(
    () => ({ name: category.name, color: category.color }),
    (draft) => patchOf(draft, category),
    onSubmit,
    onClose,
  );
  const { draft, set, submission } = form;

  return (
    <FormDialog titleId="mealtime-form-title" title={`Edit ${category.name}`} onClose={onClose}>
      <form onSubmit={form.handleSubmit} className="mt-4 flex flex-col gap-4">
        <NameField label="Name" value={draft.name} maxLength={40} onChange={(value) => set("name", value)} errors={submission.errors.name} />
        <div className="flex flex-col gap-1">
          <span className="text-(length:--fam-fs-small) text-(--fam-text-muted)">Colour</span>
          <ColorPicker
            value={draft.color}
            onChange={(color) => set("color", color)}
            usedBy={categories.map((one) => ({ id: one.id, label: one.name, color: one.color, emoji: null }))}
            excludeId={category.id}
          />
          <FieldError messages={submission.errors.color} />
        </div>
        <FormFooter errors={submission.errors} message={submission.message} pending={submission.pending} onClose={onClose} />
      </form>
    </FormDialog>
  );
}
