# Research — 007 Family End-to-End Pass

Phase 0. Every decision below is one the spec left open on purpose, or one the repository's shipped
conventions constrain. Each records what was chosen, why, and what was rejected, so the plan can be
read without re-deriving any of it.

---

## R701 — The runner: `@playwright/test`, as a development dependency

**Decision**: Playwright's own test runner, installed as a devDependency, with its browsers fetched
by `npx playwright install`.

**Rationale**: it is the only browser-driving runner that gives, in one package, the four things this
suite's requirements name: real pointer input (FR-715, FR-716's press-and-hold), multiple independent
browser contexts in one test (FR-722's two devices), traces and screenshots on failure (FR-708), and
device emulation with touch (FR-704). Its assertions retry by default, which is what FR-710's
"never sleep" rule needs in practice rather than in principle. It ships types, so the suite is
type-checked by the repository's existing `tsc --noEmit`.

**Alternatives considered**: Cypress — one browser context per test makes FR-722 impossible without a
second runner, and its pointer emulation is synthetic rather than CDP-level, which is exactly what the
press-and-hold journeys must not be. WebDriverIO — heavier setup for no gain here. Puppeteer with
Vitest — no runner, no traces, no device profiles; every one of them would have to be written.

**Consequence for the gates**: FR-730 holds — Playwright is a devDependency and the application
ships nothing new.

---

## R702 — Chromium for the wall, WebKit for the tablet and phone

**Decision**: the wall-tablet project runs Chromium. The tablet and phone projects run WebKit,
through Playwright's `iPad (gen 7)` and `iPhone 13` device descriptors with the viewports the hand
walks used.

**Rationale**: the household's real devices are iPads and iPhones, which are WebKit whatever browser
is installed on them. Emulating an iPad with Chromium would prove the layout and lie about the
engine — and the app leans on modern CSS (container queries, `has-checked:`, `dvh`) and on the
`dialog` element, all of which have had WebKit-specific behaviour. The wall display is a Chrome-class
browser, so Chromium is right there. Two engines, not three: Firefox is on no device in this
household.

**Alternatives considered**: Chromium everywhere (cheaper, but the iPad claim would be unfounded);
all three engines everywhere (roughly triples the run for a browser nobody here uses).

---

## R703 — One prepared database per run, in a setup project

**Decision**: a Playwright *setup project* (`e2e/setup/prepare.setup.ts`), which every other project
depends on, does the whole preparation: `supabase db reset`, then the repository's `--local` seed,
then sign-in through the sign-in form, then the PINs through Settings, then a warm-up visit to each
tab. It saves the signed-in storage state to a gitignored file.

**Rationale**: FR-703 wants a known state, FR-705 wants one sign-in shared, and FR-706 wants
independence rather than per-journey resets. A setup project gives all three and, unlike
`globalSetup`, it runs inside the runner — so its steps appear in the report, its failures carry a
trace, and it can use the same fixtures and helpers the journeys use. Signing in and setting PINs
*through the interface* rather than through the database also means the run proves those two paths
before anything else runs, which is what FR-713 and FR-714 ask for anyway.

**Cost**: `supabase db reset` plus the seed is roughly 40 seconds. Against SC-702's ten-minute budget
that is affordable once per run and unaffordable per journey.

**Alternatives considered**: `globalSetup` (invisible in the report, no trace on failure); a
transaction rolled back per test (impossible — the writes go through a server in another process);
truncating and re-seeding between files (buys nothing FR-706 does not already give).

---

## R704 — The development server, started by the runner, warmed once

**Decision**: Playwright's `webServer` runs the repository's existing `dev:local` script at
`127.0.0.1:3000`, with `reuseExistingServer` on, a 120-second start budget, and a warm-up in the
setup project that visits every `/family` route once.

**Rationale**: `dev:local` already resolves the local stack's keys and points the app at it, so the
suite inherits FR-703's "local only" property from a script that has been used by hand since Phase 1
rather than from a new copy of that logic. Reuse means a developer with the server already running
pays nothing (FR-707). The warm-up exists because the first request to each route in development
compiles it; without it the first journey on each tab pays several seconds and its own timeouts have
to absorb it.

**Alternatives considered**: `next build && next start` — more production-like and faster per
request, but a build per run costs more than it saves at this suite's size, and a production build
hides the stack traces that make a failure diagnosable. Recorded as the thing to revisit if the suite
ever runs in CI.

---

## R705 — The four screen sizes, and which journeys visit them

**Decision**: four projects — `wall` (Chromium, 1280×800), `tablet-landscape` (WebKit, 1024×768),
`tablet-portrait` (WebKit, 768×1024) and `phone` (WebKit, 390×844, touch). Every spec runs in `wall`.
The three device projects run only the specs tagged `@responsive`, which are the ones FR-724 names.

**Rationale**: FR-704 requires all four sizes to be driven and only a named subset to be repeated
there. A tag is the smallest mechanism that expresses "this journey's layout differs" in the journey
itself, where the reason lives, rather than in a list in the config that will drift. The spec's
FR-704 and FR-724 between them left the tablet-in-landscape size driven by nothing; the subset runs
at all three device sizes, which is the reading that leaves no size unproven.

**Alternatives considered**: a file-name convention (`*.responsive.spec.ts`) — forces a journey to
live in a different file from its siblings; separate config per size — four configs to keep in step.

---

## R706 — Isolation without resets: serial files, and data a journey owns

**Decision**: `fullyParallel: false` and a single worker. A journey either asserts on seeded data it
does not change, or creates its own data with a name unique to that journey and removes it at the
end.

**Rationale**: one database is shared by every journey (R703), so two journeys writing at once could
see each other's rows. A single worker is the honest way to hold FR-706 at this suite's size; the
ten-minute budget (SC-702) has room for it. Unique names mean a journey can also be run alone, which
SC-703 requires, and mean a crash mid-journey leaves at most one stray row that the next run's reset
clears.

**Alternatives considered**: parallel workers with a household per worker — the seed and the whole
app assume one household, so this would mean changing application data model assumptions for a test
harness, which FR-727 forbids in spirit. Parallel workers with a database per worker — several
Supabase stacks on one machine; far more machinery than the problem deserves.

---

## R707 — Finding things: accessible names, and the one exception

**Decision**: journeys query by role and accessible name (`getByRole`, `getByLabel`,
`getByRole('button', { name: … })`), matching how the repository's component tests already query.
The one exception is the calendar's drag, which needs a specific element's box on screen; it locates
the block by its accessible name first and reads the box from that.

**Rationale**: FR-709, and the constitution's §III — a journey that can only find a control by its
class is evidence the control has no name, which is a defect to fix (FR-727's second half) rather
than a query to work around.

---

## R708 — Determinism: the seed's own dates, and a pinned clock where a date matters

**Decision**: journeys read "today" from the application — the shell's clock, the week label, the
day headers — because the seed's fixtures are generated relative to the household's today. A journey
that must assert on a specific date first pins the browser clock with Playwright's
`clock.setFixedTime` before navigating, and the fixture that does so is documented in the harness.

**Rationale**: FR-711. The alternative — hardcoding dates — breaks the suite the next day. Pinning
the clock globally would break the seed's relationship to today, since the data was written by a
different process at the real time.

**Caveat to carry**: the app reads the household timezone, not the machine's, so a pinned instant
must be chosen far from midnight in that zone or the assertion becomes a coin flip.

**A second caveat, which changes a design decision**: the signed-in session's token is minted by a
server running on the real clock, so a browser pinned days away from it believes the token has
expired and asks for a new one on a loop. Pinning is therefore for hours, not days — and the
calendar's fixtures sit in a frozen week (the render matrix from Phase 2's quickstart) rather than
being anchored to today the way the task, list and meal fixtures are. So the calendar journeys
**create the events they need in the current week** rather than paging to the frozen one, which also
satisfies FR-706's "work on data it created". The frozen week stays what it was seeded for: the
by-hand render matrix.

---

## R709 — Accessibility: axe, serious and critical only

**Decision**: `@axe-core/playwright` as a devDependency; one spec that visits each of the six tabs
and fails on any violation of `serious` or `critical` impact, printing the rule, the impact and the
offending element for each.

**Rationale**: FR-723 and Assumption 7. Axe is the engine every other tool wraps, and its impact
bands map cleanly onto "would a screen-reader user be blocked". Minor and moderate findings are
printed but do not fail, so the gate stays honest rather than aspirational.

**Alternatives considered**: Lighthouse's accessibility score (a number, not a list of defects, and
it drags a performance run along); pa11y (a second engine to configure for the same rules).

