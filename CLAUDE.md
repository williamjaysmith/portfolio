<!-- SPECKIT START -->
**Active feature**: `004-family-rewards` — Phase 4 of the `/family` Skylight Calendar clone: the
star economy and the Rewards tab (star values and the card chip, credits and retractions as a
ledger written by database triggers, balances, the stars-today pill, reward cards with a bar or a
Redeem button, redeem/unredeem with the photographed modal and falling stars, a parent's
give-and-take, the emoji rain and the Amazing/Strong Week messages). **Specified, clarified and
planned; implementation not started.**

Read in this order before touching `/family` code:
1. `specs/004-family-rewards/plan.md` — the implementation plan and phasing
2. `specs/004-family-rewards/spec.md` — 45 requirements, evidence-tagged
3. `specs/004-family-rewards/research.md` — R401–R418 and why
4. `specs/004-family-rewards/data-model.md` — migrations 024–027, triggers, invariants
5. `specs/004-family-rewards/contracts/server-actions.md` — the action surface
6. `specs/004-family-rewards/quickstart.md` — setup, verification per guarantee, operator steps

Phases 1–3 (`specs/001-family-foundation/`, `specs/002-family-week-calendar/`,
`specs/003-family-tasks/`) are shipped and live; their docs bind this phase's conventions. **Hard
ordering**: the hosted `supabase db push` (024–027) MUST land before this branch is merged or
deployed — the four new tables join the realtime channel every `/family` page mounts.

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
