# Feature Specification: The Home Screen

**Feature Branch**: `010-family-home-screen`
**Created**: 2026-09-08
**Status**: Draft
**Input**: Phase 9 of the `/family` Skylight Calendar clone — the screen the reference opens on, and
the one this project has never had. An **overview** of the calendar, the day's tasks and the
household's lists, in one place: enough to see the shape of the day without choosing a tab, and
enough to tick a chore or add an event without leaving it.

It is the second of the three phases `008`'s Assumption 1 deferred. The offline cache becomes `011`
and goes last. This one follows `009` because the home screen's calendar pane consumes a calendar
whose chrome `009` finished — the preview bar and the search are on it now, and specifying a pane
over a half-finished calendar would have meant building it twice.

**Authoritative source**: the dedicated help-centre article **The Home Screen**
`[V](49738702477723)`, read through `docs/research/skylight/08-ux-behaviors-and-reviews.md` §"The
Home Screen" (lines 93–99 and 279), corroborated independently in
`01-calendar-tab-and-events.md` (lines 205–207, 112) and in the mobile changelog at
`05-mobile-app.md:624` `[V](49738858986907)`. Every quotation below was checked against the dossier
text rather than remembered; the audit that did so rejected 23 over-claims, which are not in this
document.

The shipped specs bind: Phase 1 **FR-028** (one nav definition, two presentations) and **FR-030**
(the app opens on the Calendar tab — which this phase changes, see Divergence 1); Phase 2 **FR-288**
(a write that cannot complete is refused where the tap happened, never queued); Phase 3's
`lib/family/tasks/counters.ts`, whose own header already names this screen as an intended reader;
and Phase 8's `useTaskDay`, extracted so that a second surface could share the board's expansion.

## Clarifications

### Session 2026-09-08

Answered by the author under the operator's standing delegation — *first answer every question from
the Skylight documentation; only what it cannot answer do we think through*. Each answer says which
of the two it is.

- Q: What is the Home Screen, and where does it sit? → A: **Documented.** It is "the first tab in
  the Navigation bar" and it "shows an overview of your Calendar, tasks, and lists"
  `[V](49738702477723)`. It is an overview, explicitly not a full calendar grid.
- Q: What is on it? → A: **Documented — exactly three panes.** A **Calendar** pane rendering "day
  view or week view"; a **Tasks** pane showing "available tasks for Profiles on the calendar",
  swipeable between Profiles; a **Lists** pane showing the household's lists, also swipeable, with an
  inline add. `[V](49738702477723)`
- Q: What can be hidden? → A: **Documented, and asymmetric.** The household may "customize the home
  screen to show tasks, or lists, or both tasks and lists along with your calendar"
  `[V](49738702477723)` — Tasks and Lists toggle independently and **the calendar is the constant**.
  Corroborated by a different article: "upcoming events always visible, Tasks and Lists toggleable"
  `[V](49738858986907)`.
- Q: Can anything be written from it? → A: **Yes, and this is the requirement with the most
  consequence.** Tasks can be "marked as done from the Home Screen" itself, and **one** Add button
  creates either a task or an event `[V](49738702477723)`. The Home Screen is a write surface, so
  every write on it carries this project's punch-in gate like every other.
- Q: Does the app still open on the Calendar tab? → A: **No, and the sources disagree, so this had to
  be adjudicated.** The master map asserts the app opens on the Calendar tab "exactly like the
  device", and Phase 1 shipped that (FR-030). The dedicated article says the device lands on the
  **Home Screen**, with the full views one tap away `[V](49738702477723)`. **The master map contains
  no help-centre article id anywhere in its 611 lines**, so nothing sourced only from it can satisfy
  constitution §VIII. The article wins. Divergence 1 and FR-1002 record it, because it changes what
  the wall tablet opens on.
- Q: What does a pane actually render? → A: **`[UNKNOWN]`, and it is the largest gap in this phase.**
  No source describes the panes' contents beyond the sentence above. The nearest documented format is
  Skylight's **Tasks widget** — today's tasks only, showing "the Task list name, the total number of
  tasks, and up to three tasks" `[V](36846381293979)` — but whether the Home Screen's Tasks pane *is*
  that widget is not stated. Assumptions 3, 4 and 5.

**Four sources that look relevant and are not**, isolated by the research so a later reader does not
re-adopt them: the Skylight **Buddy** home screen `(50564241301147)` is different hardware and out of
scope project-wide; **operating-system home-screen widgets** (Android, iOS) are an unrelated sense of
the word; **"Add to Home Screen"** is the iOS install gesture, not a screen; and **"displays up to
three events per day"** `(48026687853083)` is the Calendar tab's Month-view overflow rule, which
reads almost identically to the Tasks widget's "up to three" and is not a pane capacity.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Seeing the shape of the day without choosing a tab (Priority: P1)

