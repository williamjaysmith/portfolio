# Feature Specification: The Calendar's Other Views

**Feature Branch**: `011-family-calendar-views`
**Created**: 2026-09-08
**Status**: Draft
**Input**: The **view switcher**, the **Day** view and the **Month** view — three of the four views
the reference offers, of which this project has only ever shipped the Week. Phase 2 deferred them and
every phase since has been careful not to absorb them quietly; this is the phase that builds them.

The **Schedule** view is deferred again, deliberately and with its cost written down (Out of Scope).
The offline cache, once planned as `011`, is not this: it has no Skylight source at all and is
this project's own invention, so it waits for a phase that can say so honestly.

**Authoritative sources**: `docs/research/skylight/01-calendar-tab-and-events.md` §2.2 (Day) and §2.4
(Month), lines 14–15 (the switcher and the navigation controls), 47–59, 87 and 194; plus
`08-ux-behaviors-and-reviews.md` and `07-visual-design-system.md`. Five help-centre articles carry
the weight: **36625171368987** (Using the Calendar Tab), **48026687853083** (Example Calendar Views),
**360033104791** (How do I change the view of my calendar), **44738510847259** (Calendar) and
**36835449004315** (Calendar Settings). Every quotation was checked against the dossier text; the
audit that did so rejected 25 over-claims, which are not in this document.

**A correction this phase carries.** The master map lists Month, Day and Schedule as *"never
photographed or documented"*. That conflates two different things, and `07-visual-design-system.md`
says only the first: **not present in any image**. Their behaviour, capacities, settings and gestures
*are* documented across five articles. The master map carries no article id in any of its 611 lines,
so where the two disagree the articles win — as they did in `010`.

