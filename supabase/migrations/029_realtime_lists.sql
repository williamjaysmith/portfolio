-- 029_realtime_lists.sql — live updates for the two lists tables (FR-538, R506), then a
-- PostgREST schema reload. The 022/027 guard block verbatim, over lists and list_items.
-- Contains no personal data.
--
-- Payloads are invalidation triggers only; the client never renders them (FR-538).
-- DELETE payloads are not RLS-filtered by Realtime, so both tables keep the default
-- replica identity (payload = primary key only) — `replica identity full` is
-- prohibited (R324, constitution §VII): a deleted list's name and a deleted item's
-- text must not travel in a DELETE payload, the same rule as a deleted task's title.
--
-- The consequence, already decided by 022: with the default replica identity a
-- DELETE payload carries no household_id, so a household-filtered subscription
-- would silently never fire on deletes. Both tables are therefore subscribed
-- WITHOUT the server-side filter, and this phase deletes on the hot path — Clear
-- Completed (FR-521) and Delete list (FR-512).
--
-- Hard ordering (R411, R506): this file MUST be pushed to the hosted project BEFORE
-- the branch is merged or deployed — a client binding for a table that is not yet in
-- the publication fails the whole shared channel, calendar and boards included.

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
  foreach t in array array['lists', 'list_items'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
