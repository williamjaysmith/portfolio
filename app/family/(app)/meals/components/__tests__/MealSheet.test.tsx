import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ok } from "../../../components/__tests__/action-result";
import { MealSheet, type MealSheetProps } from "../MealSheet";
import { BREAKFAST, CATEGORIES, DINNER, mealOf, occurrenceOf, recipeOf } from "./meals-test-fixtures";

/**
 * 006 T037 — the meal sheet (FR-622, FR-624, FR-627, FR-638): the slot's date
 * and mealtime prefilled and changeable; From Recipes with the slot's mealtime
 * chip, the search and removed recipes absent; New Entry with a name and a
 * text; the note; the dietary notes; Save sending the plan; a refusal at its
 * field. T049 — the Repeats fieldset, and the edit sheet's rules by scope.
 */

const pancakes = recipeOf("Pancakes", BREAKFAST, { text: "flour\neggs" });
const spaghetti = recipeOf("🍝 Spaghetti", DINNER, { text: "500 g spaghetti" });
const stew = recipeOf("Old stew", DINNER, { removedAt: "2026-09-05T00:00:00.000Z" });
const RECIPES = [pancakes, spaghetti, stew];
const NOTES = [{ name: "Cleo", note: "no nuts" }];

function renderSheet(overrides: Partial<MealSheetProps> = {}) {
  const props: MealSheetProps = {
    mode: { kind: "add", date: "2026-09-09", categoryId: DINNER },
    categories: CATEGORIES,
    recipes: RECIPES,
    notes: NOTES,
    onSubmit: vi.fn().mockResolvedValue(ok(null)),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<MealSheet {...props} />), props };
}

const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

describe("MealSheet — add", () => {
  beforeAll(stubDialog);

  it("names the slot, prefills the date and mealtime, lists the slot's mealtime's recipes first, and shows the dietary notes", () => {
    renderSheet();
    expect(screen.getByRole("heading", { name: "Add to Dinner, Wednesday 9 September" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-09-09");
    expect(screen.getByRole("combobox", { name: "Mealtime" })).toHaveValue(DINNER);
    expect(screen.getByRole("radio", { name: "Dinner" })).toBeChecked();
    expect(screen.getAllByRole("radio", { name: /Spaghetti|Pancakes|stew/ }).map((radio) => radio.closest("label")?.textContent)).toEqual(["🍝 Spaghetti"]);
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(screen.getByRole("radio", { name: "Pancakes" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Old stew" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Dietary notes" })).getByText("Cleo: no nuts")).toBeInTheDocument();
  });

  it("searches the library by name and text", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search recipes" }), { target: { value: "flour" } });
    expect(screen.getAllByRole("radio", { name: /Spaghetti|Pancakes/ })).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "Pancakes" })).toBeInTheDocument();
  });

  it("plans an existing recipe with a note through the caller, then closes", async () => {
    const { props } = renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "🍝 Spaghetti" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Note/ }), { target: { value: "Ben cooks" } });
    submit();
    await vi.waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({
        kind: "plan",
        input: { date: "2026-09-09", categoryId: DINNER, recipe: { kind: "existing", id: spaghetti.id }, note: "Ben cooks" },
      }),
    );
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  });

  it("plans a New Entry with its name and text, on another day and mealtime", async () => {
    const { props } = renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "New Entry" }));
    fireEvent.change(screen.getByRole("textbox", { name: "What are we eating?" }), { target: { value: "🍕 Pizza" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Ingredients and instructions/ }), { target: { value: "dough\npassata" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-11" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Mealtime" }), { target: { value: BREAKFAST } });
    submit();
    await vi.waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({
        kind: "plan",
        input: { date: "2026-09-11", categoryId: BREAKFAST, recipe: { kind: "new", name: "🍕 Pizza", text: "dough\npassata" } },
      }),
    );
  });

  it("refuses a plan with no recipe chosen, at the recipe field, without sending", async () => {
    const { props } = renderSheet();
    submit();
    expect(await screen.findByText("Choose a recipe, or type a new entry.")).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("offers Repeats with the calendar's four choices and an until date, and sends the repeat (FR-627)", async () => {
    const { props } = renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: "🍝 Spaghetti" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Repeats" }), { target: { value: "weekly" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Friday" }));
    fireEvent.change(screen.getByLabelText(/Repeats until/), { target: { value: "2026-12-31" } });
    submit();
    await vi.waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ repeat: { kind: "weekly", weekdays: ["FR"], until: "2026-12-31" } }) })),
    );
  });

  it("shows a refused write where the tap happened, and stays open", async () => {
    const { props } = renderSheet({ onSubmit: vi.fn().mockResolvedValue({ ok: false, error: "UNAVAILABLE", message: "Can't reach the household right now." }) });
    fireEvent.click(screen.getByRole("radio", { name: "🍝 Spaghetti" }));
    submit();
    expect(await screen.findByText("Can't reach the household right now.")).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

describe("MealSheet — edit", () => {
  beforeAll(stubDialog);

  const pizza = mealOf("2026-09-04", DINNER, spaghetti.id, { rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=FR", note: "family night" });
  const occurrence = occurrenceOf(pizza, { occurrenceDate: "2026-09-11", date: "2026-09-11" });

  it("prefills from the live occurrence and sends only what changed at scope all", async () => {
    const { props } = renderSheet({ mode: { kind: "edit", occurrence, meal: pizza, scope: "all" } });
    expect(screen.getByRole("heading", { name: "Edit meal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveValue("2026-09-11");
    expect(screen.getByRole("textbox", { name: /Note/ })).toHaveValue("family night");
    expect(screen.getByRole("combobox", { name: "Repeats" })).toHaveValue("weekly");
    expect(screen.queryByRole("radio", { name: "New Entry" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /Note/ }), { target: { value: "Ben's turn" } });
    submit();
    await vi.waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({ kind: "patch", patch: { note: "Ben's turn" } }));
  });

  it("at scope this offers neither the recipe nor the repeat (FR-630)", () => {
    renderSheet({ mode: { kind: "edit", occurrence, meal: pizza, scope: "this" } });
    expect(screen.queryByRole("combobox", { name: "Repeats" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "🍝 Spaghetti" })).toBeNull();
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
  });
});
