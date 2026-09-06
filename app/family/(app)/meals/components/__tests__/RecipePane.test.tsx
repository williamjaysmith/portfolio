import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ok } from "../../../components/__tests__/action-result";
import { RecipeDeleteDialog } from "../RecipeDeleteDialog";
import { RecipeForm, type RecipeFormProps } from "../RecipeForm";
import { RecipePane, type RecipePaneProps } from "../RecipePane";
import { BREAKFAST, CATEGORIES, DINNER, SNACK, recipeOf } from "./meals-test-fixtures";

/**
 * 006 T042 / T043 — the recipes pane (FR-618–FR-621): every active recipe
 * with its mealtime's badge, a removed one absent, the chips and the search,
 * the selected detail with its text and four actions, the way back on a
 * phone; the form's fields and refusals; the delete dialog's two choices
 * worded with the meal count.
 */

const pancakes = recipeOf("Pancakes", BREAKFAST, { text: "2 cups flour\n2 eggs" });
const banana = recipeOf("Banana bread", SNACK, { text: "3 ripe bananas\n200 g flour" });
const spaghetti = recipeOf("🍝 Spaghetti", DINNER, { text: "500 g spaghetti\nparmesan" });
const stew = recipeOf("Old stew", DINNER, { removedAt: "2026-09-05T00:00:00.000Z" });
const RECIPES = [pancakes, banana, spaghetti, stew];

function renderPane(overrides: Partial<RecipePaneProps> = {}) {
  const props: RecipePaneProps = {
    recipes: RECIPES,
    categories: CATEGORIES,
    selectedId: null,
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onPlan: vi.fn(),
    onAddToList: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<RecipePane {...props} />), props };
}

const listed = () => within(screen.getByRole("list", { name: "Recipes" })).getAllByRole("button").map((row) => row.textContent);

describe("RecipePane", () => {
  beforeAll(stubDialog);

  it("lists every active recipe by name with its mealtime's badge, never a removed one", () => {
    renderPane();
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
    expect(listed()).toEqual(["BPancakes", "SBanana bread", "D🍝 Spaghetti"]);
    expect(within(screen.getByRole("list", { name: "Recipes" })).getAllByRole("img").map((badge) => badge.getAttribute("aria-label"))).toEqual(["Breakfast", "Snack", "Dinner"]);
    expect(screen.getByText("Choose a recipe to see it here.")).toBeInTheDocument();
  });

  it("filters by a mealtime chip and by a search over name and text", () => {
    renderPane();
    fireEvent.click(screen.getByRole("radio", { name: "Dinner" }));
    expect(listed()).toEqual(["D🍝 Spaghetti"]);
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search recipes" }), { target: { value: "flour" } });
    expect(listed()).toEqual(["BPancakes", "SBanana bread"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search recipes" }), { target: { value: "nothing" } });
    expect(screen.getByText("No recipes match.")).toBeInTheDocument();
  });

  it("selects through the caller, and shows the selected recipe's detail with its text and four actions", () => {
    const { props, rerender } = renderPane();
    fireEvent.click(screen.getByRole("button", { name: /Pancakes/ }));
    expect(props.onSelect).toHaveBeenCalledWith(pancakes.id);
    rerender(<RecipePane {...props} selectedId={spaghetti.id} />);
    const detail = screen.getByRole("article", { name: "🍝 Spaghetti" });
    expect(within(detail).getByText("Dinner")).toBeInTheDocument();
    expect(within(detail).getByText(/500 g spaghetti/)).toHaveTextContent("500 g spaghetti parmesan");
    fireEvent.click(within(detail).getByRole("button", { name: "Plan Meal" }));
    fireEvent.click(within(detail).getByRole("button", { name: "Add to List" }));
    fireEvent.click(within(detail).getByRole("button", { name: "Edit" }));
    fireEvent.click(within(detail).getByRole("button", { name: "Delete" }));
    expect(props.onPlan).toHaveBeenCalledWith(spaghetti);
    expect(props.onAddToList).toHaveBeenCalledWith(spaghetti);
    expect(props.onEdit).toHaveBeenCalledWith(spaghetti);
    expect(props.onDelete).toHaveBeenCalledWith(spaghetti);
    fireEvent.click(within(detail).getByRole("button", { name: "Recipes" }));
    expect(props.onSelect).toHaveBeenLastCalledWith(null);
  });

  it("opens New recipe through the caller and closes on Close", () => {
    const { props } = renderPane();
    fireEvent.click(screen.getByRole("button", { name: "New recipe" }));
    expect(props.onNew).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("RecipeForm", () => {
  beforeAll(stubDialog);

  function renderForm(overrides: Partial<RecipeFormProps> = {}) {
    const props: RecipeFormProps = {
      mode: { kind: "create", categoryId: SNACK },
      categories: CATEGORIES,
      notes: [{ name: "Cleo", note: "no nuts" }],
      onSubmit: vi.fn().mockResolvedValue(ok(pancakes)),
      onClose: vi.fn(),
      ...overrides,
    };
    return { ...render(<RecipeForm {...props} />), props };
  }

  const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

  it("creates a recipe with the three fields, showing the dietary notes", async () => {
    const { props } = renderForm();
    expect(screen.getByRole("heading", { name: "New recipe" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Mealtime" })).toHaveValue(SNACK);
    expect(screen.getByText("Cleo: no nuts")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "What are we eating?" }), { target: { value: " Banana bread " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Instructions or ingredients" }), { target: { value: "3 ripe bananas\n200 g flour" } });
    submit();
    await vi.waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({ kind: "create", input: { name: "Banana bread", categoryId: SNACK, text: "3 ripe bananas\n200 g flour" } }),
    );
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  });

  it("edits with only what changed, prefilled from the recipe", async () => {
    const { props } = renderForm({ mode: { kind: "edit", recipe: spaghetti } });
    expect(screen.getByRole("heading", { name: "Edit 🍝 Spaghetti" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Instructions or ingredients" })).toHaveValue("500 g spaghetti\nparmesan");
    fireEvent.change(screen.getByRole("combobox", { name: "Mealtime" }), { target: { value: BREAKFAST } });
    submit();
    await vi.waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({ kind: "patch", patch: { categoryId: BREAKFAST } }));
  });

  it("refuses a blank name at the field before sending", async () => {
    const { props } = renderForm();
    submit();
    expect(await screen.findByText("A recipe name is 1 to 120 characters.")).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

describe("RecipeDeleteDialog", () => {
  beforeAll(stubDialog);

  it("offers the two choices worded with the meal count, defaults to just the recipe, and confirms the chosen one", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<RecipeDeleteDialog recipe={spaghetti} mealCount={2} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole("alertdialog", { hidden: true })).toHaveTextContent("Delete 🍝 Spaghetti?");
    expect(screen.getByText("The 2 planned meals stay on the plan.")).toBeInTheDocument();
    expect(screen.getByText("The 2 planned meals go too.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Just the recipe/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(onConfirm).toHaveBeenCalledWith("recipe");
    fireEvent.click(screen.getByRole("radio", { name: /This recipe and planned meals/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(onConfirm).toHaveBeenLastCalledWith("recipe_and_meals");
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("says so when nothing is planned, and locks the button while pending", () => {
    render(<RecipeDeleteDialog recipe={stew} mealCount={0} pending onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("It leaves the library.")).toBeInTheDocument();
    expect(screen.getByText("Nothing is planned with it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete for good" })).toBeDisabled();
  });
});
