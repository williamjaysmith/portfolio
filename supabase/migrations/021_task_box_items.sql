-- 021_task_box_items.sql — reusable templates (FR-376..FR-382). FR-377 fixes the
-- field set EXACTLY: a title, an optional emoji, a type, and the reserved star
-- value. No description, date, repeat or assignment.
-- Serves: FR-376..FR-382 (the Task Box and its seventeen seeded templates),
-- FR-329 (the reserved star value on a template too), FR-390 (tenancy), R312.
-- Contains no personal data — the seventeen titles are reference product data,
-- not this household's.

create table if not exists family.task_box_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  summary       text not null check (length(trim(summary)) between 1 and 120),
  emoji         text check (emoji is null or length(emoji) <= 16),
  routine       boolean not null default false,      -- the Chores / Routines sections
  reward_points smallint check (reward_points is null or reward_points >= 0),  -- reserved
  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists task_box_household_idx
  on family.task_box_items (household_id, routine);

drop trigger if exists touch on family.task_box_items;
create trigger touch before update on family.task_box_items
  for each row execute function family.touch_updated_at();

alter table family.task_box_items enable row level security;
drop policy if exists "members read task box" on family.task_box_items;
create policy "members read task box" on family.task_box_items
  for select to authenticated using (family.is_member(household_id));
grant select on family.task_box_items to authenticated;
grant all    on family.task_box_items to service_role;

-- FR-382 + Assumption 23: seeded when a household is SET UP, so a second
-- household starts identically. A function rather than a bare INSERT so the
-- migration, scripts/family-seed.mjs and any future bootstrap share one list.
-- Idempotent by EMPTINESS, not by conflict: FR-381 makes a template deletion
-- permanent, so a re-run must not resurrect "Vacuum".
create or replace function family.seed_task_box(p_household_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if exists (select 1 from family.task_box_items where household_id = p_household_id) then
    return 0;
  end if;
  insert into family.task_box_items (household_id, summary, emoji, routine)
  select p_household_id, s.summary, s.emoji, s.routine
    from (values
      ('Laundry', null, false), ('Dishes', null, false), ('Clean room', null, false),
      ('Vacuum', null, false), ('Take out trash', null, false), ('Clean bathroom', null, false),
      ('Set the table', null, false), ('Clear the table', null, false),
      ('Put away toys', null, false),
      ('Make bed', '🛏️', true), ('Brush teeth', '🪥', true), ('Shower', '🚿', true),
      ('Bath', '🛁', true), ('Homework', '📝', true), ('Skincare', '🧴', true),
      ('Wash face', '🧽', true), ('Do hair', '🪞', true)
    ) as s(summary, emoji, routine);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function family.seed_task_box(uuid) from public, anon, authenticated;
grant execute on function family.seed_task_box(uuid) to service_role;

select family.seed_task_box('00000000-0000-4000-8000-000000000001');  -- the 007 household

-- Make the new table and RPC visible to PostgREST without a restart.
notify pgrst, 'reload schema';
