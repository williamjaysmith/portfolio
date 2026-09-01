-- 005_settings.sql — per-household settings (one row per household).
-- Serves: FR-031..FR-037 (display, time format, week start, punch-out timeout, text size,
-- density), D12 (punch_out_minutes drives the actor TTL), D14 (attribution),
-- D15 (households.name is the single display name — there is no display_name here).
-- Contains no personal data.

create table if not exists family.household_settings (
  household_id       uuid primary key references family.households(id) on delete cascade,
  show_name_not_date boolean not null default true,
  time_format        text not null default '12h' check (time_format in ('12h', '24h')),
  start_week_on      smallint not null default 0 check (start_week_on in (0, 1)),
  punch_out_minutes  smallint not null default 3 check (punch_out_minutes between 1 and 60),
  text_size          text not null default 'medium' check (text_size in ('small', 'medium', 'large')),
  density            text not null default 'roomy' check (density in ('cozy', 'snug', 'roomy')),
  created_by         uuid references family.categories(id) on delete set null,
  updated_by         uuid references family.categories(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists touch on family.household_settings;
create trigger touch before update on family.household_settings
  for each row execute function family.touch_updated_at();

alter table family.household_settings enable row level security;

drop policy if exists "members read settings" on family.household_settings;
create policy "members read settings" on family.household_settings
  for select to authenticated using (family.is_member(household_id));

grant select on family.household_settings to authenticated;
grant all    on family.household_settings to service_role;
