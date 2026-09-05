-- 023_recurrence_interval.sql — bound INTERVAL on the shipped events rule column
-- (003 FR-345, Assumption 14, R305). family.tasks has carried the IDENTICAL
-- constraint text from birth (017). The parser (lib/family/recurrence/grammar.ts)
-- remains the contract; this is the backstop, exactly R201's posture. Contains
-- no personal data.
--
-- Written LAST in the phase, after the interval-1 equivalence sweep (T015), the
-- stored-corpus round-trip against an untouched schema (T016) and the two
-- read-only hosted pre-checks (T081): PG 17 on the hosted project, and zero
-- stored rules outside the widened grammar.
--
-- 010 declared the rule check inline and unnamed, so Postgres generated a name.
-- Drop it BY DEFINITION rather than by a guessed name: a `drop constraint if
-- exists events_rrule_check` that silently matches nothing would leave the old
-- constraint standing beside the new one for ever.
--
-- The drop and the add are ONE statement, deliberately. `supabase db push` runs
-- each migration file in a transaction, but every neighbouring operator step in
-- quickstart §4 is a Dashboard SQL-editor query, where two top-level statements
-- commit independently — and a committed DROP beside a failed ADD would leave
-- family.events.rrule with NO check at all, looser than what shipped, on the
-- live table, with nothing surfaced to the family. Inside one do block the pair
-- cannot come apart however it is run.
do $$
declare v_name text;
begin
  select c.conname into v_name
    from pg_constraint c
   where c.conrelid = 'family.events'::regclass
     and c.contype = 'c'
     and c.conname <> 'events_rrule_grammar'
     and pg_get_constraintdef(c.oid) like '%rrule%';
  if v_name is not null then
    execute format('alter table family.events drop constraint %I', v_name);
  end if;

  execute $add$
    alter table family.events add constraint events_rrule_grammar check (
      rrule is null or (
            rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY);INTERVAL=([1-9]|[1-9][0-9])(;|$)'
        and rrule !~ '(^|;)COUNT='
      )
    )
  $add$;
end $$;
