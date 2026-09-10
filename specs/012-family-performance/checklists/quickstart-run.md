# Phase 012 run record — what the household waits for

**Branch**: `012-family-performance` (on top of `011-family-calendar-views`)
**Commits**: `c34ef2e`, `78ee252`
**Date**: 2026-09-09

## The harness

Every "after" number below was taken on a **production build** (`next build`, served by
`next start`) pointed at the **local Supabase stack** — never the hosted project. Development-mode
numbers were discarded early: the operator's complaint is specifically that production feels slower
than development, so a development measurement cannot answer it.

Two device profiles, both under **4× CPU throttling**, because the machine this was written on is not
the machine the household uses:

| Profile | Viewport | Stands for |
|---|---|---|
| phone | 390×844 @3, mobile, touch | the phones |
| wall | 1280×800 landscape @2 | the wall tablet |

Server-side query counts came from the **Kong access log**, split by user agent: a request with no
browser agent is the Node render, one with Chrome's is the client. No browser can see the first kind,
and this phase turns on the difference.

## The gates

| Gate | Result |
|---|---|
| `npm run fallow:audit` | **clean** — 0 findings across 42 changed files |
| `npm test` | **3779 passed**, 251 files |
| `npm run typecheck` | **clean** |
| `npm run lint` | **no new problems.** 11 errors remain in `app/skyhammer`, `app/colectivo` and `app/components/**` — pre-existing, untouched by this branch, and the subject of the `fix-lint-react-19` stash |
| `npm run test:e2e` | *(see "The browser pass", below)* |

Two fallow findings were raised by this phase's own code and both were fixed rather than suppressed,
per `.claude/rules/quality-bars.md`:

- an unused export (`COLUMNS_COOKIE_MAX_AGE`) — made module-private;
- `CalendarPage` at **CRAP 30.0**, breaching the threshold exactly. The cookie read was extracted
  into `seededColumnCount`, which is a real unit of meaning rather than a complexity dodge: the page
  now states what it fetches instead of how it learned the number.

## The numbers

### Layout shift — the largest user-visible change

Measured by `performance_start_trace` on the production build.

| Device | Before | After |
|---|---|---|
| **phone** | **CLS 0.18** | **CLS 0.00** |
| wall | 0.00 | 0.00 |

The insight named the culprits: two day columns, the all-day band and two day headers, shifting at
151 ms. `DEFAULT_COLUMN_COUNT` is `MAX_COLUMN_COUNT`, seven — so a wide screen was already right and
**every phone load painted seven columns and re-laid-out to three**. 0.18 sits in Chrome's "needs
improvement" band and was the app's worst score.

### Requests

Calendar, phone, first second — the six that fired before this phase, and what happened to each:

| Query | Fate |
|---|---|
| `task_resolutions` for the week of **1970-01-01** | **gone** — the placeholder key was fetching |
| `events`, the displayed week | **gone** — the server's seed now matches the window |
| `events`, countdowns | kept (009 R901) |
| `events`, reminder horizon | kept (008 R802) |
| `tasks` | kept, now clock-gated |
| `task_resolutions`, the real week | kept, now clock-gated |

**6 → 4.** The two later requests are the deliberate neighbour prefetches and are unchanged.

Other surfaces:

| | Before | After |
|---|---|---|
| Calendar, tablet, first second | 9 | **6** — measured after pass 1 only. Pass 2's epoch read fires on every tab, so the true figure is 5; it was not re-measured at tablet width and is not claimed as one |
| Lists tab | 4 | **3** |
| `lists` reads on a calendar load with nothing open | 1 | **0** |
| Days of events the server fetches for a phone | 7 | **3** |

Server render, from the Kong log, after: **8 distinct queries for a calendar render, 9 for a tasks
render, no duplicates in either.**

### Load

| | Before | After |
|---|---|---|
| Calendar load, local production build | 590 ms | **282 ms** |
| Server round-trip waves, calendar | 4 | **3** |
| Tab switches | 172–318 ms | unregressed |
| 70 s idle | 0 refetches, 0 long tasks | unchanged |

## The four hypotheses that were wrong

Recorded because they cost time, and the next reader should spend it elsewhere.

