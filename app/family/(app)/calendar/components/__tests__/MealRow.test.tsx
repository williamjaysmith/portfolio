import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { expandMeals } from "@/lib/family/meals/expand";
import { mealTokensOf } from "@/lib/family/meals/visibility";

import { CATEGORIES, DINNER, LUNCH, mealOf, recipeOf } from "../../../meals/components/__tests__/meals-test-fixtures";
import { MealRow, type MealRowProps } from "../MealRow";

/**
 * 006 T052 — the calendar's token row (FR-634, FR-636, FR-637): one row on the
 * header grid; Wednesday's two tokens in mealtime order, each named by the
 * meal; a hidden mealtime's token absent; no row at all when Show Meals is
 * off; a token press opens the meal; a pointer drag on a token lifts nothing.
 */

const COLUMNS = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"];
const soup = recipeOf("Soup", LUNCH);
const spaghetti = recipeOf("🍝 Spaghetti", DINNER);
const MEALS = [mealOf("2026-09-09", DINNER, spaghetti.id), mealOf("2026-09-09", LUNCH, soup.id), mealOf("2026-09-12", DINNER, spaghetti.id)];
const occurrences = expandMeals(MEALS, { start: COLUMNS[0], end: COLUMNS[6] }, "UTC");
const categoriesById = new Map(CATEGORIES.map((category) => [category.id, category]));
const recipeNames = new Map([
  [soup.id, "Soup"],
  [spaghetti.id, "🍝 Spaghetti"],
]);

function tokensOf(hidden: string[] = [], showMeals = true) {
  return mealTokensOf(occurrences, CATEGORIES, new Set(hidden), showMeals);
}

function renderRow(overrides: Partial<MealRowProps> = {}) {
  const props: MealRowProps = { columnDates: COLUMNS, tokens: tokensOf(), categoriesById, recipeNames, onOpen: vi.fn(), ...overrides };
  return { ...render(<MealRow {...props} />), props };
}

const namesOn = (day: number) =>
  within(within(screen.getByRole("list", { name: "Meals" })).getAllByRole("listitem")[day]).queryAllByRole("button").map((button) => button.textContent);

describe("MealRow", () => {
  it("draws one item per day with Wednesday's two tokens in mealtime order, named by the meal", () => {
    renderRow();
    expect(within(screen.getByRole("list", { name: "Meals" })).getAllByRole("listitem")).toHaveLength(7);
    expect(namesOn(2)).toEqual(["Soup", "🍝 Spaghetti"]);
    expect(namesOn(5)).toEqual(["🍝 Spaghetti"]);
    // FR-646: a token is named by its mealtime and its meal.
    expect(screen.getByRole("button", { name: "Lunch: Soup" })).toBeInTheDocument();
    expect(namesOn(0)).toEqual([]);
  });

  it("leaves a hidden mealtime's tokens out (FR-637)", () => {
    renderRow({ tokens: tokensOf([LUNCH]) });
    expect(namesOn(2)).toEqual(["🍝 Spaghetti"]);
  });

  it("draws no row at all when Show Meals is off (FR-635)", () => {
    const { container } = renderRow({ tokens: tokensOf([], false) });
    expect(screen.queryByRole("list", { name: "Meals" })).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the meal from a press, and lifts nothing on a pointer drag (FR-636)", () => {
    const { props } = renderRow();
    const token = screen.getByRole("button", { name: "Lunch: Soup" });
    fireEvent.click(token);
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ recipeId: soup.id, date: "2026-09-09", categoryId: LUNCH }));

    fireEvent.pointerDown(token, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(token, { pointerId: 1, clientX: 80, clientY: 40 });
    fireEvent.pointerUp(token, { pointerId: 1, clientX: 80, clientY: 40 });
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    expect(token).not.toHaveAttribute("draggable");
    expect(token).not.toHaveAttribute("aria-grabbed");
  });
});
