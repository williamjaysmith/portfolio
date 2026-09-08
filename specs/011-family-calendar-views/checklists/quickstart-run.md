# Quickstart run record — 011 The Calendar's Other Views

**Run**: 2026-09-08 · **Branch**: `011-family-calendar-views` · **Stack**: local (553xx)

## The gates

| Gate | Result |
|---|---|
| `npm test` | **3252 passed** |
| `npm run typecheck` | clean |
| `npm run fallow:audit` | clean — no new findings, no threshold moved, nothing suppressed |
| `npm run lint` | pre-existing only (the legacy React-19 batch in `app/colectivo/**` and `app/components/**`); this branch adds none |
| `npm run test:policies` | **unchanged, and that is the point** — this phase adds no migration, no action, no query and no policy |
| `npm run test:e2e` | see below |

**No `supabase db push`.** This phase stores nothing new.

## What the browser pass found — three real defects, all fixed

The e2e journeys did their job on their first run. None of these would have been caught by the unit
suite, and two are the kind a household notices immediately.

1. **34 accessibility violations in Month view.** The grid claimed `role="grid"` with rows whose
   cells were not their own children and a header row outside the grid — `aria-required-children` and
   `aria-required-parent`, both **critical**. Fixed by dropping the ARIA grid roles entirely rather
   than repairing the structure: `role="grid"` promises two-dimensional arrow-key navigation this
   view does not implement, so claiming it told assistive technology something untrue. It is now a
   labelled group of dated controls, and every cell's own control carries its full date.
2. **Colour contrast on the neighbouring months' days.** `opacity-50` on the whole cell pushed event
   titles below the AA floor. Fixed by setting those cells back with a **background** instead: an
   event on the 31st of August is a real event a household must still be able to read on September's
   grid.
3. **The top bar overflowed off-screen at 320px.** Phase 8 added a search box and this phase a view
   switcher; five controls do not fit one line on the narrowest iPhone, and the switcher was pushed
   out of the viewport where it could not be tapped. **This is the same class of defect the operator
   reported from their own phone during Phase 7.** Fixed by letting the row wrap — a second line on a
   phone, nothing at any width that fits.

Three of the journeys were also wrong on their first run and were fixed rather than weakened: the
menu closes by its own control and not Escape; the month-grid assertions had to follow the corrected
semantics; and four events "on one day" were being created in the same time slot, where they collide
instead of stacking.

### And a fourth, which corrects a conclusion from Phase 8

The first full pass on this branch failed **16 journeys** across four shipped spec files — all of
which passed when run on their own. The cause was a describe-level
`test.use({ viewport: { width: 320, height: 568 } })` in the new spec: **the narrower viewport leaked
into the tests that ran after it**, in this file and in every file that follows it alphabetically. A
Week-view journey measured at 320px draws three columns instead of seven, and one that reloads and
counts a daily repeat's blocks then finds none.

**Phase 8's `preview-bar.spec.ts` has the same describe, written the same way** — and it sits
immediately before `punch-in`, `rewards`, `shell`, `smoke` and `tasks` in file order. Phase 8's run
record concluded that two failing `phone` journeys were "pre-existing flakes", having measured them
against `main` three times each. That measurement was sound but the conclusion may not have been:
`main` at that point already contained the leaking describe. **Both files are now fixed** — the
width-specific journeys are tagged `@responsive` and left to the tablet and phone PROJECTS, which is
what the suite has for exactly this (harness.md §4).

The honest status: the two journeys Phase 8 recorded as flaky should be re-measured now that the leak
is gone. If they stop failing, that record's conclusion was wrong and this is why.

## The guarantees

| # | Guarantee | How it was proved |
|---|---|---|
| SC-1101 | The switcher moves between three and remembers | e2e, including a reload |
| SC-1102 | Day is one day and steps by one | e2e — and the arrows say "day", which is how a screen reader tells it from a week |
| SC-1103 | Month draws every month correctly | Unit across a full year, both start-of-week settings, a leap February and a six-row month |
| SC-1104 | Four events give two and an accurate count | Unit at 0, 3, 4 and 9; e2e end to end into the day's list |
| SC-1105 | A multi-day event spans once per week row | Unit across one, two and five rows and off both edges |
| SC-1106 | Month steps by a calendar month | Unit from every month, both year boundaries, and a leap February |
| SC-1107 | The preview bar behaves the same in all three | e2e, including vanishing when empty |
| SC-1109 | The decisions are unit-tested | 68 new tests, all pure |
| SC-1110 | Phase 2's criteria still pass | `layout.test.ts`, `week-geometry.test.ts` and `use-week-anchor.test.ts` pass **untouched** — R1115's bar |
| SC-1111 | Narrow widths work | e2e at 320px, after defect 3 above was fixed |

## The honest gap

**Nothing here claims our Month view LOOKS like the reference's.** No image of it exists anywhere in
the research corpus (R1101) — `07-visual-design-system.md` says only that it is not present in any
image, which the master map wrongly reported as "never documented". Its behaviour, capacities,
settings and gestures *are* documented across five articles and are what these tests hold us to.

## Outstanding for the operator

1. The three views on a real iPhone. The automated pass asserts the document does not scroll
   sideways at 320px, which is a floor rather than the whole check — and the top bar now wraps, which
   is worth seeing.
2. Nothing else. No hosted migration, no deploy-order constraint.
