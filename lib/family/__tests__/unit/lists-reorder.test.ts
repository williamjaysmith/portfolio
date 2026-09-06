import { describe, expect, it } from "vitest";

import { groupedRowsOf, headerRowId, type CardRow } from "@/lib/family/lists/grouping";
import { dropOf, rowsInOrder, stepOf } from "@/lib/family/lists/reorder";
import type { ListItem } from "@/lib/family/types";

/**
 * 005 T018 — where a dropped item lands (R502; FR-523, FR-524, FR-532, FR-541):
 * the nearest header above decides the section, the nearest items above and
 * below decide the neighbours, headers are positions but never movers.
 */

function item(id: string, sortOrder: number, section: string | null = null): ListItem {
  return {
    id,
    householdId: "hh",
    listId: "list-1",
    text: id,
    section,
    checkedAt: null,
    checkedBy: null,
    sortOrder,
    createdBy: null,
    createdAt: "2026-09-05T10:00:00.000Z",
  };
}

/** Eggs, Milk · [Bakery] Bagels, Bread · [Dairy] Yoghurt, Butter */
const ITEMS = [
  item("eggs", 1000),
  item("milk", 2000),
  item("bagels", 3000, "Bakery"),
  item("bread", 4000, "Bakery"),
  item("yoghurt", 5000, "Dairy"),
  item("butter", 6000, "Dairy"),
];
const ROWS = groupedRowsOf(ITEMS);
const ids = (rows: readonly CardRow[]) => rows.map((row) => row.id);

/** The sequence after moving `movedId` to `toIndex` — what the machine's `move.order` names. */
function moved(rows: readonly CardRow[], movedId: string, toIndex: number): CardRow[] {
  const next = [...rows];
  const from = next.findIndex((row) => row.id === movedId);
  const [row] = next.splice(from, 1);
  next.splice(toIndex, 0, row);
  return next;
}

describe("rowsInOrder", () => {
  it("re-sequences the rows by the ids the machine hands back", () => {
    const order = [...ids(ROWS)].reverse();
    expect(ids(rowsInOrder(ROWS, order))).toEqual(order);
  });

  it("falls back to the given rows when the order names something else", () => {
    expect(rowsInOrder(ROWS, ["nope"])).toEqual(ROWS);
    expect(rowsInOrder(ROWS, ids(ROWS).slice(1))).toEqual(ROWS);
  });
});

