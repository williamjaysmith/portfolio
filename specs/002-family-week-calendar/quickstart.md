# Quickstart: Family Week Calendar

**Feature**: `002-family-week-calendar` | **Date**: 2026-09-02

Everything needed to go from a Phase 1 checkout to a working Week view, plus how to verify each
Phase 2 guarantee by hand and where each one is automated. Day-to-day development runs against the
**local** Supabase stack (§3); the hosted project needs a short set of **operator steps** (§4) —
this phase deliberately adds **no new Dashboard toggles**: one `db push`, one post-push check
(publication + the split RPC), one timezone seed.

---

## 1. Prerequisites

- **Phase 1 (`001-family-foundation`) is the platform.** Its local stack, seed script, sign-in,
  punch-in and test suites are all reused unchanged. If the *hosted* Phase 1 operator steps
  (001 `quickstart.md` §4: push 001–009, expose the `family` schema, seed the account, close the
  door) are still pending, do them first — or note that a single `supabase db push` now applies
  001–015 in one go, and the 001 §4 ordering rules still govern the auth steps.
- **No new dependencies.** The recurrence engine and the drag layer are hand-rolled in
  `lib/family/` (research decisions); `@dnd-kit` stays in colectivo, `framer-motion` is already
  installed. `npm install` after pulling the branch is routine, not structural.
- **No new services, buckets, providers, hooks or extensions.** Verified against the migration
  set: 010–015 create three tables, one settings column, three publication entries and one
  service-role-only RPC (`family.split_event_series`, the atomic `this_and_future` split —
  data-model 015), nothing else.

## 2. Environment

Phase 1's `.env.local` carries over verbatim. This phase adds **one optional variable**, read only
by the seed script:

| Variable | Value | Secret? |
|---|---|---|
| `FAMILY_SEED_TIMEZONE` | the household's IANA zone, e.g. `America/Chicago`. When unset the seed uses the machine's own zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) | no — but household-specific, so it lives in `.env.local`, never in committed SQL |

Nothing new goes to Vercel: no runtime code reads `FAMILY_SEED_TIMEZONE`; the app reads the zone
from `family.household_settings.timezone` like any other setting.

## 3. Local stack (day-to-day development)

Same port block as Phase 1 (`supabase/config.toml`): API **55321**, DB **55322**, Studio
**55323** — the CLI defaults 543xx belong to another project on this machine; leave it running.

```bash
supabase start                        # boots the stack on :553xx
supabase db reset                     # replays migrations 001–015
npm run family:seed -- --local        # dev account + fixture profiles/labels (Phase 1), and now:
                                      #   - writes household_settings.timezone (FAMILY_SEED_TIMEZONE
                                      #     or the machine zone) — FR-284
                                      #   - seeds the fixture WEEK (below), --local only
npm run dev:local                     # http://localhost:3000/family/calendar
```

**The seed gains two things this phase** (the schema plan implies the first; the verification
table below is why the second exists):

1. **The timezone write** (both modes). Migration 013 backfills `household_settings.timezone`
   with `'UTC'` — a deliberately *loud* placeholder (every event renders hours off). The seed
   replaces it with the real zone; re-running the seed is idempotent and re-applies it.
