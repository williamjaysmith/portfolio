# Quickstart run record — 009 The Calendar's Preview Bar

**Run**: 2026-09-07 · **Branch**: `009-calendar-preview-bar` · **Stack**: local (553xx)
**Quickstart**: [../quickstart.md](../quickstart.md)

## The gates

| Gate | Result |
|---|---|
| `npm test` (unit) | **3180 passed**, 212 files |
| `npm test` (policies) | **511 passed**, 32 files |
| `npm run typecheck` | clean |
| `npm run fallow:audit` | clean — no new findings, no threshold moved, no suppression |
| `npm run lint` | **11 errors, all pre-existing** in `app/colectivo/**` and `app/components/**` — the legacy React-19 `set-state-in-effect` batch this branch did not touch, fixed on `fix-lint-react-19` and still uncommitted |
| `npm run test:e2e` | **120 passed, 1 failed, 2 skipped** on the first run; see below |

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

**`lists.spec.ts` › "pages by a finger" failed once on `phone` and passed on its own re-run**
(9/9 for that file in isolation). It is a synthetic-swipe journey on the **Lists** tab and touches
nothing this phase changed. The same class of flake was recorded in Phase 7's run against a swipe
journey; it is not a regression from this branch, and it is written down rather than re-run until
green and forgotten.

## Still outstanding for the operator

1. **`supabase db push`** for `039_show_countdowns.sql` to the hosted project — before the merge,
   with explicit approval (R913). The e2e suite must never reach it.
2. The **phone by hand**: the bar with three countdowns and three Profiles on a real iPhone. The
   automated phone-width journey asserts the document does not scroll sideways at 320px, which is a
   floor, not the whole check.
3. The **wall tablet overnight**, for SC-902 above.
4. The **two-device realtime** check, outstanding since Phase 5.
