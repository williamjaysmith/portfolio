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
| `npm run test:e2e` | **NOT ESTABLISHED — see "the browser pass is unfinished" below.** Do not read this phase as gate-complete |

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

## A fourth real defect, found by the gate run of 2026-09-09

**The view menu could not be closed by the control that opened it.** The outside-tap overlay was
`z-10` and the switcher button sat below it, so while the menu was open the overlay swallowed a
second tap on the button — a household that changes its mind taps "Week" again and nothing happens.
Fixed by lifting the button above the overlay; it has a unit test of its own now.

That makes **four real defects this phase's browser pass has found in this phase's own code**, none
of which the unit suite could have caught: the ARIA structure, the contrast, the overflow at 320px,
and this.

## The browser pass is unfinished, and this is the state it is in

**The phase gate has not been met.** `npm run test:e2e` has not produced a result I am willing to
report, and this record does not invent one.

What is established:
- The 19 new journeys in `calendar-views.spec.ts` pass **19/19** on their own.
- `calendar-views.spec.ts` followed by `calendar.spec.ts` passes **27/27** — the pair that had
  reproduced the viewport leak most reliably.
- The four other gates are green.

What is not:
- A trustworthy full-suite run. **Three attempts on 2026-09-08 were killed for low memory**, one
  after 13.4 minutes against a normal seven, each kill stranding a dozen Chrome processes. A
  completed run on 2026-09-09 gave **131 passed / 10 failed in 17.4 minutes** — still two and a half
  times normal, so still heavily loaded.

### Final state, 2026-09-09

Seven full-suite runs. **Failure counts on identical code moved between 10, 12, 15 and 23** — the
strongest single fact here, because deterministic breakage does not do that.

Everything ruled out, each by an experiment rather than an argument:
- **Not time or server degradation** — `preview-bar.spec.ts` at `--repeat-each=3`, 56 tests in one
  server session: 56/56.
- **Not a cascade from the failing meals journey** — meals + notifications + preview-bar together:
  only meals failed, 34/36.
- **Not the two-browser `live` spec** — live + preview-bar: 22 passed, 2 skipped.
- **Not accumulated database rows** — the events table holds exactly the seed's 13 after a run.
- **Not the viewport leak, the banner, or the month read** — all three were real, all three are fixed,
  and all three changed the failing set without emptying it.

What remains: every failing journey passes alone, in pairs, in triples and repeated; they fail only
inside the full 140-test invocation, at 11–12 second timeouts on event creation. That is
resource-shaped, and this machine killed three earlier runs outright for memory.

**This is not proof, and one earlier version of this record made the same claim and was wrong** — a
quieter machine then failed WORSE, which killed that hypothesis and led to the month-read bug. The
difference now is that the alternatives above have each been tested and eliminated, rather than
merely argued against.

**What this phase's own journeys do**: `calendar-views.spec.ts` passes 19/19 alone, and every
configuration it has been run in.

**Five real defects were found by this suite and fixed** — the ARIA structure, the contrast on
adjacent-month days, the 320px overflow, the view menu's overlay, the Week view fetching a month of
events — plus two in other phases' code: the reminder banner covering every tab's controls, and a
meals journey that had failed every Wednesday since Phase 6.

---

**The earlier reasoning, kept because it was wrong in an instructive way:**

**The evidence now points at the environment, and here is why rather than merely that:**
- **Every failing journey passes when run on its own.** All of them, repeatedly, including the two
  this phase owns.
- **The failing set changes between runs** — 13, then 10, then 3, on different tests each time.
  Broken code does not move around.
- **`meals.spec.ts:38` failed on all four projects at exactly 1.0 minute each** — a timeout signature,
  not a behaviour.
- **Wall-clock is the clearest signal**: a suite that takes seven minutes on a quiet machine took
  seventeen. Timing-sensitive journeys — the clock-pinned banners, the swipes, the punch-in sheet —
  fail first under that.

This is a claim about likelihood, not a proof, and the gate is still unmet. **What to do**: run
`npm run test:e2e` once on a quiet machine. Green means merge. If the same journeys fail *and* the
run takes about seven minutes, the cause is the branch and the top bar's new wrap is the first place
to look.

## The honest gap

**Nothing here claims our Month view LOOKS like the reference's.** No image of it exists anywhere in
the research corpus (R1101) — `07-visual-design-system.md` says only that it is not present in any
image, which the master map wrongly reported as "never documented". Its behaviour, capacities,
settings and gestures *are* documented across five articles and are what these tests hold us to.

## Outstanding for the operator

1. **A full `npm run test:e2e` on an unloaded machine** — the phase gate, unmet above.
2. The three views on a real iPhone. The automated pass asserts the document does not scroll
   sideways at 320px, which is a floor rather than the whole check — and the top bar now wraps, which
   is worth seeing.
3. Nothing else. No hosted migration, no deploy-order constraint.
