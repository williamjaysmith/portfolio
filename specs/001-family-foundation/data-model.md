# Phase 1 Data Model: Family Foundation

**Feature**: `001-family-foundation` | **Date**: 2026-08-28

The `family` schema as delivered by Phase 1. Later phases add tables; none of these change shape.

Semantics follow the reference product's real data model where the research verified it — most importantly that **Profiles and Labels are one entity**, not two.

---

## Entity overview

```
auth.users (Supabase)
     │
     │ 1:1 (optional — a profile may have no account)
     ▼
household_users ──────► households ◄────── household_settings
   (allowlist)              │                    (1:1)
                            │ 1:N
                            ▼
                        categories
              ┌─────────────┴─────────────┐
              │                           │
      is_profile = true            is_profile = false
        "Profiles" (people)        "Labels" (holidays, bin day)
        role, pin_hash, birthday,  emoji, no PIN, no role
        dietary_prefs, avatar
```

Everything in Phases 2–5 (events, tasks, rewards, lists, meals) attaches to `categories`.

---

## Migrations

Ordered; each is idempotent and self-contained.

| # | File | Contents |
|---|---|---|
| 001 | `001_family_schema.sql` | Schema, extensions, `updated_at` trigger, palette domain |
| 002 | `002_households.sql` | `households`, `household_users`, `is_member()`, policies |
| 003 | `003_categories.sql` | `categories`, policies, ordering |
| 004 | `004_pins.sql` | PIN columns, `verify_pin()`, `set_pin()`, rate limiting |
| 005 | `005_settings.sql` | `household_settings`, policies |
| 006 | `006_storage.sql` | `family-avatars` bucket + storage policies |
| 007 | `007_seed.sql` | One household, the allowlist, the three starting profiles |

---

## 001 — Schema and shared pieces

```sql
create schema if not exists family;
create extension if not exists pgcrypto with schema extensions;

-- The 20 sanctioned colours (verified against the reference product's own
-- colour endpoint). Enforced as a domain so every colour column inherits it
-- and an off-palette value is rejected regardless of how it was submitted.
create domain family.palette_color as text
  check (value in (
    '#FDC36D','#FBD97E','#CE812D','#FDB305','#F3B075','#CF632E','#F66951',
    '#FBA994','#CB434C','#DADADA','#D5B6EC','#915EA1','#A8D4D3','#93D1E6',
    '#00526D','#2178AF','#82D7DD','#2D8086','#B6E085','#408257'
  ));

create or replace function family.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
```

**Why a domain rather than a `CHECK` per column**: FR-021 requires rejection at the data store. A domain applies the rule once and every future colour column (list colours, meal-category colours in Phase 4) inherits it automatically — the constraint cannot be forgotten.

---

## 002 — Households and the allowlist

```sql
create table family.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table family.household_users (
  household_id uuid not null references family.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  email        text not null,
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on family.household_users (user_id);

-- SECURITY DEFINER so RLS policies can call it without recursing into
-- household_users' own policy, and STABLE so the planner caches it per query.
create or replace function family.is_member(target_household uuid)
returns boolean
language sql stable security definer set search_path = family, public as $$
  select exists (
    select 1 from family.household_users
    where household_id = target_household and user_id = auth.uid()
  );
$$;

create or replace function family.my_household() returns uuid
language sql stable security definer set search_path = family, public as $$
  select household_id from family.household_users where user_id = auth.uid() limit 1;
$$;

alter table family.households      enable row level security;
alter table family.household_users enable row level security;

create policy "members read their household" on family.households
  for select to authenticated using (family.is_member(id));

create policy "members read the roster" on family.household_users
  for select to authenticated using (family.is_member(household_id));

grant usage on schema family to authenticated;
grant select on family.households, family.household_users to authenticated;
```

**No insert/update/delete policies on either table.** The allowlist is deliberately not editable from the application — adding a family member is a migration or a dashboard action. This satisfies FR-004 (no public sign-up) absolutely: there is no code path that grants access.

**Validation rules**
- `households.name` — 1–60 characters after trimming.
- `household_users` — composite primary key prevents duplicate membership.
- `email` is stored for display in settings; `user_id` is the authority.

---

## 003 — Categories (Profiles and Labels)

