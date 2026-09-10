# Tasks: The Meals Tab Navigates Like the Calendar

**Branch**: `013-meals-navigation` | **Date**: 2026-09-10
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

**Tests are not optional here.** Constitution II makes test-first non-negotiable for logic, and the
hard part of this phase — the window arithmetic and the midnight hold — is pure. Two of its
requirements (FR-1303 abutment, FR-1308 the midnight rule) **cannot be proved in a browser at all**, so
the unit tests are the only place they are checked.

---

## Phase 1: Setup

Nothing to install, no dependency, no migration. One task, and it is a measurement rather than a
scaffold — the phase's own criteria compare against it.

- [ ] T001 Record the pre-change baseline in `specs/013-meals-navigation/checklists/run-record.md`: on a production build against the local stack, the day columns drawn and the arrow labels at 390, 768, 1024 and 1280px, plus CLS at each. The 390/1280 figures already exist in `NOTES.md`; this fills in 768 and 1024 so SC-1305 has four numbers to hold against, not two.

---

## Phase 2: Foundational — the window, pure and first

**Blocking.** Every user story derives from this, and it is the part that can be got right cheaply.

- [ ] T002 Write `lib/family/__tests__/unit/meals-window.test.ts` FIRST, against the API `data-model.md` describes and no implementation: N days from an anchor; a step of exactly N; **abutment** (forward then back returns the same window, no day skipped, none repeated in one direction); continuity across a week boundary; continuity across a month and a year boundary; `columns` of 1; the range label at month and year boundaries.
- [ ] T003 Implement `lib/family/meals/window.ts` to pass T002 — `windowDatesOf(anchorDate, columns)`, `shiftWindow(anchorDate, columns, direction)`, `windowLabelOf(dates)`. Pure, framework-free, no React. Reuse `addDays` from `lib/family/calendar/dates.ts`; do NOT reimplement date arithmetic.
- [ ] T004 Rename `weekLabelOf` → `windowLabelOf` and move it from `lib/family/meals/week.ts` into `window.ts`. Its behaviour does not change — it already renders a day RANGE ("28 September – 4 October") rather than a week's name, so only the name was lying. Update `lib/family/__tests__/unit/meals-*.test.ts` references.
- [ ] T005 Delete `weekDatesOf` and `shiftWeek` from `lib/family/meals/week.ts`, and rewrite that file's header docstring, which currently states 006 Assumption 3 as settled fact ("a whole week at a time — a planning grid, **not** the calendar's rolling window anchored on today"). Replace it with what is now true and why it changed, citing this phase. Keep `dayWordsOf` and `dayHeaderOf` untouched.

**Checkpoint**: `npm test` green. The arithmetic is proved before any component sees it.

---

## Phase 3: User Story 1 — reaching tomorrow on a phone (P1)

**Goal**: the arrows move the window by the number of days on screen, so nothing is reachable only by a swipe.

**Independent test**: at 390px, walk a fortnight using only the arrows. Every date appears, none twice in one direction, and you end where you began.

- [ ] T006 [US1] Write `app/family/(app)/meals/components/__tests__/useMealWindow.test.ts` FIRST: the window is `columns` days from the anchor; `page(±1)` moves the anchor by `columns`; `today()` re-anchors to today; **the anchor is INITIALISED from today and then HELD** — advancing the mocked clock past midnight moves `todayDate` and leaves `anchorDate` alone (FR-1308, 006's rule, unprovable in a browser per 009's clock-helper finding); `columns` of 1 steps one day.
- [ ] T007 [US1] Implement `app/family/(app)/meals/components/useMealWindow.ts` to pass T006, taking `{ zone, startWeekOn, initialToday, columns }` and returning `{ dates, label, todayDate, isLiveWindow, page, today }`. `startWeekOn` stays in the signature only if something still needs it — if nothing does, leave it out rather than accept a dead argument.
- [ ] T008 [US1] Delete `app/family/(app)/meals/components/useMealWeek.ts`.
- [ ] T009 [US1] In `MealsBoard.tsx`: call `useMealWindow` with `layout.perRow` as `columns`; stop calling `useColumnPage`; render the window's own days. **Feed the pager a window whose length already equals `perRow` rather than mounting a shorter list** — research R1302 explains that Meals is CLS 0 because the visible slice is a transform, and this is the one place a careless change reintroduces a shift (FR-1310).
- [ ] T010 [US1] In `WeekNav.tsx`: the arrows state their distance — "Previous 3 days" / "Next 3 days" where three columns are drawn, "Previous week" / "Next week" where seven are (FR-1306). Derive the wording from the count, the way the Calendar's `WeekNav` does; do not duplicate its string-building if it can be shared through `lib`.
- [ ] T011 [US1] Rename `WeekNav`'s `isCurrentWeek` prop to `isLiveWindow` and rewrite its docstring, which says "a planning grid moves a week at a time" — the sentence this phase reverses.

**Checkpoint**: US1 is independently verifiable at 390px by hand, before any other story is touched.

---

## Phase 4: User Story 2 — the wall tablet keeps seven days (P1)

**Goal**: seven columns and seven-day steps at 1280px, unchanged in capacity.

**Independent test**: at 1280px, seven day columns; one tap forward advances seven days; the first column is today.

