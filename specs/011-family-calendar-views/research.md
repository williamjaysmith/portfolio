# Research — 011 The Calendar's Other Views

**Date**: 2026-09-08 · **Spec**: [spec.md](./spec.md) · **Branch**: `011-family-calendar-views`

Fifteen decisions, R1101–R1115. The evidence came from a five-reader pass over the dossiers and the
shipped code with an adversarial citation audit behind each reader; **25 claims were rejected** and
are not used here. What survived is recorded with the file and article it came from.

---

## R1101 — The master map is wrong about these views, and it matters twice

**Finding**: `00-master-map.md:586` lists Month, Day and Schedule as *"never photographed or
documented"*. `07-visual-design-system.md` says only the first half — **not present in any image**.
Their behaviour, capacities, settings and gestures are documented across five help-centre articles.

**Decision**: the articles govern. The master map carries **zero** Zendesk article ids across all 611
of its lines, so nothing sourced only to it can satisfy constitution §VIII.

**Why it matters twice**: this is the second time in three phases that the master map has asserted
something no article supports — `010` found its "the app opens on the Calendar tab" claim
contradicted by article `49738702477723`, and `009` found its cross-tab search unsupported. The map
is a useful index and a poor citation. Treat every `[V]` in it as a claim to check.

---

## R1102 — Day view is one column of everybody's events, not a column per Profile

**Finding**: `02-tasks-and-rewards.md:60` and `:87` describe per-Profile columns in a "Day view". Both
cite article **36846381293979** — *Using the Tasks Tab*. They are the **Tasks board's** day view, not
the calendar's.

**Decision**: the calendar's Day view is one day over the hour grid, everybody's events together.

**What settles it**: the calendar Day view's documented capacity is counted in **events per screen**
— "up to ten in landscape, sixteen in portrait" `[V](48026687853083)` — a number that makes no sense
per Profile. And the current-time bar is documented for the time-gridded views.

**Why it is written down**: reading those two lines onto the calendar would have produced a Day view
the reference does not have, and it would have looked like fidelity.

---

## R1103 — Day view is nearly free, and one constant is why it is not free already

**Finding**: the pure layer already admits a one-day window. `viewWindowOf(anchorDate, days, zone)`
accepts any whole day count ≥ 1; `layoutWeek`'s guard rejects only an **empty** column list;
`occurrenceOnDay` — shipped in Phase 8 for the countdown list and the search — **already expands over
a one-day window in production**.

**The one blocker**: `columnCountFor` in `useGridGeometry.ts` clamps the measured fit to
`[MIN_COLUMN_COUNT = 3, MAX_COLUMN_COUNT = 7]`. A Day view cannot ask for one column.

**Decision**: `useGridGeometry` takes an optional **fixed column count**. Given one, it skips the
measured fit and reports that; given none, it behaves exactly as it does today. Day view passes 1.
`MIN_COLUMN_COUNT` keeps its meaning — the floor for a *measured* week — and FR-278 is untouched.

**Rejected**: lowering `MIN_COLUMN_COUNT` to 1. It is FR-278's floor for the Week view and lowering it
would let a narrow week collapse to one column, which is a different feature and a regression.

---

## R1104 — Month is most of the phase, because nothing in the grid transfers

**Finding**, itemised, because "Month is expensive" is not actionable:

| Shipped thing | Why it does not transfer |
|---|---|
| `layoutWeek` | Its scale is `pxPerMinute` over a 1440-minute column. A month cell has no minute axis |
| the all-day bar type | Models a span as one pair of column indices in **one** row. A month wraps a span across week rows |
| the `+n more` overflow | Time-band shaped — a px band with start and end wall minutes. A month cell's overflow is "n events did not fit in this box" |
| `abreastCapOf` | FR-285's side-by-side rule for a time column, keyed to a 180px width. A month cell stacks rows |
| `GridMetrics` | Assumes **one row** of equal-width columns over an hour ruler |
| `slotFromPoint` | Hit-tests one-dimensionally in x: `floor((x − gridLeft) / columnWidth)`, with **no row term at all** |
| `planResize` | Encodes "one column step is exactly one day", true only in a single row |
| the drag's edge-hold | Computed from the right edge of one row of columns |

**Decision**: Month gets its own pure layout module and its own measurement, and **no drag**
(spec Assumption 6). What it reuses is everything above the geometry: the expansion, the dates, the
per-device filter, the editor, the preview bar and the anchor's type.

---

## R1105 — A month window is still a run of consecutive days

**Finding**: every window in this project is `{startDate, endDate, startMs, endMs}` over consecutive
days, and `expandWindow` cares about nothing else.

**Decision**: a month window is the whole weeks covering a calendar month — 35 or 42 consecutive days
beginning on the household's start-of-week — so it is `viewWindowOf(gridStart, 35 | 42, zone)` and
**the fetch and the expansion are unchanged**. Only the *drawing* is new.

**Consequence worth stating**: the cache key is the window's day range, so a month and a week that
share a first day are different entries and fetch separately. That is correct, not a bug: they cover
different days.

---

## R1106 — Paging by month is calendar arithmetic, not a day count

**Finding**: `useWeekAnchor.page` moves the first day by the **column count**. For a month that is
wrong in every month: months are 28–31 days.

**Decision**: the anchor keeps its `{today | pinned}` type, its `?on=` seed and its `openAt(date)`
unchanged — all three are already absolute-date shaped. What becomes per-view is the **step** and the
**derivation**: a week steps by its columns and derives from `weekAnchorOf`; a month steps by one
calendar month and derives from the first day of the grid containing the anchor.

