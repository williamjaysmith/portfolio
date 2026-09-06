import { describe, expect, it } from "vitest";

import { uncheckedCountOf } from "@/lib/family/lists/grouping";
import { itemsShownOf, visibleListsOf } from "@/lib/family/lists/visibility";
import type { List, ListItem } from "@/lib/family/types";

/**
 * 005 T019 — the two display rules (R505, R509): Parents only lists by role
 * (FR-514, FR-535), checked items by the device's Completed switch (FR-520),
 * and the badge that neither rule can move (FR-505).
 */

function list(id: string, parentsOnly: boolean): List {
  return {
    id,
    householdId: "hh",
    name: id,
    kind: "other",
    color: "#B6E085",
    parentsOnly,
    sortOrder: 1000,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  };
}

function item(id: string, checked: boolean): ListItem {
  return {
    id,
    householdId: "hh",
    listId: "list-1",
    text: id,
    section: null,
    checkedAt: checked ? "2026-09-05T12:00:00.000Z" : null,
    checkedBy: null,
    sortOrder: 1000,
    createdBy: null,
    createdAt: "2026-09-05T10:00:00.000Z",
  };
}

const LISTS = [list("grocery", false), list("party", true), list("todo", false)];

describe("visibleListsOf (FR-514, R505)", () => {
  it("shows every list, in order, to a punched-in parent", () => {
    expect(visibleListsOf(LISTS, { role: "parent" }).map((one) => one.id)).toEqual(["grocery", "party", "todo"]);
  });

  it("hides Parents only lists from a member and from nobody, keeping the order", () => {
    expect(visibleListsOf(LISTS, { role: "member" }).map((one) => one.id)).toEqual(["grocery", "todo"]);
    expect(visibleListsOf(LISTS, null).map((one) => one.id)).toEqual(["grocery", "todo"]);
  });

  it("returns a new array and leaves the input alone", () => {
    const shown = visibleListsOf(LISTS, { role: "parent" });
    expect(shown).not.toBe(LISTS);
    expect(LISTS).toHaveLength(3);
  });
});

describe("itemsShownOf (FR-520)", () => {
  const items = [item("a", false), item("b", true), item("c", false)];

  it("shows everything while the Completed switch is on", () => {
    expect(itemsShownOf(items, { completed: true }).map((one) => one.id)).toEqual(["a", "b", "c"]);
  });

  it("drops checked items, and nothing else, while it is off", () => {
    expect(itemsShownOf(items, { completed: false }).map((one) => one.id)).toEqual(["a", "c"]);
  });

  it("never moves the badge: the unchecked count is the same either way (FR-505)", () => {
    expect(uncheckedCountOf(itemsShownOf(items, { completed: false }))).toBe(uncheckedCountOf(items));
  });
});
