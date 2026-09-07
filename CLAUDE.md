<!-- SPECKIT START -->
**Active feature**: `009-calendar-preview-bar` — Phase 8: the strip of information the reference draws
*above* its events, and the search that finds one. **Countdowns** end to end — a switch on the event
form finally writes `events.countdown_enabled`, which has been in the schema since `010_events.sql`
with nothing reading it; a household setting (Always / 3 months prior / 1 month prior) decides how
early they appear; the calendar draws them above the week and the number falls at the household's
midnight. **Tasks Progress** — the Filter toggle Phase 2 withheld, wired to the completed-of-total
rule `lib/family/tasks/counters.ts` already owns. **Event search** — finds a series by title and
takes the calendar to the day it next falls on.

**State: specified and planned (2026-09-07); no code yet.** `/speckit.tasks` next.
Phases 1–7 are shipped and live. The **home screen** becomes `010` and the **offline cache** `011`;
this one goes first because the home screen's calendar pane consumes a calendar whose chrome is still
missing two documented pieces.

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
- **Seven `[UNKNOWN]`s are decisions, not facts** — the chip's wording, the progress format, what a
  countdown does on its own day, whether the rotation can be paused, what a countdown on a repeat
  counts towards, and that progress reports today rather than the paged-to day.

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
