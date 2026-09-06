# Quality Bars — Portfolio

Non-negotiable gates for this repo. Applies to every sub-app (`/skyhammer`, `/colectivo`, `/family`).

## No suppressions

Never write or accept:

- `// fallow-ignore-next-line *`
- `// eslint-disable-*`
- `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`
- threshold lifts in `.fallowrc.json`
- baseline bumps in `.specify/local/fallow-baselines/`

**If a quality gate fails, the code changes — not the gate.** Green the gate by real refactor
(extract helpers to drop cyclomatic/cognitive paths) or by adding test coverage. If a finding
genuinely cannot be reduced, surface it to the operator as a question rather than suppressing it.

## Before every commit

Run all four; any failure blocks the commit:

1. `npm run fallow:audit` — zero NEW findings vs the baselines in
   `.specify/local/fallow-baselines/`. Enforced three ways: the git `pre-commit` hook,
   the `.claude/hooks/fallow-gate.sh` Claude Code hook, and CI.
2. `npm test` — Vitest, all green.
3. `npm run typecheck` — `tsc --noEmit`, zero errors.
4. `npm run lint` — ESLint, zero errors.

## Before a phase is merged

One gate more, on top of the four above:

5. `npm run test:e2e` — the browser pass over `/family` (`e2e/**`, spec `007-family-e2e`).
   It resets and seeds the local stack, starts the app against it, and walks the journeys each
   shipped phase has only ever had walked by hand: the door, punch-in, the calendar's drag and its
   three repeat scopes, the tasks board and its stars, the lists, the meals grid and its calendar
   tokens, two browsers watching each other, the narrow layouts, installability, and the
   accessibility sweep.

**Why it is not in the pre-commit hook**: it is minutes, not seconds, and a gate that slow gets
disabled. It is a phase gate — run it before merging a feature branch, and read the report rather
than only the exit code: a live-update journey the environment cannot run is a printed **skip**, not
a pass.

## Complexity budget

`.fallowrc.json` sets `maxCyclomatic: 20`, `maxCognitive: 15`. A function over budget gets split,
not annotated.

## Duplication

Baseline is the pre-existing duplication in `app/components/home/**` and `app/components/ui/**`
(portfolio marketing components, ~16.5%). New code must not add to it — extract a shared component
or helper instead. `npm run fallow:dupes` reports against `main`.

## Testing

Every behavior change needs a test that fails before the fix and passes after. Pure logic
(state hooks, storage adapters, date/recurrence math) is unit-tested; drag/visual layers are
verified by running the app. See `.claude/rules/architecture.md` for where each layer lives.
