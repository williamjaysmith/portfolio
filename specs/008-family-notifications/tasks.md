# Tasks: Family Notifications

**Feature**: `008-family-notifications` | **Branch**: `008-family-notifications`
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/server-actions.md](./contracts/server-actions.md)

Constitution §II is non-negotiable, so **every pure-logic task is a test first**. A task that says
"test" writes a failing test; the task after it makes it pass. The gates run before every commit.

`[P]` = parallelisable (different files, no dependency on an incomplete task).

---

## Phase 1: Setup

- [ ] T001 Add `web-push` to `dependencies` and `@types/web-push` to `devDependencies` in `package.json`, then `npm install` (R805)
- [ ] T002 [P] Add the `family-notifications-core` zone (`lib/family/notifications/**`) and its rule (`allow: ["family-notifications-core", "lib"]`) to `.fallowrc.json`, and extend the `family-actions` and `components` rules to allow it
- [ ] T003 [P] Add the four environment variables to `lib/family/env.ts` with the project's existing loud-failure behaviour, keeping the private key server-only
- [ ] T004 [P] Add `"family:reminders": "node scripts/family-reminders.mjs"` to `package.json` scripts
- [ ] T005 [P] Create `scripts/family-reminders.mjs` — reads the secret from `.env.local`, posts to the run route, prints the counts it gets back (contracts §The local trigger)
- [ ] T006 Verify `pg_cron` and `pg_net` are available on the hosted project (quickstart §3 step 1) and record the answer in `checklists/quickstart-run.md`; if either is missing, stop and raise it

## Phase 2: Foundational — the schema, the types, and the one pure function

**Blocking**: US2, US4, US5 and US6 all read the due-computation. Nothing below Phase 2 starts until
this phase is green.

### The migrations

- [ ] T007 Write `supabase/migrations/034_notification_settings.sql` — five columns on `family.household_settings` with FR-807's defaults and the `1…10080` bound (data-model §034)
- [ ] T008 Write `supabase/migrations/035_event_reminders.sql` — the three reminder columns on `family.events` (not null, default `inherit`) and on `family.event_exceptions` (nullable, null = inherit from the series), each with its `events_reminder_payload` check (data-model §035)
- [ ] T009 Write `supabase/migrations/036_push_devices_and_deliveries.sql` — both tables, RLS (`is_member()` SELECT, service-role ALL), the two partial unique indexes, and the `touch_updated_at` trigger (data-model §036)
- [ ] T010 Write `supabase/migrations/037_realtime_push_devices.sql` — the `022`/`033` guard block verbatim over `push_devices` only, with the DEFAULT replica identity note (data-model §037, R817)
- [ ] T011 Run `supabase db reset` locally and confirm all four apply clean on top of `001`–`033`

### The types and the row mappers

- [ ] T012 [P] Extend `lib/family/types.ts` — `HouseholdSettings` and its patch gain the five fields; add `EventReminder`, `PushDevice`, `ReminderSubjectKind`
- [ ] T013 [P] Extend `lib/family/rows.ts` — `SETTINGS_COLUMNS` and `toSettings` gain the five; add `PUSH_DEVICE_COLUMNS`/`toPushDevice`, which **never** maps `endpoint`, `p256dh` or `auth` outward
- [ ] T014 [P] Extend `lib/family/validation.ts` — five fields on `settingsPatchSchema`, the `reminder` union on the event schemas, and the two push-device input schemas (contracts)

### The pure due-computation — test first, every one

- [ ] T015 [P] Test `lib/family/__tests__/notifications/resolve.test.ts` — the household default alone; `inherit`, `none` and `custom` on an event; an exception overriding its series; a default change moving inheriting events and not overridden ones (FR-808, FR-809)
- [ ] T016 Implement `lib/family/notifications/resolve.ts` — settings + event + exception → the reminder in force
- [ ] T017 [P] Test `lib/family/__tests__/notifications/identity.test.ts` — the key for each subject kind; a moved event yields a different key; the same occurrence at the same instant yields the same key (R808)
- [ ] T018 Implement `lib/family/notifications/identity.ts`
- [ ] T019 [P] Test `lib/family/__tests__/notifications/window.test.ts` — a normal minute; a one-hour gap clamped to fifteen minutes; a first-ever run; a clock that went backwards (FR-817, FR-829, R803)
- [ ] T020 Implement `lib/family/notifications/window.ts`
- [ ] T021 [P] Test `lib/family/__tests__/notifications/due.test.ts` — the big one. At-time and before, both together, an all-day event reminding from the start of its day, a repeating event's several occurrences, a skipped occurrence sending nothing, **a DST boundary**, midnight in the household's zone, and a reminder whose moment was already past when the event was created (FR-812, FR-813, FR-821, SC-814)
- [ ] T022 Implement `lib/family/notifications/due.ts` — the single function both readers call (R802)
- [ ] T023 [P] Test `lib/family/__tests__/notifications/message.test.ts` — the words for each kind, including the completion's "Cleo finished Practice piano" shape (FR-819)
- [ ] T024 Implement `lib/family/notifications/message.ts`
- [ ] T025 [P] Test `lib/family/__tests__/notifications/settings.test.ts` — the defaults, and the seven-day ceiling refusing `10081`
- [ ] T026 Implement `lib/family/notifications/settings.ts`

