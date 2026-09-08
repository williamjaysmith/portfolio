# Tasks: The Calendar's Preview Bar

**Feature**: `009-calendar-preview-bar` | **Branch**: `009-calendar-preview-bar`
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/server-actions.md](./contracts/server-actions.md)

Constitution §II is non-negotiable, so **every pure-logic task is a test first**. A task that says
"test" writes a failing test; the task after it makes it pass. The four gates run before every commit
and no finding is suppressed.

`[P]` = parallelisable (different files, no dependency on an incomplete task).

**State (2026-09-07): Phases 1–8 complete but for the hosted push (T058), which is the operator's.** Migration `039` is applied locally, the settings
column is typed, mapped and validated end to end, and the two pure modules — the one bounded
next-occurrence walk and days-remaining — are 27 tests green. US1 is live: an event can be marked a
countdown, the calendar draws it above the week, the number falls at the household's midnight, and
the event's own details carry the status under its title.

Two plan corrections were made while building and are recorded where they belong rather than fixed
quietly. **The bar brings its own read** — the plan said it needed none because "the events are
already in the view's cache", but the calendar's window is three to seven days and a countdown's
whole point is that its day is further off; `useCountdownEvents` is household-keyed and unwindowed
(research R901). And **a countdown withholds the "This event" scope** — it is a series property with
no per-occurrence storage, so `touchesSeriesFields` returns true for it exactly as it does for
Profiles and the repeat (contracts §2).

Two modules the plan did not name were added and are in the tree now: `countdowns/wording.ts`, so
the chip, the list and the details cannot word the same number differently, and `countdowns/target.ts`
composing the walk with the arithmetic.

US2 landed with two additions the plan did not name, both because the surfaces reaching outside the
displayed window needed them: `useCalendarEditor.openTarget(target)`, which opens details for an
event the caller already holds rather than looking one up in a window that cannot contain it, and
`useWeekAnchor.openAt(date)` (planned as T046, pulled forward because the countdown list needs it
too). The rotation's slot count is derived from the measured column count, since "when space is
limited" is a statement about the width the grid already measured.

US3 is the Show Countdowns field on the household preferences, and US4 the Tasks Progress row.
Building US4 turned up two fallow findings and both were fixed rather than suppressed: the
concatenate-then-expand step was duplicated between the board and the progress row, so it became
`useTaskDay` and both now share it; and `useWeekViewModel` went over the cognitive budget, so the
preview's three lines became `useWeekPreview`.

US5 is the search: `useEventSearch` over an escaped `ilike` with a row cap, `search.ts` shaping one
row per event, and a results panel that navigates rather than filtering (divergence 6). The
countdown list and the search share `occurrence-on-day.ts`, since both point at a day the displayed
window may not contain.

The four gates pass; the 11 lint errors in `app/colectivo/**` and `app/components/**` are the
pre-existing legacy ones this branch did not touch. **Phase 8 — the browser pass, the phone-width
check, the accessibility sweep and the hosted migration — is not started.**

**What makes this phase small**: `events.countdown_enabled` has been in the schema since
`010_events.sql` and is already carried across a series split; `lib/family/tasks/counters.ts` already
holds the progress rule and already names this surface as one of its readers; `MealRow` is the bar's
shape and `useCalendarMealSwitch` is the switches'. One migration, no new table, no new policy.

---

## Phase 1: Setup

- [x] T001 Add the `family-countdowns-core` zone to `.fallowrc.json` — patterns
  `lib/family/countdowns/**/*`, allowed `family-countdowns-core`, `family-calendar-core`,
  `family-recurrence`, `lib`; and add `lib/family/calendar/next-occurrence.ts` and
  `lib/family/calendar/search.ts` to `family-calendar-core`'s patterns (plan §Zones). **No threshold
  is touched** — this declares a boundary, it does not relax one

---

## Phase 2: Foundational — the column, the types, and the one shared walk

**Blocking**: US1, US2 and US3 all read a countdown's target date; US5 reads the same walk. Nothing
below starts until this phase is green.

### The migration

- [x] T002 Write `supabase/migrations/039_show_countdowns.sql` — `show_countdowns text not null
  default 'always'` on `family.household_settings` with a check constraint of exactly
  `always | three_months | one_month` (data-model §1)
