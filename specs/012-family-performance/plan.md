# Implementation Plan: What the Household Waits For

**Branch**: `012-family-performance` · **Spec**: `spec.md` · **Run record**:
`checklists/quickstart-run.md`

## How this phase was actually built, and why it is not the usual shape

The Spec Kit flow is `specify → clarify → plan → tasks → implement`, and it is the right flow for a
feature: the specification is written first because nobody knows what the feature is until it is.

A performance phase inverts that. **The work cannot be enumerated before it is measured**, because
the whole question is which of a dozen plausible costs is the real one — and this phase's own record
shows four plausible costs that turned out to be nothing. A `tasks.md` written before the
measurements would have been a list of guesses, and the value of the exercise would have gone with
it.

So this phase ran **measure → change → measure → record**, in two passes, and the specification and
this plan were written from what the measurements found. There is **no `tasks.md`**, deliberately,
and this paragraph exists so that absence reads as a decision rather than an omission. Every other
gate the constitution sets was met in full and in the usual order.

## The two passes

**Pass 1 (`c34ef2e`) — the reads nobody asked for.** Found by listing the client requests of a
calendar load and asking, of each, which surface needs it. Three did not: `lists` was read on every
calendar load because the meal popover is mounted there for its tokens and its model ran whether or
not anything was open; the reminder banner's two task reads ran on every page of every tab even for a
household with both task notifications off. Separately, the server render's one-then-four wave was
reordered to four-then-one, because only the events read needs the settings.

**Pass 2 (`78ee252`) — the measurement a server cannot take.** Found by tracing the production build
at a phone's width, which is the first time this project had looked at that: CLS 0.18, from the grid
painting seven columns and re-laying-out to three. One root cause, three costs — the shift, a seeded
seven-day fetch the device discards, and the three-day fetch it then makes instead. One fix: let the
device tell the server how wide it is.

## Structure

Nothing here is a new layer. Every change lands in a layer this project already has, which is the
test of whether a performance change has understood the codebase or merely pushed on it.

| Layer | File | What it holds |
|---|---|---|
| `lib` (pure) | `lib/family/calendar/device-columns.ts` | **New.** The cookie's name, what values are accepted back, how it is scoped. Framework-free and unit-tested; the only place the rule lives. |
| `lib` (reads) | `lib/family/queries.ts` | `enabled` on `useLists`, `useTasks`, `useTaskResolutions`. Every existing caller passes nothing and behaves exactly as it did. |
| page (server) | `app/family/(app)/calendar/page.tsx` | Reads the cookie through one named helper, `seededColumnCount`; fetches that many days; passes the count down. |
| component (client) | `calendar/components/useGridGeometry.ts` | Takes the server's count as the pre-measurement value, so the first client render agrees with the markup. |
| component (client) | `calendar/components/useRememberedColumns.ts` | **New.** One line of DOM: the measured count back into the cookie, Week view only. |
| component (client) | `calendar/components/WeekView.tsx` | Threads the count; `seedFor` compares against it rather than the default. |
| component (client) | `components/notifications/useDueReminders.ts` | `useTaskReads` — the gate, extracted because adding it put the hook over its cognitive budget. |
| component (client) | `components/notifications/ReminderBanner.tsx` | Inert card, live controls. |
| component (client) | `meals/components/MealSurfaces.tsx` | `listsStateOf` — a pure helper, so "idle" and "loading" stop being the same state. |

## Why a cookie, and not the device store this project already has

Every other per-device choice in `/family` lives in `localStorage` through `deviceStorage.ts`. This
one cannot: **the server has to read it before it renders**, and a cookie is the only channel a
browser has that runs before the response. `localStorage` would have fixed nothing — the shift comes
from the server's markup, which is painted long before any script runs.

## Test strategy

Pure logic is unit-tested; the browser proves the rest.

- `lib/family/__tests__/unit/device-columns.test.ts` — every count a grid can produce survives the
  round trip, and **nothing else does**: out of range, non-integer, empty and injected values are
  refused rather than clamped, because a clamp would invent a measurement no device took.
- `calendar/components/__tests__/WeekView.test.tsx` — jsdom measures nothing, so what it renders *is*
  a real browser's pre-measurement paint. The new journey pins that the columns and the paging step
  both come from the server's count, which are the two places a reverted constant would put the seven
  columns back on a phone's first frame.
- `components/notifications/__tests__/useDueReminders.test.ts` — the gates are asserted as
  conditions: both reads disabled before the clock, both enabled and keyed to today's week after it.
  The epoch read is named in the test so it cannot come back silently.
- The browser pass (`e2e/`) is the phase gate, as always.

## What this phase also fixed in the suite that guards it

Found while re-running the gate, and both are defects in the harness rather than the app — recorded
because a gate that lies is worse than no gate:

- **The meals journey failed every Wednesday** and had since Phase 6: it clicked today's Lunch, and
  the seed plants a Lunch on `sunday + 3`. It now reads an actually-empty mealtime off the grid.
- **A describe-level `test.use({ viewport })` leaked** into later tests across files. Retagged
  `@responsive` and removed. This also corrected a wrong conclusion in Phase 8's run record, where two
  failures had been called pre-existing flakes.
