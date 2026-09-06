import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ListMenu } from "../ListMenu";

/**
 * 005 T029 — the action sheet behind `•••` (R510): the caller's entries in
 * order, disabled and danger honoured, a selection closing the sheet and then
 * running the entry, the first entry focused, Escape closing.
 */

describe("ListMenu", () => {
  beforeAll(stubDialog);

  it("draws the entries in order, named by the list, first entry focused", () => {
    render(
      <ListMenu
        title="Grocery List"
        entries={[
          { label: "Add item", onSelect: vi.fn() },
          { label: "Edit list", onSelect: vi.fn() },
          { label: "Clear Completed", onSelect: vi.fn(), disabled: true },
          { label: "Delete list", onSelect: vi.fn(), danger: true },
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Grocery List" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual(["Add item", "Edit list", "Clear Completed", "Delete list", "Close"]);
    expect(screen.getByRole("button", { name: "Clear Completed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete list" })).toHaveClass("text-(--fam-danger)");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add item" }));
  });

  it("closes, then runs the chosen entry", () => {
    const calls: string[] = [];
    render(
      <ListMenu
        title="Grocery List"
        entries={[{ label: "Edit list", onSelect: () => calls.push("select") }]}
        onClose={() => calls.push("close")}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit list" }));
    expect(calls).toEqual(["close", "select"]);
  });

  it("closes from the Close button and from Escape", () => {
    const onClose = vi.fn();
    render(<ListMenu title="Grocery List" entries={[{ label: "Edit list", onSelect: vi.fn() }]} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
