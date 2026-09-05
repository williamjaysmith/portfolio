-- 019_task_resolutions.sql — one row per RESOLVED occurrence: completed or
-- skipped (FR-360, Contradiction 5). Absence of a row IS "outstanding", so an
-- endless routine costs nothing until somebody acts (Key Entities). The key is
-- the SCHEDULED date (FR-353); resolved_on is the day it was actually ticked,
-- which for a late chore is a different day (FR-354). cycle_prev links a
-- Completed Date chore's cycles into a chain (FR-343/344/362).
-- Serves: FR-343..FR-344, FR-348..FR-364, FR-367..FR-370, R308/R309.
-- Requires PostgreSQL 15+: `unique nulls not distinct` and the `on delete set
-- null (column_list)` form are both PG 15 features.
-- Contains no personal data.
--
-- Why a table, and not a fold into a table that already exists:
--   * not a `resolved_at` column or a JSONB `resolutions` key on family.tasks —
--     a task has MANY resolutions, one per (assignee, date, slot, cycle), so a
--     column cannot hold them, and a JSONB map could carry neither the
--     five-column occurrence key that is at once FR-353's identity and FR-370's
--     single-claim rule nor the cycle_prev self-reference FR-344 refuses through;
--   * not a discriminated row on family.event_exceptions — an exception
--     overrides one occurrence's content and is keyed by its date alone; a
--     resolution records who did what and when, keyed by five columns, and
--     overrides nothing.

create table if not exists family.task_resolutions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references family.households(id) on delete cascade,
  task_id         uuid not null,

  -- The occurrence's ORIGINAL household-local date (FR-353, Phase 2's R204 key).
  -- NULL for an Anytime chore's single undated occurrence (FR-328).
  occurrence_date date,
  -- Which slot, for a routine (FR-335: "exactly what distinguishes two occurrences
  -- of a chore that repeats morning and evening"). NULL on a chore.
  occurrence_slot family.time_of_day,

  -- THE CHAIN'S OWNER — the assignee whose occurrence this is (FR-324: each
  -- assignee has their own occurrences, resolutions and streak), or NULL for an
  -- up-for-grabs task, whose single chain belongs to the household (FR-363).
  -- Distinct from category_id: an up-for-grabs chore's claimant differs cycle to
  -- cycle, so the credit cannot identify the chain.
  assignee_id     uuid,

  -- The Profile CREDITED (FR-354, FR-368). Null only on a skip of an unclaimed
  -- up-for-grabs occurrence, which belongs to nobody — or afterwards, if that
  -- claimant's Profile is deleted (see the FK note below).
  category_id     uuid,

  -- The previous cycle of a Completed Date chore (FR-343). NULL at a chain head
  -- and on EVERY rule-mode row, which is what makes the occurrence key below
  -- degenerate to Phase 2's date key everywhere else.
  cycle_prev      uuid,

  status          text not null check (status in ('complete', 'skipped')),

  -- FR-354: the household-local day it was ticked or skipped — a DIFFERENT day
  -- from occurrence_date for a late chore — and the day the Completed Date cycle
  -- counts from, for BOTH statuses (FR-343, FR-362, Assumption 15).
  resolved_on     date not null,
  resolved_at     timestamptz not null default now(),

  -- The punched-in actor (FR-350, FR-354, Assumption 3). May differ from
  -- category_id: "Ana ticked Cleo's homework" is a fact the record keeps.
  created_by      uuid references family.categories(id) on delete set null,
  created_at      timestamptz not null default now(),

  -- FR-324/FR-363/FR-370: ONE resolution per occurrence per chain. NULLS NOT
  -- DISTINCT (PG 15+) is what makes the undated, unslotted, household-chain and
  -- chain-head cases collide instead of admitting duplicates.
  constraint task_resolutions_occurrence_key unique nulls not distinct
    (task_id, assignee_id, occurrence_date, occurrence_slot, cycle_prev),

  -- Composite-FK target for the self-referencing chain link below.
  constraint task_resolutions_id_task_key unique (id, task_id),

  constraint task_resolutions_task_fk foreign key (task_id, household_id)
    references family.tasks (id, household_id) on delete cascade,

  -- FR-391: deleting a Profile removes that Profile's own resolutions — which are
  -- exactly the rows on that Profile's own chains. Cascade, in one statement.
  constraint task_resolutions_assignee_fk foreign key (assignee_id, household_id)
    references family.categories (id, household_id) on delete cascade,

  -- The credit is nulled, not cascaded: cascading it would delete a link out of
  -- the middle of an up-for-grabs household chain, rewinding the cursor and
  -- resurrecting a settled occurrence (r-completed-date §8.8). The PG 15 COLUMN
  -- LIST is mandatory here — a bare `on delete set null` on a composite FK would
  -- null household_id too, which is `not null`.
  constraint task_resolutions_category_fk foreign key (category_id, household_id)
    references family.categories (id, household_id) on delete set null (category_id),

  -- The chain link. Composite so a cycle can never point at another task's row.
  -- NO ACTION, not RESTRICT, and the difference is load-bearing: NO ACTION is
  -- checked at end of statement, so `delete … where assignee_id = $1` removes a
  -- whole chain in one statement (FR-391) while a SINGLE-row delete of a link
  -- that still has a child fails with 23503 — which IS FR-344, as a foreign key.
  constraint task_resolutions_cycle_fk foreign key (cycle_prev, task_id)
    references family.task_resolutions (id, task_id) on delete no action,

  -- For an assigned task the credit is the assignee; the extra null branch is
  -- what lets the credit FK above null itself without fighting this CHECK.
  constraint task_resolution_credit_shape check (
    assignee_id is null or category_id is null or category_id = assignee_id
  )
);

