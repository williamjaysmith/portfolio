# Phase 2 Data Model: Family Week Calendar

**Feature**: `002-family-week-calendar` | **Date**: 2026-09-02

What Phase 2 adds to the `family` schema: three tables (`events`, `event_categories`,
`event_exceptions`), one column (`household_settings.timezone`, FR-284), one redundant unique
constraint on `categories` (a composite-FK target), one atomic-split RPC, and the publication
entries that put the calendar on the existing live-update channel. **No Phase 1 table changes
shape** — the `categories` constraint is additive and the settings column has a default.

Semantics follow the reference product's verified record shape wherever the research verified one:
the two-shape time model (all-day events are plain dates, timed events are instants — FR-223
`[V]`), the field name `summary`, the iCal recurrence rule as stored text (FR-233 `[V]`), the
reserved `countdown_enabled` boolean (FR-228 `[V]`), and the scope enum the exceptions table
serves (`this` / `this_and_future` / `all`, FR-237 `[V]`).

---

## Entity overview

```
households ◄──1:1── household_settings          (Phase 1; 013 adds `timezone` — FR-284)
    │ 1:N
    ├────────── categories                       (Phase 1: Profiles + Labels;
    │                ▲                            011 adds unique (id, household_id))
    │                │ composite FK (category_id, household_id), on delete cascade
    │                │
    └────────── events ◄──────── event_categories   (011: ordered join, `position`)
                   ▲   one row per series or one-off; occurrences are computed, never stored
                   │
                   │ composite FK (event_id, household_id), on delete cascade
                   │
              event_exceptions                   (012: skip / override,
                                                  keyed (event_id, occurrence_date))
```

