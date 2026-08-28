# Portfolio Constitution

<!--
SYNC IMPACT REPORT
==================
Version change: (template) → 1.0.0 (MAJOR — initial ratification)
Date: 2026-08-28
Change type: Initial constitution for the willsmith.dev portfolio repo, written ahead of the
`/family` (Skylight Calendar clone) feature work.

Rationale: this repo previously had no constitution (unfilled Spec Kit template). The principles
below codify the practices already in force in the codebase (strict TS, Vitest, fallow gates,
layered imports) plus the ones the `/family` app requires (family-only access, privacy of a
child's data, offline-tolerant UX on a wall tablet).

Templates impact:
- ✅ `.specify/templates/spec-template.md` — unchanged; specs cite principles by number.
- ✅ `.specify/templates/plan-template.md` — unchanged.
- ⚠️ `.claude/rules/quality-bars.md` is the operational expression of §V; keep the two in sync.
- ⚠️ `.claude/rules/architecture.md` is the operational expression of §IV.
-->

## Purpose

This repository is a personal portfolio (willsmith.dev) that also hosts self-contained sub-apps
used by real people — currently a music player (`/skyhammer`), a delivery-routing tool used
mid-shift (`/colectivo/routes`), and a family calendar (`/family`). The constitution exists so
that "personal project" never becomes an excuse for software that loses data, leaks a family's
information, or cannot be changed safely.

## Core Principles

### I. Sub-apps are self-contained (NON-NEGOTIABLE)

Each sub-app owns its own route folder, components, state, and tests, and can be understood
without reading any other sub-app. Shared code moves into `lib/` only when a **third** consumer
appears — never on the speculation of one. Deleting a sub-app must never break another.

Rationale: these apps have unrelated lifecycles and unrelated users. Premature sharing has
already been rejected once (the Colectivo spec deliberately copied Skyhammer's drag config
rather than extracting a shared list component).

### II. Test-first for logic (NON-NEGOTIABLE)

Every behavior change to pure logic — state hooks, storage adapters, reconciliation, date and
recurrence math, permission checks — starts with a test that fails before the change and passes
after. Visual and gesture layers (drag, animation, layout) are verified by running the app and,
where useful, a browser screenshot.

Rationale: the parts that silently corrupt data are exactly the parts that are cheap to test.

### III. Accessible and touch-first

Interactive surfaces meet WCAG 2.1 AA: semantic HTML, full keyboard navigability, visible focus
rings, 4.5:1 text contrast, and accessible names on icon-only buttons. Any control intended for
a tablet or phone has a touch target of at least 44×44 CSS px. Colour is never the only carrier
of meaning — a profile's colour is always paired with a name, initial, or avatar.

Rationale: `/family` is used by a child on a wall tablet; `/colectivo` is used one-handed in a
delivery van.

### IV. Layered, boundary-enforced architecture

Imports flow one way: `config`/`ui-pages` → `components` → `lib`. `lib` never imports from
`app/**`. A page never talks to a storage backend directly; it goes through a `lib` module that
hides the backend behind an interface. These boundaries are machine-enforced by the `boundaries`
rules in `.fallowrc.json`, and a violation fails the quality gate.

Rationale: it is what makes swapping localStorage for Supabase a `lib` change rather than a
rewrite.

### V. Quality gates are not negotiable (NON-NEGOTIABLE)

Before every commit, all four must pass: `npm run fallow:audit` (zero NEW findings vs the
baselines), `npm test`, `npm run typecheck`, `npm run lint`.

**No suppressions.** `// fallow-ignore-next-line`, `// eslint-disable-*`, `// @ts-ignore`,
`// @ts-expect-error`, `// @ts-nocheck`, threshold lifts in `.fallowrc.json`, and baseline bumps
in `.specify/local/fallow-baselines/` are all forbidden. If a gate fails, the code changes — by
real refactor or by added coverage. When a finding genuinely cannot be reduced without making the
code worse, it is escalated to the operator as a question, never silenced unilaterally.

Rationale: a gate that can be edited by the thing it gates is not a gate.

### VI. Degrade gracefully, never lose the user's data

An app that people depend on keeps working when the network, the browser, or the backend
misbehaves. Corrupt or unrecognised persisted state is discarded in favour of a safe default
rather than crashing. Storage that is unavailable (private mode, quota) downgrades to
in-memory for the session with a quiet, honest notice. Destructive actions confirm first and
state exactly what will be lost and what will be kept.

Rationale: `/colectivo` is relied on mid-shift; worst case it forgets today's reordering, but it
never loses the ability to show stops and get directions. `/family` inherits the same standard.

### VII. Private by default; the family's data stays the family's

`/family` is not public. Access requires an allowlisted Supabase Auth account, enforced at the
database with Row Level Security — never by UI hiding alone. Every user-facing query filters by
its owning id explicitly, even under RLS. Within the household, a second layer ("punch-in")
attributes each action to a person and gates parent-only operations server-side; a child's
profile can never perform an admin action or act as another profile. No analytics, no third-party
trackers, and no child's name, photo, or schedule leaves the project's own infrastructure.
`/family` is `noindex` and is not linked from the portfolio.

Rationale: this is a real family's schedule, including a child's.

### VIII. Fidelity is a specified requirement, not a vibe

Where a sub-app deliberately reproduces an existing product's design (`/family` clones the
Skylight Calendar), the target behaviour is captured in a source-tagged research dossier under
`docs/research/`, and every fact carries `[VERIFIED](url)`, `[INFERRED]`, or `[UNKNOWN]`. Specs
may only assert what is `[VERIFIED]`; an `[INFERRED]` or `[UNKNOWN]` item must be surfaced as an
explicit product decision, not quietly promoted to fact.

Rationale: "make it look like theirs" is unimplementable and untestable; a tagged dossier is both.

## Development Workflow

1. **Research** (fidelity work only) — dossiers in `docs/research/`, source-tagged per §VIII.
2. **Specify** — `/speckit.specify` on a numbered feature branch (enforced by the mandatory
   `before_specify` hook). Specs live in `specs/<NNN>-<slug>/`.
3. **Clarify** — `/speckit.clarify` resolves ambiguity before planning; open questions are
   answered, not assumed.
4. **Plan → Tasks** — `/speckit.plan`, `/speckit.tasks`.
5. **Implement** — `/speckit.implement`, test-first per §II. The mandatory `after_implement`
   quality-gate hook runs fallow before the feature is declared done.
6. **Review** — `code-reviewer` and, for anything touching auth or access control,
   `security-guardian`.

Delegate to the specialists in `.claude/agents/` and `.claude/skills/` rather than doing
everything inline. Ask `npm run graph:query` before grepping.

## Governance

This constitution supersedes ad-hoc practice. Amendments require: a written rationale in the
Sync Impact Report above, a version bump, and an update to any `.claude/rules/*` file that
operationalises the changed principle.

**Versioning** — MAJOR: a principle is removed or redefined incompatibly. MINOR: a principle or
materially expanded guidance is added. PATCH: clarification or wording that changes no behaviour.

**Compliance** — every spec and plan is checked against these principles; a deviation must be
recorded in the spec's Complexity Tracking section with its justification and the simpler
alternative that was rejected. Principles marked NON-NEGOTIABLE cannot be waived by a spec.

**Version**: 1.0.0 | **Ratified**: 2026-08-28 | **Last Amended**: 2026-08-28
