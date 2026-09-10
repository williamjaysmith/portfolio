# Research: The Meals Tab Navigates Like the Calendar

**Phase 0** · branch `013-meals-navigation` · 2026-09-10

Every finding here was taken from the shipped code or from a measurement on a production build, before
any of this phase's code existed. Where a number is quoted, the harness that produced it is named.

---

## R1301 — The defect is confined to widths where seven columns do not fit

**Decision**: Treat this as a narrow-width defect, not a Meals-tab-wide rewrite.

**Measurement** (production build, signed in, 2026-09-10):

| Width | Day columns drawn | Arrow labels |
|---|---|---|
| 390px | 2 | "Previous week" / "Next week" |
| 1280px | 7 | "Previous week" / "Next week" |

At 1280px the arrows move seven days and seven days are on screen — the arrow's distance equals the
window's width, which is the Calendar's rule, satisfied by accident. At 390px two columns are drawn and
the arrows still move seven days, so five days per step are reachable only by swiping the strip.

**Rationale**: Naming the boundary keeps the change honest about what it fixes, and tells the browser
pass which widths must regress-test (`@responsive`, which this suite runs at 390, 768, 1024 and 1280).

**Alternatives considered**: Treating it as "the Meals tab is wrong" would have invited a redesign the
operator explicitly declined ("a week view for meals is good enough").

---

## R1302 — No device-width cookie. Measured, not assumed

**Decision**: Do not carry the measured column count to the server. No cookie, no `device-columns`
equivalent.

**Measurement**: Cumulative Layout Shift is **0** at 390px and at 1280px on the Meals tab.

**Rationale**: 012 fixed a CLS of 0.18 on the Calendar by exactly that mechanism
(`lib/family/calendar/device-columns.ts`), and the obvious assumption was that Meals would need the
same. It does not, for two reasons this phase can rely on:

1. **The meals read is unwindowed.** `useMeals` fetches every meal for the household (006 R605), so
   there is no server-seeded *window* that can disagree with the device. The Calendar's problem was a
   seeded seven-day window a phone never displayed.
2. **The visible slice is a transform, not a different set of columns.** The pager translates the
   strip rather than mounting a different number of columns, so the rendered box does not change
   size when the measurement lands.

**Consequence for the design**: whatever replaces the current window must preserve property 2, or it
reintroduces a layout shift that the spec forbids (FR-1310) and that nothing currently tests for,
because there has never been one to test.

**Alternatives considered**: Adding a `family_meal_columns` cookie "for symmetry" with the Calendar.
Rejected: it would be dead weight defended by an analogy rather than a measurement, and a second
cookie whose only job is to be consistent with the first is a liability.

---

## R1303 — `useColumnPage` must not change, and cannot be reused as-is

**Decision**: The Meals grid gets its own day-window navigation. `useColumnPage` is left exactly as it
is and stops being used by this board.

**Finding**: `useColumnPage` steps **one column per swipe**, deliberately:

```ts
step: (direction) => setRequested((current) =>
  pageStartOf(pageStartOf(current, columnCount, perRow) + direction, columnCount, perRow))
```

and its own test pins that as a guarantee — *"steps ONE column per swipe, so each reveals exactly one
more profile"* — against FR-396. It is shared by **four** boards: Tasks, Lists, Rewards and Meals.

**Rationale**: One column per swipe is right for **Profile** columns, where the household is revealing
people one at a time, and wrong for **day** columns, where a step should be a screenful. Adding a mode
to the shared hook would put a day-shaped rule inside the component three Profile boards depend on,
and FR-1309 exists to stop that.

**Consequence**: `openOn`, added to `useColumnPage` earlier on 2026-09-10 (`6a4ba13`) so the Meals grid
opened on today's column, becomes **unused** once Meals stops calling the hook. It must be removed
along with its tests rather than left as an unused parameter — fallow will flag it, and correctly.

**Alternatives considered**: A `step: "page" | "column"` option on `useColumnPage`. Rejected for the
reason above; the hook's single documented rule is the thing that makes it safe for three other boards.

---

## R1304 — The window replaces the week-plus-slice pair, and that is what removes the second gesture

**Decision**: Model the Meals grid as **one window** — a first day and a count — exactly as the
Calendar does. Retire the two-level "seven-day week, with a paged slice over it" structure.

**Finding**: the shipped structure is two independent pieces of state:

- `useMealWeek` → `weekDatesOf(anchor, startWeekOn)`, seven dates from the household's start day, paged
  by `shiftWeek` (±7 days);
