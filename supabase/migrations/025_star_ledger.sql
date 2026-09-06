-- 025_star_ledger.sql — family.star_entries: every movement of stars for one Profile, append-only
-- (FR-405..FR-412, Assumption 5, master map divergence 6), and family.star_balances, the sum.
-- Contains no personal data beyond a task's or reward's title copied at the time.
--
-- Why a table, and not a fold into a table that already exists:
--   * not `current_point_balance` / `lifetime_points_earned` columns on family.categories — the
--     reference's two mutable counters are exactly what divergence 6 rejects: a counter can drift
--     from the events that produced it, and un-checking becomes a subtraction to be trusted;
--   * not columns on family.task_resolutions — a resolution earns at most one credit but a Profile's
--     stars also move on redemption, refund and hand adjustment, which have no resolution; and a
--     retraction must outlive the resolution row it reverses;
--   * not a `kind`-discriminated row on family.task_resolutions — a redemption, a refund and a
--     hand adjustment have no resolution to attach to, and a retraction must outlive the
--     resolution row it reverses;
--   * not a JSONB ledger on family.categories — a sum the redeem check locks against and an index
--     the board's day window reads cannot reach inside a document.

create table if not exists family.star_entries (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references family.households(id) on delete cascade,
  -- The Profile credited or debited — never the actor (FR-405). Cascades: a deleted Profile's
  -- stars are forfeited with them (FR-443).
  category_id     uuid not null,
  amount          integer not null check (amount <> 0),
  kind            text not null check (kind in ('credit', 'retraction', 'redemption', 'refund', 'adjustment')),
  -- The household day the stars were EARNED — the resolution's `resolved_on`, which for a late
  -- chore is the day it was ticked, not the day it was due (FR-405, the spec's late-chore edge
  -- case; 003 FR-354). What FR-407's pill sums. Null on the three kinds that have no occurrence.
  earned_on date,
  -- Loose references (no FK): history survives the deletion of what it was for (FR-411, FR-421).
  resolution_id   uuid,
  redemption_id   uuid,
  -- What it was for, as it was: the task's or reward's title. Null on an adjustment.
  summary         text,
  -- The punched-in actor (FR-405); the household day of the write.
  created_by      uuid references family.categories(id) on delete set null,
  entered_on      date not null,
  created_at      timestamptz not null default now(),
  constraint star_entries_category_fk foreign key (category_id, household_id)
    references family.categories (id, household_id) on delete cascade,
  constraint star_entry_kind_shape check (
    (kind in ('credit', 'retraction') and earned_on is not null and resolution_id is not null and redemption_id is null)
    or (kind in ('redemption', 'refund') and redemption_id is not null and resolution_id is null and earned_on is null)
    or (kind = 'adjustment' and resolution_id is null and redemption_id is null and earned_on is null)
  ),
  constraint star_entry_sign_shape check (
    (kind in ('credit', 'refund') and amount > 0)
    or (kind in ('retraction', 'redemption') and amount < 0)
    or kind = 'adjustment'
  )
);

