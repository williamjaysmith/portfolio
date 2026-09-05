-- 026_redemptions.sql — family.redemptions: that one Profile redeemed one reward, with the cost as
-- it was; reversible, never erased (FR-424..FR-433, Assumption 9). Contains no personal data.
--
-- Why a table, and not a fold into a table that already exists:
--   * not `redeemed_at` / `redeemed_by` on family.rewards (the reference's own shape) — a reward
--     here is for several Profiles at once and may be redeemed many times when it renews, so one
--     pair of columns cannot describe its state;
--   * not a row on family.star_entries with a discriminator — the debit IS a ledger row, but the
--     thing it debits for needs its own identity to be reversed, shown as "Redeemed on", and locked
--     against a second one-time redemption; a ledger row is immutable by design and cannot carry
--     `reversed_at`;
--   * not a JSONB history on family.rewards — a redemption outlives the reward's cost and must be
--     found by Profile, which an index on a table does and a document cannot.

create table if not exists family.redemptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  reward_id     uuid not null,
  category_id   uuid not null,
  -- The cost as it was (FR-428): the reward's point_value may change afterwards (FR-420).
  point_value   smallint not null check (point_value between 1 and 500),
  -- Copied so the history card and the ledger can still say what it was after the reward goes.
  reward_name   text not null,
  redeemed_on   date not null,
  redeemed_at   timestamptz not null default now(),
  redeemed_by   uuid references family.categories(id) on delete set null,
  reversed_at   timestamptz,
  reversed_by   uuid references family.categories(id) on delete set null,
  constraint redemptions_reward_fk foreign key (reward_id, household_id)
    references family.rewards (id, household_id) on delete cascade,
  constraint redemptions_category_fk foreign key (category_id, household_id)
    references family.categories (id, household_id) on delete cascade,
  constraint redemption_reversal_shape check (
    (reversed_at is null and reversed_by is null) or reversed_at is not null
  )
);

create index if not exists redemptions_profile_idx on family.redemptions (household_id, category_id, redeemed_at desc);
create index if not exists redemptions_reward_idx on family.redemptions (reward_id, category_id) where reversed_at is null;

-- R403 / FR-428, FR-429, FR-430: the check-and-debit as one act. The lock on the Profile's row is
-- what makes the sum trustworthy against a second device; point_value and reward_name are copied
-- here from the reward, never trusted from the caller.
create or replace function family.assert_redemption()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_reward family.rewards%rowtype; v_balance integer;
begin
  perform 1 from family.categories where id = new.category_id and household_id = new.household_id for update;
  select * into v_reward from family.rewards
   where id = new.reward_id and household_id = new.household_id for share;
  if not found then
    raise exception 'no such reward in this household' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from family.reward_eligibilities
     where reward_id = new.reward_id and category_id = new.category_id
  ) then
    raise exception 'that reward is not for this Profile' using errcode = 'P0005';
  end if;
  if not v_reward.respawn_on_redemption and exists (
    select 1 from family.redemptions
     where reward_id = new.reward_id and category_id = new.category_id and reversed_at is null
  ) then
    raise exception 'already redeemed' using errcode = 'P0006';
  end if;
  select coalesce(sum(amount), 0) into v_balance from family.star_entries
   where category_id = new.category_id and household_id = new.household_id;
  if v_balance < v_reward.point_value then
    raise exception 'not enough stars' using errcode = 'P0007';
  end if;
  new.point_value := v_reward.point_value;
  new.reward_name := v_reward.name;
  new.redeemed_on := family.household_today(new.household_id);
  new.reversed_at := null;
  new.reversed_by := null;
  return new;
end $$;
revoke all on function family.assert_redemption() from public;

drop trigger if exists redemption_is_affordable on family.redemptions;
create trigger redemption_is_affordable
  before insert on family.redemptions
  for each row execute function family.assert_redemption();

-- The debit on INSERT; the refund on the one UPDATE that sets reversed_at (FR-431). A second
-- reversal, or an UPDATE of anything else, is refused: a redemption is otherwise immutable —
-- except the attribution columns, which a deleted Profile's FK nulls (see inside).
create or replace function family.record_redemption()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into family.star_entries
      (household_id, category_id, amount, kind, redemption_id, summary, created_by, entered_on)
    values
      (new.household_id, new.category_id, -new.point_value, 'redemption', new.id, new.reward_name,
       new.redeemed_by, new.redeemed_on);
    return new;
  end if;
  -- The attribution columns' `on delete set null` (a deleted actor, FR-443) is
  -- an UPDATE too: it changes only redeemed_by / reversed_by and is let through
  -- without writing anything — a redemption survives the person who made it.
  if new.reversed_at is not distinct from old.reversed_at
     and new.reward_id = old.reward_id and new.category_id = old.category_id
     and new.point_value = old.point_value and new.redeemed_at = old.redeemed_at
     and (new.redeemed_by is null or new.redeemed_by = old.redeemed_by)
     and (new.reversed_by is null or new.reversed_by = old.reversed_by)
     and (new.redeemed_by is distinct from old.redeemed_by
          or new.reversed_by is distinct from old.reversed_by) then
    return new;
  end if;
  if old.reversed_at is not null then
    raise exception 'already unredeemed' using errcode = 'P0008';
  end if;
  if new.reversed_at is null
     or new.reward_id <> old.reward_id or new.category_id <> old.category_id
     or new.point_value <> old.point_value or new.redeemed_at <> old.redeemed_at then
    raise exception 'a redemption can only be reversed' using errcode = '23514';
  end if;
  insert into family.star_entries
    (household_id, category_id, amount, kind, redemption_id, summary, created_by, entered_on)
  values
    (new.household_id, new.category_id, new.point_value, 'refund', new.id, new.reward_name,
     new.reversed_by, family.household_today(new.household_id));
  return new;
end $$;
revoke all on function family.record_redemption() from public;

drop trigger if exists redemption_records_stars on family.redemptions;
create trigger redemption_records_stars
  after insert or update on family.redemptions
  for each row execute function family.record_redemption();

alter table family.redemptions enable row level security;
drop policy if exists "members read redemptions" on family.redemptions;
create policy "members read redemptions" on family.redemptions
  for select to authenticated using (family.is_member(household_id));
grant select on family.redemptions to authenticated;
grant all on family.redemptions to service_role;

notify pgrst, 'reload schema';
