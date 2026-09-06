import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createList, deleteList, setListItemChecked, updateList } from "@/lib/family/actions/lists";
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
