import { describe, expect, it } from "vitest";

import {
  groupedRowsOf,
  headerRowId,
  itemsInWords,
  matchSection,
  normaliseSectionName,
  sectionCountOf,
  sectionsOf,
  sortedItems,
  uncheckedCountOf,
} from "@/lib/family/lists/grouping";
import type { ListItem } from "@/lib/family/types";

/**
 * 005 T017 — the flat sequence a card draws (FR-530, R502), the badge and header
 * counts (FR-505), and the section-name match (FR-529). Everything here is
 * derived from the items: a section is a string some items share and nothing
 * else (R501).
 */

let n = 0;
function item(overrides: Partial<ListItem> = {}): ListItem {
  n += 1;
  return {
    id: `item-${String(n).padStart(2, "0")}`,
    householdId: "hh",
    listId: "list-1",
    text: `Item ${n}`,
    section: null,
    checkedAt: null,
    checkedBy: null,
    sortOrder: n * 1000,
    createdBy: null,
    createdAt: `2026-09-05T10:${String(n).padStart(2, "0")}:00.000Z`,
    ...overrides,
  };
}

const checked = "2026-09-05T12:00:00.000Z";

describe("normaliseSectionName / matchSection (FR-529)", () => {
  it("trims, and reads a blank as no section at all", () => {
    expect(normaliseSectionName("  Dairy ")).toBe("Dairy");
    expect(normaliseSectionName("   ")).toBeNull();
    expect(normaliseSectionName("")).toBeNull();
  });

  it("adopts the EXISTING spelling on a case-insensitive, trimmed match", () => {
    expect(matchSection(["Dairy", "Bakery"], " dairy ")).toBe("Dairy");
    expect(matchSection(["Dairy"], "DAIRY")).toBe("Dairy");
  });

  it("keeps the typed (trimmed) name when nothing matches, and null for a blank", () => {
    expect(matchSection(["Dairy"], " Fridge ")).toBe("Fridge");
    expect(matchSection(["Dairy"], "  ")).toBeNull();
    expect(matchSection([], "Pantry")).toBe("Pantry");
  });
});

describe("sortedItems — the one order every device draws (R502)", () => {
  it("orders by sortOrder, then by age, then by id, and never mutates its input", () => {
    const late = item({ sortOrder: 3000 });
    const early = item({ sortOrder: 1000 });
    const tieOlder = item({ sortOrder: 2000, createdAt: "2026-09-05T09:00:00.000Z", id: "b" });
    const tieNewer = item({ sortOrder: 2000, createdAt: "2026-09-05T09:30:00.000Z", id: "a" });
    const sameMoment = item({ sortOrder: 2000, createdAt: "2026-09-05T09:00:00.000Z", id: "a0" });
    const input = [late, tieNewer, early, tieOlder, sameMoment];
    const snapshot = [...input];

    expect(sortedItems(input).map((one) => one.id)).toEqual([
      early.id,
      sameMoment.id,
      tieOlder.id,
      tieNewer.id,
      late.id,
    ]);
    expect(input).toEqual(snapshot);
  });
});

describe("sectionsOf — ordered by their first item (spec Assumption 9)", () => {
  it("lists each section once, at the position of its first item", () => {
    const items = [
      item({ section: null, sortOrder: 1000 }),
      item({ section: "Dairy", sortOrder: 4000 }),
      item({ section: "Bakery", sortOrder: 2000 }),
      item({ section: "Dairy", sortOrder: 3000 }),
      item({ section: "Bakery", sortOrder: 5000 }),
    ];
    expect(sectionsOf(items)).toEqual(["Bakery", "Dairy"]);
  });

  it("is empty for a list with no sections, and for no items", () => {
    expect(sectionsOf([item(), item()])).toEqual([]);
    expect(sectionsOf([])).toEqual([]);
  });
});

describe("the counts (FR-505, FR-530)", () => {
  it("count unchecked items only — the badge, and each header", () => {
    const items = [
      item({ section: null }),
      item({ section: null, checkedAt: checked }),
      item({ section: "Dairy" }),
      item({ section: "Dairy", checkedAt: checked }),
      item({ section: "Dairy" }),
    ];
    expect(uncheckedCountOf(items)).toBe(3);
    expect(sectionCountOf(items, "Dairy")).toBe(2);
    expect(sectionCountOf(items, "Bakery")).toBe(0);
    expect(uncheckedCountOf([])).toBe(0);
  });
});

describe("groupedRowsOf — the flat sequence (FR-530, R502)", () => {
  it("draws nothing for no items", () => {
    expect(groupedRowsOf([])).toEqual([]);
  });

  it("draws an all-ungrouped list as its items in order, with no header", () => {
    const b = item({ sortOrder: 2000 });
    const a = item({ sortOrder: 1000 });
    expect(groupedRowsOf([b, a]).map((row) => row.id)).toEqual([a.id, b.id]);
    expect(groupedRowsOf([b, a]).every((row) => row.kind === "item")).toBe(true);
  });

  it("puts the ungrouped items first, then each section as a header over its items", () => {
    const eggs = item({ text: "Eggs", sortOrder: 1000 });
    const bagels = item({ text: "Bagels", section: "Bakery", sortOrder: 2000 });
    const milk = item({ text: "Milk", sortOrder: 3000 });
    const yoghurt = item({ text: "Yoghurt", section: "Dairy", sortOrder: 4000, checkedAt: checked });
    const bread = item({ text: "Bread", section: "Bakery", sortOrder: 5000 });
    const butter = item({ text: "Butter", section: "Dairy", sortOrder: 6000 });

    const rows = groupedRowsOf([butter, yoghurt, bread, milk, bagels, eggs]);

    expect(rows.map((row) => (row.kind === "item" ? row.item.text : `[${row.section} ${row.count}]`))).toEqual([
      "Eggs",
      "Milk",
      "[Bakery 2]",
      "Bagels",
      "Bread",
      "[Dairy 1]",
      "Yoghurt",
      "Butter",
    ]);
    expect(rows[2]).toEqual({ kind: "header", id: headerRowId("Bakery"), section: "Bakery", count: 2 });
  });

  it("orders two sections whose items interleave by their FIRST items", () => {
    const rows = groupedRowsOf([
      item({ section: "Zoo", sortOrder: 1000 }),
      item({ section: "Apple", sortOrder: 2000 }),
      item({ section: "Zoo", sortOrder: 3000 }),
    ]);
    expect(rows.filter((row) => row.kind === "header").map((row) => row.id)).toEqual([
      headerRowId("Zoo"),
      headerRowId("Apple"),
    ]);
  });

  it("keeps a section whose items are all checked, at count 0 — a section exists through its items", () => {
    const rows = groupedRowsOf([item({ section: "Dairy", checkedAt: checked })]);
    expect(rows[0]).toEqual({ kind: "header", id: headerRowId("Dairy"), section: "Dairy", count: 0 });
    expect(rows).toHaveLength(2);
  });

  it("gives a header an id no item can collide with", () => {
    expect(headerRowId("Dairy")).toBe("header:Dairy");
  });
});

describe("itemsInWords", () => {
  it("says 1 item, N items, and takes another noun", () => {
    expect(itemsInWords(1)).toBe("1 item");
    expect(itemsInWords(0)).toBe("0 items");
    expect(itemsInWords(3)).toBe("3 items");
    expect(itemsInWords(2, "completed item")).toBe("2 completed items");
  });
});
