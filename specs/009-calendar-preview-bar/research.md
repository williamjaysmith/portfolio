# Research — 009 The Calendar's Preview Bar

**Date**: 2026-09-07 · **Spec**: [spec.md](./spec.md) · **Branch**: `009-calendar-preview-bar`

Fifteen decisions, R901–R915. Each names what was found, what was chosen, and what was rejected.
The reference evidence lives in `docs/research/skylight/01-calendar-tab-and-events.md` §4 and §5,
whose tags this file does not re-litigate: what is `[UNKNOWN]` there is an assumption in the spec,
not a fact here.

---

## R901 — The bar is `MealRow`'s shape, not a new chassis

**Finding**: Phase 6 already solved this exact problem. `MealRow` is one grid row on the day headers'
template, drawn by `WeekView` inside `DayHeaderBand`, under the all-day band and **outside** the drag
target, and it returns `null` when it has nothing to show so the band keeps its height. Its data
comes from `useCalendarMeals`, which reads its own per-device switch and hands down plain values.

**Decision**: the preview bar is a sibling of `MealRow` with the same three properties — outside the
drag layer, rendered by `WeekView`, absent when empty — fed by one hook, `useCalendarPreview`.

**Rejected**: hanging it off the shell's `ProfileChipRow`. That row is in the `(app)` layout and is
on screen on Lists and Meals too; the reference puts Tasks Progress and the countdowns "above the
events" on the calendar, not in the shell. Moving it up would put task counters on the Lists tab.

**Rejected**: two rows, one per feature. The reference is explicit that countdowns appear "alongside
Tasks Progress" in one preview bar, and two rows would each cost the band its height separately.

**The bar brings its own read, and this corrects a first draft.** The plan first said the bar needs
no fetch because "the events are already in the view's cache". They are not: the calendar's read is
one window of three to seven days, and the whole point of a countdown is that its day is far off —
exactly the day no displayed window contains. So the bar reads
`fetchCountdownEvents(supabase, householdId)`: every event with `countdown_enabled` true, keyed by
the household alone, unwindowed. That set is small by construction, it does not refetch when the week
is paged, and it is the same shape 008 R802 gave the reminder banner for the same reason.

**Rejected**: widening the week's read to the countdown horizon. It would pull three months of events
onto every calendar paint to find the two the household marked.

---

## R902 — Days remaining is date subtraction, and the midnight roll is already solved

**Finding**: `diffDays(from, to)` and `localDateOf(zone, ms)` are shipped in
`lib/family/calendar/dates.ts`, and `useNow()` in `Clock.tsx` is a module-level minute-resolution
store over `useSyncExternalStore`. `useWeekAnchor` already derives `todayDate` from it, so the
calendar re-renders once a minute with a household-local date in hand.

**Decision**: `daysUntil = diffDays(todayDate, targetDate)`, computed from the same `todayDate` the
anchor uses. SC-902's "falls by exactly one at the household's midnight, with no reload" is then a
property of a store that already exists, and the count is in the household's zone by construction —
a phone in another timezone reads the same number as the wall (FR-904).

**Rejected**: a countdown-owned interval. A second clock in the app is a second thing to get wrong
at a DST boundary, and it would tick while nothing was watching.

**Consequence for the tests**: the pure function takes two date strings, so every case — the day
itself, the day after, a leap day, the March and November DST changes — is a unit test with no clock
and no React (SC-910).

---

## R903 — What a countdown counts towards, and the one bounded walk

**Finding**: an event in this project is either a one-off or a series with an `rrule`. The reference
says nothing about a countdown on a repeat (spec Assumption 2).

**Decision**: the target date is the event's own start date for a one-off, and for a repeat the
**next occurrence on or after today**, found by `ruleDatesIn` over `[today, today + 400 days]`.

**Where it lives**: `lib/family/calendar/next-occurrence.ts`, in `family-calendar-core` — not in the
countdown zone. It is calendar logic that a countdown reads, and the search reads it too (R908);
putting it the other way round would make the calendar depend on countdowns to answer "when does this
next happen", which is a question the calendar owns.

**Why bounded, and why 400**: `ruleDatesIn` walks day by day, so an unbounded search for a rule that
never matches again would not terminate. Four hundred days clears a full year plus a month of slack,
which covers every repeat grammar this project can express — a yearly birthday included. A repeat
with no occurrence inside that window is not something a household is counting down to, and it
simply leaves the bar.

