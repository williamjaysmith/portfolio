# Implementation Plan: The Calendar's Preview Bar

**Branch**: `009-calendar-preview-bar` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)
**Input**: `/specs/009-calendar-preview-bar/spec.md`

## Summary

Three pieces of documented calendar chrome that Phase 2 named and deferred, plus the search that
completes the reference's per-tab model.

**Countdowns** become real end to end: a switch on the event form writes the `countdown_enabled`
column that has been in the schema since `010_events.sql` with nothing reading it, a household
setting decides how early they appear, and the calendar draws them above the week with the number of
days falling at the household's midnight. **Tasks Progress** wires the Filter toggle Phase 2 withheld
to the completed-of-total rule `lib/family/tasks/counters.ts` already owns. **Event search** finds a
series by title and takes the calendar to the day it next falls on.

The shape is Phase 6's: **one row under the all-day band, drawn by `WeekView`, absent when it has
nothing to say** — `MealRow`'s three properties, in a sibling component. One migration (the settings
column), no new table, no new policy, and no second definition of a day or a completed chore.

## Technical Context

**Language/Version**: TypeScript 5 (strict) · Next.js 16.1.6 App Router · React 19.1.0
**Primary Dependencies**: TanStack Query 5, Zod 4, Tailwind 4, lucide-react. No new dependency.
**Storage**: Supabase Postgres, `family` schema. **One migration**: `show_countdowns` on
`household_settings`. `events.countdown_enabled` already exists and is already carried across a
series split (038).
**Testing**: Vitest 4 (`unit` jsdom, `policies` node) + Playwright (`007-family-e2e`).
**Target Platform**: the household's wall tablet, two phones, installed as a PWA.
**Project Type**: web application — a feature module under `app/family/(app)/` over `lib/family/`.
**Performance Goals**: the switch off costs the calendar **zero** additional requests; on, it shares
the Tasks tab's household-keyed cache entries (R905). The bar re-renders on the shell's existing
minute clock, never on a clock of its own (R902).
**Constraints**: every write keeps its punch-in gate and its FR-288 refusal; the four quality gates
with no suppressions; `lib` never imports from `app/**`; the e2e suite must never reach the hosted
project.
**Scale/Scope**: one household. Hundreds of events, tens of tasks, five Profiles.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

| Principle | How this phase satisfies it |
|---|---|
| **I** — one household, one shared door | No new identity, no new account. The countdown switch and the setting are ordinary parent-gated writes. |
| **II** — test-first, behaviour-covered | Every decision is a pure function with its own test (R912): days remaining, which countdowns are in force, the next-occurrence walk, the rotation order, the search's result shaping. The browser layer proves the wiring. |
| **III** — the four gates, no suppressions | `fallow:audit`, `test`, `typecheck`, `lint`. The new logic is small and pure, which is what keeps CRAP under the threshold — coverage, not a threshold lift. |
| **IV** — layer boundaries | Decisions in `lib/family/countdowns/**` and `lib/family/queries.ts`; React in `app/family/(app)/calendar/**`. No `lib` → `app` import. |
| **V** — writes are gated and honest | The countdown switch rides `updateEvent`'s existing actor gate and scope prompt; the setting rides `updateHouseholdSettings`, parent-only and server-enforced. Nothing is queued (`[P2]` FR-288). |
| **VI** — the reference is the spec, not a vibe | Every requirement carries its tag; the seven `[UNKNOWN]`s are numbered assumptions. |
| **VII** — no child's data leaves this project | No new outbound anything. R914 declines the reference's automatic emoji rather than reach a model with an event title. |
| **VIII** — only `[VERIFIED]` is asserted | Enforced item by item; the checklist records the audit. |

### Re-check after Phase 1 design

Passed. The design adds one column, one query, two pure modules, one hook per feature and four
components. Nothing in it needs an exception, and the Complexity Tracking table below is empty.

### Complexity Tracking

None. No violation to justify.

## Project Structure

### Documentation (this feature)

```text
specs/009-calendar-preview-bar/
├── plan.md              # this file
├── spec.md              # FR-901…FR-921, SC-901…SC-912, 7 assumptions, 6 divergences
├── research.md          # R901…R915
├── data-model.md        # the one column, the one query, and what is derived
├── quickstart.md        # how to run it, verify each guarantee, and what to do when it fails
├── contracts/
│   └── server-actions.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks output — not written by /speckit.plan
```

### Source Code (repository root)