1. **A duplicated settings read.** The layout and three pages all call `fetchSettings`; it looks like
   a free win. Next memoises identical `fetch` GETs within a render pass, so there was never a
   duplicate — **one `household_settings` query per render, confirmed in the log**. A `cache()`
   wrapper was designed and discarded before a line of it shipped.
2. **CORS preflights doubling every client query.** True locally, false in production: the hosted
   project answers `access-control-max-age: 3600`; the local stack sends no such header. An artefact
   of the harness.
3. **A CPU-bound client.** At 4× throttling: **one 103 ms long task, 53 ms total blocking**, and no
   long-task insight on any interaction. Memoisation would have bought nothing.
4. **A 1.8 GB `.next` directory.** The dev server starts in **835 ms**.

## A product question this raised, and did not answer

**The Meals grid anchors on the week's first day. The Week calendar anchors on today.** On the wall
tablet nobody can tell — seven columns hold both. On a phone the grid fits **two**, so opening Meals
lands on Sunday and Monday and today is two pages away, while opening the Calendar lands on today.

This is what the suite's standing `phone` failure was really about, and naming it took paging the grid
by hand to see. **Left alone deliberately**: which day a tab opens on is a product decision about how
the household uses it, not a performance one, and changing it would change what a phone shows every
time it is picked up. Recorded for the operator to rule on.

## What was found and left alone

- **The production cold start.** `curl` against the deployed site: **1.81 s TTFB on the first request
  after idle, 0.17 s on every one after**. This is the largest number anywhere in this phase and it is
  almost certainly what the operator is feeling, since a development server is never cold. It is a
  Vercel compute setting, not code. The request enters at `cle1` and executes at `iad1`.
- **`familyKeys.all` on every mutation — the REALTIME half is now fixed, this half is not.**
  The original note here said both were left alone because the refetches are parallel, so the prize
  was tablet CPU rather than latency. That reasoning died with the realtime fix: a channel that
  delivers nothing costs nothing, and a channel that delivers makes every write a full-household
  refetch on every open device. The realtime half is now narrowed by domain
  (`lib/family/invalidation.ts`), measured at 5 refetches → 2 on the Lists tab.

  **What remains is `FamilyProvider`'s `refresh()`**, which runs after every successful mutation and
  still sweeps `familyKeys.all`. So the writing device now pays twice over: ~6 refetches from its own
  `refresh()`, then ~2 more when its realtime echo arrives. **This is the largest remaining
  invalidation cost in the app, and it falls on the device somebody is actually looking at.**

  Not attempted here, and the reason is sequencing rather than difficulty: `refresh()` cannot know
  which tables a write touched, so narrowing it means every call site declaring its domain — a
  mechanical change across every write path in the app, landed on a branch whose browser gate cannot
  currently be established. **It is the first candidate for the next phase.** Deleting `refresh()` and
  trusting the echo is NOT the answer: a writer whose own screen waits on the network, and shows
  nothing at all if realtime drops, is worse than a redundant refetch.

- **14.4 kB of polyfills** for features every modern browser has, flagged by the trace's
  `LegacyJavaScript` insight. Not changed, and deliberately: the lever is `browserslist`, and **nobody
  here knows what browser the wall tablet runs.** If it is an older iPad, narrowing the target does not
  trim 14 kB, it breaks the app. An operator question, not a code one.
- **407 KB of client JavaScript** on the calendar route, including **14.4 kB** of unnecessary
  polyfills. No measurement showed download or parse to be the constraint.

## Two defects fixed in the app, found on the way

- **The reminder banner covered every tab's top controls** (a Phase 7 defect). The first fix moved it
  to the bottom, where it covered the FAB and broke every event-creating journey. The correct fix is
  that **position alone cannot promise a floating card never covers something interactive**: the card
  is `pointer-events-none` and only its link and its Dismiss button take pointer events.
- **The meals journey failed every Wednesday** and had since Phase 6: it clicked today's Lunch and
  the seed plants a Lunch on `sunday + 3`. It now reads an actually-empty mealtime off the grid.

## The browser pass — three full runs, and why none of them certifies the gate

