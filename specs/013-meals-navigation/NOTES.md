# 013 — the Meals tab navigates like the Calendar

**Status**: not started. Notes taken from the operator's report on 2026-09-10, before any spec.

This file is deliberately notes rather than a spec: it records what was asked for, what the research
already says about it, and the one trap that will catch whoever builds it. The spec comes next.

## What was reported

The operator, using the shipped app on a phone and a wall tablet:

> "it also doesnt really navigate days the way calendar view does … calendar does it well on all my
> devices"

and, when offered a Meals month view:

> "i mean a week view for meals is good enough but only if it navigates correctly"

So: **week-only Meals is accepted. The navigation is the whole of the ask.**

## Why this is closer to a correctness fix than a preference

`docs/research/skylight/03-lists-meals-recipes.md:105` records the Meals grid's navigation as:

> Week navigation controls and a "today" indicator on the Meals grid: existence is strongly implied
> (grid mirrors the Calendar tab's own week view, which has documented "today" affordances) but no
> article directly quotes the exact control labels/arrows for the Meals grid specifically.
> **[UNKNOWN — inferred parity with Calendar tab, not independently confirmed for the Meals tab]**

**Parity with the Calendar tab is what the research inferred, and Phase 6 shipped non-parity.** That
makes this a divergence from our own research rather than from the reference.

## What the difference actually is

The Calendar has **one** idea. The window is however many whole day columns fit — measured, not
assumed (FR-277/278) — and the arrows move it by exactly that width. Three days on a phone, seven on
the wall, one gesture everywhere. That is why the operator reports it working on every device.

The Meals tab has **two** ideas fighting:

1. `useMealWeek` holds a fixed Sunday–Saturday week (`weekDatesOf(anchor, startWeekOn)`), and its nav
   arrows jump a **whole week** (`shiftWeek`);
2. `useColumnPage` pages *within* those seven columns, by swipe or arrow key on the strip.

On a phone about two of the seven columns fit. So the visible window moves by swipe, while the
labelled arrows skip the five columns between — the household is handed two different paging
gestures on one screen, and the obvious control is the one that does the wrong thing.

## The trap — read this before writing any code

**The server cannot measure a viewport, and Meals cannot borrow the Calendar's answer.**

012 hit exactly this on the Calendar: the server seeded `DEFAULT_COLUMN_COUNT` days, a phone measured
three, and the grid re-laid-out on every load — **CLS 0.18**, the app's worst score. The fix was
`lib/family/calendar/device-columns.ts`: the device's measured count rides in a cookie so the server
seeds the window it will actually draw.

Meals needs its own measurement, not that cookie. The two grids size their columns from **different
tokens** — `--fam-meal-cell-w` against `--fam-day-col-w` — so the counts genuinely differ at the same
viewport. Reusing `family_columns` would seed the wrong width and reintroduce the shift.

## What tonight's work already did, and what supersedes it

`6a4ba13` made the Meals grid **open on today's column** rather than the week's first day, because a
two-column phone was opening on Sunday and Monday with today two pages away. That was the right fix
for the grid as it stands.

**A rolling window supersedes it.** If the window starts at today, there is no paged-away today to
correct, and `useColumnPage`'s `openOn` becomes dead for this caller. Whoever builds this should
remove it rather than leave two mechanisms aimed at the same problem.

## Sketch of the work

- Measure the Meals grid's column fit (it already runs `useBoardGeometry` with `--fam-meal-cell-w`).
- Roll the window by that width from an anchor, replacing `weekDatesOf` + `shiftWeek`.
- Retire `useColumnPage` for this board — one idea, not two.
- Carry the measured count to the server the way `device-columns.ts` does, with its **own** cookie.
- Keep Today returning to the live window, and re-word the label, which currently reads "Week of …"
  and will no longer be describing a week.
- `useMealWeek`'s docstring records a deliberate decision — "the shown week is HELD, not derived from
  the clock" (006 spec, the midnight-rollover edge case). A rolling window must keep that: today's
  marker moves at midnight, the window stays where it was put.

## Logged alongside, and NOT part of this

**Meals do not appear in the Calendar's Month view at all**, and the dossier says they should:

> can be shown/hidden with a single toggle "across Week and Month views" too, not just Schedule.
> [VERIFIED](https://skylight.zendesk.com/hc/en-us/articles/41418036777371-The-Meals-Tab)

011 built the Month grid and never carried the meal tokens into it, so the shipped "Show Meals on the
calendar" switch **silently does nothing in Month view**. A real bug, documented, and separate from
the navigation ask.

It carries one design question the reference does not answer: a Month cell holds three events,
dropping to two-plus-a-count at four or more (`cellFillFor`). In Week view meals get their own row
above the events and never compete. A Month cell has no room for that, so either meals count against
the same three slots or they need a compact per-day indicator of their own.

## Considered and dropped

A **Meals month planner** — a month grid on the Meals tab, one mealtime at a time. Offered, and the
operator declined: a week view is good enough if it navigates. Recorded because the reasoning is
worth keeping: no dossier supports a Meals month view at all (the reference's Meals tab is a
7-column week grid, `[VERIFIED]` twice), so it would have been this project's own invention and would
have had to be written as a divergence rather than a clone.