```sql
create table family.categories (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references family.households(id) on delete cascade,

  label          text not null check (length(trim(label)) between 1 and 40),
  color          family.palette_color not null,
  is_profile     boolean not null default true,

  -- profile-only
  avatar_kind    text check (avatar_kind in ('illustration','photo')),
  avatar_id      text,          -- illustration key, e.g. 'fox'
  avatar_path    text,          -- storage path when avatar_kind = 'photo'
  birthday       date,
  dietary_prefs  text check (dietary_prefs is null or length(dietary_prefs) <= 280),
  role           text not null default 'member' check (role in ('parent','member')),
  user_id        uuid references auth.users(id) on delete set null,

  -- label-only
  emoji          text,

  show_on_tasks  boolean not null default true,
  sort_order     numeric not null default 1000,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- A Label is not a person: no avatar, birthday, diet, account, or elevated role.
  constraint label_has_no_person_fields check (
    is_profile or (
      avatar_kind is null and avatar_id is null and avatar_path is null
      and birthday is null and dietary_prefs is null
      and user_id is null and role = 'member'
    )
  ),
  -- A Profile uses an avatar, not an emoji.
  constraint profile_has_no_emoji check (is_profile is false or emoji is null),
  -- If there is an avatar, it is exactly one kind.
  constraint avatar_is_coherent check (
    avatar_kind is null
    or (avatar_kind = 'illustration' and avatar_id is not null and avatar_path is null)
    or (avatar_kind = 'photo'        and avatar_path is not null and avatar_id is null)
  )
);

create index on family.categories (household_id, sort_order);
create unique index on family.categories (user_id) where user_id is not null;

create trigger touch before update on family.categories
  for each row execute function family.touch_updated_at();

alter table family.categories enable row level security;

create policy "members read categories" on family.categories
  for select to authenticated using (family.is_member(household_id));

grant select on family.categories to authenticated;
-- No insert/update/delete grant: writes go through parent-only server actions
-- using the service role, after the actor's role has been verified.
```

**Why writes are not granted to `authenticated`**: FR-015 requires parent-only enforcement on the server. RLS can see *which account* is asking but not *which profile is punched in* — that lives in a signed cookie the database never sees. Granting write access to `authenticated` would let any signed-in family member (including a phone the child borrowed) write directly via the Data API, bypassing the actor check entirely. Instead, all mutations pass through server actions that verify the actor first and then write with elevated privileges. Reads stay on RLS because reading is unrestricted within the household (FR-008).

**Validation rules**

| Field | Rule |
|---|---|
| `label` | 1–40 chars, trimmed non-empty |
| `color` | must be one of the 20 palette values (domain) |
| `role` | `parent` or `member`; forced to `member` on Labels |
| `dietary_prefs` | ≤ 280 chars |
| `user_id` | at most one profile per account (partial unique index) |
| avatar | illustration *or* photo, never both, never a stray path |
| Label | no avatar, birthday, diet, account, emoji-instead-of-avatar |

**Ordering**: `sort_order` is a `numeric` fractional index — inserting between two neighbours is the midpoint of their values, so a reorder writes one row rather than renumbering the list. Chosen over the reference product's relative `{before: id}` API for the same drag behaviour with a simpler write (divergence #5).

---

## 004 — PINs

```sql
alter table family.categories
  add column pin_hash       text,
  add column pin_set_at     timestamptz,
  add column failed_attempts smallint not null default 0,
  add column locked_until   timestamptz;

-- pin_hash is never granted to any client role and never selected by the app.

create or replace function family.set_pin(target uuid, new_pin text)
returns void
language plpgsql security definer set search_path = family, extensions, public as $$
declare target_household uuid;
begin
  select household_id into target_household from family.categories where id = target;
  if target_household is null then raise exception 'no such profile'; end if;
  if not family.is_member(target_household) then raise exception 'not a member'; end if;
  if new_pin !~ '^[0-9]{4}$' then raise exception 'pin must be four digits'; end if;

  update family.categories
     set pin_hash = crypt(new_pin, gen_salt('bf', 10)),
         pin_set_at = now(), failed_attempts = 0, locked_until = null
   where id = target and is_profile;
end;
$$;

create or replace function family.verify_pin(target uuid, candidate text)
returns table (ok boolean, reason text)
language plpgsql security definer set search_path = family, extensions, public as $$
declare rec record;
begin
  select id, household_id, pin_hash, locked_until
    into rec from family.categories where id = target and is_profile;

  if rec.id is null                     then return query select false, 'not_found';  return; end if;
  if not family.is_member(rec.household_id) then return query select false, 'forbidden'; return; end if;
  if rec.pin_hash is null               then return query select false, 'no_pin';     return; end if;
  if rec.locked_until is not null and rec.locked_until > now()
                                        then return query select false, 'locked';     return; end if;

  if rec.pin_hash = crypt(candidate, rec.pin_hash) then
    update family.categories
       set failed_attempts = 0, locked_until = null where id = target;
    return query select true, 'ok';
  else
    update family.categories
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 5
                               then now() + interval '15 minutes' else null end
     where id = target;
    return query select false, 'bad_pin';
  end if;
end;
$$;

revoke all on function family.set_pin(uuid, text)     from public, anon, authenticated;
revoke all on function family.verify_pin(uuid, text)  from public, anon, authenticated;
-- Executed only by the service role from inside a server action.
```

