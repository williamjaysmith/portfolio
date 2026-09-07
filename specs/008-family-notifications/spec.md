# Feature Specification: Family Notifications

**Feature Branch**: `008-family-notifications`
**Created**: 2026-09-06
**Status**: Draft
**Input**: Phase 7 of the `/family` Skylight Calendar clone — the part the locked plan calls
`family-notifications`: the household decides what it wants to be reminded of, and any `/family` page
that is open says so when the moment comes. Events remind before they start or as they start; a chore
with a time reminds when it is due; a completed chore can tell the household who did it. Nothing
reaches a device with no page open, which is a deliberate property of this phase and is recorded as
such (Assumption 15, Divergence 1). Phases 1–6 are shipped and live, and Phase 7's browser pass
(`007-family-e2e`) walks them; this stacks on all of it.

**Authoritative sources**: `docs/research/skylight/00-master-map.md` (§1 scope — reminders,
"Explicitly requested"; §7's reminder paragraph, which already resolves the presets-versus-free-field
contradiction in favour of "presets + custom"; §9 phasing; §11 divergence ledger) and the
source-tagged dossiers beside it: `01-calendar-tab-and-events.md` §7 (the two reminder levels, the two
options, the chime, the pop-up that lists what is due), `02-tasks-and-rewards.md` (the four chore
sub-types, which of them can carry a time, late carry-forward, skip, and the absence of any star- or
reward-related notification), `04-profiles-settings-access.md` (Settings → Notifications with exactly
two groups and four toggles, the reminder sound toggle, the volume slider, Sleep Mode as the nearest
thing to quiet hours), `05-mobile-app.md` (the two shipped releases — Task Due Reminders, 2026-07-30,
and Task Completion Notifications, 2026-08-25, the second with a banner reading "Olivia dried the
dinner dishes"), `08-ux-behaviors-and-reviews.md` (owners' complaints: no spoken reminders, and the
three-way scope prompt when a reminder on a repeating event is edited). The shipped specs bind:
Phase 1 FR-018 (PINs), FR-029–FR-034 (the shell), Phase 2 FR-231–FR-238 (the repeat grammar and the
three scopes), FR-283/FR-288 (the open write rule; refuse, never queue), Phase 3 FR-301–FR-311 (the
four chore sub-types, late carry-forward, skip) and FR-386 (task search, already shipped), Phase 4's
Out of Scope (no star notifications), Phase 5 FR-537 and Phase 6 FR-642 (a write that cannot complete
is refused where the tap happened).

## Clarifications

### Session 2026-09-06

Answered by the author under the operator's standing delegation ("research Skylight first, then
answer them yourself"). The dossiers were read in full for this phase before any of these was
settled; each rests on evidence or on a recorded divergence.

- Q: Who is a reminder addressed to? → A: **The household, not a person.** Every documented reminder
  is an unaddressed pop-up on a shared display `[V](36836043247131)`, the reference has no per-person
  routing at all, and this project has one account for the household with identity only while
  somebody is punched in (Phase 1, three minutes by default). Every open screen sees the same thing.
  FR-801, FR-820, Assumption 2.
- Q: What can a single event's reminder be? → A: **One setting per event: inherit the household's,
  silence, or its own choice** of "as it starts" and/or a lead time. The reference verifies the two
  levels and the override `[V](32083277890075)`; whether several reminders can stack on one event is
  `[UNKNOWN]` in every source, so one setting it is. FR-808–FR-811, Assumption 4.
- Q: The lead time — a free 1–120 minute field `[V](36836043247131)` or presets plus a custom unit
  picker `[V](45795554249371)`? → A: **Presets plus custom**, which is what the master map already
  decided (§7, "We'll ship presets + custom"), with a ceiling of seven days. FR-806, Assumption 5.
- Q: Does the wall make a sound? → A: **Only if a device is told to.** The chime is verified
  `[V](36836043247131)` and Phase 4 recorded that this display is silent by Phase 1's choice, so the
  switch ships, per device, off. FR-815, Assumption 7, Divergence below.
