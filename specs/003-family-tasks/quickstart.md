# Quickstart: Family Tasks

**Feature**: `003-family-tasks` | **Date**: 2026-09-04

Everything needed to go from a Phase 2 checkout to a working Tasks board, plus how to verify each
Phase 3 guarantee by hand and where each one is automated. Day-to-day development runs against the
**local** Supabase stack (§3); the hosted project needs a short set of **operator steps** (§4) —
this phase, like Phase 2, deliberately adds **no new Dashboard toggles**: two read-only pre-push
checks, one `db push`, two post-push checks, one template count.

The board is entirely date-driven, so two things bite harder here than in Phase 2 and are called out
where they land: the household timezone must be real (§4.6), and the local fixtures are anchored to
the day the seed ran (§3).

---

## 1. Prerequisites

- **Phases 1 and 2 are the platform**, shipped and deployed. Their local stack, seed script,
  sign-in, punch-in, recurrence engine, household timezone, filter sheet and both test projects are
  reused. If the hosted Phase 1 operator steps (001 `quickstart.md` §4) are still pending, do them
  first — a single `supabase db push` now applies 001–022 in one go, and 001 §4's ordering rules
  still govern the auth steps.
- **No new dependencies.** The occurrence expander, the cursor derivation, the counters, the layout
  measurement and the reorder reducer are all hand-rolled in `lib/family/tasks/`; the widened
  recurrence grammar is an edit to the shipped `lib/family/recurrence/`. `@dnd-kit` stays in
  colectivo, `framer-motion` is already installed, TanStack Query is already the read layer.
  `npm install` after pulling the branch is routine, not structural.
- **No new services, buckets, providers, auth hooks, extensions, edge functions or cron entries.**
  Migrations 017–023 create four tables, one domain, one view, one seed function, the trigger
  functions, four publication entries, and — in **022, last** — the tightened `family.events.rrule`
  CHECK. Nothing else. **No migration creates a function on the write path**: complete and skip are
  one INSERT, undo is one DELETE, so there is no resolve RPC to grant or to check.
- **One config change that is not a migration**: `.fallowrc.json` gains a `family-tasks-core` zone
  (§Quality gates). Without it the audit reports boundary violations, not because the code is
  wrong but because the zone does not exist yet.
- **Postgres 15 or newer** on the hosted project, for `unique nulls not distinct` on the
  resolution key. The local `supabase/config.toml` pins `major_version = 17`. Check the hosted one
  before pushing (§4.1).

## 2. Environment

Phases 1 and 2's `.env.local` carries over verbatim. **This phase adds no variables at all.**

`FAMILY_SEED_TIMEZONE` (Phase 2, seed-script only) is still the one household-specific value the
seed reads, and it matters more here: a chore's due time, the four sub-types, "late", the midnight
rollover and every occurrence date are computed in the household zone. Nothing new goes to Vercel.

## 3. Local stack (day-to-day development)

Same port block as Phases 1 and 2 (`supabase/config.toml`): API **55321**, DB **55322**, Studio
**55323** — the CLI defaults 543xx belong to another project on this machine; leave it running.

```bash
supabase start                        # boots the stack on :553xx
supabase db reset                     # replays migrations 001–022
npm run family:seed -- --local        # Phase 1 account + profiles/labels, Phase 2 timezone +
                                      # fixture week, and now the fixture TASK BOARD (below)
npm run dev:local                     # http://localhost:3000/family/tasks
```

### The seed gains task fixtures — `--local` only

**Yes, the seed grows.** The hosted seed gains **nothing** this phase: the seventeen Task Box
templates are seeded by migration 021 itself (they are reference product data, not household data —
constitution §VII), and real tasks come from the household. The `--local` run gains one new block,
`FIXTURE_TASKS`, built the way `FIXTURE_WEEK` already is: fixed UUIDs (`fixtureTaskId(n)`) so it is
idempotent, explicit `times_of_day` and rule strings written **only here** (clients never submit
rule strings), and each row commented with the check it exists for.

**One difference from `FIXTURE_WEEK`, and it is load-bearing**: the calendar fixtures sit on fixed
September 2026 dates; the task fixtures are **anchored to the day the seed runs**. "Late",
"carried forward", "the streak behind this routine" and "today's column" have no meaning against a
frozen date. So the seed computes `today` in the seed timezone and derives every fixture date from
it — and re-running the seed after the day rolls over re-anchors them (see Common problems).

What the fixture board must cover, one fixture per hand check below:

| Fixture | Assignee(s) | Shape | What it exercises |
|---|---|---|---|
| **Take out trash** | Ben | Timed 18:00, Scheduled Date **weekly** on today's weekday, anchored `today − 21` | the **Timed** sub-type; SC-307's absolute half — three missed occurrences outstanding beside today's fresh one (FR-341); the SC-304 refusal target for Cleo |
| **Hoover the stairs** | Ana | Timed 09:00, Scheduled Date **every 2 weeks**, anchored `today − 28` | `INTERVAL=2` end to end (FR-345); FR-357's bound — the `today − 28` occurrence is off today's board, the `today − 14` one is on it |
| **Feed the cat** | Cleo | date = today, no time | the **All-day** sub-type (FR-327) |
| **Sort the recycling** | Cleo | no date, no time, description "goes in the blue bin" | the **Anytime** sub-type (FR-328) — never late, present every day; and SC-320's description match |
| **Water the plants** | Cleo | Timed 18:00, `today − 2`, one-off, unresolved | the **Late** sub-type (FR-325); SC-308's target; and US3-7 — a one-off offers no Skip |
| **Clean the bathroom** | Ana | Completed Date, after 2 weeks, head `today − 14`, chain of one resolution resolved `today − 14` | SC-307's cursor half — a **derived** open occurrence due today with no stored next date; the chain tail lies outside the week window, so it also proves `family.task_cursors` |
| **Descale the kettle** | Ben | Completed Date, after 1 month, due today, no resolutions | the chain **head** case (no tail → `max(due_date, chainStartedOn)`) |
| **Empty the dishwasher** | *nobody* — Up for Grabs | all-day today, unresolved | the Up for Grabs column (FR-308); SC-311's double claim; FR-363's household-wide skip |
| **Set the table** | Ana **and** Ben | all-day today, **Ana's occurrence already completed** | FR-324 one task / two assignees; a completed card at full tint; SC-317's "still there, minus that person"; the SC-304 parent-credits-another case |
| **Cat medicine** | Ben | Timed **02:30**, Scheduled Date daily, endless | the DST pair always holds an occurrence to inspect (AS-2.15, SC-313's second half) |
| **Brush teeth** | Cleo | Routine, every day, **Morning + Evening**, Track Habit on, completions on each of the last **11** days, none today | FR-335's two separately completable occurrences; the routine's own progress indicator (FR-312); the streak badge reading **eleven** (US4-6); SC-312's starting point |
| **Make bed** | Cleo | Routine, **every 2 days**, Morning, anchored so today matches | `INTERVAL=2` on a routine (SC-313's first half) |
| **Practice piano** | Cleo | Routine, daily, Evening, Track Habit on, 5 days behind it, **today's occurrence skipped** | SC-309 and SC-310's skip — out of the denominator, streak intact, invisible until the Skipped filter is on |
| **Homework** | Cleo | Routine, weekdays, Afternoon, **Repeats until `today + 14`** | US2-10's end date on a routine (FR-346) |
| **Shelf pack** (**12** anytime chores) | Cleo | no date, no time | SC-315 — the count is arithmetic, not decoration. Cleo's other fixtures contribute 8 occurrences on the seed day (Feed the cat 1, Sort the recycling 1, Water the plants 1 late, Brush teeth 2 slots, Make bed 1, Practice piano 1 skipped, Homework 1), so **twelve** anytime chores put her column at exactly **twenty**, nineteen of them visible with the skipped one hidden. Ten would give eighteen, and SC-315's "twenty" would be unverifiable on the one fixture built for it |
| *(nothing)* | Kit | — | FR-316's empty column, from the Phase 1 fixture profiles |

The Phase 1 fixture profiles (Alex, Sam, Kit) and the Phase 2 example household (Ana, Ben, Cleo,
the Label "Bin day") are unchanged — the Label is seeded precisely so US2-6 can confirm it is
**not** offered in the assignment picker.

`supabase db reset` is still the fastest way back to a clean state; re-run the seed afterwards.

## 4. Hosted project — operator steps

> **State on 2026-09-04**: steps 1 and 2 were run from the dev machine with the logged-in CLI
> (`supabase db query --linked`) — PG **17.0006** (`ok = true`), the `rrule` audit returned **zero
> rows** (the live table holds one event, none repeating), and the constraint 023 will replace is
> `events_rrule_check`. Migration 023 was then written and proved locally. **Step 3's push was run
> by the operator the same day** (017–023 applied, each in its own transaction), and steps 4–7
> passed from the CLI straight after: no `anon` row, `seed_task_box` service_role-only,
> `security_invoker=true`, the four tables published at replica identity default,
> `America/Chicago`, 9 chores + 8 routines. Step 9's device checks remain.


Everything here needs `SUPABASE_ACCESS_TOKEN` or the Dashboard. Expected total: **check, check,
push, check, check, confirm** — there is no new Dashboard configuration in this phase.

> **Ordering constraint — step 3's push happens BEFORE the branch is merged or deployed, never
> after.** This phase adds four tables to the **single shared** realtime channel
> `family:<householdId>` that `FamilyProvider` mounts on **every** `/family` page. A
> `postgres_changes` binding for a table the hosted database does not have fails the **whole**
> channel, so an app deployed ahead of the push does not merely have a broken Tasks tab — it
> silently takes **live updates for the shipped Phase 1 and Phase 2 surfaces, the Week calendar
> included**, down with it, and `/family/tasks` reads four tables that do not exist with no
> `error.tsx` under `app/` to catch it. So: **§4.1 → §4.2 → §4.3's `db push` → §4.4 and §4.5 green →
> then merge and deploy.** The same statement is `tasks.md` Hard ordering 7 and T084, and
> `plan.md` §Risks.

1. **Check the Postgres major version — the first operator step, before migration 023 is written and
   before any hosted push.** This is the **one moment** the check happens, stated in the same terms
   in `plan.md` §Technical Context, `plan.md` §Risks and `tasks.md` T081(a). Migration 019's
   occurrence key uses `unique nulls not distinct`, which is PG 15+; 018 is authored and applied
   **locally** long before this step, against `supabase/config.toml`'s pinned `major_version = 17`,
   so a `false` here has altered nothing hosted.
   ```sql
   select current_setting('server_version_num')::int >= 150000 as ok, version();
   ```
   If this is `false`, stop and say so — the fallback (a `coalesce`-expression unique index) is a
   **data-model** decision, not something to improvise at push time, and its cost is stated rather
   than discovered: re-edit 018, `supabase db reset`, and re-run the schema suites locally
   (`tasks.md` T009–T012) before returning to this step.
2. **Prove the `rrule` tightening against the live rows, before writing or pushing 022.** Migration
   022 is the only file in this phase that alters a **shipped Phase 2 table**, and it is an
   `ADD CONSTRAINT` that validates every stored row under `ACCESS EXCLUSIVE`. Do not discover a
   violation by watching that ALTER fail on the family's live database. Run this read-only against
   the **hosted** project first, and do not write 022 until it returns **zero rows**:
   ```sql
   select id, rrule from family.events
    where rrule is not null
      and (rrule !~ '^FREQ=(DAILY|WEEKLY|MONTHLY);INTERVAL=([1-9]|[1-9][0-9])(;|$)'
           or rrule ~ '(^|;)COUNT=');
   ```
   **A hit is a row that needs explaining, not a reason to loosen the regex.** This is the check that
   covers the hosted data: the interval-1 equivalence sweep is algebraic and the automated
   stored-corpus round-trip runs against the **local** stack's seeded rules, so neither of them has
   ever read a hosted row. Every rule the shipped `emitRule` can write passes, which is why zero is
   the expected answer.
3. **Push the schema**
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_...
   supabase link --project-ref zgmltllcyqylgtazunai
   supabase migration list              # see what the remote is missing
   supabase db push                     # applies 017–023 (and anything earlier still missing)
   ```
   The last file in that range, **022**, is the one that touches shipped data: it drops 010's unnamed
   `rrule` predicate on `family.events` and adds `events_rrule_grammar`, the identical text
   `family.tasks` has carried since 016. It is sequenced last on purpose — the grammar, the expander
   and their byte-stability corpus are proved against a database nobody has touched first, and the
   constraint lands as a backstop rather than an unblock. Step 2 has already shown every stored rule
   passes; if `ADD CONSTRAINT` fails anyway, stop and explain the row — never loosen the regex.

   **The drop and the add are one unit.** In 022 they sit inside the *same* `do $$ … $$` block
   (data-model §023), so a failing ADD rolls the DROP back; `supabase db push` gives the same
   guarantee by running each migration file in a transaction. **Never run them as two separate
   SQL-editor statements** — every other step in this section is a Dashboard query, and there two
   top-level statements commit independently: a committed DROP with a failed ADD would leave
   `family.events.rrule` with **no CHECK at all**, looser than what shipped, on the live table, with
   nothing surfaced to the family.
4. **Check the privilege inventory.** Nothing this phase adds may be reachable by `anon`.
   ```sql
   -- tables + the cursor view: SELECT to authenticated, ALL to service_role, nothing to anon
   select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privs
     from information_schema.role_table_grants
    where table_schema = 'family'
      and table_name in ('tasks','task_assignees','task_resolutions','task_box_items','task_cursors')
    group by 1, 2 order by 1, 2;

   -- every function this phase adds: service_role only
   select p.proname,
          has_function_privilege('service_role', p.oid, 'execute') as service_role,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
          has_function_privilege('anon', p.oid, 'execute')          as anon
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'family' and p.proname like '%task%'
    order by 1;
   ```
   Expect no `anon` row anywhere in the first result, and `service_role = true` with both others
   `false` in the second — the same inventory `policies/privileges.test.ts` asserts against the
   local stack, which is the check that actually enforces it. `family.task_cursors` must be
   `security_invoker` (it carries no policy of its own and inherits `is_member()` from
   `task_resolutions`):
   ```sql
   select relname, reloptions from pg_class where relname = 'task_cursors';
   ```
5. **Check the realtime publication** — not a toggle; migration 022 does the guarded add itself, and
   this step only verifies it (FR-392).
   ```sql
   select tablename from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'family';
   ```
   Expect Phases 1 and 2's tables **plus** `tasks`, `task_assignees`, `task_resolutions`,
   `task_box_items`. If the publication did not exist at push time, 021 printed a NOTICE and
   skipped — re-run its block or add the four in **Database → Publications**. Confirm replica
   identity was left at the default: `replica identity full` is prohibited, because a deleted
   task's title is exactly the child's-schedule data DELETE payloads must not carry.
6. **Confirm the timezone is real** (Phase 2's step, re-checked because this phase is entirely
   date-driven):
   ```sql
   select timezone from family.household_settings;   -- must NOT be 'UTC' unless that is the truth
   ```
7. **Confirm the Task Box seeded.**
   ```sql
   select routine, count(*) from family.task_box_items group by 1;   -- expect 8 routines, 9 chores
   ```
   020 calls `family.seed_task_box()` for the committed household and is **idempotent by emptiness,
   not by conflict** — a household that has deleted "Vacuum" must not have it resurrected (FR-381).
   If the count is zero on a household created outside 020, call it once by hand:
   ```sql
   select family.seed_task_box('<household_id>');
   ```
8. **Nothing else.** `family` is already in Exposed schemas (a Phase 1 step); new tables, the view
   and the functions in an exposed schema need nothing, and the `notify pgrst, 'reload schema'` in
   019, 020 and 021 makes them visible without a restart.
9. Verify SC-305's anonymous probe (below), run SC-301 and SC-302 once at the wall with a stopwatch,
   and spot-check SC-316 on the iPad in both orientations and on a phone.
10. **Only now merge and deploy.** Steps 3–5 must be green first, for the reason stated at the top of
    this section: the new realtime bindings are additive to a channel Phases 1 and 2 already depend
    on, and a deploy that lands ahead of the push takes the shipped calendar's live updates down
    with it, silently (`tasks.md` Hard ordering 7 and T084; `plan.md` §Risks).

## 5. Run

```bash
npm run dev            # against the hosted project (needs §4)
npm run dev:local      # against the local stack (§3)
```

---

## Verifying the guarantees — by hand

Each success criterion, what must hold, and the by-hand check. The fixture board from §3 is assumed
locally; on the hosted project, create the named tasks first. "Zone" means the household timezone.
Unless a row says otherwise, start punched out on `/family/tasks` showing today.

| Criterion | What must hold | Verify by hand |
|---|---|---|
| **SC-301** tick in <15 s, ≤3 taps after the PIN | A child goes from punched out to a ticked routine | Stopwatch. Tap Cleo's avatar → PIN → tap the circle on her Morning "Brush teeth". Under 15 s from first touch; count the taps after the last PIN digit — no more than three |
| **SC-302** create in <45 s | A repeating, two-person chore enterable at the wall, punch-in included | Stopwatch. Create control → punch in as Ana → title → assign Cleo **and** Ben → Repeats → Scheduled Date, every 1 week → save. Under 45 s |
| **SC-303** nothing changes anonymously | Every verb refused with nobody punched in; every resolution names credited **and** actor | Punch out, then attempt each of: complete, un-complete, skip, unskip, claim, create, edit, delete, column reorder. Each demands the punch-in sheet; dismiss it — nothing changed anywhere. Then `select category_id, created_by from family.task_resolutions order by resolved_at desc limit 1`: both populated — `category_id` is the Profile credited and `created_by` is the punched-in actor (018; contracts §Guards). There is no `actor_category_id` column. The bypass case (calling the action directly, tampered cookie) is the policies suite |
| **SC-304** a member resolves only their own | Four checks, two of them off-interface | Punch in Cleo: tick "Feed the cat" → completes. Tick Ben's "Take out trash" → refused, card unchanged, message names Ben and says a parent may do it. Punch in Ana: tick Cleo's "Feed the cat" → completes, credited **Cleo**, actor **Ana**. The same four issued directly rather than through the interface are the policies suite |
| **SC-305** no stranger's data | Other-household reads return nothing on every path | (a) `curl` the REST endpoint for `tasks` with the publishable key and no session → `401`/`42501`; repeat for `task_assignees`, `task_resolutions`, `task_box_items`, `task_cursors`. (b) The exhaustive per-path checks (member, authed non-member `[]`, anonymous) are the policy suite's job — `npm run test:policies` |
| **SC-306** second device ≤5 s | A tick appears on device B without reload, and survives both reloads | Two devices on today's board. Tick "Feed the cat" on A; B updates within 5 s, untouched. Reload both: still ticked, ring and count agree on both |
| **SC-307** the two modes are provably different | Absolute vs cursor, side by side | **Scheduled**: "Take out trash" shows three late occurrences **and** today's, all separately completable, and completing today's changes none of the other three. **Cursor**: "Clean the bathroom" shows exactly **one** open occurrence and no later one exists anywhere (check `family.tasks` — there is no stored next date, and `family.task_cursors` holds one tail row). Complete it: exactly one new occurrence appears, dated **fourteen days after today**, and none existed a moment earlier |
| **SC-308** recorded on the day ticked | A late chore's record follows the tick, not the due date | "Water the plants" is due `today − 2` and shows late with that date. Complete it today: the record says **today** (`resolved_on`), today's count includes it, navigating back to `today − 2` shows that occurrence completed late, and `today − 1` shows it **not at all** |
| **SC-309** skip is free and reversible | Out of the denominator, streak intact, hidden, and Unskip restores all three | "Practice piano" is skipped today. Read Cleo's count before and after switching the **Skipped tasks** filter on: the card appears marked skipped, the count does not move. Its streak badge is unchanged. Open it → Unskip → it returns to unresolved, the denominator goes back up by one, and the badge is still unchanged |
| **SC-310** the counters agree with the column | Ring and count match by hand on a day containing all five shapes, and no filter moves them | Cleo's seeded column has an anytime chore, a late chore, a skipped occurrence, a routine in two slots and the shelf pack. Punch in Cleo, claim and complete "Empty the dishwasher" crediting herself: the Up for Grabs count drops by one and Cleo's **total and completed** each rise by one at that moment. Now count the column by hand and compare with the header. Then toggle each of the five filters, hide a profile, and type in the search box: **no number moves** |
| **SC-311** one claim wins | Exactly one record, a naming refusal, both screens agree | Two devices punched in (Ana and Ben), both on "Empty the dishwasher". Complete on both within the same second: exactly one `task_resolutions` row exists, the loser sees a refusal naming the credited profile, and both screens show the card in that profile's column within 5 s |
| **SC-312** streaks are correct across 30 days | Advance, hold across a skip, reset on an unresolved day, and step back on an un-tick | The seeded "Brush teeth" badge reads **eleven**. Complete both of today's slots → twelve. Un-tick the most recent completion → **eleven**. **Now re-complete that slot before going any further** — leaving it un-ticked means today ends with an occurrence unresolved, and FR-373 resets the streak to zero when the clock advances, whatever tomorrow is set to; a skip cannot protect a day that already has an unresolved occurrence in it. With today complete again (twelve): skip **tomorrow's** occurrences and advance the clock a day → **still twelve**, the skip holding the value rather than advancing or breaking it. Then leave the following day ending with one unresolved → **zero**. The full thirty-day table (30 → skip → unresolved) is a unit test |
| **SC-313** interval repeats survive a year and the DST dates | Right dates, none missing or duplicated; 02:30 renders once | Step "Make bed" (every 2 days) forward across **2026-11-01** and **2027-03-14** — the next two transitions reachable with **Next** from a 2026-09 seed, which is why this row walks them rather than the spec's own 2026-03-08 pair (that pair is covered by T025's unit table and by T058's US2-16 check): the every-other-day rhythm never doubles or skips a beat. "Cat medicine" (02:30 daily) appears exactly **once** on 2027-03-14, at 03:00, and exactly once on 2026-11-01. Set the *device* to another zone and confirm nothing shifts. The year-long sweep is a unit test |
| **SC-314** correct next morning | Day, late set and counts all advance untouched | Leave the tablet on today's board overnight (or set the system clock to 23:58 and watch). At midnight: the displayed day is the new one, yesterday's unresolved chores are on it **marked late with yesterday's date**, and every count is the new day's — no reload, no interaction. Then navigate to a past day, wait past a boundary, and confirm the view **stays** where it was put |
| **SC-315** nothing unreachable | Twenty occurrences in one column, all reachable, page never scrolls sideways | Cleo's column crosses twenty with the shelf pack. At 1920×1080, 1180×820, 820×1180 and 390×844: scroll **inside** her column to the twentieth — the seeded skip means nineteen are visible by default, so switch the **Skipped** filter on to reach the twentieth; the page itself never scrolls horizontally at any width |
| **SC-316** responsive, 44-pt | No overlaps, all controls ≥44×44, columns as the space allows | Load at each of the four widths. Landscape tablet: four columns stretched to share the width. Portrait tablet: columns **wrap** onto a second row. Phone: one full-width column, Up for Grabs first, swipe to move. Inspect the completion circle and the four header toggles specifically — both draw smaller than the floor and need a larger hit area |
| **SC-317** deleting a Profile never surprises | Both counts stated; survivors keep their history | Locally: create a throwaway profile, give it one sole-assignee task and one shared with Ana, then delete it. The confirmation states how many tasks **lose an assignee**, how many are **deleted outright**, and the affected-event count Phase 2 added — and says in words that events survive a category deletion while a task with nobody left does not. Afterwards the shared task is still on the board with Ana's history intact. `supabase db reset` + re-seed |
| **SC-318** exactly seventeen, added in <20 s | The seeded box, and a fast add from it | On a fresh household (`db reset` + seed) open the Task Box: **exactly 17**, split into Chores (9, no emoji) and Routines (8, each with its emoji), titles verbatim per FR-382, filtered live by its own search box. Tap the **Homework** routine template: the ordinary create form opens pre-filled with title, emoji and type, everything else empty and still required. Stopwatch the rest — assignment and schedule only — under 20 s |
| **SC-319** no stars anywhere | Nothing star-facing on any surface; the two reserved columns still exist | Audit every Phase 3 surface: board, card, column header, details view, create/edit form, filter sheet, Task Box, template edit form (which must offer **exactly three** fields: title, emoji, type). No star value, chip, total, balance, reward, redemption **or celebration of any kind**. Then confirm the storage is reserved: `select reward_points from family.tasks limit 1` and the same on `family.task_box_items` — the columns exist and read null |
| **SC-320** search filters the board in place | Matches on title **or** description, every column, counters unmoved | Type `trash`: only "Take out trash" is left, in every column including Up for Grabs. Type `bin`: "Sort the recycling" survives on its description alone. Watch every ring and count throughout — none moves. Clear the box: every card returns |

### Load-bearing FR spot-checks

The rules the criteria compress, checked individually:

| FR | Check |
|---|---|
| FR-302/306/307 sections and toggles | Four independent toggles; any combination including none; Chores composes with any time of day and starts on. At 11:55 the Morning section is selected; switch it manually, then cross noon — the automatic selection **re-asserts** |
| FR-305/384 the denominator | The count is routines in each slot + chores due today + anytime chores + late carry-ins + claimed up-for-grabs, **less skipped**. Toggle every filter and hide a profile: nothing in any header moves |
| FR-309/310/311 reordering | Press-and-hold a profile name → the column moves (parent only; try it as Cleo → refused). Press-and-hold a routine → it moves **only within its own section for that profile**; dragging it to Evening or to another column is refused. Chores offer no drag at all, and their order is: late first (earliest due), then timed (earliest time), then all-day, then anytime, ties by creation |
| FR-312 routine progress | "Brush teeth" shows its own two-slot indicator, independent of the column ring |
| FR-313 vs FR-383 | Turn **Show on Tasks tab** off for Ben: his column disappears on **every** device and he vanishes from the assignment picker; his tasks are untouched and return with the switch. The per-device profile filter hides a column on **one** device and touches neither |
| FR-314 no chip row | The Tasks tab goes from the top bar straight into columns. The calendar still shows the chip row |
| FR-318/332 conversion keeps history | Convert "Sort the recycling" into a routine: the form demands a repeat, weekdays and at least one slot before it saves. Its earlier resolutions are **not deleted** — they simply stop being surfaced. Convert it back |
| FR-325/328 sub-types | Timed, All-day, Anytime and Late each render as specified; the anytime chore is never marked late however long it sits |
| FR-326 DST on a due time | The pair US2-16 and SC-313 name, and the pair T025's unit table asserts: **2026-03-08** — a 02:30 chore lands at the first valid time, once; **2026-11-01** — a 01:30 chore uses the first instant, once. The by-hand walk below uses the next two *forward-reachable* transitions instead (2026-11-01 and 2027-03-14) and must behave identically; the rule is the rule, the dates are just dates |
| FR-336 slots do not migrate | Complete a Morning routine at 22:00: it is still in Morning, still counted, still shown whenever Morning is on |
| FR-343/344/362 the cursor | Complete "Clean the bathroom" → one new occurrence at +14 days. Undo it → the new occurrence is **withdrawn** and the original returns unresolved. Resolve the new one first, then try to undo the earlier completion → **refused** with a message. Skip an open occurrence → the cycle advances by the delay rather than ending |
| FR-347 delete scopes | A repeating chore offers this occurrence / all future / all; a routine offers all future / all. "This occurrence" writes a **skip** (check the Skipped filter). "All future" ends the repeat before that date and leaves every earlier occurrence and its resolutions |
| FR-348/349/398 completion feedback | The circle becomes a disc in the **credited profile's own accent** under a white check — never a fixed green. The card goes 40 % → full. Text and checkmark stay legible at both tints on every palette colour. Reduced motion collapses the transition |
| FR-304/348/349/398 the tint ladder, all three rungs at once | The Profile's colour appears at exactly three strengths and nowhere else: the **column header panel at 20 %**, an **incomplete card at 40 %**, a **completed card at full**. Put Ana's and Cleo's columns side by side and check all six panels/cards against the palette; then confirm the completed disc is that Profile's own accent drawn deeper (never a fixed green) and that card text and checkmark clear 4.5:1 at both card tints |
| FR-352 the details action list | Tap a card **body** (not its circle): the sheet offers Mark as Complete / Mark as Incomplete, Edit and Delete, with **Skip only on a routine or a repeating chore** — "Water the plants" (one-off) shows no Skip — and **Unskip only on an already-skipped occurrence** — "Practice piano" today shows Unskip and no Skip, and shows Skip again after unskipping |
| FR-372 the streak badge | "Brush teeth" carries a **lightning-bolt** badge beside the routine's name on the card reading **11**; complete both of today's slots and it reads 12. A routine with Track Habit off carries no badge at all |
| FR-351 refusal wording | Cleo tapping Ben's card: nothing stored, card unchanged, message says whose it is and that a parent may do it |
| FR-357 the 28-day bound, **and its one exemption** | The bound is `todayEpochDay − scheduledEpochDay < CARRY_FORWARD_DAYS` (R316): day 27 carried, **day 28 not**, day 29 not. "Hoover the stairs" (Scheduled Date) — the occurrence at `today − 28` is **not** on today's board; the one at `today − 14` is. Both still appear on their own days. Then the exemption (FR-343 vs FR-357, R316): set "Clean the bathroom" (Completed Date) so its open occurrence is **40 days** old — it is still on today's board, still marked late with its own date, and still completable. Bounded like a rule-mode chore it would be unreachable for ever, because that occurrence *is* the cursor |
| FR-358 the late treatment | Late is its own treatment, shows the original due date, and is visibly **not** the destructive-action colour |
| FR-363/368 up-for-grabs resolutions | Completing "Empty the dishwasher" without choosing a profile is refused. **Skipping** it needs no profile and skips it for the whole household. Cleo choosing Ben as the credited profile is refused; Ana choosing anyone is allowed |
| FR-376/386 two search boxes | The tab's search filters the board; the Task Box's search filters templates. They are different controls and neither affects the other |
| FR-393 refuse, never queue | Go offline (DevTools → Network → Offline) and try a tick: refused with a message, nothing shown complete, nothing queued. Delete a task on device B, then act on it from A's open details: refused "no longer exists", and the details close rather than recreating it |
| FR-394/395/396 fit | The column count is a measurement, not a constant: stretch the window and watch it change. Portrait tablet **wraps**; the phone shows one and swipes, Up for Grabs first. No page-level horizontal scroll at any width |

## Automated checks — which suite covers what

```bash
npm test                 # both projects; policies auto-skips with a notice when :55321 is down
npm run test:unit        # pure logic + RTL component tests — no database
npm run test:policies    # RLS / privileges / actions against the local stack — a missing stack FAILS
npm run test:coverage    # Istanbul report for the fallow gate
```

| Guarantee | Where automated | Project |
|---|---|---|
| **The widened grammar did not move a live rule** — interval-1 equivalence against the shipped predicate over 2025-01-01…2027-12-31 × every rule shape; the nine shipped round-trip strings byte-identical; `INTERVAL` 0/100/01/+2/1.0/−1/missing refused both directions; WKST **required** above interval 1 and inert at 1 | `lib/family/recurrence/` tests (`grammar`, `expand`) | unit |
| **The stored corpus round-trips** — every `rrule` in `family.events` after reset+seed parses, re-emits byte-for-byte and reads `interval === 1`. Run **before 022** lands. It reads the **local** stack (`db reset` + `--local` seed), so the hosted rows are covered by §4.2's read-only query instead, not by this test | `policies/` corpus test | policies |
| SC-313, FR-326 — `INTERVAL=N` DST tables, the year-long "every 2 days" sweep, the 02:30 gap/fold singletons, `BYMONTHDAY=31` skipping | recurrence + `tasks/expand` tables | unit |
| **The calendar's contract did not widen** — `eventInputSchema` still rejects `interval: 2`; `ruleFromChoice` still emits `INTERVAL=1` for every event choice | calendar contract test | unit |
| SC-307, FR-343/344/362 — cursor derivation, "Immediately", undo withdrawal, the refusal when the next cycle is resolved, skip advancing the cycle | `tasks/cursor` tables; end-to-end in the resolve actions | unit + policies |
| FR-325/328/356/357 — the four sub-types, the carry-forward tail with **day 27 carried, day 28 not, day 29 not**, anytime never late, routines never carried | `tasks/expand` tables (one `CARRY_FORWARD_DAYS`; the render bound is the strict inequality, the read window one day wider) | unit |
| SC-310, FR-305/384 — the counters as a pure function, SC-310's checklist verbatim plus "no number moves under any filter" | `tasks/counters` table-driven test | unit |
| SC-309/SC-312, FR-360/371–374 — thirty days containing one skip and one unresolved day; recompute on undo | `tasks/streaks` | unit |
| SC-320, FR-383/386 — five switches × three states × the search predicate | `tasks/visibility` truth table | unit |
| SC-315/SC-316, FR-311/394/395/396 — the four viewports, the wrap, the phone slice, the chore order | `tasks/layout`, `swipe` | unit |
| SC-314, FR-315 — derived rollover with fake timers; a pinned day never pulled away | `useDayAnchor` | unit |
| FR-306/307 — the clock-derived window and the override expiring at the next boundary | `useTaskFilters` / toggle hook with fake timers | unit |
| SC-303/SC-304, FR-350/351/388/389 — every write verb refused without an actor and with a tampered cookie; member vs parent per verb, issued directly rather than through the interface; attribution columns set from the actor, never the payload | resolution + task actions against real rows | policies |
| SC-305, FR-390 — per-path RLS reads for `tasks`, `task_assignees`, `task_resolutions`, `task_box_items` **and `task_cursors`**; authed non-member `[]`; anonymous `42501`; the privilege inventory extended **exactly** (any new `anon` grant fails) | `policies/access`, `policies/privileges` | policies |
| SC-311, FR-370 — two simultaneous claims on one occurrence: exactly one row, one refusal naming the winner | concurrency test | policies |
| FR-323/365/368 and the resolution shape — the Profile-only assignee trigger, up-for-grabs-is-unassigned, and each named CHECK actually refusing its invalid row (incl. `INTERVAL` bounds on **both** `events` and `tasks` after 016) | schema-shape tests | policies |
| FR-391 — profile deletion removes assignments and that profile's resolutions, keeps multi-assignee tasks, deletes the orphans, and reports both counts | action test | policies |
| FR-348/351/352 UI paths — the `withActor` call shape, punch-in-on-tap, the refusal message; column toggles and their boundary reset; form validation landing on fields and the type conversion demanding the target type's fields; claim dialog member-vs-parent; the filter sheet's new section; template → prefilled form | RTL component tests | unit |
| FR-392 realtime wiring — the four task tables in the `TABLES` list each with **no** `filter` member; every notice a bare `invalidateQueries(familyKeys.all)` | `useFamilyRealtime` targeted test | unit |
| The completion cross-fade and its reduced-motion collapse; ring, badge, toggle and card geometry; the portrait wrap; the phone swipe; 44×44 hit areas; press-and-hold reorder feel; the overnight rollover | **by hand** on the iPad and a phone (quality-bars: drag/visual layers are verified by running the app) | — |

## Quality gates

Unchanged from Phases 1 and 2 — all four before every commit, no suppressions ever
(`.claude/rules/quality-bars.md`): `npm run fallow:audit`, `npm test`, `npm run typecheck`,
`npm run lint`.

Two things specific to this phase:

1. **`.fallowrc.json` gains a `family-tasks-core` zone** covering `lib/family/tasks/**/*`, with
   `allow: ["family-tasks-core", "family-recurrence", "family-calendar-core", "lib"]`, and the zone
   appended to the allow lists of **`lib`, `components`, `ui-pages`, `family-actions` and `tests`**.
   The literal config fragment, and why the extent is the whole directory rather than three files,
   are in `data-model.md` §"Dashboard / config steps" — copy it from there rather than retyping it.
   This is the exact analogue of what Phase 2 did for `family-calendar-core`: **a boundary widening,
   in config, reviewable in the diff — not a suppression** (the same phrase `plan.md` §I and §IV and
   `data-model.md` §"Dashboard / config steps" use). The supporting argument, not the label, is that
   `lib/family/recurrence/**` gains one importer zone and loses none. Land the zone in the same commit as the first file that needs it, or
   the audit reports violations for code that is correct.
2. **Coverage before complexity.** The new expander, cursor, counters, streaks and layout modules
   are exactly the branchy-pure shape the CRAP gate scores, which is why they are written
   test-first. Run `npm run test:coverage` once before invoking `fallow` directly, or the report is
   stale and complexity findings appear that coverage would have quieted.

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Nothing is late; the streak badge is wrong; the board looks a day out | The `--local` fixtures are anchored to the day the **seed** ran, and the day has rolled since | Re-run `npm run family:seed -- --local`; it re-anchors every fixture date |
| `db push` fails on `unique nulls not distinct` | The hosted project is below PG 15 | §4.1 — this is a data-model decision (the `coalesce` expression-index fallback), not a push-time improvisation |
| Insert fails `tasks_rrule_grammar` / `events_rrule_grammar` | An interval outside 1–99, a leading zero, a `COUNT=` part, or an `RRULE:` prefix | Only the server emitter writes rule strings; clients send the structured repeat choice. A violation here is a code bug, not data entry |
| A weekly repeat above interval 1 is refused by the parser | `WKST` is **required** on `FREQ=WEEKLY` above `INTERVAL=1` — it is what fixes week parity | Emit it. At interval 1 it stays optional and inert, which is why no shipped rule moved |
| A Completed Date chore shows no occurrence at all | Its chain tail is older than every window the board fetches, and `family.task_cursors` is missing, not exposed, or not `security_invoker` | §4.4 — the view is how the tail reaches a browser-direct read; PostgREST cannot express a per-group limit |
| Completing a Completed Date chore produces two next occurrences | Two clients wrote against the same `cycle_prev` — the unique key is what refuses this | The occurrence key must include `cycle_prev` and `assignee_id`; a `23505` here is the design working (FR-393's "already resolved") |
| A routine's two slots collapse into one card, or completing Morning also completes Evening | The occurrence key dropped its slot | The key is (task, assignee, date, **slot**, cycle_prev) — FR-335 and `instance_time` |
| A tick by Ben moves Ana's due date on a shared chore | A per-task cursor column crept back in | The cycle is per **assignee**; there is no `tasks.next_due_date` |
| A number in a column header moves when a filter is toggled | The counters were computed **below** the filters in the memo chain | They must branch above every display filter — that is what makes FR-384 a property of the graph rather than a promise |
| **The calendar's live updates stopped after a deploy** — a tick on one device no longer appears on another anywhere in `/family` | The app was deployed **before** §4.3's `db push`. The four Phase 3 tables join the single shared `family:${householdId}` channel, and a `postgres_changes` binding for a table the server does not have fails the **whole** channel — so Phase 1's and Phase 2's subscriptions go down with it | Run §4.3 (and §4.4/§4.5), then reload. Prevention is the ordering: push before deploy, never after (§4 preamble, `tasks.md` Hard ordering 7) |
| `/family/tasks` throws instead of rendering, on the hosted project | Same cause: the four reads hit tables that do not exist yet, and there is no `error.tsx` under `app/` | §4.3. The route's own unavailable state (T046) is the degradation path; if it is throwing instead, that state is missing |
| A delete never reaches the other device | The four task tables were subscribed **with** a `household_id` filter (DELETE payloads carry PKs only), or 022's guarded add was skipped | Subscriptions must be unfiltered; check `pg_publication_tables` (§4.5) |
| The Task Box is empty and re-running the seed does not fill it | `seed_task_box()` is idempotent by **emptiness** — deliberately, so a deleted template stays deleted (FR-381) | Call `select family.seed_task_box('<household_id>')` only on a genuinely empty box |
| Authed REST read of `tasks` returns `200` and `[]` for a non-member | **Expected** — RLS filtering; the policy suite asserts it | Nothing |
| Anonymous REST read returns `401`/`42501` | **Expected** — `anon` has no schema grant (SC-305) | Nothing |
| A **Scheduled Date or one-off** chore vanishes from today after four weeks | **Expected** — FR-357's 28-day bound; it remains on its own day | Nothing |
| A **Completed Date** chore vanishes from today after four weeks | **A bug.** Its open occurrence is exempt from the bound (R316): that occurrence is the cursor, so bounding it strands the chore for ever | The carry pass must skip the bound when `renew_after_amount is not null` |
| The board rolls at midnight while someone is looking at last Tuesday | It must not — a pinned day stays put; only a view showing **today** rolls (FR-315) | Check the `{today\|pinned}` anchor, not the clock hook |
| A skipped occurrence still counts toward the ring | The denominator subtracted completions but not skips | FR-305/FR-360: a skip leaves the **total**, not just the completed count |
