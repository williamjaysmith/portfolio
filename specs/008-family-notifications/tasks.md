# Tasks: Family Notifications

**Feature**: `008-family-notifications` | **Branch**: `008-family-notifications`
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/server-actions.md](./contracts/server-actions.md)

Constitution §II is non-negotiable, so **every pure-logic task is a test first**. A task that says
"test" writes a failing test; the task after it makes it pass. The gates run before every commit.

`[P]` = parallelisable (different files, no dependency on an incomplete task).

**Progress (2026-09-07).** Phases 1 and 2 are complete and committed: migrations `034` and `035` are
applied and pinned by a schema test at the store, and the pure due-computation is five modules and 54
tests under its own fallow zone. `T018` was written early, with the migrations it checks. The four
gates are green. Phases 3–7 — the settings screen, the banner, the per-event override, the chore
notifications, and the browser pass — are not started.

The delivery surface is one thing only: a banner on a `/family` page somebody has open. Nothing
reaches a device with no page open, and that is deliberate and recorded (spec Assumption 15 and the
divergence table). Every task below is either that banner, the choices that feed it, or the proof.

---

## Withdrawn after the push decision

These were done, committed, and then undone when Web Push left the phase. The numbers are the ones
this file carried at the time; the record says what happened rather than pretending it never did.

- ~~T003~~ **The four environment variables** — three VAPID and one shared secret. They only ever
  reached `.env.example`; the readers in `lib/family/env.ts` were drafted and held back, so the
  documentation was all there was to remove.
- ~~T004~~ **The `family:reminders` npm script** — deleted with the trigger it ran.
- ~~T005~~ **`scripts/family-reminders.mjs`** — the local trigger, deleted. There is nothing left to
  trigger: a browser with a clock needs no scan.
- ~~T009~~ **Migration `036_push_devices_and_deliveries.sql`** — deleted outright. It was never pushed
  hosted and the branch is unmerged, so the local stack simply resets onto `034`/`035`. There is no
  `038` drop migration and no down-migration to write, and this phase now adds no new table at all.
- ~~T010~~ **Migration `037_realtime_push_devices.sql`** — deleted with it. Nothing new joins the
  realtime publication now, so R817 has no subject left.
- ~~T012 (part)~~ **The `PushDevice` type** — removed from `lib/family/types.ts`. The five settings
  fields, `EventReminder`, `ReminderInForce` and `ReminderSubjectKind` all survive.
- ~~T013 (part)~~ **`PUSH_DEVICE_COLUMNS` / `toPushDevice`** — removed from `lib/family/rows.ts`.
  `SETTINGS_COLUMNS` and `toSettings` keep the five.
- ~~T014 (part)~~ **The two push-device input schemas** — removed from `lib/family/validation.ts`.
- ~~T019/T020~~ **`window.ts` and its test** — deleted. The run window was the scan's memory of its
  last run, and a browser has a clock and no such memory. The one rule worth keeping — a reminder more
  than fifteen minutes past is not worth showing — moved into `due.ts` as `isCurrent`, with its tests,
  where its only caller is.
- ~~T028 (part)~~ **The policies test's `036` half** — removed. It now pins `034` and `035` only.
- ~~T057~~ **`push-devices.test.ts` (policies)** — written early with `036` and deleted with it. It
  carried SC-815's anonymous-is-refused proof, which is why that proof is a fresh task below (T019).
- ~~T001~~ / ~~T006~~ — never started, and now never will be: the `web-push` dependency was
  deliberately deferred until the sender that imported it, and the operator's `pg_cron`/`pg_net`
  verification was blocking a scheduler that does not exist.

Two things narrowed rather than died. The `family-notifications-core` fallow zone stays, but
`family-actions` and `api-routes` no longer name it — no action writes a reminder and there are no
route handlers. And the household's five choices are tested at the end of `message.test.ts` rather
than in a `settings.test.ts` of their own, which is where they were actually written.

---

## Phase 1: Setup

One line: the feature adds no dependency, no environment variable, no script and no table, so the
only thing to set up is the boundary the pure logic lives behind.

