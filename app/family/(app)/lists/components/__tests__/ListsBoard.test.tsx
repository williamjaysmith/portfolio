import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  createList,
  deleteList,
  moveListItem,
  removeSection,
  renameSection,
  sectionItems,
  setListItemChecked,
  updateList,
  updateListItem,
} from "@/lib/family/actions/lists";
import { fail } from "@/lib/family/errors";
import { useListItems, useLists } from "@/lib/family/queries";
import type { List, ListItem } from "@/lib/family/types";

import { FabActionProvider, useFabAction } from "../../../components/FabAction";
import type { FamilyContextValue } from "../../../components/FamilyProvider";
import { showsChipRow } from "../../../components/nav";
import {
  makeActor,
  makeContext,
  stubDialog,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { ok } from "../../../components/__tests__/action-result";
import { ListsBoard } from "../ListsBoard";
import { resetListFilters, useListFilters } from "../useListFilters";
import { resetListFolds } from "../useListFolds";
import { CHECKED_AT, GROCERY, PARTY, TODO, itemOf, listOf } from "./lists-test-fixtures";

/**
 * 005 T024 / T046 — the Lists tab's chassis and its list-level writes (FR-501,
 * FR-502, FR-506–FR-508, FR-511, FR-512, FR-514, FR-521): one card per visible
 * list in the household's order, the empty state, the shell's control named
 * "Add List", the read error as the one line, the create form from the control
 * and the edit form from the header, the menu's Delete list through the
 * confirmation to the action with `confirm: true`, Clear Completed likewise, a
 * `NOT_FOUND` closing the surface with the gone message — and Parents only lists
 * absent for nobody and a member, present for a parent, a surface on one
 * closing when the actor leaves (R505).
 */

vi.mock("@/lib/family/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/family/queries")>();
  return { ...actual, useLists: vi.fn(), useListItems: vi.fn() };
});

vi.mock("@/lib/family/actions/lists", () => ({
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
  addListItem: vi.fn(),
  updateListItem: vi.fn(),
  setListItemChecked: vi.fn(),
  moveListItem: vi.fn(),
  deleteListItem: vi.fn(),
  clearCompletedItems: vi.fn(),
  sectionItems: vi.fn(),
  renameSection: vi.fn(),
  removeSection: vi.fn(),
}));

const useListsMock = useLists as Mock;
const useListItemsMock = useListItems as Mock;
const createMock = createList as Mock;
const updateMock = updateList as Mock;
const deleteMock = deleteList as Mock;
const checkMock = setListItemChecked as Mock;

const LISTS: List[] = [
  listOf({ id: GROCERY, name: "Grocery List", sortOrder: 1000 }),
  listOf({ id: TODO, name: "To-Do List", kind: "to_do", color: "#A8D4D3", sortOrder: 2000 }),
  listOf({ id: PARTY, name: "Party", kind: "other", color: "#D5B6EC", parentsOnly: true, sortOrder: 3000 }),
];

const ITEMS: ListItem[] = [
  itemOf(GROCERY, "Eggs", { sortOrder: 1000 }),
  itemOf(GROCERY, "Milk", { sortOrder: 2000, checkedAt: CHECKED_AT }),
  itemOf(TODO, "Stop mail", { sortOrder: 1000 }),
  itemOf(PARTY, "Cake", { sortOrder: 1000 }),
];

function reads(lists: List[] = LISTS, items: ListItem[] = ITEMS, error: Error | null = null): void {
  useListsMock.mockReturnValue({ data: lists, error });
  useListItemsMock.mockReturnValue({ data: items, error: null });
}

/** The shell's control, as the shell reads it. */
function FabProbe() {
  const action = useFabAction();
  return action === null ? null : (
    <button type="button" onClick={action.run}>
      {action.label}
    </button>
  );
}

