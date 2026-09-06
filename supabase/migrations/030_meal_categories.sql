-- 030_meal_categories.sql — the household's four mealtimes (006 FR-608–FR-612; R601, R613).
--
-- Exactly four per household: seeded ONCE by emptiness through
-- family.seed_default_meal_categories(), and no action creates or deletes one
-- (R604). Each is a record with an identity — a rename carries every recipe and
-- meal that names it (FR-612). Names are unique within the household, compared
-- trimmed and case-insensitively (FR-610). Colours are palette members, as
-- every colour here is.
--
-- Hard ordering (unchanged since Phase 3): 030–033 are pushed to the hosted
-- project BEFORE the branch that reads them is merged or deployed — the four
-- tables join the one realtime channel every /family page mounts (033).

create table if not exists family.meal_categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 40),
  color         family.palette_color not null,
  position      integer not null,
  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Tenancy proof for every composite FK that points here.
  constraint meal_categories_tenant unique (id, household_id),
  constraint meal_categories_position_key unique (household_id, position)
);

-- FR-610: "Tea" and "tea " are the same name.
create unique index if not exists meal_categories_name_key
  on family.meal_categories (household_id, lower(trim(name)));

drop trigger if exists touch on family.meal_categories;
create trigger touch before update on family.meal_categories
  for each row execute function family.touch_updated_at();

-- FR-608: the reference's four, in the live API's order and colours (Cyan,
-- Coral, Plum, Orange — spec Contradiction 1), made once for a household that
-- has none. Service role only: the seed script calls it, never a client.
create or replace function family.seed_default_meal_categories(p_household_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if exists (select 1 from family.meal_categories where household_id = p_household_id) then
    return 0;
  end if;
  insert into family.meal_categories (household_id, name, color, position)
  values (p_household_id, 'Breakfast', '#A8D4D3', 1),
         (p_household_id, 'Lunch',     '#F66951', 2),
         (p_household_id, 'Dinner',    '#915EA1', 3),
         (p_household_id, 'Snack',     '#FDC36D', 4);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function family.seed_default_meal_categories(uuid) from public, anon, authenticated;
grant execute on function family.seed_default_meal_categories(uuid) to service_role;

-- Members READ under RLS; every write goes through the service role in an
-- action (FR-644). Renaming is the action's parent gate (FR-640), not RLS's.
alter table family.meal_categories enable row level security;
drop policy if exists "members read meal categories" on family.meal_categories;
create policy "members read meal categories" on family.meal_categories
  for select to authenticated using (family.is_member(household_id));

grant select on family.meal_categories to authenticated;
grant all on family.meal_categories to service_role;

notify pgrst, 'reload schema';
