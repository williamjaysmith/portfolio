-- 032_meals.sql — planned meals, their exceptions, and the series split
-- (006 FR-622–FR-630; R601–R603).
--
-- A meal is a slot (date × mealtime), one recipe, an optional note and an
-- optional rule. Occurrences are computed by the calendar's rule walk, never
-- stored (R602). A repeating meal's divergent occurrences are one row each in
-- meal_exceptions — a skip (a 'this' delete) or an override of the three
-- fields a 'this' edit may change: date, mealtime, note (FR-629, FR-630) —
-- keyed by the occurrence's ORIGINAL date, exactly as 012 keys an event's.
-- 'This and future' is 015's shape for meals: one transaction that truncates
-- the head, inserts the tail and re-homes the exceptions (R603).

create table if not exists family.meals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references family.households(id) on delete cascade,
  date          date not null,
  category_id   uuid not null,
  recipe_id     uuid not null,
  note          text check (note is null or length(trim(note)) between 1 and 200),
  -- The calendar's closed grammar (023), with a date-form UNTIL only: a meal
  -- has no clock time, so an instant UNTIL has nothing to mean here.
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
  -- FR-616's second choice: the recipe goes and every meal planned with it goes too.
  constraint meals_recipe_fk foreign key (recipe_id, household_id)
    references family.recipes (id, household_id) on delete cascade
);

create index if not exists meals_household_date_idx
  on family.meals (household_id, date) where rrule is null;
create index if not exists meals_household_series_idx
  on family.meals (household_id) where rrule is not null;

drop trigger if exists touch on family.meals;
create trigger touch before update on family.meals
  for each row execute function family.touch_updated_at();

create table if not exists family.meal_exceptions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references family.households(id) on delete cascade,
  meal_id         uuid not null,
  -- THE key: the occurrence's original household-local date (R602).
  occurrence_date date not null,
  action          text not null check (action in ('skip','override')),
  -- Override payload — null = inherit from the series; '' clears the note.
  date            date,
  category_id     uuid,
  note            text check (note is null or length(note) <= 200),
  created_by      uuid references family.categories(id) on delete set null,
  updated_by      uuid references family.categories(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint meal_exceptions_occurrence_key unique (meal_id, occurrence_date),
  -- No occurrence outlives its meal.
  constraint meal_exceptions_meal_fk foreign key (meal_id, household_id)
    references family.meals (id, household_id) on delete cascade,
  constraint meal_exceptions_category_fk foreign key (category_id, household_id)
    references family.meal_categories (id, household_id) on delete restrict,
  -- A skip carries nothing; an override carries at least one field.
  constraint meal_exception_payload_shape check (
    case when action = 'skip'
      then num_nonnulls(date, category_id, note) = 0
      else num_nonnulls(date, category_id, note) > 0
    end
  )
);

drop trigger if exists touch on family.meal_exceptions;
create trigger touch before update on family.meal_exceptions
  for each row execute function family.touch_updated_at();

-- 'This and future meals' (FR-629): the head's rule is re-emitted to end the
-- day before the cut, the tail starts on the cut with the patch applied, and
-- every exception on or after the cut moves to the tail — one transaction, so
-- a truncated head can never exist without its tail (015's reason).
create or replace function family.split_meal_series(
  p_household_id  uuid,
  p_meal_id       uuid,      -- the head (the series being split)
  p_actor         uuid,      -- the punched-in profile, for attribution; may be null
  p_head_rrule    text,      -- head's re-emitted rule: UNTIL = cut − 1 day
  p_cut           date,      -- the chosen occurrence's original date
  p_tail_meal     jsonb      -- date, category_id, recipe_id, note, rrule of the tail
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tail_id uuid;
begin
  -- Lock the head so a concurrent scope-write on the same series serialises here.
  perform 1 from family.meals
    where id = p_meal_id and household_id = p_household_id
    for update;
  if not found then
    raise exception 'meal not found' using errcode = 'P0002';
  end if;

  update family.meals
     set rrule = p_head_rrule, updated_by = p_actor
   where id = p_meal_id and household_id = p_household_id;

  insert into family.meals (household_id, date, category_id, recipe_id, note, rrule, created_by, updated_by)
  values (
    p_household_id,
    (p_tail_meal->>'date')::date,
    (p_tail_meal->>'category_id')::uuid,
    (p_tail_meal->>'recipe_id')::uuid,
    nullif(p_tail_meal->>'note', ''),
    nullif(p_tail_meal->>'rrule', ''),
    p_actor,
    p_actor
  )
  returning id into v_tail_id;

  update family.meal_exceptions
     set meal_id = v_tail_id
   where meal_id = p_meal_id
     and household_id = p_household_id
     and occurrence_date >= p_cut;

  return v_tail_id;
end $$;
revoke all on function family.split_meal_series(uuid, uuid, uuid, text, date, jsonb)
  from public, anon, authenticated;
grant execute on function family.split_meal_series(uuid, uuid, uuid, text, date, jsonb)
  to service_role;

alter table family.meals enable row level security;
alter table family.meal_exceptions enable row level security;
drop policy if exists "members read meals" on family.meals;
create policy "members read meals" on family.meals
  for select to authenticated using (family.is_member(household_id));
drop policy if exists "members read meal exceptions" on family.meal_exceptions;
create policy "members read meal exceptions" on family.meal_exceptions
  for select to authenticated using (family.is_member(household_id));

grant select on family.meals, family.meal_exceptions to authenticated;
grant all on family.meals, family.meal_exceptions to service_role;

notify pgrst, 'reload schema';