- Q: Does a late chore remind again each day it carries forward? → A: **No — once, at its due time.**
  `[UNKNOWN]` in the sources; a chore that nags every morning until it is done is a defect, not a
  feature. FR-818, Assumption 9.

### Session 2026-09-07

Settled by the operator.

- Q: Must a reminder reach a device with no page of the app open? → A: **No. A reminder appears only
  where a `/family` page is open.** The household opens the app when it wants it rather than expecting
  to be chased by it, and the tablet on the kitchen wall is the shared surface everybody already
  passes. Nothing in this phase runs without a page, then: no service worker, no per-device
  subscription, nothing against the database on a schedule, and no table of its own — the banner is
  drawn by the page out of what it reads. "Shown once" is therefore a per-device convention: the
  browser remembers the reminders it has shown, with the two honest degradations named in FR-816.
  The reference does deliver task reminders to phones `[V](52390654789659)`, `[V](54930439904923)`;
  declining to follow it there is recorded as a divergence, not hidden.
  FR-829, FR-832, Assumption 15, Divergence 1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The household decides what reminds it (Priority: P1)

A parent opens Settings and finds Notifications: whether events remind as they start, whether they
remind before and by how long, whether a chore with a time reminds when it is due, and whether a
finished chore tells the household. They are the household's choices, they take effect everywhere,
and a member cannot change them.

**Why this priority**: nothing else in this phase means anything until the household has said what it
wants; and every later story reads these settings.

**Independent Test**: change each setting, reload, and see it kept; watch a member find it read-only.

**Acceptance Scenarios**:

1. **Given** Settings, **When** a parent opens Notifications, **Then** they see two groups — Calendar
   and Tasks — holding exactly four choices: **At time of event**, **Before event** with its lead
   time, **When Due**, and **When Completed**, and a plain line saying that reminders appear on the
   screens that are open.
2. **Given** the Before event choice, **When** it is opened, **Then** the lead times offered are
   10 minutes, 30 minutes, 1 hour and a custom number with a unit of minutes, hours or days, and a
   custom value beyond seven days is refused with a plain message.
3. **Given** a fresh household, **When** Notifications is first opened, **Then** Before event is on at
   10 minutes, At time of event is off, When Due is on and When Completed is off.
4. **Given** a change to any of them, **When** another device looks, **Then** it has the new setting
   within five seconds, and a reload keeps it.
5. **Given** a punched-in member, **When** they open Notifications, **Then** the settings are shown
   and cannot be changed, and the reason is said in the household's words.

---

### User Story 2 — The wall says so when the moment comes (Priority: P2)

The tablet on the kitchen wall is showing the week. Ten minutes before the swim lesson a banner
appears over the page naming what is coming and when; it can be dismissed, and it goes by itself if
nobody touches it. A device that has been asleep all morning does not wake to a pile of old banners.

**Why this priority**: the wall display is the household's shared surface, and this is the reminder
the reference actually documents — an on-screen pop-up, optionally with a chime.

**Independent Test**: with a reminder set, watch the banner arrive at the right minute on an open
page, dismiss it, and confirm an old reminder never appears.

**Acceptance Scenarios**:

1. **Given** an event at 4:30 with the household's 10-minute lead time, **When** the clock reaches
   4:20 on a device showing any `/family` page, **Then** a banner names the event and when it starts.
2. **Given** several things due in the same minute, **When** the banner appears, **Then** it names all
   of them in one banner rather than stacking one per item.
3. **Given** a banner, **When** it is dismissed, **Then** it goes and does not return for that
   reminder in that browser; **When** it is left alone, **Then** it goes by itself after a short while.
4. **Given** a device that was closed or asleep, **When** it is opened well after a reminder's moment,
   **Then** nothing is shown for it — a reminder more than fifteen minutes old is not worth showing.
5. **Given** this device's chime switch is on, **When** a banner appears, **Then** a single short
   sound plays with it; **When** the switch is off — as it is by default — **Then** nothing sounds.
6. **Given** a device that is offline, **When** a reminder's moment passes, **Then** the device shows
   nothing rather than a wrong or stale banner, and says nothing about it.
