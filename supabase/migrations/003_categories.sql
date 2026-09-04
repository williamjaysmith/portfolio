-- 003_categories.sql — the Category record (Profiles and Labels in one table), its
-- integrity triggers, RLS, and the FR-016 attribution columns.
-- Serves: FR-009..FR-017, FR-019..FR-022 (profiles/labels, colours, avatars, roles),
-- D6/security critique F7 (a household always keeps one parent, enforced in the DB),
-- D14 (created_by / updated_by), F15 (profile account must be a member).
-- Contains no personal data.

create table if not exists family.categories (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references family.households(id) on delete cascade,
  label          text not null check (length(trim(label)) between 1 and 40),
  color          family.palette_color not null,
  is_profile     boolean not null default true,
  avatar_kind    text check (avatar_kind in ('illustration', 'photo')),
  avatar_id      text,
  avatar_path    text,
  birthday       date,
  dietary_prefs  text check (dietary_prefs is null or length(dietary_prefs) <= 280),
  role           text not null default 'member' check (role in ('parent', 'member')),
  user_id        uuid references auth.users(id) on delete set null,
  emoji          text,
  show_on_tasks  boolean not null default true,
  sort_order     numeric not null default 1000,
  -- FR-016: which profile made / last changed this row (null in bootstrap and seed paths).
  created_by     uuid references family.categories(id) on delete set null,
  updated_by     uuid references family.categories(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint label_has_no_person_fields check (
    is_profile or (
      avatar_kind is null and avatar_id is null and avatar_path is null
      and birthday is null and dietary_prefs is null
      and user_id is null and role = 'member'
    )
  ),
  constraint profile_has_no_emoji check (is_profile is false or emoji is null),
  constraint avatar_is_coherent check (
    avatar_kind is null
    or (avatar_kind = 'illustration' and avatar_id is not null and avatar_path is null)
    or (avatar_kind = 'photo'        and avatar_path is not null and avatar_id is null)
  )
);
create index if not exists categories_household_sort_idx on family.categories (household_id, sort_order);
-- NULLs are distinct, so unclaimed profiles never collide.
create unique index if not exists categories_user_key on family.categories (user_id);

drop trigger if exists touch on family.categories;
create trigger touch before update on family.categories
  for each row execute function family.touch_updated_at();

-- The account linked to a profile must be a member of that profile's household.
create or replace function family.assert_profile_account_is_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and not exists (
    select 1
      from family.household_users
     where household_id = new.household_id and user_id = new.user_id
  ) then
    raise exception 'profile account is not a member of this household' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function family.assert_profile_account_is_member() from public;

drop trigger if exists profile_account_is_member on family.categories;
create trigger profile_account_is_member
  before insert or update of user_id, household_id on family.categories
  for each row execute function family.assert_profile_account_is_member();

-- A household always keeps >= 1 parent profile: covers DELETE *and* demotion, and
-- serialises concurrent removals on the household row so two "last parent" checks cannot
-- both pass. Deferred so a delete+insert in one transaction is fine. The application maps
-- SQLSTATE 23514 + 'LAST_PARENT' to CONFLICT (D29).
create or replace function family.guard_last_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from family.households where id = old.household_id for update;
  if not found then return null; end if;   -- household itself is being deleted (cascade)
  if not exists (
    select 1
      from family.categories
     where household_id = old.household_id and is_profile and role = 'parent'
  ) then
    raise exception 'LAST_PARENT: a household must keep at least one parent profile'
      using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function family.guard_last_parent() from public;

drop trigger if exists keep_one_parent on family.categories;
create constraint trigger keep_one_parent
  after delete or update of role, is_profile, household_id on family.categories
  deferrable initially deferred
  for each row when (old.is_profile and old.role = 'parent')
  execute function family.guard_last_parent();

alter table family.categories enable row level security;

drop policy if exists "members read categories" on family.categories;
create policy "members read categories" on family.categories
  for select to authenticated using (family.is_member(household_id));

grant select on family.categories to authenticated;
grant all    on family.categories to service_role;

-- D14 attribution on households (deferred from 002 until categories existed).
alter table family.households
  add column if not exists created_by uuid references family.categories(id) on delete set null,
  add column if not exists updated_by uuid references family.categories(id) on delete set null;
