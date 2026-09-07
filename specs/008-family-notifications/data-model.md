# Data Model — 008 Family Notifications

Two migrations, `034` and `035`. Both only add columns to tables that already exist. This phase adds
**no new table**: a reminder is drawn by a page that is open and remembered by the browser that drew
it, so there is nothing for the database to hold.

**Ordering (R818)**: both are pushed to the hosted project **before** this branch is merged or
deployed. `SETTINGS_COLUMNS` and `EVENT_COLUMNS` in `lib/family/rows.ts` name every column the app
selects explicitly, so a deployment that asks a database without them for `notify_task_due` or
`reminder_mode` gets an error, not a null. The failure is narrower than the ones earlier phases had to
order around — the settings read and the calendar read fail, not the shared realtime channel — but
those are the two reads every `/family` page depends on, so the ordering stands.

---

## 034 — the household's five choices

Five columns on `family.household_settings`, the table that has held every household-wide choice since
Phase 1 (R810). No new table, no new policy, no new join: the row is already read by every page and
already written by one parent-guarded action.

| Column | Type | Default | Constraint |
|---|---|---|---|
| `notify_event_at_time` | `boolean not null` | `false` | — |
| `notify_event_before` | `boolean not null` | `true` | — |
| `notify_event_before_minutes` | `integer not null` | `10` | `between 1 and 10080` |
| `notify_task_due` | `boolean not null` | `true` | — |
| `notify_task_completed` | `boolean not null` | `false` | — |

**The defaults are FR-807's**, and they are the schema's defaults rather than a seed's, so a household
that has never opened Settings is already reminded of its events and never told about completions.
No fetched source documents a factory default for any of the four `[UNKNOWN]`; Assumption 6 owns this.

**The lead time is minutes, always** (R810). The unit picker in the interface is a control, not a
storage format: "2 hours" is `120`. That keeps every comparison in one unit and makes the seven-day
ceiling a single integer bound — `10080` minutes — rather than a rule spread across three units.

**`notify_event_before_minutes` stays meaningful when `notify_event_before` is false.** It is the value
the field shows when the switch is turned back on, which is what a household expects. Nothing reads it
while the switch is off.

---

## 035 — one event's own reminder

Three columns on `family.events`, and the same three on `family.event_exceptions` (R809). Explicit,
constrained columns rather than a document, in the style `012_event_exceptions.sql` set.

### On `family.events`

| Column | Type | Default | Meaning |
|---|---|---|---|
| `reminder_mode` | `text not null` | `'inherit'` | `inherit` \| `none` \| `custom` |
| `reminder_at_time` | `boolean` | `null` | only when `custom` |
| `reminder_before_minutes` | `integer` | `null` | only when `custom`; `between 1 and 10080` |

```
constraint events_reminder_payload check (
  case reminder_mode
    when 'custom' then reminder_at_time is not null or reminder_before_minutes is not null
    else reminder_at_time is null and reminder_before_minutes is null
  end
)
```

Three states, named (FR-808):

- **`inherit`** — follow the household. The default, so every event that exists today keeps behaving
  exactly as the household's settings say, before and after this migration.
- **`none`** — deliberately silent. This is why a mode column exists at all: null already means
  inherit, so silence needs a name of its own. The sources say nothing about expressing it
  `[UNKNOWN]`; Assumption 4 owns it.
- **`custom`** — this event's own choice, of at-time and/or a lead time. The check makes an empty
  `custom` impossible, because an empty custom is just `none` written badly.

### On `family.event_exceptions`

The same three columns, but **`reminder_mode` is nullable and defaults to null**, because that table's
established convention is *null means inherit from the series* — the four override columns from Phase
2 already work that way and this phase does not get to change what null means there.

So the resolution order for one occurrence of a repeating event is:

```
exception.reminder_mode ?? event.reminder_mode ?? 'inherit'   →   if 'inherit', the household's
```

This is what makes FR-810's three scopes work with no new machinery. **This event** writes an
exception. **This and future events** splits the series through the shipped `split_event_series` RPC
and writes the new tail. **All events** updates the row. Phase 2 built all three; this phase adds
columns to the tables they already move.

---

## Who reads these columns

The settings row and the event columns are already carried by the reads every tab makes, but the
banner does not depend on whichever tab is showing. It mounts in the app shell and owns **a small
dedicated query of its own** — the household's events and timed chore occurrences over the reminder
horizon (R802). It has to: on the Lists or Meals tab the calendar's data is not loaded at all, and a
lead time of up to seven days can be owed for an event outside any window the screen has ever shown.
That query reads the same columns through the same `lib/family` modules; it is one more reader of the
existing shape, not a new one.

---

## What is not stored, and where "shown once" lives instead

Nothing records a reminder server-side. The browser keeps a **Set of reminder keys in
`localStorage`**, and a key already in the Set is a banner already shown (FR-816). A key is the
occurrence and the instant it fires (R808), so a moved event reminds again at its new time and a
re-drawn banner for the same moment does not. A completion is keyed on the `task_resolutions` row's
own identity rather than on (task, date), because a routine can be completed in two slots on one day
and an Anytime chore has no date at all.

**This is a per-device convention, and it degrades in two ways that must be said plainly**: clearing
site data, a private window or a second browser profile starts with an empty Set, so a reminder still
inside its fifteen-minute freshness window (FR-817) can appear again; and two tabs of the app each
draw their own banner, because each is its own reader with its own dismissals. Both are the price of
having no server-side record, and the spec's own edge case already wants dismissal to be per-device.

The per-device switches of FR-815 — banners on, sound off — live in the same place, for the same
reason: they are a choice about one screen, not about the household, and they need no browser
permission to honour.

---

## The invariants, and what enforces each

| Invariant | Enforced by |
|---|---|
| A custom event reminder is never empty | `events_reminder_payload` check, on `events` and on `event_exceptions` |
| An occurrence with no opinion follows its series | `reminder_mode` nullable on `event_exceptions` — the table's own null-means-inherit convention |
| A lead time never exceeds seven days | `between 1 and 10080`, on both tables and on the settings |
| A due reminder exists only for a timed chore | the query's predicate: `routine = false and due_time is not null` (R812) |
| A reminder is shown once **per device** | **the browser's own key Set, not the database** — with the two degradations above |
| A completion is announced once, and never for an un-ticking | the resolution row's identity in that same Set, plus the resolution's own `status` |

---

## The privilege delta

What this phase changes about who may do what. Everything not listed is unchanged.

| Operation | Who | Why |
|---|---|---|
| Read the notification settings | any member | They are household settings, already readable |
| Change the notification settings | **a punched-in parent** | FR-805, via the existing `requireParent` guard on `updateHouseholdSettings` |
| Set an event's own reminder | whoever may edit the event | It is a field on the event, under the event's existing rules |

**There is no new policy to write, because there is no new table.** The five settings columns and the
six reminder columns inherit the RLS their tables have carried since Phase 1 and Phase 2 — `is_member()`
for SELECT, service-role ALL, and the parent guard in the action — so anonymous gets a refusal rather
than an empty result on every one of them. SC-815 checks it.

---

## What the seed does, and does not

`scripts/family-seed.mjs` gains nothing. It leaves the notification settings at their schema defaults,
so a fresh local stack behaves exactly as a fresh household does, and its events take the column
default `inherit`, so nothing in the seeded week carries a reminder of its own until a journey sets
one. That is what the browser journeys assert against.