| Run | Code | Result | Wall clock | Load at start |
|---|---|---|---|---|
| 1 | before the realtime fix | 136 passed, **7 failed** | 9.2 min | — |
| 2 | after the realtime fix | 140 passed, **3 failed** | 9.4 min | — |
| 3 | after the `live.spec` fix (one test file) | 129 passed, **13 failed** | 10.4 min | **4.2** |
| 4 | after targeted invalidation | 142 passed, **1 failed** | 8.4 min | **2.60** |
| 5 | after the Meals anchor change | 134 passed, **8 failed** | 8.4 min | **4.83** |

**Load at start predicts the failure count, and the code does not.** Run 4 is the only one taken on a
quiet machine, and it failed exactly one journey — the `meals.spec:62` phone failure, which is now
fixed. Run 5 ran the same suite at load 4.83 and failed eight, in a set overlapping run 3's barely at
all: four of its eight were in `notifications.spec`, which `011`'s record already named as the file
that "fails first" under load because its journeys are pinned to the clock.

What was loading the machine, measured rather than assumed: **`mediaanalysisd` at 90% CPU** (Photos
analysing the library), `mds_stores` at 30% (Spotlight indexing) and Logitech G Hub at ~40% across two
processes. None of it is this project's, and none of it is something a test run should be asked to
compete with.

**So the gate's verdict is: everything this branch controls is green, and the browser pass needs one
run on a quiet machine.** That is the same thing `011` asked for, and run 4 is the closest anyone has
come to it.

One process note, recorded because it wasted a run: **run 5's predecessor was invalidated by its own
author.** App source was edited while the suite was in flight, and Playwright's web server is
`next dev` with hot reload, so the later journeys ran against recompiled code. It was killed rather
than reported. Do not edit `app/**` or `lib/**` while `npm run test:e2e` is running.

**The only code change between runs 2 and 3 was a single e2e spec file, and the failures went from 3
to 13.** Failure count tracks wall clock, which tracks machine load; it does not track the code.

The discriminating evidence, which the earlier wrong version of this claim did not have:
`calendar.spec.ts` run **entirely alone** passed **13/13** on `wall` earlier in the day, and later the
same file across four projects gave **16/19 with three different journeys failing** — `:91` and `:154`
on `wall`, `:36` on `tablet-landscape`, where the full run had failed `:36` on three *other* projects.
**The same file, the same code, fails at different identities run to run, in isolation.** That is not
"the rest of the suite interfering"; it is the machine, which sat at load 4.2 with none of this
project's servers running.

**So the gate is not met, and it is not met for a reason this branch does not control.** Every journey
in the suite has passed at some point today. `011`'s record asked for one run on a quiet machine;
that is still what is owed, and this machine was not quiet.

### A consideration this phase created, and should own

**Before the realtime fix, live updates delivered nothing at all. They now deliver every change on
twenty tables, and each one runs `invalidateQueries(familyKeys.all)` — roughly six refetches on every
open page.** An e2e suite is a machine that writes constantly, so the app is now doing a large amount
of work per write that it has never done in its life, and `live.spec` holds two browsers doing it at
once.

Run 2 was the best of the three and came *after* the fix, so this is not a demonstrated cause. But the
mechanism is real, and it moves the deferred finding below from "tablet CPU and database load" onto
the hot path of every single write. **If the suite stays unstable on a quiet machine, targeted
invalidation is the first thing to try, not the last.**

### Run 2 in detail — 140 passed, 3 failed, 9.4 minutes

The run before it, which found the defect: **136 passed, 7 failed, 9.2 minutes**. Four of those seven
cleared without a line of code being written for them — `calendar.spec:91`, `tasks.spec:69` and both
`lists.spec:94` — which is the instability this suite has shown since `011` and the reason a single
run has never been enough to conclude anything. One, `live.spec:21`, was fixed outright.

| Still failing | Verdict |
|---|---|
| ~~`[wall] live.spec:72`~~ | **explained and fixed** — see "The third defect" below. Passes 2/2 on repeat |
| `[phone] meals.spec:62` | known open: the shared `household` fixture cannot find today's column on a narrow grid |
| `[phone] punch-in.spec:14` | **passes 6/6 when its file runs alone.** Interference class, not a regression — it did not fail in the previous run at all |

