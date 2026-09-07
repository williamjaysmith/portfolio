# Feature Specification: Family Notifications

**Feature Branch**: `008-family-notifications`
**Created**: 2026-09-06
**Status**: Draft
**Input**: Phase 7 of the `/family` Skylight Calendar clone — the part the locked plan calls
`family-notifications`: the household decides what it wants to be reminded of, the wall display says
so when the moment comes, and a phone that is nowhere near the wall hears about it too. Events remind
before they start or as they start; a chore with a time reminds when it is due; a completed chore can
tell the household who did it. Phases 1–6 are shipped and live, and Phase 7's browser pass
(`007-family-e2e`) walks them; this stacks on all of it.

**Authoritative sources**: `docs/research/skylight/00-master-map.md` (§1 scope — "Reminders — on-tablet
banner + Web Push to phones · Explicitly requested"; §7's reminder paragraph, which already resolves
the presets-versus-free-field contradiction in favour of "presets + custom"; §9 phasing; §11
divergence ledger) and the source-tagged dossiers beside it: `01-calendar-tab-and-events.md` §7 (the
two reminder levels, the two options, the chime, the pop-up that lists what is due),
`02-tasks-and-rewards.md` (the four chore sub-types, which of them can carry a time, late
carry-forward, skip, and the absence of any star- or reward-related notification),
`04-profiles-settings-access.md` (Settings → Notifications with exactly two groups and four toggles,
the reminder sound toggle, the volume slider, Sleep Mode as the nearest thing to quiet hours),
`05-mobile-app.md` (the two shipped releases — Task Due Reminders, 2026-07-30, and Task Completion
Notifications, 2026-08-25, the second with a real push banner reading "Olivia dried the dinner
dishes"), `08-ux-behaviors-and-reviews.md` (owners' complaints: no spoken reminders, and the
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
  somebody is punched in (Phase 1, three minutes by default). A phone receives what the wall receives.
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
   time, **When Due**, and **When Completed**.
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
   reminder on that device; **When** it is left alone, **Then** it goes by itself after a short while.
4. **Given** a device that was closed or asleep, **When** it is opened well after a reminder's moment,
   **Then** nothing is shown for it — a reminder more than fifteen minutes old is not worth showing.
5. **Given** this device's chime switch is on, **When** a banner appears, **Then** a single short
   sound plays with it; **When** the switch is off — as it is by default — **Then** nothing sounds.
6. **Given** a device that is offline, **When** a reminder's moment passes, **Then** the device shows
   nothing rather than a wrong or stale banner, and says nothing about it.

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
never remind; with When Completed on, tick a chore and watch the household be told.

**Acceptance Scenarios**:

1. **Given** When Due is on and a chore has a time, **When** that time arrives, **Then** the household
   is told the chore is due and whose it is.
2. **Given** a chore with no time, an anytime chore, or any routine, **When** the day passes,
   **Then** nothing is sent for it — a due reminder needs a due time.
3. **Given** a chore that was not done and has carried forward as late, **When** the next day comes,
   **Then** it does not remind again; the reminder belonged to the day it was due.
4. **Given** a chore that is skipped, or completed before its time, **When** its time arrives,
   **Then** nothing is sent.
5. **Given** When Completed is on, **When** anybody ticks a task off, **Then** the household is told
   who finished what; **Given** it is off, **Then** nothing is sent for a completion.
6. **Given** stars are earned, a reward is redeemed, a streak is kept or a week is finished, **When**
   any of it happens, **Then** nothing is sent — the reference has no such notification and neither
   does this.

---

### User Story 5 — The phone in a pocket, nowhere near the wall (Priority: P5)

Ben is at work. His phone has been signed in to the household and asked to receive reminders. When
the swim lesson is ten minutes away his phone shows it, with no browser open; tapping it opens the
day it belongs to.

**Why this priority**: it is the half of the operator's request that the wall cannot do, and the
reference shipped exactly this for tasks in mid-2026.

**Independent Test**: turn the switch on for a device, close every tab, and confirm a reminder still
arrives and opens the right page.

**Acceptance Scenarios**:

1. **Given** a signed-in device, **When** somebody turns on **Send reminders to this device**,
   **Then** the browser asks that device's own permission, and the switch reflects what was answered.
2. **Given** permission was refused or is blocked, **When** the switch is looked at, **Then** it says
   so plainly and does not pretend to be on.
3. **Given** a device that has been turned on, **When** a reminder's moment arrives and no page of
   this app is open, **Then** the device shows it anyway.
4. **Given** such a notification, **When** it is tapped, **Then** the app opens at the day the event
   or task belongs to.
5. **Given** the switch is turned off, or the device signs out, **Then** that device is sent nothing
   more.
6. **Given** two devices have been turned on, **When** one reminder fires, **Then** each device shows
   it once and neither shows it twice.

---

### User Story 6 — Once, in time, and only if it is still true (Priority: P6)

The engine is trusted only if it never says a thing twice, never says it for something that has been
deleted, and never floods the house after a quiet night.

**Why this priority**: an unreliable reminder is worse than none, and everything above depends on it.

**Independent Test**: run the same moment twice, delete the event a reminder was for, and let the
scan miss its window; nothing is sent twice, for a ghost, or long after the fact.

**Acceptance Scenarios**:

1. **Given** a reminder that has already been sent, **When** the same moment is considered again,
   **Then** nothing is sent a second time on any device.
2. **Given** an event or task that is deleted, or an occurrence that is skipped, after its reminder
   was scheduled but before it fires, **Then** nothing is sent.
3. **Given** an event moved to another time, **When** its old moment arrives, **Then** nothing is
   sent; the new time is what reminds.
4. **Given** nothing has run for an hour, **When** the engine next runs, **Then** it sends what is
   due now and drops what is long past rather than sending a pile at once.
5. **Given** the household changes a reminder setting, **When** the next moment comes, **Then** the
   change is already in force.

---

### Edge Cases

- **The event is all-day.** It has no clock time, so a lead time has nothing to count back from: an
  all-day event reminds at the start of its first day if the household asked to be reminded as it
  starts, and a lead time counts back from that same moment.
- **The reminder's moment is in the past when the event is created** (an event added at 4:25 for
  4:30 with a 10-minute lead). Nothing fires for the moment already gone.
