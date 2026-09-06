import { describe, expect, it } from "vitest";

import {
  addListItemsSchema,
  createRecipeSchema,
  deleteMealSchema,
  deleteRecipeSchema,
  mealNoteSchema,
  mealtimeNameSchema,
  planMealSchema,
  recipeChoiceSchema,
  recipeTextSchema,
  updateMealCategorySchema,
  updateMealSchema,
  updateRecipeSchema,
} from "@/lib/family/validation";

/**
 * 006 T014 — the meals schemas (contracts §Shared input shapes): the bounds
 * the database carries, the strict objects that refuse invented keys, the
 * literal `confirm: true`, the two delete modes, the recipe choice, and the
 * one scope rule the schema can see — at `this` the recipe and the repeat are
 * not on offer.
 */

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function messagesOf(result: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("mealtimes (FR-610)", () => {
  it("trims and bounds the name at 1–40", () => {
    expect(mealtimeNameSchema.parse("  Tea ")).toBe("Tea");
    expect(mealtimeNameSchema.safeParse("   ").success).toBe(false);
    expect(mealtimeNameSchema.safeParse("x".repeat(41)).success).toBe(false);
    expect(messagesOf(mealtimeNameSchema.safeParse(""))).toEqual([": A mealtime name is 1 to 40 characters."]);
  });

  it("updates the name, the colour, or both — never nothing, never an invented key", () => {
    expect(updateMealCategorySchema.safeParse({ id: ID, patch: { name: "Tea" } }).success).toBe(true);
    expect(updateMealCategorySchema.safeParse({ id: ID, patch: { color: "#FDC36D" } }).success).toBe(true);
    expect(updateMealCategorySchema.safeParse({ id: ID, patch: {} }).success).toBe(false);
    expect(updateMealCategorySchema.safeParse({ id: ID, patch: { position: 9 } }).success).toBe(false);
    expect(updateMealCategorySchema.safeParse({ id: ID, patch: { color: "#123456" } }).success).toBe(false);
  });
});

describe("recipes (FR-613, FR-616)", () => {
  it("bounds the name at 1–120 and the text at 10 000, keeping the text's line breaks", () => {
    expect(createRecipeSchema.parse({ name: " Pancakes ", categoryId: ID, text: "a\n\nb" })).toEqual({
      name: "Pancakes",
      categoryId: ID,
      text: "a\n\nb",
    });
    expect(createRecipeSchema.safeParse({ name: "", categoryId: ID }).success).toBe(false);
    expect(recipeTextSchema.safeParse("x".repeat(10_001)).success).toBe(false);
    expect(messagesOf(createRecipeSchema.safeParse({ name: "x".repeat(121), categoryId: ID }))).toEqual([
      "name: A recipe name is 1 to 120 characters.",
    ]);
  });

  it("updates any of the three fields and refuses an empty patch", () => {
    expect(updateRecipeSchema.safeParse({ id: ID, patch: { categoryId: OTHER } }).success).toBe(true);
    expect(updateRecipeSchema.safeParse({ id: ID, patch: {} }).success).toBe(false);
  });

  it("deletes with one of the two modes and a literal confirm", () => {
    expect(deleteRecipeSchema.safeParse({ id: ID, mode: "recipe", confirm: true }).success).toBe(true);
    expect(deleteRecipeSchema.safeParse({ id: ID, mode: "recipe_and_meals", confirm: true }).success).toBe(true);
    expect(deleteRecipeSchema.safeParse({ id: ID, mode: "everything", confirm: true }).success).toBe(false);
    expect(deleteRecipeSchema.safeParse({ id: ID, mode: "recipe", confirm: "yes" }).success).toBe(false);
    expect(deleteRecipeSchema.safeParse({ id: ID, mode: "recipe" }).success).toBe(false);
  });
});

describe("planning (FR-622, FR-624, FR-627)", () => {
  it("takes an existing recipe or a new entry, and nothing else", () => {
    expect(recipeChoiceSchema.safeParse({ kind: "existing", id: ID }).success).toBe(true);
    expect(recipeChoiceSchema.parse({ kind: "new", name: " 🍝 Spaghetti " })).toEqual({ kind: "new", name: "🍝 Spaghetti" });
    expect(recipeChoiceSchema.safeParse({ kind: "existing" }).success).toBe(false);
    expect(recipeChoiceSchema.safeParse({ kind: "url", url: "x" }).success).toBe(false);
  });

  it("plans with a date, a mealtime, the choice, an optional note and an optional repeat", () => {
    const parsed = planMealSchema.parse({
      date: "2026-09-11",
      categoryId: ID,
      recipe: { kind: "existing", id: OTHER },
      note: "  ",
      repeat: { kind: "weekly", weekdays: ["FR"], until: "2026-12-31" },
    });
    expect(parsed.note).toBeNull();
    expect(parsed.repeat).toEqual({ kind: "weekly", weekdays: ["FR"], until: "2026-12-31" });
    expect(planMealSchema.safeParse({ date: "11/09/2026", categoryId: ID, recipe: { kind: "existing", id: OTHER } }).success).toBe(false);
    expect(planMealSchema.safeParse({ date: "2026-09-11", categoryId: ID, recipe: { kind: "existing", id: OTHER }, cooked: true }).success).toBe(false);
  });

  it("turns an empty note into null and bounds it at 200", () => {
    expect(mealNoteSchema.parse("")).toBeNull();
    expect(mealNoteSchema.parse(" Ben cooks ")).toBe("Ben cooks");
    expect(mealNoteSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
});

describe("editing and deleting a meal (FR-626, FR-629, FR-630)", () => {
  it("takes an occurrence date, an optional scope and a non-empty patch", () => {
    expect(updateMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", patch: { note: "x" } }).success).toBe(true);
    expect(updateMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", scope: "all", patch: { date: "2026-09-12" } }).success).toBe(true);
    expect(updateMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", patch: {} }).success).toBe(false);
    expect(updateMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", scope: "some", patch: { note: "x" } }).success).toBe(false);
  });

  it("refuses a recipe or a repeat change at scope this — the series' alone", () => {
    const recipe = updateMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", scope: "this", patch: { recipeId: OTHER } });
    expect(messagesOf(recipe)).toEqual(["patch.recipeId: A recipe can only change for the whole series."]);
    const repeat = updateMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", scope: "this", patch: { repeat: { kind: "never" } } });
    expect(messagesOf(repeat)).toEqual(["patch.repeat: A recipe can only change for the whole series."]);
    expect(updateMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", scope: "all", patch: { recipeId: OTHER } }).success).toBe(true);
  });

  it("clears a note with null at any scope", () => {
    const parsed = updateMealSchema.parse({ id: ID, occurrenceDate: "2026-09-11", scope: "this", patch: { note: null } });
    expect(parsed.patch.note).toBeNull();
  });

  it("deletes with the occurrence date, an optional scope and a literal confirm", () => {
    expect(deleteMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", confirm: true }).success).toBe(true);
    expect(deleteMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11", scope: "this_and_future", confirm: true }).success).toBe(true);
    expect(deleteMealSchema.safeParse({ id: ID, occurrenceDate: "2026-09-11" }).success).toBe(false);
  });
});

describe("addListItems (FR-632)", () => {
  it("takes 1–200 item texts, each trimmed and bounded, on one list", () => {
    expect(addListItemsSchema.parse({ listId: ID, texts: [" 500 g spaghetti ", "1 onion"] })).toEqual({
      listId: ID,
      texts: ["500 g spaghetti", "1 onion"],
    });
    expect(addListItemsSchema.safeParse({ listId: ID, texts: [] }).success).toBe(false);
    expect(addListItemsSchema.safeParse({ listId: ID, texts: ["   "] }).success).toBe(false);
    expect(addListItemsSchema.safeParse({ listId: ID, texts: Array.from({ length: 201 }, () => "x") }).success).toBe(false);
    expect(addListItemsSchema.safeParse({ listId: ID, texts: ["x"], section: "Dairy" }).success).toBe(false);
  });
});