- [x] T001 Add the `family-notifications-core` zone (`lib/family/notifications/**`) and its rule
  (`allow: ["family-notifications-core", "family-recurrence", "family-calendar-core",
  "family-tasks-core", "lib"]`) to `.fallowrc.json`, and let `components`, `ui-pages` and `tests`
  import it

## Phase 2: Foundational — the schema, the types, and the one pure function

**Blocking**: US2, US3 and US4 all read the due-computation. Nothing below Phase 2 starts until this
phase is green.

### The migrations

- [x] T002 Write `supabase/migrations/034_notification_settings.sql` — five columns on
  `family.household_settings` with FR-807's defaults and the `1…10080` bound (data-model §034)
- [x] T003 Write `supabase/migrations/035_event_reminders.sql` — the three reminder columns on
  `family.events` (not null, default `inherit`) and on `family.event_exceptions` (nullable, null =
  inherit from the series), each with its `events_reminder_payload` check (data-model §035)
- [x] T004 Run `supabase db reset` locally and confirm both apply clean on top of `001`–`033`

### The types and the row mappers

- [x] T005 [P] Extend `lib/family/types.ts` — `HouseholdSettings` and its patch gain the five fields;
  add `EventReminder`, `ReminderInForce` and `ReminderSubjectKind`
- [x] T006 [P] Extend `lib/family/rows.ts` — `SETTINGS_COLUMNS` and `toSettings` gain the five
- [x] T007 [P] Extend `lib/family/validation.ts` — the five fields on `settingsPatchSchema`. The event
  `reminder` union was written with them and held back: an unused export is a fallow finding and every
  commit here is green, so it arrives in Phase 5 with the action that writes it (T037)

### The pure due-computation — test first, every one

- [x] T008 [P] Test `lib/family/__tests__/notifications/resolve.test.ts` — the household default alone;
  `inherit`, `none` and `custom` on an event; an exception overriding its series; a default change
  moving inheriting events and not overridden ones (FR-808, FR-809)
- [x] T009 Implement `lib/family/notifications/resolve.ts` — settings + event + exception → the
  reminder in force
- [x] T010 [P] Test `lib/family/__tests__/notifications/identity.test.ts` — the key for each subject
  kind; a moved event yields a different key; the same occurrence at the same instant yields the same
  key. The key is one browser's memory of what it has already put on screen, and the only definition
  of "the same reminder" the feature has (R808)
- [x] T011 Implement `lib/family/notifications/identity.ts`
- [x] T012 [P] Test `lib/family/__tests__/notifications/due.test.ts` — the big one. At-time and before,
  both together, an all-day event reminding from the start of its day, a repeating event's several
  occurrences, a skipped occurrence showing nothing, **a DST boundary**, midnight in the household's
  zone, a reminder whose moment was already past when the event was created, and `isCurrent`'s
  fifteen-minute staleness clamp (FR-812, FR-813, FR-817, FR-821, FR-829, SC-814)
- [x] T013 Implement `lib/family/notifications/due.ts` — the single function the banner calls, holding
  the staleness clamp beside its only caller (R802)
- [x] T014 [P] Test `lib/family/__tests__/notifications/message.test.ts` — the words for each kind,
  including the completion's "Cleo finished Practice piano" shape (FR-819), and the household's
  defaults with the seven-day ceiling refusing `10081` (FR-807)
- [x] T015 Implement `lib/family/notifications/message.ts`
- [x] T016 Implement `lib/family/notifications/settings.ts`

**Checkpoint**: `npm test`, `npm run typecheck`, `npm run lint`, `npm run fallow:audit` all green. The
engine is correct before anything renders it.

---

## Phase 3: User Story 1 — The household decides what reminds it (P1)

**Goal**: Settings → Notifications, two groups, four choices, parent-only, and a plain line saying
where a reminder will actually appear.
**Independent test**: change each setting, reload, see it kept; punch in as Cleo and find it read-only.

- [x] T017 [US1] Extend `SETTINGS_FIELDS` in `lib/family/actions/settings.ts` with the five
  field→column entries (contracts §updateHouseholdSettings)
- [x] T018 [P] [US1] Test `lib/family/__tests__/policies/notifications-schema.test.ts` — `034` and
  `035` pinned at the store: FR-807's defaults from the schema and not a seed, the `1…10080` bound,
  the three modes and no fourth, a `custom` carrying neither half refused, and the same on
  `event_exceptions` where null means inherit
