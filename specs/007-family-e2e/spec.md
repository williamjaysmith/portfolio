# Feature Specification: Family End-to-End Pass

**Feature Branch**: `007-family-e2e`
**Created**: 2026-09-06
**Status**: Draft
**Input**: A browser-driven end-to-end pass over `/family`, the layer the six shipped phases have
never had. Everything under `/family` is proved today by unit and component tests in a simulated
DOM, and by database-policy tests against the local stack; nothing drives a real browser against a
real running app. The journeys only a browser can prove — a write travelling from a tap through a
server action into the database and back onto the screen, the punch-in gate, press-and-hold and
drag, the per-device switches, two devices watching each other, the installable shell — have been
checked by hand at each phase gate and never again afterwards. This feature makes that pass
repeatable and lands **before** Phase 7 (notifications, home, offline, search), so Phase 7 has a
safety net to build on. Requested by the operator when Phase 6 (Meals) shipped on 2026-09-06.

**Authoritative sources**: the six shipped specs (`specs/001-family-foundation` …
`specs/006-family-meals`) and their run records under `checklists/`, which between them list every
journey a human has walked at a phase gate and every guarantee (`SC-…`) claimed for it; the
constitution (`.specify/memory/constitution.md`), whose §II makes test-first non-negotiable for
logic and §III makes accessible names and touch targets a requirement rather than a preference;
`.claude/rules/quality-bars.md` (the four gates, no suppressions) and `.claude/rules/architecture.md`
(layer boundaries); the seed script `scripts/family-seed.mjs`, whose `--local` fixtures are the
data every journey below is written against; and the local-stack notes carried forward from Phase 5
(ports, the account, the PIN-after-reset step, and the realtime gap seen on the local stack).

## Clarifications

### Session 2026-09-06

Answered by the author under the operator's standing delegation ("research first, then answer them
yourself"), because each has a defensible default and none changes what the suite is for.

- Q: Where does this suite run, given the repository has no continuous-integration workflows at all
  today? → A: **A local gate, run before a phase is merged, and before this feature's own merge.**
  It is not added to the per-commit hook (it is minutes, not seconds) and it does not introduce the
  repository's first CI workflow, which needs its own decisions about hosting a database and holding
  secrets. FR-728, Assumption 4.
- Q: Every spec at every viewport, or a chosen subset? → A: **The wall tablet is the default for
  every spec; a named subset also runs at the phone and at the tablet in portrait** — the journeys
  whose layout genuinely differs there. FR-704, Assumption 5.
- Q: What should the two-device journeys do when the environment cannot deliver live updates, as the
  local stack could not during Phases 5 and 6? → A: **Probe first and skip with the reason printed,
  never pass silently.** A skipped live-update journey is a visible amber, not a green. FR-725,
  Assumption 6.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — One command puts the app under a browser (Priority: P1)

A developer with the repository checked out runs a single command. The local database is put into a
known state, the app is started against it, a browser signs in once with the household account, and
every tab of `/family` is opened and found to have rendered. When it finishes they are told what
passed, and on a failure they are handed the trace, the screenshot and the console output for the
step that failed.

**Why this priority**: nothing else in this feature can exist without it, and on its own it already
catches the class of failure that unit tests cannot see at all — a page that throws on the server, a
missing environment variable, a bad import, a route that redirects to sign-in when it should not.

**Independent Test**: run the command on a clean checkout with the local stack up; every tab under
`/family` is confirmed to render for a signed-in household member, and a deliberately broken page
fails the run with a usable artefact.

**Acceptance Scenarios**:

1. **Given** a checkout and a running local stack, **When** the developer runs the suite's command,
   **Then** the database is reset and seeded, the app is started, and the run reports each journey's
   result without the developer preparing anything else.
2. **Given** a run that has just finished, **When** the developer looks at what it produced, **Then**
   a failure carries a trace, a screenshot at the moment of failure and the browser console for that
   journey, and a pass carries no such noise.
3. **Given** the suite has signed in once, **When** the remaining journeys run, **Then** none of them
   pays for signing in again, and every one of them starts from identical data.
4. **Given** a journey that changes data, **When** the whole suite is run twice in a row without a
   manual reset in between, **Then** the second run behaves exactly as the first.
