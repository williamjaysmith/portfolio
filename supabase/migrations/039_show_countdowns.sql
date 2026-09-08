-- 039_show_countdowns.sql — the household's one countdown choice (009 FR-903, R904).
-- Contains no personal data.
--
-- Why a column on family.household_settings and not a table of its own: the same reason 034
-- gave for the five reminder choices. This table has held every household-wide preference
-- since Phase 1, its row is already read by every page, already carried by the realtime
-- channel, and already written by exactly one parent-guarded action
-- (updateHouseholdSettings). A table to hold one enum would add a join, a policy and a
-- second write path.
--
-- Why one text column and not a boolean plus a number: the reference's three values are ONE
-- choice — "Always" / "3 months prior to the event" / "1 month prior to the event"
-- [VERIFIED](40459070511515) — and the check constraint keeps the database honest about
-- which three. A fourth value is not a state this has; "never" is achieved by not marking an
-- event as a countdown.
--
-- Why 'always' is the default: a household that has never opened Settings still sees the
-- countdowns it marked, and the opposite default would make the countdown switch look
-- broken. "Adjust the Display" recommends exactly this value [VERIFIED](48784194278683).
--
-- What the three values MEAN in days is deliberately NOT here: the windows are 92 and 31
-- days and live in lib/family/countdowns/inforce.ts, where they are unit-tested at a
-- boundary either side. A month-counted window would mean a different number of days in
-- February than in July, and no test could then be written against a fixed number.

alter table family.household_settings
  add column if not exists show_countdowns text not null default 'always';

-- The constraint is on the column, not only in the Zod schema: the schema exists to give a
-- good error message, the constraint exists to make a bad row impossible.
alter table family.household_settings
  drop constraint if exists household_settings_show_countdowns;
alter table family.household_settings
  add constraint household_settings_show_countdowns
  check (show_countdowns in ('always', 'three_months', 'one_month'));

-- No policy, no grant, no publication change: the column rides the row's shipped row-level
-- security, its existing realtime entry and its DEFAULT replica identity (009 R911).
-- family.events.countdown_enabled needs no migration at all — it has been on that table
-- since 010_events.sql, is already selected by lib/family/rows.ts, and is already carried
-- across a series split by 038_split_carries_the_reminder.sql. This phase writes it; it does
-- not add it.

notify pgrst, 'reload schema';