Somebody walks past the wall tablet. Without touching it they can see what is on today and what is
still to be done — the thing a paper calendar on a fridge does, which choosing between six tabs does
not.

**Why this priority**: it is the screen's whole reason for existing, it is what the reference opens
on, and every other story here is an addition to it.

**Independent Test**: open `/family` and see today's events and the household's tasks together,
without navigating.

**Acceptance Scenarios**:

1. **Given** the app is opened, **When** nothing else is chosen, **Then** the Home Screen is what
   appears, and it is the first tab in the navigation.
2. **Given** the Home Screen, **Then** it shows a calendar overview, not the full week grid.
3. **Given** the Home Screen, **Then** the calendar part of it cannot be turned off.
4. **Given** an installed app on the wall tablet, **When** it is launched, **Then** it opens on the
   Home Screen too — the installed and the browsed app agree.
5. **Given** the Home Screen, **When** a day in its calendar is chosen, **Then** the full calendar
   opens on that day.

---

### User Story 2 — Ticking a chore where you are standing (Priority: P2)

A child finishes a chore at the tablet in the hall. They should not have to find the Tasks tab to say
so.

**Why this priority**: it is documented, it is the difference between an overview and a dashboard,
and it is what makes the screen worth walking to.

**Independent Test**: tick a chore on the Home Screen; see it complete on the Tasks tab too.

**Acceptance Scenarios**:

1. **Given** the Tasks pane, **When** a chore is ticked, **Then** it is recorded as done, and the
   Tasks tab agrees within five seconds.
2. **Given** nobody is punched in, **When** a chore is ticked, **Then** the household is asked who is
   here first, exactly as every other write asks.
3. **Given** a device that cannot reach the household's data, **When** a chore is ticked, **Then**
   the change is refused where the tap happened and nothing is shown as done that is not `[P2]`
   FR-288.
4. **Given** the Tasks pane, **When** it is swiped, **Then** it moves between Profiles.
5. **Given** a Profile hidden on this device, **Then** the Tasks pane does not offer them.

---

### User Story 3 — Adding without leaving (Priority: P3)

A parent standing at the tablet wants to put something on the calendar. One control, two answers.

**Why this priority**: documented, small, and it completes the write surface US2 opens.

**Independent Test**: use the Home Screen's add control to make an event, and again to make a task;
find both on their own tabs.

**Acceptance Scenarios**:

1. **Given** the Home Screen, **Then** it offers **one** add control, not one per pane.
2. **Given** that control, **When** it is used, **Then** the household chooses between an event and a
   task, and gets the same form that tab would have given them.
3. **Given** a punched-in member, **When** they add either, **Then** it is written and attributed to
   them.
4. **Given** the add control is dismissed, **Then** nothing is written and the screen is as it was.

---

### User Story 4 — A household that wants less on it (Priority: P4)

Two adults and a wall tablet in a small kitchen. Not every household wants three panes.

**Why this priority**: documented, and it is what stops the screen becoming noise on a small display.

**Independent Test**: turn the Tasks pane off, and the Lists pane off, and confirm the calendar
remains.

**Acceptance Scenarios**:

1. **Given** the Home Screen's own settings, **Then** the Tasks and Lists panes can be shown or
   hidden independently.
2. **Given** both are hidden, **Then** the calendar overview remains and the screen is still useful.
3. **Given** a pane is hidden, **Then** it costs nothing — no data is fetched for a pane nobody is
   looking at.
4. **Given** a choice made on one device, **Then** another device is unaffected.

---

### User Story 5 — The lists, at a glance (Priority: P5)

The grocery list is the most-used surface in the house. Seeing what is on it without opening a tab is
most of its value.

**Why this priority**: documented as the third pane, and the least urgent of the three.

**Independent Test**: see a list's items on the Home Screen, add one, and find it on the Lists tab.

**Acceptance Scenarios**:

1. **Given** the Lists pane, **Then** it shows the household's lists, and moves between them.
2. **Given** a list with more items than fit, **Then** the pane says how many are outstanding rather
   than pretending the visible ones are all of them.
3. **Given** the Lists pane, **When** an item is added from it, **Then** it appears on the Lists tab.
4. **Given** a list with nothing outstanding, **Then** the pane says so plainly.

---

### Edge Cases

- **A household with no events, no tasks and no lists** sees a Home Screen that says so, not three
  empty frames.
