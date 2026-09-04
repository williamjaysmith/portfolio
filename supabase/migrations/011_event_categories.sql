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

-- ---------------------------------------------------------------------------
-- Attribution cannot point outside the household either.
--
-- 010 gave family.events.created_by / updated_by a bare reference to
-- family.categories(id), which proves the profile exists but not that it
-- belongs to the same household as the event. The application never lets one
-- diverge — attribution is taken from the verified punch-in cookie and never
-- from a payload — but a later service-role path or RPC could write a
-- mismatched pair and the database would accept it, where it rejects exactly
-- that shape for a category link above.
--
-- The composite key added at the top of this migration makes the tighter
-- reference possible, so the guarantee moves from convention into the schema.
-- Phase 1's own created_by columns keep the looser reference: their tables are
-- already deployed and out of this feature's scope.
-- ---------------------------------------------------------------------------
do $$
begin
  alter table family.events
    drop constraint if exists events_created_by_fkey,
    drop constraint if exists events_updated_by_fkey,
    add constraint events_created_by_fk
      foreign key (created_by, household_id)
      references family.categories (id, household_id) on delete set null,
    add constraint events_updated_by_fk
      foreign key (updated_by, household_id)
      references family.categories (id, household_id) on delete set null;
exception when duplicate_object then null;  -- already tightened
end $$;
