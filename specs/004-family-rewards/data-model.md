# Phase 4 Data Model: Family Rewards

**Feature**: `004-family-rewards` | **Date**: 2026-09-05

What Phase 4 adds to the `family` schema: **four tables** (`rewards`, `reward_eligibilities`,
`star_entries`, `redemptions`), **one view** (`family.star_balances`, `security_invoker`), **six
trigger functions and one helper** (`household_today`), and the publication entries that put the four tables on the existing
live-update channel. **No shipped table changes shape.** `tasks.reward_points` and
`task_box_items.reward_points` already exist (017, 021) with their `>= 0` CHECK; Phase 4 reads and
writes them and bounds them to 0–500 in validation (spec Assumption 4).

Semantics follow the reference's verified record shape wherever it verified one: `reward_points`
on a task (`[V](skylight-api)`), `name` / `description` / `point_value` / `respawn_on_redemption`
on a reward (`[V](skylight-api)`), a per-Profile balance (`[V](skylight-api — reward_points keyed
by category_id)`), a reward assignable to several Profiles with progress kept apart
(`[V](44739096640667)`). Where it diverges — one reward with several eligibilities instead of one
row per Profile, a ledger instead of two counters — the spec's Assumptions 5 and 7 and the master
map's divergence 6 decide, and the sections below say so.

**The ledger is the truth, and the database writes most of it.** A completion's credit and an
un-tick's retraction are trigger consequences of the shipped `task_resolutions` row (R401); a
redemption's debit and an unredemption's refund are trigger consequences of a `redemptions` row
(R403). The only ledger rows an action inserts directly are hand adjustments — and a trigger
guards those too. No RPC exists on the write path.

---

## Entity overview

```
households
    │ 1:N
    ├────────── categories (Profiles + Labels; Phase 1)
    │              ▲   ▲   ▲   ▲
    │              │   │   │   └── created_by / updated_by / actor columns (single-column FK, set null)
    │              │   │   └────── redemptions.category_id      (cascade — the Profile who redeemed)
    │              │   └────────── star_entries.category_id     (cascade — the Profile credited; FR-443)
    │              └────────────── reward_eligibilities.category_id (cascade; Profiles only, trigger)
    │
    ├────────── tasks (017; reward_points read by the credit trigger)
    │              └── task_resolutions (019) ──trigger──▶ star_entries (credit on INSERT complete,
    │                                                                    retraction on DELETE)
    ├────────── rewards (024) ◄── reward_eligibilities (024)
    │              └── redemptions (026) ──trigger──▶ star_entries (redemption on INSERT,
    │                                                                refund on UPDATE reversed_at)
    └────────── star_entries (025) ──▶ family.star_balances (025: security_invoker view, one row per Profile)
```

`star_entries` references a resolution and a redemption by id **without foreign keys**, and copies
the title and the amount, so a deleted task, reward or occurrence leaves its stars where they were
(FR-411, FR-421, R405).

---

## Migrations