7. **Given** the Lists or Meals tab is the one showing, **When** an event's reminder is due, **Then**
   the banner appears there too, because it reads what is due for itself rather than borrowing
   whatever the visible tab happens to have loaded; **When** it is tapped, **Then** the calendar opens
   on the day the event belongs to.

---

### User Story 3 — This one event is different (Priority: P3)

Most events take the household's setting. The dentist is the one Ana wants two hours' warning for,
and the standing Tuesday call is the one she never wants to hear about. She sets both from the event
itself, and on a repeating event she is asked which occurrences she means.

**Why this priority**: the per-event override is half of the reference's documented model, and it is
what makes the household default liveable.

**Independent Test**: give one event its own reminder and another silence, change the household
default, and see that the two overridden events keep what they were given.

**Acceptance Scenarios**:

1. **Given** the event form, **When** it is opened, **Then** it offers a reminder of its own: the
   household's setting, none at all, or its own choice of as-it-starts and a lead time.
2. **Given** an event set to none, **When** its moment comes, **Then** nothing is shown for it.
3. **Given** an event with its own lead time, **When** the household's default changes, **Then** that
   event keeps its own and every event still on the household's setting follows the new one.
4. **Given** a repeating event, **When** its reminder is changed, **Then** the household is asked
   **This event** / **This and future events** / **All events** in the shipped wording, and only the
   chosen occurrences change.
5. **Given** an event's details, **When** they are read, **Then** the reminder it will give is named
   there.

---

### User Story 4 — A chore that is due, and one that is done (Priority: P4)

Cleo's piano practice is due at five. At five the household hears about it. When she ticks it off,
the household can be told that too — "Cleo finished Practice piano" — if it asked to be.

**Why this priority**: the two task notifications are separately verified releases of the reference,
and the second is the only notification anywhere in it that names a person.

**Independent Test**: with When Due on, watch a timed chore remind at its time and an untimed one
never remind; with When Completed on, tick a chore on one screen and watch another be told.

**Acceptance Scenarios**:

1. **Given** When Due is on and a chore has a time, **When** that time arrives, **Then** the household
   is told the chore is due and whose it is.
2. **Given** a chore with no time, an anytime chore, or any routine, **When** the day passes,
   **Then** nothing is shown for it — a due reminder needs a due time.
3. **Given** a chore that was not done and has carried forward as late, **When** the next day comes,
   **Then** it does not remind again; the reminder belonged to the day it was due.
4. **Given** a chore that is skipped, or completed before its time, **When** its time arrives,
   **Then** nothing is shown.
5. **Given** When Completed is on, **When** anybody ticks a task off, **Then** every other open screen
   is told who finished what, and the screen that did the ticking shows no banner — it is already
   looking at the card that flipped; **Given** it is off, **Then** nothing is shown for a completion.
6. **Given** stars are earned, a reward is redeemed, a streak is kept or a week is finished, **When**
   any of it happens, **Then** nothing is shown — the reference has no such notification and neither
   does this.

---

### Edge Cases

- **The event is all-day.** It has no clock time, so a lead time has nothing to count back from: an
  all-day event reminds at the start of its first day if the household asked to be reminded as it
  starts, and a lead time counts back from that same moment.
- **The reminder's moment is in the past when the event is created** (an event added at 4:25 for
  4:30 with a 10-minute lead). Nothing fires for the moment already gone.
- **Two devices are showing the same page.** Each shows the banner; dismissing on one does not dismiss
  on the other, because a banner is a thing on a screen, not a state in the household. Two tabs in one
  browser are two screens for this purpose, and each shows and dismisses its own.
- **The tab showing is not the calendar.** The banner belongs to the shell and reads what is due for
  itself, so a reminder arrives on Lists or Meals as readily as on the calendar, including for an
  event days out that no visible tab has loaded.
- **The household's timezone is what every moment is judged in**, not the device's — a phone with a
  page open in another timezone shows the swim lesson at the same instant the wall does.
