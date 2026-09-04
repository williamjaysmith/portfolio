-- 008_auth_hook.sql — the "Before User Created" auth hook that rejects account creation for
-- any email not on the allowlist, at Supabase Auth, before an auth.users row exists.
-- Serves: FR-004 (no self-service sign-up), D18, security critique F5.
-- Contains no personal data.
--
-- Operator step (hosted): Dashboard -> Authentication -> Hooks -> Before User Created ->
-- family.hook_restrict_signup — only AFTER the allowlist rows exist (npm run family:seed).
-- Locally the hook is not enabled; the dev account is created by the seed script.

-- SECURITY DEFINER is load-bearing, not decoration. GoTrue calls this hook as
-- `supabase_auth_admin`, and `family.household_users` has RLS enabled with a
-- policy for `authenticated` only. As SECURITY INVOKER the allowlist lookup
-- would return zero rows for that role no matter what it contains, so the hook
-- would refuse EVERY sign-up — the allowlisted parents included, locking the
-- household out of its own app. Running as the owner bypasses RLS; the grants
-- below are what stop anyone else calling it.
create or replace function family.hook_restrict_signup(event jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if v_email is not null
     and exists (select 1 from family.household_users where email = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'message', 'This account is not part of the household.',
    'http_code', 403));
end;
$$;

grant usage   on schema family to supabase_auth_admin;
grant select  on family.household_users to supabase_auth_admin;
revoke all    on function family.hook_restrict_signup(jsonb) from public, anon, authenticated;
grant execute on function family.hook_restrict_signup(jsonb) to supabase_auth_admin;
