# Tasks: Family End-to-End Pass

**Feature**: `007-family-e2e` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)
**Harness contract**: [harness.md](./harness.md) — the state a run begins in, the fixtures a journey
is handed, and the seven rules every journey follows. Read it before writing any spec file.

**Format**: `- [ ] T### [P] [Story] Description with file path`. `[P]` marks a task that can run
beside its neighbours: a different file, no dependency on unfinished work.

**A note on "test-first" here**: this feature *is* tests, so the usual red-then-green rule applies to
its output, not its own construction — a journey is written, run, and must fail for the right reason
before the application is touched (Phase 10's fault injection is where that is proved deliberately).
Where a journey uncovers an application defect, that fix follows the shipped rule exactly: a failing
unit test first, then the change.

---

## Phase 1: Setup

- [ ] T001 Add `@playwright/test` and `@axe-core/playwright` to `devDependencies` in `package.json`, install, and fetch the browsers with `npx playwright install chromium webkit`; confirm nothing reached `dependencies` (FR-730)
- [ ] T002 Create `playwright.config.ts`: `testDir: "e2e"`, the `setup` project matching `*.setup.ts`, the four device projects of R705 (`wall` Chromium 1280×800; `tablet-landscape` and `tablet-portrait` WebKit; `phone` WebKit with touch) each depending on `setup` and carrying the saved storage state, `fullyParallel: false`, `workers: 1`, `baseURL` `http://127.0.0.1:3000`, retries 0 locally, and artefacts on failure only — trace, screenshot and video off by default (FR-702, FR-704, FR-708)
- [ ] T003 In `playwright.config.ts`, add the `webServer` block running `npm run dev:local` with `reuseExistingServer: true`, a 120 s budget and the URL to wait for (FR-707, R704)
- [ ] T004 In `playwright.config.ts`, restrict the three device projects to the `@responsive` grep so only the tagged journeys repeat there (FR-724, R705)
- [ ] T005 [P] Add the scripts to `package.json`: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report` (FR-702)
- [ ] T006 [P] Add `e2e/.auth/`, `playwright-report/`, `test-results/` and `blob-report/` to `.gitignore` — the saved session must never be committed (FR-705, VII)
- [ ] T007 [P] Exclude `e2e/**` from the Vitest `unit` project in `vitest.config.ts`; confirm the coverage `include` still names only `app`, `lib` and `proxy.ts` (FR-712)
- [ ] T008 [P] In `.fallowrc.json`, add `e2e/**/*` to the existing `tests` boundary zone and `playwright.config.ts` to the `config` zone — configuration, not suppression: no threshold moves and no baseline is bumped (FR-712, FR-729)
- [ ] T009 [P] Confirm `tsc --noEmit` and ESLint both cover `e2e/**` and pass on an empty folder; adjust `tsconfig.json` includes only if they do not
- [ ] T010 Document the new gate in `.claude/rules/quality-bars.md`: `npm run test:e2e` before a phase merge, beside the four per-commit gates, with the reason it is not in the pre-commit hook (FR-728, R713)

**Checkpoint**: `npm run test:e2e` runs, finds no journeys, and exits clean; the four existing gates still pass.

---

## Phase 2: Foundational — the harness (blocks every story)

- [ ] T011 [P] `e2e/helpers/stack.ts`: is the local stack up (a bounded probe, not a guess); reset it; seed it with `--local`. A stack that is down produces one clear line and stops the run (FR-703, Edge Cases)
- [ ] T012 [P] `e2e/helpers/names.ts`: `unique(base, testInfo)` → a name stable across runs and unique to the journey, so a row a journey creates can always be found and cleaned up (FR-706)
- [ ] T013 [P] `e2e/helpers/auth.ts`: sign in through the sign-in form, save the storage state to `e2e/.auth/household.json`, and a signed-out context factory for the door's journeys (FR-705, FR-713)
- [ ] T014 [P] `e2e/helpers/punch.ts`: punch in as a named Profile through the "who's here?" sheet and the PIN pad; punch out; set a Profile's PIN through Settings (FR-705, FR-714)
- [ ] T015 [P] `e2e/helpers/a11y.ts`: run the accessibility engine over the current page and assert no `serious` or `critical` violations, printing rule, impact and element for every finding including the ones that do not fail (FR-723, R709)
- [ ] T016 [P] `e2e/helpers/realtime.ts`: ask the local database whether any live subscription exists, using the `pg` client the policies suite already uses; answer only, never assert (FR-725, R710)
- [ ] T017 `e2e/fixtures.ts`: the extended `test` every journey imports — `punchedIn`, `asMember`, `signedOut`, `secondBrowser`, `unique`, `household`, `axe`, `probeLiveUpdates` — exactly the contract in harness.md §2
- [ ] T018 `e2e/setup/prepare.setup.ts`: check the stack, reset, seed, sign in and save the session, set Ana's and Cleo's PINs through Settings, warm every `/family` route, and leave nobody punched in (harness.md §1)

**Checkpoint**: the setup project runs green from a cold stack in under 90 seconds and leaves the state harness.md §1 describes.

---

## Phase 3: User Story 1 — one command puts the app under a browser (P1)

- [ ] T019 [US1] `e2e/specs/smoke.spec.ts`: every `/family` route opens for the signed-in household — calendar, tasks, rewards, meals, lists, settings — each asserted by its own heading or landmark, with no console error on any of them
- [ ] T020 [US1] Add to `smoke.spec.ts`: the shell's navigation reaches every tab, and a reload on each keeps you there (proves the server-rendered path, which no component test touches)
- [ ] T021 [US1] Prove the artefacts: make one journey fail on purpose, confirm the report carries the trace, the screenshot and the console output, then revert (FR-708, AS 1-2)
- [ ] T022 [US1] Prove repeatability: run the suite twice with no manual reset between, and run `smoke.spec.ts` alone; identical results both ways (SC-703, AS 1-4)

**Checkpoint**: US1 is independently valuable — a broken page, a bad import or a missing environment variable now fails a run.

---

## Phase 4: User Story 2 — the door and the punch-in gate (P2)

- [ ] T023 [P] [US2] `e2e/specs/door.spec.ts`: a signed-out browser asking for each `/family` page lands on sign-in; the household password admits and lands where it asked; a wrong password says so and admits nothing; signing out returns to the door (FR-713, AS 2-1, 2-2)
- [ ] T024 [P] [US2] `e2e/specs/punch-in.spec.ts`: with nobody punched in, a write on each of the five data tabs opens the "who's here?" sheet instead of writing (FR-714, AS 2-3)
- [ ] T025 [US2] Add to `punch-in.spec.ts`: the PIN pad admits Ana with `1234`; a wrong PIN is refused with a message and nobody is punched in; Punch out clears the shell and the next write asks again; a Profile with no PIN cannot be chosen and the sheet says why (FR-714, AS 2-4, 2-5, 2-6)
- [ ] T026 [US2] Tag the door and one punch-in journey `@responsive` and confirm both pass at the phone and both tablet sizes (FR-724)

**Checkpoint**: the gate every other journey leans on is proved from both sides.

---

## Phase 5: User Story 3 — the Week calendar (P3)

- [ ] T027 [US3] `e2e/specs/calendar.spec.ts` — create: from an empty slot, a timed event with a Profile, saved, drawn in that slot, still there after a reload; deleted at the end (FR-715, FR-721, AS 3-1)
- [ ] T028 [US3] Edit and delete: the created event's time and title changed and redrawn; deleted with its confirmation and absent after a reload (AS 3-2)
- [ ] T029 [US3] The all-day band: an all-day event created, drawn as a bar in the band and not as a block in the hour grid (AS 3-3)
- [ ] T030 [US3] The three scopes on an edit: a weekly event created, then edited at "this event", "this and future" and "all events", each asserting the occurrences before and after the changed one across two visible weeks (FR-715, SC-705, AS 3-4)
- [ ] T031 [US3] The three scopes on a delete: the same series, deleted at each scope, with the same before-and-after assertions (SC-705)
- [ ] T032 [US3] The drag: a timed event dragged to another time with real pointer steps, redrawn there and still there after a reload; a repeating event dragged asks the scope question before writing (FR-715, SC-706, AS 3-5)
- [ ] T033 [P] [US3] The filter sheet: a Profile hidden leaves this browser's grid and stays hidden after a reload, and the second browser is unaffected (AS 3-6)
- [ ] T034 [P] [US3] Paging: the arrows move by whole pages and Today returns to the week holding the household's today, read from the app rather than the machine (AS 3-7, FR-711)
- [ ] T035 [US3] Tag one calendar journey `@responsive`; at the phone the day columns page rather than clip (FR-724)

**Checkpoint**: the largest surface and the most fragile gesture are covered end to end.

---

## Phase 6: User Story 4 — Tasks and Rewards (P4)

- [ ] T036 [P] [US4] `e2e/specs/tasks.spec.ts` — tick a seeded chore: drawn as done and the Profile's balance up by its stars; un-ticked, both back; asserted after a reload (FR-716, AS 4-1)
- [ ] T037 [P] [US4] Up for Grabs claimed by the punched-in Profile and drawn in that Profile's column (AS 4-2)
- [ ] T038 [P] [US4] A task skipped, drawn as skipped, and the filter sheet's Skipped switch removing it from view on this browser (AS 4-3)
- [ ] T039 [US4] The board's press-and-hold reorder with real pointer steps, the new order asserted after a reload (FR-716, SC-706, AS 4-4)
- [ ] T040 [P] [US4] The Task Box: a template added to a Profile appears in that column and survives a reload (AS 4-5)
- [ ] T041 [P] [US4] `e2e/specs/rewards.spec.ts`: a manual award moves the balance and writes the ledger; a redemption moves both the other way; a redemption with too few stars is refused with a message and changes nothing (FR-717, AS 4-6)
- [ ] T042 [US4] Tag one tasks journey and one rewards journey `@responsive` (FR-724)

**Checkpoint**: the board chassis and the ledger's triggers are proved through a browser.

---

## Phase 7: User Story 5 — Lists (P5)

- [ ] T043 [P] [US5] `e2e/specs/lists.spec.ts` — an item added lands at the end of its list and survives a reload; checked, drawn as done (FR-718, AS 5-1, 5-2)
- [ ] T044 [P] [US5] Clear Completed asks first, then removes every checked item and leaves the unchecked ones, asserted after a reload (AS 5-2)
- [ ] T045 [US5] The card's press-and-hold reorder with real pointer steps, the new order asserted after a reload (FR-718, SC-706, AS 5-3)
- [ ] T046 [US5] Parents only: the Party list is on the board with Ana punched in and absent with Cleo punched in, and a member cannot reach it by any route the interface offers (FR-718, AS 5-4)
- [ ] T047 [US5] Tag the add-and-check journey `@responsive` (FR-724)

**Checkpoint**: the second press-and-hold and the app's one visibility promise are covered.

---

## Phase 8: User Story 6 — Meals (P6)

- [ ] T048 [P] [US6] `e2e/specs/meals.spec.ts` — plan into an empty slot from a saved recipe; the slot shows it after a reload; plan a second as a new entry and find that recipe in the pane (FR-719, AS 6-1)
- [ ] T049 [US6] The popover's four actions: Open Recipe reaches that recipe's detail; Edit opens the sheet and saves a note; Delete removes the meal after its confirmation; Add to List opens the push (FR-719, AS 6-2)
- [ ] T050 [US6] The three scopes on a repeating meal, on an edit and on a delete, asserted across two visible weeks before and after the changed occurrence (FR-719, SC-705, AS 6-3)
- [ ] T051 [P] [US6] The recipes pane: the mealtime filter and the search narrow the list; a removed recipe is absent from the pane and its planned meal still carries its name (FR-719, AS 6-4)
- [ ] T052 [US6] Both recipe deletions: "just the recipe" leaves the planned meals; "this recipe and planned meals" removes both — each asserted on the grid and after a reload (FR-719, AS 6-4)
- [ ] T053 [US6] Add to List: some lines unticked, a list chosen, exactly the ticked lines added, read back on the Lists tab (FR-719, AS 6-5)
- [ ] T054 [P] [US6] The calendar's meal tokens: each day's meals as tokens in its all-day band, a token opening the same popover as the grid, and Show Meals removing them on this browser only (FR-720, AS 6-6)
- [ ] T055 [US6] Tag one meals journey `@responsive`; at the phone the recipes pane is one panel with its way back (FR-724)

**Checkpoint**: every one of the six shipped phases now has browser-driven journeys.

---

## Phase 9: User Story 7 — two browsers, small screens, the shell (P7)

- [ ] T056 [US7] `e2e/specs/live.spec.ts`: the probe runs first; when the environment cannot carry live updates the whole file skips with the reason printed, never passing silently (FR-725, SC-707, AS 7-2)
- [ ] T057 [US7] Add to `live.spec.ts`: one write on each of Calendar, Tasks, Rewards, Lists and Meals seen by the second browser without a reload, inside the interval the shipped specs promise (FR-722, AS 7-1)
- [ ] T058 [P] [US7] `e2e/specs/shell.spec.ts`: the accessibility sweep over all six tabs, failing on serious or critical violations (FR-723, SC-708, AS 7-4)
- [ ] T059 [P] [US7] Add to `shell.spec.ts`: the manifest is served at its route with the name, icons, start URL and display mode an install needs (FR-726, AS 7-5)
- [ ] T060 [US7] Run the whole `@responsive` set at all three device projects; nothing clipped, every control reachable, the shell's navigation usable at each (FR-724, AS 7-3)

**Checkpoint**: every claim the phases made is now either proved or visibly skipped.

---

## Phase 10: Polish and the gate

- [ ] T061 Fault injection (SC-713): for each of the six tabs, one deliberate application fault that makes a write not persist; confirm the matching journey fails; revert. Record each in the run record (R714)
- [ ] T062 Fix what the journeys found: every application defect a journey proved — a missing accessible name, a write that does not persist, a serious accessibility violation — fixed with a failing unit test first, in the shipped style, and listed in the run record (FR-727)
- [ ] T063 [P] Review the suite against its own rules: no styling selectors, no testing-only markers where a name exists, no fixed delays, no address or key but the local stack's (SC-709, SC-710, SC-711)
- [ ] T064 [P] Write `specs/007-family-e2e/checklists/quickstart-run.md`: the gates, the run time, which journeys ran at which size, whether the live-update journeys ran or skipped and why, the fault-injection results, and every defect fixed
- [ ] T065 Gates: `npm run fallow:audit`, `npm test`, `npm run test:policies`, `npm run typecheck`, `npm run lint`, and `npm run test:e2e` — all green, nothing suppressed, no baseline bumped (FR-729, SC-712)
- [ ] T066 [P] Docs: plan Progress, CLAUDE.md's active-feature block, every task here ticked, and the e2e gate in `.claude/rules/quality-bars.md` confirmed accurate
- [ ] T067 `npm run graph`, then merge to `main` and push. No hosted step: this feature touches no migration and no deployed behaviour

---

## Dependencies

- **Setup (Phase 1)** blocks everything.
- **Foundational (Phase 2)** blocks every story. T017 needs T011–T016; T018 needs T017.
- **US1 (Phase 3)** after Foundational. It is the MVP: a run that catches a broken page.
- **US2 (Phase 4)** after US1 — every later journey uses `punchedIn`, which T014 and T025 prove.
- **US3–US6 (Phases 5–8)** after US2. They are independent of each other and could be written in any
  order or in parallel; the order given is by risk.
- **US7 (Phase 9)** after US3–US6, since it re-runs and observes them.
- **Polish (Phase 10)** last; T061 before T062, and T065 after both.

## Parallel opportunities

- Phase 1: T005 ∥ T006 ∥ T007 ∥ T008 ∥ T009 — five different files.
- Phase 2: T011 ∥ T012 ∥ T013 ∥ T014 ∥ T015 ∥ T016 — six helpers, one file each.
- Phases 5–8: the four tabs' spec files are independent; within a file, the tasks marked `[P]` touch
  different journeys.
- Phase 9: T058 ∥ T059 (one file, two independent journeys) beside T056–T057.

## Implementation strategy

**MVP is Phase 3.** Setup, the harness and the smoke journey already deliver the thing the repository
has never had: a run that opens every page of `/family` in a real browser against a real server and
fails when one of them is broken. Everything after it deepens that.

Then take the stories in order. Each phase leaves the suite green and adds journeys that stand on
their own, so the work can stop at any checkpoint without leaving the suite half-written.
