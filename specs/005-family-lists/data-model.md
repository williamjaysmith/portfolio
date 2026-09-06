# Phase 5 Data Model: Family Lists

**Feature**: `005-family-lists` | **Date**: 2026-09-05

What Phase 5 adds to the `family` schema: **two tables** (`lists`, `list_items`), **one helper
function** (`seed_default_lists`), and the publication entries that put the two tables on the
existing live-update channel. **No shipped table changes shape. No view. No trigger that writes.**
The only triggers are the shipped `touch_updated_at` on `lists` — lists carry no money, so the
database's whole job is shape, tenancy and cascade (R504).

Semantics follow the reference's verified record shape wherever it verified one: a list's `label`,
`kind`, palette-validated `color` and `hide_on_device` (`[V](skylight-api)`, `[V](pyskylight)`),
an item's `label`, freeform `section` string, `status` and `position` (`[V](skylight-api)`), the
default lists' names and colours (`[V](skylight-api)`). Where it diverges — three kinds instead of
two, `parents_only` instead of `hide_on_device`, a timestamp instead of a status word, one
list-wide position instead of one per section — the spec's Assumptions 2, 5, 9 and R502/R503
decide, and the sections below say so.

---

## Entity overview

```
households
    │ 1:N
    ├────────── categories (Profiles + Labels; Phase 1)
    │              ▲
    │              └── created_by / updated_by / checked_by (single-column FK, set null — a list
    │                  and its items outlive every Profile, FR-540)
    │
    └────────── lists (028) ◄── list_items (028)   [list_items.list_id + household_id → lists, cascade]
```

A list belongs to the household only (FR-515): no column on `lists` or `list_items` references a
category except the three attribution columns. A section is not an entity — it is the `section`
string some items share (R501).

---

## Migrations

Numbered **028–029**, after Phase 4's 024–027. Each is idempotent (`if not exists`, `create or
replace`, drop-then-create for triggers) so `supabase db reset` and a hosted `db push` both work,
and each `CREATE TABLE` header records why the table is not a fold into an existing one.

| # | File | Contents | Serves |
|---|---|---|---|
| 028 | `028_lists.sql` | `family.lists`, `family.list_items`, indexes, the touch trigger, `seed_default_lists(uuid)`, policies, grants | FR-509–FR-533, FR-539, FR-540 |
| 029 | `029_realtime_lists.sql` | Guarded publication adds for the two tables; `notify pgrst, 'reload schema'` | FR-538 |

---

## 028 — Lists and items

```sql
-- 028_lists.sql — family.lists: one shared list of the household (FR-509..FR-515), and
-- family.list_items: one line on a list (FR-516..FR-533). Contains no personal data.
--
-- Why a table, and not a fold into a table that already exists:
--   * not rows on family.tasks or family.task_box_items — an item is ticked, never scheduled: it
--     has no assignee, no slot, no per-day resolution, no streak and no stars; every task CHECK
--     and trigger would grow a `kind` clause to leave it alone, and a grocery list of forty lines
--     is not forty chores;
--   * not a JSONB `items` document on the list's row — a tick from the phone and an add from the
--     wall in the same second would race for one document, a drop's single-row write would become
--     a rewrite of the whole list, and Realtime could not say which item changed;
--   * not columns on family.categories — a list belongs to the household, never to a Profile or a
--     Label (FR-515); the reference's list resource carries no category.

create table if not exists family.lists (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 120),
  -- FR-510: the three types the device offers (37275069922971). The reference's API has two
  -- kinds; the spec's Contradiction 1 keeps the three the person is shown. No behaviour hangs on
  -- it this phase; Phase 6 may read `grocery` as "a list ingredients can land on".
  kind          text not null check (kind in ('to_do', 'grocery', 'other')),
  -- FR-509: one of the 20 palette colours — the shipped domain (003), so the rule is not repeated.
  color         family.palette_color not null,
  -- FR-514 / Assumption 5: shown only while a parent is punched in on the device. The reference's
  -- hide_on_device (47603555960475), mapped onto this project's identity model (R505).
  parents_only  boolean not null default false,
  -- FR-502 / Assumption 17: the card's place in the row, a fractional index (divergence #5).
  -- Set on creation, not yet draggable.
  sort_order    numeric not null default 1000,
  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lists_id_household_key unique (id, household_id)
);

