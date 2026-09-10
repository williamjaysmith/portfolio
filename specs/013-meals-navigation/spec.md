# Feature Specification: The Meals Tab Navigates Like the Calendar

**Feature Branch**: `013-meals-navigation`
**Created**: 2026-09-10
**Status**: Draft
**Input**: The operator, using the shipped app on a phone and a wall tablet:

> "it also doesnt really navigate days the way calendar view does … calendar does it well on all my
> devices"

and, when offered a Meals month view instead:

> "i mean a week view for meals is good enough but only if it navigates correctly"

**Prior work to read first**: `NOTES.md` beside this file. It holds the measurements taken on
2026-09-10 before any code, and two of them changed the shape of this phase — one anticipated problem
turned out not to exist, and an unanticipated one did.

## What this phase is, in one line

**The Meals grid's day navigation becomes the Calendar's: one window, one gesture, the same on every
device.** Nothing else about the tab changes.

## Clarifications

### Session 2026-09-10

- Q: When all seven day columns fit (the wall tablet), which day should the Meals window start on? →
  A: **Always roll from today.** One rule at every width: the window begins on today and moves by the
  number of columns drawn. The operator chose this over a width-dependent rule that would have kept the
  wall tablet's Sunday-anchored week, having been shown both.

## What the evidence says, and what is ours

**The reference specifies the grid, not its navigation.** The Meals tab is a 7-column week grid
(one column per day, up to four mealtime rows) `[VERIFIED](41418036777371)`
`[VERIFIED](44739809442587)`. That much is settled and this phase does not touch it.

**Its navigation is `[UNKNOWN]`, and the research already guessed parity with the Calendar.**
`docs/research/skylight/03-lists-meals-recipes.md:105`:

