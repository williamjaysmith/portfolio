import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { useLists, useMealCategories, useMeals, useRecipes } from "@/lib/family/queries";
import type { List, Meal, MealCategory, Recipe } from "@/lib/family/types";

import { FabActionProvider, useFabAction } from "../../../components/FabAction";
import type { FamilyContextValue } from "../../../components/FamilyProvider";
import { makeActor, makeContext, stubDialog, withFamily } from "../../../components/__tests__/family-test-utils";
import { MealsBoard } from "../MealsBoard";
import { resetHiddenMealtimes } from "../useHiddenMealtimes";
import { BREAKFAST, CATEGORIES, DINNER, LUNCH, SNACK, mealOf, recipeOf } from "./meals-test-fixtures";

/**
 * 006 T030 — the Meals tab's grid and its mealtimes (FR-601–FR-611): seven
 * day columns from the household's start day with today marked, the rail's
 * four rows in order, a cell per day × shown mealtime named by its day,
 * mealtime and count, the week arrows and Today, a hidden mealtime's row
 * gone with its meals untouched, the no-mealtimes note, the shell's control
 * named "Add Meal", and the read error as the one line.
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return { ...actual, useMealCategories: vi.fn(), useRecipes: vi.fn(), useMeals: vi.fn(), useLists: vi.fn() };
});
vi.mock("@/lib/family/actions/meals", () => ({
  updateMealCategory: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  planMeal: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
}));
vi.mock("@/lib/family/actions/lists", () => ({ addListItems: vi.fn() }));
// The household clock is the machine's in jsdom; the server's date drives these tests instead.
vi.mock("../../../components/Clock", () => ({ useNow: () => null }));

const useCategoriesMock = useMealCategories as Mock;
const useRecipesMock = useRecipes as Mock;
const useMealsMock = useMeals as Mock;
const useListsMock = useLists as Mock;

const pancakes = recipeOf("Pancakes", BREAKFAST);
const spaghetti = recipeOf("🍝 Spaghetti", DINNER, { text: "500 g spaghetti\nparmesan\n\nBoil, then toss." });
const garlicBread = recipeOf("Garlic bread", DINNER);
const pizza = recipeOf("🍕 Pizza", DINNER);
const RECIPES: Recipe[] = [pancakes, spaghetti, garlicBread, pizza];

const MEALS: Meal[] = [
  mealOf("2026-09-06", BREAKFAST, pancakes.id),
  mealOf("2026-09-09", DINNER, spaghetti.id, { note: "Ben cooks" }),
  mealOf("2026-09-09", DINNER, garlicBread.id),
  mealOf("2026-09-04", DINNER, pizza.id, { rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR" }),
];

function listOf(id: string, name: string, kind: List["kind"], parentsOnly = false): List {
  return { id, householdId: "hh", name, kind, color: "#B6E085", parentsOnly, sortOrder: 1000, createdBy: null, updatedBy: null, createdAt: "", updatedAt: "" };
}
const LISTS = [listOf("aaaaaaaa-0000-4000-8000-00000000000a", "To-Do List", "to_do"), listOf("aaaaaaaa-0000-4000-8000-00000000000b", "Grocery List", "grocery"), listOf("aaaaaaaa-0000-4000-8000-00000000000c", "Gifts", "other", true)];

function reads(categories: MealCategory[] = CATEGORIES, recipes: Recipe[] = RECIPES, meals: Meal[] = MEALS, error: Error | null = null): void {
  useCategoriesMock.mockReturnValue({ data: categories, error });
  useRecipesMock.mockReturnValue({ data: recipes, error: null });
  useMealsMock.mockReturnValue({ data: meals, error: null });
  useListsMock.mockReturnValue({ data: LISTS, error: null });
}

function FabProbe() {
  const action = useFabAction();
  return action === null ? null : (
    <button type="button" onClick={action.run}>
      {action.label}
    </button>
  );
}

function boardTree(context: Partial<FamilyContextValue> = {}) {
  const value = makeContext({ actor: makeActor("parent"), isParent: true, ...context });
  return withFamily(
    value,
    <FabActionProvider>
      <FabProbe />
      <MealsBoard initialCategories={CATEGORIES} initialRecipes={RECIPES} initialMeals={MEALS} initialToday="2026-09-09" />
    </FabActionProvider>,
  );
}

function renderBoard(context: Partial<FamilyContextValue> = {}) {
  return render(boardTree(context));
}


const dayNames = () => screen.getAllByRole("region").map((day) => day.getAttribute("aria-label"));

describe("MealsBoard", () => {
  beforeAll(stubDialog);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetHiddenMealtimes();
    reads();
  });

  it("draws the seven days of the household's week from Sunday, today marked, with the rail's four rows in order", () => {
    renderBoard();
    expect(dayNames()).toEqual([
      "Sunday 6 September",
      "Monday 7 September",
      "Tuesday 8 September",
      "Wednesday 9 September",
      "Thursday 10 September",
      "Friday 11 September",
      "Saturday 12 September",
    ]);
    const wednesday = screen.getByRole("region", { name: "Wednesday 9 September" });
    expect(within(wednesday).getByRole("banner")).toHaveAttribute("aria-current", "date");
    expect(within(screen.getByRole("region", { name: "Monday 7 September" })).getByRole("banner")).not.toHaveAttribute("aria-current");
    const rail = screen.getByRole("list", { name: "Mealtimes" });
    expect(within(rail).getAllByText(/Breakfast|Lunch|Dinner|Snack/).map((one) => one.textContent)).toEqual(["Breakfast", "Lunch", "Dinner", "Snack"]);
    expect(screen.getByText("6–12 September")).toBeInTheDocument();
  });

  it("names every cell by its day, mealtime and count, and draws the slot's meals in planning order", () => {
    renderBoard();
    const dinner = screen.getByRole("group", { name: "Wednesday 9 September, Dinner, 2 meals" });
    expect(within(dinner).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["🍝 Spaghetti", "Garlic bread"]);
    expect(screen.getByRole("button", { name: "Wednesday 9 September, Lunch, empty" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Friday 11 September, Dinner, 1 meal" })).toHaveTextContent("🍕 Pizza");
    expect(screen.getByRole("group", { name: "Sunday 6 September, Breakfast, 1 meal" })).toHaveTextContent("Pancakes");
  });

  it("pages a whole week with the arrows and comes back with Today", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(dayNames()[0]).toBe("Sunday 13 September");
    expect(screen.getByRole("group", { name: "Friday 18 September, Dinner, 1 meal" })).toHaveTextContent("🍕 Pizza");
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(dayNames()[0]).toBe("Sunday 30 August");
    expect(screen.getByRole("button", { name: "Today" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(dayNames()[0]).toBe("Sunday 6 September");
    expect(screen.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  it("hides a mealtime on this device from the Categories sheet — its row leaves, its meals stay, the choice is stored", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Dinner" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const rail = screen.getByRole("list", { name: "Mealtimes" });
    expect(within(rail).queryByText("Dinner")).toBeNull();
    expect(screen.queryByRole("group", { name: /Dinner/ })).toBeNull();
    expect(screen.getByRole("group", { name: "Sunday 6 September, Breakfast, 1 meal" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("family:meal-hidden:v1") ?? "[]")).toEqual([DINNER]);
  });

  it("says so when every mealtime is hidden, and keeps the Categories control", () => {
    localStorage.setItem("family:meal-hidden:v1", JSON.stringify([BREAKFAST, LUNCH, DINNER, SNACK]));
    resetHiddenMealtimes();
    renderBoard();
    expect(screen.getByText("No mealtimes shown on this device")).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByRole("button", { name: "Categories" })).toBeInTheDocument();
  });

  it("offers the pencil to a parent and not to a member, and sends the rename through the action", async () => {
    const { updateMealCategory } = await import("@/lib/family/actions/meals");
    (updateMealCategory as Mock).mockResolvedValue({ ok: true, data: { ...CATEGORIES[3], name: "Tea" } });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Snack" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Tea" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() => expect(updateMealCategory).toHaveBeenCalledWith({ id: SNACK, patch: { name: "Tea" } }));
  });

  it("hides the pencils from a member", () => {
    renderBoard({ actor: makeActor("member"), isParent: false });
    fireEvent.click(screen.getByRole("button", { name: "Categories" }));
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("names the shell's control Add Meal, and says the reads failed in the household's words", () => {
    renderBoard();
    expect(screen.getByRole("button", { name: "Add Meal" })).toBeInTheDocument();
    reads(CATEGORIES, RECIPES, MEALS, new Error("boom"));
    renderBoard();
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "Meals could not be loaded.")).toBe(true);
  });
});

/**
 * 006 T040 — the planning flows wired to the queue (FR-622–FR-626): the sheet
 * from an empty cell and from the shell's control, the plan through
 * `planMeal`; the popover from a chip, Edit through `updateMeal` without a
 * scope on a one-off, Delete through the confirmation to `deleteMeal`; "Add
 * another meal" opening the sheet for the slot.
 */