5. **Given** the app is not running when the suite starts, **When** the developer runs the command,
   **Then** the suite starts the app itself and waits for it, rather than failing on a refused
   connection.

---

### User Story 2 — The door and the punch-in gate (Priority: P2)

Nobody reaches `/family` without the household password, and nobody writes anything without punching
in as a Profile. Both are proved in a browser: signing in, being turned away, signing out, punching
in with a PIN, being refused a wrong one, punching out, and a write attempted with nobody punched in.

**Why this priority**: it is the gate every other journey depends on, and the only part of the app
where being wrong is a privacy failure rather than an inconvenience.

**Independent Test**: drive the sign-in page and the punch-in sheet with correct and incorrect
credentials, and attempt one write from an un-punched session; each is refused or admitted as
specified.

**Acceptance Scenarios**:

1. **Given** a signed-out browser, **When** it opens any `/family` page, **Then** it lands on the
   sign-in page rather than the page it asked for.
2. **Given** the sign-in page, **When** the household password is entered, **Then** the household's
   pages open; **When** a wrong password is entered, **Then** it says so and nothing opens.
3. **Given** a signed-in browser with nobody punched in, **When** a write is attempted anywhere,
   **Then** the "who's here?" sheet opens instead of the write happening.
4. **Given** the punch-in sheet, **When** a Profile with a PIN is chosen and the PIN entered
   correctly, **Then** that Profile is shown as punched in; **When** the PIN is wrong, **Then** it
   says so and nobody is punched in.
5. **Given** a punched-in Profile, **When** Punch out is used, **Then** the shell shows nobody
   punched in and the next write asks again.
6. **Given** a Profile with no PIN set, **When** the punch-in sheet is open, **Then** that Profile
   cannot be chosen, and the sheet says why.

---

### User Story 3 — The Week calendar's journeys (Priority: P3)

The family's week: an event created, edited and deleted; an all-day event in its band; a repeating
event edited and deleted at each of the three scopes; an event dragged to a new time; the filter
sheet hiding a Profile on this device only; paging the week and returning to today.

**Why this priority**: the calendar is the largest surface in the app and holds its most fragile
interaction — a pointer drag that converts a screen position into a time and then asks a question
about a series. None of that survives in a simulated DOM.

**Independent Test**: drive each journey against the seeded example week and read the result back on
the grid; the drag is performed with real pointer events at the wall viewport.

**Acceptance Scenarios**:

1. **Given** the week grid, **When** an event is created from an empty slot and saved, **Then** it is
   drawn in that slot, and it survives a reload.
2. **Given** an existing event, **When** it is edited and saved, **Then** the grid shows the change;
   **When** it is deleted and confirmed, **Then** it leaves the grid and does not come back on a
   reload.
3. **Given** an all-day event, **When** the week is drawn, **Then** it is a bar in the all-day band
   above the hour grid, not a block inside it.
4. **Given** a repeating event, **When** it is edited at "this event", **Then** only that occurrence
   changes; at "this and future", **Then** that one and the later ones change and the earlier ones do
   not; at "all events", **Then** every occurrence changes.
5. **Given** an event drawn at a time, **When** it is dragged to another time and dropped, **Then**
   it is drawn at the new time and the change survives a reload; **When** the dragged event repeats,
   **Then** the scope question is asked before anything is written.
6. **Given** the filter sheet, **When** a Profile is hidden, **Then** that Profile's events leave
   this browser's grid, and the choice survives a reload.
7. **Given** any week, **When** the paging controls and Today are used, **Then** the visible dates
   move by whole pages and Today returns to the week containing the household's today.

---

### User Story 4 — Tasks and Rewards (Priority: P4)

A chore ticked and un-ticked; a task claimed from Up for Grabs; a task skipped; the board's
press-and-hold reorder; the Task Box; then the stars those tasks earn — a manual award, a
redemption, the ledger reading back, and a redemption refused for want of stars.

**Why this priority**: these two tabs share the board chassis and the star ledger written by database
triggers, so one journey through each proves both the gesture layer and the trigger layer that unit
tests can only prove separately.

**Independent Test**: drive the seeded task fixtures and the seeded star economy, reading each result
from the board and from the ledger.

**Acceptance Scenarios**:

1. **Given** a chore in a Profile's column, **When** it is ticked, **Then** it is drawn as done and
   the Profile's star balance rises by the chore's stars; **When** it is un-ticked, **Then** both go
   back.
2. **Given** a task in Up for Grabs, **When** a punched-in Profile claims it, **Then** it moves into
   that Profile's column.
3. **Given** a task that can be skipped, **When** it is skipped, **Then** it is drawn as skipped and
   the filter sheet's Skipped switch controls whether it is visible at all.
4. **Given** two tasks in a column, **When** one is pressed and held and dragged above the other,
   **Then** the board draws the new order and it survives a reload.
5. **Given** the Task Box, **When** a template is added to a Profile, **Then** it appears in that
   Profile's column.
6. **Given** a Profile with stars, **When** a reward is redeemed, **Then** the balance falls by its
   cost and the ledger shows the redemption; **When** the balance is too small, **Then** the
   redemption is refused with a message and nothing changes.

---

### User Story 5 — Lists (Priority: P5)

An item added to a list, checked off, and cleared with the rest of the completed ones; a list's items
reordered by press-and-hold; a Parents only list present for a parent and absent for a member.

**Why this priority**: the Lists tab's reorder is the second press-and-hold surface, and Parents only
is the app's one visibility rule that depends on who is punched in — a rule that is a privacy
promise, not a convenience.

**Independent Test**: drive the seeded lists as a parent and again as a member, reading each result
from the card.

**Acceptance Scenarios**:

1. **Given** a list, **When** an item is added, **Then** it appears at the end of the list and
   survives a reload.
2. **Given** an item, **When** it is checked, **Then** it is drawn as done; **When** Clear Completed
   is used and confirmed, **Then** every checked item leaves the list and the unchecked ones stay.
3. **Given** two items, **When** one is pressed and held and dragged above the other, **Then** the
   card draws the new order and it survives a reload.
4. **Given** a Parents only list, **When** a parent is punched in, **Then** the list is on the board;
   **When** a member is punched in instead, **Then** it is not.

---

### User Story 6 — Meals (Priority: P6)

A meal planned from a saved recipe and again as a new entry; the meal popover's four actions; a
repeating meal edited and deleted at each scope; the recipes pane filtered and searched; a recipe
deleted both ways; a recipe's lines pushed onto a chosen list; the meal tokens on the calendar and
the switch that hides them.

**Why this priority**: the newest code in the app, shipped the same day this feature was asked for,
and the only tab whose surfaces are mounted by two different pages.

**Independent Test**: drive the seeded mealtimes, recipes and meals, reading results from the grid,
from the recipes pane, from the chosen list and from the calendar.

**Acceptance Scenarios**:

1. **Given** an empty slot, **When** a meal is planned into it from a saved recipe, **Then** the slot
   shows it and it survives a reload; **When** planned as a new entry instead, **Then** the slot
   shows it and the recipes pane has gained that recipe.
2. **Given** a planned meal, **When** its popover is opened, **Then** Open Recipe shows that recipe's
   detail, Edit opens the sheet, Delete removes the meal after confirming, and Add to List opens the
   push.
3. **Given** a repeating meal, **When** it is edited or deleted at each of the three scopes, **Then**
   the grid over several weeks shows exactly the occurrences that scope should leave.
4. **Given** the recipes pane, **When** a mealtime filter and a search word are used, **Then** only
   the matching recipes are listed; **When** a recipe is deleted "just the recipe", **Then** it
   leaves the pane and the meals planned with it keep their names; **When** deleted with its meals,
   **Then** both are gone.
5. **Given** a recipe with ingredients and instructions, **When** some lines are unticked and a list
   chosen, **Then** exactly the ticked lines are added to that list, and the Lists tab shows them.
6. **Given** meals planned in the visible week, **When** the calendar is opened, **Then** each day's
   meals are tokens in its all-day band; **When** Show Meals is turned off, **Then** the tokens leave
   this browser and the Meals tab is unchanged.

---

### User Story 7 — What only two browsers, or a second screen size, can show (Priority: P7)

Two browsers open on the same household, one writing and the other watching. The same journeys
re-run at the phone and at the tablet in portrait. The installable shell. And a check that every tab
is free of serious accessibility violations.

