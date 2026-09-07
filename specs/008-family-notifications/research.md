# Research — 008 Family Notifications

Decisions taken before any code, each with what it rests on and what was rejected. Numbered `R8nn`
and cited from the plan, the data model and the tasks. Read `spec.md` first: this answers *how*, the
spec answers *what*.

Two things were checked against the repository rather than assumed, and both changed the design:
the app already has a shared minute-resolution clock (`useNow`), and `/family` has **no URL
parameters at all** — every screen is client-state-driven, which is why R815 exists.

---

## R801 — This phase is notifications; home, search and offline are the next one

**Decision**: `008-family-notifications` ships reminders, task notifications, the on-screen banner and
push to a device. The Home screen, cross-tab search and the offline cache become `009`.

**Why**: the locked plan bundles six things under "Phase 7". Reminders, task notifications and reaching
a sleeping phone are one mechanism — one due-computation, one settings section, one delivery record.
A home screen is a new landing surface, a search is a query layer, and an offline cache is a fetch
strategy; none of the three shares anything with the other two or with this one. Phases 5 and 6 set
the precedent that a phase must be reviewable and deployable alone.

**Rejected**: shipping all six. The branch would carry four unrelated migrations and the hosted push
would be blocked behind an offline cache nobody has specified. The dossiers document **nothing at all**
about offline behaviour — the reference is in fact criticised for requiring constant connectivity — so
that phase is ours to invent and should not delay this one.

---

## R802 — One pure function, two independent readers

**Decision**: a single pure module answers *"given the household's settings, its events and tasks, and
an instant, which reminders are due?"* Two callers read it: the **browser**, to draw the banner, and
the **server scan**, to send pushes. Neither knows about the other.

**Why**: the browser already holds every event and task for the visible period in the TanStack Query
cache, kept current by the realtime channel. It needs no server round-trip to know that the swim
lesson is in ten minutes — it needs a clock and a function. That makes the wall display's banner free
of new infrastructure, correct the instant the underlying data changes, and entirely unit-testable.

**Consequences that fall out of it**, and that shape everything below:

- The banner needs **no** realtime message, **no** route, and **no** delivery record. Its "don't show
  this twice" (FR-816) is per-device local state, which is exactly what the spec's edge case demands
  ("dismissing on one does not dismiss on the other").
- The **delivery record (R807) binds only the push side**, where "exactly once" is a real risk.
- The two readers cannot disagree, because there is one implementation of "due".

**Rejected**: the server telling the browser what to show, over realtime or a poll. It adds a channel,
a table and a latency budget to reproduce something the browser can already compute, and it would put
the wall display's most visible feature behind the network.

---

## R803 — The scan runs in the database's scheduler and calls a route in this app

**Decision**: `pg_cron` on the hosted project fires every minute and uses `pg_net` to `POST` to
`/api/family/reminders/run` in this deployment. The route does the work: read the window, compute what
is due, claim it, send it.

**Why**: minute granularity is the whole feature, and it must not depend on a browser being open
(FR-830). Supabase ships both extensions on every hosted project. The route handler lives in this
repository, in TypeScript, sharing `lib/family/**` with the rest of the app, covered by the same
gates.

**Rejected**:

| Option | Why not |
|---|---|
| **Vercel Cron** | The Hobby plan schedules at most **once a day**. A daily reminder engine is not one. |
| **A Supabase Edge Function** | Deno, a second runtime, a second deployment, and no way to import `lib/family/**`. The due-computation would be written twice or moved to SQL. |
| **An external scheduler** | A third party holding a key that can trigger sends, for a household of three. |
| **A long-running Node process** | Nowhere to run it. Vercel is serverless. |

**Locally**, `pg_cron` is not installed in this repository's stack, so there is no scheduler. A script
(`npm run family:reminders -- --local`) posts to the same route with the same secret. The route is the
only implementation; the trigger differs, which is the right seam.

**Cadence and window**: every minute. Each run considers `(last successful run, now]`, clamped to the
last **fifteen minutes** (FR-817, FR-829). A gap of an hour therefore sends what is current and drops
the rest, rather than flooding.