**Checkpoint**: `npm test`, `npm run typecheck`, `npm run lint`, `npm run fallow:audit` all green. The
engine is correct before anything renders it.

---

## Phase 3: User Story 1 — The household decides what reminds it (P1)

**Goal**: Settings → Notifications, two groups, four choices, parent-only.
**Independent test**: change each setting, reload, see it kept; punch in as Cleo and find it read-only.

- [ ] T027 [US1] Extend `SETTINGS_FIELDS` in `lib/family/actions/settings.ts` with the five field→column entries (contracts §updateHouseholdSettings)
- [ ] T028 [P] [US1] Test `lib/family/__tests__/policies/notification-settings.test.ts` — a member cannot write the five columns; anonymous is refused, not empty (SC-815)
- [ ] T029 [P] [US1] Test `app/family/(app)/components/settings/__tests__/NotificationsSection.test.tsx` — the four labelled controls, the defaults, a member seeing them disabled with a reason
- [ ] T030 [US1] Build `app/family/(app)/components/settings/NotificationsSection.tsx` — two groups, four controls, the shipped switch component, `requireParent` reflected in the UI (FR-802–FR-805)
- [ ] T031 [P] [US1] Test `app/family/(app)/components/settings/__tests__/LeadTimeField.test.tsx` — the three presets, custom with each unit, and `8 days` refused with a field error (FR-806)
- [ ] T032 [US1] Build `app/family/(app)/components/settings/LeadTimeField.tsx`, storing minutes whatever unit is shown (R810)
- [ ] T033 [US1] Mount the section in `app/family/(app)/components/settings/SettingsScreen.tsx`

**Checkpoint**: US1 works alone and is shippable.

---

## Phase 4: User Story 2 — The wall says so when the moment comes (P2)

**Goal**: the banner, from data the browser already holds. No server involvement (R802).
**Independent test**: with a reminder set, watch the banner arrive at the right minute, dismiss it,
and confirm an old reminder never appears.

- [ ] T034 [P] [US2] Test `app/family/(app)/components/notifications/__tests__/reminderSwitches.test.ts` — defaults (banner on, chime off), persistence, and storage refusing without crashing (§VI)
- [ ] T035 [US2] Build `app/family/(app)/components/notifications/reminderSwitches.ts` on `createDeviceSwitches` (R813)
- [ ] T036 [P] [US2] Test `app/family/(app)/components/notifications/__tests__/useDueReminders.test.ts` — a fake clock crossing the moment; dismissal not returning; a reminder fifteen minutes stale never shown; midnight rollover (FR-816, FR-817)
- [ ] T037 [US2] Build `app/family/(app)/components/notifications/useDueReminders.ts` — `useNow()` + `due.ts` + the dismissed set in `localStorage` via `readDeviceJson`/`writeDeviceJson`
- [ ] T038 [P] [US2] Test `app/family/(app)/components/notifications/__tests__/ReminderBanner.test.tsx` — several items in one banner; dismissible by keyboard; a live region that does not steal focus; nothing rendered when the switch is off (FR-814–FR-816, §III)
- [ ] T039 [US2] Build `app/family/(app)/components/notifications/ReminderBanner.tsx`
- [ ] T040 [US2] Build `app/family/(app)/components/notifications/chime.ts` — one tone from `public/family/`, primed by the switch's own gesture, silent failure is not an error (R813)
- [ ] T041 [US2] Mount the banner once in the app shell so every tab has it, and add the two switches to the Notifications section (FR-815)

**Checkpoint**: the wall display works end to end with no server at all.

---

## Phase 5: User Story 3 — This one event is different (P3)

