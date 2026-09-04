-- 002_households.sql — households, the email-keyed allowlist (household_users), and the
-- membership helpers is_member / my_household / claim_membership.
-- Serves: FR-002..FR-005 (allowlist, no self-service sign-up), D1 (email-keyed until
-- claimed), security critique F1/F14, quickstart SC-001.
-- Contains no personal data; allowlist rows are inserted by scripts/family-seed.mjs.
--
-- created_by / updated_by (D14) reference family.categories, which does not exist until
-- 003 — those two columns are added to households at the end of 003_categories.sql.

create table if not exists family.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists touch on family.households;
create trigger touch before update on family.households
  for each row execute function family.touch_updated_at();

-- The allowlist. A row is created from an EMAIL before the person has ever signed in;
-- user_id is bound on first sign-in by claim_membership(). user_id stays the authority for
-- every policy (is_member) — the email is only the claim key.
create table if not exists family.household_users (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references family.households(id) on delete cascade,
  email        text not null,
  user_id      uuid references auth.users(id) on delete set null,   -- null until claimed
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint household_users_email_normalised
    check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  constraint household_users_email_key unique (email),   -- one allowlist row per address
  constraint household_users_user_key  unique (user_id)  -- an account sits in exactly one household
);
create index if not exists household_users_household_idx on family.household_users (household_id);

create or replace function family.is_member(target_household uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from family.household_users
     where household_id = target_household
       and user_id is not null
       and user_id = (select auth.uid())
  );
$$;

create or replace function family.my_household()
returns uuid
language sql stable security definer set search_path = '' as $$
  select household_id from family.household_users where user_id = (select auth.uid());
$$;

-- Binds the caller's auth.uid() to the allowlist row whose email equals the caller's
-- CONFIRMED auth.users.email. Idempotent. Returns the household id, or null when the
-- caller is not on the allowlist. Nothing in the request body is trusted: uid and email
-- both come from auth.users for the verified token.
create or replace function family.claim_membership()
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid       uuid := (select auth.uid());
  v_email     text;
  v_household uuid;
begin
  if v_uid is null then return null; end if;

  select household_id into v_household
    from family.household_users
   where user_id = v_uid;
  if found then return v_household; end if;

  select lower(email) into v_email
    from auth.users
   where id = v_uid and email_confirmed_at is not null;
  if v_email is null then return null; end if;

  update family.household_users
     set user_id = v_uid, claimed_at = now()
   where email = v_email and user_id is null
  returning household_id into v_household;

  if v_household is null then
    -- lost a race with a concurrent first sign-in of the same account
    select household_id into v_household
      from family.household_users
     where user_id = v_uid;
  end if;
  return v_household;
end;
$$;

revoke all on function family.is_member(uuid), family.my_household(), family.claim_membership() from public;
grant execute on function family.is_member(uuid), family.my_household(), family.claim_membership() to authenticated;
grant execute on function family.is_member(uuid), family.my_household() to service_role;

alter table family.households      enable row level security;
alter table family.household_users enable row level security;

drop policy if exists "members read their household" on family.households;
create policy "members read their household" on family.households
  for select to authenticated using (family.is_member(id));

drop policy if exists "members read the roster" on family.household_users;
create policy "members read the roster" on family.household_users
  for select to authenticated using (family.is_member(household_id));

grant select on family.households, family.household_users to authenticated;
grant all    on family.households, family.household_users to service_role;
