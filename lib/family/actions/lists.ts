"use server";

/**
 * The Lists tab's twelve actions (005 contracts/server-actions.md; R504, R505).
 *
 * Every one is `requireVerifiedActor()` — any role — then the **Parents only
 * rule**: `loadList` answers `NOT_FOUND`, never `FORBIDDEN`, when the list is
 * Parents only and the verified actor's DATABASE role is not `parent` (FR-514,
 * FR-535, spec Assumption 5); items are loaded through their list so the same
 * rule covers every item write. `requireParent()` appears nowhere here: there is
 * no parent-only verb on lists (FR-534).
 *
 * Every action is ONE statement on one table after its loads: a drop is one
 * UPDATE that sets order and section together (R502); a section operation is one
 * UPDATE over a set; Clear Completed is one DELETE over a set. Nothing needs a
 * lock, a trigger or an RPC — the worst race is two idempotent ticks (R503), or a
 * clear against an un-tick, and the store's order settles both.
 *
 * Section names are normalised HERE (FR-529): trimmed, matched case-insensitively
 * against the list's existing sections, the existing spelling adopted on a
 * match. The database keeps only the invariant (a section is whatever string
 * the items carry), so one helper serves the four paths that write `section`.
 *
 * Tenancy is the `.eq("household_id")` on every load and every statement: under
 * the service role there is no RLS, and a row of another household reads as
 * absent (`NOT_FOUND`), never as forbidden (FR-539).
 */

import { ActionFailure, runAction, type ActionResult } from "../errors";
import { requireVerifiedActor } from "../guards";
import { matchSection, sectionsOf } from "../lists/grouping";
import { nextSortOrder, sortOrderBetween } from "../ordering";
import {
  LIST_COLUMNS,
  LIST_ITEM_COLUMNS,
  toList,
  toListItem,
  type ListItemRow,
  type ListRow,
} from "../rows";
import type { Actor, List, ListItem } from "../types";
import {
  addListItemSchema,
  clearCompletedSchema,
  deleteListItemSchema,
  deleteListSchema,
  listInputSchema,
  moveListItemSchema,
  parseOrThrow,
  removeSectionSchema,
  renameSectionSchema,
  sectionItemsSchema,
  setListItemCheckedSchema,
  updateListItemSchema,
  updateListSchema,
  validateListPatch,
  type ListInput,
} from "../validation";
import { adminFamily, mapDbError, touchActor } from "./shared";

/* ------------------------------------------------------------------ loads -- */

/** FR-514 / R505: a Parents only list exists, for a member, exactly as much as a stranger's. */
function mayTouch(actor: Actor, list: List): boolean {
  return !list.parentsOnly || actor.role === "parent";
}

/** One list of this household the actor may write — or `NOT_FOUND`. */
async function loadList(householdId: string, listId: string, actor: Actor): Promise<List> {
  const { data, error } = await adminFamily()
    .from("lists")
    .select(LIST_COLUMNS)
    .eq("id", listId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  const list = toList(data as unknown as ListRow);
  if (!mayTouch(actor, list)) throw new ActionFailure("NOT_FOUND");
  return list;
}

/** One item, through its list, so the Parents only rule covers it too. */
async function loadItem(householdId: string, itemId: string, actor: Actor): Promise<ListItem> {
  const { data, error } = await adminFamily()
    .from("list_items")
    .select(LIST_ITEM_COLUMNS)
    .eq("id", itemId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw new ActionFailure("NOT_FOUND");
  const item = toListItem(data as unknown as ListItemRow);
  await loadList(householdId, item.listId, actor);
  return item;
}

/** Every item of one list — for the append position, the neighbours, and the sections. */
async function itemsOfList(householdId: string, listId: string): Promise<ListItem[]> {
  const { data, error } = await adminFamily()
    .from("list_items")
    .select(LIST_ITEM_COLUMNS)
    .eq("list_id", listId)
    .eq("household_id", householdId);
  if (error) throw mapDbError(error);
  return ((data ?? []) as unknown as ListItemRow[]).map(toListItem);
}

/** FR-529: the spelling an item should carry for `raw` on this list; `null` for ungrouped. */
function resolveSection(items: readonly ListItem[], raw: string | null): string | null {
  if (raw === null) return null;
  return matchSection(sectionsOf(items), raw);
}

/* ------------------------------------------------------------------ lists -- */

type ListWrite = Record<string, string | number | boolean | null>;

function listColumns(input: ListInput): ListWrite {
  return { name: input.name, kind: input.kind, color: input.color, parents_only: input.parentsOnly };
}

async function readList(householdId: string, listId: string): Promise<List> {
  const { data, error } = await adminFamily()
    .from("lists")
    .select(LIST_COLUMNS)
    .eq("id", listId)
    .eq("household_id", householdId)
    .single();
  if (error) throw mapDbError(error);
  return toList(data as unknown as ListRow);
}

/** FR-511: appends a list at the end of the row (FR-502), attributed to the punch-in. */
export async function createList(input: ListInput): Promise<ActionResult<List>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(listInputSchema, input);
    const existing = await adminFamily()
      .from("lists")
      .select("sort_order")
      .eq("household_id", actor.householdId);
    if (existing.error) throw mapDbError(existing.error);
    const rows = (existing.data ?? []) as unknown as { sort_order: number | string }[];
    const sortOrder = nextSortOrder(rows.map((row) => ({ sortOrder: Number(row.sort_order) })));

    const { data, error } = await adminFamily()
      .from("lists")
      .insert({
        household_id: actor.householdId,
        ...listColumns(parsed),
        sort_order: sortOrder,
        created_by: actor.profileId,
        updated_by: actor.profileId,
      })
      .select(LIST_COLUMNS)
      .single();
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return toList(data as unknown as ListRow);
  });
}