-- The balance (one sum per Profile) and the day window (the board's pill) are the two reads.
create index if not exists star_entries_balance_idx on family.star_entries (household_id, category_id);
create index if not exists star_entries_day_idx on family.star_entries (household_id, earned_on)
  where earned_on is not null;
-- One credit and one retraction per resolution, at most (SC-402 by index, not by care taken).
create unique index if not exists star_entries_credit_once_idx on family.star_entries (resolution_id)
  where kind = 'credit';
create unique index if not exists star_entries_retraction_once_idx on family.star_entries (resolution_id)
  where kind = 'retraction';
create unique index if not exists star_entries_redemption_once_idx on family.star_entries (redemption_id)
  where kind = 'redemption';
create unique index if not exists star_entries_refund_once_idx on family.star_entries (redemption_id)
  where kind = 'refund';

-- FR-412: the balance is derived. security_invoker: the caller's own RLS on star_entries applies.
create or replace view family.star_balances with (security_invoker = true) as
  select c.household_id, c.id as category_id,
         coalesce(sum(e.amount), 0)::integer as balance
    from family.categories c
    left join family.star_entries e on e.category_id = c.id and e.household_id = c.household_id
   where c.is_profile
   group by c.household_id, c.id;

-- The household's day, for entered_on and for an anytime chore's credit (FR-405: "the day of the
-- completion"). Mirrors what the actions compute; kept in SQL so the trigger needs no argument.
create or replace function family.household_today(p_household_id uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone s.timezone)::date
    from family.household_settings s where s.household_id = p_household_id
$$;
revoke all on function family.household_today(uuid) from public;

-- R401: a completion credits the task's value AT THAT MOMENT to the Profile credited, on the day
-- it was ticked (resolved_on — a late chore earns today, FR-405). A skip, a task worth nothing,
-- or a completion with nobody credited writes nothing.
create or replace function family.credit_task_resolution()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_points smallint; v_summary text;
begin
  if new.status <> 'complete' or new.category_id is null then return new; end if;
  select t.reward_points, t.summary into v_points, v_summary
    from family.tasks t where t.id = new.task_id and t.household_id = new.household_id;
  if v_points is null or v_points <= 0 then return new; end if;
  insert into family.star_entries
    (household_id, category_id, amount, kind, earned_on, resolution_id, summary, created_by, entered_on)
  values
    (new.household_id, new.category_id, v_points, 'credit',
     new.resolved_on, new.id, v_summary, new.created_by,
     family.household_today(new.household_id));
  return new;
end $$;
revoke all on function family.credit_task_resolution() from public;

drop trigger if exists task_resolution_credits_stars on family.task_resolutions;
create trigger task_resolution_credits_stars
  after insert on family.task_resolutions
  for each row execute function family.credit_task_resolution();

-- R401: an un-tick retracts exactly what the credit gave, as a second entry, even below zero
-- (Assumption 5). BEFORE delete so the row is still there to read; the partial unique index above
-- makes a second retraction impossible rather than merely unlikely.
--
-- An un-tick, NOT a cascade. The resolution also goes when its task is deleted (019's task FK) or
-- when the credited Profile is deleted (019's assignee FK), and neither is an un-tick: a deleted
-- task's stars stay earned (FR-411) and a deleted Profile's stars go with them by their own
-- cascade on star_entries (FR-443) — an insert for a Profile mid-deletion would fail its FK and
-- block the deletion. So the retraction is written only while the task AND the credited Profile
-- still exist, which is exactly the shape of a deliberate delete of one resolution: an un-tick,
-- or `deleteTask`'s "this occurrence" on a completed occurrence, which retracts like one.
create or replace function family.retract_task_resolution()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_credit family.star_entries%rowtype;
begin
  select * into v_credit from family.star_entries
   where resolution_id = old.id and kind = 'credit';
  if not found then return old; end if;
  if not exists (select 1 from family.tasks where id = old.task_id and household_id = old.household_id)
     or not exists (select 1 from family.categories where id = v_credit.category_id and household_id = old.household_id) then
    return old;   -- a cascade: the stars stay (task) or go with the Profile (category), never retracted
  end if;
  if exists (select 1 from family.star_entries where resolution_id = old.id and kind = 'retraction') then
    return old;
  end if;
  insert into family.star_entries
    (household_id, category_id, amount, kind, earned_on, resolution_id, summary, created_by, entered_on)
  values
    (v_credit.household_id, v_credit.category_id, -v_credit.amount, 'retraction',
     v_credit.earned_on, old.id, v_credit.summary, null, family.household_today(old.household_id));
  return old;
end $$;
revoke all on function family.retract_task_resolution() from public;

drop trigger if exists task_resolution_retracts_stars on family.task_resolutions;
create trigger task_resolution_retracts_stars
  before delete on family.task_resolutions
  for each row execute function family.retract_task_resolution();

-- R403 / FR-436: a hand adjustment may not overdraw. The lock on the Profile's row serialises
-- every star write for that Profile; a multi-row INSERT is one statement, so one refusal rolls
-- back every chosen Profile's row.
create or replace function family.assert_star_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_balance integer;
begin
  if new.kind <> 'adjustment' then return new; end if;
  if new.amount not between -500 and 500 then
    raise exception 'an adjustment is between -500 and 500 stars' using errcode = '23514';
  end if;
  perform 1 from family.categories where id = new.category_id and household_id = new.household_id for update;
  select coalesce(sum(amount), 0) into v_balance from family.star_entries
   where category_id = new.category_id and household_id = new.household_id;
  if v_balance + new.amount < 0 then
    raise exception 'that would leave the balance below zero' using errcode = 'P0004';
  end if;
  return new;
end $$;
revoke all on function family.assert_star_adjustment() from public;

drop trigger if exists star_adjustment_is_affordable on family.star_entries;
create trigger star_adjustment_is_affordable
  before insert on family.star_entries
  for each row execute function family.assert_star_adjustment();

-- Entries are append-only: no UPDATE policy, no UPDATE grant to anyone but service_role, and the
-- actions never issue one. A reversal is a second row.
alter table family.star_entries enable row level security;
drop policy if exists "members read star entries" on family.star_entries;
create policy "members read star entries" on family.star_entries
  for select to authenticated using (family.is_member(household_id));
grant select on family.star_entries to authenticated;
grant all on family.star_entries to service_role;
grant select on family.star_balances to authenticated, service_role;

notify pgrst, 'reload schema';
