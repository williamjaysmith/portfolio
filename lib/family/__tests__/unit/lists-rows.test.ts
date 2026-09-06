import { describe, expect, it } from "vitest";

import {
  LIST_COLUMNS,
  LIST_ITEM_COLUMNS,
  toList,
  toListItem,
  type ListItemRow,
  type ListRow,
} from "@/lib/family/rows";

/**
 * 005 T012 — the two mappers and their column lists (data-model §028). `numeric`
 * arrives from PostgREST as text, so `sort_order` is converted, not copied; every
 * other column is carried across by name, and nothing is read that is not named.
 */

const LIST: ListRow = {
  id: "list-1",
  household_id: "hh",
  name: "Grocery List",
  kind: "grocery",
  color: "#B6E085",
  parents_only: false,
  sort_order: "1000",
  created_by: "ana",
  updated_by: null,
  created_at: "2026-09-05T10:00:00.000Z",
  updated_at: "2026-09-05T10:05:00.000Z",
};

const ITEM: ListItemRow = {
  id: "item-1",
  household_id: "hh",
  list_id: "list-1",
  text: "🥚 Eggs",
  section: "Dairy",
  checked_at: "2026-09-05T12:00:00.000Z",
  checked_by: "ben",
  sort_order: "2500.5",
  created_by: "cleo",
  created_at: "2026-09-05T10:00:00.000Z",
};

describe("toList", () => {
  it("maps every column by name and converts the numeric sort order", () => {
    expect(toList(LIST)).toEqual({
      id: "list-1",
      householdId: "hh",
      name: "Grocery List",
      kind: "grocery",
      color: "#B6E085",
      parentsOnly: false,
      sortOrder: 1000,
      createdBy: "ana",
      updatedBy: null,
      createdAt: "2026-09-05T10:00:00.000Z",
      updatedAt: "2026-09-05T10:05:00.000Z",
    });
  });

  it("accepts a sort order that already arrived as a number", () => {
    expect(toList({ ...LIST, sort_order: 3000 }).sortOrder).toBe(3000);
  });
});

describe("toListItem", () => {
  it("maps every column by name, keeps the checked pair, converts the fractional sort order", () => {
    expect(toListItem(ITEM)).toEqual({
      id: "item-1",
      householdId: "hh",
      listId: "list-1",
      text: "🥚 Eggs",
      section: "Dairy",
      checkedAt: "2026-09-05T12:00:00.000Z",
      checkedBy: "ben",
      sortOrder: 2500.5,
      createdBy: "cleo",
      createdAt: "2026-09-05T10:00:00.000Z",
    });
  });

  it("carries an ungrouped, unchecked item's nulls through", () => {
    const plain = toListItem({ ...ITEM, section: null, checked_at: null, checked_by: null });
    expect(plain.section).toBeNull();
    expect(plain.checkedAt).toBeNull();
    expect(plain.checkedBy).toBeNull();
  });
});

describe("the column lists — the privacy contract's explicit selects", () => {
  it("name every column the mappers read, and nothing else", () => {
    const listColumns = LIST_COLUMNS.split(",").map((one) => one.trim());
    expect(listColumns).toEqual(Object.keys(LIST));
    const itemColumns = LIST_ITEM_COLUMNS.split(",").map((one) => one.trim());
    expect(itemColumns).toEqual(Object.keys(ITEM));
  });
});
