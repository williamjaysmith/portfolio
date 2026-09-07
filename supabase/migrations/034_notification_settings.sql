-- 034_notification_settings.sql — the household's five reminder choices (008 FR-801..FR-807,
-- R810). Contains no personal data.
--
-- Why columns on family.household_settings and not a table of its own: this table has held
-- every household-wide choice since Phase 1, its row is already read by every page, already
-- carried by the realtime channel, and already written by exactly one parent-guarded action
-- (updateHouseholdSettings). A notifications table would add a join, a policy and a second
-- write path to hold five booleans and an integer.
--
-- The DEFAULTS ARE THE SPECIFICATION'S (FR-807), not a seed's, so a household that has never
-- opened Settings is already reminded of its events and is not told about every completed
-- chore. No fetched Skylight source documents a factory default for any of the four
-- [UNKNOWN] — spec Assumption 6 owns these values.
--
-- The lead time is ALWAYS MINUTES. The unit picker in the interface (minutes / hours / days,
-- 45795554249371) is a control, not a storage format: "2 hours" is 120. One unit keeps every
-- comparison in one unit and makes the seven-day ceiling a single integer bound rather than a
-- rule spread across three of them. 10080 = 7 * 24 * 60 (spec Assumption 5).

alter table family.household_settings
  add column if not exists notify_event_at_time        boolean not null default false,
  add column if not exists notify_event_before         boolean not null default true,
  add column if not exists notify_event_before_minutes integer not null default 10,
  add column if not exists notify_task_due             boolean not null default true,
  add column if not exists notify_task_completed       boolean not null default false;

-- The bound is on the column, not only in the Zod schema: the schema exists to give a good
-- error message, the constraint exists to make a bad row impossible.
alter table family.household_settings
  drop constraint if exists household_settings_notify_before_minutes;
alter table family.household_settings
  add constraint household_settings_notify_before_minutes
  check (notify_event_before_minutes between 1 and 10080);

-- notify_event_before_minutes stays meaningful while notify_event_before is false: it is the
-- value the field shows when the switch is turned back on, which is what a household expects.
-- Nothing reads it while the switch is off, so no constraint ties the two together.

notify pgrst, 'reload schema';
