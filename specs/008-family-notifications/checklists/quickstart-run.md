# Quickstart run record — 008 Family Notifications

**Run on**: 2026-09-07, local stack (this repository's, on 553xx), branch `008-family-notifications`
**By**: the implementing agent, against `specs/008-family-notifications/quickstart.md` §4

This is what was actually seen, criterion by criterion. Where something was not checked, it says so
and says who has to check it.

---

## The four gates

| Gate | Result |
|---|---|
| `npm run fallow:audit` | clean — no new findings against the baselines |
| `npm test` | 3547 passed, 232 files |
| `npm run typecheck` | zero errors |
| `npm run lint` | clean over `app/family` and `lib/family`; the 11 repo-wide errors are pre-existing in `/skyhammer`, `/colectivo` and the portfolio marketing components, fixed on their own branch (`fix-lint-react-19`) and unrelated to this phase |

## The browser pass

`npm run test:e2e -- e2e/specs/notifications.spec.ts` — **13 passed**, three times over. The journeys
live in `e2e/specs/notifications.spec.ts` and follow `specs/007-family-e2e/harness.md` §4's rules.

The full pass — `npm run test:e2e`, all four viewports — is **90 passed, 2 skipped, 2 failed**. The
two skips are the live-update journeys, which this local stack has never been able to deliver and
which print their reason (unchanged since Phase 5). **Neither failure is caused by this phase**, and
both were measured rather than assumed:

| Failing journey | On `main` | On this branch | Verdict |
|---|---|---|---|
| `tasks.spec` — hides skipped tasks on this device | **fails** | fails | Pre-existing. Not this phase's, and worth its own look: `007`'s run record claims 53 journeys green, so something regressed between then and now |
| `punch-in.spec` @responsive, tablet-landscape | 2 of 3 runs pass | 2 of 3 runs pass | Pre-existing flake, at the same rate on both sides |

An earlier full run showed **8** failures rather than 2. Six of those were the stack falling over, not
the code — see the section below. Every one of the six passes in isolation and passed on the rerun
against a healthy stack.

### What the flake did teach us

The punch-in journey types into a field the moment the page appears. Before this phase it failed about
one run in three; on this branch it started failing more often, and the screenshot showed the field
focused, empty, and complaining that an item is 1 to 200 characters — the typing had landed before
React took over, and hydration replaced it with the server's empty value.

The cause was ours: the reminder banner mounts in the app shell, so it was reading the whole reminder
horizon **during hydration, on every route**. It waits for `load` now (`useAfterLoad`). That took this
branch from 1-of-3 back to `main`'s 2-of-3 — it did not create the flake, but it was making it worse,
and a banner about something ten minutes away should never have been competing with first paint.

## Criterion by criterion

| Criterion | What was seen |
|---|---|
| **SC-801** four choices, two groups, the stated defaults | The e2e journey reads them off a freshly reset household: At time of event off, Before event on at 10 minutes, When Due on, When Completed off — from the schema's own defaults, not a seed |
| **SC-802** a banner within a minute of its moment | Pinned the browser clock 30 seconds past a reminder's moment; the banner named the event and its lead. Never earlier: asserted absent before the moment |
| **SC-803** one banner, not several | Unit-tested (`due.test.ts`): two events in one minute produce two reminders in one set, and `ReminderBanner.test.tsx` renders them as a single `status` region naming each |
| **SC-804** shown once per device | Dismissed, then advanced a further minute inside the same freshness window: gone for good |
| **SC-805** nothing older than fifteen minutes | Unit-tested at the boundary in both directions (`isCurrent` at exactly `MAX_STALENESS_MS` and one millisecond past), and a device asleep for three hours shows nothing |
| **SC-806** an override survives a default change | Unit-tested in `resolve.test.ts`; the e2e journey keeps one event's own lead time and another's silence across a reload |
| **SC-807** the three scopes | Both layers. `event-reminder-scopes.test.ts` drives the real action against a real database and reads the rows back; the e2e journey asks the scope question on a repeating event and checks the occurrence before and after the changed one |
| **SC-808** timed chores only, and once | Unit-tested: an anytime chore, an all-day chore and a routine each produce nothing; a carried-forward chore keeps its own due instant, so the staleness rule drops it — "once, not once a day" with no special case |
| **SC-809** a completion within a minute | Unit-tested (`tasks.test.ts`). Derived from the resolution row an open page already holds |
| **SC-810** silence about stars | Unit-tested explicitly, so that adding a star notification later is a deliberate act rather than a slip |
| **SC-813** deleted, skipped, moved | Unit-tested: each shows nothing at the old moment, and the moved one shows at its new one |
| **SC-814** the decisions are unit-tested | 75 tests over `lib/family/notifications/**`, including a DST boundary where a weekly series holds 07:50 on the wall clock across 1 November while its UTC instant moves an hour, and midnight in the household's zone |
| **SC-815** anonymous gets a refusal | `npm run test:policies` — an anonymous reader gets `42501`, not an empty result, on all eleven new columns |
| **SC-816** nothing else broke | The full suite, and the shipped `007` journeys |

## What this run found

**One application defect, fixed with the journey that proved it.** `DetailRow` rendered its label and
its value as two unrelated pieces of text, so the reminder row could not be found by role and name and
the e2e helper had reached for an XPath sibling selector. `007`'s harness is explicit that this is an
application defect rather than a test problem. The value is now a `group` labelled by its caption; the
helper queries it by name. It improves every details sheet in the app, the task's as well as the
event's.

**One bug the scope test found before any browser did.** `split_event_series` predates the reminder
columns, so every `this_and_future` split silently reset the new tail's reminder to `inherit` —
losing both an explicit change at that scope and the head's own setting. Migration `038` repairs the
function. Found by running the test against a real database rather than a mock.

## One thing about running it, learned the hard way

Three consecutive `supabase db reset` calls left the local stack with only its **database** container
up — every other service (kong, auth, rest, storage, realtime) stopped, without the CLI reporting it
as an error. The symptoms were confusing and looked like test failures: first a
`DatabaseSchemaMismatch` from storage, then `family-seed failed: read household: TypeError: fetch
failed`. Neither is a defect in this feature or in the journeys.

`supabase status` names the stopped services, and `curl http://127.0.0.1:55321/rest/v1/` answering
`000` rather than `200` is the quickest confirmation. The fix is `supabase stop && supabase start`.
Worth knowing before someone spends an hour reading a passing test suite looking for a bug in it.

## What is NOT covered, and who has to

- **The chime.** Synthesised from an oscillator and unreachable from a headless browser. Its switch is
  covered; the sound itself is a hardware check.
- **Two real devices.** The two-tab journey covers what one browser can prove. A second *profile*
  showing a reminder again from a clean slate is FR-816's stated limit and is left to the hardware
  pass, along with the two-device realtime check outstanding since Phase 5.
- **A wall tablet left overnight.** SC-805 is unit-tested at the boundary, but "opened in the morning
  and showed nothing" is a thing to see once on the real device.
- **The hosted project.** Migrations `034`, `035` and `038` are applied locally only. They must be
  pushed before this branch merges (R818): `SETTINGS_COLUMNS` and `EVENT_COLUMNS` name the new
  columns, so a deployment against a database without them fails its settings and calendar reads.

## The operator's remaining steps

1. `supabase db push` against the hosted project — `034`, `035`, `038`.
2. Merge and deploy.
3. The hardware pass above, on a real tablet and a real phone.
