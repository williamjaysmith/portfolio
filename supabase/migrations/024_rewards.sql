-- 024_rewards.sql — family.rewards: something a Profile can spend stars on (FR-415..FR-421),
-- and family.reward_eligibilities: which Profiles it is for (FR-417). Contains no personal data.
--
-- Why a table, and not a fold into a table that already exists:
--   * not a discriminated row on family.tasks — a reward is spent on, never completed; it has a
--     cost, not a value, no schedule, no resolution, no assignee order, and every task CHECK and
--     trigger (the routine shape, the slot set, the repeat modes, the assignee cascade) would have
--     to grow a `kind` clause to leave it alone;
--   * not a JSONB `rewards` key on family.household_settings — the cards the tab sorts, the
--     eligibilities a Profile's deletion cascades through and the cost a redemption locks against
--     would sit beyond the reach of CHECKs, foreign keys and row locks;
--   * not columns on family.categories — a reward is for one or several Profiles, and is not a
--     property of any of them.

create table if not exists family.rewards (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references family.households(id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 120),
  description    text check (description is null or length(description) <= 2000),
  emoji          text check (emoji is null or length(emoji) <= 16),
  -- FR-416: the reference's own bound, 1..500 (44739096640667).
  point_value    smallint not null check (point_value between 1 and 500),
  -- FR-430: "Renew after redeeming" (44739096640667); the reference's field name.
  respawn_on_redemption boolean not null default false,
  created_by     uuid references family.categories(id) on delete set null,
  updated_by     uuid references family.categories(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint rewards_id_household_key unique (id, household_id)
);

-- One reward, several Profiles, each with their own progress and their own redemptions
-- (FR-417, Assumption 7). Why a table and not `category_ids uuid[]` on rewards: the Profile's
-- deletion must cascade here (FR-443), the Profiles-only rule is a trigger here, and a
-- redemption's eligibility check is one indexed row here — none of which reaches inside an array.
create table if not exists family.reward_eligibilities (
  household_id  uuid not null references family.households(id) on delete cascade,
  reward_id     uuid not null,
  category_id   uuid not null,
  created_at    timestamptz not null default now(),
  primary key (reward_id, category_id),
  constraint reward_eligibilities_reward_fk foreign key (reward_id, household_id)
    references family.rewards (id, household_id) on delete cascade,
  constraint reward_eligibilities_category_fk foreign key (category_id, household_id)
    references family.categories (id, household_id) on delete cascade
);

create index if not exists reward_eligibilities_category_idx
  on family.reward_eligibilities (household_id, category_id);

-- FR-414: a Label has no balance and can never be eligible. The assert_task_assignee() pattern.
create or replace function family.assert_reward_eligibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from family.categories c
     where c.id = new.category_id and c.household_id = new.household_id and c.is_profile
  ) then
    raise exception 'a reward can only be for a Profile' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function family.assert_reward_eligibility() from public;

drop trigger if exists reward_eligibility_is_profile on family.reward_eligibilities;
create trigger reward_eligibility_is_profile
  before insert or update on family.reward_eligibilities
  for each row execute function family.assert_reward_eligibility();

drop trigger if exists touch on family.rewards;
create trigger touch before update on family.rewards
  for each row execute function family.touch_updated_at();

alter table family.rewards enable row level security;
alter table family.reward_eligibilities enable row level security;
drop policy if exists "members read rewards" on family.rewards;
create policy "members read rewards" on family.rewards
  for select to authenticated using (family.is_member(household_id));
drop policy if exists "members read reward eligibilities" on family.reward_eligibilities;
create policy "members read reward eligibilities" on family.reward_eligibilities
  for select to authenticated using (family.is_member(household_id));

grant select on family.rewards, family.reward_eligibilities to authenticated;
grant all on family.rewards, family.reward_eligibilities to service_role;
