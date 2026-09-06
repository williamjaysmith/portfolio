import { ActionFailure } from "@/lib/family/errors";
import type { Recipe } from "@/lib/family/types";
import { createRecipeSchema, parseOrThrow, recipeTextSchema } from "@/lib/family/validation";

import type { RecipeInput } from "./useMealWrites";

/**
 * The recipe form's draft and what it sends (006 FR-613, FR-615): a name, one
 * mealtime, one text; on an edit only what changed travels. Pure, so the
 * rules are table-tested without a render.
 */

export interface RecipeDraft {
  name: string;
  categoryId: string;
  text: string;
}

export type RecipeFormMode = { kind: "create"; categoryId: string } | { kind: "edit"; recipe: Recipe };

export type RecipeFormResult = { kind: "create"; input: RecipeInput } | { kind: "patch"; patch: Partial<RecipeInput> };

const NOTHING_TO_CHANGE = "Nothing to change.";

export function recipeDraftOf(mode: RecipeFormMode): RecipeDraft {
  if (mode.kind === "create") return { name: "", categoryId: mode.categoryId, text: "" };
  return { name: mode.recipe.name, categoryId: mode.recipe.categoryId, text: mode.recipe.text };
}

function recipeInputOf(draft: RecipeDraft): RecipeInput {
  const parsed = parseOrThrow(createRecipeSchema, { name: draft.name, categoryId: draft.categoryId, text: draft.text });
  return { name: parsed.name, categoryId: parsed.categoryId, text: parsed.text ?? "" };
}

function recipePatchOf(draft: RecipeDraft, recipe: Recipe): Partial<RecipeInput> {
  const input = recipeInputOf(draft);
  const patch: Partial<RecipeInput> = {};
  if (input.name !== recipe.name) patch.name = input.name;
  if (input.categoryId !== recipe.categoryId) patch.categoryId = input.categoryId;
  if (parseOrThrow(recipeTextSchema, draft.text) !== recipe.text) patch.text = draft.text;
  if (Object.keys(patch).length === 0) throw new ActionFailure("VALIDATION", NOTHING_TO_CHANGE, { name: [NOTHING_TO_CHANGE] });
  return patch;
}

export function recipeFormResultOf(draft: RecipeDraft, mode: RecipeFormMode): RecipeFormResult {
  return mode.kind === "create" ? { kind: "create", input: recipeInputOf(draft) } : { kind: "patch", patch: recipePatchOf(draft, mode.recipe) };
}