**Rejected**: counting to the series' first occurrence. It is in the past for any established repeat,
so the bar would be stuck at a negative number forever.

**Rejected**: one row per occurrence. Every weekly chore would flood the bar.

---

## R904 — Show Countdowns is one column and one `<select>`

**Finding**: `household_settings` already carries eight preference columns and gained five more in
Phase 7's `034_notification_settings.sql`. `HouseholdSection` renders its enumerated preferences from
a `CHOICES` array of `{key, label, options}` — Clock, Start week on, Text size, Display density —
and `useSettingsForm` / `useSettingsSave` / `updateHouseholdSettings` carry them to the server, where
`updateHouseholdSettings` is parent-only and enforced server-side.

**Decision**: one migration adding `show_countdowns text not null default 'always'` with a check
constraint of exactly the three documented values, one entry in `CHOICES`, one field in the settings
Zod schema, one line in `rows.ts`. Nothing else.

**Why a text enum and not two columns**: the reference's three values are one choice, not a boolean
plus a number. A check constraint keeps the database honest about which three.

**Where it goes in the interface**: the reference puts it at **Settings > Calendar**
`[V](45795554249371)`. This project's Settings screen has no Calendar section — Clock and Start week
on, which are calendar settings, live under **Household**. Rather than move shipped fields, the new
one joins them there, and the divergence is recorded in the spec's table.

---

## R905 — Tasks Progress brings the board's reads, and mounting is the `enabled`

**Finding**: the progress numbers need today's expanded task occurrences, which need four cached
reads — `useTasks`, `useTaskResolutions`, `useTaskCarryForward`, `useTaskCursors`. Three of the four
are keyed by **household alone** (R314); only the resolutions are keyed by the anchored week, and the
carry tail by today. `useTaskBox` establishes the shipped idiom for a read nobody looks at on a
normal day: *"mounting is the `enabled`"*.

**Decision**: a `TasksProgressRow` component that is **rendered only while the switch is on**, and a
`useTaskProgress` hook inside it. Switch off, the component does not mount, the hook does not run,
and the calendar tab makes no task request at all (FR-921's "reads what is shipped" and 008 FR-832's
"adds nothing to any tab's path").

**What it costs when on**: the household-keyed reads share the Tasks tab's exact cache entries, so a
household that has opened the board this session pays nothing. Cold, it is four reads of a household's
own small tables, once, with the shipped `staleTime`.

**Rejected**: computing progress on the server in `calendar/page.tsx`. It would cost every household
four queries on every calendar paint, including the ones with the switch off, and the numbers would
then be stale in a way the board's are not.

**Rejected**: a new "progress" query or view. FR-912 forbids a second definition of done.

---

## R906 — The progress numbers come from `counters.ts` and nowhere else

**Finding**: `lib/family/tasks/counters.ts` opens with a comment naming this surface by name — *"the
calendar's Tasks Progress display"* — as one of the readers of FR-305's denominator. It is pure,
framework-free, and already unit-tested.

**Decision**: `columnCountersOf(occurrences, profileId)` over `expandTaskDay(...)` for **today**, and
nothing else. This phase adds no counting logic whatsoever.

**Which day**: today, not the displayed day. The reference calls it "task progress of visible
profiles", and the Tasks tab is a today-shaped board; a preview bar that changed its numbers as you
paged to next week would be reporting on days whose chores have not happened. Recorded as a decision
because the reference does not say (it has no paging distinction to make).

**Which Profiles**: those the calendar is currently showing — `visibleProfiles` from `useFamily`,
the same per-device hidden set the grid uses (FR-911, FR-913). Every Profile hidden means an empty
row, which R901 renders as no row.

---

## R907 — The rotation is a timer over the active list, and the pause is a device switch

**Finding**: the reference says active countdowns "rotate through the first position" when space is
limited `[V](40459070511515)`, and says nothing about pausing (spec Assumption 6).

**Decision**: the bar shows as many countdowns as fit and advances the first position on a fixed
interval while there are more than fit. The interval is a module constant, not a setting. A per-device
**Pause countdowns** switch on `createDeviceSwitches` — the `useCalendarMealSwitch` shape — stops it,
and `prefers-reduced-motion` stops it too without being asked.

