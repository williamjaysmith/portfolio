-- 018_task_assignees.sql — who a task is for (FR-322/324), in that Profile's own
-- routine order (FR-310), with that Profile's own habit streak (FR-371).
-- Zero rows = up for grabs (FR-365).
-- Serves: FR-310, FR-322..FR-324 (assignment, Profiles only, one task many people),
-- FR-365, FR-371..FR-374 (the streak checkpoint pair), FR-391 (a Profile's deletion
-- takes its assignments), FR-390 (tenancy), R307.
-- Contains no personal data.
--
-- Why a table, and not a fold into a table that already exists:
--   * not an `assignee_ids uuid[]` column or a JSONB key on family.tasks — each
--     assignment carries state of its own, the per-Profile sort_order (FR-310)
--     and the streak checkpoint pair (FR-371), which an array cannot hold and a
--     JSONB key cannot constrain, index or cascade; FR-391's cascade on a
--     Profile's deletion and FR-322's Profiles-only rule are a foreign key and
--     a trigger here, and neither reaches inside JSONB;
--   * not a discriminated row on family.event_categories — that table links an
--     event to categories in draw order and carries nothing per link.

create table if not exists family.task_assignees (
  household_id  uuid not null references family.households(id) on delete cascade,
  task_id       uuid not null,
  category_id   uuid not null,

  -- FR-310: the fractional index Phase 1 shipped (lib/family/ordering.ts) — a drag
  -- writes ONE row. Per (task, assignee), which is the recorded cost of
  -- one-routine-many-slots: a routine cannot be ordered differently in its Morning
  -- and Evening sections (Contradiction 7, Assumption 11).
  sort_order    numeric not null default 1000,

  -- FR-371/373/374. `streak_count` is what the lightning badge reads.
  -- `streak_through` is the last household-local date the count accounts for —
  -- without it a stored counter cannot know a day ended unresolved, because
  -- NOBODY WRITES ANYTHING on the day a streak breaks (FR-373).
  streak_count   integer not null default 0 check (streak_count >= 0),
  streak_through date,

  -- The day this assignee's Completed Date chain is seeded from, so adding Ben to
  -- a chore whose due date was six months ago starts him today rather than six
  -- months late (r-completed-date §8.7). Read, never written, by cursor.ts.
  created_at    timestamptz not null default now(),

  primary key (task_id, category_id),

  constraint task_assignees_task_fk foreign key (task_id, household_id)
    references family.tasks (id, household_id) on delete cascade,
  constraint task_assignees_category_fk foreign key (category_id, household_id)
    references family.categories (id, household_id) on delete cascade,
  constraint task_assignees_streak_shape check (streak_count = 0 or streak_through is not null)
);

-- Serves the column read's ordering, FR-313's assignment-picker withdrawal,
-- FR-391's affected-task counts, and the cascade scan.
create index if not exists task_assignees_category_idx
  on family.task_assignees (household_id, category_id, sort_order);

-- FR-323 (a Label may never be assigned, refused AT THE DATA STORE) and FR-365
-- (an up-for-grabs task belongs to nobody). Neither is expressible as a CHECK —
-- both read another row — so a trigger is the backstop behind the action's own
-- check, exactly as 010's assert_event_timezone and 003's
-- assert_profile_account_is_member are.
create or replace function family.assert_task_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from family.categories
     where id = new.category_id and household_id = new.household_id and is_profile
  ) then
    raise exception 'a task may be assigned only to a Profile' using errcode = '23514';
  end if;
  if exists (
    select 1 from family.tasks
     where id = new.task_id and household_id = new.household_id and up_for_grabs
  ) then
    raise exception 'an up-for-grabs task cannot carry an assignee' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function family.assert_task_assignee() from public;
drop trigger if exists task_assignee_is_valid on family.task_assignees;
create trigger task_assignee_is_valid
  before insert or update of task_id, category_id on family.task_assignees
  for each row execute function family.assert_task_assignee();

-- The other direction of FR-365: a task cannot BECOME up-for-grabs while somebody
-- is assigned to it. The edit clears the assignees in the same action first.
create or replace function family.assert_up_for_grabs_is_unassigned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.up_for_grabs and exists (
    select 1 from family.task_assignees where task_id = new.id
  ) then
    raise exception 'an up-for-grabs task cannot carry an assignee' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function family.assert_up_for_grabs_is_unassigned() from public;
drop trigger if exists task_up_for_grabs_is_unassigned on family.tasks;
create trigger task_up_for_grabs_is_unassigned
  before update of up_for_grabs on family.tasks
  for each row execute function family.assert_up_for_grabs_is_unassigned();

alter table family.task_assignees enable row level security;
drop policy if exists "members read task assignees" on family.task_assignees;
create policy "members read task assignees" on family.task_assignees
  for select to authenticated using (family.is_member(household_id));
grant select on family.task_assignees to authenticated;
grant all    on family.task_assignees to service_role;
