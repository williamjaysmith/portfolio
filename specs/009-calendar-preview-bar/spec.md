# Feature Specification: The Calendar's Preview Bar

**Feature Branch**: `009-calendar-preview-bar`
**Created**: 2026-09-07
**Status**: Draft
**Input**: Phase 8 of the `/family` Skylight Calendar clone — the strip of information the reference
draws *above* its events, and the search that finds one. Three things, all of which the calendar was
built to carry and none of which it does yet: **countdowns** to the days a household is waiting for,
**Tasks Progress** for the Profiles on screen, and a **search** that finds an event by its name.

It is the first of the three phases `008`'s Assumption 1 deferred. The Home screen becomes `010` and
the offline cache `011`; that order was the operator's decision on 2026-09-07, for two reasons worth
recording. The Home screen's calendar pane is a consumer of this calendar, and specifying it against
chrome that is still missing two documented pieces would mean building it twice. And this phase pays
two debts Phase 2 wrote into its own requirements rather than opening a new one.

**Authoritative sources**: `docs/research/skylight/01-calendar-tab-and-events.md` §4, §5 (the
countdown chip, the preview bar, the Show Countdowns setting, and the explicit finding that the chip
row's literal format is `[UNKNOWN]`), `00-master-map.md` §1 and §9, plus a re-read of every
search mention across all nine dossiers — which is what corrected the master map's §1 "search"
(Assumption 1). The shipped specs bind: Phase 2 **FR-228** (`countdown_enabled` shipped as a
column nothing reads) and **FR-268** (Tasks Progress deliberately withheld) are the two debts this
closes; Phase 2 FR-288 (a write that cannot complete is refused where the tap happened, never
queued), Phase 1 FR-018 (PINs) and FR-029–FR-034 (the shell), Phase 3 FR-386 (the Tasks board's
search, the idiom this follows) and `lib/family/tasks/counters.ts` (the progress rule, already
written and already tested).

## Clarifications

### Session 2026-09-07

Answered by the author under the operator's standing delegation — *"first answer every question from
the Skylight documentation; only what it cannot answer do we think through"*. Every question below
was taken to the help centre first, and the answer says which of the two it is.

- Q: Does the reference have one search across its tabs? → A: **No — it has several, each inside
  one tab, and this is the phase's most consequential finding.** Re-reading every search mention in
  the dossiers turns up: a Tasks **Search** icon that finds tasks by name and description
  `[V](44738601403931, 39074226341659)`, which this project shipped in Phase 3; a keyword **search
  box** on the Recipe pane `[V](44338446585115)`, shipped in Phase 6; a **Search** control on the
  mobile app's calendar toolbar `[V](45755784991131)`, which this phase adds; and, separately, three
  fields for *choosing* something rather than finding content — an emoji `[V](54029071887899)`, a
  timezone and an address `[V](37234772893851)`. **No source describes a search spanning tabs.** So
  the master map's §1 "search" is three per-tab searches, not one across them, and the cross-tab idea
  is rejected as not the reference's design. FR-919, Assumption 1.
- Q: What does the countdown chip actually say? → A: **`[UNKNOWN]`, so it is ours.** The dossier is
  explicit that "Vacation 48 days" appears verbatim in no fetched source, and that the format — "48
  days" against "in 48 days" against a numeral badge — is unknown. Assumption 3 records the choice
  and its reasoning rather than asserting a match. FR-902.
- Q: What does the calendar's Search actually search, and where does it live? → A: **Documented as a
  control, `[INFERRED]` as to events, and documented only on the phone.** A "Search" magnifying glass
  sits on the mobile app's calendar toolbar as one of six controls beside Previous / Today / Next /
  the view toggle / Filter `[V](45755784991131)`, corroborated by a product screenshot; no fetched
  article says what it searches or what its results look like, and no source puts it on the device.
  FR-915, Assumption 8.
- Q: What does Tasks Progress look like? → A: **`[UNKNOWN]` too.** What is verified is only that a
  Filter toggle "displays the task progress of visible profiles above the events in all calendar
  views" `[V](36625171368987)`. The dossier states plainly that the "avatar + name + N/M" rendering
  on the Calendar tab is found in no article. Assumption 4. FR-914.
- Q: When is a countdown visible? → A: **Documented, and exactly three values**: Always, 3 months
  prior to the event, 1 month prior `[V](40459070511515)`; "Adjust the Display" separately recommends
  "Always" `[V](48784194278683)`, corroborating the setting without adding a fourth value. Not a
  decision. FR-903.
- Q: Which of Skylight's countdown behaviours do not apply here? → A: Two, both because this project
  lacks the surface. Countdowns appear on Skylight's **photo screensaver** with a toggle of its own
  `[V](40459070511515)` — this project has no screensaver. And Skylight forbids a countdown on an
  event from a **read-only calendar sync** `[V](40459070511515)` — this project has no sync, so every
  event is editable and the rule has nothing to exclude. Out of Scope records both.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — The day the household is counting towards (Priority: P1)

The holiday is five weeks away and somebody keeps asking how long. A parent marks it as a countdown
when they make the event, and from then on the calendar carries the number above the week — visible
to a child who cannot yet read a date.

**Why this priority**: it is the phase's reason for existing, it is the debt Phase 2 named in FR-228,
and the column it needs has been sitting in the database since Phase 2 with nothing reading it.

**Independent Test**: mark an event a countdown, see the days on the calendar, watch the number fall
by one at the household's midnight, and see it go when the day arrives.

**Acceptance Scenarios**:

1. **Given** the event form, **When** a parent turns on **Countdown**, **Then** the event is saved as
   one and the calendar shows how many days away it is.
2. **Given** a countdown event, **When** its own details are opened, **Then** the countdown status is
   shown directly under the title.
3. **Given** the household's clock passes midnight, **When** the calendar is looked at, **Then** the
   number has fallen by one, with no reload.
4. **Given** a countdown whose day has arrived, **When** the calendar is looked at, **Then** it reads
   as today rather than as a negative number, and it leaves the bar once the day is past.
5. **Given** a member is punched in, **When** they open the event form, **Then** they may mark a
   countdown like any other field — the punch-in is the gate, not the parent role, which is how
   every other event field already behaves `[P2]`. What only a parent may change is the household's
   **Show Countdowns** setting (US3-4), which is a different control on a different screen.

---

### User Story 2 — More than one thing to look forward to (Priority: P2)

The holiday, a birthday and the first day of term are all coming. The bar has room for one, so it
shows them in turn; tapping it lists them all.

**Why this priority**: the reference's own documented behaviour for the case a real household hits
immediately, and the part that stops the feature being useless with three children.

**Independent Test**: make three countdowns, watch the bar move between them, and tap it to see all
three.

**Acceptance Scenarios**:

1. **Given** more countdowns than the bar can show, **When** it is watched, **Then** the active ones
   take the first position in turn rather than one winning permanently.
2. **Given** the bar, **When** it is tapped, **Then** a list of every active countdown opens.
3. **Given** that list, **When** a countdown in it is chosen, **Then** its event's own details open.
4. **Given** a household with no countdowns, **When** the calendar is looked at, **Then** the bar
   takes no space and says nothing.
5. **Given** the bar is rotating, **When** somebody is reading it, **Then** the movement can be
   stopped — a bar that changes under a reader is worse than one that does not move.

---

### User Story 3 — Only when it is close enough to matter (Priority: P3)

A dentist appointment in eight months is not something to count down to. The household decides how
early a countdown starts appearing, once, for all of them.

**Why this priority**: it is what makes the bar liveable over a year rather than a month, and it is
fully documented.

**Independent Test**: set each of the three values and confirm which countdowns appear under each.

**Acceptance Scenarios**:

1. **Given** Settings, **When** the household preferences are opened, **Then** **Show Countdowns**
   offers exactly **Always**, **3 months prior to the event** and **1 month prior to the event**.
2. **Given** "1 month prior", **When** an event six weeks away is a countdown, **Then** it is not on
   the bar; **When** the same event is four weeks away, **Then** it is.
3. **Given** a change to the setting, **When** another device looks, **Then** it has the new value
   within five seconds.
4. **Given** a punched-in member, **When** they open Settings, **Then** they see the value and cannot
   change it.

---

### User Story 4 — How the chores are going, above the week (Priority: P4)

A parent glancing at the calendar wants to know whether the morning's chores happened without
leaving the tab they are on.

**Why this priority**: documented, and the second debt Phase 2 named — but it is a reading of numbers
this project already computes, so it is the smallest piece of work here.

**Independent Test**: turn the filter on and see each visible Profile's progress above the events;
tick a chore on the Tasks tab and watch the number follow.

**Acceptance Scenarios**:

1. **Given** the calendar's Filter, **When** it is opened, **Then** it offers **Tasks Progress**.
2. **Given** Tasks Progress is on, **Then** each Profile currently shown on the calendar carries its
   own progress for today, above the events.
3. **Given** a Profile hidden on this device, **Then** no progress is shown for them — the bar
   follows what the calendar is showing, not the whole household.
4. **Given** a chore is ticked anywhere, **When** the calendar is looked at, **Then** the progress
   has followed within five seconds.
5. **Given** Tasks Progress is off, **Then** nothing of it is shown, and that choice is this device's
   alone.

---

### User Story 5 — Finding the event somebody half-remembers (Priority: P5)

"When was the school thing?" — a parent types part of the name and gets the event, without paging
through weeks.

**Why this priority**: it completes the reference's per-tab search model, and the calendar is the
last shipped tab without one.

**Independent Test**: type part of an event's name, get it, choose it, and land on its day.

**Acceptance Scenarios**:

1. **Given** the calendar, **When** the search is opened and part of a title typed, **Then** the
   matching events are listed.
2. **Given** a result, **When** it is chosen, **Then** the calendar goes to the day that event is on
   and its details open.
3. **Given** a search matching nothing, **Then** it says so plainly rather than showing an empty box.
4. **Given** a repeating event, **When** it matches, **Then** the household is not shown the same
   title fifty times — the results are about events, not every occurrence of them.
5. **Given** the search is closed, **Then** the calendar is exactly where it was.

---

### Edge Cases

- **A countdown on a repeating event.** The reference does not address it `[UNKNOWN]`. A repeat has no
  single day to count towards, so the countdown follows its **next** occurrence.
- **A countdown on an all-day event** counts whole days in the household's zone, like everything else.
- **A countdown created for a day already past** never reaches the bar.
- **The household's timezone is what "days away" is counted in**, not the device's — a phone in
  another zone shows the same number as the wall.
- **Every Profile is hidden** on this device: Tasks Progress shows nothing rather than an empty row.
- **A Profile with no chores today** shows as having none, not as complete.
- **Search while a write is in flight** changes nothing about the write; search is a read.
- **A search term matching an event the device has hidden by Profile filter** — the filter is about
  the calendar's drawing, and search is asked a direct question, so it answers.

## Requirements *(mandatory)*

### Functional Requirements

**The countdown itself**

- **FR-901**: An event MUST be markable as a countdown from its own form, and the mark MUST be kept
  `[V](40459070511515)`. The column exists already and nothing has ever written it `[P2]` FR-228.
  The gate is the punch-in, as it is for every other event field — **not** the parent role, which
  governs the household setting alone (FR-903). The mark belongs to the **series**: it has no
  per-occurrence form, so a change to it MUST NOT offer the "This event" scope `[P2]` FR-287.
- **FR-902**: The calendar MUST show, for each visible countdown, how many days away it is
  `[V](40459070511515)`. The literal wording is `[UNKNOWN]` in every fetched source and is
  `[OURS 2026-09-07 #3]`.
- **FR-903**: The household MUST be able to choose when countdowns start appearing, from exactly
  three values — **Always**, **3 months prior to the event**, **1 month prior to the event**
  `[V](40459070511515)`, whose recommended value "Always" is corroborated separately
  `[V](48784194278683)` — and only a punched-in parent MUST be able to change it
  `[P1]` FR-015.
- **FR-904**: A countdown's number MUST be counted in the household's timezone and MUST change at the
  household's midnight without a reload `[P2]` FR-284.
- **FR-905**: A countdown MUST leave the bar once its day has passed, and MUST read as today on the
  day itself rather than as zero or a negative `[OURS 2026-09-07 #5]`.
- **FR-906**: An event's own details MUST show its countdown status directly under the title
  `[V](40459070511515)`.

**The bar**

- **FR-907**: Countdowns MUST be shown in a bar above the events `[V](40459070511515)`, and that bar
  MUST also be where Tasks Progress is shown `[V](40459070511515 — "appearing alongside Tasks
  Progress")`.
- **FR-908**: When there is not room for every active countdown, the active ones MUST take the first
  position in turn `[V](40459070511515)`, and the household MUST be able to stop the movement
  `[OURS 2026-09-07 #6]`.
- **FR-909**: Tapping the bar MUST open a list of every active countdown `[V](40459070511515)`, and
  choosing one MUST open that event's details.
- **FR-910**: A household with nothing to show MUST get no bar at all, taking no space.

**Tasks Progress**

- **FR-911**: The calendar's Filter MUST offer **Tasks Progress**, and it MUST show the progress of
  the Profiles the calendar is currently showing, above the events `[V](36625171368987)`.
- **FR-912**: The progress figures MUST be the ones the Tasks board already computes — this phase
  MUST NOT write a second rule for what "done" means `[P3]` `counters.ts`.
- **FR-913**: The switch MUST be this device's own, like the calendar's other display switches
  `[P2]` FR-266.
- **FR-914**: The literal format is `[UNKNOWN]` in every fetched source and is `[OURS 2026-09-07 #4]`.

**Search**

- **FR-915**: The calendar MUST offer a search of its events by title. That a **Search** control
  exists on the mobile app's calendar toolbar is `[V](45755784991131 — "Search", one of six controls)`
  and is corroborated by a product screenshot. That it searches *events* is `[INFERRED]`; its results
  are `[UNKNOWN]`, so their shape is `[OURS 2026-09-07 #9]`.
- **FR-916**: Choosing a result MUST take the calendar to the day that event falls on and open its
  details.
- **FR-917**: A search matching nothing MUST say so.
- **FR-918**: A repeating event MUST NOT flood the results with its occurrences.
- **FR-919**: Search MUST NOT be offered across tabs. The reference has three separate per-tab
  searches — tasks `[V](44738601403931)`, recipes `[V](44338446585115)`, calendar
  `[V](45755784991131)` — and no fetched source describes one spanning them. See Assumption 1.

**What does not change**

- **FR-920**: Nothing in this phase MAY change what a write costs: every write keeps its punch-in
  gate and its refusal behaviour `[P2]` FR-288.
- **FR-921**: Nothing in this phase MAY add a second definition of a day, a week, or a completed
  chore. It reads what is shipped.

### Key Entities

- **A countdown**: not a row of its own — a flag on an event that already exists, plus the household's
  one setting for when such flags start showing.
- **The bar**: a view over countdowns and task counters, holding no state but this device's switches.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-901**: An event marked as a countdown shows its days on the calendar, and the mark survives a
  reload.
- **SC-902**: The number falls by exactly one at the household's midnight, with no reload. **Proved
  as arithmetic and as wiring, not in a browser at a real midnight**: crossing one needs the page
  clock moved by up to a day, and the e2e harness refuses more than three hours because the
  signed-in session is a token minted on the real clock (007 harness.md §5). The unit tests cover
  every case including both daylight-saving changes; the number is a function of the shell's shipped
  minute store. The overnight watch on the wall tablet is the operator's.
- **SC-903**: With more countdowns than fit, every active one reaches the first position, and the
  movement can be stopped.
- **SC-904**: Each of the three Show Countdowns values admits exactly the countdowns it should,
  checked at a boundary either side.
- **SC-905**: Tapping the bar lists every active countdown, and choosing one opens its event.
- **SC-906**: A household with no countdowns and Tasks Progress off has no bar and loses no space.
- **SC-907**: Tasks Progress matches the Tasks board's own figures for the same day, exactly.
- **SC-908**: Hiding a Profile on this device removes it from the progress row within five seconds.
- **SC-909**: A search finds an event by part of its title, lands on its day, and shows a repeating
  event once rather than once per occurrence.
- **SC-910**: Every decision — days remaining, which countdowns are in force, the progress figures —
  is unit-tested as pure logic, including a daylight-saving change and the household's midnight.
- **SC-911**: An anonymous reader of the new data gets a refusal, not an empty result.
- **SC-912**: After this phase, every shipped tab still behaves as its own phase's criteria require,
  and the browser pass still runs green.

## Assumptions

Decisions taken on **2026-09-07**, each where the research was unknown, contradictory, or had no
equivalent in the reference. Written as literal numbers rather than an ordered list, because the
`[OURS 2026-09-07 #n]` citations above point at them and a renderer would renumber a list.

- **1. There is no search across tabs, because the reference describes none.** The master map's §1
  inventory lists "search" as one item, which reads as one search spanning the app. Every search
  mention in the dossiers says otherwise: what is documented is three searches, each inside one tab —
  tasks by name and description, recipes by keyword, and the calendar's own. Phases 3 and 6 shipped
  two of them; this phase adds the third. **This is an absence of evidence, not evidence of absence**
  — no source rules a cross-tab search out, and none describes one either, so building one would be
  inventing a surface rather than cloning it. The idea is dropped, recorded here rather than
  silently. `[OURS]`
- **2. A countdown on a repeating event counts to its next occurrence.** `[UNKNOWN]` — the reference
  never addresses it. A repeat has no single day, and counting to the first occurrence would leave
  the bar stuck in the past. `[OURS]`
- **3. The chip reads as a name and a number of days.** `[UNKNOWN]`: "Vacation 48 days" is in no
  fetched source and the dossier says so explicitly. The wording is chosen to be readable by a child
  at a distance, which is what the wall display is for. `[OURS]`
- **4. Tasks Progress reads as each Profile's completed-of-total for today.** `[UNKNOWN]` on the
  Calendar tab specifically; the dossier records that Skylight shows such counts elsewhere in the
  product, which makes it plausible but not verified. `counters.ts` already produces exactly this
  pair. `[OURS]`
- **5. A countdown reads as today on its day and then leaves.** `[UNKNOWN]`. Counting to zero and
  then to negatives would be worse than either. `[OURS]`
- **6. The rotation can be stopped.** `[UNKNOWN]` — the reference documents that it rotates and
  nothing about pausing. A bar that changes while somebody is reading it is a poor wall display, and
  this project has made the same call before about motion. `[OURS]`
- **7. Tasks Progress reports today, whatever day the calendar is paged to.** `[UNKNOWN]` — the
  reference has no paging distinction to make, since the progress it describes is "of visible
  profiles" and the Tasks board is a today-shaped board. A bar whose numbers changed as you paged to
  next week would be reporting on chores that have not happened. `[OURS]`

- **8. The one surface carries the search the reference documents only on the phone.** The Search
  control is `[V]` on the mobile app's calendar toolbar; no source puts one on the device, and
  whether the device has one is `[UNKNOWN]` rather than known-absent. This project has a single
  application serving the wall tablet and the phones alike, so a control present on one and not the
  other is not a distinction it can express. Hiding the search at tablet widths would withhold a
  useful thing from the household's main screen to imitate a hardware split this project does not
  have. `[OURS]`
- **9. A search shows results, and choosing one navigates.** `[UNKNOWN]`: no source shows the results.
  The Tasks tab's shipped search narrows its board in place, which cannot work here — the calendar
  draws a few days at a time and the answer is usually not among them. `[OURS]`

## Divergences from the reference, and why

| # | Divergence | Why |
|---|---|---|
| 1 | **No search across tabs** | The reference has none; the master map's inventory implied one. Recorded so the omission reads as a decision, not a gap |
| 2 | **No countdowns on the screensaver** | This project has no photo screensaver; the reference's separate toggle for it has nothing to govern |
| 3 | **Every event may be a countdown** | The reference excludes events from a read-only sync; this project has no sync, so nothing is excluded |
| 4 | **No automatic emoji** beside the countdown status | The reference's details popup "may add a relevant emoji automatically" `[V](40459070511515)`. Choosing one from a title needs either an invented mapping to maintain or a model call, and §VII forbids a child's schedule leaving this project's infrastructure. R914 |
| 5 | **Show Countdowns sits under Household**, not a Calendar section | The reference puts it at Settings > Calendar `[V](45795554249371)`. This Settings screen has no Calendar section — Clock and Start week on, both calendar settings, already live under Household — so the new one joins them rather than moving shipped fields. R904 |
| 6 | **Search is a results list, not an in-place filter** | The Tasks tab's search narrows the board where it stands (`[P3]` FR-386). The calendar cannot show a day it is not on, so a finder must navigate. R908 |

## Dependencies

- Phases 1–8, shipped and live: the shell and its Filter, the calendar and its events, the Tasks
  board and `counters.ts`, the household settings, the realtime channel.
- `family.events.countdown_enabled`, shipped by Phase 2 and read by nothing.
- The household's timezone and week start, already the basis of every date.

## Out of Scope

Deferred to their own phases: the **Home screen** (`010`) and the **offline cache** (`011`).

Excluded from this project: the **photo screensaver** and its countdown row `[V](40459070511515)`;
**calendar sync** of any kind, and with it the reference's rule that a synced event cannot be a
countdown `[V](40459070511515)`; a **search across tabs** (Assumption 1); and the **Day, Month and
Schedule views** with their view switcher — a real and separate gap, since Phase 2 shipped the Week
view alone, which this phase must not quietly absorb while it is in the same files.
