import { describe, expect, it } from "vitest";

import { ActionFailure } from "@/lib/family/errors";
import type { List } from "@/lib/family/types";
import {
  addListItemSchema,
  clearCompletedSchema,
  deleteListItemSchema,
  deleteListSchema,
  listInputSchema,
  listItemTextSchema,
  listKindSchema,
  moveListItemSchema,
  parseOrThrow,
  removeSectionSchema,
  renameSectionSchema,
  sectionItemsSchema,
  sectionNameSchema,
  setListItemCheckedSchema,
  updateListItemSchema,
  updateListSchema,
  validateListPatch,
} from "@/lib/family/validation";

/**
 * 005 T013 — every action input's first line (contracts §Shared input shapes):
 * the bounds 028 also carries, the three kinds, the palette, unknown keys
 * refused not stripped, `confirm: true` as a literal, and the merged-patch
 * discipline for `updateList`.
 */

const LIST_ID = "00000000-0000-4000-8000-0000000000aa";
const ITEM_ID = "00000000-0000-4000-8000-0000000000bb";
const OTHER_ID = "00000000-0000-4000-8000-0000000000cc";

type Draft = Record<string, unknown>;

function listDraft(overrides: Draft = {}): Draft {
  return { name: "Grocery List", kind: "grocery", color: "#B6E085", parentsOnly: false, ...overrides };
}

function refusalOf<S extends Parameters<typeof parseOrThrow>[0]>(schema: S, input: unknown): ActionFailure {
  try {
    parseOrThrow(schema, input);
  } catch (error) {
    if (error instanceof ActionFailure) return error;
    throw error;
  }
  throw new Error("expected a VALIDATION refusal, got a parse");
}

function refusedFields<S extends Parameters<typeof parseOrThrow>[0]>(schema: S, input: unknown): string[] {
  return Object.keys(refusalOf(schema, input).fieldErrors ?? {});
}

function accepts<S extends Parameters<typeof parseOrThrow>[0]>(schema: S, input: unknown): boolean {
  return schema.safeParse(input).success;
}

describe("listInputSchema (FR-509, FR-510, FR-514)", () => {
  it("accepts the three fields plus the switch, trimming the name and normalising the colour", () => {
    const parsed = parseOrThrow(listInputSchema, listDraft({ name: "  Packing List ", color: "#fba994" }));
    expect(parsed).toEqual({ name: "Packing List", kind: "grocery", color: "#FBA994", parentsOnly: false });
  });

  it.each(["to_do", "grocery", "other"])("accepts kind %s", (kind) => {
    expect(accepts(listInputSchema, listDraft({ kind }))).toBe(true);
    expect(listKindSchema.parse(kind)).toBe(kind);
  });

  it("names the three kinds in the device's order — what the form's pills draw", () => {
    expect(listKindSchema.options).toEqual(["to_do", "grocery", "other"]);
  });

  it("refuses the API's own kind word and anything else", () => {
    expect(refusedFields(listInputSchema, listDraft({ kind: "shopping" }))).toEqual(["kind"]);
    expect(refusalOf(listInputSchema, listDraft({ kind: "shopping" })).message).toBe("Choose To do, Grocery or Other.");
  });

  it("refuses a blank or 121-character name with the form's words", () => {
    expect(refusalOf(listInputSchema, listDraft({ name: "   " })).message).toBe("Name is required.");
    expect(refusalOf(listInputSchema, listDraft({ name: "x".repeat(121) })).message).toBe("Keep it under 120 characters.");
    expect(accepts(listInputSchema, listDraft({ name: "y".repeat(120) }))).toBe(true);
  });

  it("takes only a palette colour", () => {
    expect(refusedFields(listInputSchema, listDraft({ color: "#123456" }))).toEqual(["color"]);
    expect(refusedFields(listInputSchema, listDraft({ color: "green" }))).toEqual(["color"]);
  });

  it("wants the switch as a boolean, and refuses a missing one", () => {
    expect(refusedFields(listInputSchema, listDraft({ parentsOnly: "yes" }))).toEqual(["parentsOnly"]);
    const withoutSwitch: Draft = listDraft();
    delete withoutSwitch.parentsOnly;
    expect(refusedFields(listInputSchema, withoutSwitch)).toEqual(["parentsOnly"]);
  });

  it("refuses an invented key rather than stripping it", () => {
    expect(accepts(listInputSchema, listDraft({ count: 5 }))).toBe(false);
    expect(accepts(listInputSchema, listDraft({ sortOrder: 1000 }))).toBe(false);
  });
});

describe("updateListSchema / validateListPatch (contracts §updateList)", () => {
  const existing: List = {
    id: LIST_ID,
    householdId: "hh",
    name: "Grocery List",
    kind: "grocery",
    color: "#B6E085",
    parentsOnly: false,
    sortOrder: 1000,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  };

  it("carries an id and a bare-keyed patch, and nothing else", () => {
    expect(accepts(updateListSchema, { id: LIST_ID, patch: { name: "Shopping" } })).toBe(true);
    expect(accepts(updateListSchema, { id: "nope", patch: {} })).toBe(false);
    expect(accepts(updateListSchema, { id: LIST_ID, patch: {}, extra: 1 })).toBe(false);
  });

  it("judges the MERGED list: a partial patch keeps the rest, a bad field lands against itself", () => {
    expect(validateListPatch(existing, { parentsOnly: true })).toEqual({
      name: "Grocery List",
      kind: "grocery",
      color: "#B6E085",
      parentsOnly: true,
    });
    const refusal = (() => {
      try {
        validateListPatch(existing, { kind: "shopping" });
      } catch (error) {
        return error as ActionFailure;
      }
      throw new Error("expected a refusal");
    })();
    expect(refusal.code).toBe("VALIDATION");
    expect(Object.keys(refusal.fieldErrors ?? {})).toEqual(["kind"]);
  });
});