create index if not exists lists_household_sort_idx on family.lists (household_id, sort_order);

-- One line on a list. A section is the `section` string the item carries, and nothing else
-- (R501): no section table, no section id — a section exists exactly while an item carries it,
-- which is the reference's own rule ("an empty section can't be created standalone",
-- 44739335665051).
create table if not exists family.list_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  list_id       uuid not null,
  -- FR-517: the item IS its text; emoji and quantities are whatever was typed into it.
  text          text not null check (length(trim(text)) between 1 and 200),
  -- FR-527..FR-529: stored trimmed; matched case-insensitively by the action, which adopts the
  -- existing spelling on a match. Null = ungrouped.
  section       text check (section is null or (section = trim(section) and length(section) between 1 and 60)),
  -- FR-518, FR-519, FR-525 (R503): checked while checked_at is set; who checked it, cleared with
  -- the Profile (FR-540) — the one state where checked_at stands and checked_by is null.
  checked_at    timestamptz,
  checked_by    uuid references family.categories(id) on delete set null,
  -- FR-524 (R502): one position among the LIST's items — not per section — written once per drop;
  -- sections are ordered by their first item.
  sort_order    numeric not null default 1000,
  created_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint list_items_list_fk foreign key (list_id, household_id)
    references family.lists (id, household_id) on delete cascade,
  constraint list_item_checked_shape check (checked_by is null or checked_at is not null)
);