describe("MealsBoard — planning", () => {
  beforeAll(stubDialog);

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    resetHiddenMealtimes();
    reads();
    const actions = await import("@/lib/family/actions/meals");
    (actions.planMeal as Mock).mockResolvedValue({ ok: true, data: MEALS[0] });
    (actions.updateMeal as Mock).mockResolvedValue({ ok: true, data: MEALS[1] });
    (actions.deleteMeal as Mock).mockResolvedValue({ ok: true, data: null });
  });

  it("opens the sheet from an empty cell with the slot prefilled and plans through the action", async () => {
    const { planMeal } = await import("@/lib/family/actions/meals");
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Wednesday 9 September, Lunch, empty" }));
    const sheet = screen.getByRole("dialog", { hidden: true });
    expect(within(sheet).getByRole("heading", { name: "Add to Lunch, Wednesday 9 September" })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("radio", { name: "All" }));
    fireEvent.click(within(sheet).getByRole("radio", { name: "Pancakes" }));
    fireEvent.submit(within(sheet).getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() =>
      expect(planMeal).toHaveBeenCalledWith({ date: "2026-09-09", categoryId: LUNCH, recipe: { kind: "existing", id: pancakes.id } }),
    );
  });

  it("opens the sheet from the shell's control on today and the first shown mealtime", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Add Meal" }));
    expect(screen.getByRole("heading", { name: "Add to Breakfast, Wednesday 9 September" })).toBeInTheDocument();
  });

  it("opens the popover from a chip, edits a one-off without a scope, and deletes through the confirmation", async () => {
    const { updateMeal, deleteMeal } = await import("@/lib/family/actions/meals");
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "🍝 Spaghetti" }));
    expect(screen.getByRole("heading", { name: "🍝 Spaghetti" })).toBeInTheDocument();
    expect(screen.getByText("Ben cooks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByText("Which meals should this apply to?")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /Note/ }), { target: { value: "Ana cooks" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() =>
      expect(updateMeal).toHaveBeenCalledWith({ id: MEALS[1].id, occurrenceDate: "2026-09-09", scope: undefined, patch: { note: "Ana cooks" } }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Garlic bread" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog", { hidden: true })).toHaveTextContent("Delete Garlic bread?");
    fireEvent.click(screen.getByRole("button", { name: "Delete meal" }));
    await vi.waitFor(() =>
      expect(deleteMeal).toHaveBeenCalledWith({ id: MEALS[2].id, occurrenceDate: "2026-09-09", scope: undefined, confirm: true }),
    );
  });

  it("asks the scope first for a repeating occurrence, in the meal's words, and carries it to the write (FR-629)", async () => {
    const { updateMeal, deleteMeal } = await import("@/lib/family/actions/meals");
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "🍕 Pizza" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit repeating meal" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "This and future meals" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Note/ }), { target: { value: "movie night" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() =>
      expect(updateMeal).toHaveBeenCalledWith({ id: MEALS[3].id, occurrenceDate: "2026-09-11", scope: "this_and_future", patch: { note: "movie night" } }),
    );

    fireEvent.click(screen.getByRole("button", { name: "🍕 Pizza" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("heading", { name: "Delete repeating meal" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "This meal" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete meal" }));
    await vi.waitFor(() =>
      expect(deleteMeal).toHaveBeenCalledWith({ id: MEALS[3].id, occurrenceDate: "2026-09-11", scope: "this", confirm: true }),
    );
  });

  it("closes the popover and says so when another device removed the meal under it (FR-642)", () => {
    const { rerender } = renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "🍝 Spaghetti" }));
    expect(screen.getByRole("heading", { name: "🍝 Spaghetti" })).toBeInTheDocument();
    reads(CATEGORIES, RECIPES, MEALS.filter((meal) => meal.id !== MEALS[1].id));
    // A fresh element: React would keep the old fiber for the very same one.
    rerender(boardTree());
    expect(screen.queryByRole("heading", { name: "🍝 Spaghetti" })).toBeNull();
    expect(screen.getByText("That meal is no longer here.")).toBeInTheDocument();
  });

  it("opens the add sheet for the slot from the popover's Add another meal", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "🍝 Spaghetti" }));
    fireEvent.click(screen.getByRole("button", { name: "Add another meal" }));
    expect(screen.getByRole("heading", { name: "Add to Dinner, Wednesday 9 September" })).toBeInTheDocument();
  });
});

