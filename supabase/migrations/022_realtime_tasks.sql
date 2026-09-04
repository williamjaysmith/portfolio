-- 022_realtime_tasks.sql — live updates for the four task tables (FR-392,
-- Assumption 39 (P2)), then a PostgREST schema reload.
-- Contains no personal data.
--
-- Payloads are invalidation triggers only; the client never renders them (FR-392).
-- DELETE payloads are not RLS-filtered by Realtime, so all four tables keep the
-- default replica identity (payload = primary key only) — `replica identity full`
-- is prohibited (R324, constitution §VII): a deleted task's summary is exactly the
-- child's-schedule data a payload must not carry.
--
-- The consequence, already decided by FR-392: with the default replica identity a
-- DELETE payload carries no household_id, so a household-filtered subscription
-- would silently never fire on deletes. The four tables are therefore subscribed
-- WITHOUT the server-side filter, and this phase deletes on the hot path — an
-- un-complete and an unskip each remove a task_resolutions row (FR-355, FR-361).

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
  foreach t in array array['tasks', 'task_assignees', 'task_resolutions', 'task_box_items'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
