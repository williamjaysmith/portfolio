# Contracts: Server Actions — Lists

**Feature**: `005-family-lists` | **Date**: 2026-09-05

What Phase 5 adds to the action surface of Phases 1–4 (their contracts remain in force; none is
amended). **Twelve new actions** in `lib/family/actions/lists.ts`, **no amended action**, **no
RPC**, **no trigger that writes**, and two new cached reads. Every action starts with
`"use server"`, returns `Promise<ActionResult<…>>` through `runAction()`, and is validated with
Zod 4 before anything reaches the database — the CHECKs of `data-model.md` are the second line, not
the first.

**Every action is one statement** on one table (R504): a drop is one UPDATE of one row; a section
operation is one UPDATE over a set; Clear Completed is one DELETE over a set. Nothing here needs a
lock, a trigger or an RPC: the worst race is two idempotent ticks, or a clear against an un-tick,
and the store's order settles both.

---

## Guards

Every action: `requireVerifiedActor()` — any role — then the **Parents only rule** (R505):
`loadList(householdId, listId, actor)` re-reads the list under the household with the admin
client and throws `NOT_FOUND` when there is no such list **or** when `parents_only` is true and the
verified actor's database role is not `parent`. Items are loaded through their list
(`loadItem(householdId, itemId, actor)` joins `lists`), so the same rule covers every item write.
`requireParent()` appears nowhere in this module: there is no parent-only verb on lists (FR-534).

`permissions.ts` gains two operations as **affordances** — `list.create` (any actor) and
`list.write` (any actor; a target-aware refusal when `ctx.parentsOnly` and the actor is not a
parent) — used by the board to decide what to draw; the actions decide.

## Shared result shape

`ActionResult<T>` and `ActionError` are unchanged. New situations map onto existing codes:

| Situation | Code | Message |
|---|---|---|
| the list, item or section is gone, or is Parents only and the actor is a member | `NOT_FOUND` | Phase 1's wording — "That's no longer here." |
| a name, text or section outside its bounds; a kind or colour outside its set | `VALIDATION` (field) | "Name is required." / "Keep it under 120 characters." / "An item is 1 to 200 characters." / "A section name is 1 to 60 characters." / "Choose To do, Grocery or Other." / "Choose a colour from the palette." |
| `sectionItems` with no items chosen | `VALIDATION` (field `itemIds`) | "Choose at least one item." |
| `clearCompletedItems` or `deleteList` without `confirm: true` | `VALIDATION` | Phase 3's wording |
| nobody punched in | `NO_ACTOR` | "Punch in to make changes." |
| offline | never reaches an action (FR-537) | — |

## Shared input shapes

```ts
type ListKind = "to_do" | "grocery" | "other";

type ListInput = {
  name: string;               // 1–120, trimmed
  kind: ListKind;
  color: PaletteColor;        // one of the 20
  parentsOnly: boolean;       // FR-514
};

type List = {
  id, householdId, name, kind, color, parentsOnly, sortOrder,
  createdBy: string | null, updatedBy: string | null, createdAt, updatedAt
};

type ListItem = {
  id, householdId, listId, text, section: string | null,
  checkedAt: string | null, checkedBy: string | null,
  sortOrder: number, createdBy: string | null, createdAt
};
```

`text` is 1–200 characters trimmed; `section` is 1–60 characters trimmed or `null`. Every schema
is a `z.strictObject`, so unknown keys are refused, not stripped.

---

## Lists

### `createList(input: ListInput): ActionResult<List>`

Inserts one `family.lists` row with `sort_order = nextSortOrder(existing)` (appends, FR-502),
`created_by = updated_by = actor.profileId`. Returns the row.

### `updateList(input: { id: string; patch: Partial<ListInput> }): ActionResult<List>`

`loadList` (the Parents only rule applies to the list **as it is** — a member cannot turn Parents
only off on a list they cannot see), validates the merged shape through `listInputSchema`, one
UPDATE, `updated_by = actor.profileId`. Turning Parents only on or off is this action (FR-514).

### `deleteList(input: { id: string; confirm: true }): ActionResult<null>`

`loadList`, one DELETE; items cascade (FR-512).

## Items

### `addListItem(input: { listId: string; text: string }): ActionResult<ListItem>`