/** FR-511 / FR-514: the merged list through the create schema, one UPDATE. */
export async function updateList(input: {
  id: string;
  patch: Partial<ListInput>;
}): Promise<ActionResult<List>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(updateListSchema, input);
    const existing = await loadList(actor.householdId, parsed.id, actor);
    const merged = validateListPatch(existing, parsed.patch);

    const { error } = await adminFamily()
      .from("lists")
      .update({ ...listColumns(merged), updated_by: actor.profileId })
      .eq("id", existing.id)
      .eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return readList(actor.householdId, existing.id);
  });
}

/** FR-512: one DELETE; the items cascade. */
export async function deleteList(input: { id: string; confirm: true }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(deleteListSchema, input);
    const list = await loadList(actor.householdId, parsed.id, actor);
    const { error } = await adminFamily()
      .from("lists")
      .delete()
      .eq("id", list.id)
      .eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return null;
  });
}

/* ------------------------------------------------------------------ items -- */

async function readItem(householdId: string, itemId: string): Promise<ListItem> {
  const { data, error } = await adminFamily()
    .from("list_items")
    .select(LIST_ITEM_COLUMNS)
    .eq("id", itemId)
    .eq("household_id", householdId)
    .single();
  if (error) throw mapDbError(error);
  return toListItem(data as unknown as ListItemRow);
}

/** One UPDATE of one item, scoped by household, then the row as stored. */
async function writeItem(
  householdId: string,
  itemId: string,
  columns: Record<string, string | number | null>,
): Promise<ListItem> {
  const { error } = await adminFamily()
    .from("list_items")
    .update(columns)
    .eq("id", itemId)
    .eq("household_id", householdId);
  if (error) throw mapDbError(error);
  return readItem(householdId, itemId);
}

/** FR-516: ungrouped, at the end, attributed. */
export async function addListItem(input: {
  listId: string;
  text: string;
}): Promise<ActionResult<ListItem>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(addListItemSchema, input);
    const list = await loadList(actor.householdId, parsed.listId, actor);
    const items = await itemsOfList(actor.householdId, list.id);

    const { data, error } = await adminFamily()
      .from("list_items")
      .insert({
        household_id: actor.householdId,
        list_id: list.id,
        text: parsed.text,
        section: null,
        sort_order: nextSortOrder(items),
        created_by: actor.profileId,
      })
      .select(LIST_ITEM_COLUMNS)
      .single();
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return toListItem(data as unknown as ListItemRow);
  });
}

/** FR-522 / FR-529: the text, the section (normalised against the list's), or both. */
export async function updateListItem(input: {
  id: string;
  patch: { text?: string; section?: string | null };
}): Promise<ActionResult<ListItem>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(updateListItemSchema, input);
    const item = await loadItem(actor.householdId, parsed.id, actor);

    const columns: Record<string, string | null> = {};
    if (parsed.patch.text !== undefined) columns.text = parsed.patch.text;
    if (parsed.patch.section !== undefined) {
      const items = await itemsOfList(actor.householdId, item.listId);
      columns.section = resolveSection(items, parsed.patch.section);
    }
    const written = await writeItem(actor.householdId, item.id, columns);
    await touchActor(actor);
    return written;
  });
}

/** FR-518 / R503: idempotent — a state, not a transition. Who checked it, and when. */
export async function setListItemChecked(input: {
  id: string;
  checked: boolean;
}): Promise<ActionResult<ListItem>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(setListItemCheckedSchema, input);
    const item = await loadItem(actor.householdId, parsed.id, actor);
    const written = await writeItem(actor.householdId, item.id, {
      checked_at: parsed.checked ? new Date().toISOString() : null,
      checked_by: parsed.checked ? actor.profileId : null,
    });
    await touchActor(actor);
    return written;
  });
}

/** A neighbour `dropOf` named must be an item of the same list — or the drop is stale. */
function neighbourOf(items: readonly ListItem[], id: string | null): ListItem | null {
  if (id === null) return null;
  const found = items.find((one) => one.id === id);
  if (found === undefined) throw new ActionFailure("NOT_FOUND");
  return found;
}

