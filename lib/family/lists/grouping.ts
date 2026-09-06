/**
 * The Lists tab's pure grouping rules (005 R501, R502; FR-505, FR-527–FR-530).
 *
 * A section is nothing but the `section` string some items share, so everything
 * a card draws about sections — which exist, in what order, with what count — is
 * DERIVED here from the items and stored nowhere. The card draws one FLAT
 * sequence: the ungrouped items first, then each section as a header followed
 * by its items; sections are ordered by their first item's position, so a drag
 * orders sections exactly as it orders items (spec Assumption 9).
 *
 * The section-name match (FR-529) is here too, so the action that writes a
 * section and the sheet that offers one agree on what "the same section" means:
 * trimmed, compared case-insensitively, the existing spelling kept.
 *
 * Framework-free and pure: no React, no DOM, and no input array is ever mutated.
 */

import type { ListItem } from "../types";

/** One row of the flat sequence a card draws — an item, or a section's header. */
export type CardRow =
  | { kind: "item"; id: string; item: ListItem }
  | { kind: "header"; id: string; section: string; count: number };

/** A header's row id — unique within one list, never an item's uuid. */
export function headerRowId(section: string): string {
  return `header:${section}`;
}

/** Trimmed; empty means "no section" (null), never an empty string (028's CHECK). */
export function normaliseSectionName(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * FR-529: the name an item should carry when the person typed `name` — the
 * existing section's spelling when one matches trimmed and case-insensitively,
 * else the trimmed name itself; null for a blank.
 */
export function matchSection(existing: readonly string[], name: string): string | null {
  const wanted = normaliseSectionName(name);
  if (wanted === null) return null;
  const lower = wanted.toLowerCase();
  return existing.find((one) => one.toLowerCase() === lower) ?? wanted;
}

/** ISO timestamps and uuids both sort as text; `sortOrder` first, then age, then id. */
function compareItems(a: ListItem, b: ListItem): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The list's items in the one order every device draws (R502). Never mutates its input. */
export function sortedItems(items: readonly ListItem[]): ListItem[] {
  return [...items].sort(compareItems);
}

/** The distinct sections, each at the position of its FIRST item (spec Assumption 9). */
export function sectionsOf(items: readonly ListItem[]): string[] {
  const seen: string[] = [];
  for (const item of sortedItems(items)) {
    if (item.section !== null && !seen.includes(item.section)) seen.push(item.section);
  }
  return seen;
}

function isUnchecked(item: ListItem): boolean {
  return item.checkedAt === null;
}

/** FR-505: what the card's badge counts — the unchecked items, whatever a device hides. */
export function uncheckedCountOf(items: readonly ListItem[]): number {
  return items.filter(isUnchecked).length;
}

/** FR-530: what a section's header counts — its unchecked items. */
export function sectionCountOf(items: readonly ListItem[], section: string): number {
  return items.filter((item) => item.section === section && isUnchecked(item)).length;
}

function itemRow(item: ListItem): CardRow {
  return { kind: "item", id: item.id, item };
}

/**
 * FR-530 / R502: the flat sequence — ungrouped items first with no header, then
 * each section's header (with its unchecked count) over its items, sections in
 * the order of their first item. A section whose items are all checked keeps its
 * header at count 0; a section with no items does not exist.
 */
export function groupedRowsOf(items: readonly ListItem[]): CardRow[] {
  const sorted = sortedItems(items);
  const rows: CardRow[] = sorted.filter((item) => item.section === null).map(itemRow);
  for (const section of sectionsOf(sorted)) {
    rows.push({ kind: "header", id: headerRowId(section), section, count: sectionCountOf(sorted, section) });
    for (const item of sorted) {
      if (item.section === section) rows.push(itemRow(item));
    }
  }
  return rows;
}