function renderBoard(context: Partial<FamilyContextValue> = {}) {
  const value = makeContext({ actor: makeActor("parent"), ...context });
  const view = render(
    withFamily(
      value,
      <FabActionProvider>
        <FabProbe />
        <ListsBoard initialLists={LISTS} initialItems={ITEMS} />
      </FabActionProvider>,
    ),
  );
  return { ...view, value };
}

const cardNames = () => screen.getAllByRole("region").map((card) => card.getAttribute("aria-label"));

describe("ListsBoard", () => {
  beforeAll(stubDialog);

  beforeEach(() => {
    vi.clearAllMocks();
    resetListFilters();
    reads();
  });

  it("draws one card per list in the household's order, and no chip row on this route (FR-502, FR-506)", () => {
    renderBoard();
    expect(cardNames()).toEqual(["Grocery List", "To-Do List", "Party"]);
    expect(showsChipRow("/family/lists")).toBe(false);
  });

  it("hands every card its own items — the rows, the badge (FR-505)", () => {
    renderBoard();
    const grocery = screen.getByRole("region", { name: "Grocery List" });
    expect(within(grocery).getByRole("img", { name: "1 to do" })).toBeInTheDocument();
    expect(within(grocery).getByRole("checkbox", { name: "Milk" })).toBeChecked();
    const todo = screen.getByRole("region", { name: "To-Do List" });
    expect(within(todo).getByRole("checkbox", { name: "Stop mail" })).toBeInTheDocument();
    expect(within(todo).queryByRole("checkbox", { name: "Eggs" })).toBeNull();
  });

  it("hides checked items on this device when the Completed switch is off, without moving the badge (FR-520)", () => {
    function SwitchProbe() {
      const { setFilter } = useListFilters();
      return (
        <button type="button" onClick={() => setFilter("completed", false)}>
          hide completed
        </button>
      );
    }
    const value = makeContext({ actor: makeActor("parent") });
    render(
      withFamily(
        value,
        <FabActionProvider>
          <SwitchProbe />
          <ListsBoard initialLists={LISTS} initialItems={ITEMS} />
        </FabActionProvider>,
      ),
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "hide completed" }));
    });
    const grocery = screen.getByRole("region", { name: "Grocery List" });
    expect(within(grocery).queryByRole("checkbox", { name: "Milk" })).toBeNull();
    expect(within(grocery).getByRole("img", { name: "1 to do" })).toBeInTheDocument();
  });

  it("names the shell's control Add List and opens the create form from it, committing through the action (FR-507)", async () => {
    createMock.mockResolvedValue(ok(listOf({ id: "new", name: "Packing List" })));
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Add List" }));
    const form = screen.getByRole("dialog", { name: "Add a list" });
    fireEvent.change(within(form).getByRole("textbox", { name: "Name" }), { target: { value: "Packing List" } });
    await act(async () => {
      fireEvent.submit(within(form).getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    });
    expect(createMock).toHaveBeenCalledWith({ name: "Packing List", kind: "to_do", color: "#B6E085", parentsOnly: false });
    expect(screen.queryByRole("dialog", { name: "Add a list" })).toBeNull();
  });

  it("opens the edit form from the card's name and sends the merged patch; a NOT_FOUND says the list is gone (FR-511)", async () => {
    updateMock.mockResolvedValue(fail("NOT_FOUND"));
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Grocery List" }));
    const form = screen.getByRole("dialog", { name: "Edit list" });
    expect(within(form).getByRole("textbox", { name: "Name" })).toHaveValue("Grocery List");
    await act(async () => {
      fireEvent.submit(within(form).getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    });
    expect(updateMock).toHaveBeenCalledWith({
      id: GROCERY,
      patch: { name: "Grocery List", kind: "grocery", color: "#B6E085", parentsOnly: false },
    });
    expect(screen.queryByRole("dialog", { name: "Edit list" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("That list is no longer here.");
  });

  it("deletes from the menu through a confirmation that names the item count (FR-512)", async () => {
    deleteMock.mockResolvedValue(ok(null));
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Grocery List menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
    const confirm = screen.getByRole("alertdialog", { name: "Delete “Grocery List” and its 2 items?" });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole("button", { name: "Delete for good" }));
    });
    expect(deleteMock).toHaveBeenCalledWith({ id: GROCERY, confirm: true });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("offers Clear Completed with the count, disabled at zero, and confirms with the count (FR-521)", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "To-Do List menu" }));
    expect(screen.getByRole("button", { name: "Clear Completed" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Grocery List menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Completed (1)" }));
    expect(screen.getByRole("alertdialog", { name: "Clear 1 completed item from Grocery List?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear 1 item" })).toBeInTheDocument();
  });

  it("ticks through the item queue: the action is called with the state, never a toggle", async () => {
    checkMock.mockResolvedValue(ok(ITEMS[0]));
    renderBoard();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Eggs" }));
    });
    expect(checkMock).toHaveBeenCalledWith({ id: ITEMS[0].id, checked: true });
  });

  it("shows the empty state when there is no visible list, and never a word about hidden ones (FR-508)", () => {
    reads([LISTS[2]], [ITEMS[3]]);
    renderBoard({ actor: null });
    expect(screen.getByText("No lists yet")).toBeInTheDocument();
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByText("Party")).toBeNull();
  });

  it("says the reads failed, once, in the household's words", () => {
    reads(LISTS, ITEMS, new Error("boom"));
    renderBoard();
    expect(screen.getByRole("alert")).toHaveTextContent("Lists could not be loaded.");
  });

  describe("Parents only (FR-514, FR-535, R505)", () => {
    it("is absent for nobody and for a member, present for a parent, in its place", () => {
      const { unmount } = renderBoard({ actor: null });
      expect(cardNames()).toEqual(["Grocery List", "To-Do List"]);
      unmount();

      const member = renderBoard({ actor: makeActor("member") });
      expect(cardNames()).toEqual(["Grocery List", "To-Do List"]);
      member.unmount();

      renderBoard({ actor: makeActor("parent") });
      expect(cardNames()).toEqual(["Grocery List", "To-Do List", "Party"]);
    });

    it("closes a surface open on a Parents only list, silently, when the parent's punch-in ends", () => {
      const parent = makeContext({ actor: makeActor("parent") });
      const { rerender } = render(
        withFamily(
          parent,
          <FabActionProvider>
            <ListsBoard initialLists={LISTS} initialItems={ITEMS} />
          </FabActionProvider>,
        ),
      );
      fireEvent.click(screen.getByRole("button", { name: "Party menu" }));
      expect(screen.getByRole("dialog", { name: "Party" })).toBeInTheDocument();

      rerender(
        withFamily(
          makeContext({ actor: null }),
          <FabActionProvider>
            <ListsBoard initialLists={LISTS} initialItems={ITEMS} />
          </FabActionProvider>,
        ),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(cardNames()).toEqual(["Grocery List", "To-Do List"]);
    });
  });
});

