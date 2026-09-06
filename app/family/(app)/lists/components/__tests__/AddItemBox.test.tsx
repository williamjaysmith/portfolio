import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fail, ok } from "../../../components/__tests__/action-result";
import { AddItemBox } from "../AddItemBox";
import { GROCERY, itemOf } from "./lists-test-fixtures";

/**
 * 005 T034 — the "Add item" box (FR-516, FR-537): Enter submits the trimmed
 * text; the field is disabled while its write is pending and cleared on
 * success with focus kept; a refusal keeps the text and shows the notice
 * beside the box; a blank or over-long text is refused locally and never sent.
 */

function typeAndSubmit(text: string): void {
  const input = screen.getByRole("textbox", { name: "Add item to Grocery List" });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("AddItemBox", () => {
  it("submits the trimmed text on Enter, then clears and keeps focus", async () => {
    const onAdd = vi.fn().mockResolvedValue(ok(itemOf(GROCERY, "Coffee")));
    render(<AddItemBox listName="Grocery List" pending={false} onAdd={onAdd} />);
    const input = screen.getByRole("textbox", { name: "Add item to Grocery List" });
    input.focus();

    await act(async () => {
      typeAndSubmit("  Coffee ");
    });

    expect(onAdd).toHaveBeenCalledWith("Coffee");
    expect(input).toHaveValue("");
    expect(document.activeElement).toBe(input);
  });

  it("keeps the text and shows the refusal beside the box (FR-537)", async () => {
    const onAdd = vi.fn().mockResolvedValue(fail("UNAVAILABLE"));
    render(<AddItemBox listName="Grocery List" pending={false} onAdd={onAdd} />);

    await act(async () => {
      typeAndSubmit("Coffee");
    });

    expect(screen.getByRole("textbox", { name: "Add item to Grocery List" })).toHaveValue("Coffee");
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the house right now.");
  });

  it("says nothing when the punch-in was dismissed (null), and keeps the text for the next try", async () => {
    const onAdd = vi.fn().mockResolvedValue(null);
    render(<AddItemBox listName="Grocery List" pending={false} onAdd={onAdd} />);

    await act(async () => {
      typeAndSubmit("Coffee");
    });

    expect(screen.getByRole("textbox", { name: "Add item to Grocery List" })).toHaveValue("Coffee");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refuses a blank or a 201-character text locally, sending nothing", async () => {
    const onAdd = vi.fn();
    render(<AddItemBox listName="Grocery List" pending={false} onAdd={onAdd} />);

    await act(async () => {
      typeAndSubmit("   ");
    });
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("An item is 1 to 200 characters.");

    await act(async () => {
      typeAndSubmit("x".repeat(201));
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("is disabled, and sends nothing, while the card's add is pending", async () => {
    const onAdd = vi.fn();
    render(<AddItemBox listName="Grocery List" pending onAdd={onAdd} />);
    const input = screen.getByRole("textbox", { name: "Add item to Grocery List" });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("hands its input to the registry, so the menu's Add item can focus it", () => {
    const inputRef = vi.fn();
    render(<AddItemBox listName="Grocery List" pending={false} onAdd={vi.fn()} inputRef={inputRef} />);
    expect(inputRef).toHaveBeenCalledWith(screen.getByRole("textbox", { name: "Add item to Grocery List" }));
  });
});
