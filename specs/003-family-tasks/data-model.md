# Phase 3 Data Model: Family Tasks

**Feature**: `003-family-tasks` | **Date**: 2026-09-04

What Phase 3 adds to the `family` schema: **four tables** (`tasks`, `task_assignees`,
`task_resolutions`, `task_box_items`), **one domain** (`family.time_of_day`), **one view**
(`family.task_cursors` — the schema's first), **three trigger functions**, **one seed function**,
the publication entries that put the board on the existing live-update channel, and **one
alteration to a shipped Phase 2 table** — the `events.rrule` CHECK, tightened to bound `INTERVAL`
(FR-345, Assumption 14). No Phase 1 table changes shape at all; `family.categories.show_on_tasks`
and `sort_order` already exist and are used unchanged (FR-313, FR-309).

Semantics follow the reference product's verified record shape wherever the research verified one:
one record type told apart by the `routine` boolean (FR-317 `[V]`), the field names `summary`,
`description`, `emoji`, `routine`, `up_for_grabs`, `reward_points`, the reserved star value
(FR-329 `[V]`), the scheduled-date-plus-slot occurrence identity (FR-353 `[V]`), and the
`this` / `this_and_future` / `all` delete scopes with the reference's own asymmetry (FR-347 `[V]`).

**There are no occurrence rows.** The spec's Key Entities decides it — *"Occurrences are worked out
from the task, never stored one by one"* — so an endless routine costs one row plus one join row
per assignee, and stores nothing at all until somebody acts on it. Phase 2's `event_exceptions` is
deliberately **not** reused: an event skip means the occurrence does not exist, a task skip means it
existed and was resolved, and FR-331 removes the per-occurrence override payload that table exists
to carry (Assumption 19).

---

## Reconciling the two research lanes on Completed Date

The schema lane (`r-schema.md` §3, D303) and the client lane (`r-client.md` R332) both store the
Completed Date cursor as `tasks.next_due_date`. The dedicated lane (`r-completed-date.md`) says it
must not ship. **This document adopts the dedicated lane**, because two of its findings are
correctness failures rather than preferences, and neither of the other two lanes considers them:

1. **A stored cursor on `tasks` is on the wrong table under FR-324.** A Completed Date chore
   assigned to Ana and Ben has two independent cycles ("each of them has their own occurrence, their
   own resolution"). One column on `tasks` means Ben ticking on Thursday moves Ana's due date.
   Relocating it to `task_assignees` fixes that and leaves an up-for-grabs chore — which has no
   assignee row (FR-365) — with nowhere to keep its cursor.
2. **`After → Immediately` (FR-342/343) breaks the occurrence key on the mode's main path.** A chore
   completed *on* its due date schedules the next one on that same date. Two occurrences, one task,
   one assignee, one date, no slot — Phase 2's date key (R204) cannot hold both, and the household
   reads the duplicate-key failure as *"it says I already did it"*.

So the mode is a **linked chain of resolution rows**: `task_resolutions.cycle_prev` points at the
previous cycle's row, `assignee_id` names the chain's owner, and the open occurrence is **derived**
(`tail.resolved_on + delay`, or the seed when the chain has no tail). The chain tail is published to
the browser-direct read as `family.task_cursors`. What the other two lanes gain in exchange:
`tasks.next_due_date` does not ship, the two resolution RPCs they proposed are not needed (the
unique index and one foreign key carry FR-370 and FR-344 structurally — see [018](#018--task-resolutions-the-resolution-chain)),
and `lib/family/recurrence/` is untouched by the mode. Everything else in both lanes stands.

---

## Entity overview

```
households ◄──1:1── household_settings              (Phase 1 + 013 timezone; untouched here)
    │ 1:N
    ├────────── categories                           (Phase 1: Profiles + Labels;
    │              ▲  ▲  ▲                            unique (id, household_id) added by 011)
    │              │  │  │
    │              │  │  └── created_by / updated_by / actor  (single-column FK, set null)
    │              │  │
    │              │  └───── task_resolutions.assignee_id  (cascade — the chain's owner)
    │              │  └───── task_resolutions.category_id  (set null (category_id) — the credit)
    │              │
    │              └──────── task_assignees.category_id    (cascade — FR-391)
    │
    ├────────── tasks ◄──────── task_assignees      (017: who + routine order + streak pair)
    │              ▲   one row per chore or routine definition; occurrences are computed
    │              │
    │              │  composite FK (task_id, household_id), on delete cascade
    │              │
    │              └───────── task_resolutions      (018: one row per RESOLVED occurrence,
    │                              │                  complete or skipped)
    │                              │ cycle_prev (self-FK, on delete NO ACTION)
    │                              └──────────────▶ the Completed Date chain
    │                                                     ▲
    │                                          family.task_cursors (019: security_invoker
    │                                          view — one tail row per chain)
    │
    └────────── task_box_items                      (020: seventeen seeded templates)
```

---

## Migrations

Continuing Phase 2's numbering (001–015 shipped; plain numeric prefixes). Each file is idempotent
where that is cheap, opens with a comment naming what it creates and which requirement it serves,
ends *"Contains no personal data"*, and carries no household-specific values — the Phase 1/2
discipline verbatim. Every function is `SECURITY DEFINER` with `search_path = ''`, schema-qualifies
every name, and is `revoke`d from `public` immediately after creation.

| # | File | Contents | Serves |
|---|---|---|---|
| 016 | `016_tasks.sql` | `family.time_of_day` domain; `family.tasks` with the whole constraint set (including `tasks_rrule_grammar`); one index; touch trigger; read policy; grants | FR-317…FR-346, FR-365, FR-390 |
| 017 | `017_task_assignees.sql` | `family.task_assignees` (assignment + `sort_order` + the streak pair); `assert_task_assignee()`; `assert_up_for_grabs_is_unassigned()`; index; read policy; grants | FR-310, FR-322…FR-324, FR-365, FR-371…FR-374, FR-391 |
| 018 | `018_task_resolutions.sql` | `family.task_resolutions` (completions **and** skips, and the Completed Date chain); the occurrence key; `assert_task_resolution()`; two indexes; read policy; grants | FR-343…FR-344, FR-348…FR-364, FR-367…FR-370 |
| 019 | `019_task_cursors.sql` | `family.task_cursors`, a `security_invoker` view over the chain tails; grants; `notify pgrst, 'reload schema'` | FR-343, FR-362, FR-366 |
| 020 | `020_task_box_items.sql` | `family.task_box_items`; `family.seed_task_box(uuid)` and its call for the seeded household | FR-376…FR-382 |
| 021 | `021_realtime_tasks.sql` | Guarded publication adds for the four tables; `notify pgrst, 'reload schema'` | FR-392, Assumption 39 (P2) |
| 022 | `022_recurrence_interval.sql` | The `family.events.rrule` CHECK, tightened to a FREQ whitelist + `INTERVAL` 1–99; **nothing else** | FR-345, Assumption 14 |

**Why 022 is last, and why it is not 016.** An early draft numbered this ALTER 016, before the
table map was fixed; the constraint text below is **R305**'s, unchanged — only its file number and
its position move, and R305 itself already numbers it 022 and sequences it last. (R304 is
`ruleDatesIn`, a different decision entirely.) It is sequenced **last on purpose**: the shipped CHECK never mentioned `INTERVAL`
(010 line 29 is `^FREQ=` plus a `COUNT` ban and nothing else), so the database **already accepts**
`INTERVAL=2` and no migration unblocks the grammar work. Landing the parser, emitter, expander and
their byte-stability corpus **first**, against a database nobody has touched, is the stronger
evidence that no live series moved; the tightening then lands as a deliberate backstop.
`family.tasks.rrule` carries the identical named CHECK inline from birth in 016, so there is never a
moment when the two tables disagree about what a rule may say.

Locally, `supabase db reset` applies all twenty-two. `supabase db push` to the hosted project is an
operator step, preceded by one read-only check ([022](#022--the-recurrence-check-and-its-safety-on-live-phase-2-rows))
and requiring no post-push step.

**PostgreSQL 15+ is a hard dependency of 018 and 019** — `unique nulls not distinct`,
`on delete set null (column_list)` and `security_invoker` views are all PG 15 features. Local
`config.toml` pins `major_version = 17`; **the hosted project's version must be confirmed before
018 is written.** The fallbacks, if it were older, are one `coalesce` expression index for the key,
a plain single-column FK for the credit, and a `security definer` view with an explicit
`is_member()` predicate — all uglier, all avoidable.

---

## 016 — Tasks

```sql
-- 016_tasks.sql — family.tasks: one row per chore or routine definition (FR-317).
-- Occurrences are computed, never stored (Key Entities). Chore sub-types fall out
-- of the date and time fields; Late is never stored (FR-325). Scheduled Date is a
-- rule, Completed Date is a delay whose cursor lives in the resolution chain (018).
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
  -- COUNT, UNTIL inside the rule, emitted only by the server) plus R304's FREQ
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

-- The board fetches every task row for the household, unwindowed (see "How the
-- board is read"), so one index serves the whole read path.
create index if not exists tasks_household_idx on family.tasks (household_id);

alter table family.tasks enable row level security;
drop policy if exists "members read tasks" on family.tasks;
create policy "members read tasks" on family.tasks
  for select to authenticated using (family.is_member(household_id));
grant select on family.tasks to authenticated;
grant all    on family.tasks to service_role;
```

**Naming.** `summary`, `description`, `emoji`, `routine`, `up_for_grabs`, `reward_points` copy the
reference's verified field names, per Phase 2's discipline. Six reference fields are deliberately
absent: `timer_seconds` (the companion timer is excluded from the project), `origin` (its enum is
unknown), `series` and `group` (artefacts of server-side instance expansion this project does not
do), `is_future` (derived), and `position` — which becomes `task_assignees.sort_order`, because
FR-311 forbids reordering chores at all and FR-310 scopes routine order to one section for one
Profile, which is per-assignee state.

**Why `starts_on` and not `due_date`.** A routine has no date (FR-333) but a rule needs an anchor,
and once `INTERVAL=N` lands (FR-345) that anchor is load-bearing arithmetic rather than a lower
bound: `dateMatches` becomes anchor-relative (R303). One column serves both — the day a chore is
due and the day a routine begins. The chore's *due date* is not lost, because it was never a
column: it is the occurrence's date, which is what FR-358's late banner shows and what FR-353 keys
a resolution by.

**Why no `repeat_mode` enum.** Phase 2 invariant 2, verbatim: *the presence of `events.rrule` is the
single source of truth for "does this event repeat"*. An enum beside the fields can disagree with
the fields; `num_nonnulls(rrule, renew_after_amount) <= 1` cannot. It also matches FR-325's own
philosophy — kinds fall out of the fields, not from a parallel choice.

**Why no write grants to `authenticated`**: identical to Phase 1's and Phase 2's reasoning, binding
hardest here. RLS can see which *account* is asking but not which *profile is punched in* — that
lives in the signed actor cookie the database never sees — and FR-350/FR-388/SC-303 demand a
punched-in actor for every task write, with FR-351 demanding a decision that depends on *which
record* is being touched. All mutations pass through server actions writing with the `service_role`
grant, every write scoped `.eq('household_id', householdId)` because with the service role there is
no RLS — that clause is the tenancy check.

**Validation rules**

| Field | Rule |
|---|---|
| `summary` | required, 1–120 chars trimmed (FR-319; the name copies the reference's verified field) |
| `description` | ≤ 2000 chars, shown in the details view and matched by search (FR-321, FR-386) |
| `emoji` | optional, ≤ 16 chars — one grapheme cluster with modifiers, not a string (FR-320) |
| `routine` | the type; a conversion is one UPDATE and is never refused for carrying resolutions (FR-318, FR-332) |
| `starts_on` / `due_time` | the four chore sub-types (FR-325); a routine has neither; a time needs a date; Late is never stored |
| `times_of_day` | exactly one of seven sets on a routine, empty on a chore (FR-335) |
| `rrule` | null, or the whitelisted FREQ + `INTERVAL` 1–99 + no `COUNT`; the canonical grammar is enforced by the parser at the action boundary (FR-345) |
| `renew_after_amount` / `_unit` | 0–99 + day/week/month; `0` **is** "Immediately"; both null in rule mode (FR-342) |
| `renew_until` | cursor mode only — a rule's end date lives inside its own `UNTIL` (FR-346) |
| `up_for_grabs` | chores only, and the task must carry no assignee (FR-338, FR-365) |
| `track_habit` | routines only, on every surface (FR-337) |
| `reward_points` | reserved; no interface, no index, nothing reads it (FR-329, SC-319) |
| `created_by` / `updated_by` | set from the punched-in actor by every action (FR-330) |

---

## 017 — Task assignees

```sql
-- 017_task_assignees.sql — who a task is for (FR-322/324), in that Profile's own
-- routine order (FR-310), with that Profile's own habit streak (FR-371).
-- Zero rows = up for grabs (FR-365). Contains no personal data.

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
```

**Why a trigger and not a composite FK for the Profile rule.** The 011 pattern — a redundant
`unique (id, household_id, is_profile)` on `categories` plus a constant column on the join, giving a
referential guarantee in both directions — was considered and rejected: it costs an ALTER on a
shipped Phase 1 table and a denormalised constant column, and its extra strength (catching a
category *flipped* from Profile to Label while assignments exist) buys nothing, because
`is_profile` is immutable after creation in the shipped code — `lib/family/validation.ts` accepts it
"only for creation" and the update path re-uses `existing.isProfile`. A BEFORE trigger covers every
write that can actually happen.

**`up_for_grabs ⇔ no assignees` is enforced only in the two directions a statement can take.** The
converse — *"a task that is not up for grabs has at least one assignee"* (FR-322) — is an
**action-tier rule**, deliberately: the spec names data-store enforcement in exactly two places
(FR-323, FR-390) and FR-322 is not one of them, and a deferred constraint trigger asserting it would
refuse the very first statement of a Profile deletion, whose cascade legitimately leaves an orphan
for the action's next statement to clear (FR-391). The residual is stated in
[What the database enforces](#what-the-database-enforces-and-what-the-action-does).

**No `created_by`/`updated_by` on the join row**: a pure join has no independent lifecycle, and
`tasks.updated_by` is where FR-330's attribution already lives whenever an edit rewrites the
assignee set. `created_at` stays, because the Completed Date seed reads it.

---

## 018 — Task resolutions (the resolution chain)

```sql
-- 018_task_resolutions.sql — one row per RESOLVED occurrence: completed or
-- skipped (FR-360, Contradiction 5). Absence of a row IS "outstanding", so an
-- endless routine costs nothing until somebody acts (Key Entities). The key is
-- the SCHEDULED date (FR-353); resolved_on is the day it was actually ticked,
-- which for a late chore is a different day (FR-354). cycle_prev links a
-- Completed Date chore's cycles into a chain (FR-343/344/362).
-- Contains no personal data.

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

-- The two windowed board reads (see "How the board is read") and the FR-391 scan.
create index if not exists task_resolutions_window_idx
  on family.task_resolutions (household_id, occurrence_date);
-- The task_cursors anti-join, and the referencing side of the FR-344 delete check.
create index if not exists task_resolutions_cycle_prev_idx
  on family.task_resolutions (cycle_prev) where cycle_prev is not null;

-- Four rules that read another row, so no CHECK can hold them. Fired on INSERT
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
```

**The key, explained.** A row per `(task, date)` is not enough. FR-335 makes the slot part of the
identity; FR-324 makes the assignee part of it; FR-328 makes the date nullable; FR-343's
`After → Immediately` makes two cycles share a date, so `cycle_prev` is the fifth column. Every
rule-mode row carries `cycle_prev = NULL`, so for routines, Scheduled Date chores, one-offs and
Anytime chores the key **is** `(task, assignee, date, slot)` — Phase 2's date key, inherited whole.

**Two spec requirements this index discharges without any code.**

- **FR-370 / SC-311, the same-second claim.** Two devices claiming one up-for-grabs occurrence both
  write `assignee_id = NULL` (the household chain) with the same date, slot and cycle. Identical
  key, so the second insert fails `23505`; the action re-reads the winning row and refuses with the
  message naming the credited Profile. The reference-shaped alternative — keying by the *credited*
  profile — makes the two claims differ and records both, which is why `assignee_id` exists as a
  column separate from `category_id`. The ordinary double-tap (Edge Cases: *"the second write finds
  it already resolved and reports the state"*) is the same code path.
- **FR-344, undoing a Completed Date completion.** Undo is `delete … where id = $1` and nothing
  else: the cursor retreats because the tail retreats. When the occurrence that completion scheduled
  has itself been resolved, the child row's `cycle_prev` still points at the row being deleted and
  the FK raises `23503` — the refusal, as a foreign key, with no read-then-write window for a
  concurrent completion to slip through. FR-361's unskip is the same removal and inherits the same
  guard for free, which the spec does not say and the plan should.

**Why there is no `next_due_date`, and no resolve RPC.** See
[the reconciliation](#reconciling-the-two-research-lanes-on-completed-date). With the cursor
derived, the two resolution verbs are **one statement each** — an insert, or a delete — so the
half-states that earned Phase 2's `split_event_series` its `SECURITY DEFINER` function (*a
truncated head with no tail is a wrong calendar*) do not arise here. The one companion write that
remains is the streak checkpoint on `task_assignees`, and its half-state is a stale badge that
FR-374's recompute-on-undo already heals; that is Phase 1's documented non-atomic-action posture,
not Phase 2's data-loss bar. Recorded as a residual below rather than engineered around.

**No `updated_at` and no touch trigger.** A resolution is never updated by any action: un-complete
and unskip both *delete* the row (FR-355 "removing the resolution rather than marking it"; FR-361
returns it to unresolved). The only UPDATE that ever touches this table is the credit FK nulling
itself when a Profile is deleted. Grants stay the house `ALL` rather than `SELECT, INSERT, DELETE`,
so the privileges test keeps one uniform shape and the rewards phase is not blocked by a migration
when it wants to stamp a points snapshot onto the row.

---

## 019 — The cursor view

```sql
-- 019_task_cursors.sql — the tail of every Completed Date chain, published to the
-- browser-direct read. The row that decides what is due today may be arbitrarily
-- old — a chore on "after 6 months" was last resolved outside every window the
-- board fetches — and PostgREST cannot express a per-group LIMIT, so the
-- anti-join lives here. The schema's first view. Contains no personal data.
create or replace view family.task_cursors with (security_invoker = true) as
  select distinct on (r.household_id, r.task_id, r.assignee_id)
         r.household_id,
         r.task_id,
         r.assignee_id,
         r.id          as tail_id,
         r.resolved_on as tail_resolved_on
    from family.task_resolutions r
    join family.tasks t
      on t.id = r.task_id and t.household_id = r.household_id
   where t.renew_after_amount is not null                       -- cursor mode only
     and not exists (select 1 from family.task_resolutions n where n.cycle_prev = r.id)
   order by r.household_id, r.task_id, r.assignee_id,
            r.resolved_on desc, r.created_at desc;

-- security_invoker means the underlying tables' RLS applies to the CALLER, so the
-- view needs no policy of its own and inherits is_member() (FR-390). Without it a
-- view is read with its owner's privileges and would leak every household.
grant select on family.task_cursors to authenticated, service_role;

notify pgrst, 'reload schema';
```

**Why `distinct on` and not the anti-join alone.** A well-formed chain has exactly one unreferenced
row. A chore **converted** from Scheduled Date to Completed Date (FR-318) has many: every rule-mode
row it already carries has `cycle_prev = NULL` and is referenced by nothing. The tie-break —
`resolved_on desc, created_at desc` — is well-defined because `resolved_on` is always "today at
write time" (FR-354) and therefore monotone in write order, and it gives the parent exactly what
switching modes asks for: the chore's next appearance is *last done + delay*. Pinning it in SQL
rather than in the client means the renderers and the actions cannot disagree about which row is the
tail.

**What the client does with it** (`lib/family/tasks/cursor.ts`, pure and total):

```
openOccurrence(task, tail, chainStartedOn):
  date = tail ? addDelay(tail.tailResolvedOn, task.renewAfter)
              : max(task.startsOn, chainStartedOn)          // the seed
  return (task.renewUntil !== null && date > task.renewUntil) ? null : { date }
```

`addDelay` is plain-date arithmetic on `plain-date.ts`'s epoch-day helpers: `day`/`week` are `+n` /
`+7n`; `month` is calendar-month addition **clamped to the last day of the target month**
(31 Jan + 1 month = 28 Feb). That is deliberately the opposite answer to the same question in rule
mode, where a `BYMONTHDAY=31` rule is simply silent in a 30-day month — a rule may legitimately
produce nothing in a month, a cursor must always land somewhere or the chore is lost.
`chainStartedOn` is `task_assignees.created_at::date` (the task's own for the household chain), so
adding Ben to a chore whose due date was six months ago starts him **today** rather than six months
late. The delay is date arithmetic, never instant arithmetic: FR-326's DST rules apply to the
chore's `due_time`, carried unchanged onto every cycle, and never to the interval.

**The honest ceiling**, stated the way Phase 2 states the week read's: this is an anti-join over the
resolution history of the household's Completed Date chores — tens of rows per chore per year,
right at one household's scale and wrong for a multi-tenant product. A materialised tail arrives
additively if it ever costs anything measurable, and the chain stays the source of truth either way.

---

## 020 — The Task Box

```sql
-- 020_task_box_items.sql — reusable templates (FR-376..FR-382). FR-377 fixes the
-- field set EXACTLY: a title, an optional emoji, a type, and the reserved star
-- value. No description, date, repeat or assignment. Contains no personal data —
-- the seventeen titles are reference product data, not this household's.
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

notify pgrst, 'reload schema';
```

**Committed SQL, not the seed script.** Phase 1's rule sends *household-specific* data to
`scripts/family-seed.mjs` (constitution §VII) — emails, names, a real timezone. These seventeen
titles are reference product data with no personal content, and 007 already commits the household
row and its settings on exactly that basis. The function shape is what makes Assumption 23's
*"a second household starts identically"* true without duplicating the list in JavaScript, and
SC-318 can then assert seventeen rows from SQL.

**No `sort_order`**: no requirement orders templates and FR-389's parent-only verb list contains no
template reorder, so the read orders by `summary` within each section and Phase 1's
no-unused-columns rule holds. **No unique key on `(household_id, summary)`**: FR-379's "Save to task
box" would then fail on a repeated title, a refusal no requirement sanctions.

---

## 021 — Realtime

The guarded `do $$ … $$` block of 009/014, verbatim, over `tasks`, `task_assignees`,
`task_resolutions`, `task_box_items` — publication-existence check, `puballtables` early return,
per-table `if not exists` before each `alter publication … add table` — then
`notify pgrst, 'reload schema'`.

**Replica identity stays at the default (primary key); `replica identity full` is prohibited.**
Phase 1's and Phase 2's reasoning binds hardest here: Realtime does not apply RLS to DELETE
payloads, and a deleted task's `summary` is precisely the child's-schedule data constitution §VII
protects. The consequence, already resolved by the spec (FR-392: notices carry no task content): a
DELETE payload carries only PK columns — `tasks.id`, `(task_id, category_id)`,
`task_resolutions.id` — never `household_id`, so a `household_id=eq.<hid>`-filtered subscription
would silently never fire on deletes. The four task tables are therefore subscribed **without** the
server-side household filter, and every payload is a bare invalidation signal: *something changed,
re-read*.

**This phase deletes on the hot path**, which Phase 2 did not: an un-complete and an unskip each
remove a `task_resolutions` row (FR-355, FR-361), so the unfiltered subscription is not a
precaution here but the mechanism SC-306 depends on.

---

## 022 — The recurrence CHECK, and its safety on live Phase 2 rows

```sql
-- 022_recurrence_interval.sql — bound INTERVAL on the shipped events rule column
-- (003 FR-345, Assumption 14). family.tasks carries the IDENTICAL constraint text
-- from birth (016). The parser (lib/family/recurrence/grammar.ts) remains the
-- contract; this is the backstop, exactly R201's posture. Contains no personal data.

-- 010 declared the rule check inline and unnamed, so Postgres generated a name.
-- Drop it BY DEFINITION rather than by a guessed name: a `drop constraint if
-- exists events_rrule_check` that silently matches nothing would leave the old
-- constraint standing beside the new one for ever.
do $$
declare v_name text;
begin
  select c.conname into v_name
    from pg_constraint c
   where c.conrelid = 'family.events'::regclass
     and c.contype = 'c'
     and c.conname <> 'events_rrule_grammar'
     and pg_get_constraintdef(c.oid) like '%rrule%';
  if v_name is not null then
    execute format('alter table family.events drop constraint %I', v_name);
  end if;
end $$;

alter table family.events add constraint events_rrule_grammar check (
  rrule is null or (
        rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY);INTERVAL=([1-9]|[1-9][0-9])(;|$)'
    and rrule !~ '(^|;)COUNT='
  )
);
```

**Why this exact regex.** `(;|$)` is what rejects `INTERVAL=100` and `INTERVAL=01`: POSIX
leftmost-longest tries `10` then `1`, and neither is followed by `;` or end-of-string; `01` fails
because `[1-9]` cannot match `0`. It deliberately does **not** attempt the whole grammar — `UNTIL`,
`WKST`, `BYDAY`, `BYMONTHDAY`, the fixed field order and the new rule that `WKST` is *required* on
`FREQ=WEEKLY` with `INTERVAL > 1` are all unexpressed, because duplicating a 200-line parser as a
regex is how two implementations drift. R201's own argument against a FREQ whitelist (FR-233:
storage must accept a richer imported Skylight rule) is **superseded in one direction only**: three
FREQ values are the whole set the emitter can write and the parser will accept, so a stored value
outside it is unreadable by definition and the whitelist costs nothing that was ever reachable.
Recorded here as a knowing narrowing of R201 rather than left to be noticed.

**Safety on live rows — the four things that make this a non-event.**

1. **It is strictly tighter than what shipped, over a domain the emitter cannot leave.** Every
   stored rule was written by `emitRule`, the sole producer, which always writes
   `FREQ=<DAILY|WEEKLY|MONTHLY>;INTERVAL=1;…`. `ADD CONSTRAINT … CHECK` validates every existing row
   at ALTER time, and every existing row passes.
2. **Prove it before pushing, do not assume it.** Run this read-only against the **hosted** database
   first, and do not write the migration until it returns zero rows:

   ```sql
   select id, rrule from family.events
    where rrule is not null
      and (rrule !~ '^FREQ=(DAILY|WEEKLY|MONTHLY);INTERVAL=([1-9]|[1-9][0-9])(;|$)'
           or rrule ~ '(^|;)COUNT=');
   ```

   A hit is not a reason to loosen the regex; it is a row that needs explaining.
3. **The lock is real but trivial here.** `ADD CONSTRAINT` takes `ACCESS EXCLUSIVE` and scans the
   table. At a household's series count — dozens — that is sub-millisecond, so no
   `NOT VALID` + `VALIDATE CONSTRAINT` dance is warranted. Stated for the record: on a large table
   the two-step form takes only `SHARE UPDATE EXCLUSIVE` for the validating pass.
4. **It is reversible with no data motion.** The down path is `drop constraint events_rrule_grammar`
   and, if the pre-Phase-3 surface is wanted exactly, re-adding 010's predicate. No row is rewritten
   in either direction, and no Phase 2 code reads the constraint.

**And it changes nothing about how Phase 2 behaves.** The widening lives in the TypeScript grammar,
which re-emits an interval-1 rule byte-identically (`INTERVAL` was already always written, in slot
2), and `lib/family/types.ts`'s existing `RepeatChoice` and its Zod schema are left exactly as they
are — a `strictObject` without an `interval` key, so an event client sending `interval: 2` is
refused at the boundary. The plan carries a test asserting the calendar's contract did **not**
widen; widening the storage grammar must not silently widen the calendar's.

---

## How the board is read (why the indexes are shaped this way)

The Tasks tab renders **every column from one set of cached reads** — the Up for Grabs column and
all profile columns — and the per-profile split is client-side. Four RLS-governed reads, all under
the `["family"]` prefix so Phase 1's bare `invalidateQueries({ queryKey: familyKeys.all })` sweeps
them with zero new machinery:

| # | Query | Key | Window | Index |
|---|---|---|---|---|
| 1 | `fetchTasks` — every `family.tasks` row for the household, `task_assignees` (with the streak pair) embedded | `familyKeys.tasks(hid)` | **none** | `tasks_household_idx` |
| 2 | `fetchTaskResolutions` — rows whose `occurrence_date` falls in the anchored **week** containing the displayed day, **plus every `occurrence_date is null` row** | `familyKeys.taskWeek(hid, weekStartISO)` | one week | `task_resolutions_window_idx` |
| 3 | `fetchTaskCarryForward` — rows in `[today − 28, weekStart(today) − 1]`, `enabled` only while the displayed day **is** today | `familyKeys.taskCarry(hid, todayISO)` | the FR-357 tail | `task_resolutions_window_idx` |
| 4 | `fetchTaskCursors` — `family.task_cursors` | `familyKeys.taskCursors(hid)` | **none** | `task_resolutions_cycle_prev_idx` |

Plus a fifth, lazy and off the critical path: `familyKeys.taskBox(hid)`, `enabled` only while the
Task Box sheet is open (seventeen rows nobody looks at on a normal day).

**Definitions are not windowed, and that is not laziness.** Any due-date window over `tasks` would
be *wrong*, not merely suboptimal: an Anytime chore has no date (FR-328), a Completed Date chore's
only occurrence is a cursor (FR-343), a routine is a rule, and a chore due three weeks ago must
appear on today's board (FR-356). This is Phase 2's "every series row is always fetched" argument
arriving at the same place for the same reason, at the same scale — a household's tasks number in
the dozens. Keying them by the displayed day (an earlier proposal) would refetch byte-identical
rows on every Previous/Next tap and duplicate them across up to 29 cache entries.

**Resolutions are windowed** because they are the one thing that grows without bound — roughly
thirty rows a day at three profiles. The week is the quantum: stepping day by day inside a week
costs zero fetches, the boundary is warmed by the same ±7 neighbour prefetch Phase 2 ships, and it
is the shape the deferred Week view (FR-385) will want. The carry tail is a **separate, disjoint**
entry ending at `weekStart(today) − 1` rather than a widened window, because FR-357 puts a
carried-forward occurrence on today's board and on its own day and **nowhere between**, so a pinned
past day needs none of it; keying it by `todayISO` is what makes it roll at midnight by itself
(FR-315).

**Expansion is client-side, shared with the server, and non-bypassable.** One
`expandTaskDay(tasks, resolutions, cursors, { displayedDate, todayDate, zone })` in
`lib/family/tasks/expand.ts` — that name and that signature everywhere, `research.md` R315 —
is the single entry point every renderer uses — and the same module the resolve and delete actions
call to validate an occurrence key, so client and server can never disagree about what an occurrence
is (Phase 2's contract, applied to tasks). It shares a newly extracted `ruleDatesIn()` with the
shipped event expander, so the FR-345 widening produces **one** engine and not two.
`CARRY_FORWARD_DAYS = 28` lives once, in `lib/family/tasks/dates.ts`, and is consumed by both read
(3) and the expander's second pass, so the number the read is bounded by and the number the render
is bounded by are the same number by construction.

**One occurrence is exempt from that bound, and it is not an oversight** (FR-343 vs FR-357, resolved
in `research.md` R316). The carry pass skips the 28-day bound for an occurrence whose task has
`renew_after_amount is not null` — the Completed Date open occurrence. Bounded literally, a chore
neglected for 29 days would be on no reachable screen, nothing could resolve it, and because that
occurrence **is** the cursor, no later one could ever be scheduled: the chore would be lost by
inattention, which is the failure this mode exists to prevent. Assumption 7's stated reason for the
bound is accumulation, and a mode with at most one open occurrence cannot accumulate — it contributes
exactly one card, for ever, the shape FR-328 already sanctions for an anytime chore. Read (3)'s
window is unaffected: the cursor tail arrives through read (4), which is unwindowed, so the exemption
costs the read nothing. Rule-mode chores keep the bound exactly as FR-357 states it.

**One consequence Phase 2 does not have, worth writing down before QA finds it**: a resolution
changes what is on *future* days. Completing today's Completed Date occurrence creates tomorrow's.
Phase 1's bare `["family"]` invalidation already sweeps every task key, so this costs nothing today
— but that blunt invalidation is now **load-bearing** rather than merely convenient, and narrowing
it later would break this mode first.

**The honest ceiling**: O(all tasks + one week of resolutions + a 28-day tail + one anti-join over
the cursor chains) per read, per invalidation. Right at one household's scale, wrong for a
multi-tenant product — the same trade Phase 2 recorded, at the same size.

---

## Invariants

The properties the schema holds structurally, stated so tests can pin them and reviews can check
against them:

1. **One record type.** Chores and routines differ by `routine` and by which scheduling columns they
   may populate (`task_routine_shape`, `task_slots_shape`), never by table. A type conversion
   (FR-318) is one UPDATE and is never refused for carrying resolutions (FR-332), because no
   constraint or trigger on `task_resolutions` re-reads the parent's current shape after insert.
2. **The four chore sub-types are unrepresentable as anything else.** Timed = `starts_on` +
   `due_time`; All-day = `starts_on`, no time; Anytime = neither; **Late is never stored at all** —
   it is a read over unresolved occurrences (FR-325). A time without a date is refused
   (`task_time_needs_a_date`), and an Anytime chore is *structurally incapable of repeating*
   (`task_repeat_needs_an_anchor`), which is FR-328's "exactly one undated occurrence" made
   mechanical.
3. **The two repeat modes cannot coexist** (`task_repeat_modes_exclusive`) and each owns its own
   fields (`task_cursor_shape`); a routine can only ever be in rule mode (`task_routine_shape`).
   A Completed Date chore has **at most one open occurrence** because the open occurrence is the
   single derived successor of a single chain tail, and the chain is a list.
4. **A routine's slot set is always one of seven** — non-empty, canonically ordered, deduplicated —
   and a chore's is always empty (`task_slots_shape`).
5. **Habit tracking on a chore is unrepresentable** (`task_habit_is_a_routine`, FR-337), and so is
   an up-for-grabs routine (`task_up_for_grabs_is_a_chore`, FR-338).
6. **An up-for-grabs task has no assignee**, in both write directions (the two 017 triggers), and
   **a Label can never be assigned a task** (`assert_task_assignee`, FR-323) — refused at the data
   store, which is one of only two places the spec demands that.
7. **One resolution per occurrence per chain** —
   `unique nulls not distinct (task_id, assignee_id, occurrence_date, occurrence_slot, cycle_prev)`.
   Absence of a row is "outstanding"; there is no pending row to garbage-collect, so an endless
   routine stores nothing until somebody acts. The same index is FR-370's single-claim rule, because
   every claimant of an unclaimed occurrence writes the household chain's `assignee_id = NULL`.
8. **The occurrence key is the SCHEDULED date, never the resolution date.** A late chore's identity
   survives being ticked days later (FR-353); `resolved_on`/`resolved_at` record what actually
   happened (FR-354) and are non-null on skips as well as completions, because FR-362 advances a
   cycle from the skip date.
9. **The chain is a chain.** `cycle_prev` is NULL on every rule-mode row and at every chain head; a
   link can never point at another task's row (the composite FK) or at another assignee's chain (the
   insert trigger); and a link with a child cannot be deleted (`on delete no action` → `23503`),
   which is FR-344 as a foreign key. A whole chain still deletes in one statement, which is why the
   action is NO ACTION and not RESTRICT.
10. **A completion is never *written* anonymous** (`assert_task_resolution`, FR-368), and a
    resolution crediting nobody is possible only on an up-for-grabs task (FR-363). The one way a
    *stored* completion loses its credit is the deletion of the Profile that claimed an up-for-grabs
    occurrence, which nulls the credit rather than rewinding the household's chain — a refinement of
    FR-391 the plan must state, because the alternative resurrects a settled occurrence.
11. **Only a routine or a repeating chore can be skipped** (FR-359) — and an existing skip survives a
    later conversion to a one-off, because the trigger fires on INSERT only (FR-332).
12. **Resolutions are append-and-delete.** No action ever updates one (FR-355, FR-361), which is why
    they carry no `updated_at`; the sole UPDATE that can reach the table is the credit FK nulling
    itself.
13. **Every cross-table reference proves tenancy** through a composite FK `(x_id, household_id)`, so
    a task assigned to another household's Profile, a resolution pointing at a foreign task, or a
    chain link crossing households is unrepresentable rather than merely unqueried (FR-390). The two
    *attribution* columns are the deliberate exception: `created_by`/`updated_by` are single-column
    FKs, exactly as Phase 2's are, because a composite FK with `on delete set null` would null
    `household_id` with them.
14. **One occurrence per rule per local date, per slot.** Phase 2's invariant 6 survives the
    `INTERVAL=N` widening — a wider interval makes occurrences *sparser*, never denser — and the slot
    set multiplies it by at most three, which is exactly why the key needs a slot column and nothing
    more. Any future sub-daily `FREQ` must revisit this first.
15. **A stored rule always matches the widened grammar**, on both tables, with the same constraint
    text (`tasks_rrule_grammar`, `events_rrule_grammar`): whitelisted `FREQ`, `INTERVAL` 1–99, never
    `COUNT`. The parser remains the contract; the CHECK is the backstop.
16. **No client write path exists** on any of the four tables: RLS `select` for `authenticated`
    members via `is_member()`, `ALL` for `service_role`, nothing for `anon` (a probe fails `42501`),
    and no insert/update/delete policy anywhere. `family.task_cursors` is `security_invoker`, so it
    inherits exactly that posture rather than escaping it.

---

## What the database enforces, and what the action does

**The database cannot see who is acting.** One household account, one `auth.uid()` for the parent's
phone and the child's wall tablet; the punched-in Profile lives in a signed HTTP-only cookie the
database never receives. So:

- **Every permission decision is action-tier**, including FR-351's — the first rule in this app whose
  answer depends on *which record* is touched. `lib/family/permissions.ts` is a pure binary
  `can(actor, op, ctx)` today; Phase 3 needs a target-aware decision, which is a contract change to a
  shipped Phase 1 module and is work, not inheritance (Assumption 3). A **second** shipped module
  changes with it: `lib/family/guards.ts` gains `requireVerifiedActor()`, the row-reading half of
  `requireParent()` extracted, so a resolution verb decides FR-351 from the **database** role rather
  than the cookie's and a parent demoted on another device loses the power immediately
  (`contracts/server-actions.md` §Guards, `research.md` R323).
- **FR-322's "at least one assignee" is action-tier**, deliberately (017's note). **Residual, stated
  rather than hidden**: FR-391's Profile deletion is two statements — delete the category (whose
  cascade takes the assignments and that Profile's own chains), then delete the tasks left with
  nobody — and a crash between them leaves a task with no assignee on nobody's board: invisible and
  unreachable through the interface. That is *retained* data, not lost data, repairable by re-running
  the cleanup, which is why it does not clear Phase 2's bar for an RPC. If the plan disagrees, the fix
  is one `SECURITY DEFINER` function that deletes the orphans and the category in one transaction,
  and a deferred constraint trigger asserting the invariant becomes possible at the same moment.
- **The streak checkpoint is a second statement after the resolution insert**, written from a value
  the action computed before it. Two devices resolving *different slots of the same routine for the
  same person in the same second* can have the second write a value computed one slot behind, and a
  crash between the two statements leaves a stale badge. Recorded rather than engineered around: the
  badge self-heals on the next resolution or undo of that routine, because FR-374 already requires a
  recompute there. The alternatives — recomputing inside a SQL function (rule logic in PL/pgSQL,
  against 015's discipline) or deriving the badge at read time (an unbounded walk outside the board's
  28-day window; a 300-day streak costs 300 rows the board otherwise never fetches) — are both worse
  at this scale.
- **What the database does contribute** is everything a bug, a future service-role path or a stray
  RPC could otherwise violate whoever is asking: tenancy; a Profile-only assignee; at most one
  resolution per occurrence, which *is* the single-claim rule; a non-anonymous completion; a skip only
  on a repeating task; mutually exclusive repeat modes; a routine's seven legal slot sets; an
  unbroken chain; and the refusal of an undo whose successor has been resolved.
- **What it must not be asked to do**: decide a parent-only operation, or hold a rule that would then
  need a second implementation in TypeScript.

---

## Privilege matrix (delta)

What Phase 3 adds to the Phase 1 + Phase 2 matrix.
`lib/family/__tests__/policies/privileges.test.ts` asserts the combined inventory **exactly** — its
`TABLES` and `FUNCTIONS` arrays both grow, and any new grant to `anon` is a test failure — so it is
extended in the same commit as 016–022.

| Object | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `tasks`, `task_assignees`, `task_resolutions`, `task_box_items` | — | SELECT | ALL |
| `task_cursors` (view, `security_invoker`) | — | SELECT | SELECT |
| `seed_task_box(uuid)` | — | — | EXECUTE |
| `assert_task_assignee()`, `assert_up_for_grabs_is_unassigned()`, `assert_task_resolution()` | — | — | — |

Reads by `authenticated` are further narrowed by RLS to the caller's household (FR-390, SC-305); an
authenticated non-member gets `[]`, an anonymous request gets `42501` — Phase 1's posture,
unchanged, and the view inherits it rather than bypassing it.

Alongside the inventory, in the `policies` (node) project against the local 553xx stack: a per-path
access test for each of the four tables **and the view** (read as a member / cross-household /
anonymous, SC-305); a schema-shape test asserting each named CHECK and each trigger actually refuses
its invalid row (the `events-schema.test.ts` pattern); a concurrency test issuing two claims of one
up-for-grabs occurrence and asserting exactly one row plus a `23505` naming the winner (SC-311); a
test that deleting a resolution with a live successor raises `23503` and that deleting a whole chain
in one statement does not (FR-344 / FR-391); and the 022 constraint tests (`INTERVAL=2` accepted,
`INTERVAL=0`, `INTERVAL=01`, `INTERVAL=100` and a `COUNT=` rule refused, on both tables).

---

## Dashboard / config steps

None beyond `supabase db push`, verified:

- **Exposed schemas**: `family` is already on the exposed list (a Phase 1 operator step); new tables
  and a new view in an existing exposed schema need nothing, and the `notify pgrst, 'reload schema'`
  in 019, 020 and 021 makes them visible without a restart.
- **Realtime**: the publication ALTER is in-migration (the 009/014 precedent); no dashboard toggle,
  and no replica-identity promotion — `replica identity full` stays prohibited.
- **No** new buckets, auth providers, hooks, extensions, edge functions or cron entries. The Task Box
  seed runs inside 020 for the seeded household.
- **Two things to check before writing the files**, both read-only: that the hosted project is
  **PostgreSQL 15+** (018 and 019 depend on `nulls not distinct`, `on delete set null (…)` and
  `security_invoker`), and that the hosted `family.events` holds **no** rule outside the widened
  grammar (022's query above).
- One fallow change the plan must make, which is a boundary widening and not a suppression.
  `.fallowrc.json` confines `lib/family/recurrence/**` to a named set of importers, and
  `lib/family/tasks/**` would otherwise fall into the generic `lib` zone, whose allow list is exactly
  `["lib", "family-calendar-core"]` `[code]` — so any tasks module touching `recurrence/plain-date.ts`
  is a boundary error at the gate. **This is the canonical statement of the zone; the other documents
  reference it rather than restating it.** One new zone, one new rule, five allow-list additions:

  ```jsonc
  // boundaries.zones — after "family-calendar-core"
  { "name": "family-tasks-core", "patterns": ["lib/family/tasks/**/*"] }

  // boundaries.rules — after the "family-calendar-core" rule
  { "from": "family-tasks-core",
    "allow": ["family-tasks-core", "family-recurrence", "family-calendar-core", "lib"] }

  // and "family-tasks-core" appended to the allow list of:
  //   lib · components · ui-pages · family-actions · tests
  ```

  The extent is the **whole directory**, not a hand-picked file list: `counters.ts`, `visibility.ts`,
  `layout.ts`, `reorder.ts`, `resolutions.ts` and `streaks.ts` sit beside `expand.ts`, `cursor.ts` and
  `dates.ts`, import them, and share their date helpers, so a three-file zone would leave the siblings
  in `lib` unable to import either the zone or `family-recurrence`. The rule lists **itself and
  `lib`** for the same reason Phase 2's shipped `family-calendar-core` rule does
  (`{from: "family-calendar-core", allow: ["family-calendar-core", "family-recurrence", "lib"]}` `[code]`),
  without which `tasks/expand.ts` could not import its own `dates.ts` or `lib/family/types.ts`. `lib`
  gains the zone for the same reason it already lists `family-calendar-core`: `queries.ts` reads
  `CARRY_FORWARD_DAYS` out of `tasks/dates.ts` to bound read (3). Net effect on confinement:
  `lib/family/recurrence/**` gains **one** importer zone and loses none — a tightening of the new
  code's reach, the exact analogue of what Phase 2 did for `family-calendar-core`.

---

## What later phases add here

Recorded so nothing needs reshaping. The **rewards** phase adds `family.rewards`,
`family.reward_categories`, `family.reward_redemptions` and the star ledger, plus the interface for
the two `reward_points` columns that already exist — **no migration to either shape**, which is the
whole point of FR-329. The **celebrations** phase reads FR-305's denominator rule and the streak pair
on `task_assignees`; neither needs a column. **Phase 5's** reminder scan may want a materialised
occurrence table, which arrives additively with the task row staying the source of truth; a
materialised chain tail (`next_due_date` on `task_assignees`, plus a household-chain home) arrives the
same way if the cursor view's anti-join ever costs anything measurable, as an optimisation and never
as the source of truth. A `split_from_task_id` lineage column is one nullable `alter table` away if
`this_and_future` ever needs ancestry — FR-331's ban on per-occurrence overrides means this phase
needs no split function at all. `timer_seconds` never arrives; the companion timer is excluded from
the project.
