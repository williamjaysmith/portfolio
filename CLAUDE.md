<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# Portfolio — willsmith.dev

A Next.js 16 (App Router) portfolio on Vercel that also hosts self-contained sub-apps:

| Route                | What it is                                    |
|----------------------|-----------------------------------------------|
| `/`                  | Portfolio home (hero, code/design work, contact) |
| `/skyhammer`         | Music player                                  |
| `/colectivo/routes`  | Delivery-routing tool (localStorage-backed)   |
| `/design`            | Design work                                   |
| `/family`            | **In development** — Skylight Calendar clone, family-only (Supabase) |

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