- **Two devices are showing the same page.** Each shows the banner; dismissing on one does not dismiss
  on the other, because a banner is a thing on a screen, not a state in the household.
- **The household's timezone is what every moment is judged in**, not the device's — a phone in
  another timezone hears about the swim lesson at the same instant the wall does.
- **The clock crosses midnight** with a page open: reminders for the new day fire on their own
  moments without a reload.
- **A reminder fires while somebody is punched in.** Nothing about a reminder needs an actor: it is a
  read, and it changes nothing.
- **Push permission is granted, then revoked in the browser's own settings.** The next send finds the
  subscription dead and quietly forgets that device rather than failing every future run.
- **A device is offline when a banner is due.** It shows nothing; when it comes back it does not
  replay what it missed.

## Requirements *(mandatory)*

### Functional Requirements

**What the household chooses**

- **FR-801**: The system MUST hold one set of reminder choices for the household, not per person: the
  reference documents an unaddressed pop-up on a shared display and no per-person routing anywhere
  `[V](36836043247131)`, and this project has one account for the household `[P1]`.
- **FR-802**: Settings MUST gain a **Notifications** section holding exactly two groups, **Calendar**
  and **Tasks** `[V](45795554249371)`.
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

**What is sent, and when**

- **FR-812**: A reminder MUST be judged in the household's own timezone `[P2]` FR-284.
- **FR-813**: An all-day event MUST remind from the start of its first day, and a lead time MUST
  count back from that same moment `[OURS 2026-09-06 #8]`.
- **FR-814**: Everything due in the same minute MUST be delivered as one reminder naming each item,
  which is what the reference's pop-up does — it "lists all scheduled events/tasks"
  `[V](36836043247131)`.
