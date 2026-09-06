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