/**
 * 005 T037 / T043 — the item sheet and the section surfaces wired to the
 * queue (FR-522, FR-528, FR-529, FR-533, FR-541): the sheet from an item's
 * text, Save as one `updateListItem`, Move down as one `moveListItem` with the
 * neighbours `stepOf` names, Delete as one `deleteListItem`; Add section from
 * the footer to `sectionItems`; the header's menu to Rename (`renameSection`)
 * and to Remove through a confirmation that says the items stay.
 */
describe("ListsBoard — the item sheet and the sections", () => {
  beforeAll(stubDialog);

  const butter = itemOf(GROCERY, "Butter", { sortOrder: 3000, section: "Dairy" });
  const eggs = ITEMS[0];

  beforeEach(() => {
    vi.clearAllMocks();
    resetListFilters();
    resetListFolds();
    reads(LISTS, [...ITEMS, butter]);
    (updateListItem as Mock).mockResolvedValue(ok(eggs));
    (moveListItem as Mock).mockResolvedValue(ok(eggs));
    (sectionItems as Mock).mockResolvedValue(ok({ section: "Dairy", moved: 1 }));
    (renameSection as Mock).mockResolvedValue(ok({ section: "Fridge", renamed: 1 }));
    (removeSection as Mock).mockResolvedValue(ok({ ungrouped: 1 }));
  });

  it("opens the sheet from the item's text and saves the corrected text as one write (FR-522)", async () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Eggs" }));
    const sheet = screen.getByRole("dialog", { hidden: true });
    expect(within(sheet).getByRole("heading", { name: "Eggs" })).toBeInTheDocument();
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Item" }), { target: { value: "Eggs x12" } });
    fireEvent.submit(within(sheet).getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() => expect(updateListItem).toHaveBeenCalledWith({ id: eggs.id, patch: { text: "Eggs x12" } }));
  });

  it("moves one row down from the sheet as the move stepOf names, with Move up disabled at the top (FR-541)", async () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Eggs" }));
    expect(screen.getByRole("button", { name: "Move up" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move down" }));
    // Rows: Eggs · Dairy header · Butter · Milk (checked items sink, R503) — one step down puts
    // Eggs under the header, ahead of Butter: a move INTO Dairy.
    await vi.waitFor(() =>
      expect(moveListItem).toHaveBeenCalledWith({ id: eggs.id, section: "Dairy", previousItemId: null, nextItemId: butter.id }),
    );
  });

  it("begins Add section from the footer and commits the name and the chosen items (FR-528)", async () => {
    renderBoard();
    const grocery = screen.getByRole("region", { name: "Grocery List" });
    fireEvent.click(within(grocery).getByRole("button", { name: /Add section/ }));
    const sheet = screen.getByRole("dialog", { hidden: true });
    expect(within(sheet).getByRole("heading", { name: "Add a section to Grocery List" })).toBeInTheDocument();
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Section name" }), { target: { value: "Breakfast" } });
    fireEvent.click(within(sheet).getByRole("checkbox", { name: /Eggs/ }));
    fireEvent.submit(within(sheet).getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() =>
      expect(sectionItems).toHaveBeenCalledWith({ listId: GROCERY, name: "Breakfast", itemIds: [eggs.id] }),
    );
  });

  it("renames a section from the header's menu (FR-533)", async () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Dairy menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename section" }));
    const sheet = screen.getByRole("dialog", { hidden: true });
    expect(within(sheet).getByRole("textbox", { name: "Section name" })).toHaveValue("Dairy");
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Section name" }), { target: { value: "Fridge" } });
    fireEvent.submit(within(sheet).getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);
    await vi.waitFor(() => expect(renameSection).toHaveBeenCalledWith({ listId: GROCERY, from: "Dairy", to: "Fridge" }));
  });

  it("removes a section through a confirmation that says its items stay (FR-533)", async () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Dairy menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove section" }));
    expect(screen.getByRole("alertdialog", { hidden: true })).toHaveTextContent("Remove “Dairy”?");
    expect(screen.getByRole("alertdialog", { hidden: true })).toHaveTextContent("Its 1 item stay on the list.");
    fireEvent.click(screen.getByRole("button", { name: "Remove section" }));
    await vi.waitFor(() => expect(removeSection).toHaveBeenCalledWith({ listId: GROCERY, name: "Dairy" }));
  });

  it("folds a section on this device from the header's chevron, keeping the header (FR-531)", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Fold Dairy" }));
    expect(screen.queryByRole("checkbox", { name: "Butter" })).toBeNull();
    expect(screen.getByRole("button", { name: "Unfold Dairy" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("family:list-folds:v1") ?? "[]")).toEqual([`${GROCERY} Dairy`]);
  });
});
