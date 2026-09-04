-- 004_pins.sql — PIN state in its own unreadable table, the has_pin mirror on categories,
-- and the three PIN functions (set / verify / clear) callable only by service_role.
-- Serves: FR-011..FR-013, FR-018 (PINs, lockout), research R2/R6, D3 (verified caller is
-- an explicit parameter), D4 (no hash is ever selectable — not even with the secret key),
-- security critique F3/F4/F12.
-- Contains no personal data.

create table if not exists family.profile_pins (
  profile_id      uuid primary key references family.categories(id) on delete cascade,
  pin_hash        text not null,
  pin_set_at      timestamptz not null default now(),
  failed_attempts smallint not null default 0,
  locked_until    timestamptz
);
alter table family.profile_pins enable row level security;
-- No API role may touch this table. The default privileges from 001 gave service_role ALL;
-- take it back so even the secret key never reads a hash. Only the SECURITY DEFINER
-- functions below (owned by postgres) can reach it.
revoke all on family.profile_pins from service_role, authenticated, anon, public;

-- What the UI needs (US2 scenario 9): which profiles can be actors.
alter table family.categories add column if not exists has_pin boolean not null default false;

create or replace function family.sync_has_pin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update family.categories set has_pin = false where id = old.profile_id;
    return old;
  end if;
  update family.categories set has_pin = true where id = new.profile_id;
  return new;
end;
$$;
revoke all on function family.sync_has_pin() from public;

drop trigger if exists sync_has_pin on family.profile_pins;
create trigger sync_has_pin after insert or delete on family.profile_pins
  for each row execute function family.sync_has_pin();

-- p_user_id is the VERIFIED session user, passed by the server action (requireMember()),
-- because auth.uid() is NULL under service_role and these functions run via service_role.
-- Membership is re-checked here against household_users: defence in depth.
create or replace function family.set_pin(p_user_id uuid, p_profile uuid, p_pin text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
begin
  if p_user_id is null then
    raise exception 'caller required' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'pin must be four digits' using errcode = '22023';
  end if;

  select household_id into v_household
    from family.categories
   where id = p_profile and is_profile;
  if v_household is null then
    raise exception 'no such profile' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from family.household_users
     where household_id = v_household and user_id = p_user_id
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;

  insert into family.profile_pins (profile_id, pin_hash)
  values (p_profile, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (profile_id) do update
     set pin_hash        = excluded.pin_hash,
         pin_set_at      = now(),
         failed_attempts = 0,
         locked_until    = null;
end;
$$;

create or replace function family.verify_pin(p_user_id uuid, p_profile uuid, p_candidate text)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
  v_pin       family.profile_pins%rowtype;
  v_attempts  smallint;
begin
  if p_user_id is null then
    return query select false, 'forbidden'; return;
  end if;

  select household_id into v_household
    from family.categories
   where id = p_profile and is_profile;
  if v_household is null then
    return query select false, 'not_found'; return;
  end if;

  if not exists (
    select 1 from family.household_users
     where household_id = v_household and user_id = p_user_id
  ) then
    return query select false, 'forbidden'; return;
  end if;

  -- Row lock: concurrent attempts against one profile serialise here, so the counter and
  -- the lock check are read and written under the same lock.
  select * into v_pin from family.profile_pins where profile_id = p_profile for update;
  if not found then
    return query select false, 'no_pin'; return;
  end if;

  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    return query select false, 'locked'; return;
  end if;

  if p_candidate ~ '^[0-9]{4}$'
     and v_pin.pin_hash = extensions.crypt(p_candidate, v_pin.pin_hash) then
    update family.profile_pins
       set failed_attempts = 0, locked_until = null
     where profile_id = p_profile;
    return query select true, 'ok'; return;
  end if;

  -- An expired lock starts a fresh count; otherwise the first wrong guess after the
  -- cooling-off period would re-lock immediately.
  v_attempts := case when v_pin.locked_until is not null then 1 else v_pin.failed_attempts + 1 end;
  update family.profile_pins
     set failed_attempts = v_attempts,
         locked_until    = case when v_attempts >= 5 then now() + interval '15 minutes' end
   where profile_id = p_profile;
  return query select false, 'bad_pin';
end;
$$;

-- Removes a profile's PIN so it can no longer be punched in (parent action, D5).
-- has_pin flips back to false through the sync_has_pin trigger.
create or replace function family.clear_pin(p_user_id uuid, p_profile uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
begin
  if p_user_id is null then
    raise exception 'caller required' using errcode = '42501';
  end if;

  select household_id into v_household
    from family.categories
   where id = p_profile and is_profile;
  if v_household is null then
    raise exception 'no such profile' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from family.household_users
     where household_id = v_household and user_id = p_user_id
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;

  delete from family.profile_pins where profile_id = p_profile;
end;
$$;

revoke all on function family.set_pin(uuid, uuid, text),
                       family.verify_pin(uuid, uuid, text),
                       family.clear_pin(uuid, uuid)
  from public, anon, authenticated;
grant execute on function family.set_pin(uuid, uuid, text),
                          family.verify_pin(uuid, uuid, text),
                          family.clear_pin(uuid, uuid)
  to service_role;