There are **no occurrence rows and no master/instance split**. The spec's Key Entities section
decides this — *"Occurrences are worked out from the event and its rule, not stored one by one"* —
so a series that never ends costs one row. A single-occurrence divergence is a child row in
`event_exceptions`, never a second `events` row; the reference's `master_event_id` has no analogue
here. The one legitimate way a second `events` row appears for "the same" series is a
`this_and_future` split, which creates a new, fully self-contained series (see
[Invariants](#invariants)).

---

## Migrations

Continuing Phase 1's numbering (001–009 shipped; plain numeric prefixes). Each file is idempotent
where that is cheap, opens with a comment naming what it creates and which requirement it serves,
and carries no personal data — the Phase 1 discipline verbatim. Every function is `SECURITY
DEFINER` with `search_path = ''`, schema-qualifies every name, and is `revoke`d from `public`
immediately after creation.

| # | File | Contents | Serves |
|---|---|---|---|
| 010 | `010_events.sql` | `family.events`, time-shape + rrule constraints, timezone-validity trigger, indexes, read policy, grants | FR-220…FR-233, FR-273, FR-284 (render source) |
| 011 | `011_event_categories.sql` | `family.event_categories` (ordered join), `unique (id, household_id)` added to `categories`, composite FKs, index, read policy, grants | FR-211/212/227, FR-273, FR-274 |
| 012 | `012_event_exceptions.sql` | `family.event_exceptions` (skip + four-field override), occurrence key, payload constraints, read policy, grants | FR-237…FR-243, FR-286, FR-287 |
| 013 | `013_household_timezone.sql` | `household_settings.timezone` + validity trigger; **nothing else** | FR-284 |
| 014 | `014_realtime_calendar.sql` | Guarded publication adds for the three new tables; `notify pgrst, 'reload schema'` | FR-276, Assumption 39 |
| 015 | `015_split_event_series.sql` | `family.split_event_series()` — the atomic `this_and_future` split, service-role only | FR-237, FR-241, FR-242 |

015 adopts research R204's atomicity decision, whose migration home is fixed here: the split is a
multi-statement rewrite (truncate the head, insert the tail, copy links, re-home exceptions), and
a half-completed split — a truncated series missing its tail — is visible data loss, worse than
Phase 1's two documented non-atomic actions. It therefore goes through one `SECURITY DEFINER`
function, per Phase 1's function discipline. The *truncating delete* (FR-286) stays two ordered
statements in the action — a mid-failure there leaves only inert rows (see 012's notes).

Locally, `supabase db reset` applies all fifteen. `supabase db push` to the hosted project is an
operator step, followed by one post-push step: seed the real household timezone (see
[013](#013--household-timezone-fr-284)).

---

## 010 — Events

```sql
-- 010_events.sql — family.events: one row per series or one-off. Two-shape time
-- model (FR-222/223/225), canonical rrule text (FR-231/232/233), device-zone
-- provenance (FR-224), reserved countdown flag (FR-228), tenancy (FR-273).
create table if not exists family.events (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,

  summary       text not null check (length(trim(summary)) between 1 and 120),
  description   text check (description is null or length(description) <= 2000),
  location      text check (location is null or length(location) <= 200),

  -- Two-shape time model (FR-223 [V]): all-day events are plain dates, timed
  -- events are instants. Exactly one pair is populated, switched by all_day.
  all_day       boolean not null default false,
  starts_at     timestamptz,          -- timed shape
  ends_at       timestamptz,          -- timed shape
  start_date    date,                 -- all-day shape
  end_date      date,                 -- all-day shape; INCLUSIVE (FR-225)

  -- The creating device's IANA zone. Provenance ONLY (FR-224): nothing renders
  -- or expands from it — FR-219/FR-234 use household_settings.timezone.
  timezone      text not null,

  -- One canonical RFC 5545 rule, no 'RRULE:' prefix, no COUNT (FR-231/232/233).
  -- Null = one-off. DTSTART is never encoded here; it is starts_at/start_date.
  rrule         text check (rrule is null or (rrule ~ '^FREQ=' and rrule !~ '(^|;)COUNT=')),

  -- Reserved for the countdown phase (FR-228). Nothing reads or writes it now.
  countdown_enabled boolean not null default false,

  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Exactly one time shape, decided by all_day (FR-222).
  constraint event_time_shape check (
    (all_day and start_date is not null and end_date is not null
             and starts_at is null and ends_at is null)
    or
    (not all_day and starts_at is not null and ends_at is not null
                 and start_date is null and end_date is null)
  ),
  -- FR-226. Equal dates = a one-day all-day event (FR-225). A timed event may
  -- cross midnight or span days — FR-217 is a rendering rule, not a constraint.
  constraint event_ends_after_start check (
    case when all_day then end_date >= start_date else ends_at > starts_at end
  ),
  -- Composite-FK target: lets 011/012 prove tenancy referentially.
  constraint events_id_household_key unique (id, household_id)
);
drop trigger if exists touch on family.events;
create trigger touch before update on family.events
  for each row execute function family.touch_updated_at();

-- Timezone validity. A CHECK is illegal (pg_timezone_names is not immutable),
-- so a trigger is the backstop behind the action's Zod check (FR-224).
create or replace function family.assert_event_timezone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'not an IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function family.assert_event_timezone() from public;
drop trigger if exists event_timezone_is_valid on family.events;
create trigger event_timezone_is_valid
  before insert or update of timezone on family.events
  for each row execute function family.assert_event_timezone();

-- Shaped exactly for the week-window read (see "How the week is read").
create index if not exists events_timed_window_idx
  on family.events (household_id, starts_at) where rrule is null;
create index if not exists events_allday_window_idx
  on family.events (household_id, start_date) where rrule is null;
create index if not exists events_series_idx
  on family.events (household_id) where rrule is not null;

alter table family.events enable row level security;
drop policy if exists "members read events" on family.events;
create policy "members read events" on family.events
  for select to authenticated using (family.is_member(household_id));
grant select on family.events to authenticated;
grant all    on family.events to service_role;
```

**Why two column pairs, not one**: FR-223 is `[V]` — the reference stores all-day events as plain
dates (`"2025-12-29"`) and timed events as offset-carrying instants. Collapsing all-day into a
`timestamptz` pair would fabricate a midnight-in-some-zone and reintroduce the classic all-day
drift bug the reference's own format avoids.

**The rrule column, exactly**: a single rule as `text`, without the `RRULE:` property prefix —
e.g. `FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TU,TH`. The reference stores `["RRULE:FREQ=…"]`, an
array never observed holding a second element; stripping the wrapper is lossless and mechanically
reversible, so FR-233's "a Skylight-format recurrence survives unchanged" holds. The `COUNT` ban
is the DB-level echo of FR-232: the expander is written UNTIL-only, and a `COUNT` rule slipping in
through a future write path would expand as infinite. There is deliberately **no FREQ whitelist**:
the interface offers four choices (FR-231) but the storage must accept a richer Skylight rule
("nothing is lost if the interface grows later"). Only the server-side emitter in
`lib/family/recurrence/grammar.ts` ever writes this column — clients submit the structured repeat
choice, never a rule string (see contracts).

**Why no write grants to `authenticated`**: identical to Phase 1's categories reasoning, binding
harder here. RLS can see which *account* is asking but not which *profile is punched in* — that
lives in the signed actor cookie the database never sees — and FR-270/SC-205 demand a punched-in
actor for every event write. All mutations pass through server actions (`requireActor`, FR-272:
any punched-in profile) writing with the `service_role` grant, every write scoped
`.eq('household_id', householdId)` because with the service role there is no RLS — that clause is
the tenancy check.

**Validation rules**

| Field | Rule |
|---|---|
| `summary` | required, 1–120 chars trimmed (FR-220; the name copies the reference's verified field) |
| `description` | ≤ 2000 chars (FR-221 notes) |
| `location` | ≤ 200 chars, text only — no coordinates, ever (FR-221) |
| time shape | exactly one pair per `all_day`; end after start; all-day end **inclusive** |
| `timezone` | valid IANA name (Zod `Intl.supportedValuesOf('timeZone')` first, trigger second); written at create, never changed by edits |
| `rrule` | null, or `^FREQ=` and no `COUNT`; canonical grammar enforced at the action boundary |
| `countdown_enabled` | reserved; no interface, no index this phase (Assumption 6) |
| `created_by` / `updated_by` | set from the actor by every action (FR-271) |

---

## 011 — Event–category links

```sql
-- 011_event_categories.sql — the ordered event↔category join (Profiles and
-- Labels are one entity). Serves FR-211/212/227 (colours in draw order),
-- FR-273 (tenancy), FR-274 (events survive a category's deletion).

-- Composite-FK target on categories. Additive: a superset of the PK, no data
-- rewrite. The one Phase 1 alteration this phase makes.
do $$
begin
  alter table family.categories
    add constraint categories_id_household_key unique (id, household_id);
exception when duplicate_table or duplicate_object then null;  -- already there
end $$;

create table if not exists family.event_categories (
  household_id  uuid not null references family.households(id) on delete cascade,
  event_id      uuid not null,
  category_id   uuid not null,
  -- FR-227: the order colours are drawn on the striped block. Plain 0-based
  -- position, not Phase 1's numeric fractional index: category changes are
  -- series-scope only (FR-287) and every save rewrites the link set wholesale,
  -- so there is no in-place reorder for fractional indexing to serve.
  position      smallint not null check (position >= 0),
  created_at    timestamptz not null default now(),

  primary key (event_id, category_id),

  -- Tenancy proved by the database, not the action: a cross-household link is
  -- unrepresentable, not merely unqueried.
  constraint event_categories_event_fk
    foreign key (event_id, household_id)
    references family.events (id, household_id) on delete cascade,
  constraint event_categories_category_fk
    foreign key (category_id, household_id)
    references family.categories (id, household_id) on delete cascade
);

-- Serves the FR-274 affected-event count, the filter sheet, and the cascade scan.
create index if not exists event_categories_category_idx
  on family.event_categories (household_id, category_id);

alter table family.event_categories enable row level security;
drop policy if exists "members read event categories" on family.event_categories;
create policy "members read event categories" on family.event_categories
  for select to authenticated using (family.is_member(household_id));
grant select on family.event_categories to authenticated;
grant all    on family.event_categories to service_role;
```

**`on delete cascade` from `categories` is FR-274 made mechanical**: deleting a Profile or Label
removes its links and leaves the events standing — rendered neutrally when nothing remains
(FR-213). No event is destroyed by deleting a category (SC-214). The affected-event count the
delete confirmation must now show (FR-274, an amendment to Phase 1's shipped dialog — Assumption
24) is `select count(distinct event_id) … where household_id = $1 and category_id = $2`, served
by `event_categories_category_idx` over the RLS read path — no new action needed (see contracts).

**Zero-category events** (FR-213) fall out of the table's absence of rows; no constraint trigger
polices a minimum. **No `created_by`/`updated_by`**: a pure join row has no independent lifecycle;
the action sets `events.updated_by` whenever it rewrites an event's links, which is where FR-271's
attribution already lives.

**Why a declarative composite FK where Phase 1 used a trigger**: Phase 1's one cross-table
invariant had to compare against `household_users`, so it needed a function. Here the invariant is
pure referential shape — same `(id, household_id)` on both ends — and a declarative FK is
race-free with no function to maintain.

---

## 012 — Occurrence exceptions

```sql
-- 012_event_exceptions.sql — one row per occurrence that diverges from its
-- series: a skip (FR-240, a single-occurrence delete) or an override of exactly
-- the four fields FR-239 permits — time, title, place, notes. Serves
-- FR-237…FR-243, FR-286. Categories are deliberately absent (FR-287).
create table if not exists family.event_exceptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  event_id      uuid not null,

  -- THE occurrence key: the occurrence's ORIGINAL date in the household's
  -- timezone (FR-234's expansion zone). One column; see the note below.
  occurrence_date date not null,

  action        text not null check (action in ('skip','override')),

  -- Override payload — exactly FR-239's four, null = inherit from the series.
  summary       text check (summary is null or length(trim(summary)) between 1 and 120),
  description   text check (description is null or length(description) <= 2000),
  location      text check (location is null or length(location) <= 200),
  starts_at     timestamptz,          -- override: timed shape
  ends_at       timestamptz,
  start_date    date,                 -- override: all-day shape — present so a
  end_date      date,                 -- 'this'-scope band↔grid drag (FR-251) is recordable

  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One exception per occurrence. Also the truncation-delete and embedding index.
  constraint event_exceptions_occurrence_key unique (event_id, occurrence_date),

  -- Tenancy as 011; the cascade is FR-243 — no occurrence outlives its event.
  constraint event_exceptions_event_fk
    foreign key (event_id, household_id)
    references family.events (id, household_id) on delete cascade,

  -- A skip carries nothing; an override carries at least one field.
  constraint exception_payload_shape check (
    case when action = 'skip'
      then num_nonnulls(summary, description, location,
                        starts_at, ends_at, start_date, end_date) = 0
      else num_nonnulls(summary, description, location,
                        starts_at, ends_at, start_date, end_date) > 0
    end
  ),
  -- Time overrides come as a coherent pair, at most one shape.
  constraint exception_time_shape check (
    (starts_at is null) = (ends_at is null)
    and (start_date is null) = (end_date is null)
    and not (starts_at is not null and start_date is not null)
    and (starts_at is null or ends_at > starts_at)
    and (start_date is null or end_date >= start_date)
  )
);
drop trigger if exists touch on family.event_exceptions;
create trigger touch before update on family.event_exceptions
  for each row execute function family.touch_updated_at();

alter table family.event_exceptions enable row level security;
drop policy if exists "members read event exceptions" on family.event_exceptions;
create policy "members read event exceptions" on family.event_exceptions
  for select to authenticated using (family.is_member(household_id));
grant select on family.event_exceptions to authenticated;
grant all    on family.event_exceptions to service_role;
```

**Why one key column, not a date + instant pair**: the four repeat choices (FR-231 —
never / daily / weekly-on-weekdays / monthly-on-date, INTERVAL always 1) can each produce **at
most one occurrence per household-local date**, so the local date alone identifies an occurrence.
The date key survives a series-level time change ("all events: move Piano 17:00 → 18:00") that
would silently orphan an instant key — which is exactly the spec's stated intent for this record
("stays attached to the right occurrence when the series changes"). It is immune to DST instant
drift (FR-235 *moves the instant* of an occurrence while its date stays put), and FR-286 speaks
the same language: a `this_and_future` truncation removes exceptions "**dated** on or after" the
cut — one indexed date comparison. The `COUNT` ban and the closed grammar keep the
one-per-date invariant true; if a later phase adds sub-daily or every-N frequencies, the key
gains a column then, with data intact.

**A moved occurrence needs no extra bookkeeping**: an override may land its `starts_at` on any
date — the spec's edge case drags one "into the following week" — while `occurrence_date` (the
key) never changes. The week read still finds it because every series row is always fetched with
all its exceptions embedded (see "How the week is read"); no derived search window and no fetch
padding exist to go stale.

**An exception row on an rrule-null event** is structurally possible but unreachable — FR-238
means no action ever offers a scope on a one-off — and inert if ever present (the one-off render
path never consults exceptions). Not worth a trigger.

**How the three scopes land on this schema** (the contract's write matrix, summarised):

| Scope | Edit | Delete |
|---|---|---|
| `this` | upsert `override` row keyed by the occurrence's original date | upsert `skip` row (FR-240; replaces any override on that date) |
| `this_and_future` | on the first occurrence: same as `all` (FR-241); otherwise `split_event_series()` (015) | truncate the head's `UNTIL` to the day before the cut, then delete exceptions `occurrence_date >= cut` (FR-286); on the first occurrence, delete the series |
| `all` | update the `events` row in place — the segment only (FR-242) | delete the `events` row; links and exceptions cascade (FR-243) |

The truncating delete is two admin-client statements, **truncate first**: a failure between them
leaves exceptions dated beyond the new `UNTIL`, which the expander never reaches — inert rows, no
visible wrongness, removed by any later successful pass. (Deleting exceptions first would destroy
per-occurrence edits while their occurrences still render.) The *split* gets no such safe
ordering — a truncated head with no tail is data loss — hence 015.

---

## 013 — Household timezone (FR-284)

```sql
-- 013_household_timezone.sql — the household's one IANA timezone (FR-284,
-- Assumption 34). Read-only this phase: no action writes it (Assumption 16).
alter table family.household_settings
  add column if not exists timezone text not null default 'UTC';

create or replace function family.assert_settings_timezone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'not an IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function family.assert_settings_timezone() from public;
drop trigger if exists settings_timezone_is_valid on family.household_settings;
create trigger settings_timezone_is_valid
  before insert or update of timezone on family.household_settings
  for each row execute function family.assert_settings_timezone();
```

**Home: `household_settings`, not `households`.** Phase 1's data-model commits to exactly this
extension point ("calendar-specific settings arrive with Phase 2 as an `alter table`" on
`household_settings`); the spec's own Key Entities files the timezone under *Household calendar
preferences*, in the same record as the start-of-week preference the grid's settings read already
fetches — one row serves FR-203 and FR-284 together; and `households` stays what Phase 1 made it
(identity + name + attribution). The table is 1:1 with the household (PK = `household_id`,
cascade), so FR-284's "kept with the household" is satisfied.

**Backfill and seeding**: the `not null default 'UTC'` backfills the already-seeded household row
— locally `007_seed.sql` created it; on the hosted project the operator's `db push` replays 007
then 013, same result. The **real** zone is written by `scripts/family-seed.mjs`, which gains one
step: `update family.household_settings set timezone = $FAMILY_SEED_TIMEZONE` (defaulting to the
machine's `Intl.DateTimeFormat().resolvedOptions().timeZone` when unset). Household-specific
configuration stays out of committed SQL — the same reason Phase 1's migrations carry no emails or
names (constitution §VII) — and `'UTC'` as the un-seeded fallback fails *loudly* (every event
hours off) rather than plausibly, which is what a placeholder should do. **Operator step after
push**: run the seed (or the one-line update) so the hosted row holds the real zone; recorded in
quickstart's operator section.

**What 013 deliberately does not add**: the seven calendar-toggle columns the data brief proposed
(`shade_weekends`, `dim_past_events`, `color_code_multi_profile`, …). The final spec fixed that
behaviour in code (FR-215, Assumption 16: no settings interface this phase), and Phase 1's rule is
"no unused columns ship early". They arrive with the phase that ships the settings interface, as
this same kind of `alter table`.

---

## 014 — Realtime

```sql
-- 014_realtime_calendar.sql — live updates for the three calendar tables
-- (FR-276, Assumption 39), then a PostgREST schema reload.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'publication supabase_realtime not found; live updates stay off until it exists';
    return;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    return;   -- FOR ALL TABLES publications already cover the schema (the 009 guard, verbatim)
  end if;
  foreach t in array array['events', 'event_categories', 'event_exceptions'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
```

**Replica identity stays at the default (primary key)** — Phase 1's reasoning binds harder here:
Realtime does not apply RLS to DELETE payloads, and a deleted event's `summary` is precisely the
child's-schedule data constitution §VII protects, so `replica identity full` is prohibited.

The consequence, already resolved by the spec (Assumption 39): a DELETE payload carries only PK
columns — `events.id`, `(event_id, category_id)` — never `household_id`, so Phase 1's
`household_id=eq.<hid>`-filtered subscription would silently never fire on deletes of these
tables. The three calendar tables are therefore subscribed **without** the server-side household
filter, and every payload — insert, update, delete — is treated as a bare invalidation signal
("something changed, re-read"). INSERT/UPDATE payloads remain RLS-checked, the re-read goes
through the RLS-governed window query anyway, and the household is this project's only tenant.
That is provider code (`useFamilyRealtime.ts`), not schema; no migration work exists beyond the
publication add, and no replica-identity promotion is needed.

---

## 015 — The split function

```sql
-- 015_split_event_series.sql — atomic this_and_future split (FR-237/241/242).
-- The action computes everything (both rrule strings via the one grammar
-- emitter, the tail row, the tail's category set); this function only applies
-- the four statements in one transaction, so a half-completed split — a
-- truncated head with no tail — cannot exist. Service-role only; the action has
-- already verified the actor (requireActor) and validated the payload.
create or replace function family.split_event_series(
  p_household_id      uuid,
  p_event_id          uuid,      -- the head (the series being split)
  p_actor             uuid,      -- the punched-in profile, for attribution; may be null
  p_head_rrule        text,      -- head's re-emitted rule: UNTIL = cut − 1 day
  p_cut               date,      -- household-local date of the chosen occurrence
  p_tail_event        jsonb,     -- content columns of the new tail series row
  p_tail_category_ids uuid[]     -- tail's category links, in draw order
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tail_id uuid;
begin
  -- Lock the head so a concurrent scope-write on the same series serialises here.
  perform 1 from family.events
    where id = p_event_id and household_id = p_household_id and rrule is not null
    for update;
  if not found then
    raise exception 'no such series in this household' using errcode = 'P0002';
  end if;

  -- 1. Truncate the head. Earlier occurrences and exceptions dated < p_cut stay.
  update family.events
     set rrule = p_head_rrule, updated_by = p_actor
   where id = p_event_id;

  -- 2. Insert the self-contained tail (edited fields already applied by the
  -- action). Every 010 constraint and the timezone trigger apply to it here.
  insert into family.events
    (household_id, summary, description, location, all_day,
     starts_at, ends_at, start_date, end_date, timezone, rrule,
     countdown_enabled, created_by, updated_by)
  select p_household_id, t.summary, t.description, t.location, t.all_day,
         t.starts_at, t.ends_at, t.start_date, t.end_date, t.timezone, t.rrule,
         coalesce(t.countdown_enabled, false), p_actor, p_actor
    from jsonb_to_record(p_tail_event) as t(
      summary text, description text, location text, all_day boolean,
      starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
      timezone text, rrule text, countdown_enabled boolean)
  returning id into v_tail_id;

  -- 3. The tail's category links, in draw order (FR-227). At this scope the
  -- categories may themselves be the edit (FR-287 allows this_and_future).
  insert into family.event_categories (household_id, event_id, category_id, position)
  select p_household_id, v_tail_id, u.cid, (u.ord - 1)::smallint
    from unnest(p_tail_category_ids) with ordinality as u(cid, ord);

  -- 4. Re-home the tail's exceptions. Keys are household-local dates, so they
  -- do not change (the whole point of the date key).
  update family.event_exceptions
     set event_id = v_tail_id
   where event_id = p_event_id and household_id = p_household_id
     and occurrence_date >= p_cut;

  return v_tail_id;
end;
$$;
revoke all on function family.split_event_series(uuid, uuid, uuid, text, date, jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function family.split_event_series(uuid, uuid, uuid, text, date, jsonb, uuid[])
  to service_role;

-- 014's reload fired before this function existed; reload again so PostgREST
-- can serve the RPC without a restart.
notify pgrst, 'reload schema';
```

**The function is a dumb atomic applier, on purpose.** Only the TypeScript emitter
(`lib/family/recurrence/grammar.ts`) understands rrule strings; putting UNTIL arithmetic in
PL/pgSQL would create a second recurrence implementation that can drift from the JS one — the
exact trap the window-query design also avoids. The database's own constraints (time shape, rrule
CHECK, timezone trigger, composite FKs) validate the tail row as the second line, per Phase 1's
posture. **No lineage column** (`split_from_event_id`) is written or exists: FR-242/Assumption 27
define "All events" after a split as *the segment the person is standing in*, so no
requirement ever walks a chain; the two segments are fully self-contained rows. One nullable
`alter table` restores ancestry if a later phase wants it.

---

## How the week is read (why the indexes are shaped this way)

The classic problem: an unbounded weekly series has one row whose `starts_at` is years in the
past; `starts_at between window` misses it. The spec rules out materialised occurrence rows, and
there is no rrule engine in Postgres on Supabase, so expansion is client-side in one
`expandWindow()` module (`lib/family/calendar/expand.ts`, test-first — SC-207/SC-208 live there).

**Decision: no derived search columns and no window trigger.** The read is one three-branch OR
over real columns only:

```
.eq('household_id', hid)
.or('rrule.not.is.null,'
  + 'and(rrule.is.null,all_day.is.false,starts_at.lt.<windowEnd>,ends_at.gt.<windowStart>),'
  + 'and(rrule.is.null,all_day.is.true,start_date.lte.<windowEndDate>,end_date.gte.<windowStartDate>)')
```

- **Every series row is always fetched** (`events_series_idx`) and expanded against the requested
  week. A family accumulates series in dozens, not thousands — ten new series a month for five
  years is ~600 rows ≈ 120 KB, and the realistic count is far lower. Expired series still arrive
  and expand to zero occurrences; their cost is the row, not the math.
- **One-off events are windowed by their real bounds** (the two partial indexes), so history does
  not accrete into the payload: five years of ~10 events/week stays ~50 fetched rows per week
  view instead of ~2,600. The explicit `rrule.is.null` conjunct in both one-off branches is what
  makes each branch's predicate imply its partial index's predicate — without it the branches also
  match series rows and neither index is usable (harmless to the OR-union's results, but then the
  indexes would be documentation, not access paths).
- `event_categories` and `event_exceptions` ride along embedded (PostgREST), with explicit column
  lists in `lib/family/rows.ts` per the Phase 1 read contract — no `select('*')`, explicit
  `.eq('household_id', …)` even under RLS.

This dissolves two problems a derived-window design would have to patch: the **moved occurrence**
(an override dragged into a different week is always found, because its series row is always
fetched with all its exceptions embedded — no padding number, no widen-on-write contract to
forget) and the **derived-column trigger** (parsing `UNTIL` out of rrule text in PL/pgSQL — a
second rrule parser that can drift from the JS one).

The honest ceiling: O(all series + windowed one-offs) per read, per invalidation — right at one
household's scale, wrong for a multi-tenant SaaS. If a later phase's server-side reminder scan
forces a materialised occurrence table, it arrives *additively*; the series row stays the single
source of truth either way.

---

## Invariants

The properties the schema holds structurally, stated so tests can pin them and reviews can check
against them:

1. **Exactly one time shape per event.** `all_day = true` ⇔ the date pair is populated and the
   instant pair is null; `all_day = false` ⇔ the reverse (`event_time_shape`). The same coherence
   holds on an exception's override payload (`exception_time_shape`), where both pairs may also be
   absent (a title-only override). An all-day `end_date` is inclusive; `start_date = end_date` is
   one day (FR-225). Ends strictly after starts for timed shapes; `>=` for dates.
2. **`rrule` lives only on masters — structurally.** There are no instance rows for a rule to
   stray onto, and `event_exceptions` has no rrule column. The presence of `events.rrule` is the
   single source of truth for "does this event repeat" (Contradiction 8: the reference's two
   recurrence booleans are carried by neither). A stored rule always matches `^FREQ=` and never
   contains `COUNT`.
3. **An exception always points at a master in the same household, and dies with it.** The
   composite FK `(event_id, household_id) → events (id, household_id) on delete cascade` makes a
   cross-household exception unrepresentable and discharges FR-243 — no occurrence outlives its
   event, and a skipped date cannot reappear as a ghost. At most one exception per occurrence
   (`unique (event_id, occurrence_date)`); a skip carries no payload, an override carries at
   least one field, and only FR-239's four fields exist to override. **No category override is
   representable** — there is no per-occurrence category table, which is FR-287 made structural.
4. **Category links are household-coherent and ordered.** Both composite FKs share the row's
   `household_id`, so a link between an event and a category of different households cannot be
   written even by the service role. `position` is the draw order (FR-227). Deleting a category
   cascades its links and never touches events (FR-274); deleting an event cascades its links and
   exceptions.
5. **Split chains do not exist.** A `this_and_future` split yields two fully self-contained
   series rows with no linking column; "All events" is segment-scoped by design (FR-242,
   Assumption 27). The split is atomic (015) — the database can never hold a truncated head
   without its tail. `this_and_future` on the first occurrence never splits (FR-241): it is
   applied as "all", so no empty leading segment can exist.
6. **One occurrence per series per local date.** Guaranteed by the closed grammar (INTERVAL
   always 1, no sub-daily FREQ) plus the `COUNT` ban; it is what licenses the single-column
   exception key. Any grammar extension in a later phase must revisit this invariant first.
7. **Timezones are always valid IANA names**, on events (provenance, FR-224) and on the household
   setting (the zone everything renders and expands in, FR-284) — Zod at the boundary, trigger at
   the store. Nothing reads `events.timezone` for rendering or expansion this phase.
8. **No client write path exists.** All three tables: RLS `select` for `authenticated` members
   via `is_member()`, `ALL` for `service_role`, nothing for `anon` (probe fails `42501`), no
   insert/update/delete policies. Writes reach the tables only through server actions and 015.

---

## Privilege matrix (delta)

What Phase 2 adds to the Phase 1 matrix. `lib/family/__tests__/policies/privileges.test.ts`
asserts the combined inventory *exactly* — any new grant to `anon` is a test failure — so it is
extended in the same commit as 010–015, alongside the SC-203 per-path policy tests (events, links,
exceptions, each read as a member / cross-household / anonymous) against the local 553xx stack.

| Object | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `events`, `event_categories`, `event_exceptions` | — | SELECT | ALL |
| `split_event_series(…)` | — | — | EXECUTE |
| `assert_event_timezone()`, `assert_settings_timezone()` | — | — | — |

Reads by `authenticated` are further narrowed by RLS to the caller's household (FR-273, SC-203);
an authenticated non-member gets `[]`, an anonymous request gets `42501` — Phase 1's posture,
unchanged.

---

## Dashboard / config steps

None beyond `supabase db push`, verified:

- **Exposed schemas**: `family` is already on the exposed list (a Phase 1 operator step); new
  tables in an existing exposed schema need nothing, and the `notify pgrst, 'reload schema'` in
  014 and again in 015 (which runs after 014's reload) makes the tables and the RPC visible
  without a restart.
- **Realtime**: the publication ALTER is in-migration (the 009 precedent); no dashboard toggle.
- **No** new buckets, auth providers, hooks, extensions (`pgcrypto` is already present; no range
  types, so no `btree_gist`), edge functions, or cron entries.
- One operator step that is *not* a dashboard step: after push, run the seed (or the one-line
  update) so `household_settings.timezone` holds the household's real zone instead of the `'UTC'`
  backfill (see 013).

---

## What later phases add here

Recorded so nothing needs reshaping: a materialised occurrence table *may* arrive additively if a
reminder scan ever needs server-side expansion; the calendar-toggle columns join
`household_settings` with the settings interface; `events_countdown_idx` and the countdown UI
arrive with the countdown phase (the flag already exists); a `split_from_event_id` lineage column
is one nullable `alter table` away if series ancestry is ever wanted; and an instant-bearing
exception key returns as a migration only if sub-daily or every-N rules ever ship.