- **The clock crosses midnight** with a page open: reminders for the new day fire on their own
  moments without a reload.
- **A reminder fires while somebody is punched in.** Nothing about a reminder needs an actor: it is a
  read, and it changes nothing.
- **A device is offline when a banner is due.** It shows nothing; when it comes back it does not
  replay what it missed.

## Requirements *(mandatory)*

### Functional Requirements

**What the household chooses**

- **FR-801**: The system MUST hold one set of reminder choices for the household, not per person: the
  reference documents an unaddressed pop-up on a shared display and no per-person routing anywhere
  `[V](36836043247131)`, and this project has one account for the household `[P1]`.
- **FR-802**: Settings MUST gain a **Notifications** section holding exactly two groups, **Calendar**
  and **Tasks** `[V](45795554249371)`, and that section MUST say plainly, in the household's own
  words, that reminders appear on the screens that are open, so nobody waits for one that will not
  come `[OURS 2026-09-07 #15]`.
- **FR-803**: The Calendar group MUST offer **At time of event** and **Before event**, each
  independently on or off, so the household may have either, both or neither `[V](45795554249371)`,
  `[V](36836043247131)`.
- **FR-804**: The Tasks group MUST offer **When Due** and **When Completed**, each independently on or
  off, and nothing else `[V](45795554249371)`.
- **FR-805**: Only a punched-in parent MUST be able to change any of them; a member MUST see them and
  be told plainly why they cannot change them `[P1]` FR-015.
- **FR-806**: The Before event lead time MUST offer **10 minutes**, **30 minutes** and **1 hour**, and
  a custom number with a unit of **minutes**, **hours** or **days** `[V](45795554249371)`, refusing
  anything over seven days with a plain message `[OURS 2026-09-06 #5]`.
- **FR-807**: A fresh household MUST start with Before event on at 10 minutes, At time of event off,
  When Due on, and When Completed off; no source documents a factory default `[UNKNOWN]`
  `[OURS 2026-09-06 #6]`.

**What one event chooses**

- **FR-808**: An event MUST be able to carry its own reminder, which MUST override the household's
  `[V](32083277890075)`, and the event form MUST offer exactly three states: the household's setting,
  **None**, or its own choice of At time of event and a lead time.
- **FR-809**: An event on the household's setting MUST follow it when it changes; an event with its
  own MUST keep its own `[OURS 2026-09-06 #4]`.
- **FR-810**: Changing a repeating event's reminder MUST ask **This event** / **This and future
  events** / **All events** in the shipped wording before anything is written, and MUST change only
  the chosen occurrences. The three-way prompt is confirmed to exist specifically in the context of
  per-event reminder edits, though as a search synthesis rather than from a screenshot `[V]`; the
  shipped wording is Phase 2's `[P2]` FR-237.
- **FR-811**: An event's details MUST name the reminder it will give `[V](36625171368987)`.

**What is shown, and when**

- **FR-812**: A reminder MUST be judged in the household's own timezone `[P2]` FR-284.
- **FR-813**: An all-day event MUST remind from the start of its first day, and a lead time MUST
  count back from that same moment `[OURS 2026-09-06 #8]`.
- **FR-814**: Everything due in the same minute MUST be shown as one banner naming each item, which is
  what the reference's pop-up does — it "lists all scheduled events/tasks" `[V](36836043247131)`.
- **FR-815**: A device MUST be able to choose, for itself, whether it shows reminder banners and
  whether it plays one short sound with them; both MUST be off for sound and on for banners by
  default, and the sound MUST be a single unselectable tone `[V](36836043247131)`,
  `[OURS 2026-09-06 #7]`. Neither switch asks the browser for permission and neither is recorded for
  the household: the banner is drawn by the page itself, so the choice belongs to the device it is
  made on.
- **FR-816**: A banner MUST be dismissible, MUST open the day it names when it is tapped — crossing to
  the calendar from whichever tab was showing — MUST go by itself if it is not dismissed, and MUST NOT
  return for the same reminder on that device. "That device" is exact: the browser is what remembers
  which reminders it has already shown, so clearing site data, a private window or a second browser
  profile can show a reminder again while it is still inside its fifteen-minute window, and two tabs
  of the app each show and dismiss their own banner. Nothing about a shown reminder is recorded for
  the household `[OURS 2026-09-07 #15]`.