> Week navigation controls and a "today" indicator on the Meals grid: existence is strongly implied
> (grid mirrors the Calendar tab's own week view…) but no article directly quotes the exact control
> labels/arrows for the Meals grid specifically.
> **[UNKNOWN — inferred parity with Calendar tab, not independently confirmed for the Meals tab]**

So this phase is not a divergence from the reference. It is a correction toward our own research's
inference, which Phase 6 departed from as its Assumption 3.

**This reverses 006 Assumption 3, deliberately and on the record.** `lib/family/meals/week.ts` states
the current behaviour as: *"the seven days from the household's start day, a whole week at a time — a
planning grid, **not** the calendar's rolling window anchored on today (spec Assumption 3)"*. That
assumption was reasonable and is now contradicted by the devices the household actually uses. An
assumption losing to evidence is the system working, not a mistake being corrected.

## The defect, measured

Taken on a production build, 2026-09-10, signed in:

| Width | Columns drawn | What the arrows say | Correct? |
|---|---|---|---|
| 390px (phone) | 2 of the week's 7 | "Previous week" / "Next week" | **No** |
| 1280px (wall) | all 7 | "Previous week" / "Next week" | Yes |

**The wall tablet is already right.** The defect exists only where seven columns do not fit: the
arrows move the window by seven days while the screen shows two, so the five days in between are
reachable only by a swipe on the strip — an unlabelled gesture the household has to discover, while
the obvious control skips past them.

The Calendar has one idea instead: the window is however many whole day columns fit (FR-277/278,
measured) and the arrows move it by exactly that width. Three days on a phone, seven on the wall, one
gesture. That is what the operator reports working everywhere.

**Cumulative Layout Shift is 0 at both widths.** This matters because it rules out the problem that
dominated 012's calendar work: no device-width cookie is needed here. The meals read is unwindowed, so
no server-seeded window can be wrong, and the visible slice is drawn as a transform rather than a
different set of columns.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reaching tomorrow on a phone (Priority: P1)

A parent on a phone opens Meals to see what is planned for the next few days. They tap the forward
arrow and the window advances to the days immediately after the ones they were looking at. Tapping
back returns them. No day is skipped, and no day is reachable only by a gesture they were not told
about.

**Why this priority**: It is the whole of the reported defect. Without it the tab is, in the
operator's words, not navigating correctly.

**Acceptance**:
1. **Given** the Meals grid on a narrow screen showing N day columns, **When** the forward arrow is
   tapped, **Then** the window shows the next N days, beginning with the day after the last one
   previously shown.
2. **Given** the same, **When** the back arrow is tapped, **Then** the window shows the N days before
   the first one previously shown.
3. **Given** any sequence of forward and back taps, **When** the household counts the days they have
   seen, **Then** every day between the first and last is among them — the arrows skip nothing.

### User Story 2 - The wall tablet keeps seven days at a glance (Priority: P1)

A household walking past the wall tablet sees a week's worth of meals at a glance — today and the six
days after it — and the arrows move seven days at a time.

**Why this priority**: Equal first. The wall display is the reference's own device and its *capacity*
must not regress: seven columns, seven-day steps. What changes there is only WHICH seven — today
onward rather than Sunday onward (see Clarifications).

**Acceptance**:
1. **Given** a width where all seven columns fit, **When** the forward arrow is tapped, **Then** the
   window advances seven days — the same distance as the shipped behaviour.
2. **Given** the same, **When** the grid is read, **Then** seven day columns are drawn.
3. **Given** the tab is opened, **When** the grid is read, **Then** the first column is today.

### User Story 3 - Today is where you start (Priority: P2)

Opening the Meals tab shows today, not days that have already passed.

**Why this priority**: Already shipped (`6a4ba13`) against the current grid, and must survive the
change rather than be re-broken by it.

**Acceptance**:
1. **Given** the Meals tab is opened on any width, **When** the grid is drawn, **Then** today's column
   is among those visible.
2. **Given** the household has navigated away from today, **When** "Today" is used, **Then** the
   window returns to the one containing today.

### Edge Cases

- **Midnight with the grid open.** 006's documented rule must survive: today's marker moves with the
  household clock, **the window stays where it was put**. A window is not silently re-anchored under
  somebody mid-plan.
- **A rotation, or a text-size change, that alters how many columns fit.** The window's width changes;
  the day it begins on must not jump about as a side effect.
- **The day the household's week starts.** It no longer affects this grid at all (Clarifications), and
  must keep working everywhere else it is used. The risk to test for is the opposite of dead
  configuration: that removing its influence here does not disturb the Tasks board's week.
- **A window spanning a month or year boundary.** The label has to stay readable — "28 September –
  4 October", "28 December 2026 – 3 January 2027".
- **One column.** A very narrow screen or a large text size may fit a single day; the arrows must then
  move one day and remain usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-1301**: The Meals grid MUST draw as many whole day columns as fit its measured width, on the
  same terms the Calendar uses (FR-277/278).
- **FR-1302**: The grid's navigation arrows MUST move the window by exactly the number of day columns
  drawn. Where all seven fit this is a week, which preserves the shipped wall-tablet behaviour.
- **FR-1303**: Consecutive windows MUST abut. No day may be skipped by the arrows, and no day may be
  shown twice in a single direction of travel.
- **FR-1304**: The window MUST be continuous across any week boundary. There is no week the arrows
  stop at or reset within.
- **FR-1305**: The window MUST begin on today when the tab is opened, at every width — not on the
  household's first day of the week (Clarifications, 2026-09-10). A "Today" control MUST return to
  that window.
- **FR-1306**: The arrows MUST say how far they go, in the Calendar's idiom — "Previous 3 days" and
  "Next 3 days" where three columns are drawn, "Previous week" and "Next week" where seven are.
- **FR-1307**: The window's label MUST describe the days shown, not a week the household cannot see.
- **FR-1308**: Today's marker MUST follow the household clock while the window stays where it was put,
  preserving 006's midnight rule.
- **FR-1309**: The Tasks, Lists and Rewards boards MUST be unaffected. Their columns are Profiles, and
  FR-396's one-column-per-swipe rule is correct for them.
- **FR-1310**: The grid MUST NOT shift its layout after first paint, at any width. CLS is 0 today and
  that is the bar.

### Key Entities

- **The window** — the consecutive days on screen: a first day and a count. The count comes from
  measurement; the first day from navigation. It replaces "a week, plus which slice of it is showing".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-1301**: On a 390px screen, every day in a fortnight is reachable using only the labelled
  arrows — no swipe required.
- **SC-1302**: On a 1280px screen the grid draws seven columns and the arrows move seven days, matching
  the shipped behaviour exactly.
- **SC-1303**: Starting from today and tapping forward five times then back five times returns the
  household to the window they began on, having seen every day in between.
- **SC-1304**: Opening the tab shows today's column at every width tested — 390, 768, 1024 and 1280px.
- **SC-1305**: Cumulative Layout Shift remains 0 at every width tested.
- **SC-1306**: The arrows' labels state the distance they travel, and that distance matches what the
  window actually moves.
- **SC-1307**: No journey on the Tasks, Lists or Rewards boards changes behaviour.

## Assumptions

1. ~~A rolling window on the wall tablet is acceptable.~~ **Decided, not assumed** — see
   Clarifications. The window begins on today at every width. The operator was shown a width-dependent
   alternative that would have preserved the wall tablet's Sunday-anchored week and chose the single
   rule instead. It is a further small step from the reference's grid, taken knowingly, and it is
   already what the Calendar does on the same device (`START_ON_CURRENT_DAY`).
2. **The household's start-of-week setting stops affecting the Meals grid entirely**, and keeps every
   other meaning it has — the week the Tasks board's resolutions are read by, and anything else
   presenting a week. This follows from the decision above rather than being a separate choice, and it
   is worth stating plainly so nobody later reads the setting as broken.
5. **"Today" is offered whenever the window is not the live one.** The shipped control is disabled
   while the shown week contains today (`isCurrentWeek`); with a window anchored on today that test
   becomes "is the window the one beginning today". Decided by matching the Calendar's own Today
   control rather than asked, because a defensible precedent exists in this codebase.
3. **`useColumnPage` is not changed.** Its one-column-per-swipe step is right for Profile columns and
   pinned by FR-396 for three other boards. The Meals grid gets its own navigation rather than a new
   mode on a shared hook.
4. **No device-width cookie.** Measured: CLS is 0 at both widths and the meals read is unwindowed, so
   the 012 calendar problem does not arise here. If a later change makes the server seed a window,
   this assumption needs re-testing.

## Out of Scope

- **A Meals month view.** Offered to the operator and declined: *"a week view for meals is good enough
  if it navigates correctly"*. Recorded in `NOTES.md` with the reasoning, including that no dossier
  supports one at all.
- **Meals missing from the Calendar's Month view.** A real, documented bug — the dossier says the
  toggle works "across Week and Month views" `[VERIFIED](41418036777371)` and the Month grid draws no
  meals, so the shipped switch silently does nothing there. Logged in `NOTES.md`, and it carries its own
  design question about cell density. Not this phase.
- **The mealtime rows, the recipe rail, the popover, and every write path.** Untouched.
- **The Calendar tab.** It is the model here, not the subject.

## Dependencies

- Phase 6's Meals grid and Phase 2's measured-column rule, both shipped.
- The browser pass (`specs/007-family-e2e/`) is the phase gate, as always.