- [x] T003 Run `supabase db reset` locally and confirm it applies clean on top of `001`–`038`

### The types, the row mapper and the validation

- [x] T004 [P] Extend `lib/family/types.ts` — `ShowCountdowns` union; `showCountdowns` on
  `HouseholdSettings` and its patch; `countdownEnabled?: boolean` on `EventInput` and the event patch
- [x] T005 [P] Extend `lib/family/rows.ts` — `SETTINGS_COLUMNS` and `toSettings` gain
  `show_countdowns`. `EVENT_COLUMNS` already selects `countdown_enabled` and needs nothing
- [x] T006 [P] Extend `lib/family/validation.ts` — the enum on the settings patch schema, and
  `countdownEnabled` as an optional boolean on the event input and patch schemas

### The one bounded walk — test first

- [x] T007 [P] Test `lib/family/__tests__/unit/next-occurrence.test.ts` — a one-off returns its own
  date; a weekly repeat returns the next matching day; a repeat whose `UNTIL` has passed returns its
  last occurrence and not a future one; a rule with no match inside the window returns null; the
  window's own boundary at day 400; and a household zone that is not UTC (R903)
- [x] T008 Implement `lib/family/calendar/next-occurrence.ts` — `nextOccurrenceOn(event, fromDate,
  zone)` over `ruleDatesIn`, with `LOOKAHEAD_DAYS = 400` as a named exported constant so the test
  binds the number rather than guessing it

### Days remaining — test first

- [x] T009 [P] Test `lib/family/__tests__/unit/countdown-days.test.ts` — tomorrow is 1; today is 0 and
  reads as **today**; yesterday is past; **both DST changes** in `America/Chicago` count whole days
  either side; a leap day; and a device in another timezone gets the household's number, not its own
  (FR-904, FR-905, SC-902, SC-910)
- [x] T010 Implement `lib/family/countdowns/days.ts` — `daysUntil(todayDate, targetDate)` over
  `diffDays`, and `countdownStateOf` returning `upcoming | today | past`

**Checkpoint**: `npm test`, `typecheck`, `lint`, `fallow:audit` all green. Nothing is visible yet.

---

## Phase 3: User Story 1 — The day the household is counting towards (P1)

**Goal**: an event can be marked a countdown, the calendar shows how many days away it is, and the
number falls at the household's midnight.

**Independent test**: mark an event a countdown, see the days on the calendar, cross a midnight with
a pinned clock, and see it leave the bar once its day is past.

### The write path

- [x] T011 Extend `lib/family/actions/events.ts` — `createEvent` writes `countdown_enabled` from the
  validated input, replacing the `// countdown_enabled stays at its default (FR-228)` comment;
  `updateEvent` includes it in its patch. `splitSeries` already passes `event.countdownEnabled` and
  is not touched (contracts §2, R910)
- [x] T012 [P] Test `lib/family/__tests__/policies/countdown-write.test.ts` — a punched-in member may
  set the flag; the flag survives a "this and future" split onto the tail; an anonymous writer is
  refused `42501` (SC-911)

### The form and the details

- [x] T013 [P] Extend `app/family/(app)/calendar/components/useEventForm.ts` — `countdownEnabled` in
  the draft, seeded from the event on edit and `false` on create
- [x] T014 Extend `app/family/(app)/calendar/components/EventForm.tsx` — a **Countdown** switch row in
  the shipped `SWITCH_ROW` idiom, disabled for a punched-in member with the reason visible rather
  than the control hidden (FR-901, US1-5)
- [x] T015 [P] Test `app/family/(app)/calendar/components/__tests__/EventForm.test.tsx` — the switch
  round-trips through the draft, and a member sees it disabled
- [x] T016 Extend `app/family/(app)/calendar/components/EventDetails.tsx` — the countdown status as a
  line **directly under the `<h2>` title**, above the first `DetailRow` (FR-906). A non-countdown
  event shows nothing there
