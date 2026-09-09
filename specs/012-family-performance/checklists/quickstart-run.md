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

## What was found and left alone

- **The production cold start.** `curl` against the deployed site: **1.81 s TTFB on the first request
  after idle, 0.17 s on every one after**. This is the largest number anywhere in this phase and it is
  almost certainly what the operator is feeling, since a development server is never cold. It is a
  Vercel compute setting, not code. The request enters at `cle1` and executes at `iad1`.
- **`familyKeys.all` on every mutation and every realtime event.** One ticked chore refetches ~6
  queries per open device, and the writer pays twice — its own `refresh()` and then its realtime echo.
  Left alone deliberately: the refetches are parallel, so the prize is tablet CPU and database load
  rather than latency, and `useFamilyRealtime` records that the bare sweep is load-bearing for
  Completed Date chores. A small gain against a correctness risk is the wrong trade for this app.
- **407 KB of client JavaScript** on the calendar route, including **14.4 kB** of unnecessary
  polyfills. No measurement showed download or parse to be the constraint.

## Two defects fixed in the app, found on the way

- **The reminder banner covered every tab's top controls** (a Phase 7 defect). The first fix moved it
  to the bottom, where it covered the FAB and broke every event-creating journey. The correct fix is
  that **position alone cannot promise a floating card never covers something interactive**: the card
  is `pointer-events-none` and only its link and its Dismiss button take pointer events.
- **The meals journey failed every Wednesday** and had since Phase 6: it clicked today's Lunch and
  the seed plants a Lunch on `sunday + 3`. It now reads an actually-empty mealtime off the grid.

## The browser pass

**136 passed, 7 failed, 9.2 minutes** (2026-09-09).

Read that against `011`'s record, which set the criterion in advance: *"run `npm run test:e2e` once on
a quiet machine. Green means merge. If the same journeys fail **and** the run takes about seven
minutes, the cause is the branch."* This run took **9.2 minutes against the previous 17.4**, and the
failing set fell from 10 to 7. The machine is no longer the dominant variable, so the failures can
finally be read as failures.

Targeted runs on the same code:

| Run | Result |
|---|---|
| `calendar-views` + `preview-bar`, `--project=phone` | **7/7 passed** |
| `calendar-views` + `preview-bar` + `calendar`, `--project=wall` | **44/44 passed** |
| `calendar.spec.ts` alone, `--project=wall` | **13/13 passed** |
| `live.spec.ts` alone, `--project=wall` | **5 passed, 2 failed** |

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

## The live-update finding

This is the most significant thing the run produced, and it is unresolved. **It is not a performance
finding and nothing in this phase caused it**; it is recorded here because this is the run that
surfaced it.

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
