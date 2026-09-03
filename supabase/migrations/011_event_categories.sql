-- 011_event_categories.sql — the ordered event↔category join (Profiles and
-- Labels are one entity). Serves FR-211/212/227 (colours in draw order),
-- FR-273 (tenancy), FR-274 (events survive a category's deletion).
-- Contains no personal data.

-- Composite-FK target on categories. Additive: a superset of the PK, no data
-- rewrite. The one Phase 1 alteration this phase makes.
do $$
begin
  alter table family.categories
    add constraint categories_id_household_key unique (id, household_id);
exception when duplicate_table or duplicate_object then null;  -- already there
end $$;

create table if not exists family.event_categories (
  household_id  uuid not null references family.households(id) on delete cascade,
  event_id      uuid not null,
  category_id   uuid not null,
  -- FR-227: the order colours are drawn on the striped block. Plain 0-based
  -- position, not Phase 1's numeric fractional index: category changes are
  -- series-scope only (FR-287) and every save rewrites the link set wholesale,
  -- so there is no in-place reorder for fractional indexing to serve.
  position      smallint not null check (position >= 0),
  created_at    timestamptz not null default now(),

  primary key (event_id, category_id),

  -- Tenancy proved by the database, not the action: a cross-household link is
  -- unrepresentable, not merely unqueried.
  constraint event_categories_event_fk
    foreign key (event_id, household_id)
    references family.events (id, household_id) on delete cascade,
  constraint event_categories_category_fk
    foreign key (category_id, household_id)
    references family.categories (id, household_id) on delete cascade
);

-- Serves the FR-274 affected-event count, the filter sheet, and the cascade scan.
create index if not exists event_categories_category_idx
  on family.event_categories (household_id, category_id);

alter table family.event_categories enable row level security;
drop policy if exists "members read event categories" on family.event_categories;
create policy "members read event categories" on family.event_categories
  for select to authenticated using (family.is_member(household_id));
grant select on family.event_categories to authenticated;
grant all    on family.event_categories to service_role;