- **FR-815**: A device MUST be able to choose, for itself, whether it shows reminder banners and
  whether it plays one short sound with them; both MUST be off for sound and on for banners by
  default, and the sound MUST be a single unselectable tone `[V](36836043247131)`,
  `[OURS 2026-09-06 #7]`.
- **FR-816**: A banner MUST be dismissible, MUST go by itself if it is not dismissed, and MUST NOT
  return for the same reminder on that device.
- **FR-817**: A reminder whose moment passed more than fifteen minutes ago MUST NOT be shown or sent
  `[OURS 2026-09-06 #10]`.
- **FR-818**: A **When Due** reminder MUST be sent only for a task that carries a time
  `[V](36836043247131)`, MUST be sent once for that occurrence, and MUST NOT be sent again when the
  task carries forward as late `[OURS 2026-09-06 #9]`; a routine MUST never send one, because a
  routine has no time `[P3]` FR-303.
- **FR-819**: A **When Completed** notification MUST name who completed what, in the reference's own
  shape — its documented example is "Olivia dried the dinner dishes"
  `[V](54930439904923)` — and MUST NOT be sent for a skipped task or an un-ticking.
- **FR-820**: Nothing MUST be sent for stars, rewards, redemptions, streaks or a finished week. No
  fetched source documents any such notification, and whether redeeming a reward notifies a parent is
  explicitly `[UNKNOWN]`; Phase 4 excluded them and this phase keeps them excluded
  `[OURS 2026-09-06 #14]`.
- **FR-821**: Nothing MUST be sent for an event or task that has been deleted, or an occurrence that
  has been skipped or moved, between the moment being scheduled and its arrival.

**Reaching a device that is not looking**

- **FR-822**: A signed-in device MUST be able to ask to receive reminders when no page of this app is
  open, and MUST be able to stop. The reference delivers exactly this pair — "a push notification on
  phones or a pop-up dialog on the Calendar device" `[V](52390654789659)`.
- **FR-823**: Turning it on MUST ask that device's own permission, and the control MUST show what was
  actually answered — never "on" when the browser refused.
- **FR-824**: A device that has been turned on MUST receive each reminder exactly once, and two such
  devices MUST each receive it once `[OURS 2026-09-06 #11]`.
- **FR-825**: Acting on such a notification MUST open the app at the day the event or task belongs to.
- **FR-826**: A device that signs out, turns the switch off, or whose permission is withdrawn MUST
  stop receiving, and the household MUST forget it without any other device being affected.
- **FR-827**: The household MUST be able to see which devices are receiving reminders and remove any
  of them `[OURS 2026-09-06 #12]`.

**Being trustworthy**

- **FR-828**: The same reminder MUST NOT be delivered twice, however often the engine runs
  `[OURS 2026-09-06 #13]`.
- **FR-829**: A gap in the engine's running MUST NOT produce a flood: what is still current is sent,
  what is long past is dropped (FR-817).
- **FR-830**: The engine MUST NOT depend on any browser being open.
- **FR-831**: A failure to reach one device MUST NOT stop another device being reached, and MUST NOT
  cause the same reminder to be retried into a duplicate.
- **FR-832**: Nothing in this phase MUST change what a write costs elsewhere: reminders are reads and
  sends, and every existing write path keeps its punch-in gate and its refusal behaviour `[P2]`
  FR-283, FR-288.

### Key Entities

- **The household's notification settings**: four choices and a lead time, held once for the
  household, changed by a parent.
- **An event's own reminder**: absent (follow the household), silent, or a choice of its own; carried
  by the occurrence when a repeat is split, exactly as other per-occurrence changes are `[P2]`.
- **A device that receives**: one signed-in browser that has asked for reminders, with a name a person
  recognises and no tie to any Profile.
- **A delivery**: the record that a particular reminder for a particular moment has gone, which is
  what makes "exactly once" true.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-801**: On a fresh household, Notifications shows exactly four choices in two groups, with the
  documented labels, and the stated defaults.
