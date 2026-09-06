import { describe, expect, it } from "vitest";

import { expandMeals, isFirstOccurrenceOf, occurrenceOn } from "@/lib/family/meals/expand";
import type { Meal, MealException } from "@/lib/family/types";

/**
 * 006 T018 — `expandMeals` (FR-628, R602): one-offs inside the range; the
 * calendar's rule walk for daily, weekly and monthly meals from the meal's
 * date; the end date inclusive; a skip removes an occurrence; an override
 * moves it — across the range's edge in either direction, keyed by the
 * original date — replaces the mealtime, replaces or clears the note; the
 * drawn order; and `occurrenceOn`, the one occurrence a write must name.
 */

const ZONE = "America/Chicago";
const DINNER = "cat-dinner";
const LUNCH = "cat-lunch";

let counter = 0;
function mealOf(overrides: Partial<Meal> & Pick<Meal, "date">): Meal {
  counter += 1;
  return {
    id: `meal-${counter}`,
    householdId: "hh",
    categoryId: DINNER,
    recipeId: "rec-1",
    note: null,
    rrule: null,
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: `2026-09-01T10:00:${String(counter).padStart(2, "0")}.000Z`,
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

function exceptionOf(mealId: string, overrides: Partial<MealException> & Pick<MealException, "occurrenceDate" | "action">): MealException {
  return {
    id: `ex-${overrides.occurrenceDate}`,
    mealId,
    householdId: "hh",
    date: null,
    categoryId: null,
    note: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T11:00:00.000Z",
    updatedAt: "2026-09-01T11:00:00.000Z",
    ...overrides,
  };
}

const WEEK = { start: "2026-09-06", end: "2026-09-12" };
const NEXT_WEEK = { start: "2026-09-13", end: "2026-09-19" };
const FRIDAYS = "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR";

const datesOf = (meals: Meal[], range = WEEK) => expandMeals(meals, range, ZONE).map((one) => one.date);

describe("one-off meals", () => {
  it("appear on their date inside the range and nowhere outside it", () => {
    expect(datesOf([mealOf({ date: "2026-09-09" })])).toEqual(["2026-09-09"]);
    expect(datesOf([mealOf({ date: "2026-09-13" })])).toEqual([]);
    const [one] = expandMeals([mealOf({ date: "2026-09-09", note: "Ben cooks" })], WEEK, ZONE);
    expect(one).toMatchObject({ occurrenceDate: "2026-09-09", date: "2026-09-09", isRepeating: false, note: "Ben cooks", categoryId: DINNER });
  });
});

describe("repeating meals — the rule walk", () => {
  it("walks a weekly rule from the meal's date on the chosen weekdays", () => {
    const pizza = mealOf({ date: "2026-09-04", rrule: FRIDAYS });
    expect(datesOf([pizza])).toEqual(["2026-09-11"]);
    expect(datesOf([pizza], NEXT_WEEK)).toEqual(["2026-09-18"]);
    expect(datesOf([pizza], { start: "2026-08-30", end: "2026-09-05" })).toEqual(["2026-09-04"]);
    expect(datesOf([pizza], { start: "2026-08-23", end: "2026-08-29" })).toEqual([]);
  });

  it("walks daily and monthly rules", () => {
    expect(datesOf([mealOf({ date: "2026-09-10", rrule: "FREQ=DAILY;INTERVAL=1" })])).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
    const monthly = mealOf({ date: "2026-08-15", rrule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15" });
    expect(datesOf([monthly], { start: "2026-08-01", end: "2026-10-31" })).toEqual(["2026-08-15", "2026-09-15", "2026-10-15"]);
  });

  it("ends on the UNTIL date, inclusive", () => {
    expect(datesOf([mealOf({ date: "2026-09-04", rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260911;WKST=SU;BYDAY=FR" })])).toEqual(["2026-09-11"]);
    expect(datesOf([mealOf({ date: "2026-09-04", rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260910;WKST=SU;BYDAY=FR" })])).toEqual([]);
  });

  it("marks every occurrence repeating and keeps the original date as the key", () => {
    const [one] = expandMeals([mealOf({ date: "2026-09-04", rrule: FRIDAYS })], WEEK, ZONE);
    expect(one).toMatchObject({ isRepeating: true, occurrenceDate: "2026-09-11", date: "2026-09-11" });
  });
});

describe("exceptions", () => {
  it("a skip removes the occurrence and nothing else", () => {
    const pizza = mealOf({ date: "2026-09-04", rrule: FRIDAYS });
    pizza.exceptions = [exceptionOf(pizza.id, { occurrenceDate: "2026-09-11", action: "skip" })];
    expect(datesOf([pizza])).toEqual([]);
    expect(datesOf([pizza], NEXT_WEEK)).toEqual(["2026-09-18"]);
  });

  it("an override moves the occurrence inside the range, keyed by the original date", () => {
    const pizza = mealOf({ date: "2026-09-04", rrule: FRIDAYS });
    pizza.exceptions = [exceptionOf(pizza.id, { occurrenceDate: "2026-09-11", action: "override", date: "2026-09-12" })];
    const [moved] = expandMeals([pizza], WEEK, ZONE);
    expect(moved).toMatchObject({ occurrenceDate: "2026-09-11", date: "2026-09-12" });
    expect(datesOf([pizza])).toEqual(["2026-09-12"]);
  });

  it("an override moved out of the range leaves it, and appears once in the range it moved into", () => {
    const pizza = mealOf({ date: "2026-09-04", rrule: FRIDAYS });
    pizza.exceptions = [exceptionOf(pizza.id, { occurrenceDate: "2026-09-11", action: "override", date: "2026-09-13" })];
    expect(datesOf([pizza])).toEqual([]);
    const next = expandMeals([pizza], NEXT_WEEK, ZONE);
    expect(next.map((one) => [one.occurrenceDate, one.date])).toEqual([
      ["2026-09-11", "2026-09-13"],
      ["2026-09-18", "2026-09-18"],
    ]);
  });

  it("ignores an override on a date the rule never produces", () => {
    const pizza = mealOf({ date: "2026-09-04", rrule: FRIDAYS });
    pizza.exceptions = [exceptionOf(pizza.id, { occurrenceDate: "2026-09-09", action: "override", date: "2026-09-10" })];
    expect(datesOf([pizza])).toEqual(["2026-09-11"]);
  });

  it("replaces the mealtime, and replaces or clears the note — null inherits", () => {
    const pizza = mealOf({ date: "2026-09-04", rrule: FRIDAYS, note: "family night" });
    pizza.exceptions = [
      exceptionOf(pizza.id, { occurrenceDate: "2026-09-11", action: "override", categoryId: LUNCH }),
      exceptionOf(pizza.id, { occurrenceDate: "2026-09-18", action: "override", note: "" }),
      exceptionOf(pizza.id, { occurrenceDate: "2026-09-25", action: "override", note: "Ben's turn" }),
    ];
    const three = expandMeals([pizza], { start: "2026-09-06", end: "2026-09-26" }, ZONE);
    expect(three.map((one) => [one.categoryId, one.note])).toEqual([
      [LUNCH, "family night"],
      [DINNER, null],
      [DINNER, "Ben's turn"],
    ]);
  });
});

describe("order", () => {
  it("draws by date, then by planning order, then by id", () => {
    const later = mealOf({ date: "2026-09-09", createdAt: "2026-09-02T00:00:00.000Z" });
    const earlier = mealOf({ date: "2026-09-09", createdAt: "2026-09-01T00:00:00.000Z" });
    const monday = mealOf({ date: "2026-09-07" });
    expect(expandMeals([later, earlier, monday], WEEK, ZONE).map((one) => one.mealId)).toEqual([monday.id, earlier.id, later.id]);
  });
});

describe("occurrenceOn", () => {
  it("names a one-off on its date only", () => {
    const meal = mealOf({ date: "2026-09-09" });
    expect(occurrenceOn(meal, "2026-09-09", ZONE)?.occurrenceDate).toBe("2026-09-09");
    expect(occurrenceOn(meal, "2026-09-10", ZONE)).toBeNull();
  });

  it("names a series occurrence, with its override merged, and none for a skip or a non-date", () => {
    const pizza = mealOf({ date: "2026-09-04", rrule: FRIDAYS });
    pizza.exceptions = [
      exceptionOf(pizza.id, { occurrenceDate: "2026-09-11", action: "override", date: "2026-09-12" }),
      exceptionOf(pizza.id, { occurrenceDate: "2026-09-18", action: "skip" }),
    ];
    expect(occurrenceOn(pizza, "2026-09-11", ZONE)).toMatchObject({ occurrenceDate: "2026-09-11", date: "2026-09-12" });
    expect(occurrenceOn(pizza, "2026-09-25", ZONE)).toMatchObject({ occurrenceDate: "2026-09-25", date: "2026-09-25" });
    expect(occurrenceOn(pizza, "2026-09-18", ZONE)).toBeNull();
    expect(occurrenceOn(pizza, "2026-09-10", ZONE)).toBeNull();
    expect(occurrenceOn(pizza, "2026-08-28", ZONE)).toBeNull();
  });
});

describe("isFirstOccurrenceOf (FR-629)", () => {
  const daily = mealOf({ id: "m-daily", date: "2026-09-01", rrule: "FREQ=DAILY;INTERVAL=1" });

  it("is true at the anchor, for a one-off, and once every earlier occurrence is skipped", () => {
    expect(isFirstOccurrenceOf(daily, "2026-09-01", ZONE)).toBe(true);
    expect(isFirstOccurrenceOf(mealOf({ date: "2026-09-01" }), "2026-09-01", ZONE)).toBe(true);
    const skipped = { ...daily, exceptions: [exceptionOf("m-daily", { occurrenceDate: "2026-09-01", action: "skip" }), exceptionOf("m-daily", { occurrenceDate: "2026-09-02", action: "skip" })] };
    expect(isFirstOccurrenceOf(skipped, "2026-09-03", ZONE)).toBe(true);
    expect(isFirstOccurrenceOf(skipped, "2026-09-04", ZONE)).toBe(false);
  });

  it("still counts an earlier occurrence that an override moved past the cut — where it belongs, not where it shows", () => {
    const moved = { ...daily, exceptions: [exceptionOf("m-daily", { occurrenceDate: "2026-09-01", action: "override", date: "2026-09-20" })] };
    expect(isFirstOccurrenceOf(moved, "2026-09-02", ZONE)).toBe(false);
  });
});
