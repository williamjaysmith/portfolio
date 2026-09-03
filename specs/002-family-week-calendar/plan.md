# Implementation Plan: Family Week Calendar

**Branch**: `002-family-week-calendar` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-family-week-calendar/spec.md`

## Summary

Build the Week view for `/family` on the shipped Phase 1 platform: a self-measuring seven-column time grid (three columns on a phone, always a contiguous slice of one anchored week), timed and all-day events coloured by their Profiles and Labels, simple repeats stored as canonical Skylight-format rules and expanded in the household's timezone, per-occurrence edits and skips with the three-scope model, full drag (move, cross-day, all-day↔timed, edge-resize, 15-minute snap, punch-in on drop), and Labels joining the existing filter sheet.

The technical core is **three hand-rolled pure layers where the risk actually lives** — a closed recurrence grammar with `Intl`-based zone math (because no library on the market implements FR-235's gap rule), a drag geometry-plus-state-machine pair on platform Pointer Events (because edge-resize sits outside every drag library's model), and one non-bypassable client-side expansion entry point over a three-branch window query (because a family's series number in dozens, and a second rrule parser in PL/pgSQL is the drift bug waiting to happen). This phase adds **zero dependencies**; every write rides Phase 1's `withActor` → server action → bare-invalidation machinery unchanged.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+
**Primary Dependencies**: Next.js 16.1.6 (App Router), React 19.1.0, Tailwind 4, `@supabase/ssr` + `@supabase/supabase-js`, TanStack Query 5, `jose`, Zod 4, `framer-motion` (slice pager + settle animations, already installed) — **no new dependencies** (research R214); `@dnd-kit` stays colectivo-only, recurrence/zone/drag math is hand-rolled (R202, R205)
**Storage**: Supabase Postgres, schema `family`, project `zgmltllcyqylgtazunai`; six migrations 010–015 on top of Phase 1's 001–009; local stack on ports 553xx
**Testing**: Vitest 4 projects — unit (jsdom; golden DST tables, snap tables, reducer transitions) and policies (node, against the local 553xx stack: SC-203 per path, SC-207's six scope checks, the privilege-matrix delta)
**Target Platform**: iPadOS Safari (primary, landscape, installed); iOS/Android phones (the three-column slice); desktop browsers (development)
**Performance Goals**: Block in its new place ≤ 1 s after the last prompt (SC-206); a moved occurrence on a second device ≤ 5 s with no reload (SC-204); a repeating event created in < 30 s including punch-in (SC-201); week expansion sub-millisecond at household scale (R206)
**Constraints**: FR-288 — refuse, never queue, no optimistic writes; no horizontal page scroll at any width (FR-282); WCAG 2.1 AA + 44×44 pt touch floor (FR-263); fallow gates (maxCyclomatic 20, maxCognitive 15, CRAP needs coverage, no suppressions); Supabase free tier
**Scale/Scope**: One household; series in the dozens, ~50 windowed one-off rows per week read; 89 FRs, 6 migrations, ~10 new `lib/family` modules, ~20 calendar components, 3 amended Phase 1 surfaces (realtime table list, FilterSheet, category-delete dialog). Zero NEEDS CLARIFICATION.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How this plan satisfies it |
|---|---|---|
| **I. Sub-apps are self-contained** | PASS | Everything lands in `app/family/**`, `lib/family/**`, `supabase/migrations/` and the seed script. No portfolio-level file changes at all this phase — no new dependencies, no `next.config.ts`/`proxy.ts`/`vitest.config.ts` edits. The three amended surfaces (`useFamilyRealtime`, `FilterSheet`, the category-delete dialog) are `/family`-internal. Nothing is extracted for reuse; colectivo's dnd-kit usage is untouched. |
| **II. Test-first for logic** | PASS | The phase is decomposed so the silently-data-corrupting parts are pure and land test-first: recurrence grammar/zone/expansion (the SC-208 year-long DST sweep is a unit table), week geometry, the drag reducer, slice tiling, layout clustering, visibility (R213) — and the scope/split action layer, whose SC-207 scope checks and split-atomicity assertion are written in the policies tier before the actions exist. Gesture feel and visual placement are verified by running the app — §II's own carve-out. |
| **III. Accessible and touch-first** | PASS | FR-263 (44 pt floor, keyboard, focus) inherited and extended: every block is a focusable button reaching details→edit, and the drag has a slot-semantic keyboard path through the same reducer with `aria-live` announcements (R205). FR-214 derives block ink from the fill for 4.5:1; FR-218's minimum height keeps short events at the touch floor; colour is never alone — every block carries its title, and category identity pairs colour with name in details and filters. |
| **IV. Layered, boundary-enforced architecture** | PASS | All calendar math — recurrence, zone, expansion, layout, geometry, drag state, tiling, visibility — lives in framework-free `lib/family/**`; components render from it; the one expansion entry point is fallow-boundary-guarded so no component imports recurrence internals (R206). `lib` imports nothing from `app/**`. |
| **V. Quality gates** | PASS | The branchy new code is pure and exhaustively unit-tested, which is what feeds the CRAP gate; nothing in this design needs a suppression, threshold lift or baseline bump. `test:coverage` precedes any direct fallow run, as the pre-commit hook already enforces. |
| **VI. Degrade gracefully** | PASS | FR-288 verbatim: offline or conflicting writes are refused with a message, never queued or shown as saved; every drag cancel path writes nothing and reverts to cached truth (R208); the later write wins and the refetch reconciles; the filter store keeps Phase 1's in-memory fallback when localStorage is unavailable. |
| **VII. Private by default** | PASS | The three new tables get `is_member()` read policies, SELECT for `authenticated`, ALL for `service_role`, and **no client write path** — every write is a `requireActor` server action (FR-270/271, SC-205). `replica identity full` is prohibited so DELETE payloads carry no event content (R209). SC-203 gets an explicit per-path policies test. |
| **VIII. Fidelity is specified** | PASS | The spec tags all 89 FRs (`[V]`/`[V-photo]`/`[ESTIMATED]`/`[OURS]`/`[P1]`) and resolves 8 source contradictions explicitly; this plan implements only resolved decisions and keeps photo-estimated geometry (stripes, now-line dot) tagged as such in the token layer. |

**Result: PASS. No violations, so Complexity Tracking is empty and omitted.**

### Re-check after Phase 1 design

Design introduced four things worth re-testing against the constitution:

- **The calendar's realtime subscription drops the household filter.** Tested against §VII: with default replica identity a DELETE payload carries only primary keys — never `household_id` — so the Phase 1 filtered channel would silently never fire on deletes (Assumption 39). The unfiltered subscription is safe because no payload content is ever rendered or trusted: every notice is a bare "re-read" whose refetch runs under RLS, and the household is the project's only tenant. The stronger §VII rule — no whole deleted rows in payloads, so no `replica identity full` — is kept, and is *why* the filter has to go. Re-check: **PASS**.
- **Writes still bypass RLS via the service role, now for family-member-writable records.** Phase 1's justification binds harder here, not weaker: RLS sees the account, never the punched-in actor, and FR-270 demands an actor for every event write — a write grant to `authenticated` would let any signed-in device write with *no* actor. Every admin write stays scoped `.eq('household_id', …)` because with the service role that clause *is* the tenancy check; the multi-statement `this_and_future` split additionally moves into one `SECURITY DEFINER` RPC so it cannot half-complete (R204). Re-check: **PASS**.
- **`touch-action: none` on event blocks means a scroll or slice-swipe cannot start on a block.** Tested against §III: it is the compliant consequence of FR-253 (no timed hold, so distance-slop must disambiguate), the household scrolls from the gaps, gutter or header, the wall-tablet grid shows ~4 hour rows so block-covered viewports are the exception, and the keyboard path is unaffected. Recorded as a stated trade, verified by hand on the iPad — not hidden. Re-check: **PASS**.
- **Two research drafts were superseded during design and the deltas are recorded, not papered over** (research preamble, R205, R206): the client-flow draft's trigger-maintained `search_start/search_end` read gave way to the three-branch window query (no derived columns, no PL/pgSQL rrule parser, moved occurrences found because series rows always arrive), and its dnd-kit sensor assumption gave way to the hand-rolled drag layer. One document decides each question; the losers say who won. Re-check: **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/002-family-week-calendar/
├── plan.md              # This file
├── spec.md              # Approved specification (89 FRs, 40 assumptions, 8 contradiction resolutions)
├── research.md          # Phase 0 — 14 resolved decisions, R201–R214
├── data-model.md        # Phase 1 — migrations 010–015 (015 is the split RPC), constraints, policies
├── quickstart.md        # Phase 1 — setup, per-guarantee verification, operator steps (push + post-push check + timezone seed)
├── contracts/
│   └── server-actions.md    # Phase 1 — event actions, scope semantics, occurrence-key validation
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output — created by /speckit.tasks
```

### Source code (repository root)

```text
supabase/migrations/
├── 010_events.sql                        # family.events: series/one-off rows, XOR time shape, rrule CHECK (^FREQ=, no COUNT),
│                                         #   tz-provenance trigger, 3 partial indexes, unique(id,household_id), read policy, grants
├── 011_event_categories.sql              # ordered event↔category join (position smallint), composite (id,household_id) FKs
│                                         #   (+ matching unique on categories — the one Phase 1 alteration), cascade both ways
├── 012_event_exceptions.sql              # skip/override rows keyed by occurrence_date (household-local original date),
│                                         #   unique(event_id,occurrence_date), four-field override payload CHECKs
├── 013_household_timezone.sql            # household_settings.timezone text not null default 'UTC' + validity trigger (FR-284)
├── 014_realtime_calendar.sql             # guarded publication adds ×3, default replica identity, notify pgrst
└── 015_split_event_series.sql            # family.split_event_series() — the atomic this_and_future split RPC,
                                          #   SECURITY DEFINER, service_role-only EXECUTE (R204)
scripts/family-seed.mjs                   # (+) writes the real household timezone (FAMILY_SEED_TIMEZONE) and, --local
                                          #     only, the fixture week incl. the spec's example household (quickstart §3)

lib/family/
├── recurrence/
│   ├── grammar.ts                        # strict parser + canonical emitter for the closed rule grammar (R201)
│   ├── zone.ts                           # Intl-based offset math; wall↔instant; gap/fold policy (FR-235/236); the Temporal swap point
│   └── expand.ts                         # stateless date-walk; expandSeries applying skips/overrides
├── calendar/
│   ├── dates.ts                          # week anchoring, plain-date maths in a named zone, sliceStarts, window derivation
│   ├── expand.ts                         # expandWindow — the one non-bypassable expansion entry point (R206)
│   ├── layout.ts                         # midnight segmentation, overlap clusters + FR-285 cap + "+n more", all-day lanes, min height
│   └── visibility.ts                     # isEventVisible (FR-265)
├── week-geometry.ts                      # GridMetrics, px↔minutes, 15-min snap, slotFromPoint, planMove/planResize, autoScrollVelocity
├── drag-state.ts                         # the drag reducer: idle→armed→dragging→confirming→committing; every cancel path explicit
├── rows.ts / types.ts / validation.ts    # (+) event/link/exception column lists + mappers; Event/Occurrence/Scope types;
│                                         #     Zod payloads incl. the structured repeat choice (clients never send rule strings)
├── queries.ts                            # (+) familyKeys.events/week, fetchWeekEvents (3-branch OR, embeds), useWeekEvents, prefetchWeek
├── actions/events.ts                     # createEvent/updateEvent/deleteEvent with scope; requireActor; the sole rrule emitter;
│                                         #   this_and_future routed through the split RPC
└── __tests__/
    ├── unit/                             # grammar, zone (golden DST tables incl. the SC-208 year sweep), expand, dates, layout,
    │                                     #   visibility, week-geometry (snap table), drag-state (every transition), validation
    └── policies/                         # (+) SC-203 per-path reads, privilege-matrix delta, SC-205 actor refusals,
                                          #     SC-207's six scope checks + split atomicity — against the 553xx stack

app/family/
├── tokens.css                            # (+) grid tokens: hour row/gutter, now-line, stripe geometry (photo-estimated values stay tagged)
└── (app)/
    ├── components/
    │   ├── useFamilyRealtime.ts          # (~) + events, event_categories, event_exceptions — unfiltered (R209)
    │   ├── FilterSheet.tsx               # (~) + Labels section (FR-264, R212)
    │   └── settings/DeleteDialog.tsx     # (~) + affected-event count (FR-274, Assumption 24)
    └── calendar/
        ├── page.tsx                      # server component: current week fetched → initialData (R207)
        └── components/
            ├── WeekView.tsx              # orchestrator: anchor + slice state, geometry, wiring
            ├── useWeekAnchor.ts          # {today|pinned} anchor over useNow in household tz (FR-210, R210)
            ├── useGridGeometry.ts        # ResizeObserver → GridMetrics, column count (FR-277/278), slice clamp
            ├── useWeekOccurrences.ts     # fetch → expand → filter → layout memo chain (R206)
            ├── WeekHeader.tsx / AllDayBand.tsx / WeekGrid.tsx / DayColumn.tsx
            ├── EventBlock.tsx / NowLine.tsx / MoreOverflow.tsx
            ├── SlicePager.tsx            # pointer paging, axis lock, reduced motion (FR-279/289, R211)
            ├── useEventDrag.ts           # pointer wiring, capture on the scroll container, rAF + auto-scroll, keyboard adapter (R205)
            ├── DragPreviewBlock.tsx      # the snapped in-grid ghost (shared EventBlock, aria-hidden)
            ├── ScopeDialog.tsx           # one component for edit, delete and drag (FR-237/250)
            └── EventDetails.tsx / EventForm.tsx / useEventForm.ts / DeleteConfirm.tsx
```

**Structure Decision**: The calendar replaces its Phase 1 placeholder page inside the existing `(app)` route group, so it sits behind the server gate and inside the provider chain with no new plumbing. The layering rule does the heavy lifting: everything that can corrupt a calendar — recurrence, zone math, expansion, geometry, the drag state machine — is framework-free `lib/family/**` with the components as thin renderers and adapters, enforced by the fallow boundary rules at the commit gate. Three Phase 1 surfaces are amended in place (marked `(~)`) rather than forked, per the spec's own instruction to treat them as work, not inheritance.

## Implementation phasing

Ordered so each step is independently verifiable. `/speckit.tasks` will expand these.

| # | Step | Verifiable by |
|---|---|---|
| 1 | Migrations 010–015 (015 is the split RPC) on the local stack | `supabase db reset`; privilege-matrix delta asserted in the policies suite; live `db push` + timezone seed stay operator steps |
| 2 | Recurrence lib (`grammar`, `zone`, `expand`) — **tests first** | Golden DST tables green, incl. the SC-208 year-long sweep, gap/fold singletons, UNTIL and monthly-31 tables |
| 3 | Calendar lib (`dates`, `expand` window, `layout`, `visibility`) — **tests first** | Tiling, clustering, "+n more", midnight segmentation, moved-occurrence emission all unit-proven |
| 4 | Rows/types/validation, week query + keys + prefetch, realtime table extension | Week fetch under RLS in the policies tier; SC-203's per-path zero-row checks |
| 5 | Event server actions (create/edit/delete with scopes; the sole rrule emitter; split RPC) — **tests first** | SC-207's six scope checks, the split-atomicity assertion and SC-205's refusals written in the policies tier against the 553xx stack before the actions exist, then green |
| 6 | Grid rendering: header, all-day band, columns, blocks, now-line, overflow, anchor | Story 1's fourteen scenarios by hand; screenshots at three widths; overnight rollover check (SC-211) |
| 7 | Details, create/edit form, delete confirm, ScopeDialog, FR-274 count amendment | Story 2's nineteen scenarios; validation messages against fields |
| 8 | Drag: `week-geometry` + `drag-state` (**tests first**), `useEventDrag`, preview, prompts | Story 3's eleven scenarios; every reducer transition unit-tested; gesture feel by hand on the iPad |
| 9 | SlicePager, FilterSheet labels, phone pass | Story 4's eleven scenarios; 390×844 and 1180×820 checks (SC-209, SC-213) |

## Risks

| Risk | Mitigation |
|---|---|
| Hand-rolled zone math is wrong in some zone/transition combination | The gap/fold policy is ~25 lines behind golden tables for five zones including `Australia/Lord_Howe` (30-minute shift) and a year-long sweep asserting SC-208 verbatim; every library alternative was verified to get FR-235 *wrong*, so the tables are the guarantee either way |
| Fetching every series row forever grows the week read | Honest ceiling stated in R206: dozens of series ≈ tens of KB at family scale; expired series cost a row, not math. If a later phase's server-side scan needs more, a materialised occurrence table arrives additively |
| The `this_and_future` split half-completes and truncates a series without its tail | Routed through one `SECURITY DEFINER` RPC — one transaction; its atomicity is asserted in the policies tier (R204) |
| iOS Safari pointer quirks (system-gesture `pointercancel`, capture loss) strand a drag | Every cancel is an explicit reducer transition incl. `SOURCE_GONE`; capture is on the stable scroll container, not the block; hand verification on the iPad is a phasing gate, not an afterthought |
| Scroll cannot start on an event block (`touch-action: none`) annoys a dense day | Recorded trade (Constitution re-check §3): gutter/header/gaps scroll, ~4 hour rows visible on the wall tablet; revisit only on real-family complaint |
| Unfiltered realtime means any family-schema write refetches the calendar | Bare invalidation at one household's write rate is a handful of small queries a day; narrowing to `familyKeys.events` is a one-line change if ever measured to matter (R207/R209) |
| The `'UTC'` timezone default survives to production unseeded | Deliberately loud failure (everything hours off, immediately visible); the quickstart's operator section pairs the push with the seed step |
| New branchy lib trips the CRAP gate before its tests land | The phasing order puts tests first for exactly those modules; `test:coverage` runs before fallow, as the pre-commit hook enforces |
| A future write path stores an rrule the expander refuses | Clients cannot send rule strings at all (R201); the action emitter is the sole producer, the DB CHECK is the backstop, and a stored unparsable rule throws as an invariant breach rather than rendering wrongly |

## Progress

- [x] Phase 0 — research complete ([research.md](./research.md): R201–R214, no open unknowns, zero new dependencies)
- [x] Constitution check — pass, before and after design
- [x] Phase 1 — data-model.md (migrations 010–015 in full SQL incl. the split RPC, privilege matrix delta), contracts/server-actions.md (event actions + scope semantics), quickstart.md (verification per guarantee; operator steps: `db push`, post-push check, timezone seed)
- [ ] Phase 2 — `/speckit.tasks`
- [ ] Phase 3 — implementation per the phasing table above
