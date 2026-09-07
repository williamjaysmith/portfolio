# Implementation Plan: Family Notifications

**Branch**: `008-family-notifications` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/008-family-notifications/spec.md`

## Summary

The household says what it wants to be reminded of, and any `/family` page that is open says so when
the moment comes. An event can carry its own reminder, under the three repeat scopes Phase 2 already
ships. Two task notices come with it — a timed chore is due, and a chore has been finished, by whom.

A reminder appears only where a page is open. Nothing reaches a device that is looking at something
else, and nothing chases a phone in a pocket. That is a property of the design, not a gap in it: it is
recorded as a divergence from the reference, carried by Assumption 15, and said in plain words in
Settings so the household is never waiting for a buzz that was never coming.

The shape of the build follows one decision, **R802**: there is a single pure function that answers
*"which reminders are due at this instant?"*, with one reader — the browser drawing a banner. The
banner lives in the app shell, so it cannot borrow whichever tab's data happens to be loaded: on Lists
or Meals the calendar's events are not in the cache at all, and a lead time of up to seven days can be
owed for an event outside any visible window. So the banner **owns a small dedicated query of its
own** — the household's events and timed chore occurrences over the reminder horizon — independent of
whichever tab is showing. One computation, one reader, and its data comes from its own read rather
than from a screen that may not be open.

That leaves two things to build:

1. **The due-computation and its settings** — pure logic in `lib/family/notifications/**`, five columns
   on the settings table the household already has, three on events, and the same three on the
   exceptions table so a repeating event's reminder honours the three shipped scopes.
2. **The banner** — a client surface over its own query and `useNow()`, the shell's existing minute
   clock, with its per-device switches on `createDeviceSwitches` and its dismissals in `localStorage`.
   All three of those exist and are tested.

The per-event override rides Phase 2's scope machinery rather than inventing any of its own, and the
two task notices are the due-computation's predicate (**When Due**) and a reading of the realtime
channel the shell already holds (**When Completed**). **This phase adds no new tables**: `034` and
`035` are columns on tables that already exist.

"Shown once" is therefore a per-device convention, not a server record: the browser keeps a set of
reminder keys in `localStorage`. That has two honest costs, stated here and everywhere else the
guarantee is stated — clearing site data, a private window or a second browser profile starts with an
empty set, so a reminder still inside its freshness window can show again; and two tabs each show
their own banner.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16.1.6 App Router, React 19.1.0
**Primary Dependencies**: `@supabase/supabase-js` · `@supabase/ssr` · TanStack Query 5 · Zod 4 ·
Tailwind 4 · lucide-react. **No new dependency.**
**Storage**: Supabase Postgres, `family` schema, RLS by `is_member()`; migrations `034`–`035`, both
columns on existing tables
**Testing**: Vitest 4 (`unit`, jsdom) · policies tests (node, local stack) · Playwright (`007`)
**Target Platform**: a wall tablet, an iPad, phones; deployed on Vercel
**Project Type**: web — a sub-app inside the portfolio
**Performance Goals**: a banner within one minute of its moment (SC-802); the banner's own query small
enough to sit behind every tab without being felt
**Constraints**: no suppressions; `maxCyclomatic: 20`, `maxCognitive: 15`; `lib` never imports
`app/**`; the hosted `db push` precedes merge (R818)
**Scale/Scope**: one household, six profiles. Correctness over throughput.

## Constitution Check

*Gates evaluated before Phase 0. Re-checked after design.*

| Principle | Verdict | How |
|---|---|---|
| **I. Sub-apps self-contained** | PASS | Everything lands under `app/family/**`, `lib/family/**` and `supabase/`. No other sub-app is touched, and nothing is added outside the sub-app's own tree. |
| **II. Test-first for logic** | PASS | The due-computation, the staleness arithmetic, the three-state override resolution, the task predicate, the reminder key and the message wording are all pure and all get a failing test first. The banner's presentation is the only untested-by-unit layer, and R816 says which test covers what. |
| **III. Accessible and touch-first** | PASS | The banner is a live region that does not steal focus, dismissible by keyboard and by a 44px target. Settings reuses the shipped switch and field components. Colour carries nothing. |
| **IV. Layered, boundary-enforced** | PASS | A new `family-notifications-core` fallow zone for the pure logic, importing only `lib`. No route handler, no server-only module, nothing that crosses a layer it did not already cross. |
| **V. Quality gates** | PASS | Four gates, no suppressions. The new pure modules are branchy, so they are the ones that need real coverage for CRAP — which is where the test-first discipline pays for itself. |
| **VI. Degrade gracefully** | PASS | Storage refused → the switches work for the session and say so, and every reminder is treated as unseen. Offline → the banner shows nothing rather than something stale (FR-816's sibling edge case). No page open → nothing is shown, and Settings says so rather than leaving the household to discover it. |
| **VII. Private by default** | PASS | Nothing in this phase sends any household data anywhere. There is no third party, no new external service, no new table and no new endpoint: the reminder is computed in the browser from data that browser is already entitled to read under RLS, and shown on the same screen. |
| **VIII. Fidelity is specified** | PASS | Every requirement carries its evidence tag, every article identifier was verified against the dossiers, and the checklist records the one place a draft had promoted an `[UNKNOWN]` to a fact. The one deliberate departure — reminders only where a page is open — is in the divergence table with the reference's own verified behaviour beside it. |

### Re-check after Phase 1 design

Re-evaluated once the data model and contracts were written. No verdict changed. Two things were
settled by the design work:

- **The realtime publication is untouched.** Nothing new joins it, because nothing new exists to join
  it. **When Completed** is derived on the open page from `family.task_resolutions`, which Phase 3
  already publishes and which already carries the status, the resolution time, the occurrence date and
  the credited profile — so an open page learns of a completion through the channel it already has. A
  notice is deduped on the resolution row's own identity, not on (task, date), because a routine can
  be completed in two slots on one day and an Anytime chore has no date at all; and it is suppressed
  on the device that did the ticking, which is already looking at the card that just flipped.
- **The hosted `db push` still precedes the merge, for a smaller reason than before** (R818). No table
  is created, but `EVENT_COLUMNS` and `SETTINGS_COLUMNS` name the new columns, so a deployment against
  a database that has not had `034` and `035` fails its settings and calendar reads. That is narrower
  than Phase 2's failure mode — no shared realtime channel goes down with it — and it is still an
  ordering the merge must respect.

### Complexity Tracking

No constitutional violation needs justifying. One cost is accepted knowingly and recorded here so it
is reviewed rather than discovered:

| Cost | Why it is accepted | The cheaper thing that was rejected |
|---|---|---|
| **A URL parameter on the calendar (`?on=`)** | A banner names a day, and tapping it must open that day: `/family` has no URL parameters at all today, so a banner on Lists or Meals can move the household to the calendar tab but not to the right day. | Leaving the banner inert, or letting it change tabs but not the anchor. That is a worse product for one line of parsing (R815). |

## Project Structure

### Documentation (this feature)

```
specs/008-family-notifications/
├── spec.md              # 23 requirements, 14 criteria, 11 assumptions, evidence-tagged
├── plan.md              # this file
├── research.md          # thirteen decisions, R801–R818 (gaps where push went)
├── data-model.md        # migrations 034–035, invariants, the privilege delta
├── contracts/
│   └── server-actions.md    # three extended actions; no new actions and no routes
├── quickstart.md        # setup, verification per criterion
├── tasks.md             # the task breakdown
└── checklists/
    └── requirements.md  # spec quality — validated, with its findings
```

### Source Code (repository root)

```
lib/family/
├── notifications/                    # NEW — the fallow zone `family-notifications-core`
│   ├── settings.ts                   # the household's five choices, and their defaults
│   ├── resolve.ts                    # household default + per-event override → the reminder in force
│   ├── due.ts                        # THE pure function (R802): data + instant → reminders due,
│   │                                 #   including the fifteen-minute staleness rule (FR-817)
│   ├── identity.ts                   # a reminder's key (R808), what the dismissed set is keyed on
│   └── message.ts                    # the words: "Swim lesson starts in 10 minutes"
├── actions/
│   ├── settings.ts                   # EXTENDED — five fields in SETTINGS_FIELDS (R810)
│   └── events.ts                     # EXTENDED — the reminder in the patch, under the three scopes
├── rows.ts · types.ts · validation.ts   # EXTENDED — columns, types, Zod schemas

app/family/(app)/components/
├── notifications/                    # NEW
│   ├── ReminderBanner.tsx            # the surface (FR-814–FR-816)
│   ├── useReminderHorizon.ts         # NEW — the banner's own query: the household's events and timed
│   │                                 #   chore occurrences over the reminder horizon (R802)
│   ├── useDueReminders.ts            # useNow() + due.ts + the dismissed set
│   ├── useCompletionNotices.ts       # task_resolutions off the shell's channel (FR-819)
│   ├── reminderSwitches.ts           # createDeviceSwitches: banner, chime
│   └── chime.ts                      # one tone, primed by the switch's own gesture
└── settings/
    ├── NotificationsSection.tsx      # NEW — two groups, four choices (FR-802–FR-807), and the line
    │                                 #   telling the household where reminders appear
    └── LeadTimeField.tsx             # NEW — presets + custom with a unit (FR-806)

app/family/(app)/calendar/components/
└── EventForm.tsx                     # EXTENDED — the event's own reminder (FR-808)

supabase/migrations/
├── 034_notification_settings.sql
└── 035_event_reminders.sql

e2e/specs/notifications.spec.ts       # NEW — the browser journeys R816 names
```

**Structure decision**: the pure logic goes in `lib/family/notifications/**` as its own fallow zone,
importing only `lib`. It is the branchy part of the phase and therefore where the gate's coverage has
to come from, and keeping it out of the component tree means the whole of "which reminders are due"
can be proved at a pinned instant with no DOM, no query client and no clock. The components above it
supply three things it must never fetch for itself: the data (`useReminderHorizon`), the instant
(`useNow`) and the device's memory of what it has already shown.

## Implementation phasing

Each step leaves the repository green. The order is chosen so that the thing hardest to verify is
built on top of things already proved, not underneath them.

1. **Setup** — the fallow zone, the migration skeletons, the types. Nothing behaves differently yet.
2. **The settings** (US1) — five columns, the action's five fields, the Settings section with the line
   that says where reminders appear, the parent-only gate. Independently shippable and immediately
   visible.
3. **The due-computation** (foundation for US2–US4) — `resolve.ts`, `due.ts`, `identity.ts`,
   `message.ts`, all test-first. No UI. This is where the phase's real difficulty is, and it is
   entirely pure.
4. **The banner** (US2) — its own query over the reminder horizon, then the client surface over step 3:
   the minute clock, the dismissed set, the chime. The wall display works end to end here.
5. **The per-event override** (US3) — three columns on two tables, the event form, and the three scopes
   riding Phase 2's existing scope machinery.
6. **Task notices** (US4) — the **When Due** predicate on top of step 3, and **When Completed** read
   from `task_resolutions` off the channel the shell already holds, deduped on the resolution row and
   suppressed on the device that ticked.
7. **The gates and the browser pass** — the four gates, the new e2e journeys, the quickstart run
   record, then the hosted `db push` of `034` and `035`.

## Risks

| Risk | Likelihood | What it costs | What we do |
|---|---|---|---|
| **A reminder is only ever seen if a page is open** | Certain — it is the design | A moment can pass with nobody told | Recorded, not hidden: the divergence table, Assumption 15, and a plain line in the Notifications section itself. The wall display is the surface that is always on, and the household uses the app rather than expecting to be chased. |
| **A dismissed reminder comes back on the same device** | Medium | A banner shown twice, inside its fifteen minutes | Accepted and written down. The dismissed set is `localStorage`, so clearing site data, a private window or a second browser profile starts empty, and two tabs each keep their own set. The alternative is a per-device server record — the table this phase deliberately does not add. |
| **The banner's own query duplicates the calendar's read** | Medium | Two overlapping reads of the same events | It is deliberately narrow — the reminder horizon, not a visible window — and it is invalidated by the same realtime channel every other family query uses, so it never polls and never goes stale on its own (R802). |
| **A flood after a device has been closed** | Medium | A wall tablet showing a morning's worth of banners on wake | The fifteen-minute staleness rule (FR-817) lives in the pure due-computation and is unit-tested, so it applies to every reader by construction rather than by remembering to apply it. |
| **The calendar's new URL parameter fights the pager** | Low | The view jumps back on every render | It seeds the anchor once on mount and is never read again (R815). |

## Progress

- [x] Phase 0 — research complete (`research.md`, thirteen decisions, R801–R818)
- [x] Constitution Check — passed; §VII has nothing to argue, because nothing leaves the project
- [ ] Phase 1 — data model, contracts, quickstart
- [ ] Phase 2 — tasks
- [ ] Implementation
