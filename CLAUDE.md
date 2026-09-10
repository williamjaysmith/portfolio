<!-- SPECKIT START -->
**Last shipped**: `009-calendar-preview-bar` — Phase 8, merged `de69f13` and deployed 2026-09-08,
with migration `039` applied to the hosted project. Countdowns end to end, Tasks Progress, and the
calendar's event search. Run record:
`specs/009-calendar-preview-bar/checklists/quickstart-run.md`.

**BUILT BUT NOT MERGED: `011` and `012`, 23 commits on `012-family-performance`.** The branch is
stacked — `012` sits on `011` — so they merge together or not at all. `main` is still at Phase 9.

- **`011-family-calendar-views`** — the view switcher, the Day view and the Month view. Note the name:
  `011` was once planned as the offline cache and is NOT. The offline cache is still unbuilt, still has
  **no Skylight source at all**, and must be written as this project's own invention rather than a
  clone whenever it is taken up.
- **`012-family-performance`** — measured performance work, and three defects it found on the way.

**What `012` actually turned out to be about.** It began as "production feels slower than dev" and
the largest thing it found is not performance at all:

- **Live updates had NEVER worked, since Phase 1.** `useFamilyRealtime` filtered three of its twenty
  tables by household, and **one filtered `postgres_changes` binding makes the server discard every
  binding on the channel** while `subscribe()` still reports `SUBSCRIBED`. Two devices have never once
  watched each other. Fixed; verified by hand and by `live.spec:21` passing for the first time.
- **The check that should have caught it could not fail.** `liveUpdateSupport()` counted rows in
  `realtime.subscription` — registration, never delivery — and those rows outlive the socket that made
  them, so on any machine that had ever run the app the answer was "yes, live updates work here",
  permanently. It was also read before either browser had navigated, because it was a fixture value
  and Playwright resolves fixtures before the test body. The journeys therefore **skipped**, and a skip
  reads as a pass. **The bar that follows: a capability check must observe the capability, not a trace
  that the capability was once attempted.**
- **Two e2e journeys asserted on fixtures they did not own** — the seed's Saturday Banana bread, in a
  seven-column window that shows Saturday. A fixture that appears twice in one window cannot be
  identified by name alone.
- **The phone's calendar stopped re-laying-out**: CLS 0.18 → 0.00, by letting the device tell the
  server how wide it is through a cookie.
- **The Meals grid now opens on today** (the operator's ruling: "the past is in the past"). The Week
  calendar already did; Meals opened on the week's first day, so a two-column phone showed days that
  had already gone.

**The one thing `012` owes: a browser pass on a quiet machine.** Four gates are green (3796 tests,
typecheck, lint, fallow). Five full `test:e2e` runs gave 7, 3, 13, 1 and 8 failures on effectively
identical code, and **load at start predicts the count while the code does not** — the 1-failure run
was the only quiet one, and that failure is now fixed. `mediaanalysisd` and `mds_stores` were each
taking ~90–99% of a core. Read `specs/012-family-performance/checklists/quickstart-run.md` before
concluding anything about this suite.

**Do not edit `app/**` or `lib/**` while `npm run test:e2e` is running** — its web server is
`next dev` with hot reload, and one run was invalidated that way.

**`010` — the home screen — is SHELVED (2026-09-08), specified but not built.** The operator's call:
the Calendar tab already is a fine home screen now that Phase 8's preview bar puts the countdowns and
each Profile's chore progress above the week. `specs/010-family-home-screen/` is kept for its
research — five resolving article ids, an audit that rejected 23 over-claims, and four "home screen"
traps named so nobody re-adopts one. Do not resurrect it without re-reading why it was shelved.

**Still outstanding, and the operator's own**: verify two-device sync on the **hosted** project (the
realtime fix is local-verified only, and the local stack does not enforce realtime RLS); the Vercel
cold start (**1.81 s TTFB on a cold request against 0.17 s warm** — a dashboard setting, not code);
the overnight countdown roll; and the lint fix stashed on `fix-lint-react-19` (11 errors in the legacy
sub-apps, none in `/family`).

Phases 1–9 are shipped and live; `010` is shelved unbuilt; `011` and `012` are built and unmerged.

Read in this order before touching preview-bar code:
Read in this order before touching preview-bar code:
1. `specs/009-calendar-preview-bar/spec.md` — FR-901…FR-921, SC-901…SC-912, 7 assumptions, 6 divergences
2. `specs/009-calendar-preview-bar/research.md` — R901–R915 and why
3. `specs/009-calendar-preview-bar/plan.md` — the structure and the phasing
4. `specs/009-calendar-preview-bar/data-model.md` — the one migration, and what is derived rather than stored
5. `specs/009-calendar-preview-bar/quickstart.md` — how to run it, verify each guarantee, what to do when it fails

**The findings that are easy to get wrong**:
- **The reference describes no search ACROSS tabs** (Assumption 1). It has three, each inside one
  tab — tasks by name and description, recipes by keyword, and the calendar's own; Phases 3 and 6
  shipped two of them. The master map's §1 inventory reads as though one search spans the app. No
  source describes one, so this phase adds the calendar's and drops the cross-tab idea rather than
  inventing a surface. Note this is an absence of evidence, stated as such in the spec.
- **The bar is `MealRow`'s shape** (R901): one row under the all-day band, drawn by `WeekView`,
  outside the drag layer, returning `null` when it has nothing — not a new chassis, and not the
  shell's `ProfileChipRow`, which is on screen on Lists and Meals too.