```text
supabase/migrations/
└── 039_show_countdowns.sql                     NEW — one column, one check constraint

lib/family/
├── countdowns/                                  NEW zone `family-countdowns-core`
│   ├── days.ts                                 NEW — daysUntil, the day itself, the past (R902)
│   ├── target.ts                               NEW — a countdown's date, over next-occurrence (R903)
│   ├── inforce.ts                              NEW — the three Show Countdowns windows (FR-903)
│   └── rotation.ts                             NEW — which countdowns hold the first position (FR-908)
├── calendar/                                   zone `family-calendar-core`
│   ├── next-occurrence.ts                      NEW — the ONE bounded walk, read by both below (R903)
│   └── search.ts                               NEW — result shaping, one row per series (R908)
├── types.ts                                    +showCountdowns, +countdownEnabled on the inputs
├── rows.ts                                     +show_countdowns mapping
├── validation.ts                               +the enum, +the boolean
├── queries.ts                                  +fetchEventSearch / useEventSearch (R908)
└── actions/events.ts                           createEvent writes the flag; updateEvent patches it

app/family/(app)/
├── calendar/components/
│   ├── PreviewBar.tsx                          NEW — the row itself (R901)
│   ├── CountdownChips.tsx                      NEW — the chips and their rotation
│   ├── CountdownList.tsx                       NEW — the full list a tap opens (FR-909)
│   ├── TasksProgressRow.tsx                    NEW — mounted only when the switch is on (R905)
│   ├── EventSearch.tsx                         NEW — the control and its results (R908)
│   ├── useCalendarPreview.ts                   NEW — the bar's one data path
│   ├── useTaskProgress.ts                      NEW — the four board reads + counters.ts (R906)
│   ├── useCountdownSwitches.ts                 NEW — per-device: Tasks Progress, Pause (R907)
│   ├── useWeekAnchor.ts                        +openAt(date) (R909)
│   ├── EventForm.tsx                           +the Countdown switch row
│   ├── EventDetails.tsx                        +the status under the title (FR-906)
│   └── WeekView.tsx                            mounts the bar and the search
└── components/
    ├── FilterSheet.tsx                         +the Calendar section's two switches
    └── settings/HouseholdSection.tsx           +Show Countdowns in CHOICES

e2e/specs/preview-bar.spec.ts                   NEW — the browser journeys (R912)
```

**Zones**: `lib/family/countdowns/**` becomes a fallow zone of its own,
`family-countdowns-core`, allowed to import `family-calendar-core`, `family-recurrence` and `lib` —
the shape every other `*-core` zone already has. `next-occurrence.ts` and `search.ts` join
`family-calendar-core`'s patterns, which is what keeps the dependency one-way: the walk is calendar
logic that a countdown reads, not countdown logic that the calendar reads.

**Structure Decision**: the shipped feature-module layout, unchanged. Every decision is a pure
function under `lib/family/`, every hook and component under the calendar's own folder, and the two
cross-cutting surfaces — the Filter sheet and the Settings screen — gain one section each.

## Implementation phasing

Ordered so each user story is independently testable at the point it lands, per the spec's priorities.

1. **Foundational** — the migration, the type and row mapping, the validation, and `openAt`. Nothing
   is visible yet; the policies test proves the new column is refused to an anonymous reader.
2. **US1, the countdown end to end** (P1) — the write path, `days.ts`, `target.ts`, the bar's first
   form, and the status under the title. Testable alone: mark one, see it, cross a midnight.
3. **US2, more than one** (P2) — `rotation.ts`, the tap, the full list, and the pause switch.
4. **US3, when it appears** (P3) — `inforce.ts` and the Settings field.
5. **US4, Tasks Progress** (P4) — `useTaskProgress`, the row, the Filter switch.
6. **US5, search** (P5) — the query, `search.ts`, the control and its results.
7. **Polish** — the e2e journeys, the phone-width layout, the accessibility sweep, and R915's
   corrected `EventDetails` test.

## Risks

- **The bar competes for vertical space on a phone.** The band already carries day headers, the
  all-day bar and the meal tokens. Mitigated by R901's absent-when-empty rule and by the phone-width
  journey being part of the definition of done, not an afterthought — this is the same surface the
  operator has already reported spilling on an iPhone.
- **Tasks Progress pulls the board's reads onto the calendar route.** Mitigated by R905: mounting is
  the `enabled`, and three of the four reads are household-keyed, so the cost is shared, not doubled.
- **The next-occurrence walk is a day-by-day loop.** Mitigated by R903's 400-day bound, which is a
  named constant with its own test rather than a number in a loop.
- **Two shipped tests assert the absence of what this phase adds.** R915 names them and says which
  half changes and which half must not.
- **The hosted migration.** R913: pushed with the operator's approval before the merge, never after.

## Progress

- [X] Phase 0 — research complete (R901–R915)
- [X] Phase 1 — data model, contracts and quickstart written; constitution re-checked
- [ ] Phase 2 — `/speckit.tasks`