/**
 * 006 T044 — the recipes wired to the queue (FR-615, FR-616, FR-618–FR-621):
 * the pane from the Recipes control and from a meal's Open Recipe (landing on
 * that recipe); New recipe through `createRecipe`; Edit through
 * `updateRecipe`; Delete through the two-way dialog to `deleteRecipe`; Plan
 * Meal opening the add sheet with the recipe chosen.
 */
describe("MealsBoard — recipes", () => {
  beforeAll(stubDialog);

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    resetHiddenMealtimes();
    reads();
    const actions = await import("@/lib/family/actions/meals");
    (actions.createRecipe as Mock).mockResolvedValue({ ok: true, data: pancakes });
    (actions.updateRecipe as Mock).mockResolvedValue({ ok: true, data: pancakes });
    (actions.deleteRecipe as Mock).mockResolvedValue({ ok: true, data: { removedMeals: 0 } });
    (actions.planMeal as Mock).mockResolvedValue({ ok: true, data: MEALS[0] });
    const lists = await import("@/lib/family/actions/lists");
    (lists.addListItems as Mock).mockResolvedValue({ ok: true, data: { added: 2 } });
  });

  it("pushes a recipe's chosen lines onto a chosen list in one write, from the popover and from the pane, and says so (FR-631–FR-633)", async () => {
    const { addListItems } = await import("@/lib/family/actions/lists");
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "🍝 Spaghetti" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    expect(screen.getByRole("heading", { name: "Add 🍝 Spaghetti to a list" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Grocery List", "To-Do List", "Gifts"]);
    fireEvent.click(screen.getByRole("checkbox", { name: /Boil, then toss/ }));
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() => expect(addListItems).toHaveBeenCalledWith({ listId: LISTS[1].id, texts: ["500 g spaghetti", "parmesan"] }));
    expect(await screen.findByText("2 items added to Grocery List.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
    fireEvent.click(within(screen.getByRole("list", { name: "Recipes" })).getByRole("button", { name: /Spaghetti/ }));
    fireEvent.click(within(screen.getByRole("article", { name: "🍝 Spaghetti" })).getByRole("button", { name: "Add to List" }));
    expect(screen.getByRole("heading", { name: "Add 🍝 Spaghetti to a list" })).toBeInTheDocument();
  });

  it("hides a Parents only list from a member's chooser", () => {
    renderBoard({ actor: makeActor("member"), isParent: false });
    fireEvent.click(screen.getByRole("button", { name: "🍝 Spaghetti" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to List" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Grocery List", "To-Do List"]);
  });

  it("opens the pane from the Recipes control, and from a meal's Open Recipe on that recipe", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
    expect(screen.getByRole("heading", { name: "Recipes" })).toBeInTheDocument();
    expect(screen.getByText("Choose a recipe to see it here.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "🍝 Spaghetti" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Recipe" }));
    expect(screen.getByRole("article", { name: "🍝 Spaghetti" })).toBeInTheDocument();
  });

  it("creates, edits and deletes a recipe through the actions", async () => {
    const { createRecipe, updateRecipe, deleteRecipe } = await import("@/lib/family/actions/meals");
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
    fireEvent.click(screen.getByRole("button", { name: "New recipe" }));
    fireEvent.change(screen.getByRole("textbox", { name: "What are we eating?" }), { target: { value: "Toast" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() => expect(createRecipe).toHaveBeenCalledWith({ name: "Toast", categoryId: BREAKFAST, text: "" }));

    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
    fireEvent.click(within(screen.getByRole("list", { name: "Recipes" })).getByRole("button", { name: /Garlic bread/ }));
    fireEvent.click(within(screen.getByRole("article", { name: "Garlic bread" })).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Instructions or ingredients" }), { target: { value: "1 baguette" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() => expect(updateRecipe).toHaveBeenCalledWith({ id: garlicBread.id, patch: { text: "1 baguette" } }));

    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
    fireEvent.click(within(screen.getByRole("list", { name: "Recipes" })).getByRole("button", { name: /Garlic bread/ }));
    fireEvent.click(within(screen.getByRole("article", { name: "Garlic bread" })).getByRole("button", { name: "Delete" }));
    expect(screen.getByText("The 1 planned meal stays on the plan.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /This recipe and planned meals/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));
    await vi.waitFor(() => expect(deleteRecipe).toHaveBeenCalledWith({ id: garlicBread.id, mode: "recipe_and_meals", confirm: true }));
  });

  it("plans from a recipe's detail with the recipe already chosen", async () => {
    const { planMeal } = await import("@/lib/family/actions/meals");
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
    fireEvent.click(within(screen.getByRole("list", { name: "Recipes" })).getByRole("button", { name: /Pancakes/ }));
    fireEvent.click(within(screen.getByRole("article", { name: "Pancakes" })).getByRole("button", { name: "Plan Meal" }));
    expect(screen.getByRole("heading", { name: "Add to Breakfast, Wednesday 9 September" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Pancakes" })).toBeChecked();
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() =>
      expect(planMeal).toHaveBeenCalledWith({ date: "2026-09-09", categoryId: BREAKFAST, recipe: { kind: "existing", id: pancakes.id } }),
    );
  });
});