**Why this priority**: these are the claims every phase made and no automated test has ever checked —
the five-second live update, the layout that must not clip a column, the installability, and the
accessible names the constitution requires. They come last because each depends on the journeys above
already being written.

**Independent Test**: run the two-browser journeys, the narrow-viewport subset and the accessibility
smoke; each reports a pass, a failure, or a skip that names its reason.

**Acceptance Scenarios**:

1. **Given** two browsers signed in to the same household, **When** one plans a meal, ticks a task,
   redeems a reward, adds a list item or creates an event, **Then** the other shows it without being
   reloaded, within the interval the shipped specs promise.
2. **Given** the environment cannot deliver live updates at all, **When** the two-browser journeys
   run, **Then** they are reported as skipped with the reason printed, and the run does not claim
   them as passes.
3. **Given** the phone viewport, **When** the tabs that page or fold are opened, **Then** the shell's
   navigation, the boards' paging and the sheets are usable and nothing is clipped.
4. **Given** any tab, **When** it is checked for accessibility, **Then** it has no serious or
   critical violations.
5. **Given** the app is opened, **When** its installability is checked, **Then** the manifest is
   served with the icons, name and display mode that make it installable.

---

### Edge Cases

- **The local stack is not running.** The suite says so in one line and stops, rather than failing
  every journey with a connection error.
- **The stack is running but on the other project's ports.** The suite uses this repository's ports
  and never guesses; a mismatch is reported as a setup failure, not a test failure.
- **PINs are absent after a reset.** The suite sets them itself as part of preparing a run; a journey
  never assumes a PIN it did not set.
- **A journey is interrupted half-way** (a failed assertion between two writes). The next journey
  still starts from data it can rely on.
- **The household's day rolls over during a run.** A journey that depends on "today" pins the clock
  rather than reading the machine's.
- **The app is already running on the port the suite wants.** The suite reuses it rather than failing
  or starting a second one.
- **A journey's element is named differently at a different viewport.** The journey queries by
  accessible name and role, so a layout change alone never breaks it.
- **A live update never arrives.** The waiting browser fails its journey after a bounded wait with a
  message naming what it waited for, rather than hanging until the whole run times out.

## Requirements *(mandatory)*

### Functional Requirements

**The harness**

- **FR-701**: The repository MUST gain a browser-driven test suite for `/family`, kept in one folder
  of its own at the repository root, holding only test material — no application code moves into it
  and nothing in it is imported by the application.
- **FR-702**: The suite MUST be runnable with a single documented command, and MUST additionally
  offer a way to watch it run and a way to read the report of the last run.
- **FR-703**: A run MUST put the database into a known state before any journey runs — the same reset
  and seed the hand walks have always used — and MUST refuse to run against anything but the local
  stack, with no path, flag or environment variable that points it at the hosted project.
- **FR-704**: The suite MUST drive the four screen sizes the hand walks have used: the wall tablet,
  the tablet in landscape and in portrait, and the phone with touch. Every journey MUST run at the
  wall size; the journeys named in FR-724 MUST also run at the phone and at the tablet in portrait.
- **FR-705**: A run MUST sign in once and share that session with every journey, and MUST set the
  PINs the journeys need, because the seed never sets them.
- **FR-706**: Journeys MUST NOT depend on the order they run in. A journey that changes data MUST
  either restore what it changed or work on data it created, so that a run is repeatable without a
  manual reset and a single journey can be run on its own.
- **FR-707**: The suite MUST start the application itself if it is not already running, reuse it if
  it is, and wait for it to be ready rather than failing on a refused connection.
- **FR-708**: A failing journey MUST leave behind a trace of the run, an image of the screen at the
  moment of failure, and the browser's console output; a passing journey MUST leave none of that.
- **FR-709**: Journeys MUST find things the way a person does — by the name and role a screen reader
  would announce — and MUST NOT depend on styling or on markers added solely for testing where a name
  already exists.
- **FR-710**: A journey MUST NOT wait by sleeping. It waits for the thing it expects, with a bounded
  timeout, and says what it was waiting for when the wait fails.
- **FR-711**: A journey that depends on the date MUST pin the clock it reads, and the suite MUST
  document how.