The shipped specs bind: Phase 2 **FR-201** (the week's day-columns-over-hours grid), **FR-256/257**
(a tap opens details; editing is reached from there), **FR-281** (the ‹ / Today / › cluster),
**FR-284** (the household's timezone), **FR-288** (a write that cannot complete is refused, never
queued); and Phase 8 **FR-907** (the preview bar sits above the events).

## Clarifications

### Session 2026-09-08

Answered from the documentation first; each answer says whether it was found or decided.

- Q: How does the household change view? → A: **Documented.** One button in the information bar
  **whose label is the currently active view** `[V](44738510847259)` — not a segmented control and
  not four buttons. Whether it cycles or opens a picker is `[UNKNOWN]`; the dossier declines to
  commit. Its corner is a **documented contradiction** between two articles (top-left against
  top-right), not a gap, with a 2–1 lean to the right.
- Q: What is Day view? → A: **Documented, and narrower than it sounds.** "A grid calendar with a
  chronological event list for the single selected day" `[V](36625171368987)`, holding "up to ten
  events per screen in landscape, and up to sixteen events per screen in portrait"
  `[V](48026687853083)`, with the rest reached by scrolling vertically `[V](48026687853083)`.
- Q: Is Day view a column per Profile? → A: **No — and this is the trap the research caught.** The
  per-Profile columns documented at `02-tasks-and-rewards.md:60` and `:87` belong to the **Tasks
  tab's** own day view, article **36846381293979**. Nothing describes the *calendar's* Day view that
  way, and its capacity is counted in "events per screen" rather than per Profile. One day, one
  column, everybody's events together `[INFERRED]`.
- Q: What is Month view? → A: **Documented, and by two articles.** "A grid of the current month in
  standard calendar format" `[V](44738510847259)`, "a general overview of scheduled events"
  `[V](36625171368987)`.
- Q: What happens when a day has more events than fit? → A: **Documented precisely.** A cell holds
  **three** events; at four or more it drops to **two plus an indicator of how many more**
  `[V](48026687853083)`, and a **"+ More"** control opens that date's full list `[V](360033104791)`.
- Q: How do multi-day events draw in Month? → A: **A single connected bar spanning the days, not a
  chip repeated per day** — the best-attested Month fact in the corpus, carried by two independent
  articles `[V](44738510847259, 36625171368987)`.
- Q: What does tapping a day cell do? → A: **Opens the Week view focused on that day**
  `[V](44738510847259)` — with the caveat the dossier itself flags, that this sentence was fetched
  from the article's **mobile-app** portion. Assumption 5.
- Q: Does the preview bar appear on the new views? → A: **Yes, and it is real scope.** Tasks Progress
  is documented across **all four** views `[V](36625171368987)` and countdowns render in a preview bar
  **across all four** `[V](40459070511515)`. Phase 8 built that bar for the Week alone.
- Q: Can an event be dragged in Month view? → A: **`[UNKNOWN]`, and the answer here is no.**
  Assumption 6.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Choosing how to look at the calendar (Priority: P1)

The household wants the month at Christmas and the day when the day is busy. One control, and the
calendar changes shape.

**Why this priority**: nothing else in this phase is reachable without it, and it is the piece the
reference specifies most exactly.

**Independent Test**: switch between views and back; the control always says which one is showing.

**Acceptance Scenarios**:

1. **Given** the calendar, **Then** one control names the view currently showing.
2. **Given** that control, **When** it is used, **Then** the calendar changes view and the control's
   label changes with it.
3. **Given** a chosen view, **When** the app is reloaded, **Then** the same view is still showing.
4. **Given** a chosen view, **Then** it is this device's choice and does not reach another device.
5. **Given** any view, **Then** the ‹ / Today / › cluster still works and Today still returns to the
   present `[P2]` FR-281.

---

### User Story 2 — One day, in full (Priority: P2)

A Saturday with nine things on it is unreadable in a seven-column week on a phone. One day, full
width.

**Why this priority**: it is the cheapest of the two views by a wide margin — the calendar's existing
machinery already admits a one-day window — and it is the one a phone benefits from most.

**Independent Test**: switch to Day, see one day's events at full width, step to the next day, and
scroll to events past the fold.

**Acceptance Scenarios**:

1. **Given** Day view, **Then** exactly one day is shown, at the full width of the grid.
2. **Given** a day with more events than fit, **When** it is scrolled, **Then** the rest are reached.
3. **Given** Day view, **Then** an event opens its details on a tap, exactly as in the week
   `[P2]` FR-256.
4. **Given** Day view, **When** it is stepped forward, **Then** it moves by one day.
5. **Given** Day view, **Then** the current time is marked, as it is in the week.

---

### User Story 3 — The whole month at once (Priority: P3)

Somebody is planning half-term. They need to see the shape of four weeks, not seven days.

**Why this priority**: the most-asked-for of the missing views and the most documented — and the most
work, because nothing in the shipped grid transfers to it.

**Independent Test**: switch to Month, see the month in a standard grid, step to the next month, and
open a day from it.

**Acceptance Scenarios**:

1. **Given** Month view, **Then** the month is drawn as a standard calendar grid with today marked.
2. **Given** a day with more than three events, **Then** the cell shows two and says how many more.
3. **Given** that indicator, **When** it is used, **Then** the day's full list of events opens.
4. **Given** a multi-day event, **Then** it draws as one connected bar across the days it covers, not
   as a chip repeated on each.
5. **Given** a day cell, **When** it is chosen, **Then** the calendar opens that day.
6. **Given** Month view, **When** it is stepped forward, **Then** it moves by one **month** — not by
   a number of days.

---

### User Story 4 — The chrome comes too (Priority: P4)

The countdowns and the chore progress the calendar gained last phase belong above every view, not
just the week.

**Why this priority**: documented for all four views, and leaving it week-only would make the new
views feel like a lesser calendar.

**Independent Test**: with a countdown set and Tasks Progress on, switch views and see the bar
survive.

**Acceptance Scenarios**:

1. **Given** a countdown and any view, **Then** the preview bar is above the events.
2. **Given** Tasks Progress is on, **Then** it shows in every view.
3. **Given** a narrow view with several countdowns, **Then** the bar shows what fits and rotates, as
   it already does.
4. **Given** nothing to show, **Then** no bar is drawn in any view `[P8]` FR-910.

---

### Edge Cases

- **A month whose grid needs six week rows** (a 31-day month starting on a Saturday) draws all of it.
- **A multi-day event crossing a week row** draws as a segment on each row it touches, not one
  impossible bar.
- **A multi-day event running out of the displayed month** is shown as continuing, not clipped
  silently.
- **The household's midnight** moves the today marker in every view without a reload.
- **A daylight-saving change inside the displayed month** does not shift which day a date falls on.
- **Switching view while an event's details are open**: the details stay about that event.
- **A month with no events at all** draws its grid, not an error.

## Requirements *(mandatory)*

### The switcher

- **FR-1101**: The calendar MUST offer **one** control that names the view currently showing and
  changes it `[V](44738510847259)`.
- **FR-1102**: The chosen view MUST survive a reload and MUST be this device's own
  `[OURS 2026-09-08 #2]`.
- **FR-1103**: The switcher MUST offer **Day**, **Week** and **Month** in this phase. Schedule is the
  reference's fourth `[V](44738510847259)` and is out of scope; the switcher MUST NOT imply it exists.
- **FR-1104**: Every view MUST keep the shipped ‹ / Today / › cluster, and Today MUST return to the
  present in all of them `[P2]` FR-281, `[V](36625171368987)`.

### Day view

- **FR-1105**: Day view MUST show exactly one day over the hour grid `[V](36625171368987)`.
- **FR-1106**: Events beyond the fold MUST be reachable by scrolling, with no overflow control
  `[V](48026687853083)`.
- **FR-1107**: Day view MUST step by exactly one day `[OURS 2026-09-08 #3]`.
- **FR-1108**: Day view MUST keep everything the week's grid already does with an event — the tap,
  the details, the now line and the today marker `[P2]` FR-256, `[V](36625171368987)`.

### Month view

- **FR-1109**: Month view MUST draw the month as a standard calendar grid `[V](44738510847259,
  36625171368987)`, with whole weeks so the first and last rows may carry adjacent months' days.
- **FR-1110**: A day cell MUST show at most **three** events; with four or more it MUST show **two**
  and an indicator of how many more `[V](48026687853083)`.
- **FR-1111**: That indicator MUST open the day's full list of events `[V](360033104791)`.
- **FR-1112**: A multi-day event MUST draw as a **single connected bar** across the days it covers,
  segmented where it crosses a week row `[V](44738510847259, 36625171368987)`; the segmentation is
  `[OURS 2026-09-08 #4]`.
- **FR-1113**: Choosing a day cell MUST open that day `[V](44738510847259)`; which view it opens into
  is `[OURS 2026-09-08 #5]`.
- **FR-1114**: Month view MUST step by one calendar month, not by a number of days
  `[V](360033104791)`.
- **FR-1115**: Month view MUST NOT offer drag `[OURS 2026-09-08 #6]`.

### Across the views

- **FR-1116**: The preview bar MUST appear above the events in **every** view
  `[V](36625171368987, 40459070511515)`, keeping Phase 8's rule that it vanishes when empty.
- **FR-1117**: Every view MUST read the same expansion, the same per-device Profile filter and the
  same household timezone — this phase MUST NOT add a second definition of an occurrence or a day
  `[P2]` FR-284.
- **FR-1118**: Every write reachable from a new view MUST carry the punch-in gate and FR-288's
  refusal, unchanged `[P2]`.
- **FR-1119**: Adding views MUST NOT change what the Week view does today.

### Key Entities

- **A view**: not stored data. A choice of window shape and renderer, held per device.
- **A month window**: whole weeks covering a calendar month — a run of consecutive days like every
  other window this project has, differing only in how many and where it starts.

## Success Criteria *(mandatory)*

- **SC-1101**: The switcher moves between Day, Week and Month, always naming the one showing, and the
  choice survives a reload without reaching another device.
- **SC-1102**: Day view shows one day at full width, scrolls to events past the fold, and steps by
  one day.
- **SC-1103**: Month view draws every month of a year correctly, including one needing six week rows
  and one containing a daylight-saving change.
- **SC-1104**: A cell with four or more events shows two and an accurate count; the count opens the
  full list.
- **SC-1105**: A multi-day event appears once per week row it crosses, spanning the right days —
  never as a repeated per-day chip.
- **SC-1106**: Month steps by a calendar month from every month of the year, including December to
  January and across a leap year's February.
- **SC-1107**: The preview bar behaves identically in all three views, including vanishing when
  empty.
- **SC-1108**: Every view shows the same events for the same day as the Week view does.
- **SC-1109**: Every decision — which days a month window covers, which events fall in a cell, how a
  span is segmented, what the count says — is unit-tested as pure logic, with no clock and no React.
- **SC-1110**: The Week view's own criteria from Phase 2 still pass unchanged.
- **SC-1111**: At the narrowest supported width every view is usable and the page does not scroll
  sideways.

## Assumptions

Decisions taken on **2026-09-08**, where the reference is silent or contradicts itself.

- **1. The switcher opens a short list rather than cycling.** `[UNKNOWN]` — the dossier says
  "cycles/opens a picker" and will not choose. Cycling through three views to reach the one you want
  is two wrong screens on a wall display; a list names them. Its corner follows the 2–1 lean to the
  right, where this project's other calendar controls already sit. `[OURS]`
- **2. The chosen view is a per-device choice.** `[UNKNOWN]`. Every display choice in this project is
  per device, and the wall tablet and a phone want different views — a phone wants Day where the wall
  wants Week. `[OURS]`
- **3. Day view steps by one day.** `[UNKNOWN]` — Day is conspicuously **absent** from the article's
  own enumeration of the three views carrying prev/next arrows, which is an absence inside a list
  rather than a silence. A view that cannot move is not usable, so it steps; that it steps by one day
  is the only sensible size. `[OURS]`
- **4. A multi-day bar is segmented per week row.** `[V]` says "a single connected bar". A grid that
  wraps cannot draw one rectangle across a row break, so the bar becomes one segment per row it
  crosses. This is a rendering necessity, recorded rather than smuggled. `[OURS]`
- **5. A day cell opens the DAY view, not the Week.** The source says Week `[V](44738510847259)` —
  but the dossier flags that sentence as fetched from the article's **mobile-app** portion, and the
  phone app has no Day view to offer, which is very likely why it says Week. This project has one.
  The divergence is recorded rather than hidden. `[OURS]`
- **6. Month view has no drag.** `[UNKNOWN]` — no source says an event can be dragged in Month. The
  shipped drag layer hit-tests one-dimensionally across a single row of day columns and does not
  transfer to a wrapped grid; building a second drag model for a view nothing documents as draggable
  would be inventing a feature and the hardest one in the phase. A month cell is a door to a day.
  `[OURS]`
- **7. Month view creates nothing directly.** `[UNKNOWN]`. The week's create door is a tap on a
  15-minute slot; a month cell contains no time. Rather than invent a month-shaped create, a cell
  opens its day, where the shipped door already is. `[OURS]`
- **8. "Start on current week" is not built in this phase.** It is a real documented Month setting
  `[V](36835449004315)`, but its behaviour is genuinely ambiguous between two readings in the same
  article — re-anchor the grid, or merely scroll to that week — and its factory default is
  `[UNKNOWN]`. Month opens on the month containing today, which satisfies both readings' intent
  without guessing at the setting. Recorded as a gap, not as an omission. `[OURS]`

## Divergences from the reference, and why

| # | Divergence | Why |
|---|---|---|
| 1 | **No Schedule view** | Deferred with its cost stated in Out of Scope. It is not a fourth renderer but a fourth renderer *plus* two household settings, one of which shares a name with an existing one, plus a pinch gesture whose meaning is unresolved in the sources |
| 2 | **A month cell opens the Day view, not the Week** | Assumption 5 — the source sentence is app-side, and the app has no Day view |
| 3 | **No drag in Month** | Assumption 6 |
| 4 | **No weather in Month** | Weather is excluded project-wide, and was already a divergence in Phase 2. The reference shows a ten-day forecast in Week and Month `[V](36625171368987)` |
| 5 | **No "Start on current week" setting** | Assumption 8 |

## Dependencies

- Phases 1–8, shipped: the shell, the calendar's expansion and dates, the editor, the per-device
  Profile filter, the preview bar, and the household's timezone.
- No migration is expected: a view is a choice about drawing, and the per-device choice lives where
  every other one does.

## Out of Scope

**The Schedule view**, and its cost is stated here so the deferral is a decision rather than a
silence. It is *forward-looking from today over one to seven days, one day per column*
`[V](36625171368987)` — so it cannot reuse a calendar-week anchor at all. It needs a household
setting, **"Days displayed in Schedule View"**, a 1–7 slider `[V](36835449004315)`; it has its **own
"Start on current day"**, a second setting sharing a name with the Week's, which must be a distinct
stored value or it is a fidelity bug; it has **pinch-to-zoom** `[V]` whose effect — day count or hour
density — is explicitly unresolved across the sources; and its create gesture is a **tap-and-hold**,
different from the week's. It is a phase, not a view.

Also out: the **offline cache**, which has no Skylight source at all and is this project's own
invention; the reference's **weather forecast**, excluded project-wide; and per-view differences in
the meals tokens, whose in-cell rendering in Month is `[UNKNOWN]`.
