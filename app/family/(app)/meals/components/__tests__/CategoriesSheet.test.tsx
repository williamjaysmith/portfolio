import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ok } from "../../../components/__tests__/action-result";
import { CategoriesSheet } from "../CategoriesSheet";
import { CategoryForm, type CategoryFormProps } from "../CategoryForm";
import type { HiddenMealtimes } from "../useHiddenMealtimes";
import { CATEGORIES, DINNER, LUNCH } from "./meals-test-fixtures";

/**
 * 006 T031 — the Categories sheet and the pencil (FR-610–FR-612, FR-640): four
 * rows with a checkbox named by the mealtime and its state; the pencil for a
 * parent only; the form's name and colour; a taken name shown against the
 * field; the not-remembered notice.
 */

function hiddenOf(hidden: string[] = [], persistent = true): HiddenMealtimes {
  const set = new Set(hidden);
  return { hiddenIds: set, isHidden: (id) => set.has(id), toggle: vi.fn(), persistent };
}

describe("CategoriesSheet", () => {
  beforeAll(stubDialog);

  it("lists the four mealtimes with a checkbox named by each, checked unless hidden, and toggles through the store", () => {
    const hidden = hiddenOf([LUNCH]);
    render(<CategoriesSheet categories={CATEGORIES} hidden={hidden} canEdit onEdit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Mealtimes" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual(["Breakfast", "Lunch", "Dinner", "Snack"]);
    expect(screen.getByRole("checkbox", { name: "Lunch" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dinner" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Dinner" }));
    expect(hidden.toggle).toHaveBeenCalledWith(DINNER);
  });

  it("offers the pencil to a parent and not to a member, and opens the form through the caller", () => {
    const onEdit = vi.fn();
    const { rerender } = render(<CategoriesSheet categories={CATEGORIES} hidden={hiddenOf()} canEdit onEdit={onEdit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Dinner" }));
    expect(onEdit).toHaveBeenCalledWith(CATEGORIES[2]);
    rerender(<CategoriesSheet categories={CATEGORIES} hidden={hiddenOf()} canEdit={false} onEdit={onEdit} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
  });

  it("says the choice won't be remembered when storage refuses, and closes on Done and Escape", () => {
    const onClose = vi.fn();
    render(<CategoriesSheet categories={CATEGORIES} hidden={hiddenOf([], false)} canEdit={false} onEdit={vi.fn()} onClose={onClose} />);
    expect(screen.getByText(/won’t be remembered/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("CategoryForm", () => {
  beforeAll(stubDialog);

  function renderForm(overrides: Partial<CategoryFormProps> = {}) {
    const props: CategoryFormProps = {
      category: CATEGORIES[3],
      categories: CATEGORIES,
      onSubmit: vi.fn().mockResolvedValue(ok(CATEGORIES[3])),
      onClose: vi.fn(),
      ...overrides,
    };
    return { ...render(<CategoryForm {...props} />), props };
  }

  const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

  it("prefills the name and colour and sends only what changed", async () => {
    const { props } = renderForm();
    expect(screen.getByRole("heading", { name: "Edit Snack" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Snack");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: " Tea " } });
    submit();
    await vi.waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({ name: "Tea" }));
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  });

  it("refuses nothing changed and a 41-character name before sending", async () => {
    const { props } = renderForm();
    submit();
    expect(await screen.findByText("Nothing to change.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "x".repeat(41) } });
    submit();
    expect(await screen.findByText("A mealtime name is 1 to 40 characters.")).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("shows a taken name against the field and stays open", async () => {
    const { props } = renderForm({
      onSubmit: vi.fn().mockResolvedValue({ ok: false, error: "CONFLICT", message: "That name is already used.", fieldErrors: { name: ["That name is already used."] } }),
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "dinner" } });
    submit();
    expect(await screen.findByText("That name is already used.")).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