Numbered **024–027**, after Phase 3's 017–023. Each is idempotent (`if not exists`, `create or
replace`, drop-then-create for triggers) so `supabase db reset` and a hosted `db push` both work,
and each `CREATE TABLE` header records why the table is not a fold into an existing one.

| # | File | Contents | Serves |
|---|---|---|---|
| 024 | `024_rewards.sql` | `family.rewards`, `family.reward_eligibilities`, `assert_reward_eligibility()`, policies, grants | FR-415–FR-421, FR-442 |
| 025 | `025_star_ledger.sql` | `family.star_entries`, `family.star_balances`, `credit_task_resolution()` (AFTER INSERT on `task_resolutions`), `retract_task_resolution()` (BEFORE DELETE), `assert_star_adjustment()` (BEFORE INSERT on adjustment rows), policies, grants | FR-405–FR-414, FR-434–FR-436 |
| 026 | `026_redemptions.sql` | `family.redemptions`, `assert_redemption()` (BEFORE INSERT), `record_redemption()` (AFTER INSERT/UPDATE), policies, grants | FR-424–FR-433 |
| 027 | `027_realtime_rewards.sql` | Guarded publication adds for the four tables; `notify pgrst, 'reload schema'` | FR-410 |

---

## 024 — Rewards and eligibilities

```sql
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
```

## 025 — The star ledger, the balance view, and the resolution triggers

```sql
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
```

## 026 — Redemptions

```sql
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
```

## 027 — Realtime

The 022 block verbatim, over `array['rewards', 'reward_eligibilities', 'star_entries', 'redemptions']`,
followed by `notify pgrst, 'reload schema'`. Replica identity is left at the default — a deleted
reward's name must not travel in a DELETE payload, the same rule as a deleted task's title.

---

## How the tab and the board are read

| Read | Key | Shape | Why this window |
|---|---|---|---|
| `star_entries` for the anchored week | `familyKeys.starWeek(h, weekStart)` | `where earned_on between … ` — credits and retractions only, dated by the day they were earned | FR-407's pill is the displayed day's net; the week window is `taskWeek`'s, so stepping inside a week costs nothing (R314) |
| `star_balances` | `familyKeys.balances(h)` | one row per Profile | every bar, button and header on the Rewards tab; the delete dialog's forfeited count |
| `rewards` + `reward_eligibilities` embed | `familyKeys.rewards(h)` | definitions, unwindowed | the tab's cards; the eligibility list on the details |
| `redemptions` | `familyKeys.redemptions(h)` | all, standing and reversed, ordered by `redeemed_at desc` | standing ones decide a one-time reward's muted card; the Redeemed switch shows them |

`page.tsx` for `/family/tasks` seeds `starWeek` beside its four Phase 3 keys; `page.tsx` for
`/family/rewards` seeds the other three. The bare `["family"]` invalidation sweeps all four.

## Invariants

1. **Balance = Σ entries.** No other column holds it; the view is the only reader that sums for
   display, the two triggers the only ones that sum to decide.
2. **One credit and one retraction per resolution; one debit and one refund per redemption** —
   four partial unique indexes, not four careful code paths.
3. **A credit's amount is the task's value at the moment of the completion** — read inside the
   trigger, never afterwards (FR-409).
4. **An adjustment never overdraws; a retraction may** (FR-436, Assumption 5) — enforced by kind.
4b. **A retraction is written only for a deliberate delete of one resolution** — an un-tick, or a
   "this occurrence" delete of a completed occurrence; a cascade from a task's or a Profile's
   deletion writes none (FR-411, FR-443).
5. **A redemption's cost is the reward's stored cost at the moment of the write**, copied by the
   trigger, never accepted from the caller (FR-428).
6. **One standing redemption per (one-time reward, Profile)**; any number for a renewing one.
7. **Eligibility is Profiles-only** and cascades with the Profile; a reward eligible for nobody is
   deleted by `deleteCategory`'s cleanup (FR-443), never left as a card in no column.
8. **Every star write for one Profile is serialised** by the lock on their `categories` row
   inside the trigger that decides — two devices redeeming one balance cannot both pass.
9. **Entries and redemptions are append-only** in every path the actions use: no UPDATE on
   `star_entries` anywhere; the one UPDATE on `redemptions` is the reversal, and the trigger
   refuses any other.

## What the database enforces, and what the action does

| Rule | Database | Action |
|---|---|---|
| credit on complete, retraction on undo | triggers 025 | nothing — the resolution verbs are unchanged |
| skip earns nothing | trigger reads `status` | — |
| task's value 0–500, cost 1–500, eligible ≥ 1 | `reward_points >= 0` CHECK (017/021); `point_value` CHECK; eligibility rows | Zod: 0–500 and blank→null; cost; at least one Profile; unknown keys refused |
| affordability, eligibility, one standing one-time redemption | `assert_redemption()` under lock | maps `P0005`/`P0006`/`P0007` → `FORBIDDEN`/`CONFLICT` with the spec's wording |
| the refund exactly once | `record_redemption()` + unique index | maps `P0008` → `CONFLICT` |
| no overdraft by hand | `assert_star_adjustment()` | maps `P0004` → `VALIDATION` naming the Profile; shows the before-and-after |
| who may redeem / adjust / manage | — | `requireVerifiedActor()` + the target rule; `requireParent()` |
| a Profile's forfeited stars, rewards left for nobody | cascades | `deleteCategory` cleanup + the dialog's third count |

## Privilege matrix (delta)

| Object | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `rewards`, `reward_eligibilities`, `star_entries`, `redemptions` | — | SELECT | ALL |
| `star_balances` (view, `security_invoker`) | — | SELECT | SELECT |
| `household_today(uuid)` | — | — | — (trigger-internal; `security definer`, revoked from public) |
| `assert_reward_eligibility()`, `credit_task_resolution()`, `retract_task_resolution()`, `assert_star_adjustment()`, `assert_redemption()`, `record_redemption()` | — | — | — |

`privileges.test.ts`'s `TABLES` and `FUNCTIONS` arrays grow in the same commit as 024–027; any
`anon` grant is a failure. `household_today` is listed under functions with no grants at all — it
is called only from `security definer` trigger bodies, which run as the owner.

## Dashboard / config steps

None in the Dashboard. One config change that is not a migration: `.fallowrc.json` gains

```json
{ "name": "family-rewards-core", "patterns": ["lib/family/rewards/**/*"] }
```

with the rule `{ "from": "family-rewards-core", "allow": ["family-rewards-core", "family-tasks-core", "lib"] }`
and `"family-rewards-core"` added to the allow lists of `family-actions`, `components`, `ui-pages`
and `tests` (R418).

## What later phases add here

Nothing this phase reserves. A notifications phase would read `star_entries` and `redemptions` as
they are; a Lists/Meals phase touches none of these tables.
