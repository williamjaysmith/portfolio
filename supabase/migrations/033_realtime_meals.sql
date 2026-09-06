-- 033_realtime_meals.sql — live updates for the four meals tables (006 FR-643, R605), then a
-- PostgREST schema reload. The 022/027/029 guard block verbatim, over meal_categories, recipes,
-- meals and meal_exceptions. Contains no personal data.
--
-- Payloads are invalidation triggers only; the client never renders them (FR-643).
-- DELETE payloads are not RLS-filtered by Realtime, so all four tables keep the default
-- replica identity (payload = primary key only) — `replica identity full` is
-- prohibited (R324, constitution §VII): a deleted recipe's name and text, a deleted
-- meal's note, must not travel in a DELETE payload.
--
-- The consequence, already decided by 022: with the default replica identity a
-- DELETE payload carries no household_id, so a household-filtered subscription
-- would silently never fire on deletes. The tables are therefore subscribed
-- WITHOUT the server-side filter, and this phase deletes on the hot path —
-- "This recipe and planned meals" (FR-616) and Delete meal (FR-626).
--
-- Hard ordering (R411, R605): this file MUST be pushed to the hosted project BEFORE
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
  foreach t in array array['meal_categories', 'recipes', 'meals', 'meal_exceptions'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