**Why a device switch and not a household setting**: it is a display preference of the device doing
the moving, exactly like Show Meals and the four task switches (FR-913, 003 R319). The wall tablet
and a phone want different answers.

**Why the movement is a re-order and not an animation**: framer-motion is available, but a bar that
slides on a wall display in a kitchen is motion nobody asked for. The first position simply changes
its occupant.

---

## R908 — Search is a read of its own, over events rather than occurrences

**Finding**: the calendar's loaded data is one window of three to seven days
(`useWeekEvents(householdId, weekWindow)`). A search that filtered it would fail to find anything
outside the visible week, which is exactly what somebody searching is looking for.

**Decision**: a new read, `fetchEventSearch(supabase, householdId, term)` → `useEventSearch`, keyed
by household and the **trimmed, lower-cased** term, `enabled` only above a minimum length, doing an
`ilike` on `summary` under the signed-in session's RLS with a hard row cap. It returns **events**,
never occurrences (FR-918) — a weekly swim lesson is one result.

**What a result shows**: the event's title and the date it will next fall on — its own date for a
one-off, its next occurrence on or after today for a repeat, by R903's same bounded walk. A repeat
whose occurrences are all in the past shows its last one, so a search for something that has finished
still answers rather than vanishing.

**Rejected**: fetching every event to the client and filtering there. It grows without bound and puts
the household's whole calendar in memory to answer one question.

**Rejected**: full-text search. `ilike '%term%'` over a household's own events is the right size of
hammer; a tsvector column and its index would be new schema for a table with hundreds of rows.

**Where the control goes**: beside ‹ / Today / ›, in `WeekNav`'s pill row — where `TaskSearch` sits
on the Tasks tab, and where the reference's own calendar Search sits among Previous / Today / Next /
the view toggle / Filter `[V](45755784991131)`.

**The evidence, stated exactly**: what is verified is a **Search control on the mobile app's calendar
toolbar**, corroborated by a product screenshot. That it searches events is `[INFERRED]`; its results
are `[UNKNOWN]`; and no source puts one on the device, which is an absence of evidence rather than a
documented absence. Spec Assumptions 1, 8 and 9 carry the three.

**And the finding that framed this phase, corrected**: a draft asserted the device has no content
search at all. The dossiers contradict it — the Tasks tab's Search finds tasks by name and
description `[V](44738601403931, 39074226341659)` and the Recipe pane has a keyword search box
`[V](44338446585115)`, and this project has shipped both. What the sources actually support is the
narrower claim that still does the work: **no source describes a search spanning tabs.**

**Where it differs from `TaskSearch`**: that one is a **filter** — it narrows the board in place.
This one is a **finder** — the calendar cannot show a day it is not on, so choosing a result
navigates. So this is a results list, and the divergence is deliberate, not a slip of idiom.

---

## R909 — Navigating stays inside the page; `?on=` is for crossing routes and is untouched

**Finding**: 008 R815 added `?on=YYYY-MM-DD`, read once by `useWeekAnchor` to seed the anchor, so the
shell's reminder banner could land on the right day from another tab. `useWeekAnchor` exposes
`goToToday` and `page`, and nothing that jumps to a named date.

**Decision**: `useWeekAnchor` gains `openAt(date)` — one line, `setAnchor({kind: "pinned", date})`.
The search results and the countdown list are both **on the calendar tab**, so they call it directly
and open the details through the editor the view already holds. No route change, no URL write, no
`router.push`, and the back button keeps meaning what it means.

**`?on=` is not touched**, and neither is its read-once rule.

---

## R910 — The countdown's write path is a field, not a feature

**Finding**: `countdown_enabled` has been on `events` since `010_events.sql`, is in `rows.ts`'s
select list, maps to `Event.countdownEnabled`, and is already carried across a series split by
`038_split_carries_the_reminder.sql`. Only two things are missing: nothing puts it in an
`EventInput`, and `createEvent` explicitly leaves it at its default with a comment saying so.

**Decision**: the same four-touch shape Phase 7 used for the per-event reminder — a field on
`EventInput` and the patch type, a boolean in the Zod schema, a column in `createEvent`'s insert and
`updateEvent`'s patch, and a switch row in `EventForm`. `splitSeries` already passes
`event.countdownEnabled` and needs nothing.

**No migration for the flag.** The only migration this phase writes is R904's settings column.

