import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MealCell, type MealCellProps } from "../MealCell";
import { CATEGORIES, DINNER, mealOf, occurrenceOf } from "./meals-test-fixtures";

/**
 * 006 T039 — a cell (FR-604, FR-622, FR-623, FR-646): empty, one button named
 * by its day, mealtime and "empty" whose tap adds; filled, a group named with
 * its count whose chips open, whose press-and-hold (400 ms, still) adds
 * another, and whose click after a hold is swallowed.
 */

const spaghetti = occurrenceOf(mealOf("2026-09-09", DINNER, "r1"));
const garlic = occurrenceOf(mealOf("2026-09-09", DINNER, "r2"));
const NAMES = new Map([
  ["r1", "🍝 Spaghetti"],
  ["r2", "Garlic bread"],
]);

function renderCell(meals: MealCellProps["meals"]) {
  const props: MealCellProps = {
    date: "2026-09-09",
    category: CATEGORIES[2],
    meals,
    recipeNames: NAMES,
    onAdd: vi.fn(),
    onAddAnother: vi.fn(),
    onOpen: vi.fn(),
  };
  return { ...render(<MealCell {...props} />), props };
}

describe("MealCell", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is one button when empty, and a tap adds to the slot", () => {
    const { props } = renderCell([]);
    const cell = screen.getByRole("button", { name: "Wednesday 9 September, Dinner, empty" });
    fireEvent.click(cell);
    expect(props.onAdd).toHaveBeenCalledWith({ date: "2026-09-09", categoryId: DINNER });
  });

  it("is a group named with its count when filled, its chips opening the meal", () => {
    const { props } = renderCell([spaghetti, garlic]);
    const cell = screen.getByRole("group", { name: "Wednesday 9 September, Dinner, 2 meals" });
    expect(cell).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Garlic bread" }));
    expect(props.onOpen).toHaveBeenCalledWith(garlic);
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("adds another after a 400 ms hold, and swallows the click that follows", () => {
    vi.useFakeTimers();
    const { props } = renderCell([spaghetti]);
    const cell = screen.getByRole("group", { name: "Wednesday 9 September, Dinner, 1 meal" });
    fireEvent.pointerDown(cell, { isPrimary: true, clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(props.onAddAnother).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(props.onAddAnother).toHaveBeenCalledWith({ date: "2026-09-09", categoryId: DINNER });
    fireEvent.pointerUp(cell);
    fireEvent.click(screen.getByRole("button", { name: "🍝 Spaghetti" }));
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("cancels the hold on movement or an early lift", () => {
    vi.useFakeTimers();
    const { props } = renderCell([spaghetti]);
    const cell = screen.getByRole("group", { name: /Dinner/ });
    fireEvent.pointerDown(cell, { isPrimary: true, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(cell, { clientX: 30, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerDown(cell, { isPrimary: true, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(cell);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(props.onAddAnother).not.toHaveBeenCalled();
  });
});