**Goal**: a per-event reminder under the three shipped scopes.
**Independent test**: give one event its own reminder and another silence; change the household
default; both keep what they were given.

- [ ] T042 [P] [US3] Test `lib/family/__tests__/actions/event-reminders.test.ts` — an empty `custom` refused; each of the three scopes writing where data-model §035 says (FR-808, FR-810)
- [ ] T043 [US3] Extend `lib/family/actions/events.ts` — the `reminder` field through `createEvent` and `updateEvent`, riding the existing scope machinery
- [ ] T044 [P] [US3] Test `app/family/(app)/calendar/components/__tests__/EventForm.reminder.test.tsx` — the three states, and the scope dialog appearing for a repeating event
- [ ] T045 [US3] Extend `app/family/(app)/calendar/components/EventForm.tsx` with the reminder control
- [ ] T046 [US3] Show the reminder in the event's details view (FR-811)

---

## Phase 6: User Story 4 — A chore that is due, and one that is done (P4)

**Goal**: When Due for timed chores only; When Completed naming who finished what.
**Independent test**: a timed chore reminds at its time, an anytime chore and a routine never do, and
a late chore reminds once in total.

- [ ] T047 [P] [US4] Test `lib/family/__tests__/notifications/task-due.test.ts` — the `routine = false and due_time is not null` predicate; an anytime chore, a routine and an all-day chore each sending nothing; a carried-forward chore reminding once (FR-818, R812)
- [ ] T048 [US4] Extend `lib/family/notifications/due.ts` with the task-due source
- [ ] T049 [P] [US4] Test `lib/family/__tests__/actions/task-completion-notice.test.ts` — a row written only when the setting is on; nothing on a skip or an un-tick; a re-tick conflicting rather than announcing twice (FR-819)
- [ ] T050 [US4] Extend `lib/family/actions/tasks.ts` — the `reminder_deliveries` insert inside the completion's own transaction, `dispatched_at` null (R811)
- [ ] T051 [US4] Send it from `after()` once the response has gone, reusing the one sender (R811)
- [ ] T052 [P] [US4] Test that nothing at all is written for a star, a redemption, a streak or a finished week (FR-820, SC-810)

---

## Phase 7: User Story 5 — The phone in a pocket (P5)

**Goal**: a device that asked receives a reminder with every tab closed, and acting on it lands on the
right day.
**Independent test**: turn the switch on, close every tab, trigger a scan, act on the notification.

### Reaching the day (R815)

- [ ] T053 [P] [US5] Test that the calendar seeds its anchor from `?on=YYYY-MM-DD` once on mount, ignores an unparseable value, and is never read again
- [ ] T054 [US5] Implement the parameter in the calendar screen

### The subscription

- [ ] T055 [P] [US5] Test `lib/family/__tests__/actions/push-devices.test.ts` — register requires a punch-in; remove requires a parent; re-registering an endpoint updates rather than duplicates; no credential is returned (contracts)
- [ ] T056 [US5] Build `lib/family/actions/push-devices.ts`
- [ ] T057 [P] [US5] Test `lib/family/__tests__/policies/push-devices.test.ts` — anonymous refused; another household sees zero rows (SC-815)
- [ ] T058 [P] [US5] Test `app/family/(app)/components/settings/__tests__/DeviceList.test.tsx` — the list, the empty state, removing one, and a member unable to remove (FR-827)
- [ ] T059 [US5] Build `app/family/(app)/components/settings/DeviceList.tsx`
- [ ] T060 [US5] Build the subscribe control — asks the browser's permission, reflects what was actually answered, and says plainly when `/family` must be installed to the Home Screen first (FR-823, R820)

### The worker and the sender

- [ ] T061 [US5] Write `public/family/sw.js` — `push` always shows a notification, fetches `/api/family/reminders/pending`, falls back to a contentless one, and handles `notificationclick`; **no `fetch` handler** (R806, R814)
- [ ] T062 [P] [US5] Test `lib/family/__tests__/push/send.test.ts` — the transport is injected; which endpoints were addressed; a `410` prunes the row; another failure does not (R805, R806, FR-826)
- [ ] T063 [US5] Build `lib/family/push/send.ts` and `lib/family/push/devices.ts`

### The routes

- [ ] T064 [P] [US5] Test the run route's authorization — no header, wrong secret, and a length-mismatched secret all refused with an empty body and no work done (R804)
- [ ] T065 [US5] Build `app/api/family/reminders/run/route.ts` — the eight steps in contracts §POST run, Node runtime
- [ ] T066 [P] [US5] Test the pending route — no session refused; another household's rows never returned; only the last fifteen minutes (R819)
- [ ] T067 [US5] Build `app/api/family/reminders/pending/route.ts`

