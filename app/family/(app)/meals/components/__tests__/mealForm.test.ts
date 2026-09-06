import { describe, expect, it } from "vitest";

import { ActionFailure } from "@/lib/family/errors";

import { mealDraftOf, mealPatchOf, planInputOf, repeatChoiceOf, type MealDraft } from "../mealForm";
import { DINNER, LUNCH, mealOf, occurrenceOf } from "./meals-test-fixtures";

/**
 * 006 T037's pure half — the sheet's draft and what it sends (FR-622, FR-624,
 * FR-626, FR-627, FR-630): a plan needs a recipe or a new entry; an edit sends
 * only what changed; at scope `this` the recipe and the repeat stay home.
 */

const PIZZA = mealOf("2026-09-04", DINNER, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb900", { rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261231;WKST=SU;BYDAY=FR", note: "family night" });
const OCCURRENCE = occurrenceOf(PIZZA, { occurrenceDate: "2026-09-11", date: "2026-09-11" });

describe("mealDraftOf", () => {
  it("starts an add on the slot with nothing chosen and no repeat", () => {
    expect(mealDraftOf({ kind: "add", date: "2026-09-09", categoryId: DINNER })).toEqual({
      date: "2026-09-09",
      categoryId: DINNER,
      source: "existing",
      recipeId: null,
      newName: "",
      newText: "",
      note: "",
      repeatKind: "never",
      weekdays: [],
      until: "",
    });
  });

  it("starts an edit from the live occurrence and the series' rule", () => {
    expect(mealDraftOf({ kind: "edit", occurrence: OCCURRENCE, meal: PIZZA })).toMatchObject({
      date: "2026-09-11",
      categoryId: DINNER,
      recipeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb900",
      note: "family night",
      repeatKind: "weekly",
      weekdays: ["FR"],
      until: "2026-12-31",
    });
  });
});

describe("planInputOf", () => {
  const base: MealDraft = mealDraftOf({ kind: "add", date: "2026-09-09", categoryId: DINNER });

  it("sends an existing recipe, the trimmed note and the repeat only when set", () => {
    expect(planInputOf({ ...base, recipeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb901", note: " Ben cooks " })).toEqual({
      date: "2026-09-09",
      categoryId: DINNER,
      recipe: { kind: "existing", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb901" },
      note: "Ben cooks",
    });
    expect(planInputOf({ ...base, recipeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb901", repeatKind: "weekly", weekdays: ["WE"], until: "2026-12-31" }).repeat).toEqual({
      kind: "weekly",
      weekdays: ["WE"],
      until: "2026-12-31",
    });
  });

  it("sends a New Entry with its name and text", () => {
    expect(planInputOf({ ...base, source: "new", newName: " 🍝 Spaghetti ", newText: "a\nb" }).recipe).toEqual({
      kind: "new",
      name: "🍝 Spaghetti",
      text: "a\nb",
    });
  });

  it("refuses no recipe and a blank New Entry at the recipe field", () => {
    expect(() => planInputOf(base)).toThrow(ActionFailure);
    try {
      planInputOf({ ...base, source: "new", newName: "  " });
    } catch (error) {
      expect((error as ActionFailure).fieldErrors).toHaveProperty("recipe");
    }
  });
});

describe("mealPatchOf", () => {
  const mode = { kind: "edit" as const, occurrence: OCCURRENCE, meal: PIZZA };
  const draft = mealDraftOf(mode);

  it("sends only what changed, and nothing changed is a refusal", () => {
    // Scope all on a series: the occurrence moved a day later, so the series' anchor does too (FR-629) — never the absolute date, which would drop every earlier Friday.
    expect(mealPatchOf({ ...draft, date: "2026-09-12", note: "family night" }, { ...mode, scope: "all" })).toEqual({ date: "2026-09-05" });
    expect(mealPatchOf({ ...draft, date: "2026-09-12" }, { ...mode, scope: "this_and_future" })).toEqual({ date: "2026-09-12" });
    expect(mealPatchOf({ ...draft, date: "2026-09-12" }, { ...mode, scope: "this" })).toEqual({ date: "2026-09-12" });
    expect(mealPatchOf({ ...draft, categoryId: LUNCH, note: "" }, { ...mode, scope: "all" })).toEqual({ categoryId: LUNCH, note: null });
    expect(() => mealPatchOf(draft, { ...mode, scope: "all" })).toThrow("Nothing to change.");
  });

  it("sends a recipe and a repeat change at series scopes only", () => {
    expect(mealPatchOf({ ...draft, recipeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb902", repeatKind: "never" }, { ...mode, scope: "all" })).toEqual({
      recipeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb902",
      repeat: { kind: "never" },
    });
    expect(() => mealPatchOf({ ...draft, recipeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb902", repeatKind: "never" }, { ...mode, scope: "this" })).toThrow("Nothing to change.");
    expect(mealPatchOf({ ...draft, recipeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb902", note: "x" }, { ...mode, scope: "this" })).toEqual({ note: "x" });
  });
});

describe("repeatChoiceOf", () => {
  it("maps the fieldset's fields to the calendar's choice", () => {
    expect(repeatChoiceOf({ repeatKind: "never", weekdays: [], until: "" })).toEqual({ kind: "never" });
    expect(repeatChoiceOf({ repeatKind: "daily", weekdays: [], until: "" })).toEqual({ kind: "daily", until: null });
    expect(repeatChoiceOf({ repeatKind: "monthly", weekdays: [], until: "2026-12-31" })).toEqual({ kind: "monthly", until: "2026-12-31" });
  });
});
