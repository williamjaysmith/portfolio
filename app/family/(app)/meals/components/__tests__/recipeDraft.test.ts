import { describe, expect, it } from "vitest";

import { recipeDraftOf, recipeFormResultOf } from "../recipeDraft";
import { DINNER, LUNCH, recipeOf } from "./meals-test-fixtures";

/** 006 T043's pure half — the recipe form's draft and what it sends (FR-613, FR-615). */

const spaghetti = recipeOf("🍝 Spaghetti", DINNER, { text: "500 g spaghetti" });

describe("recipeDraftOf", () => {
  it("starts a create in the given mealtime and an edit from the recipe", () => {
    expect(recipeDraftOf({ kind: "create", categoryId: LUNCH })).toEqual({ name: "", categoryId: LUNCH, text: "" });
    expect(recipeDraftOf({ kind: "edit", recipe: spaghetti })).toEqual({ name: "🍝 Spaghetti", categoryId: DINNER, text: "500 g spaghetti" });
  });
});

describe("recipeFormResultOf", () => {
  it("creates with the trimmed name, the mealtime and the text as typed", () => {
    expect(recipeFormResultOf({ name: " Toast ", categoryId: LUNCH, text: "bread\n\nbutter" }, { kind: "create", categoryId: LUNCH })).toEqual({
      kind: "create",
      input: { name: "Toast", categoryId: LUNCH, text: "bread\n\nbutter" },
    });
  });

  it("refuses a blank name and an over-long text at their fields", () => {
    expect(() => recipeFormResultOf({ name: "  ", categoryId: LUNCH, text: "" }, { kind: "create", categoryId: LUNCH })).toThrow(
      "A recipe name is 1 to 120 characters.",
    );
    expect(() => recipeFormResultOf({ name: "x", categoryId: LUNCH, text: "x".repeat(10_001) }, { kind: "create", categoryId: LUNCH })).toThrow(
      "Keep the recipe under 10 000 characters.",
    );
  });

  it("edits with only what changed, and nothing changed is a refusal", () => {
    const mode = { kind: "edit" as const, recipe: spaghetti };
    expect(recipeFormResultOf({ name: "🍝 Spaghetti", categoryId: LUNCH, text: "500 g spaghetti" }, mode)).toEqual({ kind: "patch", patch: { categoryId: LUNCH } });
    expect(recipeFormResultOf({ name: "🍝 Spaghetti", categoryId: DINNER, text: "500 g spaghetti\nparmesan" }, mode)).toEqual({
      kind: "patch",
      patch: { text: "500 g spaghetti\nparmesan" },
    });
    expect(() => recipeFormResultOf({ name: "🍝 Spaghetti", categoryId: DINNER, text: "500 g spaghetti" }, mode)).toThrow("Nothing to change.");
  });
});