- **Tasks Progress mounts the board's reads** (R905): the switch is off by default and *mounting is
  the `enabled`* (`useTaskBox`'s shipped idiom), so the calendar makes no task request at all while
  it is off. Three of the four reads are household-keyed, so the Tasks tab's cache is shared.
- **Nine `[UNKNOWN]`s are decisions, not facts** — the chip's wording, the progress format, what a
  countdown does on its own day, whether the rotation can be paused, what a countdown on a repeat
  counts towards, that progress reports today rather than the paged-to day, that the one surface
  carries a search the reference documents only on the phone, and what a result looks like.
- **A countdown is a SERIES property.** There is no per-occurrence countdown and `event_exceptions`
  gains no column for one, so changing it withholds the "This event" scope exactly as changing
  Profiles or the repeat does (002 FR-287).
- **SC-902's midnight roll is not proved in a browser** and cannot be: the e2e clock helper refuses
  jumps over three hours because the session token is minted on the real clock. The arithmetic is
  unit-tested across both DST changes; the overnight watch is the operator's.

The browser pass (`specs/007-family-e2e/`) is the **phase gate**: run `npm run test:e2e` before a
phase is merged, and read the report rather than only the exit code. It is deliberately not in the
pre-commit hook — it is minutes, and a gate that slow gets disabled — and it must never be able to
reach the hosted project. Its harness contract is `specs/007-family-e2e/harness.md`; read §4 and §5
before writing a journey.

**Working locally**: `supabase start` (this repo's stack is on **553xx**, not the CLI defaults —
another project already occupies 543xx), then `npm run test:e2e`, which does the reset, the seed and
the server itself. For the app by hand: `supabase db reset`, `npm run family:seed -- --local`,
`npm run dev:local`, sign in with password `family-dev-password` (account `dev@family.local`);
PINs are never seeded — set Ana `1234` and Cleo `2468` in Settings after every reset.
Policies tests: `npm run test:policies` (reads `.env.local`; needs the local stack).

**The gate needs coverage**: fallow scores untested branchy functions via CRAP, so
`.fallowrc.json` points `health.coverage` at `coverage/coverage-final.json` and
`npm run fallow:audit` regenerates it first. `coverage/` is gitignored, so run
`npm run test:coverage` once before invoking `fallow` directly (the git pre-commit hook does).
<!-- SPECKIT END -->

# Portfolio — willsmith.dev

A Next.js 16 (App Router) portfolio on Vercel that also hosts self-contained sub-apps:

| Route                | What it is                                    |
|----------------------|-----------------------------------------------|
| `/`                  | Portfolio home (hero, code/design work, contact) |
| `/skyhammer`         | Music player                                  |
| `/colectivo/routes`  | Delivery-routing tool (localStorage-backed)   |
| `/design`            | Design work                                   |
| `/family`            | Skylight Calendar clone, family-only (Supabase). Phase 1 built; awaiting the operator's hosted setup |

## Stack

TypeScript 5 (strict) · Next.js 16.1.6 · React 19.1.0 · Tailwind 4 · Vitest 4 + Testing Library ·
framer-motion · @dnd-kit · lucide-react. Deployed on Vercel.

## Commands

| Task            | Command                                     |
|-----------------|---------------------------------------------|
| Dev             | `npm run dev` (turbopack)                   |
| Build           | `npm run build`                             |
| Test            | `npm test` / `npm run test:watch`           |
| Types           | `npm run typecheck`                         |
| Lint            | `npm run lint`                              |
| Quality gate    | `npm run fallow:audit`                      |
| Codebase Q&A    | `npm run graph:query "<question>"`          |
| Rebuild graph   | `npm run graph`                             |

## Codebase orientation — ask the graph first

`graphify-out/graph.json` is a knowledge graph of this repo. For "where is X / what calls Y /
how does Z fit together", run `npm run graph:query "<question>"` **before** grepping.

## Quality gates — MANDATORY before every commit

`.claude/rules/quality-bars.md` is the contract. In short: `fallow:audit`, `test`, `typecheck`,
`lint` must all pass, and **no suppressions** — no `fallow-ignore`, `eslint-disable`, `@ts-ignore`,
threshold lifts, or baseline bumps. If a gate fails, the code changes, not the gate.
The gate is enforced by `.git/hooks/pre-commit` and `.claude/hooks/fallow-gate.sh`.

## Architecture

`.claude/rules/architecture.md` — layer boundaries (`lib` never imports from `app/**`), sub-app
conventions, and the fallow-enforced import rules.

## Specialists

`.claude/agents/` (11) and `.claude/skills/` — delegate rather than doing everything inline:

- **Build**: nextjs-architect, react-developer, backend-developer, typescript-engineer, ui-designer
- **Data**: supabase-specialist, database-architect
- **Quality**: code-quality, test-engineer, fallow-expert, security-auditor
- **Skills**: code-reviewer, testing-expert, nextjs-expert, react-expert, tailwind-expert,
  typescript-expert, security-guardian, graphify, and the `speckit-*` set

## Spec-driven development

Spec Kit is installed (`.specify/`). Flow: `/speckit.constitution` → `/speckit.specify` →
`/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.
Feature specs live in `specs/<NNN>-<slug>/`. `.specify/extensions.yml` runs a mandatory
feature-branch hook before each spec and a fallow + simplify audit after each implement.

## MCPs

`chrome-devtools` (visual checks, screenshots, console/network) and `context7` (library docs).
Configured in `.mcp.json`, which is gitignored — recreate it locally if missing.

## /family research

Skylight Calendar reference dossiers live in `docs/research/skylight/`. Every fact there is
tagged `[VERIFIED](url)`, `[INFERRED]`, or `[UNKNOWN]` — respect those tags; do not promote an
inference to fact when writing specs.
