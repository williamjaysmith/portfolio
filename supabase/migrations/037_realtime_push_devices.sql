-- 037_realtime_push_devices.sql — live updates for family.push_devices (008 FR-827, R817),
-- then a PostgREST schema reload. The 022/027/029/033 guard block verbatim, over one table.
-- Contains no personal data.
--
-- family.reminder_deliveries is deliberately NOT here. It is the engine's own bookkeeping,
-- never rendered, and at a reminder a minute it would be the noisiest table in the household.
-- push_devices joins because FR-827 puts that list on screen: a device removed on the phone
-- should vanish on the wall, which is what every other table in this app does.
--
-- DEFAULT replica identity — `replica identity full` is PROHIBITED here, and the reason is
-- sharper than it was for the meals tables (constitution §VII, R324). A DELETE payload is not
-- RLS-filtered by Realtime, so a full replica identity would broadcast a removed device's
-- endpoint, p256dh and auth. Those are the credentials for reaching a family's browser. The
-- default identity sends the primary key and nothing else.
--
-- The consequence, already decided by 022 and unchanged: with the default replica identity a
-- DELETE payload carries no household_id, so the client subscribes WITHOUT the server-side
-- filter. This phase deletes on the hot path — removing a device (FR-827) and pruning a dead
-- subscription on a 404/410 (FR-826) — so that matters here rather than being theoretical.
--
-- Hard ordering (R411, R605, R818): this file MUST be pushed to the hosted project BEFORE the
-- branch is merged or deployed. A client binding for a table that is not yet in the publication
-- fails the whole shared channel — the calendar and the boards with it.

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
  foreach t in array array['push_devices'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