describe("deleteListSchema / clearCompletedSchema — the confirmations (FR-512, FR-521)", () => {
  it("need a literal true, so a missing flag is a refusal and not a default", () => {
    expect(accepts(deleteListSchema, { id: LIST_ID, confirm: true })).toBe(true);
    expect(accepts(deleteListSchema, { id: LIST_ID })).toBe(false);
    expect(accepts(deleteListSchema, { id: LIST_ID, confirm: false })).toBe(false);
    expect(accepts(clearCompletedSchema, { listId: LIST_ID, confirm: true })).toBe(true);
    expect(accepts(clearCompletedSchema, { listId: LIST_ID, confirm: "yes" })).toBe(false);
  });
});

describe("listItemTextSchema / sectionNameSchema (FR-517, FR-528)", () => {
  it("bounds an item's text at 1–200, trimmed, with one message", () => {
    expect(parseOrThrow(listItemTextSchema, "  🥚 Eggs ")).toBe("🥚 Eggs");
    expect(refusalOf(listItemTextSchema, "   ").message).toBe("An item is 1 to 200 characters.");
    expect(refusalOf(listItemTextSchema, "x".repeat(201)).message).toBe("An item is 1 to 200 characters.");
    expect(accepts(listItemTextSchema, "y".repeat(200))).toBe(true);
  });

  it("bounds a section name at 1–60, trimmed", () => {
    expect(parseOrThrow(sectionNameSchema, " Dairy ")).toBe("Dairy");
    expect(refusalOf(sectionNameSchema, "").message).toBe("A section name is 1 to 60 characters.");
    expect(accepts(sectionNameSchema, "s".repeat(61))).toBe(false);
  });
});

describe("the item actions' shapes", () => {
  it("addListItem: a list and a text", () => {
    expect(accepts(addListItemSchema, { listId: LIST_ID, text: "Milk" })).toBe(true);
    expect(refusedFields(addListItemSchema, { listId: LIST_ID, text: "" })).toEqual(["text"]);
    expect(accepts(addListItemSchema, { listId: LIST_ID, text: "Milk", section: "Dairy" })).toBe(false);
  });

  it("updateListItem: text, section (a name or null) or both — never nothing, never an invented key", () => {
    expect(accepts(updateListItemSchema, { id: ITEM_ID, patch: { text: "Oat milk" } })).toBe(true);
    expect(accepts(updateListItemSchema, { id: ITEM_ID, patch: { section: null } })).toBe(true);
    expect(accepts(updateListItemSchema, { id: ITEM_ID, patch: { section: "Dairy", text: "Milk" } })).toBe(true);
    expect(accepts(updateListItemSchema, { id: ITEM_ID, patch: {} })).toBe(false);
    expect(accepts(updateListItemSchema, { id: ITEM_ID, patch: { checkedAt: "now" } })).toBe(false);
  });

  it("setListItemChecked: a boolean, both ways", () => {
    expect(accepts(setListItemCheckedSchema, { id: ITEM_ID, checked: true })).toBe(true);
    expect(accepts(setListItemCheckedSchema, { id: ITEM_ID, checked: false })).toBe(true);
    expect(refusedFields(setListItemCheckedSchema, { id: ITEM_ID, checked: "yes" })).toEqual(["checked"]);
  });

  it("moveListItem: the two neighbours (nullable) and the section (nullable), as dropOf computes them", () => {
    expect(
      accepts(moveListItemSchema, { id: ITEM_ID, previousItemId: OTHER_ID, nextItemId: null, section: "Dairy" }),
    ).toBe(true);
    expect(accepts(moveListItemSchema, { id: ITEM_ID, previousItemId: null, nextItemId: null, section: null })).toBe(true);
    expect(accepts(moveListItemSchema, { id: ITEM_ID, previousItemId: OTHER_ID, nextItemId: null })).toBe(false);
    expect(accepts(moveListItemSchema, { id: ITEM_ID, previousItemId: "x", nextItemId: null, section: null })).toBe(false);
  });

  it("deleteListItem: just the id", () => {
    expect(accepts(deleteListItemSchema, { id: ITEM_ID })).toBe(true);
    expect(accepts(deleteListItemSchema, { id: ITEM_ID, confirm: true })).toBe(false);
  });
});

describe("the section actions' shapes (FR-528, FR-533)", () => {
  it("sectionItems: a name and at least one item, each once", () => {
    expect(accepts(sectionItemsSchema, { listId: LIST_ID, name: "Dairy", itemIds: [ITEM_ID] })).toBe(true);
    expect(refusalOf(sectionItemsSchema, { listId: LIST_ID, name: "Dairy", itemIds: [] }).message).toBe(
      "Choose at least one item.",
    );
    expect(refusedFields(sectionItemsSchema, { listId: LIST_ID, name: "Dairy", itemIds: [ITEM_ID, ITEM_ID] })).toEqual([
      "itemIds",
    ]);
    expect(refusedFields(sectionItemsSchema, { listId: LIST_ID, name: " ", itemIds: [ITEM_ID] })).toEqual(["name"]);
  });

  it("renameSection and removeSection name the list and the section(s)", () => {
    expect(accepts(renameSectionSchema, { listId: LIST_ID, from: "Dairy", to: "Fridge" })).toBe(true);
    expect(accepts(renameSectionSchema, { listId: LIST_ID, from: "Dairy", to: "" })).toBe(false);
    expect(accepts(removeSectionSchema, { listId: LIST_ID, name: "Dairy" })).toBe(true);
    expect(accepts(removeSectionSchema, { listId: LIST_ID })).toBe(false);
  });
});