-- The card's read (one list in order) and the tab's read (the household's items).
create index if not exists list_items_list_sort_idx on family.list_items (list_id, sort_order);
create index if not exists list_items_household_idx on family.list_items (household_id);

drop trigger if exists touch on family.lists;
create trigger touch before update on family.lists
  for each row execute function family.touch_updated_at();

-- FR-513 / Assumption 3: the two default lists, once. The seed_task_box() pattern (021):
-- reference product data with no personal content lives in committed SQL; idempotent BY EMPTINESS,
-- so a household that renamed or deleted a default never gets it back; callable only by the
-- service role, from the seed script (both modes).
create or replace function family.seed_default_lists(p_household_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if exists (select 1 from family.lists where household_id = p_household_id) then
    return 0;
  end if;
  insert into family.lists (household_id, name, kind, color, sort_order)
  values (p_household_id, 'Grocery List', 'grocery', '#B6E085', 1000),   -- Sprout, the live default
         (p_household_id, 'To-Do List',   'to_do',   '#A8D4D3', 2000);   -- Cyan, the live default
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function family.seed_default_lists(uuid) from public, anon, authenticated;
grant execute on function family.seed_default_lists(uuid) to service_role;

-- Members READ under RLS; every write goes through the service role in an action (FR-539).
-- Nothing here hides a Parents only list from a member's read: the whole household shares one
-- account, so RLS cannot see the punch-in; the rule is the client's display and the action's
-- refusal (R505, spec Assumption 5).
alter table family.lists enable row level security;
alter table family.list_items enable row level security;
drop policy if exists "members read lists" on family.lists;
create policy "members read lists" on family.lists
  for select to authenticated using (family.is_member(household_id));
drop policy if exists "members read list items" on family.list_items;
create policy "members read list items" on family.list_items
  for select to authenticated using (family.is_member(household_id));

grant select on family.lists, family.list_items to authenticated;
grant all on family.lists, family.list_items to service_role;

notify pgrst, 'reload schema';
```

## 029 — Realtime

The 022/027 block verbatim, over `array['lists', 'list_items']`, followed by `notify pgrst,
'reload schema'`. Replica identity is left at the default — a deleted list's name and a deleted
item's text must not travel in a DELETE payload, the same rule as a deleted task's title. Both
tables are subscribed **unfiltered** on the client (a DELETE payload carries only the key), and
this phase deletes on the hot path: Clear Completed and Delete list.

**Hard ordering (R411, R506)**: 029 MUST be pushed to the hosted project BEFORE the branch is
merged or deployed — a client binding for a table not yet in the publication fails the whole shared
channel, calendar and boards included.

---

## How the tab is read

| Read | Key | Shape | Why this shape |
|---|---|---|---|
| `lists` | `familyKeys.lists(h)` | every list of the household, `order by sort_order, created_at` | the row of cards; the Parents only filter runs on the client over this array (R505) |
| `list_items` | `familyKeys.listItems(h)` | every item of the household, `order by sort_order, created_at` | one array feeds every card's rows, badge and section counts; the Completed switch hides rows below the counts (R506) |

`page.tsx` for `/family/lists` seeds both as `initialData`. The bare `["family"]` invalidation
sweeps both.

## Invariants

1. **A section exists only through its items.** There is no row to create, order or delete; the
   header, its count and its place are derived (R501).
2. **One position per item across the list**, written once per drop; sections are ordered by their
   first item's position (R502).
3. **Checked is `checked_at is not null`.** `checked_by` may be null while checked only because its
   Profile was deleted (`list_item_checked_shape`).
4. **Every write is an action** under `requireVerifiedActor`; `authenticated` has SELECT only;
   `anon` has nothing.
5. **Parents only is judged by role at the write** (database role, not the cookie) and by role for
   display; it is not an RLS predicate, and the spec says so (Assumption 5).
6. **Cascades**: household → lists → items; a Profile's deletion clears attribution and nothing
   else (FR-540).
7. **The two default lists are made once per household** and never re-made (`seed_default_lists`
   by emptiness).
8. **A section name is stored as typed, trimmed**; the case-insensitive match and the adopted
   spelling are the action's (FR-529), so two spellings never coexist on one list.

## What the database enforces, and what the action does

| Rule | Database | Action |
|---|---|---|
| name 1–120, text 1–200, section 1–60 trimmed, kind ∈ {to_do, grocery, other}, colour ∈ palette | CHECKs; the `palette_color` domain | Zod first (`listInputSchema`, `listItemTextSchema`, `sectionNameSchema`), unknown keys refused |
| a list belongs to one household; an item to one list of that household | composite FK `(list_id, household_id)` | every statement `.eq('household_id', …)`; an id from another household is `NOT_FOUND` |
| Parents only | — | `loadList()` answers `NOT_FOUND` to a non-parent (R505) |
| checked ⇔ `checked_at` | `list_item_checked_shape` | `setListItemChecked` writes both columns; idempotent |
| a drop is one write | — | `moveListItem` sets `sort_order` and `section` together |
| section match, rename-merge, remove-keeps-items | — | `sectionItems` / `renameSection` / `removeSection`, one UPDATE each over the set |
| Clear Completed exact | — | one DELETE `where list_id = … and checked_at is not null` |
| the two default lists | `seed_default_lists()` by emptiness | the seed script calls it in both modes |
| attribution | `set null` FKs | `created_by` / `updated_by` / `checked_by` from `actor.profileId`, never the payload |

## Privilege matrix (delta)

| Object | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `lists`, `list_items` | — | SELECT | ALL |
| `seed_default_lists(uuid)` | — | — | EXECUTE |

`privileges.test.ts`'s `TABLES` and `FUNCTIONS` arrays grow in the same commit as 028–029; any
`anon` grant is a failure. `seed_default_lists` is listed with EXECUTE for `service_role` only, as
`seed_task_box` is.

## Dashboard / config steps

None in the Dashboard. One config change that is not a migration: `.fallowrc.json` gains

```json
{ "name": "family-lists-core", "patterns": ["lib/family/lists/**/*"] }
```

with the rule `{ "from": "family-lists-core", "allow": ["family-lists-core", "lib"] }` and
`"family-lists-core"` added to the allow lists of `family-actions`, `components`, `ui-pages` and
`tests` (R516).

## What later phases add here

- **Phase 6 (Meals)** may read `kind = 'grocery'` as the candidates for a recipe's ingredients and
  insert `list_items` through its own action; if its picker wants a default it may add a
  `preferred_for_ingredients boolean` to `lists` additively. Nothing is reserved here for it
  (FR-545).
- **Dragging a card** needs no migration: `lists.sort_order` is already a fractional index.
- **The home screen's lists pane (Phase 7)** reads these two tables as they are.
