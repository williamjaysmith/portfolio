<!-- SPECKIT START -->
**Active feature**: `007-family-e2e` — the browser-driven end-to-end pass over `/family`: one
command that resets and seeds the local stack, starts the app against it, signs in once, sets the
PINs the seed never sets, and walks the journeys the six shipped phases have only ever had walked by
hand — the door and the punch-in gate, the calendar's create/edit/delete/drag and its three repeat
scopes, the tasks board and the stars it moves, the lists and their reorder, the meals grid with its
recipes and its calendar tokens — plus the four claims no test has ever checked: a change reaching a
second browser, the narrow layouts, installability, and no serious accessibility violations. It adds
tests and the harness they need, and changes the app only where a journey proves a defect.
**State: specified, planned and designed (2026-09-06); tasks next, then implementation — Setup first.**
Phases 1–6 are shipped and live; Phase 7 (notifications, home, offline, search) follows this.

Read in this order before touching `e2e/` code:
1. `specs/007-family-e2e/plan.md` — the plan, the structure and the phasing
2. `specs/007-family-e2e/spec.md` — 30 requirements, 7 journeys, 13 success criteria
3. `specs/007-family-e2e/research.md` — R701–R715 and why
4. `specs/007-family-e2e/harness.md` — the state a run begins in, the fixtures, the rules a journey follows
5. `specs/007-family-e2e/quickstart.md` — how to run it, verification per guarantee, what to do when it fails

The six shipped phases (`specs/001-family-foundation/` … `specs/006-family-meals/`) are the
subject of this suite and are not changed by it, except where a journey proves a defect — which is
fixed application-side with its own unit test, in the shipped style. The suite is a **phase gate**,
run before a phase is merged; it is deliberately not in the pre-commit hook, and it must never be
able to reach the hosted project.

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
