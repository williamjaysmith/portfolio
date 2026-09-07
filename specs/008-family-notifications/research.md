# Research — 008 Family Notifications

Decisions taken before any code, each with what it rests on and what was rejected. Numbered `R8nn`
and cited from the plan, the data model and the tasks. Read `spec.md` first: this answers *how*, the
spec answers *what*.

Two things were checked against the repository rather than assumed, and both changed the design: the
app already has a shared minute-resolution clock (`useNow`), which is what drives the banner rather
than a timer of its own (R813); and `/family` has **no URL parameters at all** — every screen is
client-state-driven, which is why a banner cannot yet open the day it names, and why R815 exists.

---

## R801 — This phase is notifications; home, search and offline are the next one

**Decision**: `008-family-notifications` ships reminders, task notifications and the on-screen banner.
The Home screen, cross-tab search and the offline cache become `009`.

**Why**: the locked plan bundles six things under "Phase 7". Reminders and task notifications are one
mechanism — one due-computation, one settings section, one banner. A home screen is a new landing
surface, a search is a query layer, and an offline cache is a fetch strategy; none of the three shares
anything with the other two or with this one. Phases 5 and 6 set the precedent that a phase must be
reviewable and deployable alone.

**Rejected**: shipping all six. The branch would carry unrelated migrations and a Settings section
nobody could review against one spec. The dossiers document **nothing at all** about offline
behaviour — the reference is in fact criticised for requiring constant connectivity — so that phase is
ours to invent and should not delay this one.

---

## R802 — One pure due-computation, and the banner brings its own data

**Decision**: a single pure module answers *"given the household's settings, its events and tasks, and
an instant, which reminders are due?"* It has exactly one reader: the banner in the app shell. The
banner does **not** read whichever screen happens to be mounted; it owns a **small dedicated query of
its own** — the household's events and its timed chore occurrences over the reminder horizon —
independent of the tab that is showing.

**Why the banner needs its own query, and cannot borrow a tab's**: the banner mounts in the shell,
because a reminder must appear on any `/family` page. On the Lists or Meals tab the calendar's data is
**not loaded at all**, so a reader that borrowed the visible screen's cache would be correct on the
calendar and silent on the shopping list — which is most of the time the wall display is being used.
And the lead time reaches seven days (FR-806): even on the calendar tab, a reminder can be owed for an
event outside any window the screen has fetched. There is still one due-computation with one reader;
what its reader gets its data from is a query of its own.

**The horizon**: `[now − 15 minutes, now + the longest lead time that can be owed]` in the household's
own zone (FR-812). The upper bound is the household's lead time, widened to FR-806's seven-day ceiling
when an event may carry a longer one of its own (FR-808) — the query cannot know an event's custom
lead time without first having fetched the event, so the bound is the cap, not a guess. A week is the
same order of read the calendar tab already makes. The look-back is FR-817's fifteen minutes, which is
also FR-829's answer to a page that was closed or asleep: what is still current is shown, what is long
past is dropped, so a wall display that wakes up does not replay the morning. The bounds move only
when a setting changes or the day rolls, so the query re-fetches at that granularity while `useNow`
re-judges every minute — the clock drives the decision, not the network.

**What this costs and buys**: one bounded read per device, whose key sits under `familyKeys.all` like
every other, so the shell's existing realtime sweep keeps it current for free (R817). It may hold a
few rows the calendar tab also holds; that duplication is a handful of cached rows, and the
alternative is a banner that is right on one tab and wrong on four.

**Consequences that fall out of it**, and that shape everything below:

- The banner needs **no** route, **no** server record and **no** new table. Its "don't show this
  twice" (FR-816) is per-device local state (R807), which is exactly what the spec's edge case demands
  ("dismissing on one does not dismiss on the other").
- A reminder exists only where a page is open. Nothing is queued for a device with every tab closed,
  and nothing is owed to it when it comes back beyond what is still inside the look-back. That is a
  deliberate property of this design, recorded as Assumption 15, not an omission.
