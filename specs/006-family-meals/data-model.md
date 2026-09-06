# Data Model: Family Meals (Phase 1)

**Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md) · **Date**: 2026-09-06

Four tables, two functions, two publication entries, no alteration to a shipped table. Every table
is tenant-scoped by `household_id`, readable by members under RLS, writable only by the service
role through an action.

## Entity overview

```text
households 1 ──< meal_categories   (exactly four per household; seeded once; never deleted)
households 1 ──< recipes           (name, one category, one text, removed_at)
households 1 ──< meals             (date, category, recipe, note, rrule)
meals      1 ──< meal_exceptions   (skip | override of date/category/note, keyed by occurrence_date)
recipes    1 ──< meals             (composite FK; on delete cascade — "this recipe and planned meals")
meal_categories 1 ──< recipes, meals, meal_exceptions   (composite FK; on delete restrict — never deleted anyway)
```

A **slot** (date × category) and an **occurrence** (a meal's date under its rule and exceptions)
are computed, never stored.

## Migrations

| # | File | Adds |
|---|---|---|
| 030 | `030_meal_categories.sql` | `family.meal_categories`, `seed_default_meal_categories(uuid)`, RLS, grants |
| 031 | `031_recipes.sql` | `family.recipes`, RLS, grants |
| 032 | `032_meals.sql` | `family.meals`, `family.meal_exceptions`, `split_meal_series(...)`, RLS, grants |
| 033 | `033_realtime_meals.sql` | the four tables in `supabase_realtime`, guarded as 027/029 |

## 030 — Mealtime categories

```sql
-- 030_meal_categories.sql — the household's four mealtimes (006 FR-608–FR-612).
-- Exactly four: seeded once by emptiness, no create/delete action exists (R604).
create table if not exists family.meal_categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 40),
  color         family.palette_color not null,
  position      integer not null,
  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint meal_categories_tenant unique (id, household_id),
  constraint meal_categories_position_key unique (household_id, position)
);
-- FR-610: names unique within the household, compared trimmed and case-insensitively.
create unique index if not exists meal_categories_name_key
  on family.meal_categories (household_id, lower(trim(name)));

drop trigger if exists touch on family.meal_categories;
create trigger touch before update on family.meal_categories
  for each row execute function family.touch_updated_at();

-- FR-608: the reference's four, the live API's colours and order, once per household.
create or replace function family.seed_default_meal_categories(p_household_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if exists (select 1 from family.meal_categories where household_id = p_household_id) then
    return 0;
  end if;
  insert into family.meal_categories (household_id, name, color, position)
  values (p_household_id, 'Breakfast', '#A8D4D3', 1),
         (p_household_id, 'Lunch',     '#F66951', 2),
         (p_household_id, 'Dinner',    '#915EA1', 3),
         (p_household_id, 'Snack',     '#FDC36D', 4);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function family.seed_default_meal_categories(uuid) from public, anon, authenticated;
grant execute on function family.seed_default_meal_categories(uuid) to service_role;

alter table family.meal_categories enable row level security;
drop policy if exists "members read meal categories" on family.meal_categories;
create policy "members read meal categories" on family.meal_categories
  for select to authenticated using (family.is_member(household_id));
grant select on family.meal_categories to authenticated;
grant all on family.meal_categories to service_role;
notify pgrst, 'reload schema';
```

The four palette colours are members of the shipped `family.palette_color` domain (Cyan, Coral,
Plum, Orange — all in the 20-colour palette).

## 031 — Recipes

```sql
-- 031_recipes.sql — the household's recipes (006 FR-613–FR-617). A recipe is a name, one
-- mealtime, one free text; "Just the recipe" sets removed_at (R601).
create table if not exists family.recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 120),
  category_id   uuid not null,
  text          text not null default '' check (length(text) <= 10000),
  removed_at    timestamptz,
  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint recipes_tenant unique (id, household_id),
  constraint recipes_category_fk foreign key (category_id, household_id)
    references family.meal_categories (id, household_id) on delete restrict
);
create index if not exists recipes_household_idx on family.recipes (household_id, removed_at);
-- touch trigger, RLS "members read recipes", grants — as 030.
```

## 032 — Meals, exceptions, the split

```sql
-- 032_meals.sql — planned meals (006 FR-622–FR-630). A meal is a slot (date × mealtime), one
-- recipe, an optional note, and an optional rule; occurrences are computed (R602).
create table if not exists family.meals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  date          date not null,
  category_id   uuid not null,
  recipe_id     uuid not null,
  note          text check (note is null or length(trim(note)) between 1 and 200),
  -- The calendar's closed grammar (023), date-form UNTIL only: a meal has no clock time.
  rrule         text check (
    rrule is null or (
      rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY);INTERVAL=([1-9]|[1-9][0-9])(;|$)'
      and rrule !~ '(^|;)COUNT='
      and rrule !~ 'UNTIL=[0-9]{8}T'
    )
  ),
  created_by    uuid references family.categories(id) on delete set null,
  updated_by    uuid references family.categories(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint meals_tenant unique (id, household_id),
  constraint meals_category_fk foreign key (category_id, household_id)
    references family.meal_categories (id, household_id) on delete restrict,
  -- FR-616's second choice: the recipe goes and its meals go with it.
  constraint meals_recipe_fk foreign key (recipe_id, household_id)
    references family.recipes (id, household_id) on delete cascade
);
create index if not exists meals_household_date_idx on family.meals (household_id, date) where rrule is null;
create index if not exists meals_household_series_idx on family.meals (household_id) where rrule is not null;

-- One row per occurrence that diverges from its series: a skip (a 'this' delete) or an
-- override of the three fields a 'this' edit may change (FR-629, FR-630).
create table if not exists family.meal_exceptions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references family.households(id) on delete cascade,
  meal_id         uuid not null,
  occurrence_date date not null,            -- THE key: the occurrence's original date
  action          text not null check (action in ('skip','override')),
  date            date,                     -- override: the occurrence drawn on another day
  category_id     uuid,                     -- override: another mealtime
  note            text check (note is null or length(note) <= 200),   -- '' clears the series' note
  created_by      uuid references family.categories(id) on delete set null,
  updated_by      uuid references family.categories(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint meal_exceptions_occurrence_key unique (meal_id, occurrence_date),
  constraint meal_exceptions_meal_fk foreign key (meal_id, household_id)
    references family.meals (id, household_id) on delete cascade,
  constraint meal_exceptions_category_fk foreign key (category_id, household_id)
    references family.meal_categories (id, household_id) on delete restrict,
  constraint meal_exception_payload_shape check (
    case when action = 'skip' then num_nonnulls(date, category_id, note) = 0
         else num_nonnulls(date, category_id, note) > 0 end
  )
);

-- 015's shape for meals: truncate the head, insert the tail, re-home the exceptions, atomically.
create or replace function family.split_meal_series(
  p_household_id uuid, p_meal_id uuid, p_actor uuid,
  p_head_rrule text, p_cut date, p_tail_meal jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tail_id uuid;
begin
  perform 1 from family.meals where id = p_meal_id and household_id = p_household_id for update;
  if not found then raise exception 'meal not found' using errcode = 'P0002'; end if;
  update family.meals set rrule = p_head_rrule, updated_by = p_actor
    where id = p_meal_id and household_id = p_household_id;
  insert into family.meals (household_id, date, category_id, recipe_id, note, rrule, created_by, updated_by)
  values (p_household_id, (p_tail_meal->>'date')::date, (p_tail_meal->>'category_id')::uuid,
          (p_tail_meal->>'recipe_id')::uuid, nullif(p_tail_meal->>'note', ''),
          nullif(p_tail_meal->>'rrule', ''), p_actor, p_actor)
  returning id into v_tail_id;
  update family.meal_exceptions set meal_id = v_tail_id
    where meal_id = p_meal_id and household_id = p_household_id and occurrence_date >= p_cut;
  return v_tail_id;
end $$;
revoke all on function family.split_meal_series(uuid, uuid, uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function family.split_meal_series(uuid, uuid, uuid, text, date, jsonb) to service_role;
-- touch triggers, RLS "members read meals" / "members read meal exceptions", grants — as 030.
notify pgrst, 'reload schema';
```

## 033 — Realtime

027's guard block over `['meal_categories','recipes','meals','meal_exceptions']`: each added to
`supabase_realtime` only if not already present; replica identity left DEFAULT (a DELETE payload
carries a key, never a recipe's name or text).

## How the tab is read

Three reads, all unwindowed, each seeded from the page (R605):

- `meal_categories` ordered by `position` → `MealCategory[]`
- `recipes` ordered by `name` → `Recipe[]` (the pane and the picker filter `removedAt === null`)
- `meals` with `meal_exceptions(...)` embedded, ordered by `date` → `Meal[]`

The calendar page adds the `meals` and `meal_categories` reads for its tokens. `expandMeals(meals,
range, zone)` produces the occurrences the grid, the popover and the calendar draw.

## Invariants

| Invariant | Where it holds |
|---|---|
| A household has exactly four mealtimes | The seed inserts four by emptiness; no create/delete action; `on delete restrict` from every referrer |
| A mealtime's name is unique in its household, trimmed and case-insensitive | `meal_categories_name_key`; the action maps the violation to a field error |
| A recipe belongs to one mealtime of its own household | Composite FK `(category_id, household_id)` |
| A meal's recipe is its household's | Composite FK `(recipe_id, household_id)` |
| A removed recipe stays readable for its meals and is never planned again | `removed_at`; `planMeal` refuses a removed recipe; the pane and picker filter it |
| "This recipe and planned meals" leaves no meal behind | `meals_recipe_fk … on delete cascade`, then `meal_exceptions … on delete cascade` |
| One exception per occurrence | `meal_exceptions_occurrence_key` |
| A skip carries nothing; an override carries something | `meal_exception_payload_shape` |
| A meal's rule is the calendar's grammar with a date UNTIL | The `rrule` CHECK; `mealRuleOf` emits only that form |
| A truncated head never exists without its tail | `split_meal_series` is one transaction |
| Every row records its actor, and survives the actor's deletion | `created_by`/`updated_by … on delete set null` |

## What the database enforces, and what the action does

The database enforces tenancy, bounds, uniqueness, the exception shapes and the cascades. The
action enforces: the punch-in (`requireVerifiedActor`); the parent gate on `updateMealCategory`;
the scope discipline (a one-time meal takes no scope; a repeating one requires it; a recipe change
refuses `this`); that a planned recipe is not removed; that an `occurrenceDate` is an occurrence the
expander produces; the line truncation for `addListItems`.

## Privilege matrix (delta)

| Object | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `meal_categories`, `recipes`, `meals`, `meal_exceptions` | — | SELECT (RLS `is_member`) | ALL |
| `seed_default_meal_categories(uuid)` | — | — | EXECUTE |
| `split_meal_series(uuid, uuid, uuid, text, date, jsonb)` | — | — | EXECUTE |

`privileges.test.ts` extends its table with these six rows.

## Dashboard / config steps

None beyond the push. The publication is added by 033; the seed function is called by
`npm run family:seed -- --yes` on the hosted household (quickstart §4).

## What later phases add here

Nothing is reserved (FR-649). A reminder on a meal, a "cooked" mark, a home-screen pane would each
be a new column or table in their own phase.
