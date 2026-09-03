-- 013_household_timezone.sql — the household's one IANA timezone (FR-284,
-- Assumption 34). Read-only this phase: no action writes it (Assumption 16).
-- The 'UTC' default is a deliberate loud-failure backfill; the real zone is
-- written by scripts/family-seed.mjs, never by committed SQL (R203).
-- Contains no personal data.

alter table family.household_settings
  add column if not exists timezone text not null default 'UTC';

create or replace function family.assert_settings_timezone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'not an IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function family.assert_settings_timezone() from public;
drop trigger if exists settings_timezone_is_valid on family.household_settings;
create trigger settings_timezone_is_valid
  before insert or update of timezone on family.household_settings
  for each row execute function family.assert_settings_timezone();