- **FR-712**: The suite's own files MUST NOT be swept into the existing unit test run, nor into the
  coverage that feeds the quality gate's complexity scoring.

**The journeys**

- **FR-713**: The suite MUST prove the door: a signed-out browser is sent to sign-in from any
  `/family` page; the household password admits; a wrong one is refused with a message; signing out
  returns to the door.
- **FR-714**: The suite MUST prove the punch-in gate: a write with nobody punched in opens the
  "who's here?" sheet instead of writing; a correct PIN punches that Profile in; a wrong one is
  refused; punching out clears it; a Profile without a PIN cannot be chosen.
- **FR-715**: The suite MUST prove the Week calendar's create, edit and delete, an all-day event in
  its band, each of the three repeat scopes on an edit and on a delete, a drag to another time
  performed with real pointer movement including the scope question for a repeating event, the filter
  sheet hiding a Profile on that browser only, and paging with a return to today.
- **FR-716**: The suite MUST prove the Tasks board's tick and un-tick with the star it moves, a claim
  from Up for Grabs, a skip with the switch that hides it, a press-and-hold reorder, and adding from
  the Task Box.
- **FR-717**: The suite MUST prove the Rewards tab's manual award, a redemption with the balance and
  ledger it moves, and a redemption refused for want of stars.
- **FR-718**: The suite MUST prove the Lists tab's add, check, Clear Completed with its confirmation,
  a press-and-hold reorder, and a Parents only list visible to a punched-in parent and absent for a
  punched-in member.
- **FR-719**: The suite MUST prove the Meals tab's planning from a saved recipe and as a new entry,
  the popover's four actions, each of the three repeat scopes across several weeks, the recipes
  pane's filter and search, both recipe deletions, and the push of chosen recipe lines onto a chosen
  list read back on the Lists tab.
- **FR-720**: The suite MUST prove the meal tokens on the Week calendar, that a token opens the same
  popover as the grid, and that the Show Meals switch removes them on that browser only.
- **FR-721**: Every journey that writes MUST read its result back from the interface after a reload,
  not only from the optimistic screen, so that a write which never reached the database fails the
  journey.

**The cross-cutting checks**

- **FR-722**: The suite MUST prove that a change made in one browser reaches a second browser signed
  in to the same household without a reload, for at least one write on each of the Calendar, Tasks,
  Rewards, Lists and Meals tabs.
- **FR-723**: Each tab MUST be checked for accessibility violations, and a serious or critical
  violation MUST fail the run.
- **FR-724**: The journeys that must also run at the phone and at the tablet in portrait are: the
  door and punch-in; one write on each tab; the boards' paging; and the sheets that become full-width
  there. At those sizes nothing may be clipped and every control must remain reachable.
- **FR-725**: When the environment cannot deliver live updates, the two-browser journeys MUST be
  reported as skipped with the reason printed, and MUST NOT be reported as passes.
- **FR-726**: The suite MUST check that the application is installable: the manifest is served and
  carries the name, icons and display mode an install needs.
- **FR-727**: The suite MUST NOT change the application's behaviour. Where a journey proves something
  is broken, the fix is a change to the application with its own unit test; where a journey cannot
  reach something because it has no accessible name, adding that name is such a fix.

**Where it runs**

- **FR-728**: The suite MUST be documented as a gate to run before a phase is merged, alongside the
  four existing gates, and MUST NOT be added to the per-commit hook.
- **FR-729**: The four existing gates MUST continue to pass unchanged, with no threshold lifted, no
  baseline bumped and no suppression added anywhere in this feature.
- **FR-730**: The suite MUST NOT add any dependency the application ships to users.

### Key Entities

- **A prepared run**: the database in its seeded state, the PINs set, one signed-in session saved and
  shared, and the application running. Every journey begins here.
- **A journey**: one user's path through the app, named for what it proves, independent of every
  other journey, and readable as a description of the app's behaviour.
- **A device profile**: one of the four screen sizes, with touch where the real device has it,
  deciding how a journey's page is drawn.
- **A run report**: what a run leaves behind — the result of each journey, and for a failure the
  trace, the screen image and the console output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-701**: A developer with the repository checked out and the local stack running can go from
  nothing to a full result with **one** command and no other preparation.
