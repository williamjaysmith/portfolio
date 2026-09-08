# Data Model — 009 The Calendar's Preview Bar

**Date**: 2026-09-07 · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

This phase is mostly **derivation**, not storage. One column is added. One column that has shipped
since Phase 2 finally gets written and read. Everything else on this page is computed from rows that
already exist.

---

## 1. Stored — one new column

### `family.household_settings.show_countdowns`

```sql
-- 039_show_countdowns.sql
alter table family.household_settings
  add column show_countdowns text not null default 'always'
    check (show_countdowns in ('always', 'three_months', 'one_month'));
```

| Property | Value | Why |
|---|---|---|
| Type | `text` with a check constraint | The reference's three values are one choice, not a flag and a number (R904) |
| Values | `always`, `three_months`, `one_month` | Exactly the three the reference documents `[V](40459070511515, 48784194278683)` — no fourth, no "never" |
| Default | `'always'` | A household that has never opened Settings sees every countdown it marked. The opposite default would make FR-901 look broken |
| Null | not null | A missing preference is not a state this has |
| Who may write | a punched-in **parent**, through `updateHouseholdSettings` | `[P1]` FR-015, server-enforced |
| Who may read | any member of the household | The shipped `household_settings` policies, unchanged (R911) |

The column rides the table's existing RLS, its existing realtime publication entry and its DEFAULT
replica identity. Nothing about the table's security or replication changes.

### `family.events.countdown_enabled` — shipped, and finally used

Added by `010_events.sql` with the comment *"Reserved for the countdown phase (FR-228). Nothing
reads or writes it now."* It is already in `rows.ts`'s select list, already mapped to
`Event.countdownEnabled`, and already carried across a series split by
`038_split_carries_the_reminder.sql`. **No migration touches it.** What changes is the code either
side: `createEvent` stops leaving it at its default, and `updateEvent` starts patching it.

It is a property of the **series**, not of an occurrence. `event_exceptions`'s payload shape is not
widened (R910) — a countdown on one occurrence of a repeat is not something the reference offers.

---

## 2. Derived — nothing here is stored

### A countdown

Not a row. An event with `countdownEnabled` true, plus the date it counts to and how far away that
is. Computed fresh on every render from the household's clock.

| Field | Derived from | Rule |
|---|---|---|
| `eventId`, `title` | the event | — |
| `targetDate` | `times.startDate` or the rule | One-off: its own start date. Repeat: the next occurrence on or after today, from `ruleDatesIn` over `[today, today + 400 days]`; failing that, its last past occurrence for the details line only (R903) |
| `daysUntil` | `diffDays(todayDate, targetDate)` | In the household's zone (FR-904). `0` is today; negative is past |
| `state` | `daysUntil` | `> 0` **upcoming** · `= 0` **today** · `< 0` **past** |
| `inForce` | `state` + `show_countdowns` | See the table below |

**Which countdowns are in force** (FR-903, Assumption 5):

| `show_countdowns` | Shown when |
|---|---|
| `always` | `daysUntil >= 0` |
| `three_months` | `0 <= daysUntil <= 92` |
| `one_month` | `0 <= daysUntil <= 31` |

92 and 31 are **days**, not calendar months, and that is deliberate: a month-counted window would
make "3 months prior" mean a different number of days in February than in July, and the boundary
tests could not then be written against a fixed number. Recorded here rather than in the loop.

A countdown whose `state` is **past** is never in force, whatever the setting: FR-905 takes it off
the bar the day after. It still shows its status in the event's own details, because an event that
was a countdown did not stop being one.

### A Profile's progress

Not a row, and not a new rule. `columnCountersOf(occurrences, profileId)` over
`expandTaskDay(tasks, resolutions, cursors, {displayedDate: todayDate, todayDate, zone})` — the
Tasks board's own four reads and its own pure expansion (R905, R906). `TaskCounters` is
`{complete, total}` and is `counters.ts`'s type, imported, not redeclared.

**Today, not the displayed day** (Assumption 7). The board is a today-shaped board and the reference
describes progress, not a history.

### A search result

Not a row. One entry **per event**, never per occurrence (FR-918):

| Field | Rule |
|---|---|
| `eventId`, `title` | the matching row |
| `onDate` | the same next-occurrence date as a countdown's target; a repeat entirely in the past shows its last occurrence |
| `isRepeat` | whether the row carries an `rrule`, so a result can say it repeats |

Ordered by `onDate` ascending — soonest first, which is what somebody asking "when was the school
thing" wants at the top.

---

## 3. Per-device — the browser's own storage, never the database

Two new switches on `createDeviceSwitches`, in the shipped `useCalendarMealSwitch` shape (R907):

| Switch | Default | What it does |
|---|---|---|
| `tasksProgress` | **off** | FR-911's Filter toggle. Off, `TasksProgressRow` does not mount, so the calendar makes no task request at all (R905) |
| `pauseRotation` | **off** | FR-908's stop. `prefers-reduced-motion` stops the rotation too, without this being touched |

Storage key `family:calendar-preview:v1`. They join the Filter sheet's **Show all**, like every other
per-device store — which for these two means the state a household expects from "show me everything":
progress on, rotation running.

Off by default for Tasks Progress because the reference ships its Filter toggles off, and because a
switch that is on by default would put four task reads on every calendar paint for a household that
never asked for them.

---

## 4. What is deliberately not modelled

- **No countdown table.** A flag and a setting are the whole of it; a table would be a second place
  for an event's title to live.
- **No stored `days_remaining`.** It changes every midnight; storing it would need a job to update it
  and would be wrong between runs.
- **No per-occurrence countdown.** R910.
- **No search index.** R908 — `ilike` over a household's own events, with a row cap.
- **No new realtime publication entry.** R911 — the tables are already on the channel.