- [x] T017 Fix `app/family/(app)/calendar/components/__tests__/EventDetails.test.tsx` — R915: split
  the shipped *"has no invitee or countdown row anywhere"* assertion in two. The **invitee half stays
  exactly as it is** (this app sends no mail, permanently); the countdown half is replaced by its
  opposite. Do not weaken the invitee assertion while you are in the file

### The bar's first form

- [x] T018 [P] Test `lib/family/__tests__/unit/countdown-inforce.test.ts` — with `always`, every
  upcoming countdown; with `three_months`, 92 days in and 93 out; with `one_month`, 31 in and 32 out;
  a past countdown out under all three; a non-countdown event never in (FR-903, SC-904)
- [x] T019 Implement `lib/family/countdowns/inforce.ts` — `countdownsInForce(events, todayDate, zone,
  showCountdowns)` composing `nextOccurrenceOn`, `daysUntil` and the three windows, returning the
  data-model's derived countdown sorted soonest-first
- [x] T020 Create `app/family/(app)/calendar/components/useCalendarPreview.ts` — the bar's one data
  path: the week's events, the household's setting and `useNow`'s `todayDate` in, the in-force
  countdowns out. No fetch of its own — the events are already in the view's cache
- [x] T021 Create `app/family/(app)/calendar/components/CountdownChips.tsx` — the chips, in
  Assumption 3's wording, at the FR-263 touch floor
- [x] T022 Create `app/family/(app)/calendar/components/PreviewBar.tsx` — `MealRow`'s three
  properties: one row on the day headers' template, **outside the drag layer**, returning `null` when
  it has nothing (R901, FR-910)
- [x] T023 Mount `PreviewBar` in `app/family/(app)/calendar/components/WeekView.tsx`, inside
  `DayHeaderBand` beside `MealRow`
- [x] T024 [P] Test `app/family/(app)/calendar/components/__tests__/PreviewBar.test.tsx` — a
  countdown draws; none draws no row at all and no wrapper element (SC-906)

**Checkpoint**: US1 works end to end and is independently demonstrable. Gates green.

---

## Phase 4: User Story 2 — More than one thing to look forward to (P2)

**Goal**: the bar carries more countdowns than fit, moves between them, and lists them all on a tap.

**Independent test**: three countdowns on a phone-width window; watch the first position change;
tap for the list; choose one and land on its event.

- [x] T025 [P] Test `lib/family/__tests__/unit/countdown-rotation.test.ts` — with more countdowns than
  slots, every one reaches the first position and the order is stable; with fewer than slots, the
  order never changes; a list that shrinks mid-rotation does not index past its end (FR-908, SC-903)
- [x] T026 Implement `lib/family/countdowns/rotation.ts` — `rotationAt(countdowns, slots, step)`, pure:
  a step number in, the visible slice out. No timer, no React
- [x] T027 Create `app/family/(app)/calendar/components/useCountdownSwitches.ts` — the two per-device
  switches on `createDeviceSwitches`, key `family:calendar-preview:v1`, defaults
  `{tasksProgress: false, pauseRotation: false}`, plus `showAll` (data-model §3, R907)
- [x] T028 Wire the rotation into `CountdownChips` — one interval advancing `step`, stopped by
  `pauseRotation` **and** by `prefers-reduced-motion`, and never started when everything already fits
- [x] T029 Create `app/family/(app)/calendar/components/CountdownList.tsx` — the full list, in the
  shipped `useModalDialog` idiom, every active countdown with its days (FR-909)
- [x] T030 Make the bar's countdown region a tap target that opens the list, and a list row open its
  event's details through the editor `WeekView` already holds
- [x] T031 Add **Pause countdowns** to `app/family/(app)/components/FilterSheet.tsx` under a new
  **Calendar** section, and join it to the sheet's one **Show all**
- [x] T032 [P] Test `app/family/(app)/calendar/components/__tests__/CountdownList.test.tsx` — every
  active countdown is listed once, and choosing one reports the right event

---

## Phase 5: User Story 3 — Only when it is close enough to matter (P3)

**Goal**: the household chooses how early countdowns appear, once, for all of them.

**Independent test**: set each of the three values and confirm which countdowns appear under each.

- [x] T033 Extend `app/family/(app)/components/settings/useSettingsForm.ts` — `showCountdowns` in the
  draft and the patch