- [ ] T012 [P] [US2] Add to `useMealWindow.test.ts`: with `columns` of 7, `page(1)` advances seven days — the wall's step is the general rule's special case, not a branch in the code. If the implementation needs a branch for 7, the rule is wrong.
- [ ] T013 [US2] Verify by hand on a production build at 1280px: seven columns drawn, seven-day steps, today first. Record it in the run record. **Note what changed and what did not**: the distance is the same as the shipped behaviour; WHICH seven days is not (today onward rather than Sunday onward), which is the operator's decision in Clarifications.

---

## Phase 5: User Story 3 — today is where you start (P2)

**Goal**: opening the tab shows today at every width; Today returns to it.

**Independent test**: open fresh at 390, 768, 1024 and 1280px — today is the first column every time.

- [ ] T014 [P] [US3] Add to `useMealWindow.test.ts`: the initial anchor is `initialToday` at every `columns` value; `today()` returns to it after paging away; `isLiveWindow` is true exactly when the anchor is today (Assumption 5, decided by matching the Calendar's Today control).
- [ ] T015 [US3] Remove the `openOn` parameter from `app/family/(app)/components/ColumnPager.tsx` and its three tests in `__tests__/ColumnPager.test.tsx`. It was added on 2026-09-10 (`6a4ba13`) so the Meals grid opened on today's column, and a window anchored on today makes it unreachable. **Remove it rather than leave it** — an unused parameter on a hook three boards depend on survives for years.
- [ ] T016 [US3] Run the Tasks, Lists and Rewards journeys (`npx playwright test e2e/specs/tasks.spec.ts e2e/specs/lists.spec.ts e2e/specs/rewards.spec.ts`). **This is the point at which the phase could quietly break three other tabs** and no Meals journey would notice (SC-1307, FR-1309). `useColumnPage`'s one-column-per-swipe rule must be untouched, FR-396 intact.

---

## Phase 6: The browser pass

- [ ] T017 Add journeys to `e2e/specs/meals.spec.ts`: the arrows move the visible window and their labels state the distance (`@responsive`, so it runs at all four widths); several steps forward then back return to the starting window; today is the first column on open. Use the `showDay` helper already in `e2e/helpers/board.ts` where a day must be brought on screen. Remember `await locator.count()` does NOT retry — wait for the first thing, then count.
- [ ] T018 Run the four gates: `npm run fallow:audit`, `npm test`, `npm run typecheck`, `npm run lint`. No suppressions; removing `openOn` may surface findings, which is the gate working.
- [ ] T019 Run `npm run test:e2e` and **read the report, not the exit code**. If several journeys fail on one project, look at the FIRST in file order and re-run the rest without it — a failing journey is contagious through rows its cleanup never removed (012's finding). Do not edit `app/**` or `lib/**` while it runs; the web server is `next dev` with hot reload.

---

## Phase 7: Polish and the record

- [ ] T020 Measure CLS at 390, 768, 1024 and 1280px on a production build and record it against T001's baseline. **0 at every width or the phase is not done** (FR-1310, SC-1305).
- [ ] T021 Write `specs/013-meals-navigation/checklists/run-record.md` properly: the gates, the before/after numbers per width, what each criterion was verified by, and anything that could not be proved (the midnight roll in a browser — the overnight watch is the operator's, as it was for 009's countdown).
- [ ] T022 Update `CLAUDE.md`: last shipped, and strike the "in flight" block this phase added.
- [ ] T023 Update `specs/013-meals-navigation/NOTES.md` — it says "Status: not started" and carries a "Sketch of the work" section that the spec and plan have superseded. Point it at them rather than leaving two descriptions to drift apart.

---

## Dependencies

```text
T001 (baseline)
  └── Phase 2 (T002 → T003 → T004 → T005)        the pure window, blocking everything
        ├── Phase 3 US1 (T006 → T007 → T008 → T009 → T010 → T011)
        │     └── Phase 4 US2 (T012 [P], T013)    the same rule at seven columns
        │     └── Phase 5 US3 (T014 [P], T015 → T016)
        └── Phase 6 (T017 → T018 → T019)
              └── Phase 7 (T020 → T021 → T022 → T023)
```

**US2 and US3 depend on US1's implementation, not on each other.** T012 and T014 are both additions to
the same test file and are marked `[P]` because they touch independent cases, but they cannot land
before T007 exists.

## Parallel opportunities

Thin, deliberately. This is one tab's navigation, and most of it is a single chain — the window, then
the hook, then the board. The genuine parallelism:

- **T012 and T014** — independent test cases, same file, once `useMealWindow` exists.
- **T016's three journey files** — Tasks, Lists and Rewards run independently of one another.

Anything else claiming to be parallel here would be optimistic.

## MVP scope

**US1 alone is the MVP**, and it is the whole of the reported defect: the arrows move the window by the
days on screen. US2 is a regression guard on the wall tablet, US3 protects behaviour already shipped.
If this phase had to stop early, stopping after Phase 3 would leave the operator's complaint fixed.

## Format validation

All 23 tasks carry a checkbox, a sequential ID, a story label where the phase requires one (US phases
only — Setup, Foundational, Browser pass and Polish correctly have none), and a file path wherever a
task touches a file. T013, T016, T019 and T020 name commands and widths rather than paths because they
are verification steps, which is the honest form for them.
