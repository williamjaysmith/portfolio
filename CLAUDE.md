<!-- SPECKIT START -->
**Active feature**: `003-family-tasks` — Phase 3 of the `/family` Skylight Calendar clone: the
Tasks tab (chores and routines, per-Profile columns, the four time-of-day sections, two repeat
modes, resolutions with skip/claim/late carry-forward, streaks, the per-device filters, search,
the Task Box, the two press-and-hold reorders, the measured column fit with the portrait wrap and
the phone pager). **Built, verified, and deployed (2026-09-04): migrations 017–023 are on the
hosted project with the §4 checks green, and the live `/family/tasks` renders the household's
columns.** What remains is the hardware half of T084 — the wall-tablet run, the iPad press-and-hold
feel and portrait wrap, the phone swipe, and the overnight rollover watch
(`specs/003-family-tasks/quickstart.md` §4.9). Rewards are a later phase: two reserved
`reward_points` columns exist and nothing reads them (SC-319).

Read in this order before touching `/family` code:
1. `specs/003-family-tasks/plan.md` — the implementation plan and phasing
2. `specs/003-family-tasks/spec.md` — 98 requirements, evidence-tagged
3. `specs/003-family-tasks/research.md` — R301–R326 and why
4. `specs/003-family-tasks/data-model.md` — migrations 017–023, policies, invariants
5. `specs/003-family-tasks/contracts/server-actions.md` — the action surface
6. `specs/003-family-tasks/quickstart.md` — setup, verification per guarantee, operator steps

Phases 1 and 2 (`specs/001-family-foundation/`, `specs/002-family-week-calendar/`) are shipped and
live; their docs bind this phase's conventions. **Hard ordering**: the hosted `supabase db push`
(017–023) MUST land before this branch is merged or deployed — Phase 3 adds four tables to the
realtime channel every `/family` page mounts, and a deploy ahead of the push takes the shipped
calendar's live updates down with it.

Product truth lives in `docs/research/skylight/00-master-map.md`.
Note: this repo is Next 16 — request interception is `proxy.ts`, not `middleware.ts`,
and it is NOT an authorization boundary. Every server action re-checks auth itself.

**Working locally**: `supabase start` (this repo's stack is on **553xx**, not the CLI defaults —
another project already occupies 543xx), then `supabase db reset`, `npm run family:seed -- --local`,
then `npm run dev:local` and sign in with password `family-dev-password` (account `dev@family.local`).
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