- **The household's midnight** rolls the Home Screen's idea of today without a reload, exactly as it
  rolls the calendar's and the board's.
- **One pane's data cannot be loaded** while the others' can: that pane says so and the rest of the
  screen still works.
- **Every Profile hidden on this device**: the Tasks pane has nobody to show and says so rather than
  drawing an empty strip.
- **A chore ticked on the Home Screen and on the Tasks tab at once** resolves the way two devices
  already resolve it — this phase adds no new rule.
- **A narrow phone**: three panes cannot sit side by side, and the screen must not scroll sideways.

## Requirements *(mandatory)*

### The screen and its place

- **FR-1001**: The system MUST offer a **Home** screen as the **first** entry in the navigation
  `[V](49738702477723)`, in both of the shell's presentations `[P1]` FR-028.
- **FR-1002**: The system MUST open on the Home Screen — both when `/family` is visited and when the
  installed app is launched — replacing Phase 1's FR-030 `[V](49738702477723)`. See Divergence 1.
- **FR-1003**: The Home Screen MUST show an **overview**, not the full week grid `[V](49738702477723)`.
- **FR-1004**: Choosing a day from the Home Screen's calendar MUST open the full calendar on that day
  `[OURS 2026-09-08 #2]`.

### The three panes

- **FR-1005**: The Home Screen MUST have exactly three panes — **Calendar**, **Tasks** and **Lists**
  `[V](49738702477723)`. It MUST NOT add a fourth in this phase; see Out of Scope.
- **FR-1006**: The **Calendar** pane MUST be always present and MUST NOT be hideable
  `[V](49738702477723, 49738858986907)`.
- **FR-1007**: The **Tasks** and **Lists** panes MUST be independently shown or hidden by the
  household `[V](49738702477723)`, and that choice MUST be this device's own `[OURS 2026-09-08 #7]`.
- **FR-1008**: A hidden pane MUST cost nothing — no read is made for a pane that is not shown
  `[P8]` R905's shipped rule.
- **FR-1009**: The **Tasks** pane MUST show the tasks available to the Profiles the calendar is
  showing, and MUST move between Profiles `[V](49738702477723)`.
- **FR-1010**: The **Lists** pane MUST show the household's lists and MUST move between them
  `[V](49738702477723)`.
- **FR-1011**: A pane MUST NOT re-derive a rule another surface owns: the tasks it counts and calls
  done MUST come from `counters.ts` and the shipped expansion, and the events it draws from the
  calendar's own `[P3]`, `[P8]`.

### Writing from it

- **FR-1012**: A task MUST be markable as done from the Home Screen `[V](49738702477723)`.
- **FR-1013**: The Home Screen MUST offer **one** add control, which creates **either** an event or a
  task `[V](49738702477723)` — not one control per pane.
- **FR-1014**: Every write from the Home Screen MUST carry the punch-in gate and the attribution
  every other write carries `[P1]` FR-018, and MUST be refused where the tap happened if it cannot
  complete, never queued `[P2]` FR-288.
- **FR-1015**: The Home Screen MUST NOT introduce a second way to create an event or a task — it
  reaches the shipped forms `[OURS 2026-09-08 #4]`.

### What it must not disturb

- **FR-1016**: Adding the Home tab MUST NOT change what any other tab shows, and MUST NOT move the
  order of the five that exist `[P1]` FR-028.
- **FR-1017**: The Home Screen MUST NOT add a clock of its own; it reads the one the shell already
  publishes `[P8]` R902.
- **FR-1018**: A pane whose data fails MUST NOT take the screen down with it
  `[OURS 2026-09-08 #8]`.
- **FR-1019**: The Home Screen MUST NOT scroll the page sideways at the narrowest supported width
  `[P1]` SC-006.

### Key Entities

- **A pane**: not a stored thing. A view over reads that already exist, plus this device's choice of
  whether to show it.
- **The household's home preferences**: which panes this **device** shows. Per device, like every
  other display choice this project makes.

## Success Criteria *(mandatory)*

- **SC-1001**: Opening the app — browsed or installed — lands on the Home Screen, and the calendar,
  today's tasks and the lists are readable without navigating.
- **SC-1002**: A chore ticked on the Home Screen reads as done on the Tasks tab within five seconds,
  and the numbers on both agree exactly.
- **SC-1003**: A write attempted with nobody punched in asks who is here, and one that cannot
  complete is refused with nothing shown as saved.
- **SC-1004**: The add control produces an event and a task, each indistinguishable from one made on
  its own tab.
- **SC-1005**: Hiding a pane removes it and issues no read for it; the choice survives a reload and
  does not reach another device.