---

## R804 — The cron caller proves itself with a shared secret, compared in constant time

**Decision**: the route requires an `Authorization: Bearer <secret>` header and compares it with a
length-checked constant-time comparison. No secret, no work, and the response says nothing useful.

**Why**: this is the **first route handler in the repository**, and `proxy.ts` is explicitly not an
authorization boundary in Next 16. A public URL that makes the household's phones buzz is exactly the
kind of thing that must not be triggerable by anyone who guesses it. Constant-time comparison because
a naive `===` on a secret leaks its prefix to a patient caller.

**The secret never enters the repository.** It is set in Vercel's environment and, for `pg_net`, as a
database setting written by the operator by hand — the same discipline as the seed's PINs and the
service-role key. The quickstart gives the two commands; neither is committed.

**Rejected**: signing each call with a timestamped HMAC (more moving parts than a single trusted
caller warrants), and IP-allowlisting Supabase's egress (undocumented and unstable).

---

## R805 — `web-push` for encryption and signing, not hand-rolled crypto

**Decision**: add `web-push` as a production dependency. It performs the RFC 8291 payload encryption
and the VAPID request signing.

**Why**: this repository has written its own recurrence engine, its own geometry and its own storage
adapters, and that has been right every time — those are domain logic with obvious failure modes.
Message encryption is not. The failure mode of a subtle mistake in the key derivation or the record
size is **silent undeliverability**: the push service accepts the request, the device never shows
anything, and no test that mocks the transport can tell. `web-push` is the reference implementation,
and it also encodes the `404`/`410` semantics that R806's pruning depends on.

**Considered and rejected**: writing it against Node's `crypto` (`createECDH`, `hkdfSync`,
`aes-128-gcm`) and RFC 8291's published test vectors. It is perhaps eighty lines and genuinely
testable against the vectors, and it would avoid a dependency. It was rejected because passing the
vectors proves the algorithm, not the integration — the header set, the TTL, the urgency, the
`Content-Encoding` and the endpoint quirks are where this actually goes wrong, and those are not in
any vector. The dependency is small, has no native build step, and runs on the Node runtime Vercel
gives a route handler.

**Not needed**: an edge-compatible push library. The route runs on Node, deliberately, because it also
uses the service-role client.

---

## R806 — A service worker scoped to `/family`, registered only when asked

**Decision**: `public/family/sw.js`, served at `/family/sw.js`, therefore scoped to `/family/` and
unable to touch the rest of willsmith.dev. It is registered **only** when a device turns the switch
on — never on page load.

**Why**: a service worker is the only way a browser shows something when the page is closed. Scoping
it by its own path is free and means the portfolio, `/skyhammer` and `/colectivo` are untouched by a
family-app feature. Registering it lazily means a household that never asks for reminders never gets a
worker, which keeps the failure surface at zero for the default configuration.

**This phase's worker handles two events only**: `push` (show the notification) and `notificationclick`
(focus or open the right page). It has **no `fetch` handler** — that is Phase 9's offline cache, and
adding one now would silently change how every `/family` request is served.

**Pruning dead devices** (FR-826): a send that returns `404` or `410 Gone` means the subscription is
dead; the row is deleted. Any other failure is recorded and left alone.

**Rejected**: serving the worker from a route handler to widen its scope with
`Service-Worker-Allowed`. Nothing wants a wider scope, and a static file is one fewer thing to get
wrong.

---

## R807 — Exactly once is a row, claimed before the send, and it is per reminder not per device

**Decision**: `family.reminder_deliveries` holds one row per reminder that has been sent, with a unique
constraint on its identity (R808). The scan **inserts first**; a conflict means another run already
claimed it, and this run does nothing. Only after the claim does it send, to every subscribed device.

**Why insert-first**: two runs can overlap — a slow run and the next minute's. The unique index is the
only arbiter that survives that, and claiming before sending means the worst case is a reminder that
is missed, not one that is sent twice. For a wall display, a duplicate is worse than a miss: a miss is
invisible, a duplicate is a device that cries wolf.