---

## Phase 8: User Story 6 — Once, in time, and only if it is still true (P6)

**Goal**: prove the engine is trustworthy by forcing each failure.

- [ ] T068 [P] [US6] Test the claim — two overlapping runs over the same moment produce one delivery (FR-828, R807)
- [ ] T069 [P] [US6] Test that `dispatched_at` is stamped before the fan-out, so a sweep never resends a partially-delivered reminder (FR-831)
- [ ] T070 [P] [US6] Test that a deleted event, a skipped occurrence and a moved event each send nothing at the old moment (FR-821, SC-813)
- [ ] T071 [P] [US6] Test the thirty-day retention delete (R808)
- [ ] T072 [US6] Run the local scan twice in a row and after a deliberate hour-long gap; record both in `checklists/quickstart-run.md` (SC-804, SC-805)

---

## Phase 9: Polish, gates and the browser pass

- [ ] T073 [P] Add `e2e/specs/notifications.spec.ts` — Settings and its defaults, a member finding it read-only, the per-event override at each scope, the banner at a pinned clock, dismissal, and **the push switch reflecting a refused permission** (R816)
- [ ] T074 [P] Extend `e2e/helpers/` with whatever the new journeys need, following `harness.md` §3's rules on what each helper may know
- [ ] T075 Run `npm run test:e2e` in full and fix what it proves broken, application-side, each with a unit test (harness.md §6)
- [ ] T076 [P] Accessibility pass on the banner and the Notifications section — serious and critical clean, 44px targets, contrast (§III)
- [ ] T077 Run all four gates: `npm run fallow:audit`, `npm test`, `npm run typecheck`, `npm run lint`. No suppressions; split anything over budget
- [ ] T078 [P] Review the whole diff for key-shaped strings and for any address that is not the local stack's, as `007` did
- [ ] T079 [P] Update `CLAUDE.md`'s active-feature block to `008-family-notifications` with its reading order
- [ ] T080 Write `checklists/quickstart-run.md` — the run record: every criterion, what was seen, and what is left to the operator's hardware pass
- [ ] T081 Hosted `supabase db push` (034–037) **before** the merge (R818), then the operator's scheduler steps (quickstart §3 steps 4–5)

---

## Dependencies

```
Phase 1 Setup
   └─> Phase 2 Foundational  (migrations + types + the pure due-computation)
          ├─> Phase 3  US1 settings        (independent once Phase 2 is done)
          ├─> Phase 4  US2 banner          (needs due.ts; needs US1 for the settings to read)
          ├─> Phase 5  US3 override        (needs resolve.ts; independent of US2)
          ├─> Phase 6  US4 tasks           (needs due.ts)
          └─> Phase 7  US5 push            (needs due.ts, US1; T051 needs T063's sender)
                 └─> Phase 8  US6 trust    (needs the claim path from US5)
                        └─> Phase 9 Polish
```

**The one cross-story dependency worth naming**: T051 (send a completion from `after()`) needs the
sender built in T063. Build US4's row-writing first and leave the send until Phase 7, or accept that
completions are sent by the scan alone until then — both leave the repository green.

## Parallel opportunities

- **Phase 2**: T012–T014 together; then every `[P]` test task (T015, T017, T019, T021, T023, T025) can
  be written at once, since each is a different file and none depends on another's implementation.
- **Phase 3–6**: US1, US3 and US4 touch different files and can proceed in parallel once Phase 2 is
  green. US2 wants US1 finished so it has settings to read.
- **Phase 7**: the worker (T061), the sender (T062–T063) and the routes (T064–T067) are three
  independent pieces that meet at the end.

## Suggested MVP

**Phases 1–4**: the household chooses, and the wall display says so. That is a complete, useful,
shippable feature with no new infrastructure, no third party and no operator steps beyond a migration
push. Everything after it extends the same engine.

## Task count

| Phase | Tasks |
|---|---|
| 1 Setup | 6 |
| 2 Foundational | 20 |
| 3 US1 settings | 7 |
| 4 US2 banner | 8 |
| 5 US3 override | 5 |
| 6 US4 tasks | 6 |
| 7 US5 push | 15 |
| 8 US6 trust | 5 |
| 9 Polish | 9 |
| **Total** | **81** |
