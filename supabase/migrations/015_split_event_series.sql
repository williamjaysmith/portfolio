-- 015_split_event_series.sql — atomic this_and_future split (FR-237/241/242).
-- The action computes everything (both rrule strings via the one grammar
-- emitter, the tail row, the tail's category set); this function only applies
-- the four statements in one transaction, so a half-completed split — a
-- truncated head with no tail — cannot exist. Service-role only; the action has
-- already verified the actor (requireActor) and validated the payload.
-- Contains no personal data.

create or replace function family.split_event_series(
  p_household_id      uuid,
  p_event_id          uuid,      -- the head (the series being split)
  p_actor             uuid,      -- the punched-in profile, for attribution; may be null
  p_head_rrule        text,      -- head's re-emitted rule: UNTIL = cut − 1 day
  p_cut               date,      -- household-local date of the chosen occurrence
  p_tail_event        jsonb,     -- content columns of the new tail series row
  p_tail_category_ids uuid[]     -- tail's category links, in draw order
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tail_id uuid;
begin
  -- Lock the head so a concurrent scope-write on the same series serialises here.
  perform 1 from family.events
    where id = p_event_id and household_id = p_household_id and rrule is not null
    for update;
  if not found then
    raise exception 'no such series in this household' using errcode = 'P0002';
  end if;

  -- 1. Truncate the head. Earlier occurrences and exceptions dated < p_cut stay.
  update family.events
     set rrule = p_head_rrule, updated_by = p_actor
   where id = p_event_id;

  -- 2. Insert the self-contained tail (edited fields already applied by the
  -- action). Every 010 constraint and the timezone trigger apply to it here.
  insert into family.events
    (household_id, summary, description, location, all_day,
     starts_at, ends_at, start_date, end_date, timezone, rrule,
     countdown_enabled, created_by, updated_by)
  select p_household_id, t.summary, t.description, t.location, t.all_day,
         t.starts_at, t.ends_at, t.start_date, t.end_date, t.timezone, t.rrule,
         coalesce(t.countdown_enabled, false), p_actor, p_actor
    from jsonb_to_record(p_tail_event) as t(
      summary text, description text, location text, all_day boolean,
      starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
      timezone text, rrule text, countdown_enabled boolean)
  returning id into v_tail_id;

  -- 3. The tail's category links, in draw order (FR-227). At this scope the
  -- categories may themselves be the edit (FR-287 allows this_and_future).
  insert into family.event_categories (household_id, event_id, category_id, position)
  select p_household_id, v_tail_id, u.cid, (u.ord - 1)::smallint
    from unnest(p_tail_category_ids) with ordinality as u(cid, ord);

  -- 4. Re-home the tail's exceptions. Keys are household-local dates, so they
  -- do not change (the whole point of the date key).
  update family.event_exceptions
     set event_id = v_tail_id
   where event_id = p_event_id and household_id = p_household_id
     and occurrence_date >= p_cut;

  return v_tail_id;
end;
$$;
revoke all on function family.split_event_series(uuid, uuid, uuid, text, date, jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function family.split_event_series(uuid, uuid, uuid, text, date, jsonb, uuid[])
  to service_role;

-- 014's reload fired before this function existed; reload again so PostgREST
-- can serve the RPC without a restart.
notify pgrst, 'reload schema';