- **FR-817**: A reminder whose moment passed more than fifteen minutes ago MUST NOT be shown
  `[OURS 2026-09-06 #10]`.
- **FR-818**: A **When Due** reminder MUST be shown only for a task that carries a time
  `[V](36836043247131)`, MUST be shown once for that occurrence, and MUST NOT be shown again when the
  task carries forward as late `[OURS 2026-09-06 #9]`; a routine MUST never produce one, because a
  routine has no time `[P3]` FR-303.
- **FR-819**: A **When Completed** notification MUST name who completed what, in the reference's own
  shape — its documented example is "Olivia dried the dinner dishes" `[V](54930439904923)` — and MUST
  NOT be shown for a skipped task or an un-ticking. It is derived on the open page from the completion
  itself: `family.task_resolutions` already publishes on the household's realtime channel and already
  carries the status, the moment, the occurrence date and the credited Profile, so an open page learns
  of a tick through the channel it already has `[P3]`. It MUST be counted once per resolution row
  rather than once per task and day — a routine can be completed in two slots on one day and an
  Anytime chore has no date at all `[P3]` FR-301–FR-311 — and MUST NOT be shown on the device that did
  the ticking, which is already looking at the card that flipped.
- **FR-820**: Nothing MUST be shown for stars, rewards, redemptions, streaks or a finished week. No
  fetched source documents any such notification, and whether redeeming a reward notifies a parent is
  explicitly `[UNKNOWN]`; Phase 4 excluded them and this phase keeps them excluded
  `[OURS 2026-09-06 #14]`.
- **FR-821**: Nothing MUST be shown for an event or task that has been deleted, or an occurrence that
  has been skipped or moved, between the moment being computed and its arrival: the banner reads the
  household's own rows each time it looks, so a row that is gone reminds of nothing.

**Being trustworthy**

- **FR-829**: A reminder MUST be shown only where a `/family` page is open, and there on whichever tab
  is showing. The banner reads for itself what the household has due over the reminder horizon rather
  than borrowing the visible tab's data, so an event up to seven days out still reminds while Lists or
  Meals is on screen. A device that was closed or asleep MUST show nothing for the moments it missed
  beyond fifteen minutes (FR-817) and MUST NOT replay them on waking; nothing is queued for it while
  it is closed, and nothing is owed to it `[OURS 2026-09-07 #15]`.
- **FR-832**: Nothing in this phase MUST change what a write costs elsewhere: a reminder is a read and
  a thing drawn on a screen, this phase adds no table and no write path of its own, and every existing
  write path keeps its punch-in gate and its refusal behaviour `[P2]` FR-283, FR-288.

### Key Entities

- **The household's notification settings**: four choices and a lead time, held once for the
  household, changed by a parent.
- **An event's own reminder**: absent (follow the household), silent, or a choice of its own; carried
  by the occurrence when a repeat is split, exactly as other per-occurrence changes are `[P2]`.
- **The reminders a device has shown**: a set of reminder keys the browser keeps for itself, which is
  what makes a banner appear once on that screen. It is a convention, not a record: nothing about it
  reaches the household's data, and it goes when the browser's storage goes (FR-816).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-801**: On a fresh household, Notifications shows exactly four choices in two groups, with the
  documented labels, the stated defaults, and the line saying where reminders appear.
- **SC-802**: A reminder set for an event arrives on an open page **within one minute** of its moment
  and never earlier than it, whichever tab is showing.
- **SC-803**: Everything due in one minute arrives as **one** banner naming each item, not several.
- **SC-804**: A reminder appears **once** on a screen: it shows, it is dismissed or times out, and it
  does not come back in that browser while it is still current — proved by reloading the page at the
  same minute. The honest limits are stated with it: another browser, another profile, a private
  window or freshly cleared site data can show it again inside its fifteen-minute window, and two tabs
  each show their own.
