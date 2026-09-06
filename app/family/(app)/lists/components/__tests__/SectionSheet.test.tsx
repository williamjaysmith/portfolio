import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ok } from "../../../components/__tests__/action-result";
import { SectionSheet, type SectionSheetProps } from "../SectionSheet";
import { GROCERY, itemOf, listOf } from "./lists-test-fixtures";

/**
 * 005 T042 — Add section / Move items and Rename (FR-528, FR-529, FR-533): a
 * name and at least one item in add mode, the name alone in rename mode, the
 * match note before anything is sent, and the commit through the caller.
 */
const LIST = listOf({ id: GROCERY, name: "Grocery List" });
const EGGS = itemOf(GROCERY, "Eggs", { sortOrder: 1000 });
const MILK = itemOf(GROCERY, "Milk", { sortOrder: 2000, section: "Dairy" });

function renderSheet(overrides: Partial<SectionSheetProps> = {}) {
  const props: SectionSheetProps = {
    list: LIST,
    mode: { kind: "add" },
    items: [EGGS, MILK],
    sections: ["Dairy"],
    onSubmit: vi.fn().mockResolvedValue(ok({ section: "Dairy", moved: 1 })),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<SectionSheet {...props} />), props };
}

const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

describe("SectionSheet", () => {
  beforeAll(stubDialog);

  it("in add mode asks for a name and at least one of the list's items, showing each item's section", () => {
    renderSheet();
    expect(screen.getByRole("heading", { name: "Add a section to Grocery List" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Section name" })).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: /Eggs/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Milk/ })).toBeInTheDocument();
    expect(screen.getByText("Dairy")).toBeInTheDocument();
  });

  it("refuses an empty name and no items, without a write", async () => {
    const { props } = renderSheet();
    submit();
    expect(await screen.findByText("A section name is 1 to 60 characters.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Section name" }), { target: { value: "Bakery" } });
    submit();
    expect(await screen.findByText("Choose at least one item.")).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("says which existing section a typed name will join (FR-529), then commits the name and the chosen items", async () => {
    const { props } = renderSheet();
    fireEvent.change(screen.getByRole("textbox", { name: "Section name" }), { target: { value: "  dairy" } });
    expect(screen.getByText("The items join Dairy.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Eggs/ }));
    submit();
    await vi.waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({ name: "dairy", itemIds: [EGGS.id] }));
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  });

  it("in rename mode prefills the name, shows no checklist, and notes a merge into another section", async () => {
    const { props } = renderSheet({ mode: { kind: "rename", from: "Dairy" }, sections: ["Dairy", "Bakery"] });
    expect(screen.getByRole("heading", { name: "Rename Dairy" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Section name" })).toHaveValue("Dairy");
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Section name" }), { target: { value: "BAKERY" } });
    expect(screen.getByText("Dairy merges into Bakery.")).toBeInTheDocument();
    submit();
    await vi.waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({ name: "BAKERY", itemIds: [] }));
  });

  it("shows a refused commit where the tap happened, and stays open", async () => {
    const { props } = renderSheet({
      onSubmit: vi.fn().mockResolvedValue({ ok: false, error: "NOT_FOUND", message: "That list is no longer here." }),
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Section name" }), { target: { value: "Bakery" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Eggs/ }));
    submit();
    expect(await screen.findByText("That list is no longer here.")).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
