import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { List } from "@/lib/family/types";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ok } from "../../../components/__tests__/action-result";
import { AddToListSheet, type AddToListSheetProps } from "../AddToListSheet";

/**
 * 006 T046 — Add to List (FR-631–FR-633): every non-blank line ticked, a long
 * line marked as cut, the chooser with Grocery lists first, untick and choose
 * → one submit with exactly the chosen lines, the empty cases.
 */

function listOf(id: string, name: string, kind: List["kind"], sortOrder: number): List {
  return { id, householdId: "hh", name, kind, color: "#B6E085", parentsOnly: false, sortOrder, createdBy: null, updatedBy: null, createdAt: "", updatedAt: "" };
}

const LISTS = [listOf("todo", "To-Do List", "to_do", 1000), listOf("grocery", "Grocery List", "grocery", 2000), listOf("packing", "Packing List", "other", 3000)];
const TEXT = "500 g spaghetti\n1 onion\n\n" + "x".repeat(205) + "\n\nSoften the onion.";

function renderSheet(overrides: Partial<AddToListSheetProps> = {}) {
  const props: AddToListSheetProps = {
    recipeName: "🍝 Spaghetti",
    text: TEXT,
    lists: LISTS,
    listsState: "ready",
    onSubmit: vi.fn().mockResolvedValue(ok({ added: 2 })),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<AddToListSheet {...props} />), props };
}

const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

describe("AddToListSheet", () => {
  beforeAll(stubDialog);

  it("lists every non-blank line ticked, marks a cut line, and offers the lists with Grocery first", () => {
    renderSheet();
    expect(screen.getByRole("heading", { name: "Add 🍝 Spaghetti to a list" })).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);
    expect(boxes.every((box) => (box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText("cut to 200 characters")).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Grocery List", "To-Do List", "Packing List"]);
    expect(screen.getByRole("combobox", { name: "List" })).toHaveValue("grocery");
  });

  it("submits exactly the chosen lines onto the chosen list", async () => {
    const { props } = renderSheet();
    fireEvent.click(screen.getByRole("checkbox", { name: /Soften the onion/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /xxxx/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "List" }), { target: { value: "packing" } });
    submit();
    await vi.waitFor(() => expect(props.onSubmit).toHaveBeenCalledWith({ listId: "packing", texts: ["500 g spaghetti", "1 onion"] }));
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  });

  it("refuses no line chosen without sending", async () => {
    const { props } = renderSheet();
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    submit();
    expect(await screen.findByText("Choose at least one line.")).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("says the lists are still loading, or could not be loaded, rather than that there is none (FR-642)", () => {
    const { unmount } = renderSheet({ lists: [], listsState: "loading" });
    expect(screen.getByRole("heading", { name: "Loading lists" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No list to add to" })).toBeNull();
    unmount();
    renderSheet({ lists: [], listsState: "failed" });
    expect(screen.getByRole("heading", { name: "Lists could not be loaded" })).toBeInTheDocument();
  });

  it("says there is no list, pointing at the Lists tab, and that there is nothing to add", () => {
    const { unmount } = renderSheet({ lists: [] });
    expect(screen.getByRole("heading", { name: "No list to add to" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lists tab" })).toHaveAttribute("href", "/family/lists");
    unmount();
    renderSheet({ text: "  \n\n" });
    expect(screen.getByRole("heading", { name: "Nothing to add" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
