<!-- SPECKIT START -->
**Active feature**: `005-family-lists` — Phase 5 of the `/family` Skylight Calendar clone: the
Lists tab (a row of coloured list cards with a count badge, an "Add item" box, square-checkbox item
rows, freeform sections with counts and folds; two default lists made once per household; add,
check, uncheck, edit, move, delete and Clear Completed; press-and-hold reorder across sections in
one write; a per-device Completed switch in the Filter sheet; Parents only lists shown only while a
parent is punched in). Lists were split out of the locked plan's `family-lists-meals` on
2026-09-05; Meals follows as `006-family-meals`; notifications/home/offline/search are Phase 7.
**State: built and green locally (2026-09-06) — migrations 028–029 applied on the local stack, 3139 unit + 431 policies tests, audit clean; NOT yet on the hosted project. Next: `supabase db push --linked` (028–029) → quickstart §4 → merge → deploy → live checks (T054), then the device pass (T055).** There are no subscription
tiers here — every Skylight feature is simply present.

Read in this order before touching `/family` code:
1. `specs/005-family-lists/plan.md` — the implementation plan and phasing (the chassis move is step 1)
2. `specs/005-family-lists/spec.md` — 45 requirements, evidence-tagged
3. `specs/005-family-lists/research.md` — R501–R516 and why
4. `specs/005-family-lists/data-model.md` — migrations 028–029, invariants, the privilege delta
5. `specs/005-family-lists/contracts/server-actions.md` — the twelve actions
6. `specs/005-family-lists/quickstart.md` — setup, verification per guarantee, operator steps

Phases 1–4 (`specs/001-family-foundation/`, `specs/002-family-week-calendar/`,
`specs/003-family-tasks/`, `specs/004-family-rewards/`) are shipped and live; their docs bind this
phase's conventions. **Hard ordering**: the hosted `supabase db push` (028–029) MUST land before
this branch is merged or deployed — the two new tables join the realtime channel every `/family`
page mounts.

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
