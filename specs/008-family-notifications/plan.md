# Implementation Plan: Family Notifications

**Branch**: `008-family-notifications` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/008-family-notifications/spec.md`

## Summary

The household says what it wants to be reminded of; the screen that is open says so when the moment
comes; a phone that is nowhere near the screen hears about it too. Two shipped notification kinds come
with it — a chore is due, and a chore is done.

The shape of the build follows one decision, **R802**: there is a single pure function that answers
*"which reminders are due at this instant?"*, and two entirely independent readers of it. The browser
reads it to draw a banner, from data it already holds. A scheduled server run reads it to send pushes.
Neither knows about the other, they cannot disagree, and the wall display's most visible feature needs
no new infrastructure at all.

That leaves three things to actually build:

1. **The due-computation and its settings** — pure logic in `lib/family/notifications/**`, five columns
   on the settings table the household already has, three on events, and the same three on the
   exceptions table so a repeating event's reminder honours the three shipped scopes.
2. **The banner** — a client surface over `useNow()`, the shell's existing minute clock, with its
   per-device switches on `createDeviceSwitches` and its dismissals in `localStorage`. All three of
   those exist and are tested.
3. **The delivery engine** — the first route handler in this repository, called every minute by the
   database's own scheduler, claiming each reminder with a unique row before it sends so that "exactly
   once" is a constraint rather than an intention.

The one decision that changed the design is **R814**. Principle VII says the family's data does not
leave our infrastructure, and a push payload travels through Apple's or Google's servers. Rather than
argue that end-to-end encryption makes that acceptable, the push carries **nothing**: the service
worker fetches the words from us over the session it already has, and falls back to a contentless
notification if it cannot. The household's schedule never leaves the project at all.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16.1.6 App Router, React 19.1.0
**Primary Dependencies**: `@supabase/supabase-js` · `@supabase/ssr` · TanStack Query 5 · Zod 4 ·
Tailwind 4 · lucide-react · **`web-push` (new, production — R805)**
**Storage**: Supabase Postgres, `family` schema, RLS by `is_member()`; migrations `034`–`037`
**Scheduling**: `pg_cron` + `pg_net` on the hosted project → a route handler in this deployment (R803)
**Testing**: Vitest 4 (`unit`, jsdom) · policies tests (node, local stack) · Playwright (`007`)
**Target Platform**: a wall tablet, an iPad, phones; deployed on Vercel
**Project Type**: web — a sub-app inside the portfolio
**Performance Goals**: a banner within one minute of its moment (SC-802); the scan well inside a
one-minute cadence for a household of six profiles
**Constraints**: no suppressions; `maxCyclomatic: 20`, `maxCognitive: 15`; `lib` never imports
`app/**`; the hosted `db push` precedes merge (R818); no key-shaped string is ever committed
**Scale/Scope**: one household, six profiles, a handful of devices. Correctness over throughput.

## Constitution Check

*Gates evaluated before Phase 0. Re-checked after design.*

| Principle | Verdict | How |
|---|---|---|
| **I. Sub-apps self-contained** | PASS | Everything lands under `app/family/**`, `lib/family/**`, `supabase/`, plus one file in `public/family/`. No other sub-app is touched, and the service worker's scope is `/family/` precisely so it cannot be. |
| **II. Test-first for logic** | PASS | The due-computation, the window arithmetic, the three-state override resolution, the task predicate and the message wording are all pure and all get a failing test first. The banner's presentation and the push transport are the only untested-by-unit layers, and R816 says which covers what. |
| **III. Accessible and touch-first** | PASS | The banner is a live region that does not steal focus, dismissible by keyboard and by a 44px target. Settings reuses the shipped switch and field components. Colour carries nothing. |
| **IV. Layered, boundary-enforced** | PASS | A new `family-notifications-core` fallow zone for the pure logic, importing only `lib`. The `api-routes` zone already exists in `.fallowrc.json` and is used for the first time. |
| **V. Quality gates** | PASS | Four gates, no suppressions. The new pure modules are branchy, so they are the ones that need real coverage for CRAP — which is where the test-first discipline pays for itself. |
| **VI. Degrade gracefully** | PASS | Storage refused → switches work for the session and say so. Offline → the banner shows nothing rather than something stale (FR-816's sibling edge case). The worker's fetch fails → a contentless notification, never a wrong one. A dead push subscription is pruned, not retried. |
| **VII. Private by default** | **PASS, and it was the hardest one** | See below. |
| **VIII. Fidelity is specified** | PASS | Every requirement carries its evidence tag; fourteen article identifiers were verified against the dossiers, and the checklist records the one place a draft had promoted an `[UNKNOWN]` to a fact. |

### Principle VII, in full

§VII says: *"no child's name, photo, or schedule leaves the project's own infrastructure."* Web Push is
delivered by Apple, Google or Mozilla. The straightforward implementation would put "Cleo — Practice
piano is due at 5:00" into a payload that transits one of them.

RFC 8291 encrypts that payload end-to-end to the subscription's keys, and the relay sees only
ciphertext. That is a defensible reading of the principle. **We did not take it.** R814 makes the
payload contentless and has the service worker fetch the words from this app over the household's own
session, so the third party learns only that a push happened, to which endpoint, and when. Metadata,
not schedule.

Two further consequences, both deliberate:

- The **new route handlers filter by household explicitly**, under RLS, as §VII requires of every
  query — not implicitly via the session.
- The push switch is **per device and off by default**. A household that never turns it on has no
  subscription, no service worker, and no third party involved in any way.

### Re-check after Phase 1 design

Re-evaluated once the data model and contracts were written. No verdict changed. Two things were
tightened by the design work:

- **`reminder_deliveries` stays off the realtime publication** (R817). It is the engine's bookkeeping,
  never rendered, and would be the household's noisiest table. `push_devices` joins it, because FR-827
  puts that list on screen.
- **`dispatched_at` is stamped before the fan-out, not after** (R807). Stamping it afterwards would let
  the sweeper resend a reminder that had already reached some devices — the exact duplicate FR-831
  forbids. Marking first means the worst case is a miss, which is invisible, rather than a phone that
  buzzes twice, which is not.

### Complexity Tracking

No constitutional violation needs justifying. Two costs are accepted knowingly and recorded here so
they are reviewed rather than discovered:

| Cost | Why it is accepted | The cheaper thing that was rejected |
|---|---|---|
| **A production dependency (`web-push`)** | Message encryption's failure mode is silent undeliverability, which no mocked test catches. This is the one place in the project where the reference implementation beats our own. | Hand-rolling RFC 8291 against its published vectors — which proves the algorithm and not the integration (R805). |
| **A URL parameter on the calendar (`?on=`)** | FR-825 cannot be met without one: `/family` has no URL parameters at all today, so a notification can open the app but not the day. | Dropping FR-825 to "opens the app". That is a worse product for one line of parsing (R815). |

## Project Structure

### Documentation (this feature)

```
specs/008-family-notifications/
├── spec.md              # 32 requirements, 16 criteria, 14 assumptions, evidence-tagged
├── plan.md              # this file
├── research.md          # R801–R820
├── data-model.md        # migrations 034–037, invariants, the privilege delta
├── contracts/
│   └── server-actions.md    # two new actions, two extended, two route handlers
├── quickstart.md        # setup, the operator's scheduler steps, verification per criterion
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
│   ├── due.ts                        # THE pure function (R802): data + instant → reminders due
│   ├── window.ts                     # the run window, the fifteen-minute clamp (R803)
│   ├── identity.ts                   # a reminder's key (R808), shared by claim and dedup
│   └── message.ts                    # the words: "Swim lesson starts in 10 minutes"
├── push/                             # NEW — server-only
│   ├── send.ts                       # web-push behind an injectable transport (R805)
│   └── devices.ts                    # subscription rows, and pruning a 404/410 (R806)
├── actions/
│   ├── settings.ts                   # EXTENDED — five fields in SETTINGS_FIELDS (R810)
│   ├── events.ts                     # EXTENDED — the reminder in the patch, under the three scopes
│   ├── tasks.ts                      # EXTENDED — completion writes its notification row (R811)
│   └── push-devices.ts               # NEW — register (punched in), remove (parent)
├── rows.ts · types.ts · validation.ts   # EXTENDED — columns, types, Zod schemas

app/api/family/reminders/             # NEW — the first route handlers in this repository
├── run/route.ts                      # the scan; shared-secret auth (R804)
└── pending/route.ts                  # what the worker asks for; session auth (R819)

app/family/(app)/components/
├── notifications/                    # NEW
│   ├── ReminderBanner.tsx            # the surface (FR-814–FR-816)
│   ├── useDueReminders.ts            # useNow() + due.ts + the dismissed set
│   ├── reminderSwitches.ts           # createDeviceSwitches: banner, chime
│   └── chime.ts                      # one tone, primed by the switch's own gesture
└── settings/
    ├── NotificationsSection.tsx      # NEW — two groups, four choices (FR-802–FR-807)
    ├── LeadTimeField.tsx             # NEW — presets + custom with a unit (FR-806)
    └── DeviceList.tsx                # NEW — which devices receive, and removing one (FR-827)

app/family/(app)/calendar/components/
└── EventForm.tsx                     # EXTENDED — the event's own reminder (FR-808)

public/family/sw.js                   # NEW — push + notificationclick only; no fetch handler (R806)

supabase/migrations/
├── 034_notification_settings.sql
├── 035_event_reminders.sql
├── 036_push_devices_and_deliveries.sql
└── 037_realtime_push_devices.sql

scripts/family-reminders.mjs          # NEW — the local trigger; there is no pg_cron locally
e2e/specs/notifications.spec.ts       # NEW — the browser journeys R816 names
```

**Structure decision**: the pure logic goes in `lib/family/notifications/**` as its own fallow zone,
because both readers import it and neither may import the other. `lib/family/push/**` is separate and
server-only: it is the one place that talks to a third party, and keeping it out of the shared zone
means no client bundle can ever reach it.

## Implementation phasing

Each step leaves the repository green. The order is chosen so that the thing hardest to verify is
built on top of things already proved, not underneath them.

1. **Setup** — the fallow zone, the dependency, the migration skeletons, the types. Nothing behaves
   differently yet.
2. **The settings** (US1) — five columns, the action's five fields, the Settings section, the
   parent-only gate. Independently shippable and immediately visible.
3. **The due-computation** (foundation for US2–US5) — `resolve.ts`, `due.ts`, `window.ts`,
   `identity.ts`, `message.ts`, all test-first. No UI. This is where the phase's real difficulty is,
   and it is entirely pure.
4. **The banner** (US2) — the client surface over step 3. The wall display works end to end here, with
   no server involvement, which is worth having early.
5. **The per-event override** (US3) — three columns on two tables, the event form, and the three
   scopes riding Phase 2's existing scope machinery.
6. **Task notifications** (US4) — the `When Due` predicate on top of step 3, and the completion row
   written inside the completion's own transaction.
7. **Reaching a sleeping device** (US5) — the worker, the subscription actions, the two route
   handlers, the sender. Last, because it is the only part that cannot be fully proved locally.
8. **Trustworthiness** (US6) — the claim constraint, the sweep, the pruning, the retention. Written
   alongside step 7 and verified by forcing each failure.
9. **The gates and the browser pass** — the four gates, the new e2e journeys, the quickstart run
   record, then the hosted `db push` and the operator's scheduler steps.

## Risks

| Risk | Likelihood | What it costs | What we do |
|---|---|---|---|
| **`pg_cron` or `pg_net` is not enabled on the hosted project** | Low | The scan never runs; banners still work, pushes never arrive | The MCP could not read the extension list during planning (unauthorized), so this is **verified by the operator as the first quickstart step**, before anything depends on it. Both are standard on hosted Supabase. |
| **iOS refuses to subscribe because `/family` is not installed** | **High — this will happen** | The switch appears to do nothing on an iPhone | R820: the control says what is needed rather than failing silently, and the quickstart carries the Add-to-Home-Screen step. |
| **A reminder fires twice** | Low | The feature loses trust immediately | The unique claim (R807) is a database constraint, not code. The failure is forced deliberately in step 8 and recorded. |
| **A flood after downtime** | Medium | A wall tablet showing a morning's worth of banners | The fifteen-minute clamp (R803) is in the pure window logic and unit-tested, not in the scheduler. |
| **The worker's fetch fails and the browser shows its own message** | Medium | A confusing "site updated in the background" | The fallback notification is mandatory in the worker, not best-effort (R814). |
| **The push secret leaks into the repository** | Low | Anyone can trigger the household's phones | It is never written to a file in the repo; the quickstart sets it in Vercel and in a database setting. The pre-commit gates already run, and the run record's review checks for key-shaped strings, as `007` did. |
| **The calendar's new URL parameter fights the pager** | Low | The view jumps back on every render | It seeds the anchor once on mount and is never read again (R815). |

## Progress

- [x] Phase 0 — research complete (`research.md`, R801–R820)
- [x] Constitution Check — passed, with §VII resolved by design rather than by argument
- [ ] Phase 1 — data model, contracts, quickstart
- [ ] Phase 2 — tasks
- [ ] Implementation