**Why per reminder, not per device**: FR-824 wants each device to receive it once and never twice.
One claim followed by one fan-out gives exactly that. A per-device record would let a partial failure
be retried, and a retry is precisely how a device ends up buzzing twice (FR-831 forbids it). A device
that was unreachable for that one minute misses that one reminder, which is the same outcome as a
phone in a tunnel.

**Rejected**: an advisory lock around the whole scan (serialises everything and leaks on a crashed
connection), and a "sent" boolean on the event (wrong cardinality — a repeating event has many
occurrences and one row).

---

## R808 — A reminder's identity is the occurrence plus the instant it fires

**Decision**: the unique key is `(household_id, subject_kind, subject_id, occurrence_date, fire_at)`.

**Why `occurrence_date`**: it is Phase 2's occurrence grammar, already the key for exceptions and
already proof against a series-level time change and DST drift. Reusing it means a reminder for the
third Tuesday is identified the same way the third Tuesday's skip is.

**Why `fire_at` as well**: it makes "the event moved, so the new time is what reminds" (FR-821, and
the spec's moved-event criterion) fall out for free. The old instant was claimed and is gone; the new
instant is a different key and is considered on its merits — and if the new instant is already past,
R803's fifteen-minute clamp drops it. `fire_at` is derived deterministically from stored data, never
from the current time, so a jittery clock cannot manufacture a second key.

**Retention**: rows older than thirty days are deleted by the same scan. Nothing reads them, they only
prevent a resend, and a reminder from last month cannot resend anyway.

---

## R809 — A per-event reminder is three explicit columns, not a JSON blob

**Decision**: on `family.events` — `reminder_mode` (`inherit` | `none` | `custom`),
`reminder_at_time boolean`, `reminder_before_minutes integer` — with a check that the two payload
columns are null unless the mode is `custom`, and that `custom` carries at least one of them.

**Why**: this repository's migrations constrain everything they can in SQL; `012_event_exceptions.sql`
spells out each override column with its own named check rather than reaching for a document. Three
constrained columns say the same thing as a JSON object and let the database refuse a nonsense row.
The mode column also gives "deliberately silent" a name, which a nullable payload cannot express —
null already means inherit.

**On `family.event_exceptions` the same three columns are nullable**, because that table's existing
convention is "null means inherit from the series". The asymmetry is deliberate and each table keeps
its own rule; the data model spells it out.

**Rejected**: a `jsonb reminder` column with a shape check. Equivalent in power, weaker in constraint,
and out of step with every migration before it.

---

## R810 — Household settings are five more columns on the table that already holds them

**Decision**: `family.household_settings` gains `notify_event_at_time`, `notify_event_before`,
`notify_event_before_minutes`, `notify_task_due`, `notify_task_completed`, with the defaults FR-807
names. The existing `updateHouseholdSettings` action grows five entries in its `SETTINGS_FIELDS` map.

**Why**: the table exists, `requireParent` already guards the action, the realtime channel already
carries the row, and the Settings screen already renders it. A notifications settings table would add
a join, a policy and a migration to hold five booleans and an integer.

**The lead time is stored in minutes.** The unit picker (minutes/hours/days) is a control, not a
storage format; storing "2 hours" as `120` keeps every comparison in one unit and the seven-day cap a
single integer bound (`between 1 and 10080`).

---

## R811 — Completion notifications are written by the write and sent immediately, with the scan as the net

**Decision**: completing a task writes its notification row in the same transaction as the completion,
then Next's `after()` sends it once the response has gone. If that send never happens — a crash, a
cold start killed — the next scan finds the unsent row and sends it.

**Why**: a completion is an event, not a schedule; there is nothing for a clock to discover. Waiting
up to a minute for the scan would miss SC-809's "within a minute" and would make the household's most
immediate notification its slowest. Sending inside the action instead would put a network round-trip
to a push service in front of a child ticking a chore off — which Phase 3 spent real effort making
instant.

Writing the row **in the same transaction as the completion** is what makes it honest: if the tick is
rolled back there is nothing to send, and if the tick lands the notification is owed. One sender
function, two triggers.

**Rejected**: a realtime broadcast to open pages only (a phone in a pocket is the whole point), and a
trigger in Postgres calling `pg_net` directly (the message text and the settings check would move into
SQL, away from the tests).

---

## R812 — "When Due" is `routine = false and due_time is not null`

**Decision**: a due reminder is generated for a chore occurrence whose task has a `due_time`, and for
nothing else.

**Why**: `family.tasks.due_time` is already a wall clock in the household zone, null on an anytime
chore, and routines carry `times_of_day` slots instead. The reference's own wording is "will only
appear for those chores that are due at a specific time". The column and the sentence agree, so the
predicate is one line and needs no new data.

**Late chores** (FR-818): the reminder belongs to the occurrence's own due date. A carried-forward
chore is still that occurrence, whose `fire_at` is in the past, so R803's clamp drops it and R807's
row already exists. The "remind once, not once a day" behaviour is not special-cased anywhere — it is
what the identity in R808 already means.

---

## R813 — The banner reuses the shell's clock, the device switches and the device storage

**Decision**: `useNow()` from `Clock.tsx` drives the banner. The banner and chime switches are a
`createDeviceSwitches` store. The dismissed set is `readDeviceJson`/`writeDeviceJson`.

**Why**: all three exist, are tested, and are exactly the right shape. `useNow` already publishes only
when the minute changes and already rolls over midnight without a reload, which is one of the spec's
edge cases answered by a component that shipped in Phase 1. `createDeviceSwitches` is documented as
the shape for per-device booleans and is already used by two tabs. Writing a second clock or a second
storage discipline would add duplication the gate would rightly reject.

**The chime**: one short tone, played from a `public/family/` asset on a user-initiated switch's
device. Autoplay policy is not a problem here because the switch is itself a user gesture and the
audio element is primed by it — but a device that refuses is not an error, it is a silent banner.

---

## R814 — The push carries nothing; the worker fetches the words from us

**This is the one decision in the phase that Principle VII forced.** It is worth reading in full.

**The tension**: §VII says no child's name, photo or schedule leaves the project's own
infrastructure. A Web Push request is delivered by Apple, Google or Mozilla. The obvious design puts
"Cleo — Practice piano is due at 5:00" in the payload, and that sentence would transit a third party.

RFC 8291 encrypts the payload end-to-end to the subscription's own keys, so the push service relays
ciphertext it cannot read, and a reasonable person could call that compliant. **We are not going to
lean on that**, because there is a design that does not need the argument.

**Decision**: the push payload is a version marker and nothing else. On receiving it the service
worker fetches `/api/family/reminders/pending` — a same-origin request, which carries the household's
session cookie automatically — and shows what comes back. The push service learns that a push
happened to an endpoint, its size and its time. It never carries a name, a chore or a schedule.

**The fallback is mandatory, not optional.** A browser that receives a push and shows no notification
substitutes its own ("this site has been updated in the background") or, on repeated offences,
revokes the permission. So a failed fetch — expired session, no connectivity, a 500 — still shows a
notification, reading only that the household has a reminder, with no detail. That is a correct
degradation under §VI: less information, never a lie and never a crash.

**What this costs**: one more route handler, an authenticated read, and roughly forty lines in the
worker. **What it buys**: the household's schedule never leaves our infrastructure at all, and the
Constitution Check below passes on the principle rather than around it.

**Rejected**: an encrypted payload carrying the text (§VII, above); and waking the app in a hidden
window to compute it (no such thing exists for a closed browser).

---

## R819 — The pending-reminders route is an ordinary authenticated read

**Decision**: `GET /api/family/reminders/pending` returns the reminders claimed for this household in
the last fifteen minutes — title, body, and the path to open. It is authenticated by the same session
the rest of `/family` uses, filters by the caller's household explicitly, and needs no punch-in
because it writes nothing and reveals nothing a signed-in device cannot already see.

**Why fifteen minutes**: it is R803's window. A worker asking for "what is pending" and a scan
deciding "what is current" must agree, or a device shows a reminder the wall has already dropped.

**Why not the actor cookie**: a punch-in lasts three minutes and expires while a phone is in a pocket.
Requiring one would make the feature fail exactly when it is needed. This is a read of the
household's own data by a signed-in household device — Phase 1's rule for reads, unchanged.

---

## R820 — On an iPhone, this works only once `/family` is on the Home Screen

**Finding, not a decision**: Safari on iOS delivers Web Push only to a site the user has added to the
Home Screen as a web app. In a Safari tab, the permission prompt does not appear at all.

**Consequence**: the household's iPhones must install `/family` before the switch can be turned on.
The manifest already exists (`app/family/manifest.webmanifest`) and Phase 7's browser pass already
checks it, so nothing needs building — but the switch must **say so** rather than silently doing
nothing, and the quickstart must carry the two-step instruction. A control that appears to fail for
no reason is worse than one that explains itself.

**Desktop and Android** have no such requirement; a signed-in browser can subscribe directly.

---

## R815 — Opening the right day needs a date in the URL, which `/family` does not have yet

**Finding**: there is not one `useSearchParams` or `searchParams` in the whole of `app/family/**`. Every
screen is client-state-driven and today-anchored. So today, a notification can open the app but cannot
open **the day the event belongs to** — which FR-825 requires.

**Decision**: add one optional parameter, `?on=YYYY-MM-DD`, read once on mount to seed the calendar's
anchor and then left alone. An absent or unparseable value means today, exactly as now.

**Why read once**: the calendar's anchor is client state that the user moves by paging. A parameter
that kept overriding it would fight the pager. Seeding is the whole requirement.

**Scope discipline**: this is a genuine addition beyond "notifications", and it is here because FR-825
cannot be met without it. It is one parameter on one screen, it changes nothing when absent, and it is
listed in the plan as such rather than smuggled in.

---

## R816 — What can be tested, and what honestly cannot

**Fully unit-testable, and where the coverage the gate needs comes from**: the due-computation (every
lead time, all-day events, the household zone, a DST boundary, midnight), the window and clamp
arithmetic, the settings-to-reminder resolution including the three-state override, the task
predicate, the message wording, and the route's authorization.

**Testable against a contract, not a network**: the sender. `web-push` is injected, so the tests assert
which endpoints were addressed, with what payload, and that a `410` prunes the row.

**Testable in a browser** (`007-family-e2e` gains journeys): the Settings section and its defaults, a
member finding it read-only, the per-event override and its three scopes, the banner appearing at a
pinned clock, dismissal, the chime switch, and the push switch reflecting a **refused** permission —
Playwright can deny the notification permission, which is the branch most likely to be got wrong.

**Not testable here, and said so plainly**: an actual push delivered by Apple or Google to a real
device with every tab closed. No local harness can produce one. It stays in the operator's hardware
pass, alongside the two-device realtime check that has been pending since Phase 5, and the quickstart
gives the steps.

---

## R817 — The realtime channel gains the two new tables that the app reads

**Decision**: `family.push_devices` joins the guarded publication; `family.reminder_deliveries` does
not.

**Why**: FR-827 puts the list of receiving devices on screen, and a device removed on one screen
should vanish on the other — that is what every other table in this app does. Deliveries are the
engine's own bookkeeping, never rendered, and would be the noisiest table in the household. The
publication guard and DEFAULT replica identity follow Phase 2's migration exactly.

---

## R818 — The hosted migration must land before the branch merges, again

**Decision**: `034`–`037` are pushed to the hosted project before this branch is merged or deployed.

**Why**: the same hard ordering as every phase since Phase 2. `push_devices` joins the realtime
channel that **every `/family` page mounts**; a deployment whose client subscribes to a table the
database does not have fails at the channel, not at the feature. The scheduler is a separate operator
step and is safe to do afterwards — until it runs, nothing is sent, which is a quiet failure rather
than a broken app.
