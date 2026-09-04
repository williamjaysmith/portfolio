-- 009_realtime.sql — adds the three member-readable tables to the supabase_realtime
-- publication so postgres_changes can fan out edits to every signed-in device.
-- Serves: FR-023 (changes appear on every device), D17, security critique F17.
-- Contains no personal data.
--
-- Payloads are invalidation triggers only; the client never renders them. DELETE events
-- are not RLS-filtered by Realtime, so the tables keep the default replica identity
-- (payload = primary key only). profile_pins is deliberately NOT published.

do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'family: publication supabase_realtime not found — skipping realtime setup.';
    return;
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    return;   -- FOR ALL TABLES publications already cover the schema
  end if;
  foreach v_table in array array['categories', 'household_settings', 'households'] loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table family.%I', v_table);
    end if;
  end loop;
end
$$;

-- Make the new schema, tables and RPCs visible to PostgREST without a restart.
notify pgrst, 'reload schema';
