-- 001_family_schema.sql — the `family` schema, pgcrypto, API-role grants, palette domain,
-- and the shared updated_at trigger.
-- Serves: research R4 (custom schema, explicit grants), D2 (service_role grants),
-- security critique F6 (no implicit EXECUTE for API roles), FR-020 (palette colours).
-- Contains no personal data.
--
-- Privilege model, asserted by lib/family/__tests__/policies/privileges.test.ts:
--   anon                nothing — not even USAGE on the schema (PostgREST answers 401 / 42501)
--   authenticated       USAGE + SELECT (RLS-filtered) on households, household_users,
--                       categories, household_settings + EXECUTE on a few helpers (granted
--                       explicitly where each helper is created)
--   service_role        USAGE + ALL on tables/sequences (the admin client writes; BYPASSRLS
--                       skips policies, not GRANTs) + EXECUTE on the PIN functions (004)
--   supabase_auth_admin USAGE + SELECT household_users + EXECUTE hook_restrict_signup (008)

create schema if not exists family;
create extension if not exists pgcrypto with schema extensions;

grant usage on schema family to authenticated, service_role;

-- Tables/sequences created later in this schema by `postgres` are writable by service_role.
alter default privileges for role postgres in schema family grant all on tables    to service_role;
alter default privileges for role postgres in schema family grant all on sequences to service_role;

-- PostgreSQL grants EXECUTE to PUBLIC on every new function, and a per-schema
-- "alter default privileges ... revoke" cannot undo that built-in grant (verified: no effect).
-- Every function in this schema therefore carries an explicit `revoke all ... from public`
-- immediately after it is created, followed by grants to exactly the roles that need it.

-- The 20 Skylight palette colours, uppercase, API order (lib/family/colors.ts PALETTE).
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'family' and t.typname = 'palette_color'
  ) then
    execute $domain$
      create domain family.palette_color as text
        check (value in (
          '#FDC36D', '#FBD97E', '#CE812D', '#FDB305', '#F3B075', '#CF632E', '#F66951',
          '#FBA994', '#CB434C', '#D5B6EC', '#A8D4D3', '#93D1E6', '#00526D', '#2178AF',
          '#82D7DD', '#2D8086', '#B6E085', '#408257', '#DADADA', '#915EA1'
        ))
    $domain$;
  end if;
end
$$;

create or replace function family.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function family.touch_updated_at() from public;
