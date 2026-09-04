-- ---------------------------------------------------------------------------
-- 016 — deleting a Profile must not fail because it authored an event.
--
-- Serves: 002 FR-274 (an event survives the deletion of a category it carries),
--         002 SC-214 (deleting a profile never destroys the family's history).
--
-- 011 tightened family.events.created_by / updated_by to the composite
-- (id, household_id) key so attribution could not name a profile from another
-- household. It wrote `on delete set null` with no column list, and for a
-- MULTI-column foreign key that means "null every referencing column" — so
-- deleting the author tried to null events.household_id too, which is not null:
--
--     23502: null value in column "household_id" of relation "events"
--
-- The result was that a Profile who had ever created an event could not be
-- deleted at all. Postgres 15's column-list form nulls only the attribution
-- and leaves the tenancy column alone, which is what 011 meant.
--
-- Contains no personal data.
-- ---------------------------------------------------------------------------
do $$
begin
  alter table family.events
    drop constraint if exists events_created_by_fk,
    drop constraint if exists events_updated_by_fk,
    add constraint events_created_by_fk
      foreign key (created_by, household_id)
      references family.categories (id, household_id) on delete set null (created_by),
    add constraint events_updated_by_fk
      foreign key (updated_by, household_id)
      references family.categories (id, household_id) on delete set null (updated_by);
end $$;
