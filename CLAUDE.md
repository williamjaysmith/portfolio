<!-- SPECKIT START -->
**Active feature**: `008-family-notifications` — Phase 7: the household decides what it wants to be
reminded of, and a banner says so on whichever `/family` page is open. Settings gains a Notifications
section with the reference's own four choices (At time of event, Before event with a lead time, When
Due, When Completed); an event can carry its own reminder — the household's setting, none, or its own
— changeable under the three shipped repeat scopes; a timed chore reminds when it falls due, and a
finished one can announce who finished it.

**Web Push was dropped by the operator partway through, deliberately.** Nothing reaches a device with
no page open: no service worker, no scheduled scan, no push subscriptions, no route handlers. The
household will open the app as needed and the wall display is the shared surface. `docs/` and the
spec record it; if you find something that promises a phone will buzz, it is a leftover and should go.

**State: built, green and browser-tested (2026-09-07) — migrations 034, 035 and 038, 57 of 58 tasks.
The one that remains is the operator's: `supabase db push` against the hosted project BEFORE the
merge deploys, because the app's read queries name the new columns by hand.**
Phases 1–6 are shipped and live; the home screen, cross-tab search and the offline cache became a
following phase (`009-family-home-search-offline`), which does not exist yet.

Read in this order before touching notification code:
1. `specs/008-family-notifications/spec.md` — 23 requirements, 14 criteria, the numbered assumptions
2. `specs/008-family-notifications/research.md` — R801–R818 and why; **R802 is the one that matters**
3. `specs/008-family-notifications/plan.md` — the structure and the phasing
4. `specs/008-family-notifications/data-model.md` — migrations 034, 035 and 038, and what enforces what
5. `specs/008-family-notifications/quickstart.md` — how to run it and verify each guarantee

**R802, because it is easy to get wrong**: there is ONE pure due-computation
(`lib/family/notifications/due.ts`) and the banner is its only reader. The banner mounts in the app
shell, so it must NOT read a tab's cache — on Lists or Meals the calendar's events were never
fetched, and a seven-day lead can owe a reminder for an event outside any window a tab would ask
for. It brings its own query (`useReminderHorizon`). "Shown once" is a `Set` in the device's own
storage, not a database constraint, and the two places that gives way are written down rather than
hidden.

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
