import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    folds: { isFolded: () => false, toggle: vi.fn(), persistent: true },
    onAdd: vi.fn().mockResolvedValue(null),
    onToggle: vi.fn(),
    onOpenItem: vi.fn(),
    onMove: vi.fn(),
    onEdit: vi.fn(),
    onMenu: vi.fn(),
    onSectionMenu: vi.fn(),
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

/**
 * 005 T040 / T041 / T044 — the section headers' fold and menu (FR-531, FR-533),
 * and the press-and-hold reorder over the flat sequence (FR-523, FR-532, R508):
 * a drop beside a header lands the item in that section with the neighbours
 * `dropOf` names; a header can be landed beside but never lifted; the announce
 * region reads the machine's commentary.
 */
describe("ListCard — sections and the reorder", () => {
  const ROW_HEIGHT = 40;

  /** Each row's rect from where it sits among its siblings. */
  function stubLayout(): void {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const siblings = this.parentElement === null ? [] : [...this.parentElement.children];
      const index = Math.max(0, siblings.indexOf(this));
      const top = index * ROW_HEIGHT;
      return { top, bottom: top + ROW_HEIGHT, left: 0, right: 200, width: 200, height: ROW_HEIGHT, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
  }

  const eggs = itemOf(GROCERY, "Eggs", { sortOrder: 1000 });
  const milk = itemOf(GROCERY, "Milk", { sortOrder: 2000, section: "Dairy" });
  const yoghurt = itemOf(GROCERY, "Yoghurt", { sortOrder: 3000, section: "Dairy" });
  const items = [eggs, milk, yoghurt];

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("folds a section on this device through the header's chevron, keeping the header and its count", () => {
    const toggle = vi.fn();
    const { rerender, props } = renderCard({ items, folds: { isFolded: () => false, toggle, persistent: true } });
    const fold = screen.getByRole("button", { name: "Fold Dairy" });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(fold);
    expect(toggle).toHaveBeenCalledWith(GROCERY, "Dairy");

    rerender(<ListCard {...props} folds={{ isFolded: (_, section) => section === "Dairy", toggle, persistent: true }} />);
    expect(screen.getByRole("button", { name: "Unfold Dairy" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Milk" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Eggs" })).toBeInTheDocument();
  });

  it("opens the section menu from the header's •••, naming the list and the section", () => {
    const { props } = renderCard({ items });
    fireEvent.click(screen.getByRole("button", { name: "Dairy menu" }));
    expect(props.onSectionMenu).toHaveBeenCalledWith(LIST, "Dairy");
  });

  it("drops a held item under a header as one move into that section, with the neighbours dropOf names", () => {
    vi.useFakeTimers();
    stubLayout();
    const { props, container } = renderCard({ items });
    const list = container.querySelector("ul[data-column-body]") as HTMLElement;
    // Rows: Eggs(0) · Dairy header(1) · Milk(2) · Yoghurt(3). Lift Eggs, drop between Milk and Yoghurt.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Eggs" }), { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector("[data-lifted]")).toHaveAttribute("data-item", eggs.id);
    fireEvent.pointerMove(list, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    fireEvent.pointerUp(list, { clientX: 10, clientY: 2 * ROW_HEIGHT + 10 });
    expect(props.onMove).toHaveBeenCalledWith(eggs, { section: "Dairy", previousItemId: milk.id, nextItemId: yoghurt.id });
  });

  it("never lifts a header: a press on it arms nothing", () => {
    vi.useFakeTimers();
    stubLayout();
    const { props, container } = renderCard({ items });
    fireEvent.pointerDown(screen.getByText("Dairy"), { clientX: 10, clientY: ROW_HEIGHT + 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(container.querySelector("[data-lifted]")).toBeNull();
    const list = container.querySelector("ul[data-column-body]") as HTMLElement;
    fireEvent.pointerUp(list, { clientX: 10, clientY: 3 * ROW_HEIGHT + 10 });
    expect(props.onMove).not.toHaveBeenCalled();
  });

  it("tells the pager when a row is in hand, and again when it is set down", () => {
    vi.useFakeTimers();
    stubLayout();
    const onReorderActive = vi.fn();
    const { container } = renderCard({ items, onReorderActive });
    expect(onReorderActive).toHaveBeenLastCalledWith(false);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Eggs" }), { clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onReorderActive).toHaveBeenLastCalledWith(true);
    const list = container.querySelector("ul[data-column-body]") as HTMLElement;
    fireEvent.pointerUp(list, { clientX: 10, clientY: 10 });
    expect(onReorderActive).toHaveBeenLastCalledWith(false);
  });
});
