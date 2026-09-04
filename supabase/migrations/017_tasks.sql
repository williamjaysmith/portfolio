-- 017_tasks.sql — family.tasks: one row per chore or routine definition (FR-317).
-- Occurrences are computed, never stored (Key Entities). Chore sub-types fall out
-- of the date and time fields; Late is never stored (FR-325). Scheduled Date is a
-- rule, Completed Date is a delay whose cursor lives in the resolution chain (018).
-- Serves: FR-317..FR-346 (the record, its sub-types and both repeat modes),
-- FR-365 (up for grabs), FR-390 (tenancy, no client write path), R306.
-- Contains no personal data.

-- The three time-of-day slots (FR-302, FR-335). A domain, following 001's
-- family.palette_color: a closed value set shared by two objects.
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'family' and t.typname = 'time_of_day'
  ) then
    execute $domain$
      create domain family.time_of_day as text
        check (value in ('morning', 'afternoon', 'evening'))
    $domain$;
  end if;
end $$;

create table if not exists family.tasks (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,

  summary       text not null check (length(trim(summary)) between 1 and 120),   -- FR-319
  description   text check (description is null or length(description) <= 2000), -- FR-321
  emoji         text check (emoji is null or length(emoji) <= 16),               -- FR-320

  routine       boolean not null default false,   -- FR-317: the one discriminator
  up_for_grabs  boolean not null default false,   -- FR-365
  track_habit   boolean not null default false,   -- FR-337

  -- The household-local date this task's schedule STARTS: a one-off chore's due
  -- date, a repeating chore's first due date and its rule anchor, a routine's
  -- first eligible day. NULL only on an Anytime chore (FR-325, FR-328).
  -- "The date it was due" (FR-358) is the OCCURRENCE's date, never this column.
  starts_on     date,
  -- Wall clock in the household zone (FR-326), never an instant: an instant would
  -- fabricate a date for an Anytime chore and re-import the drift Phase 2 avoided
  -- by keeping all-day events as plain dates.
  due_time      time,

  -- FR-335: the slots a routine generates on every matching date. Empty on a chore.
  times_of_day  family.time_of_day[] not null default '{}',

  -- REPEAT, mode 1 — a RULE. Scheduled Date (FR-340/341) and every routine's
  -- repeat (FR-334). The Phase 2 column contract verbatim (no 'RRULE:' prefix, no
  -- COUNT, UNTIL inside the rule, emitted only by the server) plus R305's FREQ
  -- whitelist and INTERVAL bound. Identical text to 022's events constraint.
  rrule         text constraint tasks_rrule_grammar check (
    rrule is null or (
          rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY);INTERVAL=([1-9]|[1-9][0-9])(;|$)'
      and rrule !~ '(^|;)COUNT='
    )
  ),

  -- REPEAT, mode 2 — a DELAY (FR-342). `renew_after_amount is not null` IS the
  -- mode; 0 means "Immediately". There is NO next_due_date column: the open
  -- occurrence is derived from the resolution chain (018, family.task_cursors).
  renew_after_amount smallint check (renew_after_amount is null
                                     or renew_after_amount between 0 and 99),
  renew_after_unit   text check (renew_after_unit in ('day', 'week', 'month')),
  renew_until        date,                          -- FR-346, cursor mode only

  -- Reserved for the rewards phase (FR-329, SC-319) — the Phase 2
  -- countdown_enabled pattern. Nothing in Phase 3 reads, shows, edits or totals
  -- it. No upper bound: the two star-value guidance bands conflict and neither is
  -- a limit (Assumption 1, Contradiction 4), so only the sign is asserted.
  reward_points smallint check (reward_points is null or reward_points >= 0),

  -- Attribution (FR-330 audit surface). Single-column FKs, exactly as 010's:
  -- a COMPOSITE fk with `on delete set null` would null household_id too.
  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Composite-FK target: lets 017/018 prove tenancy referentially.
  constraint tasks_id_household_key unique (id, household_id),

  -- FR-338/FR-365: only a chore can be up for grabs.
  constraint task_up_for_grabs_is_a_chore check (not (up_for_grabs and routine)),
  -- FR-337: habit tracking on a chore is unrepresentable, not merely unoffered.
  constraint task_habit_is_a_routine check (track_habit is false or routine),
  -- FR-333/FR-334: a routine has no due time and always repeats on a rule.
  constraint task_routine_shape check (
    not routine or (due_time is null and rrule is not null and renew_after_amount is null)
  ),
  -- FR-333/FR-335, US2-7: a routine carries at least one slot, a chore none. The
  -- seven literals make non-emptiness, canonical order and DEDUPLICATION all
  -- structural — a repeated slot would emit two identical occurrences, double a
  -- column's denominator (FR-305) and collide on the occurrence key at the
  -- second tick.
  constraint task_slots_shape check (
    case when routine then times_of_day in (
      array['morning']::family.time_of_day[],
      array['afternoon']::family.time_of_day[],
      array['evening']::family.time_of_day[],
      array['morning','afternoon']::family.time_of_day[],
      array['morning','evening']::family.time_of_day[],
      array['afternoon','evening']::family.time_of_day[],
      array['morning','afternoon','evening']::family.time_of_day[])
    else times_of_day = '{}'::family.time_of_day[] end
  ),
  -- FR-325: a due time requires a due date. An Anytime chore has neither.
  constraint task_time_needs_a_date check (due_time is null or starts_on is not null),
  -- FR-328 + FR-343: either repeat needs an anchor (a rule needs one to walk from,
  -- a chain needs a seed), so an Anytime chore is STRUCTURALLY incapable of
  -- repeating — exactly one undated occurrence, for ever.
  constraint task_repeat_needs_an_anchor check (
    starts_on is not null or (rrule is null and renew_after_amount is null)
  ),
  -- FR-339: the two repeat modes are mutually exclusive.
  constraint task_repeat_modes_exclusive check (num_nonnulls(rrule, renew_after_amount) <= 1),
  -- The cursor mode owns its two companion fields; nothing else may carry them.
  constraint task_cursor_shape check (
    case when renew_after_amount is null
      then renew_after_unit is null and renew_until is null
      else renew_after_unit is not null
    end
  )
);

drop trigger if exists touch on family.tasks;
create trigger touch before update on family.tasks
  for each row execute function family.touch_updated_at();

-- The board fetches every task row for the household, unwindowed (see data-model
-- "How the board is read"), so one index serves the whole read path.
create index if not exists tasks_household_idx on family.tasks (household_id);

alter table family.tasks enable row level security;
drop policy if exists "members read tasks" on family.tasks;
create policy "members read tasks" on family.tasks
  for select to authenticated using (family.is_member(household_id));
grant select on family.tasks to authenticated;
grant all    on family.tasks to service_role;
