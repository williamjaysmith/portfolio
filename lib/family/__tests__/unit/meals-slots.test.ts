import { describe, expect, it } from "vitest";

import { slotKeyOf, slotsOf } from "@/lib/family/meals/slots";
import type { MealOccurrence } from "@/lib/family/types";

/** 006 T019 — slots (FR-604): grouped by date × mealtime, in planning order. */

function occurrence(mealId: string, date: string, categoryId: string, createdAt: string): MealOccurrence {
  return { mealId, occurrenceDate: date, isRepeating: false, date, categoryId, recipeId: "r", note: null, createdAt };
}

describe("slotsOf", () => {
  it("keys by date and mealtime", () => {
    expect(slotKeyOf("2026-09-09", "dinner")).toBe("2026-09-09|dinner");
  });

  it("groups occurrences into their slots, each in planning order then by id", () => {
    const b = occurrence("b", "2026-09-09", "dinner", "2026-09-02T00:00:00.000Z");
    const a = occurrence("a", "2026-09-09", "dinner", "2026-09-01T00:00:00.000Z");
    const c = occurrence("c", "2026-09-09", "dinner", "2026-09-02T00:00:00.000Z");
    const lunch = occurrence("d", "2026-09-09", "lunch", "2026-09-01T00:00:00.000Z");
    const slots = slotsOf([b, lunch, c, a]);
    expect([...slots.keys()]).toEqual(["2026-09-09|dinner", "2026-09-09|lunch"]);
    expect(slots.get("2026-09-09|dinner")?.map((one) => one.mealId)).toEqual(["a", "b", "c"]);
    expect(slots.get("2026-09-09|lunch")?.map((one) => one.mealId)).toEqual(["d"]);
  });

  it("is empty for no occurrences", () => {
    expect(slotsOf([]).size).toBe(0);
  });
});