- **SC-802**: A reminder set for an event arrives on an open page **within one minute** of its moment,
  and never earlier than it.
- **SC-803**: Everything due in one minute arrives as **one** banner naming each item, not several.
- **SC-804**: A reminder is delivered **exactly once** per device, proved by running the engine's
  moment twice and seeing one delivery.
- **SC-805**: No reminder is shown or sent for a moment more than fifteen minutes past, proved by
  stopping the engine for an hour and starting it again.
- **SC-806**: An event with its own reminder keeps it when the household's default changes, and an
  event on the household's setting follows the change, both proved after a reload.
- **SC-807**: A repeating event's reminder changed at each of the three scopes leaves exactly the
  occurrences that scope should leave, checked across at least two weeks.
- **SC-808**: A timed chore reminds at its time; an all-day chore, an anytime chore and every routine
  remind never; and a late chore reminds once in total, not once a day.
- **SC-809**: With When Completed on, ticking a task tells the household who finished what within a
  minute; with it off, nothing is sent.
- **SC-810**: Nothing at all is sent for stars, rewards, redemptions, streaks or a finished week.
- **SC-811**: A device with reminders turned on receives one **while every tab of the app is closed**,
  and acting on it opens the day it belongs to.
- **SC-812**: Turning the switch off, signing out, or withdrawing permission stops that device
  receiving within one further reminder, and no other device is affected.
- **SC-813**: A deleted event, a skipped occurrence and a moved event each send nothing at their old
  moment.
- **SC-814**: Every reminder decision — which moments a rule produces, which are due now, which are
  too old, which are already delivered — is unit-tested as pure logic, including across a daylight
  saving change and midnight in the household's zone.
- **SC-815**: An anonymous reader of the new data gets a refusal, not an empty result; a reader from
  another household sees zero rows on every path; and no device's subscription is readable by
  anything but the household that owns it.
- **SC-816**: After this phase, every shipped tab still behaves as its own phase's criteria require,
  and the browser pass (`007-family-e2e`) still runs green.

## Assumptions

Decisions taken on **2026-09-06** under the operator's delegation, wherever the research was
inferred, unknown, contradictory, or had no equivalent in the reference.

1. **This phase is notifications only; the home screen, search and the offline cache become Phase 8.**
   The locked plan's `family-notifications` bundles six things; the Phase 5/6 split set the precedent
   that each half must be reviewable and deployable alone. Reminders, task notifications and reaching a
   sleeping phone are one mechanism with one settings section; a home screen, a cross-tab search and
   a read-only cache share nothing with them or with each other. `[OURS]`
2. **A reminder is addressed to the household, never to a Profile.** Every documented reminder is an
   unaddressed pop-up `[V](36836043247131)`; the reference has no per-person routing; and this project
   knows who somebody is only while they are punched in, which lasts three minutes by default `[P1]`.
   A device that asks for reminders gets the household's reminders. `[OURS]`
3. **A device receives; a person does not.** It follows from 2: what is stored is a browser that asked,
   with a name a person recognises, and no tie to a Profile. `[OURS]`
4. **One reminder setting per event, in three states: inherit, none, or its own.** The two levels and
   the override are verified `[V](32083277890075)`; whether several reminders can stack on one event
   is `[UNKNOWN]` everywhere, and a child table for an undocumented capability is speculation. "None"
   exists so that "deliberately silent" is expressible, which the sources never address. `[OURS]`
5. **Presets plus custom, capped at seven days.** The two renderings — a free 1–120 minute field
   `[V](36836043247131)` and presets plus a unit picker `[V](45795554249371)` — are contradictory and
   the dossier declines to reconcile them; the master map already chose "presets + custom" (§7). The
   cap is ours: beyond a week, a reminder is a different feature. `[OURS]`