So of 140 journeys, one is a known harness limitation, one is the documented interference class, and
one is a real open question about a five-second promise.

### The earlier run's seven, for the record

`011`'s record set the criterion in advance: *"run `npm run test:e2e` once on a quiet machine. Green
means merge. If the same journeys fail **and** the run takes about seven minutes, the cause is the
branch."* Both runs here took about nine minutes against the previous **17.4**, so the machine is no
longer the dominant variable and the failures could finally be read as failures — which is what found
the realtime defect.

Targeted runs on the same code:

| Run | Result |
|---|---|
| `calendar-views` + `preview-bar`, `--project=phone` | **7/7 passed** |
| `calendar-views` + `preview-bar` + `calendar`, `--project=wall` | **44/44 passed** |
| `calendar.spec.ts` alone, `--project=wall` | **13/13 passed** |
| `live.spec.ts` alone, `--project=wall`, before the fix | 5 passed, **2 failed** |
| `live.spec.ts` alone, `--project=wall`, after the fix | 6 passed, **1 failed** (`:21` fixed) |
| `punch-in.spec.ts` alone, `--project=phone` | **6/6 passed** |

### The seven, sorted by what they mean

**Four are the known-open failures this project already carries**, none of them this branch's:

| Journey | Status |
|---|---|
| `tasks.spec:69` — hides skipped tasks when the filter says so | known open, time-of-day dependent |
| `lists.spec:94` — pages by a finger (`tablet-portrait`) | known open, finger-paging |
| `lists.spec:94` — the same, `phone` | known open |
| `meals.spec:62` — plans a meal (`phone`) | known open: the shared `household` fixture cannot find today's column on a narrow grid |

**One is the interference class** and is not a regression: `calendar.spec:91` (editing one occurrence
of a repeat) failed in the suite with *"a daily repeat draws on every remaining day of the visible
week — expected > 1, received 0"*, and **passes 13/13 when its file is run alone**. That is exactly
the pattern `011` documented for every one of its failures.

**Two are new information, and they are the important ones.** `live.spec:21` and `live.spec:63` — the
two-browser journeys — **fail even when run alone**. They are reproducible, and they are not caused by
this branch: until now they **skipped**, so they have never once passed.

## The live-update finding — root cause found, and fixed

**The most significant thing this phase produced, and it is not a performance finding at all.**
Nothing in 012 caused it; 012's gate run is simply the first thing that ever looked.

**Live updates had never worked. Not since Phase 1.** Two devices watching each other is what every
shipped phase has promised, and `useFamilyRealtime` filtered three of its twenty tables by household
— `categories`, `household_settings`, `households`. **One filtered `postgres_changes` binding makes
the server discard every binding on the channel**, and `subscribe()` still reports `SUBSCRIBED`, so
nothing ever said a word.

Bisected in a browser against the local stack, by counting rows in `realtime.subscription` and
watching for a refetch:

| Channel shape | Registers | Delivers |
|---|---|---|
| one unfiltered binding | 1 row | **yes** |
| all twenty unfiltered | 20 rows | **yes** |
| all twenty, **one** filter added back | **0 rows** | **no** — and still `SUBSCRIBED` |

**Seven alternatives were eliminated first, each by experiment rather than argument**: the local
realtime image (a bare client subscribes and receives), replication (`wal_level = logical`, both
slots active, all twenty tables published), authentication (an **anon** client receives too, so RLS
was never the gate), the colon in the channel topic `family:<id>`, a duplicated `supabase-js` in the
tree (one version, 2.112.4), React StrictMode's double mount (**the production build failed
identically**), and DELETE replica identity — every table is `default (PK only)`, which looked
decisive until a probe showed deletes *are* delivered. That last one was a wrong hypothesis, held
briefly and dropped on the measurement.

**What the filters were worth.** Bandwidth, and nothing else. A payload is a refetch signal, is never
rendered — Realtime does not apply a normal read's column privileges, which is why the hook has
always ignored payload content — and the refetch it triggers goes through RLS like every other read.
So there was nothing on the other side of the scale from the feature working.

**Verified fixed**: a meal inserted from outside appears on an open calendar without a reload, and
deleting it removes the token, both in well under a second; `list_items` likewise. `live.spec:21`
passes for the first time in the project's history.

