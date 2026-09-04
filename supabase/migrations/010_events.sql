-- 010_events.sql — family.events: one row per series or one-off. Two-shape time
-- model (FR-222/223/225), canonical rrule text (FR-231/232/233), device-zone
-- provenance (FR-224), reserved countdown flag (FR-228), tenancy (FR-273).
-- Serves: FR-220..FR-233, FR-270/273 (no client write path), FR-284 (render source).
-- Contains no personal data.

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

-- Shaped exactly for the week-window read (data-model "How the week is read").
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