- **SC-1006**: With both optional panes hidden, the calendar overview is still shown and still
  useful.
- **SC-1007**: A household with nothing at all sees a screen that says so, with no empty frames.
- **SC-1008**: The Home Screen's idea of today rolls at the household's midnight without a reload.
- **SC-1009**: One pane failing leaves the others working, and says which one failed.
- **SC-1010**: At the narrowest supported width the page does not scroll sideways, and every control
  meets the touch floor.
- **SC-1011**: Every decision the panes make — which tasks are available, how many items are
  outstanding, which day is today — is unit-tested as pure logic.
- **SC-1012**: An anonymous reader of anything the Home Screen reads is refused, not handed an empty
  result.
- **SC-1013**: After this phase every shipped tab behaves as its own phase's criteria require, and
  the browser pass runs green.

## Assumptions

Decisions taken on **2026-09-08**, each where the reference is silent. Written as literal numbers,
because the `[OURS 2026-09-08 #n]` citations above point at them.

- **1. The Home Screen becomes the app's landing screen, and the installed app's too.** `[V]` says
  the device lands on it. What is ours is applying that to the **installed** app as well: a wall
  tablet that opened somewhere different from a phone would be a distinction the reference does not
  have and nobody asked for. Divergence 1 records what this replaces.
- **2. Choosing a day opens the full calendar on it.** `[UNKNOWN]` — the article says the full views
  are "one tap away" but not from what. An overview whose parts are not doors is a poster.
- **3. The Calendar pane shows the days the calendar itself would show, anchored on today.**
  `[UNKNOWN]`: the article says "day view or week view" without saying who chooses. Following the
  calendar's own measured width means one rule, not two, and no new setting to explain.
- **4. The Tasks pane reports on TODAY, and shows completed-of-total.** `[UNKNOWN]` on both counts.
  The nearest documented format is a **total** — the Tasks widget's "the total number of tasks"
  `[V](36846381293979)` — but this project already computes completed-of-total everywhere else
  (`counters.ts`), and a home screen showing a different number from the calendar's own Tasks
  Progress row would be two answers to one question.
- **5. A pane shows a few items and says how many more there are.** `[UNKNOWN]`. The Tasks widget's
  "up to three" `[V](36846381293979)` is the only number in any source, and it is about a different
  surface — so it informs the choice without being cited as the rule.
- **6. The single add control is a chooser, not a new form.** `[UNKNOWN]` — the article says one
  button creates "a new task or event" and stops there. Reaching the shipped forms is what keeps one
  definition of an event and one of a task.
- **7. Which panes show is a per-device choice.** `[UNKNOWN]`: "customize the home screen" does not
  say for whom. Every other display choice in this project is per device, and the wall tablet and a
  phone want different answers.
- **8. A failing pane degrades alone.** `[UNKNOWN]`. The shipped tabs are all-or-nothing per page,
  which is right for a page that IS one thing; a screen whose whole point is showing three things at
  once should not lose all three because one read failed.
- **9. Rewards and Meals get no pane.** No source enumerates more than three. This is an **absence of
  evidence**, not evidence of absence, and is stated as such — the two are excluded because nothing
  supports them, not because anything forbids them.

## Divergences from the reference, and why

| # | Divergence | Why |
|---|---|---|
| 1 | **The app no longer opens on the Calendar tab** | Phase 1's FR-030 followed the master map's "exactly like the device". The dedicated article says the device lands on the Home Screen, and the master map carries no article id anywhere in its 611 lines. The better-sourced claim wins; the change is called out because it alters what the wall tablet shows on launch |
| 2 | **No Rewards or Meals pane** | Assumption 9 — nothing supports them |
| 3 | **No Month or Schedule view behind the calendar pane** | This project ships the Week view alone; that gap is Phase 2's and is not narrowed or absorbed here |

## Dependencies

- Phases 1–8, shipped and live: the shell and its one nav definition, the calendar and its
  occurrence expansion, the tasks board with `counters.ts` and `useTaskDay`, the lists and their pure
  grouping, the punch-in gate, and the realtime channel.
- No new stored data is expected; this phase reads what the tabs already read.

## Out of Scope

Deferred to its own phase: the **offline cache** (`011`). Note that **no dossier supports a Skylight
offline feature at all** — the product is criticised for lacking one — so `011` is this project's own
invention and must be specified as a divergence rather than as a clone.

Excluded here: a **Rewards pane** and a **Meals pane** (Assumption 9); the **Month and Schedule**
calendar views and their switcher, still unbuilt since Phase 2; the Skylight **Buddy** home screen,
which is different hardware; and **operating-system home-screen widgets**, which are a different
thing that shares a word.