- [x] T019 [P] [US1] Extend that file with SC-815's access half — an anonymous reader of the five
  settings columns and the six reminder columns gets a refusal, not an empty result. Data-model §The
  privilege delta is explicit that there is no new policy to write, so this proves the inherited one
  actually covers the new columns
- [x] T020 [P] [US1] Test
  `app/family/(app)/components/settings/__tests__/NotificationsSection.test.tsx` — the four labelled
  controls, the defaults, a member seeing them disabled with a reason, and the line telling the
  household that reminders appear on the screens that are open (spec Assumption 15)
- [x] T021 [US1] Build `app/family/(app)/components/settings/NotificationsSection.tsx` — two groups,
  four controls, the shipped switch component, `requireParent` reflected in the UI, and that one plain
  sentence about where reminders appear. It is a product statement, not a footnote: a household that
  is not told will assume its phones buzz (FR-802–FR-805)
- [x] T022 [P] [US1] Test `app/family/(app)/components/settings/__tests__/LeadTimeField.test.tsx` — the
  three presets, custom with each unit, and `8 days` refused with a field error (FR-806)
- [x] T023 [US1] Build `app/family/(app)/components/settings/LeadTimeField.tsx`, storing minutes
  whatever unit is shown (R810)
- [x] T024 [US1] Mount the section in `app/family/(app)/components/settings/SettingsScreen.tsx`

**Checkpoint**: US1 works alone and is shippable.

---

## Phase 4: User Story 2 — The wall says so when the moment comes (P2)

**Goal**: the banner, on any open page, from a small query of its own.
**Independent test**: with a reminder set, watch the banner arrive at the right minute, dismiss it,
and confirm an old reminder never appears.

The banner mounts in the app shell, so it is on screen on the Lists and Meals tabs where the
calendar's data is not loaded at all — and a lead time of up to seven days can be owed for an event
outside any window a tab would fetch. So the banner owns a **small dedicated query**: the household's
events and timed chore occurrences over the reminder horizon, whichever tab is showing. It is still
one pure due-computation with one reader; only where that reader gets its data has changed (R802).

### The device's own choices

- [x] T025 [P] [US2] Test
  `app/family/(app)/components/notifications/__tests__/reminderSwitches.test.ts` — the defaults (banner
  on, chime off), persistence, and storage refusing without crashing (§VI). No browser permission is
  involved anywhere: both switches are `localStorage` on this device and nothing else (FR-815)
- [x] T026 [US2] Build `app/family/(app)/components/notifications/reminderSwitches.ts` on
  `createDeviceSwitches` (R813)

### The banner's own data

- [x] T027 [P] [US2] Test the horizon query — the window it asks for spans the longest lead time the
  household can set; it is keyed independently of the calendar's displayed window, so a tab change
  neither refetches it nor drops it; and it adds no read to any other tab's path (FR-832)
- [x] T028 [US2] Add `familyKeys.reminderHorizon` and `useReminderHorizon` to `lib/family/queries.ts`,
  naming its columns as every read there does. The board's task reads are already household-wide and
  keyed by household alone, so they are reused rather than duplicated

### The banner

- [x] T029 [P] [US2] Test
  `app/family/(app)/components/notifications/__tests__/useDueReminders.test.ts` — a fake clock crossing
  the moment; a key already shown not returning; a reminder fifteen minutes stale never shown; midnight
  rollover (FR-816, FR-817, FR-829)
- [x] T030 [US2] Build `app/family/(app)/components/notifications/useDueReminders.ts` — `useNow()` +
  `due.ts` + a shown-key `Set` on `createDeviceKeySet` (R808, R813). "Shown once" is a per-device
  convention, and the two places it gives way are to be stated where the guarantee is, not hidden:
  clearing site data, a private window or a second browser profile can re-show a reminder that is still
  inside its freshness window, and two tabs each show their own banner
- [x] T031 [P] [US2] Test
  `app/family/(app)/components/notifications/__tests__/ReminderBanner.test.tsx` — several items in one
  banner; dismissible by keyboard; a live region that does not steal focus; nothing rendered when the
  switch is off (FR-814–FR-816, §III)
