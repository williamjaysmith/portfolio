-- 014_realtime_calendar.sql — live updates for the three calendar tables
-- (FR-276, Assumption 39), then a PostgREST schema reload.
-- Contains no personal data.
--
-- Payloads are invalidation triggers only; the client never renders them (FR-276).
-- DELETE payloads are not RLS-filtered by Realtime, so all three tables keep the
-- default replica identity (payload = primary key only) — `replica identity full`
-- is prohibited (R209, constitution §VII).

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