---

## R710 — The live-update probe, so a skip is never a silent pass

**Decision**: before the two-browser journeys assert anything, a probe opens both pages, waits for
each to have mounted its live channel, and asks the local database whether any live subscription
exists. If none does, the journeys skip with the reason printed. The probe reads the database
directly with the `pg` client the policies tests already use.

**Rationale**: FR-725 and Assumption 6. During Phases 5 and 6 the browser's channel never landed a
subscription row on the local stack, while a Node client subscribed fine — an environment gap, not an
application defect. A suite that passed in that state would be worse than none. Asking the database
is the only check that distinguishes "the app did not send the change" from "this stack cannot carry
it".

---

## R711 — Installability: the manifest route, read as a document

**Decision**: fetch `/family/manifest.webmanifest` with the browser's request context and assert its
name, short name, display mode, start URL and that its icons include the sizes an install needs.

**Rationale**: FR-726, and Phase 1 shipped the manifest as an ordinary route handler because the file
convention is root-only. Nothing more is claimed: a real install is a device action and stays in the
operator's hardware pass.

---

## R712 — Keeping the suite out of the other gates' way

**Decision**: `e2e/**` is added to the unit project's exclusions and to the existing `tests` zone in
the quality tool's boundary configuration; `playwright.config.ts` joins the `config` zone. The
coverage that feeds complexity scoring already includes only `app`, `lib` and the request proxy, so
nothing is needed there.

