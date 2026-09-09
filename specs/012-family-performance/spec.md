# Feature Specification: What the Household Waits For

**Feature Branch**: `012-family-performance`
**Created**: 2026-09-09
**Status**: Built — see `checklists/quickstart-run.md`
**Input**: The operator's report, in their words: *"this project has become VERY slow"*, clarified to
*"I was talking about my production site, seems slower than dev"*, and then *"anywhere we can have
performance gains would be good"*.

## What kind of phase this is

**No dossier describes performance, and this phase does not pretend otherwise.** Every other phase
of this project answers to `docs/research/skylight/**` and tags each claim `[VERIFIED]`, `[INFERRED]`
or `[UNKNOWN]` under constitution §VIII. There is nothing here to verify against: the reference
product's latency is not documented, is not reproducible, and would not be a target worth copying if
it were.

So the authority in this phase is **measurement**, and the rule that replaces the citation rule is
this: **a requirement exists only if a number was taken before and after it.** Where a number could
not be taken, the finding is recorded as a finding and nothing is changed. Four candidate changes
died that way (see "Measured and cleared"), and recording them is the point — they are the work the
next phase should not repeat.

This phase changes **no behaviour the household can name**. Every requirement below is invisible when
it succeeds. That is the bar: a performance change that alters what the calendar says is not a
performance change, it is a regression with a stopwatch attached.

## Where the measurements were taken

Latency in development is not latency in production, which is the operator's whole complaint, so the
harness had to be closer to production than `npm run dev`:

- **a production build** (`next build`) served by `next start`, pointed at the **local Supabase
  stack** — never the hosted project, per the standing rule that no test harness may reach it;
- **the devices that exist**, not this machine: 390×844 at device-pixel-ratio 3 with the **CPU
  throttled 4×** for the phone, and 1280×800 landscape for the wall tablet;
- **chrome-devtools** for traces, Core Web Vitals and the request waterfall; **the Kong access log**
  for the count of queries a server render makes, which no browser can see.

Two numbers came from the hosted deployment itself, by `curl` against public URLs only: the
cold/warm TTFB split, and the CORS preflight headers. Neither read a row of household data.

## Requirements

### The first paint (FR-1201 – FR-1204)

- **FR-1201** — The calendar's server render MUST seed the window for the number of day columns
  **this device last measured**, not a constant. The count travels in a cookie, `family_columns`,
  scoped to `/family`.
- **FR-1202** — That cookie MUST be treated as a hint and never as a fact. A value outside the range
  a grid can produce (`MIN_COLUMN_COUNT`…`MAX_COLUMN_COUNT`), a non-integer, or an absent cookie MUST
  fall back to `DEFAULT_COLUMN_COUNT` — which is exactly what the page did before the cookie existed.
  The mounted grid's own measurement remains the truth and overrides the hint.
- **FR-1203** — Only the **Week** view may write the cookie. The Day view fixes its count at one and
  the Month view is always seven; either would record a number that says nothing about how wide the
  device is.
- **FR-1204** — The server-seeded rows MUST seed the cache entry for the window the server actually
  fetched, compared against the **seeded** column count rather than the default.

### What is never fetched (FR-1205 – FR-1208)

- **FR-1205** — A query whose key is a placeholder MUST NOT be enabled. Specifically, the reminder
  banner's task reads wait for the browser's clock, because their week key is the week containing
  today and before the clock there is no such week.
- **FR-1206** — A read that only one surface needs MUST be gated on that surface being in use. The
  meal surfaces read `lists` only to offer "add the ingredients to a list", so they read it only while
  an editor is open.
- **FR-1207** — The reminder banner's task reads MUST be gated on the two settings that can produce a
  task reminder (`notifyTaskDue`, `notifyTaskCompleted`). It runs in the shell, so without the gate it
  is two queries on every page of every tab for a feature the household switched off.
- **FR-1208** — A server render MUST NOT serialise reads that do not depend on one another. Only the
  events read needs the household's timezone and start-of-week; the three meal reads are keyed by the
  household alone and go in the same wave as the settings read.

### What the household is not shown (FR-1209 – FR-1210)

- **FR-1209** — The calendar's day columns and headers MUST NOT move after the first paint on a
  device whose width the cookie already knows. Cumulative Layout Shift is the measure.
- **FR-1210** — A floating card MUST NOT cover an interactive control. Position alone cannot promise
  this: the card is inert (`pointer-events-none`) and only its own controls take pointer events.

## Success criteria

Each is a number, with the harness that produced it. "Before" is `main` at `fb684b4`.

