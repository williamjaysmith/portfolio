# Tasks: Family Week Calendar

**Input**: Design documents from `/specs/002-family-week-calendar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md

**Tests**: Included — the constitution (§II) mandates test-first for pure logic (recurrence, zone math, geometry, the drag reducer, actions, policies), and SC-203/SC-205/SC-207 are database guarantees that require the policies tier against the local 553xx stack. Test tasks precede their implementation tasks and must fail first. Gesture feel and visual placement are verified by running the app — §II's own carve-out.

**Organization**: Grouped by user story so each is an independently verifiable increment. Setup and Foundational block everything; the four story phases then land in priority order (US1 → US2 → US3 → US4 — each writes into or gestures at what the previous one built).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different files, no dependency on an incomplete task
- **[US#]**: the user story from spec.md the task serves
- **blocked-on-operator**: needs the hosted project's access token, the Dashboard, or a physical device. Everything else proceeds against the local stack (quickstart §3).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the six migrations exactly per data-model.md, the seed extension, and the confirmation that nothing else is needed

- [ ] T001 Verify **zero new dependencies** (R214): `package.json` unchanged — `framer-motion` ^12 already installed for the pager, `@dnd-kit` stays colectivo-only and is imported by no calendar file, and Phase 1's npm scripts (`test:unit`, `test:policies`, `test:coverage`, `family:seed`) already cover this phase. `npm install` after pulling the branch is routine, not structural (quickstart §1)
- [ ] T002 Migration `supabase/migrations/010_events.sql` — `family.events` per data-model 010: two-shape time model (`event_time_shape` XOR by `all_day`, FR-222/223; `end_date` inclusive FR-225; `event_ends_after_start` FR-226), `summary` 1–120 trimmed (FR-220), `rrule` text CHECK `^FREQ=` + no `COUNT` (FR-231/232/233), device-zone `timezone` + `assert_event_timezone()` trigger (FR-224), reserved `countdown_enabled` (FR-228), `unique (id, household_id)`, the three partial window indexes, `touch` trigger, RLS `is_member()` read policy, `grant select` to authenticated + `all` to service_role, **no client write path** (FR-270/273)
- [ ] T003 Migration `supabase/migrations/011_event_categories.sql` — the ordered join per data-model 011: guarded `unique (id, household_id)` on `categories` (the one Phase 1 alteration), composite `(event_id|category_id, household_id)` FKs both `on delete cascade` (FR-273 structural; FR-274 — deleting a category never touches events), 0-based `position` (FR-227 draw order), `event_categories_category_idx` (serves the FR-274 count), read policy + grants
- [ ] T004 Migration `supabase/migrations/012_event_exceptions.sql` — skip/override rows per data-model 012: single `occurrence_date date` key (the occurrence's original household-local date, R204) + `unique (event_id, occurrence_date)`, `action in ('skip','override')`, exactly FR-239's four override fields with `exception_payload_shape` (skip carries nothing, override ≥ 1 field) and `exception_time_shape` CHECKs, **no category columns** (FR-287 made structural), composite FK cascade (FR-243), `touch` trigger, read policy + grants
- [ ] T005 Migration `supabase/migrations/013_household_timezone.sql` — `household_settings.timezone text not null default 'UTC'` + `assert_settings_timezone()` trigger (FR-284; the `'UTC'` backfill fails loudly by design, R203). **Nothing else** — no calendar-toggle columns (Assumption 16)
- [ ] T006 Migration `supabase/migrations/014_realtime_calendar.sql` — guarded publication adds for `events`, `event_categories`, `event_exceptions` (the 009 guard verbatim: NOTICE when the publication is absent, per-table existence checks, `puballtables` short-circuit), **default replica identity — `replica identity full` prohibited** (R209, constitution §VII), closing `notify pgrst, 'reload schema'` (FR-276, Assumption 39)
- [ ] T007 Migration `supabase/migrations/015_split_event_series.sql` — `family.split_event_series(p_household_id, p_event_id, p_actor, p_head_rrule, p_cut, p_tail_event, p_tail_category_ids)` per data-model 015: `for update` lock on the head (`P0002` when not a series in that household), truncate head → insert self-contained tail → tail links in draw order → re-home exceptions `occurrence_date >= p_cut`, one transaction (FR-241/242, R204); `SECURITY DEFINER`, `search_path = ''`, revoked from public/anon/authenticated, `grant execute` to service_role only; ends with a second `notify pgrst, 'reload schema'`. **No recurrence logic in SQL** — both rrule strings arrive pre-computed
- [ ] T008 Seed extension `scripts/family-seed.mjs` (quickstart §3) — (a) both modes: write `household_settings.timezone` from `FAMILY_SEED_TIMEZONE`, defaulting to the machine's resolved zone, idempotently (FR-284; the operator's value is `America/Chicago`, Assumption 41); (b) `--local` only: add the spec's example household to the fixture set — profiles **Ana** (parent), **Ben** (parent), **Cleo** (child), Label **"Bin day"** — then the US1 render matrix: a timed event, a three-day all-day event, a five-at-09:00 overlap cluster (FR-285/"+n more"), a Cleo+Ana two-profile event (SC-213), a "Bin day" label-only event, a no-categories event, a Fri 22:00→Sat 01:00 midnight-crosser (FR-217), the weekly "Piano" repeat (Cleo, Tue 17:00–17:45, UNTIL mid-December) carrying one saved this-occurrence override (SC-207's precondition), and an endless daily 02:30 series (the FR-235/236 DST probe). Hosted mode gains **only** the timezone write. Document `FAMILY_SEED_TIMEZONE` in `.env.example`

**Checkpoint**: migration files review clean against data-model.md; nothing applied yet — Phase 2 applies them behind failing tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the schema proven by the policies tier, the recurrence engine everything expands with, the one window read everything renders from

**⚠️ CRITICAL**: no user story work until this phase is complete.

### Schema, test-first (write red against the running 553xx stack — still on 001–009 until T012 resets it)

- [ ] T009 [P] Extend `lib/family/__tests__/policies/privileges.test.ts` with the Phase 2 delta asserted **exactly** (data-model privilege matrix): three tables — `anon` nothing / `authenticated` SELECT / `service_role` ALL; `split_event_series` EXECUTE for service_role only; the two timezone trigger functions callable by nobody; any new `anon` grant fails the suite
- [ ] T010 [P] New policies suite `lib/family/__tests__/policies/events-access.test.ts` — SC-203 **per path**: `events`, `event_categories`, `event_exceptions` each read as a member (rows), as an authenticated non-member (`[]`), and anonymously (`401`/`42501`); authenticated INSERT/UPDATE/DELETE on each refused (no client write path, FR-270); authenticated `rpc('split_event_series')` → `42501`
- [ ] T011 [P] New policies suite `lib/family/__tests__/policies/events-schema.test.ts` — the data-model invariants pinned: time-shape XOR and ends-after-start CHECKs, rrule CHECK (`RRULE:` prefix and `COUNT=` both refused), bad IANA zone → `22023` on both tables, exception payload/time-shape CHECKs, `unique (event_id, occurrence_date)`, cross-household link/exception unrepresentable (composite FK), category delete cascades links and leaves events (FR-274/SC-214), event delete cascades links + exceptions (FR-243 — no skip ghost)
- [ ] T012 Apply locally: `supabase db reset` (replays 001–015) → `npm run family:seed -- --local` (T008 fixtures land) → T009–T011 red→green → `psql` spot-checks: `pg_publication_tables` shows the three new tables, `split_event_series` grants match quickstart §4.2's query, replica identity still default. **Live `db push` + timezone seed stay blocked-on-operator** (T066)

### Recurrence library — tests FIRST (constitution §II; each pair: red, then green)

- [ ] T013 [P] Failing tests `lib/family/__tests__/unit/grammar.test.ts` — strict parse/emit round-trips of the closed grammar (fixed field order `FREQ;INTERVAL=1[;UNTIL][;WKST][;BYDAY|;BYMONTHDAY]`), `INTERVAL=1` only, `COUNT`/unknown parts refused, `WKST` on weekly only, UNTIL as plain date (all-day) vs household-zone end-of-day UTC instant (timed), the observed reference rule `FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU` surviving unchanged (FR-233), then implement `lib/family/recurrence/grammar.ts` — parser + the **sole** canonical emitter (R201)
- [ ] T014 [P] Failing tests `lib/family/__tests__/unit/zone.test.ts` — golden DST tables for `America/Chicago` (2026-03-08 spring-forward, 2026-11-01 fall-back), `Europe/London` (the US2-16 household-vs-device split), `Australia/Sydney`, `Australia/Lord_Howe` (30-minute shift), UTC no-op; `wallToInstant` gap → **first valid time on the date** (02:30 → 03:00 exactly, not 03:30 — FR-235), fold → **first instant** (FR-236); `instantToWall` round-trips; then implement `lib/family/recurrence/zone.ts` (`Intl.DateTimeFormat` offset math, cached per zone, the future Temporal swap point — R202)
- [ ] T015 Failing tests `lib/family/__tests__/unit/recurrence-expand.test.ts` — the **SC-208 year-long weekly sweep** (constant household wall time across both transitions, no occurrence missing or duplicated), UNTIL inclusivity by local-date comparison including a genuine Skylight `T235959Z` rule keeping its until-date evening occurrence (R201), monthly-31st skipping short months (and 29/30 tables), daily and multi-weekday walks, skips and overrides applied, duration in instant space (the fall-back run-through hour), then implement `lib/family/recurrence/expand.ts` (`expandSeries`, stateless date-walk — FR-234/235/236). Depends on T013, T014 — `expand.ts` composes the grammar parser with `zone.ts`'s `wallToInstant`/`instantToWall` (R202)
- [ ] T016 Failing tests `lib/family/__tests__/unit/dates.test.ts` — week anchoring on the household start-of-week (Sunday default, FR-203) in a named zone, plain-date maths, `sliceStarts` tiling tables (`[0,3,4]` at three columns, `[0,2]` at five, `[0]` at seven — last slice pulled back, FR-289), window derivation for the fetch, then implement `lib/family/calendar/dates.ts`. Depends on T014 — anchoring in a named zone imports `zone.ts`
- [ ] T017 Failing tests `lib/family/__tests__/unit/expand-window.test.ts` — `expandWindow(events, window, householdTz)`: series expanded with skips/overrides, one-off passthrough (timed, all-day, midnight-crosser), an occurrence whose override moved it **out** of the window dropped, an occurrence whose override lands **in** the window emitted though its original date is outside (the moved-occurrence guarantee, R206), then implement `lib/family/calendar/expand.ts` — the one non-bypassable expansion entry point; add the fallow `boundaries` rule in `.fallowrc.json` so `lib/family/recurrence/**` is reachable only through it (plus the actions' emitter import and tests). Depends on T013–T016

### Types, validation, the week read, realtime

- [ ] T018 [P] Extend `lib/family/types.ts` (`Event`, `Occurrence`, `Scope`, `RepeatChoice`, `EventTimes`, `EventInput`/`UpdateEventInput`/`DeleteEventInput` per contracts; `timezone` joins `HouseholdSettings`) and `lib/family/rows.ts` (`EVENT_COLUMNS`, `EVENT_CATEGORY_COLUMNS`, `EVENT_EXCEPTION_COLUMNS`, row types + mappers; `SETTINGS_COLUMNS` gains `timezone` — never `select('*')`)
- [ ] T019 Failing tests `lib/family/__tests__/unit/events-validation.test.ts` — Zod payloads per the contracts table: `RepeatChoice` (weekly ⇒ non-empty unique weekdays; `until` ≥ start compared as household-local dates; monthly's BYMONTHDAY derived, never sent; **no rrule string accepted from any client**), `EventTimes` coherence (`endsAt > startsAt` FR-226, `endDate >= startDate` FR-225), `summary` 1–120 trimmed / `description` ≤ 2000 / `location` ≤ 200, `timezone` in `Intl.supportedValuesOf('timeZone')`, `Scope` enum, `confirm: true` literal, `fieldErrors` per field (FR-262), then implement in `lib/family/validation.ts`. Depends on T018 — the schemas validate the `RepeatChoice`/`EventTimes`/`Scope`/`EventInput` types T018 declares in `lib/family/types.ts`
- [ ] T020 Failing policies tests `lib/family/__tests__/policies/week-read.test.ts` — against the fixture week: a series row whose start predates the window still arrives (`rrule not null` branch), one-offs windowed by real bounds (in arrives, out does not; all-day inclusive boundary), categories + exceptions embedded, non-member `[]`; then implement in `lib/family/queries.ts`: `familyKeys.week(hid, weekStartISO)` under the `["family"]` prefix, `fetchWeekEvents` (the three-branch OR with explicit `rrule.is.null` conjuncts so the partial indexes serve, explicit column lists, explicit `.eq('household_id', …)`), `useWeekEvents` (`staleTime` 30 s), `prefetchWeek` (±7 days on anchor settle) (R206/R207). Depends on T018
- [ ] T021 [P] Extend `app/family/(app)/components/useFamilyRealtime.ts` — `events`, `event_categories`, `event_exceptions` join the channel's `TABLES` list **without** the `household_id` server-side filter (the `filter` member goes optional; DELETE payloads carry PKs only — R209, Assumption 39); every notice stays a bare `invalidateQueries(familyKeys.all)`; no payload content ever rendered (FR-276)

**Checkpoint**: unit + policies suites green against the reset stack; the week query returns the fixture rows; the recurrence engine survives its golden tables. Story work can begin.

---

## Phase 3: User Story 1 — The family reads its week on the wall (P1) 🎯 MVP

**Goal**: the read-only week grid — correct placement, colours, now-line, live rollover — with nobody punched in.

**Independent Test**: seed one week (T008's matrix covers it), load `/family/calendar` at tablet-landscape with nobody punched in, check each block's placement against stored times by hand, leave it open across a minute boundary and midnight (spec US1 Independent Test; scenarios 1–15).

- [ ] T022 [P] [US1] Failing tests `lib/family/__tests__/unit/layout.test.ts` — midnight segmentation (Fri 22:00→Sat 01:00 = one event, a labelled segment per touched column, FR-217), overlap clustering + the FR-285 cap (three abreast ≥ 180 pt, two below) + "+n more" grouping per time band (never scroll as the answer to simultaneity), all-day lanes spanning multi-day bars with slice-edge clipping (FR-206/207), the minimum block height (title line + padding, never under 44 pt, times untouched — FR-218), then implement `lib/family/calendar/layout.ts`
- [ ] T023 [P] [US1] Failing tests `lib/family/__tests__/unit/week-geometry.test.ts` (rendering half) — `GridMetrics`, px↔minutes both directions at varying row heights and scroll offsets (FR-204: placement from times alone), then implement the base of `lib/family/week-geometry.ts` (the drag planners arrive with US3, T053)
- [ ] T024 [P] [US1] Failing tests `lib/family/__tests__/unit/use-week-anchor.test.ts` (fake timers) — `{today | pinned}`: derived midnight/week rollover while `today`, a pinned week untouched by midnight (FR-210's qualifier as a type-level property), Today resets to `today` + the slice containing today, then implement `app/family/(app)/calendar/components/useWeekAnchor.ts` over Phase 1's `useNow` in the household zone (R210 — no new timers)
- [ ] T025 [P] [US1] Failing tests extending `lib/family/__tests__/unit/colors.test.ts` — event ink chosen for ≥ 4.5:1 contrast against the block's own fill, taken from the leftmost solid segment on a striped block, across all 20 palette values (nine dark fills flip the ink — FR-214), then implement in `lib/family/colors.ts`
- [ ] T026 [P] [US1] Grid tokens in `app/family/tokens.css` — hour row height, gutter width, now-line (`#F66951`, 2 px, ~14 px dot — photo-estimated values commented as such, FR-208), today-circle (~44 pt `[ESTIMATED]`, FR-209), stripe geometry (≈45°, ≈40 pt, tagged — FR-212/Assumption 17), weekend shade + past-dim values (FR-215), neutral fill + border (FR-213)
- [ ] T027 [US1] `app/family/(app)/calendar/components/useGridGeometry.ts` — `ResizeObserver` → `GridMetrics`; column count from measurement: ≥ 1024 pt landscape → 7, else as many whole columns as fit, floored at 3 (FR-277/278); slice index clamped on rotation/anchor change. Depends on T023
- [ ] T028 [US1] `app/family/(app)/calendar/components/useWeekOccurrences.ts` — the memo chain fetch → `expandWindow` (once per mounted week) → visibility (a pass-through until T061) → layout, so a filter toggle never re-expands (R206). Depends on T017, T020, T022
- [ ] T029 [P] [US1] `WeekHeader.tsx` + `AllDayBand.tsx` in `app/family/(app)/calendar/components/` — day names with today's filled orange date circle (FR-209), the all-day band above the hours: one spanning bar per event (FR-206), band grows/scrolls so nothing is unreachable (FR-207), bars clipped at the slice edge keep their title on the visible portion (edge case)
- [ ] T030 [US1] `app/family/(app)/calendar/components/WeekGrid.tsx` + `DayColumn.tsx` — hour ruler, weekend column shading, past-event dimming at minute granularity (FR-215), vertical hour scroll (FR-280), per-day overflow scroll so all twelve of a full day are reachable (FR-216, SC-210)
- [ ] T031 [US1] `app/family/(app)/calendar/components/EventBlock.tsx` + `MoreOverflow.tsx` — single-colour, striped multi-category (title on a solid segment, FR-212), neutral no-category (FR-213), ink via T025 (FR-214), min height via T022 (FR-218), midnight segments as one event (FR-217), each block a focusable ≥ 44 pt button (FR-263; the details it opens land with T047); "+n more" as a tappable control listing the collapsed band (FR-285)
- [ ] T032 [P] [US1] `app/family/(app)/calendar/components/NowLine.tsx` — the 2 px orange bar + gutter dot in today's column only, drawn above blocks, repositioned each minute from the shared clock store, no reload (FR-208, US1-3/4)
- [ ] T033 [US1] `app/family/(app)/calendar/components/WeekView.tsx` orchestrator (anchor + slice state, geometry, wiring) + week navigation — previous/next arrows step a whole anchored week, Today returns to today's slice, rendered as the top-right pill cluster (FR-281, Contradiction 1) — and the server-seeded page: `app/family/(app)/calendar/page.tsx` replaces the Phase 1 placeholder, fetches the current week with the server client and passes `initialData` (R207)
- [ ] T034 [US1] FR-290 follow-scroll in `app/family/(app)/calendar/components/WeekView.tsx`'s scroll container — untouched grid holds the now line ~⅓ from the top; a manual hour-scroll pauses following until the day rollover or a Today activation resumes it (US1-15, Assumption 42). Depends on T033
- [ ] T035 [US1] US1 verification by hand + chrome-devtools MCP at 1180×820 — all fifteen acceptance scenarios against the fixture week (placement, one camping bar, side-by-side overlap, stripes, neutral, label colour, no PIN prompt anywhere, weekend/past treatment, "+2 more", follow-scroll), a minute boundary and a simulated midnight (SC-202, SC-210, SC-211 locally); screenshots recorded

**Checkpoint**: the wall calendar reads true — deployable MVP. Nothing can change it yet, which is the point.

---

## Phase 4: User Story 2 — Anyone who punches in can keep the week true (P2)

**Goal**: the whole write surface — create, edit, delete, the repeat model, the three scopes — server-enforced, punch-in gated.

**Independent Test**: create a one-off, an all-day and a weekly repeat through the form; edit and delete an occurrence at each scope comparing occurrence sets before/after; attempt each write with nobody punched in, including bypassing the interface (spec US2 Independent Test; scenarios 1–19).

### Action tests FIRST — written red before `lib/family/actions/events.ts` exists

- [ ] T036 [P] [US2] Failing policies suite `lib/family/__tests__/policies/event-actions.test.ts` — SC-205/FR-270/271/272: create/update/delete each `NO_ACTOR` with no actor and with a tampered cookie, nothing written; a punched-in **child** creates successfully (FR-272 — not parent-only); `created_by`/`updated_by` from the actor, never the payload (US2-2); scope on a one-off → `VALIDATION` (FR-238), scope missing on a repeat → `VALIDATION`, `categoryIds` or `repeat` in a `scope:'this'` patch → `VALIDATION` (FR-287/239), phantom/skipped `occurrenceDate` → `NOT_FOUND`, `confirm !== true` → `VALIDATION` (FR-258), id outside the household → `NOT_FOUND` never `FORBIDDEN`
- [ ] T037 [P] [US2] SC-207 check 1 of 6 — **edit at `this`** in new `lib/family/__tests__/policies/event-scopes.test.ts`: against the Piano fixture, an override upsert changes only 2026-10-06's title (US2-7), siblings untouched, merges onto the existing override, and the shape-switching time override (a band↔grid change on an occurrence already carrying a timed override) nulls the opposite pair in the same upsert so `exception_time_shape` holds (contracts step 4); occurrence sets compared before/after via the shared expander
- [ ] T038 [US2] SC-207 check 2 — **edit at `this_and_future`** (same file): head truncated to UNTIL = cut − 1, self-contained tail from the cut with the patch applied and exceptions ≥ cut re-homed keys-unchanged (US2-8), categories copied; on the **first** occurrence promoted to `all` — no split, no empty segment (FR-241); plus the **split-atomicity assertion**: a failing tail insert leaves the series whole (R204)
- [ ] T039 [US2] SC-207 check 3 — **edit at `all`** (same file): the `events` row updated in place, every occurrence past and future carries the change (US2-9); after a prior split the write reaches only the chosen segment (FR-242); a series-level time change does **not** orphan the date-keyed override (R204's reason for the key)
- [ ] T040 [US2] SC-207 check 4 — **delete at `this`** (same file): a `skip` row on the date, 13 October gone, 6 and 20 October intact (US2-10, FR-240); a skip **replaces** any override on that date, removing the per-occurrence edit with the occurrence
- [ ] T041 [US2] SC-207 check 5 — **delete at `this_and_future`** (same file): series ends immediately before the cut, every occurrence and every exception dated ≥ cut gone — the saved override with them (US2-19), earlier weeks untouched (FR-286); on the first occurrence the whole series goes; the two-statement order (truncate first) leaves only inert rows on a mid-failure
- [ ] T042 [US2] SC-207 check 6 — **delete at `all`** (same file): the `events` row gone, links and exceptions cascaded, no skip ghost survives (FR-243, edge case "an exception whose series is deleted")

### Actions, then the form surface

- [ ] T043 [US2] `createEvent` in `lib/family/actions/events.ts` — `requireActor()` (never `requireParent`), Zod first, rrule emitted **only** by T013's grammar emitter from the structured `RepeatChoice`, one `events` row + ordered `event_categories` links, attribution from the actor, `touchActor()` on success (contracts). T036 starts going green here
- [ ] T044 [US2] `updateEvent` — the contract's scope machinery in order: admin re-read → `NOT_FOUND` (FR-288's deleted-elsewhere), one-off in-place (repeat field may convert it to a series), `occurrenceDate` validated against the **same** `expandWindow` the browser renders from, `this` → override upsert with the shape-switch nulling, `this_and_future` → first-occurrence promotion or the `split_event_series` RPC, `all` → in-place on the segment; rule/start coherence re-derived by the emitter on splits and series-level time changes. T037–T039 green
- [ ] T045 [US2] `deleteEvent` — `confirm` gate, then the scope table: one-off row delete; `this` → skip upsert; `this_and_future` → truncate first, then delete exceptions ≥ cut (first occurrence: series delete); `all` → row delete, cascades do the rest. T040–T042 green; whole policies suite green
- [ ] T046 [P] [US2] `EventForm.tsx` + `useEventForm.ts` in `app/family/(app)/calendar/components/` — field order per FR-259; the all-day switch swaps time controls for date controls (US2-3); a timed **end carries its own date**, defaulting to the start's, validation comparing instants so Fri 22:00→Sat 01:00 saves and 09:00→08:00 refuses (FR-222/226, Assumption 43); repeat picker: Never / Every day / Every week on chosen weekdays / Every month on the date + optional end date, defaulting Never (FR-231/232, US2-6); one combined Profiles+Labels picker in draw order (FR-260/227); location and notes free text (FR-221); refusals land against the field and preserve the other entries (FR-262) — RTL test alongside
- [ ] T047 [P] [US2] `EventDetails.tsx` — tap a block (or a "+n more" row) → details: title, date/time (true times even when drawn at min height), repeat description, assigned Profiles and Labels by name + colour, location, notes (FR-256); Edit reached from here, never from a gesture on the block (FR-257)
- [ ] T048 [P] [US2] `ScopeDialog.tsx` — **one component** for edit, delete and drag with identical wording (FR-237/250); no scope question for a non-repeating event (FR-238); when categories are among the changed fields, "This event" is not offered (FR-287, US2-18); the "all after a split reaches this segment" wording (FR-242) — RTL wording test per R213
- [ ] T049 [P] [US2] `DeleteConfirm.tsx` — confirmation before every delete, final once confirmed, no undo or trash anywhere (FR-258, US2-11, SC-212)
- [ ] T050 [US2] Wire the write surface — the create control and empty-slot tap in `app/family/(app)/calendar/components/WeekView.tsx` + `DayColumn.tsx` (that slot, that 15-minute time, one-hour default — FR-254/255; no long-press anywhere), commits wired in `EventForm.tsx`/`useEventForm.ts`, every one through `withActor()` so punch-in arrives on demand ("Who's here?" before anything is written, US2-1; FR-270/275); FR-288 surfaced: offline → refused with the message and nothing queued, `NOT_FOUND` → "this event no longer exists" and the form closes without recreating; busy states, no optimistic cache writes (R208)
- [ ] T051 [US2] FR-274 amendment to the Phase 1 dialog — `fetchCategoryEventCount` in `lib/family/queries.ts` (RLS read, `count: 'exact', head: true`, served by `event_categories_category_idx`) + the affected-event count line in `app/family/(app)/components/settings/DeleteDialog.tsx` (Assumption 24 — work, not inheritance); component test updated (SC-214)
- [ ] T052 [US2] US2 verification by hand — the nineteen acceptance scenarios (repeat expansion US2-4/5, the three scopes, US2-16's device-zone check via DevTools sensors, validation messages), SC-201 stopwatch locally, SC-215 across two browser sessions

**Checkpoint**: the household can keep the week true; every write is attributed and gated; the six scope checks prove the scopes.

---

## Phase 5: User Story 3 — Move it with a finger (P3)

**Goal**: full drag — move, cross-day, band↔grid, edge-resize, 15-minute snap — with scope-then-punch-in on drop and every cancel path writing nothing.

**Independent Test**: move a block within a day and across days, resize by each edge, drag between band and grid, drag a repeat occurrence and see scope → punch-in in that order, release on the top bar and confirm nothing written (spec US3 Independent Test; scenarios 1–11).

- [ ] T053 [P] [US3] Failing tests extending `lib/family/__tests__/unit/week-geometry.test.ts` — the FR-246 snap table (09:07→09:00, 09:23→09:30), `slotFromPoint` across columns / all-day band / invalid targets (top bar, rail), `planMove` preserving duration on move and cross-day (FR-247, US3-3) and producing the FR-251 conversions (grid→band discards clock times; band→grid lands a one-hour block), `planResize` moving only the dragged edge with the one-step minimum and no inversion (US3-5/6), `autoScrollVelocity`, then implement the planners in `lib/family/week-geometry.ts`
- [ ] T054 [P] [US3] Failing tests `lib/family/__tests__/unit/drag-state.test.ts` — **every** reducer transition of `idle → armed → dragging → confirming → committing`: distance-slop arming (no timed hold, FR-253), every cancel path an explicit transition asserting **no commit intent** — invalid drop, dismissed scope, dismissed punch-in, wrong PIN, Escape, `SOURCE_GONE` (FR-249, US3-2/11); scope **before** punch-in on a repeat occurrence, never silent (FR-250, US3-9); no scope on one-offs (FR-238); keyboard `KEY_MOVE`/`KEY_RESIZE`/commit/cancel through the same transitions; then implement `lib/family/drag-state.ts` (R205)
- [ ] T055 [US3] `app/family/(app)/calendar/components/useEventDrag.ts` — Pointer Events with capture on the grid's stable **scroll container** (a refetch unmounting the source dispatches `SOURCE_GONE`), ~8 px slop, rAF-throttled moves, the vertical auto-scroll loop **plus the horizontal edge-hold that pages the anchored week mid-drag** (~40 px edge zone, ~600 ms hold — R211; the "occurrence dragged into the following week" edge case, verified in T059), `touch-action: none` on blocks / `pan-y` on the grid background (the recorded trade); targeted jsdom tests with injected `GridMetrics` (slop flip, capture, Escape revert, `aria-hidden` preview) per R213. Depends on T053, T054
- [ ] T056 [P] [US3] `DragPreviewBlock.tsx` — the snapped in-grid ghost (shared `EventBlock`, `aria-hidden`) with the source dimmed in place; the settle tween on commit/revert gated on `useReducedMotion()` (FR-252)
- [ ] T057 [US3] The drop pipeline in `app/family/(app)/calendar/components/useEventDrag.ts` + `WeekView.tsx` (where the dialogs and pending overlay mount) — release on a valid slot → `ScopeDialog` first (repeat only, T048's component verbatim) → `withActor()` second (punch-in only when nobody is punched in, re-asked after an idle punch-out mid-drag — FR-248/250/275) → `updateEvent` with the planned patch (**no drag action exists** — contracts); the pending overlay holds the block at its target, in flight never saved, until the post-invalidation refetch resolves (R208, SC-206); any dismissal releases immediately to cached truth (FR-249)
- [ ] T058 [US3] Keyboard alternative in `app/family/(app)/calendar/components/useEventDrag.ts` + `EventBlock.tsx` — Alt+Arrow move, Alt+Shift+Arrow resize, Enter commits into `confirming`, Esc cancels, all through the T054 reducer, with slot-semantic `aria-live` announcements over the always-available details→edit baseline (FR-263, R205)
- [ ] T059 [US3] US3 verification by hand — the eleven acceptance scenarios; gesture feel, auto-scroll ramp, edge-hold cross-week paging (~40 px / ~600 ms — legal, FR-253 bounds only drag *starts*), band drops, reduced-motion mode, punch-in expiry mid-drag, SC-206 timing. Pointer checks run locally via chrome-devtools; **the iPad feel pass is blocked-on-operator** (plan risk: iOS Safari `pointercancel`)

**Checkpoint**: the flagship gesture ships last and tested hardest, exactly as the spec ordered.

---

## Phase 6: User Story 4 — The same week in a pocket (P4)

**Goal**: the three-day slice of the same anchored week, and Labels joining the per-device filter.

**Independent Test**: load at 390×844 (three columns, no page scroll) and 1180×820 (seven); swipe each direction and confirm slices never straddle a week; hide a profile and a label, reload, confirm the hidden set survived on that device only (spec US4 Independent Test; scenarios 1–11).

- [ ] T060 [P] [US4] `SlicePager.tsx` — framer-motion pan on the grid container: axis lock (≈10 px, |dx| > |dy| — vertical stays with the hour scroll, FR-280), exactly one slice per swipe, left = later / right = earlier, last slice of a week → first slice of the next (FR-279/289, T016's `sliceStarts`); paging swipes start on empty grid, the hour ruler or the day-header band — **never on a block**, where movement is a drag (Assumption 44); the arrows and Today always page; reduced motion → instant jump (FR-252); wired into `WeekView.tsx`'s slice state (R211)
- [ ] T061 [P] [US4] Failing tests `lib/family/__tests__/unit/visibility.test.ts` — the FR-265 truth table: no categories → always visible; at least one visible category → visible (the Cleo+Ana event survives hiding Cleo); all carried categories hidden → hidden; then implement `lib/family/calendar/visibility.ts` (`isEventVisible`) and slot it into T028's memo chain as its own layer — display-only by construction (FR-267)
- [ ] T062 [US4] Labels section in `app/family/(app)/components/FilterSheet.tsx` — same 44 px checkbox-row pattern with a colour swatch in place of the avatar, same `setHidden`/`showAll` (Show all clears both kinds — FR-264, US4-9); **the storage layer does not change** — Phase 1's `useDeviceVisibility` already stores generic category ids per device with the in-memory fallback (FR-266, R212); RTL test for the section
- [ ] T063 [US4] Phone pass by hand — 390×844: three columns, today among them, no page-level horizontal scroll, every control ≥ 44×44 (SC-209); the Sunday-start slice walk Sun–Tue / Wed–Fri / **Thu–Sat** with cross-week continuation and Today's return (US4-1…6); create and drag parity with the tablet (US4-11); SC-213 across phone + tablet viewports

**Checkpoint**: all four stories independently verified; the tablet layout never compromised.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T064 Full quickstart run against the local stack — every "Verifying the guarantees" row that runs locally (SC-202, 204, 206, 208's spot-checks at the 2026-11-01 and 2027-03-14 weeks, 209 at three widths, 210, 211 via a clock jump, 212's undo audit, 213, 214, 215) plus the load-bearing FR spot-check table; fix any drift between docs and behaviour, updating `specs/002-family-week-calendar/quickstart.md` where reality won
- [ ] T065 [P] Gates + graph — `npm run test:coverage` then `npm run fallow:audit` (zero new findings; the new branchy lib is covered by construction), `npm test`, `npm run typecheck`, `npm run lint`, `npm run fallow:dupes` vs `main`, `npm run graph` rebuild; **no suppressions anywhere** (`.claude/rules/quality-bars.md`)
- [ ] T066 **[BLOCKED ON OPERATOR]** Hosted steps per quickstart §4 — `supabase db push` (010–015), the publication + split-RPC grant spot-checks in the SQL editor, `FAMILY_SEED_TIMEZONE=America/Chicago npm run family:seed -- --yes` (the un-seeded `'UTC'` renders everything hours off by design), then SC-203's anonymous probe, SC-201 once at the wall, SC-204 with the iPad and a phone, the T059 iPad feel pass, and the overnight SC-211 observation. **blocked-on-operator** (access token, wall tablet, phone)
- [ ] T067 Documentation sync — `CLAUDE.md` active-feature block and status, `specs/002-family-week-calendar/plan.md` Progress (Phase 3 tick), memory notes; final commit(s) on `002-family-week-calendar`

---

## Dependencies

```
Setup (T001–T008)            migrations sequential T002→T003→T004→T005→T006→T007; T008 after T005
  └─► Foundational (T009–T021)
        schema tests T009–T011 [P] before T012 applies (red→green);
        recurrence: T013 + T014 [P] → T015/T016 → T017; T018 → T019/T020; T021 [P] anytime
        ├─► US1 (T022–T035) 🎯 MVP        the grid must be correct before anything may change it
        │     └─► US2 (T036–T052)         writes into the grid US1 draws; ScopeDialog + form ship here
        │           └─► US3 (T053–T059)   a drag is an edit with a gesture — needs updateEvent + ScopeDialog
        │                 └─► US4 (T060–T063)  pager + filters need only US1, but US4-11's create/drag
        │                                      parity check needs US2 + US3, so it lands last as specced
Polish (T064–T067) last; T066 does not block anything local
```

Within Phase 4, the test tasks T036–T042 all precede the actions T043–T045 (T038–T042 share `event-scopes.test.ts`, so they are sequential among themselves after T037 opens the file). T048's `ScopeDialog` is a hard prerequisite of T057. T028's visibility slot is a pass-through until T061 fills it.

## Parallel opportunities

- **Foundational**: T009 + T010 + T011 (three policy files) while T013 + T014 (the grammar and zone TDD pairs) and T018 + T021 run — up to seven streams; T015/T016 follow T013/T014 and T019 follows T018, before T012/T017/T020 join them
- **US1**: T022 + T023 + T024 + T025 + T026 together (five files) before the component chain T027→T034
- **US2**: T036 + T037 together, then T038–T042 in file order while T046 + T047 + T048 + T049 (four components) proceed against mocked actions
- **US3**: T053 + T054 together; T056 alongside T055
- **US4**: T060 + T061 together
- **MVP scope**: Phases 1–3 only (T001–T035) — a correct, live, read-only wall calendar. Everything after is the household changing it.

## Format validation

67 tasks; every task has a checkbox + T-number and names the FR/SC it serves; every build task carries exact file path(s) (run/verify tasks name their commands and scenarios instead); `[P]` only where files are disjoint and nothing imported belongs to an incomplete task; story labels on all story-phase tasks and only there; test tasks precede their implementations in every pair; SC-207's six scope checks are individually named tasks (T037–T042). ✓
