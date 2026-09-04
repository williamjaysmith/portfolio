# Phase 1 Data Model: Family Foundation

**Feature**: `001-family-foundation` | **Date**: 2026-08-28 | **Amended**: 2026-08-31 (see [Amendments](#amendments-after-adversarial-review-2026-08-31))

The `family` schema as delivered by Phase 1. Later phases add tables; none of these change shape.

Semantics follow the reference product's real data model where the research verified it — most importantly that **Profiles and Labels are one entity**, not two.

---

## Entity overview

```
auth.users (Supabase)
     │
     │ bound on first sign-in by claim_membership()
     ▼
household_users ──────► households ◄────── household_settings
 (allowlist, email-keyed         │                    (1:1)
  until claimed)                 │ 1:N
                                 ▼
                             categories ◄──── profile_pins
                   ┌─────────────┴─────────────┐     (1:1, profiles only;
                   │                           │      no client role can read it)
           is_profile = true            is_profile = false
             "Profiles" (people)        "Labels" (holidays, bin day)
             role, has_pin, birthday,   emoji, no PIN, no role
             dietary_prefs, avatar

created_by / updated_by on households, categories, household_settings → categories(id)
```

Everything in Phases 2–5 (events, tasks, rewards, lists, meals) attaches to `categories`.

---

## Migrations

Ordered; each is idempotent where that is cheap (`if not exists`, `create or replace`, `on conflict`, `drop … if exists` before `create trigger`/`create policy`). Every `SECURITY DEFINER` function sets `search_path = ''` and schema-qualifies every name (`extensions.crypt`, `auth.uid()`). Every function is explicitly `revoke`d from `public` immediately after creation — PostgreSQL grants `EXECUTE` to `public` on every new function and a per-schema `ALTER DEFAULT PRIVILEGES … REVOKE` does not undo it (verified against a Postgres 17 Supabase image). Each file opens with a comment naming what it creates and which requirement or decision it serves. No personal data appears in any migration.

| # | File | Contents |
|---|---|---|
| 001 | `001_family_schema.sql` | Schema, `pgcrypto`, grants to `authenticated` + `service_role`, default privileges, palette domain, `touch_updated_at()` |
| 002 | `002_households.sql` | `households`, email-keyed `household_users`, `is_member()`, `my_household()`, `claim_membership()`, read policies, grants |
| 003 | `003_categories.sql` | `categories` (+ `created_by`/`updated_by` on it and on `households`), coherence constraints, account-membership trigger, last-parent trigger, read policy, grants |
| 004 | `004_pins.sql` | `profile_pins` (no client grants, `service_role` revoked), `categories.has_pin` + sync trigger, `set_pin()`, `verify_pin()`, `clear_pin()` |
| 005 | `005_settings.sql` | `household_settings` (no `display_name`; `created_by`/`updated_by`), read policy, grants |
| 006 | `006_storage.sql` | `can_read_avatar(text)`; guarded `family-avatars` bucket + read policy |
| 007 | `007_seed.sql` | The single household (fixed id) + its settings row. **Nothing else** |
| 008 | `008_auth_hook.sql` | `hook_restrict_signup(jsonb)` (Before User Created) + `supabase_auth_admin` grants |
| 009 | `009_realtime.sql` | Guarded `supabase_realtime` publication for the three read tables; `notify pgrst, 'reload schema'` |

Nothing has been pushed to the live project yet. `supabase db reset` applies all nine locally; `supabase db push` is an operator step (quickstart §4).

---

## 001 — Schema, grants and shared pieces

```sql
-- 001_family_schema.sql — schema, pgcrypto, API-role grants, palette domain,
-- updated_at trigger. Serves FR-021 (palette enforced at the store) and D2.
create schema if not exists family;
create extension if not exists pgcrypto with schema extensions;

-- API roles reach this schema only through explicit grants. anon gets nothing:
-- an anonymous probe must fail with 42501, not be handed an empty result.
grant usage on schema family to authenticated, service_role;

-- The admin client (secret key → service_role) has to be able to write. BYPASSRLS
-- skips policies; it does not skip GRANTs — without these every server action
-- fails with "permission denied for schema family" (verified, Postgres 17 image).
alter default privileges for role postgres in schema family grant all on tables    to service_role;
alter default privileges for role postgres in schema family grant all on sequences to service_role;
-- Functions are NOT covered by default privileges on purpose: each one below is
-- revoked from public and granted to exactly the roles that need it.

-- The 20 sanctioned colours (verified against the reference product's own
-- colour endpoint). A domain, so every colour column inherits the rule.
create domain family.palette_color as text
  check (value in (
    '#FDC36D','#FBD97E','#CE812D','#FDB305','#F3B075','#CF632E','#F66951',
    '#FBA994','#CB434C','#DADADA','#D5B6EC','#915EA1','#A8D4D3','#93D1E6',
    '#00526D','#2178AF','#82D7DD','#2D8086','#B6E085','#408257'
  ));

create or replace function family.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function family.touch_updated_at() from public;
```

**Why a domain rather than a `CHECK` per column**: FR-021 requires rejection at the data store. A domain applies the rule once and every future colour column (list colours, meal-category colours in Phase 4) inherits it automatically — the constraint cannot be forgotten.

**Why `anon` gets nothing**: granting `usage` + `select` to `anon` just to make an anonymous probe return `[]` widens the surface — one future `to public using (true)` policy would leak. The guarantee is stronger as a hard `42501` (quickstart SC-001(c)).

---

## 002 — Households and the allowlist

```sql
-- 002_households.sql — households, the email-keyed allowlist, membership
-- helpers, claim_membership(). Serves FR-003/FR-004/FR-005 and D1.
create table if not exists family.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
  -- created_by / updated_by are added in 003, once categories exists (D14).
);
drop trigger if exists touch on family.households;
create trigger touch before update on family.households
  for each row execute function family.touch_updated_at();

-- The allowlist. A row is created from an EMAIL before the person has ever
-- signed in; user_id is bound on first sign-in by claim_membership(). user_id
-- stays the authority for every policy (is_member) — email is only the claim key.
create table if not exists family.household_users (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references family.households(id) on delete cascade,
  email        text not null,
  user_id      uuid references auth.users(id) on delete set null,   -- null until claimed
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint household_users_email_normalised
    check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  constraint household_users_email_key unique (email),     -- one allowlist row per address
  constraint household_users_user_key  unique (user_id)    -- an account sits in exactly one household
);
create index if not exists household_users_household_idx on family.household_users (household_id);

-- SECURITY DEFINER so RLS policies can call it without recursing into
-- household_users' own policy; STABLE so the planner caches it per query.
create or replace function family.is_member(target_household uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from family.household_users
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

-- Binds the caller's auth.uid() to the allowlist row whose email equals the
-- caller's CONFIRMED auth.users.email. Idempotent. Returns the household id, or
-- null when the caller is not on the allowlist. Nothing in the request body is
-- trusted: uid and email both come from auth.users for the verified token.
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
    from family.household_users where user_id = v_uid;
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
      from family.household_users where user_id = v_uid;
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
```

**No insert/update/delete policies on either table.** The allowlist is not editable from the application — rows are added by the seed script (`npm run family:seed`) or by hand. There is no code path that grants access, which is what makes FR-004 hold at the data layer; `008_auth_hook.sql` makes it hold at the Auth API too.

**How a person gets in**: the allowlist row exists first, keyed on their lower-cased email. On their first Google sign-in the callback (and, as a fallback, `requireMember()`) calls `claim_membership()`, which binds `auth.uid()` to that row using the *confirmed* address in `auth.users`. From then on every policy is keyed on `user_id`. The original `user_id NOT NULL` shape made seeding by email impossible (verified: the insert violated the not-null constraint).

**Validation rules**
- `households.name` — 1–60 characters after trimming. This is *the* household name (D15).
- `household_users.email` — stored lower-cased and trimmed, one row per address, one household per account.
- `user_id` is the authority; `email` is only the claim key and display value.

---

## 003 — Categories (Profiles and Labels)

```sql
-- 003_categories.sql — categories (Profiles + Labels), coherence constraints,
-- created_by/updated_by attribution (FR-016, D14), account-membership trigger,
-- last-parent trigger (D6), read policy. Serves FR-019…FR-027.
create table if not exists family.categories (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references family.households(id) on delete cascade,

  label          text not null check (length(trim(label)) between 1 and 40),
  color          family.palette_color not null,
  is_profile     boolean not null default true,

  -- profile-only
  avatar_kind    text check (avatar_kind in ('illustration','photo')),
  avatar_id      text,          -- illustration key from lib/family/avatars.ts
  avatar_path    text,          -- storage path when avatar_kind = 'photo'
  birthday       date,
  dietary_prefs  text check (dietary_prefs is null or length(dietary_prefs) <= 280),
  role           text not null default 'member' check (role in ('parent','member')),
  user_id        uuid references auth.users(id) on delete set null,

  -- label-only
  emoji          text,

  show_on_tasks  boolean not null default true,
  sort_order     numeric not null default 1000,

  -- FR-016: who made / last changed this row. Self-referential; null in the
  -- bootstrap path (first profile) and for actor-less writes.
  created_by     uuid references family.categories(id) on delete set null,
  updated_by     uuid references family.categories(id) on delete set null,

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
create index if not exists categories_household_sort_idx on family.categories (household_id, sort_order);
create unique index if not exists categories_user_key on family.categories (user_id);  -- NULLs are distinct
drop trigger if exists touch on family.categories;
create trigger touch before update on family.categories
  for each row execute function family.touch_updated_at();

-- Attribution columns on households (deferred from 002 — the FK target did not exist yet).
alter table family.households
  add column if not exists created_by uuid references family.categories(id) on delete set null,
  add column if not exists updated_by uuid references family.categories(id) on delete set null;

-- The account linked to a profile must be a member of that profile's household.
create or replace function family.assert_profile_account_is_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and not exists (
    select 1 from family.household_users
     where household_id = new.household_id and user_id = new.user_id)
  then
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

-- A household always keeps >= 1 parent profile: covers DELETE *and* demotion,
-- and serialises concurrent removals on the household row so two "last parent"
-- checks cannot both pass. Deferred so a delete+insert in one transaction is fine.
create or replace function family.guard_last_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from family.households where id = old.household_id for update;
  if not found then return null; end if;   -- household itself is being deleted (cascade)
  if not exists (
    select 1 from family.categories
     where household_id = old.household_id and is_profile and role = 'parent')
  then
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
```

**Why writes are not granted to `authenticated`**: FR-015 requires parent-only enforcement on the server. RLS can see *which account* is asking but not *which profile is punched in* — that lives in a signed cookie the database never sees. Granting write access to `authenticated` would let any signed-in family member (including a phone the child borrowed) write directly via the Data API, bypassing the actor check entirely. Instead, all mutations pass through server actions that verify the actor first and then write with the `service_role` grant. Reads stay on RLS because reading is unrestricted within the household (FR-008).

**Why the last-parent rule is a trigger, not just application code**: demotion (`role → member`) was unguarded, and two concurrent deletes both passed an application-level count (verified with a two-session race). The constraint trigger takes a per-household row lock and raises `LAST_PARENT` with SQLSTATE `23514`; the action keeps a friendly pre-check → `CONFLICT` and maps the SQLSTATE as the backstop. Because the trigger fires on the last parent's delete *and* demotion, a household can never reach zero parents — which is also what keeps the bootstrap path (D6) closed once a parent exists.

**Validation rules**

| Field | Rule |
|---|---|
| `label` | 1–40 chars, trimmed non-empty |
| `color` | must be one of the 20 palette values (domain) |
| `role` | `parent` or `member`; forced to `member` on Labels; the last parent cannot be demoted or deleted |
| `dietary_prefs` | ≤ 280 chars |
| `user_id` | at most one profile per account (unique index); must be a member of the same household (trigger) |
| avatar | illustration *or* photo, never both, never a stray path |
| Label | no avatar, birthday, diet, account; emoji instead of avatar (optional — the source says a Label *may* take an emoji) |
| `created_by` / `updated_by` | set from the actor by every action; `null` for bootstrap and actor-less writes |

**Ordering**: `sort_order` is a `numeric` fractional index — inserting between two neighbours is the midpoint of their values, so a reorder writes one row rather than renumbering the list (`lib/family/ordering.ts`). Chosen over the reference product's relative `{before: id}` API for the same drag behaviour with a simpler write (divergence #5).

---

## 004 — PINs

```sql
-- 004_pins.sql — PIN state in its own table, has_pin projection, set/verify/clear
-- functions keyed on the verified caller. Serves FR-010…FR-012, FR-017, FR-018; D3, D4.

-- PIN state lives in its own table with NO client grants, so no table-level
-- SELECT on categories (and no Realtime payload) can ever carry a hash.
create table if not exists family.profile_pins (
  profile_id      uuid primary key references family.categories(id) on delete cascade,
  pin_hash        text not null,
  pin_set_at      timestamptz not null default now(),
  failed_attempts smallint not null default 0,
  locked_until    timestamptz
);
alter table family.profile_pins enable row level security;
revoke all on family.profile_pins from service_role;   -- even the secret key never reads a hash

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

-- p_user_id is the VERIFIED session user, passed by the server action from
-- requireMember(). auth.uid() is NULL under service_role (verified) and these
-- functions are only ever executed via service_role, so the caller must be explicit.
create or replace function family.set_pin(p_user_id uuid, p_profile uuid, p_pin text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_household uuid;
begin
  if p_user_id is null then raise exception 'caller required' using errcode = '42501'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin must be four digits' using errcode = '22023'; end if;

  select household_id into v_household
    from family.categories where id = p_profile and is_profile;
  if v_household is null then raise exception 'no such profile' using errcode = 'P0002'; end if;

  if not exists (select 1 from family.household_users
                  where household_id = v_household and user_id = p_user_id)
  then raise exception 'not a member' using errcode = '42501'; end if;

  insert into family.profile_pins (profile_id, pin_hash)
  values (p_profile, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)))
  on conflict (profile_id) do update
     set pin_hash = excluded.pin_hash, pin_set_at = now(),
         failed_attempts = 0, locked_until = null;
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
  if p_user_id is null then return query select false, 'forbidden'; return; end if;

  select household_id into v_household
    from family.categories where id = p_profile and is_profile;
  if v_household is null then return query select false, 'not_found'; return; end if;

  if not exists (select 1 from family.household_users
                  where household_id = v_household and user_id = p_user_id)
  then return query select false, 'forbidden'; return; end if;

  -- Row lock: concurrent attempts against one profile serialise here, so the
  -- counter and the lock check are read and written under the same lock.
  select * into v_pin from family.profile_pins where profile_id = p_profile for update;
  if not found then return query select false, 'no_pin'; return; end if;

  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    return query select false, 'locked'; return;
  end if;

  if p_candidate ~ '^[0-9]{4}$'
     and v_pin.pin_hash = extensions.crypt(p_candidate, v_pin.pin_hash) then
    update family.profile_pins set failed_attempts = 0, locked_until = null
     where profile_id = p_profile;
    return query select true, 'ok'; return;
  end if;

  -- An expired lock starts a fresh count; otherwise the first wrong guess after
  -- the cooling-off period would re-lock immediately (verified against the draft).
  v_attempts := case when v_pin.locked_until is not null then 1 else v_pin.failed_attempts + 1 end;
  update family.profile_pins
     set failed_attempts = v_attempts,
         locked_until    = case when v_attempts >= 5 then now() + interval '15 minutes' end
   where profile_id = p_profile;
  return query select false, 'bad_pin';
end;
$$;

-- Makes a profile non-selectable again (has_pin flips via the trigger).
create or replace function family.clear_pin(p_user_id uuid, p_profile uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_household uuid;
begin
  if p_user_id is null then raise exception 'caller required' using errcode = '42501'; end if;

  select household_id into v_household
    from family.categories where id = p_profile and is_profile;
  if v_household is null then raise exception 'no such profile' using errcode = 'P0002'; end if;

  if not exists (select 1 from family.household_users
                  where household_id = v_household and user_id = p_user_id)
  then raise exception 'not a member' using errcode = '42501'; end if;

  delete from family.profile_pins where profile_id = p_profile;
end;
$$;

revoke all on function family.set_pin(uuid, uuid, text),
                       family.verify_pin(uuid, uuid, text),
                       family.clear_pin(uuid, uuid) from public, anon, authenticated;
grant execute on function family.set_pin(uuid, uuid, text),
                          family.verify_pin(uuid, uuid, text),
                          family.clear_pin(uuid, uuid) to service_role;
```

**Design notes**

- **The hash never leaves `profile_pins`.** No API role — not even `service_role` — has `select` on the table. The original design put `pin_hash` on `categories`, where the table-level `grant select … to authenticated` covered it: any signed-in member could dump every bcrypt hash over REST and brute-force 10,000 PINs offline (verified). `categories.has_pin` is the only PIN fact the household can see, and it is exactly what US2 scenario 9 needs.
- **Membership is checked inside the function against `p_user_id`**, not `auth.uid()`. The action fills `p_user_id` from `requireMember()` — the verified session — so the database still refuses a non-member even though only the service role can execute these functions (defence in depth).
- **Who may call `set_pin`/`clear_pin` is decided by the action, not the function** (D5): `setProfilePin` is allowed with a *parent* actor or with *no* actor (FR-018, SC-010) and refused with a member actor; `clearProfilePin` requires a parent actor. The function only proves household membership because it cannot see the actor cookie.
- `verify_pin` returns a *reason* so the interface can distinguish "wrong PIN" from "locked" from "this profile has no PIN". It never reveals whether the profile exists to a non-member — that returns `forbidden`, the same as any other non-member request; the action maps both `forbidden` and `not_found` to `NOT_FOUND`.
- **Lockout**: 5 consecutive failures → 15 minutes. The row lock makes the counter race-free; an expired lock resets the count so the first wrong guess after cool-down does not re-lock for another 15 minutes (the draft did — verified).
- bcrypt cost 10 ≈ 53 ms per verify on the reference image — comfortably inside SC-003.

---

## 005 — Household settings

```sql
-- 005_settings.sql — per-household display preferences. Serves FR-031, FR-043; D14, D15.
create table if not exists family.household_settings (
  household_id       uuid primary key references family.households(id) on delete cascade,
  show_name_not_date boolean not null default true,      -- FR-031: households.name vs today's date
  time_format        text not null default '12h' check (time_format in ('12h','24h')),
  start_week_on      smallint not null default 0 check (start_week_on in (0,1)),
  punch_out_minutes  smallint not null default 3 check (punch_out_minutes between 1 and 60),
  text_size          text not null default 'medium' check (text_size in ('small','medium','large')),
  density            text not null default 'roomy' check (density in ('cozy','snug','roomy')),
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
```

Only the fields Phase 1 actually uses. **There is no `display_name`**: the top bar shows `households.name` when `show_name_not_date` is true, otherwise today's date. Two names for one thing was one too many (D15); `updateHouseholdSettings({ householdName, … })` writes `households.name` and this table in the same action. Calendar-specific settings (`dim_past_events`, `shade_weekends`, countdown visibility, schedule-day count) arrive with Phase 2 as an `alter table`, so no unused columns ship early.

---

## 006 — Avatar storage

```sql
-- 006_storage.sql — private avatar bucket + a defensive read policy. Serves FR-022 (R7, D16).
-- Text comparison, never a cast: a non-uuid prefix (or an object in another
-- bucket evaluated first — Postgres does not promise AND short-circuit order)
-- can never raise from inside the policy.
create or replace function family.can_read_avatar(object_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from family.household_users
     where user_id is not null
       and user_id = (select auth.uid())
       and household_id::text = split_part(object_name, '/', 1)
  );
$$;
revoke all on function family.can_read_avatar(text) from public;
grant execute on function family.can_read_avatar(text) to authenticated;

-- On the hosted platform everything under `storage` is owned by
-- supabase_storage_admin, and migrations have been failing on `create policy`
-- for storage.objects since mid-2025. Both statements are therefore guarded:
-- if they cannot run here, they NOTICE and the operator does it in the Dashboard.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('family-avatars', 'family-avatars', false, 5242880,
          array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
exception when insufficient_privilege or undefined_table then
  raise notice 'family-avatars bucket not created here (%). Create it in Dashboard → Storage: private, 5 MB, jpeg/png/webp.', sqlerrm;
end $$;

do $$
begin
  drop policy if exists "members read avatars" on storage.objects;
  create policy "members read avatars" on storage.objects
    for select to authenticated
    using (bucket_id = 'family-avatars' and family.can_read_avatar(name));
exception when insufficient_privilege or undefined_table then
  raise notice 'avatar read policy not created here (%). The app does not depend on it.', sqlerrm;
end $$;
```

Private bucket, 5 MB cap, three image types, enforced by the storage layer as well as by the server action. Path convention `<household_id>/<profile_id>.<ext>`.

**The app never depends on the storage policy.** Reads use server-minted signed URLs (`signAvatarUrls`, admin client, 1 h TTL, cached client-side for ~50 min), so if the hosted platform refuses the policy nothing breaks. Writes and deletes go through server actions with the service role, so no insert/delete policy exists at all.

---

## 007 — Seed

```sql
-- 007_seed.sql — the single household and its settings row. Contains no
-- personal data: no emails, no names, no PINs. People come from `npm run family:seed`.
insert into family.households (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Our Family')
on conflict (id) do nothing;

insert into family.household_settings (household_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (household_id) do nothing;
```

A migration is committed and replayed by every `supabase db reset`, so it must not carry the parents' addresses or the children's names (constitution §VII). The deterministic household id lets the seed script and the policy suite reference it. Allowlist rows and profiles are created by `scripts/family-seed.mjs`, which allowlists the household account from `FAMILY_ACCOUNT_EMAIL` (and optionally seeds profiles from `FAMILY_SEED_PROFILES`); with `--local` it also creates the dev account and fixture profiles. PINs are **never** seeded — they are set from the interface, exercising the FR-018 path on day one.

---

## 008 — Auth hook (Before User Created)

```sql
-- 008_auth_hook.sql — refuses account CREATION for any email not on the allowlist,
-- at Supabase Auth, before an auth.users row exists. Serves FR-004 (D18).
-- Enabling it is an operator step: Dashboard → Authentication → Hooks → Before User Created.
create or replace function family.hook_restrict_signup(event jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare v_email text := lower(btrim(event -> 'user' ->> 'email'));
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
grant usage  on schema family to supabase_auth_admin;
grant select on family.household_users to supabase_auth_admin;
grant execute on function family.hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke execute on function family.hook_restrict_signup(jsonb) from public, anon, authenticated;
```

"No public sign-up path" was only true of the *interface* before this. Supabase Auth is a public endpoint: the email provider would accept `signUp` from anyone, and a Google flow driven directly at `/auth/v1/authorize` mints an `auth.users` row and a valid `authenticated` session for any Google account even though the app signs it out afterwards. With the hook on (plus Email provider **off** and anonymous sign-ins **off** — operator steps) no `auth.users` row is ever created for a non-member, so the "authenticated non-member" attacker class collapses to the household itself. The hook is deliberately not `SECURITY DEFINER`; `supabase_auth_admin` gets `usage` + `select` on the one table instead. Locally, email+password stays on for the dev sign-in form.

---

## 009 — Realtime

```sql
-- 009_realtime.sql — live updates for the three read tables (R11, D17), then a
-- PostgREST schema reload so new RPCs are visible without a restart.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'publication supabase_realtime not found; live updates stay off until it exists';
    return;
  end if;
  foreach t in array array['categories', 'household_settings', 'households'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'family' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table family.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
```

A custom schema is not in the publication by default; without this line no subscription ever fires. Replica identity stays at the default (primary key only) because Realtime does **not** apply RLS to `DELETE` payloads — with `replica identity full` a whole deleted row would be broadcast unfiltered. The provider subscribes one channel, filtered by `household_id` (`id` for `households`), and treats every payload as an invalidation signal only; `profile_pins` is not published, so no PIN data can ever appear in a payload.

---

## Privilege matrix

What the policy suite asserts with `has_schema_privilege`, `has_table_privilege` and `has_function_privilege`. Any new `t` for `anon` is a test failure.

| Object | `anon` | `authenticated` | `service_role` | `supabase_auth_admin` |
|---|---|---|---|---|
| schema `family` (USAGE) | — | ✓ | ✓ | ✓ |
| `households`, `household_users`, `categories`, `household_settings` | — | SELECT | ALL | `household_users`: SELECT |
| `profile_pins` | — | — | — | — |
| `is_member(uuid)`, `my_household()` | — | EXECUTE | EXECUTE | — |
| `claim_membership()`, `can_read_avatar(text)` | — | EXECUTE | — | — |
| `set_pin`, `verify_pin`, `clear_pin` | — | — | EXECUTE | — |
| `hook_restrict_signup(jsonb)` | — | — | — | EXECUTE |
| `touch_updated_at`, `sync_has_pin`, `guard_last_parent`, `assert_profile_account_is_member` | — | — | — | — |

Reads by `authenticated` are further narrowed by RLS to the caller's household; an authenticated non-member gets `[]`, an anonymous request gets `42501`.

---

## State transitions

**Actor session** (not persisted — signed cookie, R3, D11):

```
  none ──(correct PIN)──► punched in as <profile>
    ▲                            │
    │                            ├──(idle N minutes — no interaction on this device)──┐
    │                            ├──(punch out)────────────────────────────────────────┤
    │                            ├──(profile deleted, demoted, or moved — DB re-read)──┤
    └────────────────────────────┴──(different account signs in on this device)────────┘
```

**PIN lockout**:

```
  unlocked ──(5th consecutive failure)──► locked (15 min) ──(expiry)──► unlocked, count reset
      ▲                                                                    │
      └──────────────────────(any success resets counter)──────────────────┘
```

**Membership**:

```
  allowlisted (email only) ──(first confirmed sign-in: claim_membership)──► claimed (user_id bound)
```

---

## Amendments after adversarial review (2026-08-31)

Each change below was made after an adversarial security/product pass over the original model. Where the finding was reproduced by execution it says so — those runs were against a Postgres 17 Supabase image (`supabase/postgres:17.6.x`), not the live project.

| Decision | Change | Why |
|---|---|---|
| D1 | `household_users` is email-keyed until claimed (`id` PK, `email unique` normalised, `user_id null unique`, `claimed_at`); new `claim_membership()` | The original `user_id NOT NULL` + FK made seeding by email impossible — verified against a Postgres 17 Supabase image |
| D2 | `grant usage … to service_role`, default privileges on tables/sequences, explicit `execute` on the PIN functions; `anon` gets nothing | `BYPASSRLS` does not bypass GRANTs — every server action failed with `permission denied for schema family`; verified against a Postgres 17 Supabase image |
| D3 | `set_pin`/`verify_pin`/`clear_pin` take `p_user_id` and check `household_users` themselves | `auth.uid()` is NULL under `service_role`, so the old `is_member()` check could never pass — verified against a Postgres 17 Supabase image |
| D4 | PIN state moved to `profile_pins` with no client grants and `service_role` revoked; `categories.has_pin` maintained by trigger | The table-level `select` grant on `categories` exposed every bcrypt hash to every member — verified against a Postgres 17 Supabase image |
| — | Every function is `revoke … from public` immediately after creation | PostgreSQL grants `EXECUTE` to `public` by default; the per-schema default-privilege revoke had no effect — verified against a Postgres 17 Supabase image |
| — | `search_path = ''` + schema-qualified names in every `SECURITY DEFINER` function | Supabase's own guidance; the draft used `family, public` |
| D6 | `guard_last_parent()` constraint trigger with a per-household row lock; covers demotion | Demotion was unguarded and two concurrent deletes both passed an application-level count — verified against a Postgres 17 Supabase image |
| — | `assert_profile_account_is_member()` trigger; `unique (user_id)` on `household_users`; `my_household()` drops `limit 1` | A profile could point at a stranger's account; a multi-household account got an arbitrary household |
| — | `verify_pin` takes a row lock and resets the counter after an expired lock | The first wrong guess after cool-down re-locked for another 15 minutes — verified against a Postgres 17 Supabase image |
| D14 | `created_by` / `updated_by` on `households`, `categories`, `household_settings` | FR-016 (record the acting profile) had no column |
| D15 | `household_settings.display_name` dropped; `households.name` is the one name | Two names for one thing, and nothing wrote the second |
| — | `households` gets its missing `touch` trigger | `updated_at` never updated |
| D16 | Bucket + read policy wrapped in guarded `DO` blocks; `can_read_avatar(text)` compares as text; reads use server-minted signed URLs | `(storage.foldername(name))[1]::uuid` raised on any non-uuid prefix (verified); hosted `storage` objects are owned by `supabase_storage_admin`, so `create policy` from a migration may fail |
| D7 | `007_seed.sql` is the household + settings row only; people come from `scripts/family-seed.mjs` | A committed migration must not carry the parents' emails or the children's names (constitution §VII) |
| D18 | `008_auth_hook.sql` — Before User Created hook + operator steps (Email off, anonymous off) | FR-004 was not true at the Auth API: `signUp` and a direct Google flow both minted `authenticated` sessions for strangers |
| D17 | `009_realtime.sql` — guarded publication for the three read tables; default replica identity; ends with `notify pgrst, 'reload schema'` | A custom schema is not published by default; `DELETE` payloads bypass RLS |
| D27 | Anonymous probe expectation is HTTP 401 / SQLSTATE `42501`, not `[]` | `anon` has no `usage` on the schema — verified against a Postgres 17 Supabase image; the old quickstart mis-diagnosed its own check |
| D19 | Nine migration files, each idempotent where cheap; push is an operator step | — |

### Second pass, after the branch was built (2026-09-01)

A further adversarial review ran against the finished implementation. It found one
schema defect, verified against the live local database:

| Change | Why |
|---|---|
| `hook_restrict_signup` is `SECURITY DEFINER` | It was `SECURITY INVOKER`. GoTrue calls the hook as `supabase_auth_admin`, and `household_users` has RLS enabled with a policy for `authenticated` only — so the allowlist lookup returned **zero rows whatever the table held**, and the hook would have refused **every** sign-up, the allowlisted parents included, the moment the operator enabled it. Verified on the running local stack: `relrowsecurity` true, policy roles `{authenticated}`, `prosecdef` false. `lib/family/__tests__/policies/auth-hook.test.ts` now pins the behaviour, including that the function is SECURITY DEFINER — that property is what makes it work at all, so it is asserted rather than assumed. |

Two shapes worth knowing about, left as they are because fixing either is a design
change rather than a defect fix:

- **`updateHouseholdSettings` is not atomic.** It writes `households.name` and then
  `household_settings` in two round-trips. Validation precedes both, so a rejected patch
  writes neither, but a failure *between* the statements would leave the name changed and
  the preferences not.
- **`reorderCategories` fires N independent updates** through `Promise.all` and reports
  only the first error, so a partial failure leaves a partially reordered list. The order
  is recomputed from scratch on the next successful reorder, so it is self-healing rather
  than corrupting.

Both would need a transaction or an RPC. Neither is reachable from the interface today
without a database failure mid-request.

---

## What Phases 2–5 add

Recorded so nothing here needs reshaping later: `events` + `event_categories` + `event_exceptions` (Phase 2); `tasks` + `task_completions` (Phase 3); `rewards` + `point_ledger` (Phase 3); `lists` + `list_items` (Phase 4); `meal_categories` + `meal_recipes` + `meal_sittings` (Phase 4); `push_subscriptions` + `reminders` (Phase 5). Every one carries `household_id`, reuses `is_member()` for its read policy, gets `grant all … to service_role` by default privilege, and follows the same `revoke from public` discipline for any function.
