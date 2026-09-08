# Implementation Plan: The Calendar's Other Views

**Branch**: `011-family-calendar-views` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

## Summary

The view switcher, the Day view and the Month view — three of the reference's four, of which this
project has shipped only the Week.

The work is **very unevenly spread**, and the plan is ordered by that rather than by the spec's
narrative. The **switcher** is a labelled control and a per-device value. **Day view** is nearly free:
the shipped window primitive already accepts one day, `layoutWeek` already accepts one column, and
`occurrenceOnDay` already expands over a one-day window in production — one clamp in
`useGridGeometry` is the only thing in the way. **Month is most of the phase**, because nothing in
the shipped grid transfers: its hit-testing, its overflow, its spans and its paging arithmetic all
assume a single row of day columns (R1104).

**No migration, no server action, no new query, no policy change** (R1112). Everything here is
drawing.

## Technical Context

**Language/Version**: TypeScript 5 (strict) · Next.js 16.1.6 App Router · React 19.1.0
**Primary Dependencies**: TanStack Query 5, Tailwind 4, lucide-react. No new dependency.
**Storage**: none added. The chosen view is a per-device value in the browser's own storage.
**Testing**: Vitest 4 (`unit`) + Playwright (`007-family-e2e`). The `policies` project gains nothing,
because nothing new is exposed.
**Target Platform**: the household's wall tablet, two phones, installed as a PWA.
**Performance Goals**: switching view MUST NOT refetch what is already cached for the same days; a
month window is one read of 35 or 42 days, keyed by its own range.
**Constraints**: the Week view's behaviour is unchanged and its tests stay untouched (R1115); the
four gates with no suppressions; `lib` never imports from `app/**`.
**Scale/Scope**: one household, hundreds of events.

## Constitution Check

| Principle | How this phase satisfies it |
|---|---|
| **I** — one household, one door | No identity change; no new write path at all |
| **II** — test-first, behaviour-covered | Every decision is a pure function with its own test: the month window, the overflow arithmetic, the span segmentation, the month step, the view store (R1114) |
| **III** — four gates, no suppressions | The month layout is the one place complexity could bite; it is split by shape — window, placement, overflow, spans — rather than written as one function |
| **IV** — layer boundaries | `lib/family/calendar/month.ts` joins `family-calendar-core`; React stays under `app/family/(app)/calendar/**` |
| **V** — writes gated and honest | This phase adds no write. Every write reachable from a new view is the shipped one, with its gate and its FR-288 refusal |
| **VI** — the reference is the spec | Every requirement carries its tag; eight `[UNKNOWN]`s are numbered assumptions |
| **VII** — no child's data leaves | Nothing outbound is added |
| **VIII** — only `[VERIFIED]` asserted | Enforced item by item; the audit that rejected 25 claims is recorded in the checklist |

### Re-check after Phase 1 design

Passed. The design adds one pure module, one geometry option, one per-device store, one shell and
three renderers. The Complexity Tracking table is empty.

## Project Structure

```text
lib/family/calendar/
├── month.ts                          NEW — the month window, the grid's rows, the overflow
│                                           arithmetic and the span segmentation (R1105, R1107–R1109)
└── views.ts                          NEW — the three view names and what each one's window is

lib/family/
└── week-geometry.ts                  unchanged — MIN_COLUMN_COUNT keeps its FR-278 meaning

app/family/(app)/calendar/
├── page.tsx                          seeds the server-rendered window for whichever view opens
└── components/
    ├── CalendarScreen.tsx            NEW — the view-agnostic shell: the top bar, the preview bar,
    │                                       the editor, and whichever view is showing (R1110)
    ├── ViewSwitcher.tsx              NEW — one control whose label is the current view (FR-1101)
    ├── useCalendarView.ts            NEW — the per-device view choice (R1111)
    ├── DayView.tsx                   NEW — the week's grid at one column (R1103)
    ├── MonthView.tsx                 NEW — the month grid
    ├── MonthCell.tsx                 NEW — a day cell, its events and its overflow control
    ├── MonthDayList.tsx              NEW — the full list "+ More" opens (FR-1111)
    ├── useMonthOccurrences.ts        NEW — the month window's read, expansion and placement
    ├── useGridGeometry.ts            +an optional fixed column count (R1103)
    ├── useWeekAnchor.ts              +a per-view step and derivation (R1106)
    └── WeekView.tsx                  loses the chrome that moves to CalendarScreen; keeps its grid

e2e/specs/calendar-views.spec.ts      NEW — the browser journeys
```

**Structure Decision**: the shipped feature-module layout. The one structural change is
`CalendarScreen`: `WeekView` currently owns the top bar, the preview bar and the editor as well as
the week's grid, and two more views cannot each own a copy of those. What moves is exactly the
view-agnostic part; the week's grid, its drag and its geometry stay where they are.

## Implementation phasing

1. **Foundational** — `views.ts`, the per-device store, and `useGridGeometry`'s fixed count. Nothing
   visible; the geometry test gains the new path and keeps every old one.
2. **US1, the switcher** (P1) — extract `CalendarScreen`, add the control, and prove the Week view is
   unchanged behind it. This is the riskiest step for regressions and so it comes before any new view.
3. **US2, Day view** (P2) — one column, its own step. Testable alone.
4. **US3, Month view** (P3) — `month.ts` first, test-first, then the grid, the cell, the overflow and
   the day list. The largest step by far.
5. **US4, the chrome** (P4) — the preview bar across every view, and `countdownSlotsFor` generalised.
6. **Polish** — the e2e journeys, the narrow-width pass, the accessibility sweep, the gates.

## Risks

- **The extraction in step 2 is where a regression would hide.** Mitigated by doing it before any new
  view exists, so a red Week test means the extraction and nothing else.
- **The month layout is the phase's complexity budget.** Mitigated by splitting it by shape in
  `month.ts` and unit-testing each part before a component renders it.
- **`useWeekAnchor` is shared with the shipped view.** Mitigated by keeping its type, its `?on=` seed
  and its `openAt` untouched and making only the step and the derivation per-view (R1106).
- **No image of Month view exists anywhere** (R1101). Fidelity here is behavioural, and the plan does
  not pretend otherwise.

## Progress

- [X] Phase 0 — research (R1101–R1115)
- [X] Phase 1 — plan; no data model and no contracts, because nothing is stored or exposed (R1112)
- [ ] Phase 2 — `/speckit.tasks`