/** FR-523 / FR-524 / FR-532 (R502): the position between the neighbours AND the section, in one UPDATE. */
export async function moveListItem(input: {
  id: string;
  previousItemId: string | null;
  nextItemId: string | null;
  section: string | null;
}): Promise<ActionResult<ListItem>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(moveListItemSchema, input);
    const item = await loadItem(actor.householdId, parsed.id, actor);
    const items = await itemsOfList(actor.householdId, item.listId);
    const previous = neighbourOf(items, parsed.previousItemId);
    const next = neighbourOf(items, parsed.nextItemId);

    const written = await writeItem(actor.householdId, item.id, {
      sort_order: sortOrderBetween(previous?.sortOrder ?? null, next?.sortOrder ?? null),
      section: resolveSection(items, parsed.section),
    });
    await touchActor(actor);
    return written;
  });
}

/** FR-522: outright, as the phone's "x" does. */
export async function deleteListItem(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(deleteListItemSchema, input);
    const item = await loadItem(actor.householdId, parsed.id, actor);
    const { error } = await adminFamily()
      .from("list_items")
      .delete()
      .eq("id", item.id)
      .eq("household_id", actor.householdId);
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return null;
  });
}

/** FR-521: every checked item of that list and no other, in one DELETE. */
export async function clearCompletedItems(input: {
  listId: string;
  confirm: true;
}): Promise<ActionResult<{ removed: number }>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(clearCompletedSchema, input);
    const list = await loadList(actor.householdId, parsed.listId, actor);
    const { data, error } = await adminFamily()
      .from("list_items")
      .delete()
      .eq("list_id", list.id)
      .eq("household_id", actor.householdId)
      .not("checked_at", "is", null)
      .select("id");
    if (error) throw mapDbError(error);
    await touchActor(actor);
    return { removed: (data ?? []).length };
  });
}

/* --------------------------------------------------------------- sections -- */

/** Which of the list's items one section write reaches: the chosen ids, or every item of one section. */
type SectionScope = { kind: "ids"; ids: readonly string[] } | { kind: "section"; section: string };

/** One UPDATE of `section` over a set of this list's items; how many rows it touched. */
async function writeSection(
  householdId: string,
  listId: string,
  section: string | null,
  scope: SectionScope,
): Promise<number> {
  const query = adminFamily()
    .from("list_items")
    .update({ section })
    .eq("list_id", listId)
    .eq("household_id", householdId);
  const scoped =
    scope.kind === "ids" ? query.in("id", [...scope.ids]) : query.eq("section", scope.section);
  const { data, error } = await scoped.select("id");
  if (error) throw mapDbError(error);
  return (data ?? []).length;
}

/** FR-528 / FR-529: Add section and Move items — the chosen items under one (matched) name. */
export async function sectionItems(input: {
  listId: string;
  name: string;
  itemIds: string[];
}): Promise<ActionResult<{ section: string; moved: number }>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(sectionItemsSchema, input);
    const list = await loadList(actor.householdId, parsed.listId, actor);
    const items = await itemsOfList(actor.householdId, list.id);
    for (const id of parsed.itemIds) neighbourOf(items, id);
    const section = resolveSection(items, parsed.name);
    if (section === null) throw new ActionFailure("VALIDATION", "A section name is 1 to 60 characters.");

    const moved = await writeSection(actor.householdId, list.id, section, {
      kind: "ids",
      ids: parsed.itemIds,
    });
    await touchActor(actor);
    return { section, moved };
  });
}

/** FR-533: renamed across every item that carries it; a match with another section is a merge. */
export async function renameSection(input: {
  listId: string;
  from: string;
  to: string;
}): Promise<ActionResult<{ section: string; renamed: number }>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(renameSectionSchema, input);
    const list = await loadList(actor.householdId, parsed.listId, actor);
    const items = await itemsOfList(actor.householdId, list.id);
    const sections = sectionsOf(items);
    if (!sections.includes(parsed.from)) throw new ActionFailure("NOT_FOUND");
    const others = sections.filter((one) => one !== parsed.from);
    const target = matchSection(others, parsed.to) ?? parsed.from;

    const renamed = await writeSection(actor.householdId, list.id, target, {
      kind: "section",
      section: parsed.from,
    });
    if (renamed === 0) throw new ActionFailure("NOT_FOUND");
    await touchActor(actor);
    return { section: target, renamed };
  });
}

/** FR-533: the items stay, ungrouped; the header leaves with its last item. */
export async function removeSection(input: {
  listId: string;
  name: string;
}): Promise<ActionResult<{ ungrouped: number }>> {
  return runAction(async () => {
    const actor = await requireVerifiedActor();
    const parsed = parseOrThrow(removeSectionSchema, input);
    const list = await loadList(actor.householdId, parsed.listId, actor);
    const ungrouped = await writeSection(actor.householdId, list.id, null, {
      kind: "section",
      section: parsed.name,
    });
    if (ungrouped === 0) throw new ActionFailure("NOT_FOUND");
    await touchActor(actor);
    return { ungrouped };
  });
}