- [x] T034 Add **Show Countdowns** to `HouseholdSection`'s `CHOICES` — three options, in the
  reference's own words: *Always* / *3 months prior to the event* / *1 month prior to the event*.
  Disabled for a punched-in member, like every other field there (FR-903, US3-4; divergence 5)
- [x] T035 [P] Test `app/family/(app)/components/__tests__/settings.test.tsx` — the three options are
  present and no fourth; a member finds the control disabled; a save sends the patch
- [x] T036 [P] Extend `lib/family/__tests__/policies/settings.test.ts` — a parent may write the new
  column, a member is refused, and an **anonymous reader is refused `42501` rather than handed an
  empty row** (SC-911, R911)

---

## Phase 6: User Story 4 — How the chores are going, above the week (P4)

**Goal**: each visible Profile's completed-of-total for today, above the events.

**Independent test**: turn the filter on, see the numbers, tick a chore on the Tasks tab, watch them
follow.

- [x] T037 Create `app/family/(app)/calendar/components/useTaskProgress.ts` — `useTasks`,
  `useTaskResolutions`, `useTaskCarryForward` and `useTaskCursors` (the board's own four, sharing its
  cache entries), `expandTaskDay` for **today**, then `columnCountersOf`. It imports `counters.ts`
  and defines no counting rule of its own (FR-912, R905, R906)
- [x] T038 Create `app/family/(app)/calendar/components/TasksProgressRow.tsx` — one entry per
  **visible** Profile in Assumption 4's format, avatar and name beside the pair. This component is
  **the `enabled`**: it is rendered only while the switch is on, so the calendar makes no task request
  when it is off (R905)
- [x] T039 Render `TasksProgressRow` inside `PreviewBar` above the countdown chips, and keep the
  bar's return-`null` rule true of the two together (FR-907, FR-910)
- [x] T040 Add **Tasks Progress** to `FilterSheet`'s Calendar section, off by default, joined to
  **Show all** (FR-911, FR-913)
- [x] T041 [P] Test `app/family/(app)/calendar/components/__tests__/TasksProgressRow.test.tsx` — the
  numbers match `counters.ts` for the same fixtures; a hidden Profile is absent; every Profile hidden
  draws nothing; a Profile with no chores today reads as none rather than complete (SC-907, SC-908)
- [x] T042 [P] Test that the switch off issues **no task query** — assert on the query client's cache,
  the shipped shape of `useTaskBox`'s laziness proof

---

## Phase 7: User Story 5 — Finding the event somebody half-remembers (P5)

**Goal**: type part of a title, get the event, land on its day.

**Independent test**: search a weekly event's name — one result, not fifty — choose it, and the
calendar moves to the day it next falls on with its details open.