describe("dropOf — section from the header above, neighbours from the items around (R502)", () => {
  it("to the very top: ungrouped, first, before Eggs", () => {
    expect(dropOf(moved(ROWS, "butter", 0), "butter")).toEqual({
      previousItemId: null,
      nextItemId: "eggs",
      section: null,
    });
  });

  it("to the very bottom: stays in the last section, after its last item", () => {
    expect(dropOf(moved(ROWS, "eggs", ROWS.length - 1), "eggs")).toEqual({
      previousItemId: "butter",
      nextItemId: null,
      section: "Dairy",
    });
  });

  it("just under a header: that section's first item, between the items around it", () => {
    // [eggs, milk, hdr Bakery, BREAD, bagels, hdr Dairy, yoghurt, butter] → bread is Bakery's first.
    const rows = moved(ROWS, "bread", 3);
    expect(dropOf(rows, "bread")).toEqual({ previousItemId: "milk", nextItemId: "bagels", section: "Bakery" });
    // An ungrouped item dropped just under Dairy joins Dairy.
    const dairyFirst = moved(ROWS, "eggs", 5);
    expect(ids(dairyFirst)).toEqual(["milk", headerRowId("Bakery"), "bagels", "bread", headerRowId("Dairy"), "eggs", "yoghurt", "butter"]);
    expect(dropOf(dairyFirst, "eggs")).toEqual({ previousItemId: "bread", nextItemId: "yoghurt", section: "Dairy" });
  });

  it("between two items of a section: stays in it", () => {
    // Move butter above yoghurt: [.., hdr Dairy, butter, yoghurt]
    const rows = moved(ROWS, "butter", 6);
    expect(dropOf(rows, "butter")).toEqual({ previousItemId: "bread", nextItemId: "yoghurt", section: "Dairy" });
  });

  it("between the last item of one section and the next header: stays in the section above", () => {
    // Move yoghurt to sit between bread and the Dairy header: [.., bagels, bread, YOGHURT, hdr Dairy, butter]
    const rows = moved(ROWS, "yoghurt", 4);
    expect(ids(rows)).toEqual(["eggs", "milk", headerRowId("Bakery"), "bagels", "yoghurt", "bread", headerRowId("Dairy"), "butter"]);
    expect(dropOf(rows, "yoghurt")).toEqual({ previousItemId: "bagels", nextItemId: "bread", section: "Bakery" });
    const rows2 = moved(ROWS, "yoghurt", 5);
    expect(ids(rows2)).toEqual(["eggs", "milk", headerRowId("Bakery"), "bagels", "bread", "yoghurt", headerRowId("Dairy"), "butter"]);
    expect(dropOf(rows2, "yoghurt")).toEqual({ previousItemId: "bread", nextItemId: "butter", section: "Bakery" });
  });

  it("out of a section into the ungrouped run: no section, ungrouped neighbours", () => {
    const rows = moved(ROWS, "bagels", 1);
    expect(dropOf(rows, "bagels")).toEqual({ previousItemId: "eggs", nextItemId: "milk", section: null });
  });

  it("the only item of a section moved out leaves the header behind to vanish on the next draw", () => {
    const only = groupedRowsOf([item("a", 1000), item("lone", 2000, "Solo"), item("b", 3000, "Other")]);
    const rows = moved(only, "lone", 0);
    expect(dropOf(rows, "lone")).toEqual({ previousItemId: null, nextItemId: "a", section: null });
    // The header row is still in this sequence; a re-draw from the stored items drops it.
    expect(ids(rows)).toContain(headerRowId("Solo"));
  });

  it("answers null for a header and for an id that is not in the sequence", () => {
    expect(dropOf(ROWS, headerRowId("Dairy"))).toBeNull();
    expect(dropOf(ROWS, "nope")).toBeNull();
  });

  it("dropping ON a header's position puts the item above that header", () => {
    // [eggs, BAGELS, milk, hdr Bakery, bread, ...]: bagels above the Bakery header is ungrouped.
    const rows = moved(ROWS, "bagels", 2);
    expect(ids(rows).slice(0, 4)).toEqual(["eggs", "milk", "bagels", headerRowId("Bakery")]);
    expect(dropOf(rows, "bagels")).toEqual({ previousItemId: "milk", nextItemId: "bread", section: null });
  });
});

describe("stepOf — the keyboard's one row up or down (FR-541)", () => {
  it("moves within the ungrouped run", () => {
    expect(stepOf(ROWS, "milk", -1)).toEqual({ previousItemId: null, nextItemId: "eggs", section: null });
  });

  it("steps over a header and thereby changes section", () => {
    // milk down one row lands under the Bakery header: Bakery's first item.
    expect(stepOf(ROWS, "milk", 1)).toEqual({ previousItemId: "eggs", nextItemId: "bagels", section: "Bakery" });
    // bagels up one row lands above the Bakery header: ungrouped, after milk.
    expect(stepOf(ROWS, "bagels", -1)).toEqual({ previousItemId: "milk", nextItemId: "bread", section: null });
  });

  it("answers null at either end and for a header", () => {
    expect(stepOf(ROWS, "eggs", -1)).toBeNull();
    expect(stepOf(ROWS, "butter", 1)).toBeNull();
    expect(stepOf(ROWS, headerRowId("Dairy"), 1)).toBeNull();
  });

  it("never mutates the rows it is given", () => {
    const snapshot = [...ROWS];
    stepOf(ROWS, "milk", 1);
    expect(ROWS).toEqual(snapshot);
  });
});