- **SC-805**: No reminder is shown for a moment more than fifteen minutes past, proved by opening a
  page well after a reminder's moment and seeing nothing.
- **SC-806**: An event with its own reminder keeps it when the household's default changes, and an
  event on the household's setting follows the change, both proved after a reload.
- **SC-807**: A repeating event's reminder changed at each of the three scopes leaves exactly the
  occurrences that scope should leave, checked across at least two weeks.
- **SC-808**: A timed chore reminds at its time; an all-day chore, an anytime chore and every routine
  remind never; and a late chore reminds once in total, not once a day.
- **SC-809**: With When Completed on, ticking a task on one screen tells another open screen who
  finished what within a minute, and shows nothing on the screen that ticked it; with it off, nothing
  is shown anywhere.
- **SC-810**: Nothing at all is shown for stars, rewards, redemptions, streaks or a finished week.
- **SC-813**: A deleted event, a skipped occurrence and a moved event each show nothing at their old
  moment.
- **SC-814**: Every reminder decision — which moments a rule produces, which are due now, which are
  too old, which this device has already shown — is unit-tested as pure logic, including across a
  daylight saving change and midnight in the household's zone.
- **SC-815**: An anonymous reader of the new settings and event columns gets a refusal, not an empty
  result, and a reader from another household sees zero rows on every path.
- **SC-816**: After this phase, every shipped tab still behaves as its own phase's criteria require,
  and the browser pass (`007-family-e2e`) still runs green.

## Assumptions

Decisions taken on **2026-09-06** under the operator's delegation, wherever the research was
inferred, unknown, contradictory, or had no equivalent in the reference; number 15 is the operator's
own, taken on **2026-09-07**.

The numbering has gaps — 3, 11, 12 and 13 went with Web Push — and the numbers are load-bearing,
because `[OURS 2026-09-06 #n]` citations throughout the requirements point at them. They are written
into the text rather than left to an ordered list, which a renderer would silently renumber.

- **1. This phase is notifications only; the home screen, search and the offline cache become Phase 8.**
  The locked plan's `family-notifications` bundles six things; the Phase 5/6 split set the precedent
  that each half must be reviewable and deployable alone. Reminders, task notifications and the
  settings that drive them are one mechanism with one settings section; a home screen, a cross-tab
  search and a read-only cache share nothing with them or with each other. `[OURS]`
- **2. A reminder is addressed to the household, never to a Profile.** Every documented reminder is an
  unaddressed pop-up `[V](36836043247131)`; the reference has no per-person routing; and this project
  knows who somebody is only while they are punched in, which lasts three minutes by default `[P1]`.
  A banner names what the household asked to be reminded of, whoever happens to be in front of it.
  `[OURS]`
- **4. One reminder setting per event, in three states: inherit, none, or its own.** The two levels and
  the override are verified `[V](32083277890075)`; whether several reminders can stack on one event
  is `[UNKNOWN]` everywhere, and a child table for an undocumented capability is speculation. "None"
  exists so that "deliberately silent" is expressible, which the sources never address. `[OURS]`
- **5. Presets plus custom, capped at seven days.** The two renderings — a free 1–120 minute field
  `[V](36836043247131)` and presets plus a unit picker `[V](45795554249371)` — are contradictory and
  the dossier declines to reconcile them; the master map already chose "presets + custom" (§7). The
  cap is ours: beyond a week, a reminder is a different feature. `[OURS]`
- **6. The defaults are Before event on at 10 minutes, At time of event off, When Due on, When
  Completed off.** No source documents a factory default for any of the four `[UNKNOWN]`. A household that
  installs this should be reminded of its events without being asked to configure anything, and
  should not have every completed chore announced. `[OURS]`
- **7. The chime is a per-device switch, off by default.** The chime is verified `[V](36836043247131)`
  and Phase 4 recorded that this display is silent by Phase 1's choice; shipping the switch honours
  the reference, and defaulting it off honours the shipped decision. Volume is the device's own, as
  it is in the reference `[V](36835387462555)`. `[OURS]`
