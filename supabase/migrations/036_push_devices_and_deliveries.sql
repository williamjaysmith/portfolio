-- 036_push_devices_and_deliveries.sql — the two tables this phase needs (008 FR-822..FR-831,
-- R806, R807, R808).
--
-- CONTAINS CREDENTIALS. family.push_devices holds the keys that address one browser. They are
-- read only by the server (lib/family/push/**), never mapped outward by rows.ts, never logged,
-- and never rendered — the device list shows a label and a date. Nothing else in this schema
-- is like them, which is why they are called out here.

-- ---------------------------------------------------------------------------
-- A browser that asked to be told. NOT a person: every documented Skylight
-- reminder is an unaddressed pop-up on a shared display [VERIFIED](36836043247131),
-- there is no per-person routing anywhere in the reference, and this project knows
-- who somebody is only while they are punched in (three minutes by default).
-- So what is stored is a browser with a name a person recognises, and created_by
-- is attribution — never routing (spec Assumptions 2 and 3).
-- ---------------------------------------------------------------------------
create table if not exists family.push_devices (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,

  -- The push service's URL for this browser. Globally unique, not unique per household: an
  -- endpoint identifies ONE browser, and one browser cannot belong to two households.
  -- Re-registering updates the row rather than adding a second, so a browser that renews its
  -- subscription keeps its identity and FR-824's "each device once" survives the renewal.
  endpoint      text not null constraint push_devices_endpoint_key unique
                  check (endpoint like 'https://%' and length(endpoint) between 12 and 2000),
  p256dh        text not null check (length(p256dh) between 1 and 200),
  auth          text not null check (length(auth) between 1 and 100),

  -- The household's own words for it: "Kitchen tablet", "Ben's phone". The only free text here.
  label         text not null check (length(trim(label)) between 1 and 40),

  created_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists push_devices_household_idx on family.push_devices (household_id);

drop trigger if exists touch on family.push_devices;
create trigger touch before update on family.push_devices
  for each row execute function family.touch_updated_at();

-- ---------------------------------------------------------------------------
-- What has already been sent. This table is the whole of "exactly once" (FR-828):
-- the scan INSERTS BEFORE IT SENDS, and a conflict means another run already
-- claimed that reminder. The unique indexes below are the only arbiter that
-- survives two overlapping runs — a slow minute and the next one.
--
-- The worst case is therefore a reminder that is MISSED, never one sent twice.
-- For a wall display that is the right way round: a miss is invisible, a duplicate
-- is a device that cries wolf.
-- ---------------------------------------------------------------------------
create table if not exists family.reminder_deliveries (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references family.households(id) on delete cascade,

  subject_kind    text not null check (subject_kind in ('event', 'task_due', 'task_done')),
  -- Deliberately NO foreign key: a reminder that has been sent is a fact about the past, and
  -- deleting the event must not rewrite it. The other direction (FR-821 — a deletion BEFORE
  -- the send) needs no constraint: the due-computation reads the events that exist.
  subject_id      uuid not null,

  -- Phase 2's occurrence grammar (012, R204): the occurrence's ORIGINAL date in the household's
  -- timezone. Already the key for exceptions, already proof against a series-level time change
  -- and DST instant drift.
  occurrence_date date not null,
  -- The instant it was for, DERIVED from stored data and never from now(), so a jittery clock
  -- cannot manufacture a second key. Including it is what makes "the event moved, so the new
  -- time is what reminds" fall out for free (R808).
  fire_at         timestamptz not null,

  -- The words, composed once by the scan. The service worker's fetch reads them back rather
  -- than recomputing, so there is no second implementation of message.ts to drift (R819).
  title           text not null check (length(trim(title)) between 1 and 200),
  body            text not null check (length(body) <= 500),
  path            text not null check (path like '/family%' and length(path) <= 300),

  -- Stamped when sending BEGINS, not when it completes (R807). Stamping it afterwards would let
  -- a sweep resend a reminder that had already reached some devices — the exact duplicate
  -- FR-831 forbids. Null means written but not yet dispatched: only a completion notice is ever
  -- written that way (R811).
  dispatched_at   timestamptz,
  created_at      timestamptz not null default now()
);

-- Identity is kind-dependent (R808), so two PARTIAL unique indexes rather than one.

-- Scheduled: the occurrence AND the instant. A moved event reminds again at its new time,
-- because that is a different key; its old instant was claimed and is gone.
create unique index if not exists reminder_deliveries_scheduled_key
  on family.reminder_deliveries (household_id, subject_kind, subject_id, occurrence_date, fire_at)
  where subject_kind <> 'task_done';

-- A completion: ONE announcement per occurrence, however often it is un-ticked and re-ticked.
-- This index is the whole of FR-819's "not for an un-ticking" — no code decides it.
create unique index if not exists reminder_deliveries_completion_key
  on family.reminder_deliveries (household_id, subject_id, occurrence_date)
  where subject_kind = 'task_done';

-- The scan's two working queries: what is owed, and what is old enough to forget.
create index if not exists reminder_deliveries_pending_idx
  on family.reminder_deliveries (household_id, dispatched_at)
  where dispatched_at is null;
create index if not exists reminder_deliveries_age_idx
  on family.reminder_deliveries (created_at);

-- ---------------------------------------------------------------------------
-- Access. The Phase 1 shape, unchanged: members read, service_role writes, anon
-- gets a refusal rather than an empty result. There is no client write path to
-- either table — both are written by server actions and by the scan.
-- ---------------------------------------------------------------------------
alter table family.push_devices enable row level security;
alter table family.reminder_deliveries enable row level security;

drop policy if exists "members read push devices" on family.push_devices;
create policy "members read push devices" on family.push_devices
  for select to authenticated using (family.is_member(household_id));

drop policy if exists "members read reminder deliveries" on family.reminder_deliveries;
create policy "members read reminder deliveries" on family.reminder_deliveries
  for select to authenticated using (family.is_member(household_id));

-- SELECT on push_devices is granted at the COLUMN level: a member may see that a device exists
-- and what it is called, and may never read the credentials that address it. The device list
-- renders exactly these columns.
grant select (id, household_id, label, created_by, created_at, updated_at, last_seen_at)
  on family.push_devices to authenticated;
grant select on family.reminder_deliveries to authenticated;
grant all on family.push_devices, family.reminder_deliveries to service_role;

notify pgrst, 'reload schema';