- [x] T043 Extend `lib/family/queries.ts` — `fetchEventSearch(supabase, householdId, term)`: the
  signed-in client, `ilike` on `summary` with `%`, `_` and `\` escaped, a hard row cap, ordered by
  start; and `useEventSearch` keyed by household and the normalised term, `enabled` above a minimum
  length (contracts §3, R908)
- [x] T044 [P] Test `lib/family/__tests__/unit/event-search.test.ts` — result shaping: one row per
  series and never one per occurrence; the date shown is the next occurrence on or after today; a
  repeat entirely in the past shows its last; ordering is soonest-first; an empty term yields nothing
  (FR-918, SC-909)
- [x] T045 Implement `lib/family/calendar/search.ts` — the shaping above, over `nextOccurrenceOn`
- [x] T046 Add `openAt(date)` to `app/family/(app)/calendar/components/useWeekAnchor.ts` — one
  `setAnchor({kind: "pinned", date})`. `?on=` and its read-once rule are **not** touched (R909).
  **Done early, in Phase 4**: the countdown list needs the same jump, so it arrived with T030
- [x] T047 [P] Test `useWeekAnchor.openAt` — it pins, `goToToday` still returns, and paging from a
  pinned day still steps by the column count
- [x] T048 Create `app/family/(app)/calendar/components/EventSearch.tsx` — `TaskSearch`'s pill in
  `WeekNav`'s row, with a results list rather than an in-place filter (divergence 6, Assumption 9).
  A search matching nothing says so in words (FR-917)
- [x] T049 Wire it in `WeekView`: choosing a result calls `openAt` and opens the details; closing the
  search leaves the calendar exactly where it was (FR-916, US5-5)
- [x] T050 [P] Test `app/family/(app)/calendar/components/__tests__/EventSearch.test.tsx` — typing
  reports the term; no matches says so; choosing a result reports the date and the event; clearing
  restores nothing but the empty box
- [x] T051 [P] Extend `lib/family/__tests__/policies/events-schema.test.ts` — the search read under an
  anonymous client is refused `42501` (SC-911)

---

## Phase 8: Polish, gates and the browser pass

- [x] T052 The phone-width layout: the bar with three countdowns **and** three Profiles at the
  smallest iPhone width — nothing spills, the navigation stays reachable, and the row scrolls inside
  itself rather than the page scrolling sideways. This is the surface the operator has already
  reported spilling; it is a task, not an afterthought
- [x] T053 Accessibility: the bar is a labelled region, the rotation is not announced on every step,
  the tap target meets the FR-263 floor, and the search's results are reachable and announced
- [x] T054 Write `e2e/specs/preview-bar.spec.ts` — mark a countdown and see it; pin the clock across a
  household midnight and watch the number fall; the three Show Countdowns values at a boundary either
  side; the bar's tap and the full list; Tasks Progress on, matching the Tasks tab, and a hidden
  Profile leaving it; search → choose → land on the day (R912)
- [x] T055 Run `npm run test:e2e` in full and **read the report**, not only the exit code. A
  live-update journey the environment cannot run is a printed skip, not a pass
- [x] T056 Record the run in `specs/009-calendar-preview-bar/checklists/quickstart-run.md` — what was
  walked, what was skipped and why, and anything the environment made unrunnable
- [x] T057 All four gates green with **no suppressions**: `fallow:audit`, `test`, `typecheck`, `lint`,
  plus `test:policies`. If CRAP flags a new function, cover it — the threshold does not move
- [ ] T058 **`supabase db push`** for `039_show_countdowns.sql` to the household's hosted project,
  with the operator's explicit approval, **before** the merge (R913). The e2e suite never reaches it
- [x] T059 Update `CLAUDE.md`'s SPECKIT block to say the phase is complete, and note what `010` (the
  home screen) inherits from it

---

## Dependencies

```text
Phase 1 (zone)
   └── Phase 2 (migration, types, next-occurrence, days)   ← blocks everything
          ├── Phase 3  US1  countdown end to end            ← the MVP
          │      └── Phase 4  US2  rotation, list, pause
          ├── Phase 5  US3  the household setting           (needs T019's inforce, from Phase 3)
          ├── Phase 6  US4  Tasks Progress                  (needs T022's PreviewBar, from Phase 3)
          └── Phase 7  US5  search                          (needs T008 only)
                 └── Phase 8  polish, e2e, hosted push, gates
```

Phase 7 depends on Phase 2 alone, so the search can be built in parallel with Phases 4–6 once the
foundation is green. Phases 5 and 6 are independent of each other.

## Parallel opportunities

- **T004, T005, T006** — three different files, no shared symbol until T007.
- **T007, T009** — two pure tests over two modules that do not import each other.
- **T012, T015** — a policies test and a component test.
- **Phases 5, 6 and 7** — three separate surfaces once Phase 3 has landed the bar.
- Every `[P]` test task runs beside its siblings; no two of them touch one file.

## Suggested MVP

**Phases 1–3 alone.** That is FR-901, FR-902, FR-904, FR-905, FR-906 and FR-910 — a household can
mark a day and the calendar counts down to it, which is the whole of what the phase exists for and
the debt 002 FR-228 named. Everything after it makes that liveable rather than possible.

## Task count

59 tasks: 1 setup, 9 foundational, 14 for US1, 8 for US2, 4 for US3, 6 for US4, 9 for US5, 8 polish.
Test-first tasks: 15 pure-logic and component tests written before their implementation, plus T017's
correction of a shipped assertion and T054's browser journeys.
