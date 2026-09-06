import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { MealPopover, type MealPopoverProps } from "../MealPopover";
import { CATEGORIES, DINNER, mealOf, occurrenceOf } from "./meals-test-fixtures";

/**
 * 006 T038 — a meal's popover (FR-623, FR-625, FR-626): the name, the day and
 * the mealtime, the note, the five actions through the caller, busy locking
 * Edit and Delete, Close and Escape.
 */

const spaghetti = mealOf("2026-09-09", DINNER, "recipe-1", { note: "Ben cooks" });

function renderPopover(overrides: Partial<MealPopoverProps> = {}) {
  const props: MealPopoverProps = {
    occurrence: occurrenceOf(spaghetti),
    recipeName: "🍝 Spaghetti",
    category: CATEGORIES[2],
    busy: false,
    onOpenRecipe: vi.fn(),
    onAddToList: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAddAnother: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<MealPopover {...props} />), props };
}

describe("MealPopover", () => {
  beforeAll(stubDialog);

  it("names the meal, says its day and mealtime, shows the note, and offers exactly the five actions", () => {
    renderPopover();
    expect(screen.getByRole("heading", { name: "🍝 Spaghetti" })).toBeInTheDocument();
    expect(screen.getByText("Wednesday 9 September")).toBeInTheDocument();
    expect(screen.getByText("Dinner")).toBeInTheDocument();
    expect(screen.getByText("Ben cooks")).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Open Recipe",
      "Add to List",
      "Edit",
      "Delete",
      "Add another meal",
      "Close",
    ]);
  });

  it("routes each action to the caller", () => {
    const { props } = renderPopover();
    fireEvent.click(screen.getByRole("button", { name: "Open Recipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Add another meal" }));
    expect(props.onOpenRecipe).toHaveBeenCalledTimes(1);
    expect(props.onAddToList).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onAddAnother).toHaveBeenCalledTimes(1);
  });

  it("locks Edit and Delete while a write is in flight, says a series repeats, and closes on Close and Escape", () => {
    const { props } = renderPopover({ busy: true, occurrence: occurrenceOf(mealOf("2026-09-09", DINNER, "r", { rrule: "FREQ=DAILY;INTERVAL=1" })) });
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByText(/repeats/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("cancel", { cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
