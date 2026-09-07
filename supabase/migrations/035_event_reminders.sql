-- 035_event_reminders.sql — one event's own reminder (008 FR-808..FR-811, R809).
-- Contains no personal data.
--
-- Skylight verifies two levels: a calendar-wide default, and a per-event reminder that
-- OVERRIDES it [VERIFIED](32083277890075). Whether several reminders can stack on one event
-- is [UNKNOWN] in every fetched source, so an event carries exactly one setting in three
-- states — spec Assumption 4.
--
-- Why three explicit columns and not a jsonb document: 012_event_exceptions.sql set this
-- table's house style, spelling out each override column with its own named check. Three
-- constrained columns say the same thing as a document and let the database refuse a nonsense
-- row. The mode column also gives "deliberately silent" a NAME, which a nullable payload
-- cannot: null already means inherit.

-- ---------------------------------------------------------------------------
-- The series' own reminder. NOT NULL with a default, so every event that exists
-- today keeps behaving exactly as the household's settings say, before and after.
-- ---------------------------------------------------------------------------
alter table family.events
  add column if not exists reminder_mode            text not null default 'inherit',
  add column if not exists reminder_at_time         boolean,
  add column if not exists reminder_before_minutes  integer;

alter table family.events drop constraint if exists events_reminder_mode;
alter table family.events
  add constraint events_reminder_mode
  check (reminder_mode in ('inherit', 'none', 'custom'));

alter table family.events drop constraint if exists events_reminder_before_minutes;
alter table family.events
  add constraint events_reminder_before_minutes
  check (reminder_before_minutes is null or reminder_before_minutes between 1 and 10080);

-- A 'custom' carrying neither half is just 'none' written badly, and every other mode carries
-- no payload at all. Both halves of that are the same check.
alter table family.events drop constraint if exists events_reminder_payload;
alter table family.events
  add constraint events_reminder_payload
  check (
    case reminder_mode
      when 'custom' then reminder_at_time is not null or reminder_before_minutes is not null
      else reminder_at_time is null and reminder_before_minutes is null
    end
  );

-- ---------------------------------------------------------------------------
-- One occurrence's own reminder. Here reminder_mode is NULLABLE and defaults to
-- null, because THIS TABLE'S established convention is "null = inherit from the
-- series" (012's four override columns already work that way, and this phase does
-- not get to change what null means there).
--
-- So one occurrence resolves as:
--     exception.reminder_mode ?? event.reminder_mode ?? 'inherit'
--            → if 'inherit', the household's setting
--
-- which is what lets FR-810's three scopes work with no new machinery: "This event"
-- writes an exception, "This and future events" splits the series through the shipped
-- split_event_series RPC and writes the tail, "All events" updates the row. Phase 2
-- built all three; this migration only adds columns to the tables they already move.
-- ---------------------------------------------------------------------------
alter table family.event_exceptions
  add column if not exists reminder_mode            text,
  add column if not exists reminder_at_time         boolean,
  add column if not exists reminder_before_minutes  integer;

alter table family.event_exceptions drop constraint if exists event_exceptions_reminder_mode;
alter table family.event_exceptions
  add constraint event_exceptions_reminder_mode
  check (reminder_mode is null or reminder_mode in ('inherit', 'none', 'custom'));

alter table family.event_exceptions drop constraint if exists event_exceptions_reminder_minutes;
alter table family.event_exceptions
  add constraint event_exceptions_reminder_minutes
  check (reminder_before_minutes is null or reminder_before_minutes between 1 and 10080);

alter table family.event_exceptions drop constraint if exists event_exceptions_reminder_payload;
alter table family.event_exceptions
  add constraint event_exceptions_reminder_payload
  -- A SEARCHED case, not a simple one: `case reminder_mode when null` never matches, because
  -- null = null is unknown, so the null row would fall silently to `else`. Written this way the
  -- null case is deliberate and readable — inherit-from-the-series carries no payload, which is
  -- the same requirement `else` already states.
  check (
    case
      when reminder_mode = 'custom'
        then reminder_at_time is not null or reminder_before_minutes is not null
      else reminder_at_time is null and reminder_before_minutes is null
    end
  );

-- ---------------------------------------------------------------------------
-- 012's exception_payload_shape has to widen, and this is the subtle part of
-- this migration.
--
-- It said: a skip carries nothing, an override carries at least one of the SEVEN
-- columns that existed in Phase 2. It could not know about reminders. So the
-- "This event" scope of a reminder-only change (FR-810) — an occurrence whose
-- ONLY difference from its series is when it reminds — would be refused by a
-- constraint written before reminders existed.
--
-- Widened, keeping both halves of 012's intent:
--   * a SKIP still carries nothing, and now that explicitly includes a reminder.
--     A skipped occurrence does not happen, so it has nothing to remind about —
--     and the due-computation never produces one for it (FR-821);
--   * an OVERRIDE carries at least one of the seven, OR a reminder of its own.
-- ---------------------------------------------------------------------------
alter table family.event_exceptions drop constraint if exists exception_payload_shape;
alter table family.event_exceptions
  add constraint exception_payload_shape check (
    case when action = 'skip'
      then num_nonnulls(summary, description, location,
                        starts_at, ends_at, start_date, end_date) = 0
           and reminder_mode is null
      else num_nonnulls(summary, description, location,
                        starts_at, ends_at, start_date, end_date) > 0
           or reminder_mode is not null
    end
  );

notify pgrst, 'reload schema';