- `useColumnPage` → which slice of those seven is on screen, paged by swipe.

**Rationale**: The reported defect is not that either piece is wrong. It is that there are two, only
one of them has labelled controls, and on a narrow screen they disagree. Any fix that keeps both has
to make them agree, and the arithmetic does not close: a page-sized step from Thursday in a Sunday
week runs past Saturday, and rolling the anchor a week while resetting the slice **skips a day**. The
window stops being a slice of a week, so the week should stop being the unit.

**What the Calendar already has, in `lib/` and therefore reusable**:

| Helper | Where | What it gives this phase |
|---|---|---|
| `viewWindowOf(anchor, days, zone)` | `lib/family/calendar/dates.ts` | a window of N days from an anchor |
| `pagedAnchor` / `anchorForToday` | `lib/family/calendar/views.ts` | the anchor's step and its live value |
| `columnCountFor(measurement)` | `calendar/components/useGridGeometry.ts` | the measured fit rule (FR-277/278) |

The first two are pure and in `lib`, so sharing them is the architecture working as intended
(constitution IV). The third is a component hook with the Calendar's own probe elements and token
names; Meals measures a different token (`--fam-meal-cell-w`) through `useBoardGeometry` and should
keep doing so. **Share the pure arithmetic; do not share the measuring.**

**Alternatives considered**: keeping the week as the data window and making the arrows drive the slice,
rolling the anchor at the boundary. Rejected on the arithmetic above — it either skips a day or needs a
remainder carried between two pieces of state, which is the two-gesture problem with extra steps.

---

## R1305 — The anchor is today, at every width, and the household's start-of-week stops applying here

**Decision**: The window begins on today. `startWeekOn` no longer decides the Meals grid's first day.

**Source**: the operator, clarified 2026-09-10 (spec → Clarifications). They were shown a
width-dependent alternative that would have preserved the wall tablet's Sunday-anchored week — on the
grounds that moving seven days from a Sunday always lands on a Sunday, so the wall could have kept its
`[VERIFIED]` week for free — and chose the single rule.

**Rationale for recording it this firmly**: this is the one decision in the phase a household could
notice and disagree with, and it is a second small step away from a `[VERIFIED]` layout. It is on the
record as a choice with an alternative, not as an oversight. It also matches what the Calendar does on
the same device (`START_ON_CURRENT_DAY = true`), so the two tabs now agree.

**Consequence**: `startWeekOn` keeps every other meaning — the anchored week the Tasks board reads
resolutions by (R314), the star week beside it (R407), `weekStartOf` everywhere else. The risk to test
is not that it becomes dead configuration but that removing its influence *here* disturbs those.

---

## R1306 — 006's midnight rule survives, and is the subtlest thing to get right

**Decision**: Keep "the shown window is HELD, not derived from the clock".

**Finding**: `useMealWeek` documents this deliberately, for the spec edge case "the date rolls over at
midnight with the grid open":

> today's marker moves with the household clock, the week stays where it was put, and Today brings the
> new week.

**Rationale**: It is the correct behaviour and the easy thing to lose. An anchor that *derives* from
today re-anchors the window under somebody mid-plan at midnight; an anchor that is *initialised* to
today and then held does not. The distinction is one line of code and invisible in any test that does
not cross midnight — which is every test, since the e2e clock helper refuses jumps over three hours
(009's finding). So this is unit-test territory, with the anchor's hold asserted directly.

---

## R1307 — The labels are part of the fix, not decoration

**Decision**: The arrows say how far they go, in the Calendar's words: "Previous 3 days" / "Next 3
days" where three columns are drawn, "Previous week" / "Next week" where seven are. The window's label
describes the days shown.

**Rationale**: The shipped arrows read "Previous week" while moving a window of two days — the label
was *correct for the old behaviour* and will be a lie under the new one. The Calendar already derives
its labels from the column count, and this is the reference's own idiom for the control
(`[VERIFIED]` that the view control's label states the current view, 011 FR-1101 — the same principle
applied to distance).

`weekLabelOf` already renders a day range rather than a week name — "7–13 September", "28 September –
4 October", "28 December 2026 – 3 January 2027" — so it needs no change, only a name that stops
claiming the range is a week.

---

## Open questions carried into the plan

**None.** The spec has no `[NEEDS CLARIFICATION]` markers, and the one decision that needed the
operator was put to them and answered before this document was written.
