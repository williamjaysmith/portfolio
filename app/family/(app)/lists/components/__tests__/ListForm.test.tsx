import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { fail, ok } from "../../../components/__tests__/action-result";
import { stubDialog } from "../../../components/__tests__/family-test-utils";
import { ListForm } from "../ListForm";
import { listDraftOf } from "../useListForm";
import { GROCERY, PARTY, listOf } from "./lists-test-fixtures";

/**
 * 005 T030 — the list form (FR-509, FR-510, FR-511, FR-514): Name, List type as
 * three pills in the device's order, Colour, Parents only with its note; a
 * blank name refused locally with the form's words; the parsed input handed to
 * the caller's commit; an edit seeded from the stored list.
 */

const LISTS = [listOf({ id: GROCERY, name: "Grocery List" }), listOf({ id: PARTY, name: "Party", kind: "other", color: "#D5B6EC", parentsOnly: true })];

describe("ListForm", () => {
  beforeAll(stubDialog);

  it("draws the four fields in order — Name, List type, Colour, Parents only — with the notes", () => {
    render(<ListForm mode="create" lists={LISTS} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Add a list" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    const type = screen.getByRole("group", { name: "List type" });
    expect(within(type).getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "to_do",
      "grocery",
      "other",
    ]);
    expect(within(type).getByRole("radio", { name: "To do" })).toBeChecked();
    expect(screen.getByRole("radiogroup", { name: "Colour" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Parents only" })).not.toBeChecked();
    expect(screen.getByText("Shown only while a parent is punched in on the device.")).toBeInTheDocument();
  });

  it("refuses a blank name locally, in the form's words, sending nothing", async () => {
    const onSubmit = vi.fn();
    render(<ListForm mode="create" lists={LISTS} onSubmit={onSubmit} onClose={vi.fn()} />);
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("hands the parsed input to the commit and closes on success", async () => {
    const onSubmit = vi.fn().mockResolvedValue(ok(listOf({ id: "new", name: "Packing List" })));
    const onClose = vi.fn();
    render(<ListForm mode="create" lists={LISTS} onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "  Packing List " } });
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    fireEvent.click(screen.getByRole("switch", { name: "Parents only" }));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    });

    expect(onSubmit).toHaveBeenCalledWith({ name: "Packing List", kind: "other", color: "#B6E085", parentsOnly: true });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the server's refusal and stays open", async () => {
    const onSubmit = vi.fn().mockResolvedValue(fail("UNAVAILABLE"));
    const onClose = vi.fn();
    render(<ListForm mode="create" lists={LISTS} onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Packing" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the house right now.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("seeds an edit from the stored list and titles itself so", () => {
    const party = LISTS[1];
    render(
      <ListForm mode="edit" seed={listDraftOf(party)} lists={LISTS} excludeId={party.id} onSubmit={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("dialog", { name: "Edit list" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Party");
    expect(screen.getByRole("radio", { name: "Other" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Parents only" })).toBeChecked();
  });
});
