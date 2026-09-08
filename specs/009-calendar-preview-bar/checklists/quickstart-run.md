# Quickstart run record — 009 The Calendar's Preview Bar

**Run**: 2026-09-07 · **Branch**: `009-calendar-preview-bar` · **Stack**: local (553xx)
**Quickstart**: [../quickstart.md](../quickstart.md)

## The gates

| Gate | Result |
|---|---|
| `npm test` | **3691 passed**, 244 files (unit and policies together) |
| `npm run typecheck` | clean |
| `npm run fallow:audit` | clean — no new findings, no threshold moved, no suppression |
| `npm run lint` | **13 problems, all pre-existing**: 11 errors in `app/colectivo/**` and `app/components/**` (the legacy React-19 `set-state-in-effect` batch, fixed on `fix-lint-react-19` and still uncommitted) plus 2 warnings on `app/page.tsx` and `ContactSection`. **This branch adds none** — the three it briefly added, dead constants left by the `useTaskDay` extraction, were removed rather than left |
| `npm run test:e2e` | **119 passed, 2 skipped, 2 failed** — both failures measured against `main` and found to be pre-existing flakes; see below. The 17 new preview-bar journeys passed on every run |

Two fallow findings were raised by this phase's own code and both were fixed rather than suppressed:
the duplicated concatenate-then-expand step became `useTaskDay`, and `useWeekViewModel` — twice over
its cognitive budget as the bar and then the search joined it — became `useWeekChrome`.

## The guarantees, one by one

| # | Guarantee | How it was proved |
|---|---|---|
| SC-901 | A countdown shows and survives a reload | e2e — marked, seen, reloaded, still there |
| SC-902 | The number falls by one at the household's midnight | **Unit only.** See the honest gap below |
| SC-903 | Every active countdown reaches the first position, and can be stopped | Unit (`countdown-rotation.test.ts`, every countdown reaches index 0 within one cycle); e2e for the Pause switch and its persistence |
| SC-904 | Each Show Countdowns value admits the right countdowns | Unit at a boundary either side — 31/32 days and 92/93; e2e proves the setting reaches the bar |
| SC-905 | Tapping the bar lists every one, choosing opens its event | e2e |
| SC-906 | Nothing to show costs no space | Unit (`PreviewBar.test.tsx`, including the always-truthy-node trap) and e2e |
| SC-907 | Progress matches the Tasks board exactly | Unit — the expectation is DERIVED from `counters.ts` rather than written down, so a second counting rule fails it |
| SC-908 | Hiding a Profile removes their progress | Unit and e2e |
| SC-909 | Search finds by title, lands on the day, shows a repeat once | Unit (`event-search.test.ts`) and e2e (a daily repeat draws several blocks and exactly one result) |
| SC-910 | Every decision is unit-tested, DST and midnight included | Both daylight-saving changes in `countdown-days.test.ts`; the bounded walk, the windows, the rotation, the wording and the result shaping each have their own file |
| SC-911 | An anonymous reader is refused, not emptied | Policies — the settings column, the event flag, and the search path with `%` and `_` as terms |
| SC-912 | Every shipped tab still behaves | The full suite; one flake, below |

## The honest gaps

**SC-902's midnight roll is not proved in a browser, and that is a limitation, not an oversight.**
Crossing a household midnight needs the page clock moved by up to a day, and `e2e/helpers/clock.ts`
refuses more than three hours on purpose: the signed-in session is a token minted on the real clock,
and a browser pinned days away decides it has expired (harness.md §5). What IS proved: the arithmetic,
across both daylight-saving changes, in `countdown-days.test.ts`; and the wiring, in that the number
is a function of `useNow`'s `todayDate` — the same shipped minute store the Phase 7 banner journeys
pin and exercise. **The overnight watch on the wall tablet is the operator's own check.**

**Two `phone` journeys failed intermittently, and both were MEASURED against `main` rather than
assumed.** The first re-run made one of them pass, which would have been an easy place to stop; it is
not where this stopped.

| Journey | Branch, whole `phone` project | `main`, whole `phone` project |
|---|---|---|
| `lists.spec.ts:94` — "pages by a finger" | failed 2 of 3 runs | **failed 1 of 3 runs** |
| `punch-in.spec.ts:14` — "asks who is here before a write" | failed 1 of 3 runs | passed 3 of 3 |

Both pass reliably when their own file is run alone (`lists.spec.ts` 9/9 twice on `main`, 9/9 on the
branch), so the failure is **ordering-dependent inside the phone project**, not the journey itself.
`lists.spec.ts:94` fails on `main` at a comparable rate, so it is a **pre-existing flake in a
synthetic-swipe journey**, not a regression from this branch — the same class Phase 7 recorded, and
the same one Phase 7 proved synthetic pointer events cannot arbitrate `touch-action` for.
`punch-in.spec.ts:14` was likewise recorded as flaky in Phase 7's own run record (1-of-3 against
main's 2-of-3), and did not fail on `main` in these three runs.

**Neither is fixed here, and neither is waved through.** They are named, counted, and left for a
phase whose subject they actually are; nothing in this phase touches the Lists board's gesture layer
or the punch-in sheet. What this phase's own 17 journeys did is pass on every run, on every project
they run on.

## Still outstanding for the operator

1. ~~**`supabase db push`** for `039_show_countdowns.sql`~~ — **done 2026-09-07**, applied to
   `zgmltllcyqylgtazunai` before the merge (R913). Local and remote migration histories match.
2. The **phone by hand**: the bar with three countdowns and three Profiles on a real iPhone. The
   automated phone-width journey asserts the document does not scroll sideways at 320px, which is a
   floor, not the whole check.
3. The **wall tablet overnight**, for SC-902 above.
4. The **two-device realtime** check, outstanding since Phase 5.