- [x] T032 [US2] Build `app/family/(app)/components/notifications/ReminderBanner.tsx`
- [x] T033 [US2] Build `app/family/(app)/components/notifications/chime.ts` — one tone from
  `public/family/`, primed by the switch's own gesture; a device that refuses is a silent banner, not
  an error (R813)
- [x] T034 [US2] Mount the banner once in `app/family/(app)/components/AppShell.tsx` so every tab has
  it, and add the two switches to the Notifications section (FR-815)

### Reaching the day it belongs to (R815)

- [x] T035 [P] [US2] Test that the calendar seeds its anchor from `?on=YYYY-MM-DD` once on mount,
  ignores an unparseable value, and is never read again
- [x] T036 [US2] Implement the parameter in the calendar screen. Tapping a banner opens the day the
  reminder belongs to, and a banner shown on the Lists tab has to be able to cross into the calendar to
  do it — which needs a date in the URL, because `/family` has none anywhere else

**Checkpoint**: the whole delivery surface works end to end, with no server involvement at all.

---

## Phase 5: User Story 3 — This one event is different (P3)

**Goal**: a per-event reminder under the three shipped scopes.
**Independent test**: give one event its own reminder and another silence; change the household
default; both keep what they were given.

- [ ] T037 [P] [US3] Test `lib/family/__tests__/actions/event-reminders.test.ts` — an empty `custom`
  refused; each of the three scopes writing where data-model §035 says (FR-808, FR-810)
- [ ] T038 [US3] Extend `lib/family/actions/events.ts` — the `reminder` field through `createEvent` and
  `updateEvent`, riding the existing scope machinery, and bring `eventReminderSchema` into
  `lib/family/validation.ts` with it (held back from T007 for the green-commit reason)
- [ ] T039 [P] [US3] Test
  `app/family/(app)/calendar/components/__tests__/EventForm.reminder.test.tsx` — the three states, and
  the scope dialog appearing for a repeating event
- [ ] T040 [US3] Extend `app/family/(app)/calendar/components/EventForm.tsx` with the reminder control
- [ ] T041 [US3] Show the reminder in the event's details view (FR-811)

---

## Phase 6: User Story 4 — A chore that is due, and one that is done (P4)

**Goal**: When Due for timed chores only; When Completed naming who finished what.
**Independent test**: a timed chore reminds at its time, an anytime chore and a routine never do, and
a late chore reminds once in total.

### When Due

- [ ] T042 [P] [US4] Test `lib/family/__tests__/notifications/task-due.test.ts` — the
  `routine = false and due_time is not null` predicate; an anytime chore, a routine and an all-day
  chore each showing nothing; a carried-forward chore reminding once (FR-818, R812)
- [ ] T043 [US4] Extend `lib/family/notifications/due.ts` with the task-due source

### When Completed, derived on the page that is open

`family.task_resolutions` is already on the realtime publication and already carries `status`,
`resolved_at`, `occurrence_date` and the credited Profile, so an open page learns of a completion
through the channel it already has. Nothing is written server-side for it.

- [ ] T044 [P] [US4] Test that a completion's key is the **resolution row's own identity**, not
  `(task, date)` — a routine can be completed in two slots on one day, and an Anytime chore has no
  date at all, so keying on the pair would swallow the second announcement and lose the Anytime one
  entirely (FR-819)
- [ ] T045 [US4] Change `task_done`'s key in `lib/family/notifications/identity.ts` accordingly. It
  currently keys on the subject and the occurrence date, which was right when a database row claimed
  each reminder and is wrong now that a browser's `Set` is the only arbiter (R808)
- [ ] T046 [P] [US4] Test
  `app/family/(app)/components/notifications/__tests__/useCompletionNotices.test.ts` — an announcement
  only while `notifyTaskCompleted` is on; nothing for a skip or an un-tick; nothing twice for a re-tick;
  and **nothing at all on the device that performed the tick**, which is looking at the card that just
  flipped
- [ ] T047 [US4] Build `app/family/(app)/components/notifications/useCompletionNotices.ts`, feeding the
  same banner. It reads the refreshed resolutions rather than the realtime payload, because
  `useFamilyRealtime` treats payloads as a signal to refetch and never renders them
