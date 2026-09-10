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

## Measured 2026-09-10, before writing any code

**The cookie trap this file used to warn about does not apply. Measured, not assumed.**

The worry was that Meals would need its own width cookie, because the Calendar's CLS 0.18 came from
the server seeding a width the device did not draw. **Meals measures CLS 0 at both 390px and 1280px**
— the grid does not shift. Two reasons: the meals read is unwindowed (`useMeals` fetches every meal,
so no server-seeded window can be wrong), and the visible slice is a transform over columns rather
than a different set of them. **So no cookie, and that removes most of the anticipated work.**

Baseline on a production build:

| | shows | nav arrows |
|---|---|---|
| phone 390px | Thu 10, Fri 11 — two columns, today first | "Previous week" / "Next week" |
| wall 1280px | Sun 6 … Sat 12 — all seven | "Previous week" / "Next week" |

So the wall is already correct and matches the reference. **The defect is confined to widths where
seven columns do not fit**, and it is exactly this: the arrows move seven days while the screen shows
two, so five days are reachable only by swiping the strip.

## The real complication, which is not the one I expected

Making the arrows move by the visible width means collapsing the two-level model — a seven-day data
window with a paged slice over it — into one rolling window. Three things make that phase-sized
rather than an afternoon:

1. **It reverses a documented decision.** `lib/family/meals/week.ts` states the current behaviour as
   006's Assumption 3: "a whole week at a time — a planning grid, **not** the calendar's rolling
   window anchored on today". Reversing it is legitimate — the operator's devices contradict the
   assumption — but it has to be recorded as reversing Assumption 3.
2. **`useColumnPage` steps ONE column per swipe, by design, and is shared by four boards.** Its own
   test pins that: "steps ONE column per swipe, so each reveals exactly one more profile" (FR-396).
   That is right for Profile columns on Tasks, Lists and Rewards, and wrong for days. So Meals needs
   its own stepping rather than a change to the shared hook.
3. **Continuity across the week boundary.** With two visible columns of a seven-day week, a page-sized
   step from Thursday runs past Saturday. Rolling the anchor a week and resetting the slice skips a
   day; getting it right means the window stops being "a slice of a week" at all.

The clean answer is the Calendar's: the window IS the visible columns, `columnCount` days from an
anchor, arrows moving the anchor by `columnCount`, anchored on today. On the wall that degrades to a
rolling seven days, which is a further small divergence from the reference's Sunday-anchored grid and
should be stated in the spec rather than discovered later.

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
