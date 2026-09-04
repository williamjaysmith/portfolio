-- 020_task_cursors.sql — the tail of every Completed Date chain, published to the
-- browser-direct read. The row that decides what is due today may be arbitrarily
-- old — a chore on "after 6 months" was last resolved outside every window the
-- board fetches — and PostgREST cannot express a per-group LIMIT, so the
-- anti-join lives here. The schema's first view.
-- Serves: FR-343 (the derived open occurrence), FR-362 (a skip advances the
-- cycle), FR-366, FR-390 (the view inherits is_member()), R309.
-- Requires PostgreSQL 15+: `security_invoker` views are a PG 15 feature.
-- Contains no personal data.

create or replace view family.task_cursors with (security_invoker = true) as
  select distinct on (r.household_id, r.task_id, r.assignee_id)
         r.household_id,
         r.task_id,
         r.assignee_id,
         r.id          as tail_id,
         r.resolved_on as tail_resolved_on
    from family.task_resolutions r
    join family.tasks t
      on t.id = r.task_id and t.household_id = r.household_id
   where t.renew_after_amount is not null                       -- cursor mode only
     and not exists (select 1 from family.task_resolutions n where n.cycle_prev = r.id)
   order by r.household_id, r.task_id, r.assignee_id,
            r.resolved_on desc, r.created_at desc;

-- security_invoker means the underlying tables' RLS applies to the CALLER, so the
-- view needs no policy of its own and inherits is_member() (FR-390). Without it a
-- view is read with its owner's privileges and would leak every household.
grant select on family.task_cursors to authenticated, service_role;

-- Make the new view visible to PostgREST without a restart.
notify pgrst, 'reload schema';