- The computation is pure, so every lead time, the household zone, a DST boundary and midnight are
  unit-testable at a pinned instant (SC-814).

**Rejected**: the server telling the browser what to show, over realtime or a poll. It adds a channel,
a table and a latency budget to reproduce something the browser can already compute, and it would put
the wall display's most visible feature behind the network.

---

## R807 — "Shown once" is a set of keys in the device's own storage, and its limits are stated

**Decision**: each device keeps a Set of reminder keys (R808) in its own storage, through Phase 1's
`readDeviceJson`/`writeDeviceJson` (R813). A key in the set is not drawn again. Keys that have fallen
out of the look-back are pruned on write, so the set stays small and cannot grow without bound.

**Why per device**: FR-816 says a banner must not return for the same reminder **on that device**, and
the spec's edge case says dismissing on one screen does not dismiss on the other. Per-device local
state is the literal shape of that requirement. There is no household-level fact here to record: two
screens are *meant* to show the same reminder, each on its own terms.

**What this does not promise, said plainly.** Two degradations follow from the store being the
device's rather than the household's, and both are accepted:

- **Clearing site data, a private window, or a second browser profile starts with an empty set**, so a
  reminder still inside its fifteen-minute window can be shown again there. The set is a convenience
  belonging to one browser profile, not a record of what the household has seen.
- **Two tabs of the app on one device each show their own banner.** Both mount the banner, both judge
  the same minute, and both draw it; the set stops a *re-show*, not a simultaneous second show, and
  dismissing in one tab does not dismiss in the other.

Neither is worth a table to fix. A duplicate banner on a second profile is a mild annoyance; the
machinery that would remove it is a write on a read path, a policy and a retention rule.

**Rejected**: `sessionStorage` (per tab, so every reload would replay every current reminder), and a
`sent` boolean on the event or task (wrong cardinality — a repeating event has many occurrences and
one row).

---

## R808 — A reminder's identity is the occurrence plus the instant it fires; a completion's is its own row

**Decision**: an event or due-chore reminder is keyed by
`subject_kind:subject_id:occurrence_date:fire_at`. A completion is keyed by the resolution row's own
identity.

**Why `occurrence_date`**: it is Phase 2's occurrence grammar, already the key for exceptions and
already proof against a series-level time change and DST drift. Keying a reminder for the third
Tuesday the same way the third Tuesday's skip is keyed means one grammar, not two.

