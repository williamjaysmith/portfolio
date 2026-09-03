-- 012_event_exceptions.sql — one row per occurrence that diverges from its
-- series: a skip (FR-240, a single-occurrence delete) or an override of exactly
-- the four fields FR-239 permits — time, title, place, notes. Serves
-- FR-237..FR-243, FR-286. Categories are deliberately absent (FR-287).
-- Contains no personal data.

create table if not exists family.event_exceptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  event_id      uuid not null,

  -- THE occurrence key: the occurrence's ORIGINAL date in the household's
  -- timezone (FR-234's expansion zone). One column: the closed grammar allows
  -- at most one occurrence per series per local date, and the date key survives
  -- series-level time changes and DST instant drift (R204).
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
