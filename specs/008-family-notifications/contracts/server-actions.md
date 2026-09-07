# Contracts — 008 Family Notifications

Two new server actions, three extended, and two route handlers — the first route handlers in this
repository. Every action returns Phase 1's `ActionResult<T>` and fails through `runAction`, so the
error vocabulary (`NOT_AUTHENTICATED`, `NO_ACTOR`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`,
`UNAVAILABLE`) is unchanged and nothing new is invented.

**Nothing here queues.** Phase 2's FR-283 and FR-288 stand: a write that cannot complete is refused
where the tap happened, and refused writes never retry themselves.

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

## Extended: the task completion path

`lib/family/actions/tasks.ts` — completing a task writes its notification row **in the same
transaction as the completion** (R811), when `notify_task_completed` is on.

```
insert into family.reminder_deliveries
  (household_id, subject_kind, subject_id, occurrence_date, fire_at, title, body, path)
values (…, 'task_done', task_id, occurrence_date, now(), …, …, '/family/tasks')
on conflict do nothing
```

`dispatched_at` is left null: the row is owed, not sent. The action then returns as it always has, and
Next's `after()` sends it once the response has gone — so a child ticking a chore off waits for
nothing. If that send never happens, the next scan finds the undispatched row and sends it (R811).

**Why in the transaction**: if the tick rolls back there is nothing to announce, and if the tick lands
the announcement is owed. Any other arrangement can announce a completion that did not happen.

**`on conflict do nothing`** is FR-819's "not for an un-ticking": the partial unique index on
`(household_id, subject_id, occurrence_date)` for `task_done` means a re-tick of the same occurrence
finds the row already there and says nothing.

**Skipping and un-ticking write nothing at all.**

---

## New: `registerPushDevice(input)`

`lib/family/actions/push-devices.ts`

```ts
input: { endpoint: string; p256dh: string; auth: string; label: string }
returns: ActionResult<{ id: string; label: string; createdAt: string }>
```

**Who**: `requireActor()` — anybody punched in. It is a person standing at a device asking for their
own household's reminders, not a change to what the household does (FR-822). The three-minute punch-in
is plenty for a setup step somebody is actively performing.

**Validation**: `endpoint` is an absolute `https:` URL under 2000 characters; `p256dh` and `auth` are
base64url; `label` is 1–40 characters after trimming.

**Idempotent on `endpoint`**: a browser that renews its subscription keeps its row. `on conflict
(endpoint) do update` refreshes the keys, the label and `last_seen_at` rather than adding a second
row, so FR-824's "each device once" holds even after a renewal.

**Returns no credential.** The row's `endpoint`, `p256dh` and `auth` never travel back to a client;
what comes back is what the device list renders.

---

## New: `removePushDevice(input)`

```ts
input: { id: string }
returns: ActionResult<null>
```

**Who**: `requireParent()`. Removing a device takes reminders away from somebody else's phone (FR-827),
which is the kind of thing this project has consistently made a parent's decision.

**Not found** in this household → `NOT_FOUND`. There is no confirmation dialog contract here: the
interface confirms, because §VI requires a destructive action to say what will be lost, and what is
lost is one device's reminders.

---

## New route handler: `POST /api/family/reminders/run`

The scan (R803). The first route handler in this repository, and the reason the `api-routes` fallow
zone finally has a member.

**Authentication**: `Authorization: Bearer <secret>`, compared in constant time against an environment
variable (R804). There is **no session and no actor** — the run works across households by service
role. A missing, wrong or malformed header returns `401` with an empty body and does no work. The
secret is never written to a file in this repository.

**Request**: no body. The window is the server's own business.

**What it does, in order:**

1. Compute the window: `(the last successful run, now]`, clamped to the last fifteen minutes
   (FR-817, FR-829). The clamp is in `lib/family/notifications/window.ts` and is unit-tested; the route
   only calls it.
2. Read each household's settings, its events and exceptions, and its timed chores over the window.
3. Ask the pure due-computation what is due (R802) — **the same function the browser calls**.
4. For each, `insert … on conflict do nothing returning id` with `dispatched_at = now()`. A row that
   comes back is this run's to send; a row that does not was already claimed and is skipped.
5. Sweep any `task_done` rows still undispatched inside the window, claiming them the same way.
6. Send each claimed row to every device in its household.
7. Delete `push_devices` rows whose send returned `404` or `410 Gone` (FR-826). Any other failure is
   counted and the row is left alone.
8. Delete `reminder_deliveries` older than thirty days (R808).

**Response**: `200` with counts — considered, claimed, sent, pruned. Nothing household-identifying, so
the response is safe in a scheduler's log.

**Failure**: a household that throws does not stop the others (FR-831). The route returns `200` with
the counts it managed and logs the rest; a `500` would make the scheduler retry, and a retry is how a
phone buzzes twice.

---

## New route handler: `GET /api/family/reminders/pending`

What the service worker asks for when a contentless push arrives (R814, R819).

**Authentication**: the household's own session cookie, the same one every `/family` page uses. **No
punch-in** — a punch-in expires in three minutes and this is a phone in a pocket. The handler resolves
the household from the session and filters by it explicitly, as §VII requires of every query.

**Returns**:

```json
{ "reminders": [ { "title": "…", "body": "…", "path": "/family/calendar?on=2026-09-08" } ] }
```

Those dispatched for this household within the last fifteen minutes — the same window the scan uses, so
the worker and the scan cannot disagree about what is current.

**Refusals**: no session → `401`; a signed-in account that is not on the allowlist → `403`. Both
return an empty body. The worker treats every non-`200` identically: show the contentless fallback.

**Why the words are stored rather than recomputed**: the row already holds the title and body the scan
composed. Recomputing them here would be a second implementation of `message.ts` reachable by a
different path, and the two could drift.

---

## What the service worker may do

`public/family/sw.js` is not a contract with a server, but it is a contract with the browser, and
getting it wrong is how a permission gets revoked.

| Event | Obligation |
|---|---|
| `push` | **Always** call `showNotification`, on every path including failure. A worker that receives a push and shows nothing gets the browser's own "this site was updated in the background", and repeat offences cost the permission (R814). |
| `push`, happy path | Fetch `/api/family/reminders/pending`, show one notification per reminder. |
| `push`, any failure | One notification saying the household has a reminder, with no detail. Honest, not wrong. |
| `notificationclick` | Focus an existing `/family` window if one is open, otherwise open the notification's `path` (FR-825). |
| `fetch` | **No handler.** The offline cache is Phase 9; adding one here would silently change how every `/family` request is served (R806). |

---

## The local trigger

`scripts/family-reminders.mjs`, run as `npm run family:reminders -- --local`. It posts to the same
route with the same header, because there is no `pg_cron` in this repository's local stack.

It is a trigger and nothing else: no logic lives in it that is not in the route. A developer running it
twice in a row is exercising the claim constraint, which is the point.