**Why `fire_at` as well**: it makes "the event moved, so the new time is what reminds" (FR-821, and the
spec's moved-event criterion) fall out for free. The old instant's key stays in the set and is gone
with it; the new instant is a different key, judged on its merits — and if the new instant is more than
fifteen minutes past, R802's look-back drops it. `fire_at` is derived deterministically from stored
data, never from the current time, so a jittery clock cannot manufacture a second key.

**Why a completion is keyed differently — it has no instant to include.** A completion is not
scheduled; it happens when somebody ticks, so there is nothing for `fire_at` to be derived from, and
the moment it arrives is the moment it is shown. `(task, occurrence_date)` is the wrong key twice
over: a routine can be completed in **two slots on one day** (Phase 3's `occurrence_slot`), and an
**Anytime chore has no date at all** — `family.task_resolutions.occurrence_date` is null on it.
The resolution row already carries its own identity, one row per resolved occurrence, which is exactly
what "this completion" means: an un-tick deletes the row, and a re-tick writes a new one, which is
correctly a new thing to announce (R811).

**Retention**: none, beyond the pruning above. Nothing reads these keys but the device that wrote
them, and a key outside the look-back can never suppress anything again.

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

## R811 — A completion is derived on the open page from the row the tick already writes

**Decision**: nothing is written to announce a completion. Ticking a task inserts a
`family.task_resolutions` row, exactly as Phase 3 already does; that table is already on the guarded
realtime publication (`022_realtime_tasks.sql`), so every open page is already told. The banner's own
query (R802) reads the household's recent resolutions, keeps those whose status is `complete` and
whose `resolved_at` is inside the look-back, and names who finished what from the credited Profile —
the reference's own shape, "Olivia dried the dinner dishes" (FR-819).

**Why nothing new is written**: the completion **is** the record. A second row saying "this happened"
would need a table, a policy, a trigger, a sender and a retention rule to hold a fact the first row
already holds — and the two could disagree, which is the failure nobody would think to look for.

**The realtime payload is a signal, not the message.** `useFamilyRealtime` deliberately never renders
a payload, because Realtime does not apply the same column privileges as a normal read. So the channel
invalidates and the banner reads the row back under RLS, like every other screen in this app. That is
also why SC-809's "within a minute" is comfortable: the round trip is an invalidate and a windowed
read, not a schedule.

**Suppressed on the device that did the ticking.** The person who just tapped the card is watching it
flip; a banner telling them what they have just done is noise. The acting device records that
resolution's key in the same dismissed set (R807) as it writes, so the row arrives already seen. Every
other open page shows it, which is the whole point of the feature.

**Skips and un-ticks are excluded, and it costs nothing.** FR-819 excludes both. A skip writes
`status = 'skipped'` and the filter drops it; an un-tick **deletes** the row, so there is nothing left
to announce and a page that opens afterwards learns nothing about it. A banner already on screen when
the un-tick lands is left to expire: it is a report of a moment, not a record, and yanking it away
would be a stranger thing to watch than letting it go.

**Rejected**: writing a notification row in the same transaction as the tick and sending it from
`after()`. That design exists to reach somewhere the channel cannot; with the banner as the surface,
the row, the sender and its retention are machinery for a fact the channel already delivers. Also
rejected: deriving the wording in SQL, which would move the message and the settings check away from
the tests.

---

## R812 — "When Due" is `routine = false and due_time is not null`

**Decision**: a due reminder is generated for a chore occurrence whose task has a `due_time`, and for
nothing else.

**Why**: `family.tasks.due_time` is already a wall clock in the household zone, null on an anytime
chore, and routines carry `times_of_day` slots instead. The reference's own wording is "will only
appear for those chores that are due at a specific time". The column and the sentence agree, so the
predicate is one line and needs no new data.

**Late chores** (FR-818): the reminder belongs to the occurrence's own due date. A carried-forward
chore is still that occurrence, whose `fire_at` is in the past, so R802's look-back drops it and its
key is in the device's set anyway. The "remind once, not once a day" behaviour is not special-cased
anywhere — it is what the identity in R808 already means.

---

## R813 — The banner reuses the shell's clock, the device switches and the device storage

**Decision**: `useNow()` from `Clock.tsx` drives the banner. The banner and chime switches are a
`createDeviceSwitches` store. The dismissed set is `readDeviceJson`/`writeDeviceJson`.

**Why**: all three exist, are tested, and are exactly the right shape. `useNow` already publishes only
when the minute changes and already rolls over midnight without a reload, which is one of the spec's
edge cases answered by a component that shipped in Phase 1. `createDeviceSwitches` is documented as
the shape for per-device booleans and is already used by two tabs. Writing a second clock or a second
storage discipline would add duplication the gate would rightly reject.

**Neither switch asks the browser for anything.** A banner the app draws inside its own page needs no
permission, so FR-815's two switches are per-device preferences and nothing else — no prompt to
explain, no refused state to reflect, and no control that can appear on while the browser has said no.

**The chime**: one short tone, played from a `public/family/` asset on a user-initiated switch's
device. Autoplay policy is not a problem here because the switch is itself a user gesture and the
audio element is primed by it — but a device that refuses is not an error, it is a silent banner.

---

## R815 — Opening the right day needs a date in the URL, which `/family` does not have yet

**Finding**: there is not one `useSearchParams` or `searchParams` in the whole of `app/family/**`. Every
screen is client-state-driven and today-anchored.

**Decision**: add one optional parameter, `?on=YYYY-MM-DD`, read once on mount to seed the calendar's
anchor and then left alone. An absent or unparseable value means today, exactly as now.

**Why it is needed**: the banner mounts in the shell, so it appears while the Lists or Meals tab is
showing, and acting on it must land on **the day the event or chore belongs to** — not on today's
calendar. The anchor is state inside the calendar screen (`useWeekAnchor`), which does not exist while
Lists is mounted, so crossing from a banner into the calendar is a route change, and the only thing a
route change carries is the URL. A banner that names Thursday's swim lesson and can only open today is
a dead end.

**Why read once**: the calendar's anchor is client state that the user moves by paging. A parameter
that kept overriding it would fight the pager. Seeding is the whole requirement.

**Scope discipline**: this is a genuine addition beyond "notifications", and it is here because a
banner's tap target cannot be met without it. It is one parameter on one screen, it changes nothing
when absent, and it is listed in the plan as such rather than smuggled in.

---

## R816 — What can be tested, and what honestly cannot

**Fully unit-testable, and where the coverage the gate needs comes from**: the due-computation (every
lead time, all-day events, the household zone, a DST boundary, midnight), the horizon and look-back
arithmetic, the settings-to-reminder resolution including the three-state override, the task
predicate, the completion filter and the name it credits, the message wording, and the dismissed set
— its identity rules, its pruning, and what an empty one does.

**Testable in a browser** (`007-family-e2e` gains journeys): the Settings section and its defaults, a
member finding it read-only, the per-event override and its three scopes, the banner appearing at a
pinned clock **on the calendar tab and on the Lists tab** — the second is the one that would catch a
banner wired to the visible screen's data (R802) — dismissal, the chime switch, and tapping a banner
landing on the right day. The completion path is the suite's existing two-browser journey: one browser
ticks a chore, the other raises a banner naming who did it, and the browser that ticked does not.

**Not testable here, and said so plainly**: nothing in this phase claims anything about a device with
no page open, so there is nothing about one to test — that property is Assumption 15, not a gap in the
suite. The one manual item is the two-device realtime check that has been pending since Phase 5, on
hardware rather than two contexts of one browser; the quickstart gives the steps.

---

## R817 — The realtime channel gains nothing, because this phase adds no tables

**Decision**: no `alter publication`. The guarded publication keeps exactly the tables Phases 1–6 put
on it.

**Why it still needs saying**: all three of this phase's moving parts ride a subscription that already
exists, and the design depends on it. `household_settings` is published and filtered by household, so
a parent changing the lead time on the phone re-judges the wall's banner without a reload. `events`
and `event_exceptions` are published unfiltered — a DELETE payload carries a primary key and never a
`household_id` — so a per-event reminder, a moved occurrence and a deleted event all reach every open
page, which is what makes FR-821 a consequence of the existing sweep rather than new code.
`task_resolutions` is published, which is the whole of R811.

**Why nothing joins it**: there is no new table to add. The phase's storage is eleven columns on three
tables that are already published (R809, R810), and what a device has already shown is kept in that
device's own storage (R807), where no channel can or should reach it.

---

## R818 — The hosted migration must land before the branch merges, again

**Decision**: `034` and `035` are pushed to the hosted project before this branch is merged or
deployed.

**Why**: the same hard ordering as every phase since Phase 2, though this phase's failure is narrower
than most. `SETTINGS_COLUMNS` and `EVENT_COLUMNS` in `lib/family/rows.ts` name every column
explicitly rather than selecting `*`, so a deployment whose client asks for `notify_event_before`
against a database that has not got the column gets an error, not a null. That is the settings read
and the calendar's event reads — Settings and the calendar, in every window — failing, while the
shell, the channel and the other tabs stay up. It is a smaller blast radius than a phase that put a
new table on the channel every page mounts, and it is still half the app, so the ordering stands.