`loadList`, then one INSERT with `section = null`, `sort_order = nextSortOrder(items of the list)`
(FR-516: ungrouped, at the end), `created_by = actor.profileId`. Two devices adding in the same
second may compute the same `sort_order`; the read's `created_at` tie-break orders them.

### `updateListItem(input: { id: string; patch: { text?: string; section?: string | null } }): ActionResult<ListItem>`

`loadItem`; when `section` is a string it is normalised — trimmed, matched case-insensitively
against the list's existing distinct sections, the existing spelling adopted on a match
(FR-529) — then one UPDATE. Moving an item to a section this way keeps its `sort_order`; the
card draws it where its position falls within that section.

### `setListItemChecked(input: { id: string; checked: boolean }): ActionResult<ListItem>`

`loadItem`, one UPDATE: `checked_at = now(), checked_by = actor.profileId` when `checked`, both
null otherwise. **Idempotent** — checking a checked item rewrites the same state and succeeds
(SC-504).

### `moveListItem(input: { id: string; previousItemId: string | null; nextItemId: string | null; section: string | null }): ActionResult<ListItem>`

`loadItem`; the two neighbours (if given) must be items of the same list, else `NOT_FOUND`;
`sort_order = sortOrderBetween(prev.sortOrder, next.sortOrder)`; `section` normalised as above;
**one UPDATE** sets both (FR-524, FR-532). The client computes the three arguments with `dropOf`
(R502); the action trusts none of them beyond validating that they name items of the list.

### `deleteListItem(input: { id: string }): ActionResult<null>`

`loadItem`, one DELETE (FR-522).

### `clearCompletedItems(input: { listId: string; confirm: true }): ActionResult<{ removed: number }>`

`loadList`, one `DELETE … where list_id = $1 and household_id = $2 and checked_at is not null`;
returns the count (FR-521, SC-505).

## Sections

### `sectionItems(input: { listId: string; name: string; itemIds: string[] }): ActionResult<{ section: string; moved: number }>`

Add section and Move items are one action (FR-528): `loadList`; `itemIds` ≥ 1 distinct, each an
item of the list (else `NOT_FOUND`); `name` normalised against the list's existing sections
(FR-529); **one UPDATE** `set section = $name where id in (…)`. Returns the spelling written and the
count.

### `renameSection(input: { listId: string; from: string; to: string }): ActionResult<{ section: string; renamed: number }>`

`loadList`; `to` normalised — if it matches another existing section the rename is a merge
(FR-533, FR-529); **one UPDATE** `set section = $to where list_id = $1 and section = $from`. Zero
rows renamed (the section vanished meanwhile) is `NOT_FOUND`.

### `removeSection(input: { listId: string; name: string }): ActionResult<{ ungrouped: number }>`

`loadList`; **one UPDATE** `set section = null where list_id = $1 and section = $name` (FR-533:
the items stay, ungrouped). Zero rows is `NOT_FOUND`.

---

## Amendments to shipped actions

None. `deleteCategory` (Phase 1, amended in Phases 2–4) needs no fourth step: lists and items are
the household's, and the attribution FKs null themselves (FR-540).

## Database functions (delta)

| Function | Called by | Does |
|---|---|---|
| `seed_default_lists(uuid)` | the seed script (`service_role`), both modes | inserts the two default lists once per household; returns the count (0 on a re-run) |

No trigger writes. The touch trigger on `lists` is the shipped `touch_updated_at`.

## Read path (not an action)

Two cached reads (R506): `useLists(householdId)` and `useListItems(householdId)` — under the
caller's RLS, seeded by the page's server read, swept by the bare invalidation. The client derives
everything else from the two arrays in `lib/family/lists/`: `visibleListsOf(lists, actor)` (R505),
`groupedRowsOf(items)` (the flat sequence with headers, R502), `uncheckedCountOf(items)` (FR-505),
`itemsShownOf(items, switches)` (FR-520), `dropOf(rows, movedId, toIndex)` (R502).

## Error-handling contract (delta)

No new SQLSTATE. `23514` (a CHECK the Zod layer should have caught) maps to `VALIDATION` as
today; `23503` cannot arise because every action loads its list first; `PGRST116` on a re-read is
`NOT_FOUND`. Offline never reaches an action (FR-537). A member's write to a Parents only list is
`NOT_FOUND` by design (R505), never `FORBIDDEN`.