-- The two windowed board reads (data-model "How the board is read") and the
-- FR-391 scan.
create index if not exists task_resolutions_window_idx
  on family.task_resolutions (household_id, occurrence_date);
-- The task_cursors anti-join, and the referencing side of the FR-344 delete check.
create index if not exists task_resolutions_cycle_prev_idx
  on family.task_resolutions (cycle_prev) where cycle_prev is not null;

-- Rules that read another row, so no CHECK can hold them. Fired on INSERT
-- ONLY — which is what FR-332 requires: converting a repeating chore into a
-- one-off, flipping up-for-grabs, or changing a repeat must never re-evaluate a
-- stored resolution, and the ONE update that ever reaches this table is the
-- credit FK nulling itself. Resolutions are otherwise append-and-delete.
create or replace function family.assert_task_resolution() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_routine boolean; v_repeats boolean; v_ufg boolean; v_cursor boolean;
        v_prev_assignee uuid;
begin
  select t.routine,
         t.rrule is not null or t.renew_after_amount is not null,
         t.up_for_grabs,
         t.renew_after_amount is not null
    into v_routine, v_repeats, v_ufg, v_cursor
    from family.tasks t
   where t.id = new.task_id and t.household_id = new.household_id;
  if not found then
    raise exception 'no such task in this household' using errcode = '23503';
  end if;

  -- FR-359: skip exists for routines and repeating chores only.
  if new.status = 'skipped' and not (v_routine or v_repeats) then
    raise exception 'only a routine or a repeating chore can be skipped' using errcode = '23514';
  end if;
  -- FR-368: a completion is never WRITTEN anonymous.
  if new.status = 'complete' and new.category_id is null then
    raise exception 'a completion must credit a Profile' using errcode = '23514';
  end if;
  -- FR-363: only an unclaimed up-for-grabs occurrence may be resolved for nobody.
  if new.category_id is null and not v_ufg then
    raise exception 'only an up-for-grabs occurrence may be resolved for nobody'
      using errcode = '23514';
  end if;
  -- FR-365 + FR-324: the chain owner is the assignee, or nobody when the task
  -- belongs to nobody. One equivalence, both directions.
  if v_ufg <> (new.assignee_id is null) then
    raise exception 'the chain owner is the assignee, or nobody for an up-for-grabs task'
      using errcode = '23514';
  end if;
  -- FR-339/FR-343: only a Completed Date chore has cycles at all.
  if new.cycle_prev is not null and not v_cursor then
    raise exception 'only a Completed Date chore links its resolutions into a cycle'
      using errcode = '23514';
  end if;
  -- A cycle stays inside ONE chain. The composite FK already pins the task; this
  -- pins the owner, so a chain can never fork across assignees.
  if new.cycle_prev is not null then
    select r.assignee_id into v_prev_assignee
      from family.task_resolutions r where r.id = new.cycle_prev;
    if v_prev_assignee is distinct from new.assignee_id then
      raise exception 'a cycle link must stay inside one chain' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function family.assert_task_resolution() from public;
drop trigger if exists task_resolution_is_valid on family.task_resolutions;
create trigger task_resolution_is_valid
  before insert on family.task_resolutions
  for each row execute function family.assert_task_resolution();

alter table family.task_resolutions enable row level security;
drop policy if exists "members read task resolutions" on family.task_resolutions;
create policy "members read task resolutions" on family.task_resolutions
  for select to authenticated using (family.is_member(household_id));
grant select on family.task_resolutions to authenticated;
grant all    on family.task_resolutions to service_role;