**Rationale**: FR-712 and FR-729. Naming a new folder for what it is — tests — is configuration, not
a suppression: no threshold moves, no baseline is bumped, and no finding is silenced.

---

## R713 — Where it runs: a phase gate, documented beside the other four

**Decision**: `npm run test:e2e` (plus `:ui`, `:headed` and `:report`), documented in the repository's
quality-bars rules as the gate to run before a phase is merged. It is not added to the per-commit
hook, and this feature adds no continuous-integration workflow.

**Rationale**: FR-728 and Assumption 4. The suite is minutes; the per-commit hook is seconds, and
making it minutes would get it disabled. The repository has no workflows at all, so adding the first
one means deciding how a database is hosted for it and how secrets are held — a larger question than
this feature, and one this suite is written to be ready for.

---

## R714 — Proving the suite can fail

**Decision**: an explicit, temporary experiment during implementation: for each of the six tabs, one
deliberate application fault that makes a write not persist, run the relevant journey, confirm it
fails, revert. The results are recorded in the feature's run record.

**Rationale**: SC-713. A suite that has never failed is a suite nobody has checked. The checklist
flagged this as the thing most likely to be skipped, so it gets a task of its own rather than a good
intention.

---

## R715 — What the journeys assert after a write

**Decision**: every writing journey reloads the page (or navigates away and back) and re-asserts,
rather than trusting the screen the write left behind.

**Rationale**: FR-721. The application deliberately writes pessimistically and never edits its cache
by hand, so a screen that shows the new state before a reload is *usually* honest — but "usually" is
what an end-to-end suite exists to remove. A reload also proves the server-rendered path, which the
component tests never touch.
