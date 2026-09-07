-- 038_split_carries_the_reminder.sql — a `this_and_future` split must not lose
-- the event's reminder (008 FR-808, FR-810).
--
-- 015's `split_event_series` names its tail's columns explicitly, and 035 added
-- three it does not name. So every split silently dropped the tail's reminder
-- back to the column default `inherit` — losing both an explicit change at that
-- scope AND the head's own carried-over setting. An event reminding two hours
-- ahead, edited from "this and future events", quietly went back to the
-- household's ten minutes from the cut onwards.
--
-- Found by the scope test rather than by reading the code, which is the whole
-- argument for writing that test against a real database.
--
-- The rest of the function is 015 verbatim. Only the tail's column list, its
-- select list and its `jsonb_to_record` shape change; there is no data to
-- migrate, because the columns were being defaulted rather than corrupted.
--
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
  --
  -- `reminder_mode` coalesces to 'inherit' so a caller that says nothing gets
  -- the column's own default rather than a null, which its NOT NULL would
  -- refuse. The two payload columns stay null unless the mode is 'custom',
  -- which `events_reminder_payload` then checks.
  insert into family.events
    (household_id, summary, description, location, all_day,
     starts_at, ends_at, start_date, end_date, timezone, rrule,
     countdown_enabled, reminder_mode, reminder_at_time, reminder_before_minutes,
     created_by, updated_by)
  select p_household_id, t.summary, t.description, t.location, t.all_day,
         t.starts_at, t.ends_at, t.start_date, t.end_date, t.timezone, t.rrule,
         coalesce(t.countdown_enabled, false),
         coalesce(t.reminder_mode, 'inherit'), t.reminder_at_time, t.reminder_before_minutes,
         p_actor, p_actor
    from jsonb_to_record(p_tail_event) as t(
      summary text, description text, location text, all_day boolean,
      starts_at timestamptz, ends_at timestamptz, start_date date, end_date date,
      timezone text, rrule text, countdown_enabled boolean,
      reminder_mode text, reminder_at_time boolean, reminder_before_minutes integer)
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
   where household_id = p_household_id
     and event_id = p_event_id
     and occurrence_date >= p_cut;

  return v_tail_id;
end;
$$;

revoke all on function family.split_event_series(uuid, uuid, uuid, text, date, jsonb, uuid[]) from public;

notify pgrst, 'reload schema';