6. **The defaults are Before event on at 10 minutes, At time of event off, When Due on, When Completed
   off.** No source documents a factory default for any of the four `[UNKNOWN]`. A household that
   installs this should be reminded of its events without being asked to configure anything, and
   should not have every completed chore announced. `[OURS]`
7. **The chime is a per-device switch, off by default.** The chime is verified `[V](36836043247131)`
   and Phase 4 recorded that this display is silent by Phase 1's choice; shipping the switch honours
   the reference, and defaulting it off honours the shipped decision. Volume is the device's own, as
   it is in the reference `[V](36835387462555)`. `[OURS]`
8. **An all-day event reminds from the start of its day.** The reference never says `[UNKNOWN]`; the
   alternative is that all-day events cannot remind at all, which is worse. `[OURS]`
9. **A late chore reminds once.** `[UNKNOWN]` in the sources; a daily nag until a chore is done is a
   defect. The reminder belongs to the occurrence's own due time. `[OURS]`
10. **Anything more than fifteen minutes past is dropped.** The reference says nothing about a device
    that was asleep `[UNKNOWN]`; a wall tablet waking to a morning's worth of banners is a failure.
    `[OURS]`
11. **Exactly once per device, not per household.** Two phones both asking to be reminded is the point
    of asking; one delivery each is the promise. `[OURS]`
12. **The household can see and remove the devices that receive.** Nothing documents this
    `[UNKNOWN]`, and a household that cannot see which browsers it is shouting into cannot stop one.
    `[OURS]`
13. **A delivery is recorded so that "once" is a fact rather than a hope.** `[OURS]`
14. **Nothing is sent about the star economy.** No fetched source documents a star, streak or
    reward-week notification, and whether a redemption notifies a parent is explicitly `[UNKNOWN]` —
    the dossier calls it "plausible given the activity framing" and stops there, so it is not a fact
    to match. Phase 4 shipped the economy silent and this phase leaves it silent. `[OURS]`

## Divergences from the reference, and why

| # | Divergence | Why |
|---|---|---|
| 1 | **Reminders reach phones as well as the shared display** | The operator asked for it (master map §1); the reference shipped push for tasks in mid-2026 `[V](52390654789659)` but has never documented it for events |
| 2 | **The chime ships off** | Phase 1 chose a silent display; the switch exists so a household can choose otherwise |
| 3 | **No spoken reminders** | Owners ask for them `[V]`; out of scope here, as all voice is project-wide |
| 4 | **Nothing is sent about stars** | Matches the reference, which has no such notification, and Phase 4's exclusion — recorded because a star economy that never speaks is a choice |

## Dependencies

- Phases 1–6, shipped and live: the shell, punch-in, the events and their recurrence, the tasks and
  their four sub-types, the household settings, the realtime channel.
- The household's timezone and week start, already stored and already the basis of every date.
- The browser pass (`007-family-e2e`), which must stay green and gains journeys for this phase.

## Out of Scope

Deferred to **Phase 8** (`009-family-home-search-offline`): the Home screen and its Calendar, Tasks
and Lists panes `[V](49738702477723)`; search across the tabs (the Tasks board's search shipped in
Phase 3 and the recipes pane's in Phase 6); the read-only offline cache; Tasks Progress on the
calendar `[V](36625171368987)` and countdowns with their preview bar `[V](40459070511515)`, both
withheld by Phase 2.

Excluded from this project: spoken or voice reminders `[V]`; reminders to an email address, and the
event's "Invited Emails" field `[V](44738510847259)`, since this app sends no mail; the mail-in event
address `[V](39335538450587)`; Sleep Mode as a scheduled screen-off `[V](37235485034779)` and any
quiet-hours rule built on it — whether Sleep Mode suppresses the reference's own reminders is
`[UNKNOWN]`, so there is nothing here to match; a selectable reminder tone `[V]` — the reference has exactly one; a
volume control in the app, which belongs to the device `[V](36835387462555)`; per-Profile or
per-person routing of any notification; any notification about photos, senders or account activity
`[V](360053148432)`; and the notification bell's activity feed.