- **SC-702**: A full run finishes in **under 10 minutes** on a developer machine, and the door and
  punch-in journeys alone finish in **under 60 seconds**.
- **SC-703**: Running the suite twice in a row, with no manual reset between, produces the same
  result both times; running any single journey on its own produces the same result as running it
  within the whole suite.
- **SC-704**: Every one of the six shipped phases has at least one journey that writes and reads the
  result back after a reload, so a write that never reaches the database cannot pass.
- **SC-705**: Each of the three repeat scopes is proved on both the Calendar and the Meals tab, with
  the occurrences before and after the change asserted, not only the one that was edited.
- **SC-706**: Both press-and-hold reorders — the Tasks board's and the Lists card's — and the
  calendar's drag are performed with real pointer movement, and each asserts the new order after a
  reload.
- **SC-707**: A live update is proved on all five data tabs, or reported as skipped with its reason;
  it is never silently absent.
- **SC-708**: Every tab passes an accessibility check with no serious or critical violations.
- **SC-709**: Every journey queries by accessible name or role; a review of the suite finds no
  assertion that depends on styling, and none that depends on a testing-only marker where a name
  exists.
- **SC-710**: No journey sleeps for a fixed time; a review of the suite finds no fixed delays.
- **SC-711**: The suite cannot reach the hosted project: a review finds no address, key or flag in it
  that points anywhere but the local stack.
- **SC-712**: The four existing gates pass unchanged after this feature, with no threshold, baseline
  or suppression altered, and the application ships no new dependency.
- **SC-713**: A deliberately introduced fault in each of the six tabs — a write that does not persist
  — is caught by the suite, proving the journeys assert on the result and not on the click.

## Assumptions

Decisions taken on **2026-09-06** under the operator's standing delegation, recorded so a later
reader can see what was chosen and why rather than guessing.

1. **This feature adds tests and the harness they need, and changes the application only where a
   journey proves something is broken or unreachable.** The operator asked for an end-to-end pass,
   not a redesign; a defect found is fixed with its own unit test, in the shipped style, and named in
   the run record.
2. **The seeded fixtures are the data every journey is written against.** They are already
   deterministic and already the data every hand walk used, so the journeys read as descriptions of
   the app rather than as set-up code. A journey needing something the fixtures lack creates it
   itself and cleans up after itself.
3. **One database per run, and journeys that do not depend on each other.** Resetting between
   journeys would multiply the run time by the number of journeys for no gain that FR-706's
   independence rule does not already give.
4. **A local gate before a phase merge, not a continuous-integration workflow.** The repository has no
   workflows at all; adding the first one means deciding how a database is hosted for it and how
   secrets are held, which is a larger question than this feature. The suite is written so that it
   could be run by such a workflow later without change.
5. **The wall tablet is the default viewport; the phone and the tablet in portrait run a named
   subset.** Running everything everywhere would roughly quadruple the run time to re-prove logic
   that does not vary by size; the subset is the journeys whose layout genuinely differs.
6. **A live-update check that cannot run is a skip with a printed reason, never a pass.** The local
   stack could not deliver live updates during Phases 5 and 6; a suite that quietly passed in that
   state would be worse than no suite.
7. **Accessibility is checked for serious and critical violations only.** Minor and moderate findings
   are worth knowing but are not a gate; the constitution's §III promises names, roles and touch
   targets, which is what the serious and critical bands cover.
8. **Phase 7's surfaces are out of scope but not designed against.** The suite's shape — a journey per
   user path, fixtures from the seed — is the same shape Phase 7's journeys will need.

## Dependencies

- The six shipped phases, unchanged: this feature tests them and does not alter their behaviour.
- The local Supabase stack on this repository's ports, and the seed script's `--local` fixtures.
- The development server pointed at that stack, which the suite starts itself.
- The four existing quality gates, which continue to run as they do today.

## Out of Scope

- Running against the hosted project or production, ever.
- Visual-regression image baselines.
- Load, performance and page-speed budgets.
- Phase 7's features — notifications, the home screen, the offline cache and search — beyond leaving
  the suite shaped so they can be added.
- The operator's hardware device pass: real tablets and phones, a real screen reader, and airplane
  mode. Those stay human checks.
- Any change to what the application does, except the fixes a journey proves are needed.
- The repository's first continuous-integration workflow.
