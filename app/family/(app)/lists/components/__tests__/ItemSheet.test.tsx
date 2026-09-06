import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ok } from "../../../components/__tests__/action-result";
import { ItemSheet, type ItemSheetProps } from "../ItemSheet";
import { GROCERY, itemOf } from "./lists-test-fixtures";

/**
 * 005 T037 — an item's sheet (FR-522, FR-529, FR-541): the text and the Section
 * chooser prefilled from the item, Save sending only what changed, nothing
 * changed refused without a write, Move up / Move down honouring the ends and
 * the busy state, Delete outright, and a refused write shown here.
 */
const EGGS = itemOf(GROCERY, "Eggs", { sortOrder: 1000 });
const MILK = itemOf(GROCERY, "Milk", { sortOrder: 2000, section: "Dairy" });

function renderSheet(overrides: Partial<ItemSheetProps> = {}) {
  const props: ItemSheetProps = {
    item: EGGS,
    listName: "Grocery List",
    sections: ["Dairy", "Bakery"],
    canMoveUp: true,
    canMoveDown: true,
    busy: false,
    notice: null,
    onSave: vi.fn().mockResolvedValue(ok(EGGS)),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<ItemSheet {...props} />), props };
}

const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

describe("ItemSheet", () => {
  beforeAll(stubDialog);

  it("names itself by the item, prefills the text and the section, and lists every section plus New section…", () => {
    renderSheet({ item: MILK });
    expect(screen.getByRole("heading", { name: "Milk" })).toBeInTheDocument();
    expect(screen.getByText("Grocery List")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Item" })).toHaveValue("Milk");
    const chooser = screen.getByRole("combobox", { name: "Section" });
    expect(chooser).toHaveValue("Dairy");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "No section",
      "Dairy",
      "Bakery",
      "New section…",
    ]);
  });

  it("saves only the text when only the text changed, then closes (FR-522)", async () => {
    const { props } = renderSheet();
    fireEvent.change(screen.getByRole("textbox", { name: "Item" }), { target: { value: "Eggs x12" } });
    submit();
    expect(await screen.findByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(props.onSave).toHaveBeenCalledWith({ text: "Eggs x12" });
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  });

  it("saves the chosen section alone, and null for No section (FR-529)", async () => {
    const { props } = renderSheet();
    fireEvent.change(screen.getByRole("combobox", { name: "Section" }), { target: { value: "Bakery" } });
    submit();
    await vi.waitFor(() => expect(props.onSave).toHaveBeenCalledWith({ section: "Bakery" }));

    const second = renderSheet({ item: MILK });
    fireEvent.change(screen.getAllByRole("combobox", { name: "Section" })[1], { target: { value: "" } });
    fireEvent.submit(screen.getAllByRole("button", { name: "Save" })[1].closest("form") as HTMLFormElement);
    await vi.waitFor(() => expect(second.props.onSave).toHaveBeenCalledWith({ section: null }));
  });

  it("reveals a name field for New section… and validates it before anything is sent", async () => {
    const { props } = renderSheet();
    fireEvent.change(screen.getByRole("combobox", { name: "Section" }), { target: { value: "__new__" } });
    const name = screen.getByRole("textbox", { name: "New section name" });
    submit();
    expect(await screen.findByText("A section name is 1 to 60 characters.")).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: "  Deli " } });
    submit();
    await vi.waitFor(() => expect(props.onSave).toHaveBeenCalledWith({ section: "Deli" }));
  });

  it("refuses a save with nothing changed, without a write", async () => {
    const { props } = renderSheet();
    submit();
    expect(await screen.findByText("Nothing to change.")).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("moves one row up or down through the caller, honouring the ends and the busy state (FR-541)", () => {
    const { props, rerender } = renderSheet({ canMoveUp: false });
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move down" }));
    expect(props.onMove).toHaveBeenCalledWith(1);

    rerender(<ItemSheet {...props} canMoveUp busy />);
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("deletes outright through the caller, and shows a refused write where the tap happened", () => {
    const { props } = renderSheet({ notice: "That item is no longer here." });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByText("That item is no longer here.")).toHaveAttribute("role", "alert");
  });

  it("closes on Cancel and on Escape", () => {
    const { props } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent(screen.getByRole("dialog", { hidden: true }), new Event("cancel", { cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
