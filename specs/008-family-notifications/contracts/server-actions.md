# Contracts — 008 Family Notifications

No new server actions, three extended, and no route handlers. Every action returns Phase 1's
`ActionResult<T>` and fails through `runAction`, so the error vocabulary (`NOT_AUTHENTICATED`,
`NO_ACTOR`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `UNAVAILABLE`) is unchanged and nothing
new is invented.

**Nothing here queues.** Phase 2's FR-283 and FR-288 stand: a write that cannot complete is refused
where the tap happened, and refused writes never retry themselves. And nothing here makes an existing
write cost more (FR-832): a reminder is something a browser works out from data it has read, never a
second thing a write has to do.

---

## Extended: `updateHouseholdSettings(patch)`

`lib/family/actions/settings.ts` — unchanged in shape. Five entries join `SETTINGS_FIELDS` (R810):

```
notifyEventAtTime        → notify_event_at_time
notifyEventBefore        → notify_event_before
notifyEventBeforeMinutes → notify_event_before_minutes
notifyTaskDue            → notify_task_due
notifyTaskCompleted      → notify_task_completed
```

Those five are the whole of the household's notification state. What a given screen does with a
reminder — whether it draws the banner, whether it plays the tone — is that device's own business and
is kept in its browser (FR-815); it never reaches this action and there is no field here for it.

**Who**: `requireParent()`, already the guard on this action (FR-805). A punched-in member reading
Settings sees the values and cannot change them; the interface says why, and the server refuses with
`FORBIDDEN` if it is asked anyway.

**Validation** (`settingsPatchSchema` grows five fields): the four booleans are booleans;
`notifyEventBeforeMinutes` is an integer `1…10080`. A value over seven days fails with `VALIDATION`
and a field error the form shows on the field itself — FR-806's "refused with a plain message" is a
field error, not an alert.

**Returns**: `{ household, settings }`, unchanged, so every open page picks the change up on the
existing realtime invalidation. FR-801's "another device has it within five seconds" needs no new
code.

---

## Extended: `createEvent(input)` and `updateEvent(input)`

`lib/family/actions/events.ts` — the patch grows one optional field:

```ts
reminder?:
  | { mode: "inherit" }
  | { mode: "none" }
  | { mode: "custom"; atTime: boolean; beforeMinutes: number | null }
```

**Why a field on the existing actions and not a new action**: `updateEvent` already takes the scope and
already knows how to write an exception, split a series through `split_event_series`, or update the
row. A reminder is a property of an event under exactly those rules (FR-810), so it rides the machinery
Phase 2 built rather than a parallel path that would have to reimplement the three scopes.

**Validation**: `custom` requires at least one of `atTime: true` or a `beforeMinutes` in `1…10080`. A
`custom` carrying neither is a `VALIDATION` failure, mirroring the database's own
`events_reminder_payload` check — the constraint is the authority, the schema is the good error
message.

**Who**: whoever may edit the event. This phase adds no privilege.

**Scope behaviour**, unchanged from Phase 2 and now covering three more columns:

| Scope | What is written |
|---|---|
| `this` | an `event_exceptions` row with `action = 'override'` and the three reminder columns |
| `this_and_future` | `split_event_series`, then the reminder on the new tail |
| `all` | the three columns on `family.events` |

---

## Unchanged: the task completion path

`lib/family/actions/tasks.ts` — completing a task writes **nothing extra at all**. The action is
exactly Phase 3's: it inserts the `family.task_resolutions` row, does its streak step, and returns.
There is no notification row, no send, and nothing for this phase to add to the transaction. This is
the simplest contract in the phase, and it is the one that would have been the most complicated.

**Why nothing is needed**: `family.task_resolutions` is already on the guarded realtime publication and
already carries `status`, `resolved_at`, `occurrence_date` and the credited profile, so a page that is
open already hears that a completion happened and already refetches the row. FR-819's announcement is
composed on the receiving device out of data it now holds. It is a read-side concern from end to end
(R811) — which is also why it is silent on a device with no page open, in common with everything else
this phase does.

**What the page actually receives**: the realtime payload is an invalidation trigger and is never
rendered `[P3]` FR-392, so the announcement is drawn from the resolution row the invalidation's refetch
brings back, not from the payload. That is the same rule the tasks board has followed since Phase 3;
this phase reads one more field off the same refetched row.

**Deduped on the resolution row's own identity**, not on `(task, occurrence_date)`: a routine can be
completed in two of its slots on the same day, and an anytime chore has no date at all, so that pair is
not unique and would swallow a real second completion. The row's id is unique by construction.

**Suppressed on the device that did the ticking.** That person is looking at the card that just
flipped; telling them what they just did is noise.

**Skipping and un-ticking announce nothing.** Both are excluded by FR-819, and both fall out of the
row rather than being special-cased: a skip carries `status = 'skipped'` and is filtered, and an
un-ticking deletes the resolution row, so there is nothing to announce. A subsequent re-tick is a new
row with a new identity and does announce again — it is a completion that happened, which is what
FR-819 asks to be named, and it is not an un-ticking.

---

## Not an action: what the banner reads

The banner writes nothing, so it has no contract here. It is listed because the shape of its read is
the reason this phase adds no action at all, and because the earlier assumption about it was wrong.

The banner mounts in the app shell, so it cannot borrow whichever tab's data happens to be loaded: on
Lists or Meals the calendar's query is not mounted, and a lead time of up to seven days can be owed for
an event that no visible window covers. So the banner owns a small dedicated query of its own — the
household's events and its timed chore occurrences over the reminder horizon — independent of whichever
tab is showing (R802). It goes through Phase 1's client and the existing row-level policies, adding a
read and nothing else. It is still one pure due-computation with one reader; what changed is where that
reader gets its data.

**"Shown once" is a per-device convention** (FR-816). The device keeps a Set of reminder keys in its
browser's `localStorage`; nothing is recorded server-side, because nothing server-side is looking. Two
consequences follow and are accepted rather than worked around: clearing site data, a private window or
a second browser profile can show a reminder again while it is still inside its fifteen-minute
freshness window (FR-817); and two tabs on one device each keep their own Set, so each shows its own
banner.
