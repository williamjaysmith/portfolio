# Data Model — 008 Family Notifications

Four migrations, `034`–`037`. Two of them only add columns to tables that already exist; the third
adds the two tables this phase actually needs; the fourth puts one of them on the realtime channel.

**Hard ordering (R818)**: all four are pushed to the hosted project **before** this branch is merged
or deployed. `push_devices` joins the publication that every `/family` page subscribes to, and a
client binding for a table the database does not have fails the whole shared channel — the calendar
and the boards with it.

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

## 036 — the two new tables

### `family.push_devices` — a browser that asked to be told

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key` | |
| `household_id` | `uuid not null` | → `households(id) on delete cascade` |
| `endpoint` | `text not null` | the push service's URL for this browser; **unique** |
| `p256dh` | `text not null` | the subscription's public key |
| `auth` | `text not null` | the subscription's auth secret |
| `label` | `text not null` | what a person calls it — "Kitchen tablet", "Ben's phone" |
| `created_by` | `uuid` | → `categories(id) on delete set null`, the usual attribution |
| `created_at` / `last_seen_at` | `timestamptz not null` | |

`endpoint` is globally unique, not unique per household: a push endpoint identifies one browser, and
the same browser cannot belong to two households. Re-registering an endpoint updates the row rather
than adding a second (a browser that renews its subscription keeps its identity).

**A device is not tied to a Profile.** Assumption 3: a reminder is addressed to the household, so what
is stored is a browser with a name a person recognises. `created_by` records who set it up, which is
attribution, not routing.

**`label` is the only free text here**, and it is the household's own words. `endpoint`, `p256dh` and
`auth` are credentials for reaching a browser; they are never rendered, never logged, and never leave
the server.

### `family.reminder_deliveries` — what has already been sent

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key` | |
| `household_id` | `uuid not null` | → `households(id) on delete cascade` |
| `subject_kind` | `text not null` | `event` \| `task_due` \| `task_done` |
| `subject_id` | `uuid not null` | the event or task; no FK, so the row survives a delete |
| `occurrence_date` | `date not null` | Phase 2's occurrence grammar (R808) |
| `fire_at` | `timestamptz not null` | the instant it was for, derived, never `now()` |
| `title` / `body` | `text not null` | the words, so the worker's fetch needs no recomputation |
| `path` | `text not null` | where acting on it opens (R815) |
| `dispatched_at` | `timestamptz` | null = written but not yet sent |
| `created_at` | `timestamptz not null` | |

**Two partial unique indexes, because identity is kind-dependent (R808):**

```sql
-- scheduled: the occurrence AND the instant, so a moved event reminds again at its new time
create unique index reminder_deliveries_scheduled_key
  on family.reminder_deliveries (household_id, subject_kind, subject_id, occurrence_date, fire_at)
  where subject_kind <> 'task_done';

-- a completion: one announcement per occurrence, however often it is un-ticked and re-ticked
create unique index reminder_deliveries_completion_key
  on family.reminder_deliveries (household_id, subject_id, occurrence_date)
  where subject_kind = 'task_done';
```

The second index is the whole of FR-819's "not for an un-ticking": a re-tick of the same occurrence
finds the row already there and says nothing. No code decides this.

**`subject_id` carries no foreign key, deliberately.** A reminder that has been sent is a fact about
the past, and deleting the event must not rewrite it. FR-821 handles the other direction — a deletion
*before* the send means the due-computation never produces the reminder, because it reads the events
that exist.

---

## The invariants, and what enforces each

| Invariant | Enforced by |
|---|---|
| A reminder is delivered at most once | `reminder_deliveries_scheduled_key`, a unique index — not code (R807) |
| A completion is announced at most once per occurrence | `reminder_deliveries_completion_key` |
| A sending run in progress is never re-sent by the next run | `dispatched_at` is stamped **before** the fan-out, not after (R807) |
| A custom event reminder is never empty | `events_reminder_payload` check |
| A lead time never exceeds seven days | `between 1 and 10080`, on both tables and the settings |
| A due reminder exists only for a timed chore | the query's predicate: `routine = false and due_time is not null` (R812) |
| A push credential never reaches a client | `push_devices` is read only by the server; the device list renders `label` and dates |
| A deleted device's endpoint never travels | DEFAULT replica identity on the publication — see 037 |

---

## 037 — live updates for the device list

`family.push_devices` joins the guarded `supabase_realtime` publication, using the `022`/`027`/`029`/
`033` guard block verbatim. `family.reminder_deliveries` **does not** (R817): it is bookkeeping nobody
renders, and it would be the noisiest table in the household.

**DEFAULT replica identity, and `replica identity full` is prohibited** — the same §VII rule Phase 6
recorded. A DELETE payload is not RLS-filtered by Realtime, so a full replica identity would put a
removed device's `endpoint`, `p256dh` and `auth` into a broadcast payload. Those are credentials for
reaching a family's browser. The default identity sends the primary key and nothing else.

The consequence, already decided by `022` and unchanged here: with the default replica identity a
DELETE payload carries no `household_id`, so the subscription carries no server-side filter. This
phase deletes on the hot path — removing a device (FR-827) and pruning a dead subscription (FR-826) —
so that matters and is why the binding matches the shipped pattern rather than inventing one.

---

## The privilege delta

What this phase changes about who may do what. Everything not listed is unchanged.

| Operation | Who | Why |
|---|---|---|
| Read the notification settings | any member | They are household settings, already readable |
| Change the notification settings | **a punched-in parent** | FR-805, via the existing `requireParent` guard on `updateHouseholdSettings` |
| Set an event's own reminder | whoever may edit the event | It is a field on the event, under the event's existing rules |
| Register **this** device for push | **anyone punched in** | It is a person at a device asking for their own household's reminders |
| Remove **any** device | **a punched-in parent** | It takes reminders away from somebody else's phone |
| Read the pending reminders | **any signed-in household device, no punch-in** | R819: a punch-in lasts three minutes and would expire in a pocket. This is a read of the household's own data by a device that is already signed in — Phase 1's rule for reads, unchanged |
| Trigger a scan | **the shared secret only** | R804. No session, no actor, no household context: the run works across the whole household set by service role |

**Anonymous gets nothing, on every new path.** Both new tables carry the `is_member()` SELECT policy
and service-role ALL, matching every table since Phase 1; the two route handlers refuse before they
read. SC-815 checks all of it.

---

## What the seed does, and does not

`scripts/family-seed.mjs` gains nothing that is a credential. It leaves the notification settings at
their schema defaults, so a fresh local stack behaves exactly as a fresh household does.

**It never seeds a push device.** A subscription is minted by a real browser against a real push
service; a fabricated row would be a row that can never receive anything, and the first thing it would
teach is that sends fail. The device list's empty state is therefore what the local stack shows, and
it is what the browser journeys assert.
