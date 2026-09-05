-- 027_realtime_rewards.sql — live updates for the four rewards tables (FR-410,
-- R411), then a PostgREST schema reload. The 022 guard block verbatim, over
-- rewards, reward_eligibilities, star_entries and redemptions.
-- Contains no personal data.
--
-- Payloads are invalidation triggers only; the client never renders them (FR-410).
-- DELETE payloads are not RLS-filtered by Realtime, so all four tables keep the
-- default replica identity (payload = primary key only) — `replica identity full`
-- is prohibited (R324, constitution §VII): a deleted reward's name must not
-- travel in a DELETE payload, the same rule as a deleted task's title.
--
-- The consequence, already decided by 022: with the default replica identity a
-- DELETE payload carries no household_id, so a household-filtered subscription
-- would silently never fire on deletes. The four tables are therefore subscribed
-- WITHOUT the server-side filter, and this phase deletes on the hot path — a
-- reward's deletion cascades its eligibilities and redemptions (FR-421), and a
-- Profile's deletion cascades their entries (FR-443).
--
-- Hard ordering (R411): this file MUST be pushed to the hosted project BEFORE the
-- branch is merged or deployed — a client binding for a table that is not yet in
-- the publication fails the whole shared channel, calendar and board included.

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
  foreach t in array array['rewards', 'reward_eligibilities', 'star_entries', 'redemptions'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