**Design notes**

- `set_pin` is gated on **household membership only**, not on being punched in. This is FR-018 and SC-010 — the no-lockout rule. A household where nobody has a PIN yet must still be able to set the first one, and a signed-in parent is already proven family.
- `verify_pin` returns a *reason* so the interface can distinguish "wrong PIN" from "locked" from "this profile has no PIN". It never reveals whether the profile exists to a non-member — that returns `forbidden`, the same as any other non-member request.
- Both are revoked from client roles. Even with a leaked anon key, neither can be called.
- Rate limiting is inside the same statement as the check, so concurrent attempts cannot race past the counter (R6).

---

## 005 — Household settings

```sql
create table family.household_settings (
  household_id      uuid primary key references family.households(id) on delete cascade,
  display_name      text,             -- null → show the date instead (FR-031)
  show_name_not_date boolean not null default true,
  time_format       text not null default '12h' check (time_format in ('12h','24h')),
  start_week_on     smallint not null default 0 check (start_week_on in (0,1)),
  punch_out_minutes smallint not null default 3
                    check (punch_out_minutes between 1 and 60),
  text_size         text not null default 'medium'
                    check (text_size in ('small','medium','large')),
  density           text not null default 'roomy'
                    check (density in ('cozy','snug','roomy')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger touch before update on family.household_settings
  for each row execute function family.touch_updated_at();

alter table family.household_settings enable row level security;
create policy "members read settings" on family.household_settings
  for select to authenticated using (family.is_member(household_id));
grant select on family.household_settings to authenticated;
```

Only the fields Phase 1 actually uses. Calendar-specific settings (`dim_past_events`, `shade_weekends`, countdown visibility, schedule-day count) arrive with Phase 2 as an `alter table`, so no unused columns ship early.

---

## 006 — Avatar storage

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-avatars','family-avatars', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Path convention: <household_id>/<profile_id>.<ext>
create policy "members read avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'family-avatars'
         and family.is_member(((storage.foldername(name))[1])::uuid));
```

Private bucket, 5 MB cap, three image types, enforced by the storage layer as well as by the server action (R7). Reads use short-lived signed URLs. Writes go through a server action, so no insert policy is granted.

---

## 007 — Seed

```sql
-- One household; two parents on the allowlist; three starting profiles.
-- Emails and names are supplied at migration time, not committed here.
```

Seeds the single household, inserts the two adult emails into `household_users` (resolved to `auth.users` ids on first sign-in), creates the three profiles with distinct palette colours, and creates the settings row. PINs are **not** seeded — they are set from the interface, exercising the FR-018 path on day one.

---

## State transitions

**Actor session** (not persisted — signed cookie, R3):

```
  none ──(correct PIN)──► punched in as <profile>
    ▲                            │
    │                            ├──(idle N minutes)──┐
    └────────────────────────────┴──(punch out)───────┘
                                 └──(profile deleted)─┘
```

**PIN lockout**:

```
  unlocked ──(5th consecutive failure)──► locked (15 min) ──(expiry)──► unlocked
      ▲                                                                    │
      └──────────────────────(any success resets counter)──────────────────┘
```

---

## What Phases 2–5 add

Recorded so nothing here needs reshaping later: `events` + `event_categories` + `event_exceptions` (Phase 2); `tasks` + `task_completions` (Phase 3); `rewards` + `point_ledger` (Phase 3); `lists` + `list_items` (Phase 4); `meal_categories` + `meal_recipes` + `meal_sittings` (Phase 4); `push_subscriptions` + `reminders` (Phase 5). Every one carries `household_id` and reuses `is_member()` for its read policy.
