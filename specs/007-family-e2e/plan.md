# Implementation Plan: Family End-to-End Pass

**Branch**: `007-family-e2e` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/007-family-e2e/spec.md`

## Summary

Give `/family` the browser-driven pass it has never had: one command that resets and seeds the local
database, starts the app against it, signs in once, sets the PINs the seed never sets, and then walks
the journeys each of the six shipped phases has only ever had walked by hand — the door and the
punch-in gate, the calendar's create/edit/delete/drag and its three repeat scopes, the tasks board
and the stars it moves, the lists and their reorder, the meals grid with its recipes and its calendar
tokens — plus the four cross-cutting claims no test has ever checked: a change reaching a second
browser, the narrow layouts, installability, and the absence of serious accessibility violations.

The suite lives in one folder at the repository root, imports nothing from the application and is
imported by nothing. It changes application behaviour only where a journey proves something is broken
or unreachable, and each such fix arrives with its own unit test in the shipped style.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 26, ES modules
**Primary Dependencies**: `@playwright/test` and `@axe-core/playwright`, both devDependencies; the
already-present `pg` for the live-update probe. Nothing is added to what the application ships.
**Storage**: the local Supabase stack on this repository's ports, reset and seeded per run by the
existing `supabase db reset` and `npm run family:seed -- --local`
**Testing**: Playwright's runner for the journeys; the four existing gates (`fallow:audit`, `test`,
`typecheck`, `lint`) unchanged and still passing
**Target Platform**: Chromium at the wall size; WebKit at the tablet and phone sizes, which is what
the household's real devices run
**Project Type**: web application (Next 16 App Router) with a test harness beside it
**Performance Goals**: a full run under 10 minutes on a developer machine; the door and punch-in
journeys under 60 seconds (SC-702)
**Constraints**: the suite must be unable to reach the hosted project; no sleeps; no assertion on
styling where an accessible name exists; the four gates unchanged, no suppressions, no baseline bumps
**Scale/Scope**: six shipped phases, roughly forty journeys across nine spec files, four device
profiles, one prepared run

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How this plan satisfies it |
|---|---|---|
| **I. Sub-apps are self-contained** | PASS | The suite lands in one new root folder (`e2e/`) plus a config file, three npm scripts, one line in the unit project's exclusions and one pattern added to the quality tool's existing `tests` zone. No application file moves; nothing in `app/**` or `lib/**` imports the suite. |
| **II. Test-first for logic** | PASS | This feature *is* tests. Where a journey proves an application defect, the fix follows the shipped rule exactly: a failing unit test first, then the change (FR-727, task T045). |
| **III. Accessible and touch-first** | PASS | Every journey queries by role and accessible name (R707), so a control without a name fails the journey and gets a name rather than a workaround. One spec runs an accessibility engine over all six tabs and fails on serious or critical findings (R709). The phone project emulates touch, so press-and-hold and swipe are driven as touch, not as mouse. |
| **IV. Layered, boundary-enforced architecture** | PASS | `e2e/**` joins the existing `tests` zone, which may import anything and which nothing may import. The suite talks to the application only through a browser and to the database only through the seed script and a read-only probe. |
| **V. Quality gates** | PASS | The four gates run unchanged; nothing is suppressed, no threshold moves, no baseline is bumped (FR-729). The suite's own helpers are small and named, and the fixtures file is the one place that knows about preparation, so no journey grows a second copy of it. |
| **VI. Degrade gracefully** | PASS | A missing local stack is one line and a stop, not forty failures (Edge Cases). A live-update check the environment cannot run is a printed skip, never a silent pass (R710). A failure leaves a trace, a screenshot and the console rather than a bare assertion message. |
| **VII. Private by default** | PASS | The suite cannot reach the hosted project: it inherits the local stack's address from the same script the hand walks use, and no address, key or flag in it points anywhere else (SC-711). The signed-in state it saves is gitignored. It reads the database only to probe for live subscriptions. |
| **VIII. Fidelity is specified** | PASS | Every journey traces to a numbered requirement in a shipped spec, named in the journey's own description, so the suite reads as the evidence for those requirements rather than as a pile of clicks. |

**Result: PASS, no deviation claimed, no open question.**

### Re-check after Phase 1 design

- **Two browser engines rather than one.** Tested against §I and §V: it adds one line of
  configuration and one more browser download, and it removes a false claim — a Chromium-emulated
  iPad proves the layout and says nothing about the engine the family's iPads actually run (R702).
- **A single worker rather than parallel files.** Tested against §V's spirit: parallelism here would
  mean either a household per worker (changing application assumptions for a harness, which FR-727
  forbids) or a database per worker (far more machinery than the problem). One worker keeps the
  ten-minute budget and buys real isolation (R706).
- **The suite reads the database directly, once, for the live-update probe.** Tested against §IV: it
  is a read, in test code, in the `tests` zone, using the client the policies suite already uses; the
  alternative is a check that cannot tell "the app did not send it" from "this stack cannot carry it"
  (R710).

## Project Structure

### Documentation (this feature)

```text
specs/007-family-e2e/
├── spec.md              # 30 requirements, 7 journeys, 13 success criteria
├── plan.md              # this file
├── research.md          # Phase 0 — R701–R715
├── harness.md           # Phase 1 — the fixtures, the helpers and the data every journey may rely on
├── quickstart.md        # Phase 1 — how to run it, what it does, what to do when it fails
├── checklists/
│   └── requirements.md  # the spec's own quality checklist
└── tasks.md             # Phase 2 — /speckit.tasks
```

### Source Code (repository root)

```text
e2e/
├── fixtures.ts               # the extended `test` every spec imports: the punched-in page, the
│                             #   household clock, the unique-name helper, the second browser
├── helpers/
│   ├── stack.ts              # reset + seed + "is the local stack even up?"
│   ├── auth.ts               # sign in through the form; save and reuse the storage state
│   ├── punch.ts              # punch in as a Profile with a PIN; punch out
│   ├── a11y.ts               # the axe run and its serious/critical assertion
│   ├── realtime.ts           # the live-subscription probe behind FR-725's skip
│   └── names.ts              # unique, stable names for the data a journey owns
├── setup/
│   └── prepare.setup.ts      # the setup project: reset, seed, sign in, set PINs, warm the routes
└── specs/
    ├── door.spec.ts          # FR-713 — sign in, refuse, sign out, the redirect
    ├── punch-in.spec.ts      # FR-714 — the sheet, the PIN pad, the refusal, punch out
    ├── calendar.spec.ts      # FR-715 — create, edit, delete, all-day, the three scopes, the drag
    ├── tasks.spec.ts         # FR-716 — tick, claim, skip, reorder, the Task Box
    ├── rewards.spec.ts       # FR-717 — award, redeem, the ledger, the refusal
    ├── lists.spec.ts         # FR-718 — add, check, clear, reorder, Parents only
    ├── meals.spec.ts         # FR-719, FR-720 — plan, the popover, the scopes, recipes, the push,
    │                         #   the calendar's tokens and the Show Meals switch
    ├── live.spec.ts          # FR-722, FR-725 — two browsers, one household, five tabs
    └── shell.spec.ts         # FR-723, FR-726 — the accessibility sweep and the manifest

playwright.config.ts          # four projects, the setup dependency, the web server, the artefacts
```

Touched outside `e2e/`: `package.json` (three scripts, two devDependencies), `vitest.config.ts` (one
exclusion), `.fallowrc.json` (`e2e/**` into the existing `tests` zone, the config file into `config`),
`.gitignore` (the saved sign-in state and the runner's output), and
`.claude/rules/quality-bars.md` (the new gate, documented beside the four that already exist).

## Implementation phasing

| Phase | What lands | Why here |
|---|---|---|
| **Setup** | The dependencies, the config, the four projects, the scripts, the ignores, the gate documentation | Nothing can be written until a run exists |
| **Foundational** | `helpers/**` and `fixtures.ts`, the setup project, and the smoke journey that opens every tab | US1: the harness, proved by the one journey that needs no application knowledge |
| **US2** | `door.spec.ts`, `punch-in.spec.ts` | The gate every other journey leans on |
| **US3** | `calendar.spec.ts` | The largest surface and the most fragile gesture |
| **US4** | `tasks.spec.ts`, `rewards.spec.ts` | The board chassis and the ledger's triggers |
| **US5** | `lists.spec.ts` | The second press-and-hold, and the one visibility rule that is a privacy promise |
| **US6** | `meals.spec.ts` | The newest code, and the only surfaces mounted by two pages |
| **US7** | `live.spec.ts`, `shell.spec.ts`, the `@responsive` tags | Each needs the journeys above to exist first |
| **Polish** | The fault-injection proof, the run record, the gates, the docs, the merge | SC-713 is the one that is easy to skip, so it is a task |

## Risks

| Risk | Mitigation |
|---|---|
| The drag journeys are flaky because the grid measures itself | Drive with real pointer steps, wait for the block's box to settle before pressing, and assert after a reload rather than on the moved element |
| The development server's first compile blows a journey's timeout | The setup project warms every route once (R704) |
| A journey leaves data behind and the next run starts dirty | Every run resets first (R703); journeys own uniquely-named data (R706) |
| The live-update journeys are skipped on every machine and quietly stop meaning anything | The skip prints its reason and the run record must state whether they ran; SC-707 makes the skip visible rather than absent |
| The accessibility sweep finds pre-existing violations across six shipped tabs | Expected, and welcome: each is a defect with a fix and a unit test (FR-727). If the volume is large, the tasks split it per tab rather than lowering the bar |
| The suite becomes a second place where the app's copy is written down, and drifts | Journeys assert on accessible names, which are the app's own copy; a rename that breaks a journey is a rename worth noticing |

## Progress

- [x] Phase 0 — research complete ([research.md](./research.md): R701–R715, no open unknowns, two devDependencies)
- [x] Phase 1 — design complete: [harness.md](./harness.md) (the fixtures and helpers every journey may rely on), [quickstart.md](./quickstart.md)
- [x] Phase 2 — `/speckit.tasks` ([tasks.md](./tasks.md): 67 tasks, ten phases, the harness first)
- [x] Phase 3 — implementation complete (2026-09-06): 53 journeys at the wall and 12 on each device profile, seven defects found in shipped code and fixed, the fault-injection proof done — run record in [checklists/quickstart-run.md](./checklists/quickstart-run.md)
- [ ] Merge to `main` (T067). No hosted step: this feature touches no migration and no deployed behaviour