- **8. An all-day event reminds from the start of its day.** The reference never says `[UNKNOWN]`; the
  alternative is that all-day events cannot remind at all, which is worse. `[OURS]`
- **9. A late chore reminds once.** `[UNKNOWN]` in the sources; a daily nag until a chore is done is a
  defect. The reminder belongs to the occurrence's own due time. `[OURS]`
- **10. Anything more than fifteen minutes past is dropped.** The reference says nothing about a device
    that was asleep `[UNKNOWN]`; a wall tablet waking to a morning's worth of banners is a failure.
    `[OURS]`
- **14. Nothing is shown about the star economy.** No fetched source documents a star, streak or
    reward-week notification, and whether a redemption notifies a parent is explicitly `[UNKNOWN]` —
    the dossier calls it "plausible given the activity framing" and stops there, so it is not a fact
    to match. Phase 4 shipped the economy silent and this phase leaves it silent. `[OURS]`
- **15. A reminder appears only on a screen that is open, and the household is told so.** The reference
    delivers task reminders and completions to phones `[V](52390654789659)`, `[V](54930439904923)`;
    this household will open the app when it wants it rather than expect to be chased by it, and the
    wall display is the shared surface everybody already passes. Choosing the banner alone means no
    service worker of its own, no subscription per device, nothing running against the hosted
    database on a schedule and no secret shared with it — none of which earn their keep for one
    household — and leaves a phase that adds no table at all. Settings says the property in plain words (FR-802) so
    that nobody is waiting for a reminder that is never coming. `[OURS]`

## Divergences from the reference, and why

| # | Divergence | Why |
|---|---|---|
| 1 | **Reminders appear only where a page is open** | The reference sends task reminders and completions to phones `[V](52390654789659)`, `[V](54930439904923)`; this project deliberately does not — the household opens the app when it wants it and the wall display is the shared surface (Assumption 15) |
| 2 | **The chime ships off** | Phase 1 chose a silent display; the switch exists so a household can choose otherwise |
| 3 | **No spoken reminders** | Owners ask for them `[V]`; out of scope here, as all voice is project-wide |
| 4 | **Nothing is shown about stars** | Matches the reference, which has no such notification, and Phase 4's exclusion — recorded because a star economy that never speaks is a choice |

## Dependencies

- Phases 1–6, shipped and live: the shell, punch-in, the events and their recurrence, the tasks and
  their four sub-types, the household settings, the realtime channel.
- `family.task_resolutions` on that realtime channel, already publishing status, the moment, the
  occurrence date and the credited Profile — which is how a completion reaches another open page
  without anything new being written.
- The household's timezone and week start, already stored and already the basis of every date.
- The browser pass (`007-family-e2e`), which must stay green and gains journeys for this phase.

## Out of Scope

Deferred to **Phase 8** (`009-family-home-search-offline`): the Home screen and its Calendar, Tasks
and Lists panes `[V](49738702477723)`; search across the tabs (the Tasks board's search shipped in
Phase 3 and the recipes pane's in Phase 6); the read-only offline cache; Tasks Progress on the
calendar `[V](36625171368987)` and countdowns with their preview bar `[V](40459070511515)`, both
withheld by Phase 2.

Excluded from this project: any notification to a device with no `/family` page open — the reference
sends them `[V](52390654789659)`, this project does not, and Assumption 15 says why; spoken or voice
reminders `[V]`; reminders to an email address, and the event's "Invited Emails" field
`[V](44738510847259)`, since this app sends no mail; the mail-in event address `[V](39335538450587)`;
Sleep Mode as a scheduled screen-off `[V](37235485034779)` and any quiet-hours rule built on it —
whether Sleep Mode suppresses the reference's own reminders is `[UNKNOWN]`, so there is nothing here
to match; a selectable reminder tone `[V]` — the reference has exactly one; a volume control in the
app, which belongs to the device `[V](36835387462555)`; per-Profile or per-person routing of any
notification; any notification about photos, senders or account activity `[V](360053148432)`; and the
notification bell's activity feed.
