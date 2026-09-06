import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListCard, type ListCardProps } from "../ListCard";
import { addKeyOf, itemKeyOf } from "../useListWrites";
import { CHECKED_AT, GROCERY, itemOf, listOf } from "./lists-test-fixtures";

/**
 * 005 T025 / T035 / T039 — one list's card (FR-503, FR-504, FR-505, FR-516,
 * FR-518–FR-520, FR-530): the header (serif name, the count badge over the FULL
 * set, the `•••`), the "Add item" box, the flat sequence of rows from the SHOWN
 * set, section headers with their counts, the "Add section" footer, and the
 * busy keys reaching the right row and the box.
 */

const LIST = listOf({ id: GROCERY, name: "Grocery List" });

function renderCard(overrides: Partial<ListCardProps> = {}) {
  const items = overrides.items ?? [];
  const props: ListCardProps = {
    list: LIST,
    items,
    shownItems: overrides.shownItems ?? items,
    busyKeys: new Set(),
    onAdd: vi.fn().mockResolvedValue(null),
    onToggle: vi.fn(),
    onOpenItem: vi.fn(),
    onEdit: vi.fn(),
    onMenu: vi.fn(),
    onAddSection: vi.fn(),
    ...overrides,
  };
  return { ...render(<ListCard {...props} />), props };
}

describe("ListCard", () => {
  it("names the card by the list, sets its accent, and draws the header, the box and the footer", () => {
    const { container } = renderCard();
    const card = screen.getByRole("region", { name: "Grocery List" });
    expect(card).toHaveAttribute("style", expect.stringContaining("--profile: #B6E085"));
    expect(container.querySelector(".fam-profile.fam-tint-20")).toBe(card);
    expect(within(card).getByRole("group", { name: "Grocery List" })).toBeInTheDocument();
    expect(within(card).getByRole("textbox", { name: "Add item to Grocery List" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Add section/ })).toBeInTheDocument();
  });

  it("counts the unchecked items on the badge from the FULL set, whatever the device shows (FR-505)", () => {
    const items = [
      itemOf(GROCERY, "Eggs"),
      itemOf(GROCERY, "Milk", { checkedAt: CHECKED_AT }),
      itemOf(GROCERY, "Bread"),
    ];
    renderCard({ items, shownItems: items.filter((item) => item.checkedAt === null) });
    expect(screen.getByRole("img", { name: "2 to do" })).toHaveTextContent("2");
    expect(screen.queryByRole("checkbox", { name: "Milk" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Eggs" })).toBeInTheDocument();
  });

  it("draws the rows in the flat sequence: ungrouped first, then each section's header over its items", () => {
    const items = [
      itemOf(GROCERY, "Eggs", { sortOrder: 1000 }),
      itemOf(GROCERY, "Bagels", { sortOrder: 2000, section: "Bakery" }),
      itemOf(GROCERY, "Milk", { sortOrder: 3000 }),
      itemOf(GROCERY, "Yoghurt", { sortOrder: 4000, section: "Dairy", checkedAt: CHECKED_AT }),
      itemOf(GROCERY, "Bread", { sortOrder: 5000, section: "Bakery" }),
    ];
    renderCard({ items });
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual(["Eggs", "Milk", "Bakery2 items", "Bagels", "Bread", "Dairy0 items", "Yoghurt"]);
  });

  it("routes the header taps, the toggles and the text taps to the board", () => {
    const item = itemOf(GROCERY, "Eggs");
    const { props } = renderCard({ items: [item] });
    fireEvent.click(screen.getByRole("button", { name: "Grocery List" }));
    expect(props.onEdit).toHaveBeenCalledWith(LIST);
    fireEvent.click(screen.getByRole("button", { name: "Grocery List menu" }));
    expect(props.onMenu).toHaveBeenCalledWith(LIST);
    fireEvent.click(screen.getByRole("checkbox", { name: "Eggs" }));
    expect(props.onToggle).toHaveBeenCalledWith(item, true);
    fireEvent.click(screen.getByRole("button", { name: "Eggs" }));
    expect(props.onOpenItem).toHaveBeenCalledWith(item);
    fireEvent.click(screen.getByRole("button", { name: /Add section/ }));
    expect(props.onAddSection).toHaveBeenCalledWith(LIST);
  });

  it("shows busy on exactly the row that is writing, and on the box while an add is in flight", () => {
    const eggs = itemOf(GROCERY, "Eggs");
    const milk = itemOf(GROCERY, "Milk");
    renderCard({ items: [eggs, milk], busyKeys: new Set([itemKeyOf(eggs), addKeyOf(LIST)]) });
    expect(screen.getByRole("checkbox", { name: "Eggs" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Milk" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Add item to Grocery List" })).toBeDisabled();
  });

  it("registers its add box under the list's id", () => {
    const registerAddInput = vi.fn();
    renderCard({ registerAddInput });
    expect(registerAddInput).toHaveBeenCalledWith(GROCERY, screen.getByRole("textbox", { name: "Add item to Grocery List" }));
  });
});
