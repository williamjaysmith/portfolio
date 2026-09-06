import { describe, expect, it } from "vitest";

import { mealTokensOf, shownCategoriesOf } from "@/lib/family/meals/visibility";
import type { MealCategory, MealOccurrence } from "@/lib/family/types";

/** 006 T024 — this device's view (FR-611, FR-635, FR-637, R609). */

function category(id: string, position: number): MealCategory {
  return {
    id,
    householdId: "hh",
    name: id,
    color: "#A8D4D3",
    position,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function occurrence(mealId: string, date: string, categoryId: string, createdAt = "2026-09-01T00:00:00.000Z"): MealOccurrence {
  return { mealId, occurrenceDate: date, isRepeating: false, date, categoryId, recipeId: "r", note: null, createdAt };
}

const CATEGORIES = [category("dinner", 3), category("breakfast", 1), category("lunch", 2), category("snack", 4)];

describe("shownCategoriesOf", () => {
  it("orders by position and leaves the hidden ones out", () => {
    expect(shownCategoriesOf(CATEGORIES, new Set()).map((one) => one.id)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    expect(shownCategoriesOf(CATEGORIES, new Set(["lunch"])).map((one) => one.id)).toEqual(["breakfast", "dinner", "snack"]);
    expect(shownCategoriesOf(CATEGORIES, new Set(["breakfast", "lunch", "dinner", "snack"]))).toEqual([]);
  });
});

describe("mealTokensOf", () => {
  const wednesday = [
    occurrence("a", "2026-09-09", "dinner", "2026-09-02T00:00:00.000Z"),
    occurrence("b", "2026-09-09", "lunch"),
    occurrence("c", "2026-09-09", "dinner", "2026-09-01T00:00:00.000Z"),
    occurrence("d", "2026-09-10", "breakfast"),
  ];

  it("groups by day in mealtime order, then planning order", () => {
    const tokens = mealTokensOf(wednesday, CATEGORIES, new Set(), true);
    expect(tokens.get("2026-09-09")?.map((one) => one.mealId)).toEqual(["b", "c", "a"]);
    expect(tokens.get("2026-09-10")?.map((one) => one.mealId)).toEqual(["d"]);
  });

  it("drops a hidden mealtime's tokens on this device", () => {
    const tokens = mealTokensOf(wednesday, CATEGORIES, new Set(["lunch"]), true);
    expect(tokens.get("2026-09-09")?.map((one) => one.mealId)).toEqual(["c", "a"]);
  });

  it("is empty while Show Meals is off", () => {
    expect(mealTokensOf(wednesday, CATEGORIES, new Set(), false).size).toBe(0);
  });
});