- [ ] T048 [P] [US4] Test that nothing at all is announced for a star, a redemption, a streak or a
  finished week (FR-820, SC-810)

### Nothing for what is no longer there

This belongs to no single story: it is a property of the one due-computation, and it is the part of
the old trustworthiness story that still means something without a delivery ledger.

- [ ] T049 [P] Test that a deleted event, a skipped occurrence and a moved event each show nothing at
  the old moment — the moved one shows at its new moment instead, on its new key (FR-821, SC-813)

---

## Phase 7: Polish, gates and the browser pass

- [ ] T050 [P] Add `e2e/specs/notifications.spec.ts` — Settings and its defaults, a member finding it
  read-only, the per-event override at each scope, the banner at a pinned clock, dismissal, and **two
  tabs each showing their own banner**, which is the honest degradation rather than a defect (R816)
- [ ] T051 [P] Extend `e2e/helpers/` with whatever the new journeys need, following `harness.md` §3's
  rules on what each helper may know
- [ ] T052 Run `npm run test:e2e` in full and fix what it proves broken, application-side, each with a
  unit test (harness.md §6)
- [ ] T053 [P] Accessibility pass on the banner and the Notifications section — serious and critical
  clean, 44px targets, contrast (§III)
- [ ] T054 Run all four gates: `npm run fallow:audit`, `npm test`, `npm run typecheck`, `npm run lint`.
  No suppressions; split anything over budget
- [ ] T055 [P] Read the whole diff for anything left of the dropped design — a stray environment
  reader, a service worker registration, a comment that still promises a phone will buzz. The feature
  should read as though push was never in scope
- [ ] T056 [P] Update `CLAUDE.md`'s active-feature block to `008-family-notifications` with its reading
  order
- [ ] T057 Write `checklists/quickstart-run.md` — the run record: every criterion, and what was seen
- [ ] T058 Hosted `supabase db push` (`034`–`035`) **before** the merge (R818). The ordering is weaker
  than it was but still real: `SETTINGS_COLUMNS` and `EVENT_COLUMNS` name the new columns, so a
  deployment against a database without them fails the settings and calendar reads

---

## Dependencies

```
Phase 1 Setup  (the fallow zone)
   └─> Phase 2 Foundational  (two migrations + types + the pure due-computation)
          ├─> Phase 3  US1 settings   (independent once Phase 2 is done)
          ├─> Phase 4  US2 banner     (needs due.ts and its own query; wants US1 for settings to read)
          ├─> Phase 5  US3 override   (needs resolve.ts; independent of US2)
          └─> Phase 6  US4 tasks      (needs due.ts; its completion half needs US2's banner)
                 └─> Phase 7 Polish
```

**The one cross-story dependency worth naming**: US4's completion notices have nowhere to appear until
US2 mounts the banner — there is no second surface to fall back on. Build the When Due half
(T042–T043) alongside anything, and leave T046–T047 until Phase 4 is on screen.

## Parallel opportunities

- **Phase 2**: T005–T007 together; then every `[P]` test task (T008, T010, T012, T014) can be written
  at once, since each is a different file and none depends on another's implementation.
- **Phases 3–6**: US1, US3 and US4's When Due half touch different files and can proceed in parallel
  once Phase 2 is green. US2 wants US1 finished so it has settings to read.
- **Phase 4**: the device switches (T025–T026), the horizon query (T027–T028) and the `?on=` parameter
  (T035–T036) are three independent pieces that meet at the banner.

## Suggested MVP

**Phases 1–4**: the household chooses, and every open screen says so. That is now most of the feature
rather than the first slice of it, because the banner is the whole delivery surface — no new
infrastructure, no third party, and no operator step beyond a migration push. What follows extends the
same engine: one event's own reminder, and the two chore notifications.

## Task count

| Phase | Tasks |
|---|---|
| 1 Setup | 1 |
| 2 Foundational | 15 |
| 3 US1 settings | 8 |
| 4 US2 banner | 12 |
| 5 US3 override | 5 |
| 6 US4 tasks | 8 |
| 7 Polish | 9 |
| **Total** | **58** |
