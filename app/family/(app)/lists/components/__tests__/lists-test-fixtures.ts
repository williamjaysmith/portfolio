import type { List, ListItem } from "@/lib/family/types";

/** Shared fixtures for the Lists tab's RTL suites (005). */

export const HOUSEHOLD = "household-1";
export const GROCERY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const TODO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const PARTY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

export function listOf(overrides: Partial<List> & Pick<List, "id" | "name">): List {
  return {
    householdId: HOUSEHOLD,
    kind: "grocery",
    color: "#B6E085",
    parentsOnly: false,
    sortOrder: 1000,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

let sequence = 0;

export function itemOf(listId: string, text: string, overrides: Partial<ListItem> = {}): ListItem {
  sequence += 1;
  return {
    id: `item-${String(sequence).padStart(3, "0")}`,
    householdId: HOUSEHOLD,
    listId,
    text,
    section: null,
    checkedAt: null,
    checkedBy: null,
    sortOrder: sequence * 1000,
    createdBy: null,
    createdAt: `2026-09-01T10:${String(sequence % 60).padStart(2, "0")}:00.000Z`,
    ...overrides,
  };
}

export const CHECKED_AT = "2026-09-05T12:00:00.000Z";