**Scope**: the flag is per **series**, not per occurrence. `event_exceptions`'s payload shape is not
widened again — a countdown on one occurrence of a repeat is not a thing the reference offers, and
R903 already decided a repeat counts to its next occurrence.

---

## R911 — Nothing new is exposed, so nothing new is policed

**Finding**: this phase adds one column to a table that already has row-level security, reads one
column that already ships, and adds one query against `events`, which already has policies.

**Decision**: no new RLS policy, no new grant, no publication change. The policies test gains one
case: an anonymous reader asking for the new settings column is **refused** (`42501`), not handed an
empty result (SC-911) — the standing shape of every policies test in this repo.

**Realtime**: unchanged, and deliberately. The settings row and the events table are already on the
guarded publication with DEFAULT replica identity; SC-908's five seconds is the shipped channel
doing what it already does, not a new subscription.

---

## R912 — What this phase can honestly test, and what it cannot

**Unit-testable, and where the gate's coverage comes from**: days-remaining for every case including
both DST changes and the day itself; which countdowns are in force under each of the three Show
Countdowns values, at a boundary either side; the next-occurrence walk including a rule with no
future match; the rotation's ordering over a list longer and shorter than the space; the progress
figures, which are `counters.ts`'s own tests plus one that the calendar reads the same numbers; and
the search's result shaping — one row per series, its next date, and the empty case.

**Testable in the browser** (`007-family-e2e` gains journeys): marking an event a countdown and
seeing the bar; the three settings values admitting different countdowns; tapping the bar for the
full list and choosing one; the Filter's Tasks Progress switch and a hidden Profile leaving the row;
searching, choosing a result, and landing on its day; and the phone-width layout of a bar with three
countdowns and three Profiles in it.

**Not testable here, said plainly**: the midnight roll in a real browser. `installClock` installs at
the real `Date.now()` and `pinForward` refuses a jump over **three hours**, because the signed-in
session is a token minted on the real clock and a browser pinned days away decides it has expired
(007 harness.md §5). Reaching a household midnight from an arbitrary run time needs up to
twenty-four. So the arithmetic is proved as arithmetic — `countdown-days.test.ts`, across both
daylight-saving changes — and the wiring by the number being a function of `useNow`'s `todayDate`,
the same shipped minute store the Phase 7 banner journeys already pin and exercise. Nothing here
claims the wall tablet has been watched overnight; the quickstart lists that as the operator's own.

*(A first draft of this section said three hours was "enough to cross a midnight". It is not, except
by luck of the run time — corrected here rather than left to mislead the next phase.)*

---

## R913 — The hosted migration lands before the branch merges

**Finding**: the same rule as 008 R818. This project's local stack and the household's hosted project
are the same schema, kept so by pushing migrations before the code that needs them ships.

**Decision**: `supabase db push` for R904's one migration, with the operator's explicit approval,
**before** the merge — never after. The e2e suite must never reach the hosted project; it runs on the
local stack, as it always has.

---

## R914 — No automatic emoji

**Finding**: the reference says the countdown status in the event's details popup may have "a
relevant emoji" the system adds automatically `[V](40459070511515)`.

**Decision**: not built. Choosing an emoji from an event's title means either a mapping table this
project would have to invent and maintain, or a model call — and constitution §VII forbids a child's
schedule leaving this project's own infrastructure, which rules the second out entirely. A countdown
that says how many days it is is the whole of the documented behaviour; the emoji is decoration this
project declines. Recorded in the spec's divergences table.

---

## R915 — Two shipped tests will have to change, and they are not failures

**Finding**: `EventDetails.test.tsx` carries an assertion named *"has no invitee or countdown row
anywhere (FR-229/230/228)"*, which asserts the rendered text does not match `/countdown/i`. It is
correct today and this phase makes it wrong.

**Decision**: the countdown half of that assertion is replaced by its opposite — a countdown event
shows its status under the title, a non-countdown event shows nothing — and the **invitee half stays
exactly as it is**, because invitees remain permanently excluded (this app sends no mail). The two
were bundled in one test for a reason that no longer holds, so they are separated rather than
weakened.

The same care applies to `002-family-week-calendar`'s FR-228 and FR-268: both are deferrals that this
phase discharges. They are not edited — a shipped spec records what that phase shipped — and this
spec cites them as the debts it pays.
