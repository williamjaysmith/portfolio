-- 031_recipes.sql — the household's recipes (006 FR-613–FR-617; R601).
--
-- A recipe is a name, ONE mealtime and ONE free text holding ingredients and
-- instructions together — the reference's own shape, kept honest (spec
-- Assumption 7). Planned meals REFERENCE a recipe; nothing copies it.
-- "Just the recipe" (FR-616's first choice) sets removed_at: the row leaves the
-- pane and the picker, cannot be planned again, and stays readable for the
-- meals that point at it. "This recipe and planned meals" is a row delete that
-- cascades through 032's composite FK.

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
  -- A recipe's mealtime is its own household's; a mealtime is never deleted,
  -- and restrict says so at the database too.
  constraint recipes_category_fk foreign key (category_id, household_id)
    references family.meal_categories (id, household_id) on delete restrict
);

create index if not exists recipes_household_idx on family.recipes (household_id, removed_at);

drop trigger if exists touch on family.recipes;
create trigger touch before update on family.recipes
  for each row execute function family.touch_updated_at();

alter table family.recipes enable row level security;
drop policy if exists "members read recipes" on family.recipes;
create policy "members read recipes" on family.recipes
  for select to authenticated using (family.is_member(household_id));

grant select on family.recipes to authenticated;
grant all on family.recipes to service_role;

notify pgrst, 'reload schema';