2. **A fixture week, `--local` only.** First it adds the spec's example household to the Phase 1
   fixture set (Alex/Sam/Kit/Holidays): profiles **Ana** (parent), **Ben** (parent), **Cleo**
   (child) and the Label **"Bin day"** — the names every spec scenario and every by-hand row below
   uses. Then the US1 render matrix, so the hand checks need no data entry first: a timed event; a
   three-day all-day event; a five-events-at-09:00 overlap cluster (exercises the FR-285 cap and
   "+n more"); a two-profile event (Cleo + Ana — the SC-213 keep-visible case); a label-only
   event on "Bin day"; an event with no categories; one midnight-crosser (Fri 22:00 → Sat 01:00);
   the weekly "Piano" repeat for Cleo (Tue 17:00–17:45, UNTIL mid-December) used by every scope
   check, carrying one saved this-occurrence override (SC-207's precondition); and a daily 02:30
   series with no end, so the DST dates always hold an occurrence to inspect. The **hosted** seed
   adds **no fixture events** — real data comes from the household; the hosted run gains only the
   timezone write.

`supabase db reset` is still the fastest way back to a clean state; re-run the seed afterwards.

## 4. Hosted project — operator steps

Everything here needs `SUPABASE_ACCESS_TOKEN` or the Dashboard. Expected total: **push, check,
seed** — there is no new Dashboard configuration in this phase.

1. **Push the schema**
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_...
   supabase link --project-ref zgmltllcyqylgtazunai
   supabase migration list              # see what the remote is missing
   supabase db push                     # applies 010–015 (001–009 too, if Phase 1 was never pushed)
   ```
   If Phase 1's push is happening in the same sitting, follow 001 §4's order for the auth steps —
   the calendar migrations themselves have no ordering constraints beyond coming after 001–009.
2. **Check the realtime publication** — not a toggle; migration 014 does the add itself, guarded,
   and this step only *verifies* it (FR-276, Assumption 39). In the SQL editor (or `psql`):
   ```sql
   select tablename from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'family';
   ```
   Expect Phase 1's tables **plus** `events`, `event_categories`, `event_exceptions`. If the
   publication did not exist at push time, 014 printed a NOTICE and skipped — re-run its block or
   add the three tables in **Database → Publications**. Also confirm replica identity was left at
   the default (no `replica identity full` anywhere): DELETE payloads must carry PKs only.
   While in the SQL editor, spot-check that 015's split RPC arrived with its grants intact:
   ```sql
   select p.proname,
          has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute,
          has_function_privilege('anon', p.oid, 'execute')         as anon_can_execute,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'family' and p.proname = 'split_event_series';
   ```
   Expect exactly one row: `service_role_can_execute = true`, the other two `false` — the same
   inventory the policies suite asserts against the local stack.
3. **Seed the timezone** — the one operator step that is not a push:
   ```bash
   FAMILY_SEED_TIMEZONE=America/Chicago npm run family:seed -- --yes
   ```
   or the one-line equivalent in the SQL editor:
   ```sql
   update family.household_settings set timezone = 'America/Chicago';
   ```
   Skipping this leaves `'UTC'` and every event renders shifted — obvious, by design (research:
   the placeholder fails loudly rather than plausibly).
4. **Nothing else.** `family` is already in Exposed schemas (a Phase 1 step; new tables in an
   exposed schema need nothing, and the `notify pgrst, 'reload schema'` in 014 and 015 makes the
   tables and the RPC visible without a restart). No new bucket, provider, auth hook, extension
   or cron entry.
5. Verify SC-203's anonymous probe (below), run SC-201 once at the wall, and spot-check SC-204
   with the iPad and a phone.

## 5. Run

```bash
npm run dev            # against the hosted project (needs §4)
npm run dev:local      # against the local stack (§3)
```

---

## Verifying the guarantees — by hand

Each success criterion, what must hold, and the by-hand check. The fixture week from §3 is assumed
locally; on the hosted project, create the named events first. "Zone" below means the household
timezone seeded in §4.3.

| Criterion | What must hold | Verify by hand |
|---|---|---|
| **SC-201** create in <30 s | Repeat event enterable at the wall, punch-in included | Stopwatch. From first touch: create control → punch in → "Piano", Tue 17:00, Cleo, every week → save. Under 30 s |
| **SC-202** legible without interaction | Every non-scrolled block readable, owner identifiable | At 1180×820 landscape, read the fixture week without touching: every title legible, every colour attributable (striped block included, title on a solid segment) |
| **SC-203** no stranger's data | Other-household reads return nothing on every path | (a) `curl` the REST endpoint for `events` with the publishable key and no session → `401`/`42501`. (b) The exhaustive per-path checks (events, links, exceptions, authed non-member `[]`) are the policy suite's job — run `npm run test:policies` |
| **SC-204** second device ≤5 s | A move appears on device B without reload | Two devices on the same week. Drag a block on A; watch B update within 5 s, untouched. Also reload A: the move survived |
| **SC-205** no anonymous writes | Every write path refused with nobody punched in | Punch out. Try create, edit, delete, and a drag-drop: each demands the punch-in sheet; dismiss it — nothing changed. The bypass case (calling the action from the console) is automated in the policies suite |
| **SC-206** one gesture, ≤2 prompts, ≤1 s | Scope prompt (repeats only) then punch-in, block placed within 1 s of the last answer | Drag a "Piano" occurrence while punched out: scope question **first**, punch-in second, block settles ≤1 s after the PIN. Drag a one-off while punched in: no prompt at all |
| **SC-207** the three scopes | Six checks: edit and delete × this / this-and-future / all | Use "Piano" (which has one saved this-occurrence override). For each of the six: note the occurrence set before, act, compare after — and check what became of the override. Expected outcomes are US2-7/8/9/10/19 and FR-286. Automated exhaustively in the policies suite; do at least edit-this and delete-this-and-future by hand |
| **SC-208** DST-stable repeats | Weekly 09:00 reads 09:00 on both sides of every change; no missing/duplicated occurrence | Arrow to the week containing the zone's next transition (America/Chicago: Sun 2026-11-01 fall-back; Sun 2027-03-14 spring-forward). The weekly fixture still reads its wall time; the daily 02:30 fixture appears exactly once on the spring-forward date, at 03:00. Set the *device* to another zone (DevTools → Sensors → Location/timezone, or a travelling phone) and confirm nothing shifts — the household zone governs. The year-long sweep is a unit test |
| **SC-209** responsive, 44-pt | No page-level horizontal scroll, no overlaps, all controls ≥44×44 at three widths | Load at 1180×820, 820×1180, 390×844. Page never scrolls sideways; inspect the smallest control at each width |
| **SC-210** nothing unreachable | 12 events/day scrollable; 5-way overlap reachable via "+n more" | Fixture overlap cluster: three drawn side by side (≥180-pt columns), "+2 more" opens and lists the rest. Add 12 events to one day: the column scrolls to all 12 |
| **SC-211** correct next morning | Today marker, now-line, week all advanced with no touch | Leave the tablet open overnight (or set the system clock to 23:58 Saturday and watch): at midnight the dot, the line and — on the week boundary — the whole grid roll over, no reload |
| **SC-212** delete asks, never undoes | Confirmation before every delete; no undo/restore/trash anywhere | Delete an event: confirmation appears. Then audit the calendar UI for any undo/trash affordance — there must be none |
| **SC-213** device-local filters | Hidden set filters this device only, survives reload, changes nothing stored | On the phone: hide Cleo and "Bin day" → their events vanish (a Cleo+Ana event stays); reload → still hidden; tablet unchanged; show-all → everything returns, data intact |
| **SC-214** category delete spares events | Events survive; confirmation counts them | Delete a label carried by fixture events. The confirmation states the affected-event count (FR-274); afterwards the events remain, neutral if nothing else colours them |
| **SC-215** this-occurrence edits persist | Override survives reload, shows on device B, siblings untouched | Edit one "Piano" occurrence's title at *this event*. Reload: still changed. Device B: changed within 5 s. Every other Tuesday: unchanged |

### Load-bearing FR spot-checks

The gestures and rules the criteria compress, checked individually:

| FR | Check |
|---|---|
| FR-208 now-line | Watch across a minute boundary: the orange bar moves without interaction, drawn over blocks, in today's column only |
| FR-210 pinned week | Arrow three weeks ahead, leave it open past midnight: the view **stays** on that week; only a view showing the current week rolls |
| FR-235/236 gap & fold | Spring-forward date: the daily 02:30 fixture renders once, at 03:00 (not 03:30, not twice). Fall-back date: a 01:30 event renders once, at the first pass |
| FR-246/247 snap & duration | Drop reading 09:07 → lands 09:00; 09:23 → 09:30. A moved 1-hour block is still 1 hour. Resize below one step stops at 15 min, never inverts |
| FR-248 punch-in on drop | Grab and carry a block with nobody punched in: no prompt until release on a valid slot |
| FR-249/250 cancel & order | Release a drag over the top bar: block returns, nothing written, no prompt. Drag a repeat occurrence: scope question comes **before** the punch-in sheet; dismiss either → block returns |
| FR-251 band conversion | Timed block into the all-day band → all-day that day, clock times gone. All-day pill onto 13:00 → timed 13:00–14:00 |
| FR-286/287 | Delete one occurrence at this-and-future: that date and everything later (overrides included) gone, earlier weeks intact. Change an occurrence's categories: the dialog offers only *this and future* and *all* |
| FR-288 refuse, never queue | Go offline (DevTools → Network → Offline), try a save: refused with a message, nothing stored, nothing queued. Delete an event on device B, then save an edit to it on A: refused "no longer exists", form closes |
| FR-289/279 phone slice | At 390×844, Sunday-start week: slices are Sun–Tue, Wed–Fri, then **Thu–Sat** (last slice pulled back). Swipe left = later, one slice per swipe; from Thu–Sat, left lands on next week's Sun–Tue. Today returns to the slice containing today |

## Automated checks — which suite covers what

```bash
npm test                 # both projects; policies auto-skips with a notice when :55321 is down
npm run test:unit        # pure logic + RTL component tests — no database
npm run test:policies    # RLS / privileges / actions against the local stack — a missing stack FAILS
npm run test:coverage    # Istanbul report for the fallow gate
```

| Guarantee | Where automated | Project |
|---|---|---|
| SC-208, FR-234/235/236, UNTIL inclusivity, monthly-31 skipping | golden DST tables in `lib/family/recurrence/` tests (`grammar`, `zone`, `expand`) — the year-long weekly sweep, gap/fold singletons, four stress zones | unit |
| SC-207, FR-286 exception semantics | scope actions against real rows (occurrence sets compared before/after, override fate asserted, incl. the shape-switching time-override upsert and split atomicity) | policies |
| SC-203, FR-273 | per-path RLS reads: `events`, `event_categories`, `event_exceptions`; authed non-member `[]`; anonymous `42501`; the privilege matrix extended **exactly** (any new `anon` grant fails) | policies |
| SC-205, FR-270/271/275 | every event action refused without an actor / with a tampered cookie; attribution columns set from the actor, never the payload | policies |
| FR-246/247/251, FR-217 grab math | snap tables, duration preservation, min-step clamp, band conversions in `week-geometry` tests | unit |
| FR-249/250/253, FR-238 | every reducer transition in `drag-state` tests: slop, all cancel paths write nothing, scope-before-punch-in, no scope on one-offs | unit |
| FR-210 anchor behaviour | `useWeekAnchor` with fake timers: derived rollover, pinned week untouched | unit |
| FR-285/218/217 geometry, FR-265 | `calendar/layout` clustering + cap + "+n more" grouping, min-height floor, midnight segmentation; `isEventVisible` truth table | unit |
| FR-289 slice tiling | `sliceStarts` tables (`[0,3,4]`, `[0,2]`, `[0]`) in `calendar/dates` tests | unit |
| FR-237/250 wording, FR-264, FR-262 | ScopeDialog (one component, same wording for edit/delete/drag), FilterSheet labels section, form field-level refusal — RTL | unit |
| Gesture feel, now-line motion, reduced motion, auto-scroll, edge-hold paging, install/rotation | **by hand** on the iPad and a phone (quality-bars: drag/visual layers are verified by running the app) | — |

## Quality gates

Unchanged from Phase 1 — all four before every commit, no suppressions ever
(`.claude/rules/quality-bars.md`): `npm run fallow:audit`, `npm test`, `npm run typecheck`,
`npm run lint`. The new recurrence, geometry and reducer modules are exactly the branchy-pure
shape the CRAP gate scores, which is why they are written test-first: run
`npm run test:coverage` once before invoking `fallow` directly, or the report is stale and
complexity findings appear that coverage would have quieted (001 quickstart §Quality gates has the
full mechanics).

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Every event renders hours off | `household_settings.timezone` is still the `'UTC'` backfill | §4.3 — run the seed or the one-line update |
| A delete never reaches the other device | The three calendar tables were subscribed **with** a `household_id` filter (DELETE payloads carry only PKs — Assumption 39), or 014's publication add was skipped | Subscriptions for `events`/`event_categories`/`event_exceptions` must be unfiltered; check `pg_publication_tables` (§4.2) |
| Insert fails the `rrule` CHECK | A rule arrived with the `RRULE:` prefix or a `COUNT=` part | Only the server emitter writes rule strings; clients send the structured repeat choice — a violation here is a code bug, not data entry |
| A repeat shifts an hour after a DST date | An expansion path worked in instants/device zone instead of the household zone (FR-234) | The only legal expander is the `lib/family/recurrence/` entry point; its golden tables catch this — check what bypassed it |
| A this-occurrence override detaches after an all-events time change | Exception key regression — the key is the occurrence's original **local date**, precisely so series-level time changes cannot orphan it | Check `event_exceptions.occurrence_date` handling in the action |
| Authed REST read of `events` returns `200` and `[]` for a non-member | **Expected** — RLS filtering; the policy suite asserts it | Nothing |
| Anonymous REST read returns `401`/`42501` | **Expected** — `anon` has no schema grant (SC-203) | Nothing |
| Drag commits without any prompt | **Expected** when the dragged event is a one-off and someone is already punched in (SC-206's fast path) | Nothing |
| "+n more" never appears | Column ≥180 pt shows three abreast; the fixture cluster needs ≥4 overlapping to collapse at that width | Check the viewport width band before suspecting the layout pass |
| Save refused with "no longer exists", form closed | **Expected** — FR-288: another device deleted the event | Nothing; nothing was recreated |