### And why no test ever caught it

Two independent faults in the same check, and either alone would have been enough.

1. **It counted rows that outlive their socket.** `liveUpdateSupport()` reads
   `realtime.subscription`, which proves a subscription was *registered*, never that a change is
   *delivered*. Twenty rows survived the page that made them navigating to `about:blank`, and were
   still there two hundred seconds later with nothing connected at all. So on any machine that had
   ever run the app, the answer was "yes, live updates work here" — permanently.
2. **It was measured before either browser had navigated.** It was a fixture *value*, and Playwright
   resolves fixtures before the test body runs, so the count was taken while both pages were still
   blank — despite the helper's own comment saying "called once both browsers have a `/family` page
   mounted".

Together, the two-browser journeys skipped on the strength of rows belonging to nobody, and so never
reported the defect above. **A check that cannot fail is worse than no check, because it is read as a
pass.** The helper now clears the table before either page navigates, and the fixture hands over a
function the journey calls at the moment its comment always claimed.

### The third defect — the journey asserted on a token it did not own

`live.spec:72` failed **3/3 on repeat**, so it was never flake. And the app was never at fault: the
meal row *is* deleted, and the deletion propagates in milliseconds when driven by hand, by three
separate routes.

**The seed plans Banana bread as SATURDAY's Snack.** A seven-column window runs Sunday to Saturday, so
the `wall` tablet already shows a `Snack: Banana bread` token before this journey does anything —
confirmed by opening the calendar at 1280×800 with nothing planted and counting exactly one.

Both of its assertions were therefore wrong in the same way:

- `toBeVisible` on that token **passed on the seed's meal**, proving nothing about the journey's own;
- `toHaveCount(0)` after the delete **could never pass**, because the seed's Saturday token remains.

It would have failed from the day it was written. It surfaced now only because these journeys had
been skipping. The count is now the claim — one more token than before, then one fewer — which is also
the truer reading of FR-722: a change arrives, and its removal arrives too.

`meals.spec.ts` already carried this warning in a comment ("several days can hold the same recipe, and
the seed plans Banana bread on the Saturday") and scopes its own locators by day. This journey did
not. **A fixture that appears twice in one window cannot identify anything by name alone.**

---

*The investigation as it stood before the root cause was found is kept below, because the order the
evidence arrived in is the useful part.*

What was established, each by experiment:

1. **The stack delivers.** A bare `@supabase/supabase-js` client, signed in as `dev@family.local`,
   subscribed to `family.list_items` and **received an INSERT**. Repeated with all twenty of the
   app's table bindings on one channel: still delivered. So neither the local realtime image nor the
   binding count is the problem.
2. **Replication is healthy.** `wal_level = logical`; both slots (`supabase_realtime_replication_slot_`
   with wal2json, and the messages slot with pgoutput) exist and are **active**. All twenty
   `family` tables are in the `supabase_realtime` publication.
3. **The app connects.** Kong logs `101` upgrades on `/realtime/v1/websocket` from Chrome, and
   `realtime.subscription` holds twenty rows whose claims carry the correct `sub` and
   `role: authenticated` — a real household member.
4. **And the app still does not react.** With a `/family/lists` page open and visible, a row inserted
   from outside produced **no refetch of `list_items`, no REST request at all, and no visible
   change**, three times, including on a freshly reloaded page — while a Node client subscribed at
   the same moment received that same insert.

**A root cause was not established, and none is asserted here.** The difference that remains
unexplained is browser-versus-Node: same stack, same user, same claims, same bindings.

**Why the suite stopped skipping.** `liveUpdateSupport()` decides by counting rows in
`realtime.subscription`, which proves a subscription was *registered*, not that a change is
*delivered*, and the rows outlive the socket that made them — twenty survived a page navigating to
`about:blank`. So the check now reports "available" where it once reported "no subscription", and the
journeys run and fail instead of skipping. **The check is measuring the wrong thing**, and that is
true regardless of what the underlying defect turns out to be.

**What this means for the household**: two devices watching each other — Phase 5's headline promise,
and still an outstanding by-hand check for the operator — cannot be shown to work. It should be
verified on the hosted project before anything is concluded about production, since every
observation above is from the local stack.
