import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListItemRow } from "../ListItemRow";
import { CHECKED_AT, GROCERY, itemOf } from "./lists-test-fixtures";

/**
 * 005 T033 — one line of a list (FR-517–FR-519, FR-522, FR-523): the text at the
 * left, a real checkbox named by the text at the right, the checked style, the
 * busy lock, and the lifted pointer.
 */

describe("ListItemRow", () => {
  it("draws the text and a checkbox named by it, unchecked", () => {
    const item = itemOf(GROCERY, "🥚 Eggs");
    render(
      <ul>
        <ListItemRow item={item} onToggle={vi.fn()} onOpen={vi.fn()} />
      </ul>,
    );
    const box = screen.getByRole("checkbox", { name: "🥚 Eggs" });
    expect(box).not.toBeChecked();
    expect(screen.getByRole("button", { name: "🥚 Eggs" })).not.toHaveClass("line-through");
    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("data-item-handle");
    expect(row).not.toHaveAttribute("data-checked");
  });

  it("checks: the box is checked, the text struck through and greyed, the row stays a row (FR-519)", () => {
    const item = itemOf(GROCERY, "Milk", { checkedAt: CHECKED_AT, checkedBy: "ben" });
    render(
      <ul>
        <ListItemRow item={item} onToggle={vi.fn()} onOpen={vi.fn()} />
      </ul>,
    );
    expect(screen.getByRole("checkbox", { name: "Milk" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Milk" })).toHaveClass("line-through");
    expect(screen.getByRole("listitem")).toHaveAttribute("data-checked", "true");
  });

  it("reports a toggle with the item and the new state, both ways", () => {
    const onToggle = vi.fn();
    const item = itemOf(GROCERY, "Bread");
    const { rerender } = render(
      <ul>
        <ListItemRow item={item} onToggle={onToggle} onOpen={vi.fn()} />
      </ul>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Bread" }));
    expect(onToggle).toHaveBeenLastCalledWith(item, true);

    const checked = { ...item, checkedAt: CHECKED_AT };
    rerender(
      <ul>
        <ListItemRow item={checked} onToggle={onToggle} onOpen={vi.fn()} />
      </ul>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Bread" }));
    expect(onToggle).toHaveBeenLastCalledWith(checked, false);
  });

  it("opens the item's sheet from its text (FR-522)", () => {
    const onOpen = vi.fn();
    const item = itemOf(GROCERY, "Kosher salt");
    render(
      <ul>
        <ListItemRow item={item} onToggle={vi.fn()} onOpen={onOpen} />
      </ul>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kosher salt" }));
    expect(onOpen).toHaveBeenCalledWith(item);
  });

  it("locks the checkbox while its write is in flight (FR-537)", () => {
    render(
      <ul>
        <ListItemRow item={itemOf(GROCERY, "Coffee")} busy onToggle={vi.fn()} onOpen={vi.fn()} />
      </ul>,
    );
    const box = screen.getByRole("checkbox", { name: "Coffee" });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("aria-busy", "true");
  });

  it("draws the reference's small pointer to its left only while lifted (FR-523)", () => {
    const item = itemOf(GROCERY, "Bagels");
    const { container, rerender } = render(
      <ul>
        <ListItemRow item={item} onToggle={vi.fn()} onOpen={vi.fn()} />
      </ul>,
    );
    expect(container.querySelector("[data-lift-pointer]")).toBeNull();
    rerender(
      <ul>
        <ListItemRow item={item} lifted onToggle={vi.fn()} onOpen={vi.fn()} />
      </ul>,
    );
    expect(container.querySelector("[data-lift-pointer]")).not.toBeNull();
    expect(screen.getByRole("listitem")).toHaveAttribute("data-lifted", "true");
  });
});