| | Criterion | Before | After |
|---|---|---|---|
| SC-1201 | Calendar layout shift, phone, production build | **CLS 0.18** | **CLS 0.00** |
| SC-1202 | Calendar layout shift, wall tablet | 0.00 | **0.00** (unregressed) |
| SC-1203 | Client queries in the calendar's first second, phone | **6** | **4** |
| SC-1204 | Client queries in the calendar's first second, tablet | **9** | **6** after pass 1 (measured); pass 2 removes the epoch read from every tab, so 5 — **not separately measured at tablet width** |
| SC-1205 | Client queries on the Lists tab | **4** | **3** |
| SC-1206 | Days of events the server fetches for a phone | **7** | **3** |
| SC-1207 | Calendar load, local production build | **590 ms** | **282 ms** |
| SC-1208 | Server round-trip waves, calendar render | **4** | **3** |
| SC-1209 | `lists` queries on a calendar load with nothing open | **1** | **0** |
| SC-1210 | Queries a `task_resolutions` read wastes on the epoch week, per page load of every tab | **1** | **0** |
| SC-1211 | Tab switches | 172–318 ms | unregressed |
| SC-1212 | Refetches and long tasks over 70 s idle | 0 | **0** |

## Measured and cleared

**These four are not problems. Do not spend a phase on them.** Each looked like a finding and was
killed by a measurement; the measurement is recorded so the next reader does not re-derive it.

1. **The duplicated settings read.** `layout.tsx` and three pages each call `fetchSettings`, which
   reads as an obvious duplicate round trip. It is not: Next memoises identical `fetch` GETs within
   one render pass. The Kong log for one calendar render shows **eight distinct queries and exactly
   one `household_settings`**; for one tasks render, **nine and one**. A `cache()` wrapper was designed
   and then thrown away because there was nothing for it to save.
2. **CORS preflights.** Every client query is preceded by an `OPTIONS`, which would double the
   round trips. The hosted project answers `access-control-max-age: 3600`, so a preflight is paid once
   an hour per URL. **Only the local stack omits the header** — the doubling is an artefact of the
   development harness and does not exist in production.
3. **Main-thread cost.** At 4× CPU throttling a calendar load has **one long task of 103 ms** and a
   total blocking time of **53 ms**. Interactions (paging the week, opening the view menu) produce no
   long-task insight at all. This app is not CPU-bound and no amount of memoisation will help it.
4. **A 1.8 GB `.next` directory.** Hypothesised as the cause of slow development, measured, and
   discarded: the dev server starts in **835 ms**.

## Found, and out of scope

Real, measured, and deliberately not fixed here. Each says why.

- **The production cold start — the largest number in this phase.** First request after idle:
  **1.81 s TTFB**. Every request after: **0.17 s**. A ten-fold difference, and the most likely
  explanation of *"production seems slower than dev"*, because a development server is never cold.
  **Out of scope because it is not code**: it is a Vercel compute setting (Fluid Compute, or a
  warming cron) on a dashboard this project cannot reach. Recorded for the operator.
  The request also enters at `cle1` and executes at `iad1`.
- **Every write and every realtime event invalidates every family query.** `FamilyProvider`'s
  `refresh()` and `useFamilyRealtime`'s handler both sweep `familyKeys.all`, so one ticked chore
  refetches roughly six queries on every open device — and the writer pays twice, once for its own
  mutation and once for its realtime echo. **Out of scope because the measured prize is small**: the
  refetches are parallel, so the latency cost is one wave, and the real cost is tablet CPU and
  database load. Narrowing it means mapping each table to the keys it can affect, and
  `useFamilyRealtime` records that the bare sweep is **load-bearing** for Completed Date chores. The
  trade is a correctness risk for a small gain, which is the wrong way round for this app.
- **Client JavaScript.** The calendar route loads **407 KB** across 15 files in a production build,
  including **14.4 kB** of polyfills for features every target browser has. Out of scope because no
  measurement here showed download or parse to be the constraint — see "Measured and cleared" 3.

## Out of scope

- Any change to what the household sees, reads or can do.
- Any schema change. This phase adds **no migration**; 039 remains the latest and is already applied
  to the hosted project.
- The Vercel and Supabase dashboards.
- The offline cache. Still unbuilt, still this project's own invention rather than a clone, and still
  waiting for a phase that can say so honestly.

## Risks

- **The cookie is wrong for one paint after a rotation or a resize.** Accepted: that is precisely
  what every load did before the cookie existed, so a stale hint is never worse than no hint.
- **The cookie is client-supplied.** Mitigated by refusing — not clamping — any value outside the
  range a grid can produce. It carries a small integer and nothing identifying, so constitution §VII
  is untouched.
- **A gated read is gated on the wrong thing**, and a surface silently shows stale or empty data.
  Mitigated by a test per gate that asserts the condition, not the result.
