# Implementation Plan: The Meals Tab Navigates Like the Calendar

**Branch**: `013-meals-navigation` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-meals-navigation/spec.md`

## Summary

The Meals grid draws as many whole day columns as fit and its arrows move the window by exactly that
many days, beginning on today — the Calendar's one rule, replacing a fixed seven-day week with a
separate swipe-paged slice over it. Nothing else about the tab changes.

The approach follows from R1304: **share the Calendar's pure window arithmetic, keep Meals' own
measuring.** `viewWindowOf` and the anchor helpers already live in `lib/family/calendar/`; the
measurement stays with `useBoardGeometry` and `--fam-meal-cell-w`, because the two grids genuinely fit
different numbers of columns at the same width.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.1.0, Next.js 16.1.6 App Router
**Primary Dependencies**: TanStack Query 5 (unchanged here), framer-motion (the pager's pan)
**Storage**: none new. No migration; no schema change; the meals read is unwindowed and untouched
**Testing**: Vitest 4 (`unit`) for the window arithmetic and the hook; Playwright for the journeys
**Target Platform**: the household's phones (390px), tablets (768/1024px) and the wall display (1280px)
**Project Type**: web — a feature module inside the `/family` sub-app
**Performance Goals**: no regression. **CLS must stay 0** at every width (FR-1310, measured baseline)
**Constraints**: `useColumnPage` may not change (FR-1309, three other boards depend on its one rule);
006's midnight hold must survive (R1306); no server round trip may be added
**Scale/Scope**: one tab. Four files changed, one pure module added, one shared parameter removed

## Constitution Check

*GATE: checked before Phase 0, re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| **I. Sub-apps self-contained** | PASS. Everything is inside `app/family/**` and `lib/family/**`. No shared portfolio component is touched |
| **II. Test-first for logic (NON-NEGOTIABLE)** | PASS by design. The window arithmetic is pure and lands in `lib/` with its tests first; the drag/visual layer is verified by the browser pass. See Phase 2 ordering |
| **III. Accessible and touch-first** | PASS, and this phase *improves* it: the arrows gain honest distance labels (FR-1306), and the swipe stops being the only way to reach five of seven days. Touch targets and the pager's keyboard equivalent are unchanged |
| **IV. Layered, boundary-enforced architecture** | PASS. New pure logic goes in `lib/family/meals/`, consuming `lib/family/calendar/` — `lib` importing `lib`. No component imports across feature folders |
| **V. Quality gates (NON-NEGOTIABLE)** | PASS. Four gates plus the browser pass, no suppressions. One extra obligation: `openOn` becomes unused and must be *removed*, not left for fallow to flag |
| **VI. Degrade gracefully** | PASS. No new failure mode: no new read, no new write, no new storage. A grid that cannot measure itself falls back to a default count exactly as the Calendar's does |
| **VII. Private by default** | PASS. Nothing leaves the project; no new cookie (R1302), no new payload, no identifying value stored |
| **VIII. Fidelity is specified, not a vibe** | PASS, and this is the principle doing the most work here. The `[VERIFIED]` 7-column grid is preserved. The navigation is `[UNKNOWN]` and the research inferred Calendar parity, which Phase 6 departed from as its Assumption 3 — reversed on the record. The one further step from the reference (anchoring on today rather than the week's start) was put to the operator with its alternative and is recorded in Clarifications |

**No violations. No complexity deviations to justify.**

## Project Structure

### Documentation (this feature)

```text
specs/013-meals-navigation/
├── NOTES.md             # the report, and the measurements taken before speccing
├── spec.md              # requirements, criteria, clarifications
├── research.md          # Phase 0 — R1301..R1307
├── data-model.md        # Phase 1 — the window, and what it replaces
├── quickstart.md        # Phase 1 — how to run it and verify each guarantee
├── plan.md              # this file
└── checklists/
    └── requirements.md  # spec quality validation
```

### Source code

```text
lib/family/meals/
├── window.ts            # NEW — the pure window: days from an anchor, the step, the label
└── week.ts              # week helpers; weekDatesOf/shiftWeek retire, dayWordsOf/dayHeaderOf stay

lib/family/__tests__/unit/
└── meals-window.test.ts # NEW — the arithmetic, first

app/family/(app)/meals/components/
├── useMealWindow.ts     # NEW — replaces useMealWeek: measured count in, window + nav out
├── useMealWeek.ts       # DELETED
├── MealsBoard.tsx       # stops calling useColumnPage; renders the window's own columns
└── WeekNav.tsx          # arrows say their distance; label describes the days shown

app/family/(app)/components/
└── ColumnPager.tsx      # `openOn` REMOVED — added 2026-09-10, unused once Meals stops calling it

e2e/specs/
└── meals.spec.ts        # journeys for the arrows at phone and wall widths
```

## Phase 0: Research

**Complete** — [research.md](./research.md). Seven findings, each from shipped code or a measurement:

- **R1301** the defect is confined to widths where seven columns do not fit; the wall is already right
- **R1302** no device-width cookie — CLS is 0, measured, and the anticipated 012 problem does not arise
- **R1303** `useColumnPage` steps one column *by design* for three Profile boards; Meals needs its own
- **R1304** one window replaces week-plus-slice; the arithmetic of keeping both does not close
- **R1305** the anchor is today at every width — the operator's decision, with its alternative recorded
- **R1306** 006's midnight hold survives, and is the subtlest thing to get right
- **R1307** the labels are part of the fix; the shipped "Previous week" will be a lie under the new rule

**No `NEEDS CLARIFICATION` remained.**

## Phase 1: Design

**Complete** — [data-model.md](./data-model.md) and [quickstart.md](./quickstart.md).

No contracts directory. This phase exposes no interface: no route handler, no server action, no schema,
no external surface. Its whole contract is what the grid draws and what the arrows move, which is
`spec.md`'s requirements and the journeys that check them.

### The shape of it

**One value replaces two pieces of state.** Today: `useMealWeek` holds an anchor and derives seven
dates from the household's week start, while `useColumnPage` holds which slice of those seven is
visible. After: `useMealWindow` holds an anchor and a measured count, and derives the visible days
directly. There is no slice, because there is nothing to slice.

**The measurement stays where it is.** `useBoardGeometry(columnCount, { widthToken:
"--fam-meal-cell-w" })` already reports `layout.perRow`. That number becomes the window's width instead
of an argument to a pager. Nothing new measures anything.

**The transform must survive.** R1302 explains that Meals is CLS 0 partly because the visible slice is
drawn as a translate rather than a different number of mounted columns. A window that mounts exactly
its own columns changes that — so the design keeps the pager's element structure and feeds it a window
whose length already equals `perRow`, rather than replacing the strip with a shorter list. **This is
the one place a careless implementation reintroduces a layout shift**, and FR-1310 is the assertion.

## Phase 2: Task ordering (for `/speckit.tasks`)

Test-first is non-negotiable (constitution II), and the useful consequence here is that the hard part
is pure:

1. **`lib/family/meals/window.ts` + its tests, together, tests first.** Days from an anchor; the step;
   abutment; the label across month and year boundaries; one column. All pure, all cheap to get right.
2. **`useMealWindow` + its tests.** The anchor is *initialised* to today and then held (R1306) — the
   midnight rule asserted directly, because no browser test can cross midnight.
3. **`MealsBoard` and `WeekNav`.** Wire the window through; retire the `useColumnPage` call; labels.
4. **Remove `openOn` from `ColumnPager`** and its tests. Verify Tasks, Lists and Rewards journeys are
   untouched (FR-1309, SC-1307) — the point at which this phase could quietly break three other boards.
5. **`meals.spec.ts` journeys.** The arrows at 390px and 1280px; abutment over several steps; today on
   open; the labels' distance.
6. **Measure CLS at 390, 768, 1024 and 1280px** and record it beside the baseline. FR-1310 has a
   number to hit, not a hope.
7. **The gates**, then the browser pass, then the run record.

## Complexity Tracking

No deviations. The phase *removes* state rather than adding it: two pieces become one, and a parameter
added earlier the same day is deleted rather than kept for symmetry.