**Rejected**: a second anchor hook. The type and two of its three behaviours are identical, and two
hooks would be two places for `?on=` to be read.

---

## R1107 — The month grid's shape, and the two numbers it must get right

**Decision**: whole weeks, starting on the household's own start-of-week — which this project already
stores and Phase 2 already honours. **Six rows when the month needs six**, five when it does not; a
fixed six wastes a row most months and a fixed five is wrong for a 31-day month starting late.

Leading and trailing cells belong to adjacent months and are drawn as such — the reference calls it
"standard calendar format" `[V](44738510847259)` and every standard calendar does this.

---

## R1108 — The overflow rule is exact, and it is not the one Phase 8 nearly cited

**Finding** `[V](48026687853083)`: a cell holds **three** events; at **four or more** it shows **two**
plus an indicator of how many more. A **"+ More"** control opens that date's full list
`[V](360033104791)`.

**Note the near-miss**: `009`'s research flagged "displays up to three events per day" as a trap that
reads like a Tasks-widget capacity. It is *this* rule — the Month cell's — and here it is finally in
the phase it belongs to.

**Decision**: implement exactly that, as a pure function of a day's event count. `3 → 3 shown, 0
hidden`; `4 → 2 shown, 2 hidden`; `9 → 2 shown, 7 hidden`. The arithmetic is not obvious enough to
leave in a component.

---

## R1109 — A spanning bar becomes one segment per week row

**Finding** `[V](44738510847259, 36625171368987)`: a multi-day event draws as **a single connected
bar**, attested twice — the best-sourced Month fact in the corpus.

**Decision**: one segment per week row the span crosses, each carrying whether it continues off the
left or right edge, so the household can see it is part of something longer. A grid that wraps cannot
draw one rectangle across a row break; this is a rendering necessity and spec Assumption 4 records it
rather than letting it look like a deviation.

---

## R1110 — The preview bar comes to every view, and one number has to generalise

**Finding**: Tasks Progress is documented across **all four** views `[V](36625171368987)` and
countdowns render in a preview bar **across all four** `[V](40459070511515)`. Phase 8 built the bar
for the Week only.

**Decision**: `WeekView`'s chrome moves up to a view-agnostic shell, so the bar is drawn once for
whatever view is showing. Its **only** view coupling is `countdownSlotsFor(columnCount)`, which
derives how many chips hold a position from the measured week columns; it becomes a function of the
available width instead.

---

## R1111 — The view choice is per device, and it rides the shipped store

**Decision**: `createDeviceSwitches` is the shipped per-device store, but it holds booleans. The view
is one of three names, so this phase adds the smallest possible sibling — the same
`deviceStorage.ts` read/write with the same `persistent` flag — rather than encoding a view as two
booleans.

**Why per device** (spec Assumption 2): a phone wants Day where the wall tablet wants Week, and every
other display choice in this project is already per device.

---

## R1112 — What has no server work at all

**Decision**: this phase adds **no migration, no server action, no route handler and no new query**.
A view is a choice about drawing; the reads, their keys and their policies are unchanged, so there is
nothing new for RLS to police and no `contracts/` document to write.

The policies suite gains nothing. That is a finding, not an omission — and it is why this phase can
be large in the client and still cheap in risk.

---

## R1113 — Schedule view is a phase, not a view, and here is the bill

**Finding**: it is *forward-looking from today over one to seven days, one day per column*
`[V](36625171368987)` — so it cannot reuse a calendar-week anchor at all. It needs a household
setting **"Days displayed in Schedule View"**, a 1–7 slider `[V](36835449004315)`; it has its **own
"Start on current day"**, a second setting sharing a name with the Week's, which must be a distinct
stored value or it is a fidelity bug; it has **pinch-to-zoom** whose effect — day count or hour
density — the sources leave explicitly unresolved; and its create gesture is a **tap-and-hold**,
different from the Week's per-column button.

**Decision**: deferred, with the bill above written into the spec's Out of Scope so the deferral reads
as a decision.

---

## R1114 — What can be tested, and what cannot

**Unit-testable, and where the gate's coverage comes from**: the month window's day range for every
month of a year including a leap February and a six-row month; the overflow arithmetic at 0, 3, 4 and
many; the span segmentation across one, two and five week rows and off both edges; the month step
from every month including December→January; the day step; and the view store's read, write and
corrupt-value fallback.

**Testable in the browser**: the switcher naming the current view and surviving a reload; Day view at
one column with its scroll; the Month grid, its overflow control and the list it opens; a day cell
opening its day; the preview bar surviving every view; and the narrow-width pass.

**Not testable here, said plainly**: that the reference's Month view *looks* like ours. No image of it
exists anywhere in the corpus (R1101) — the layout is specified by behaviour and capacity, not by
pixels, and this project cannot close that gap by testing.

---

## R1115 — The one shipped test that must change, and the one that must not

**Finding**: `use-grid-geometry.test.ts` pins the 3–7 clamp, and it is right to. `layout.test.ts`,
`week-geometry.test.ts` and `use-week-anchor.test.ts` pin the week's behaviour and must keep passing
untouched — if any of them needs editing, the change has reached further than it should.

**Decision**: the geometry test gains cases for the fixed-count path and keeps every existing case
unchanged. Anything else going red is this phase's fault, not the test's.
