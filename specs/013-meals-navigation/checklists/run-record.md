# Phase 013 run record — the Meals tab navigates like the Calendar

**Branch**: `013-meals-navigation` · **Date**: 2026-09-10
**Commits**: `82bed46` (spec + clarify), `cd62a91` (research/plan/data-model/quickstart),
`3011391` (the pure window), `e1b4d11` (the grid), `e365b45` (the journeys)

## The gates

| Gate | Result |
|---|---|
| `npm run fallow:audit` | **clean** — 0 findings across 23 changed files |
| `npm test` | **3813 passed**, 253 files |
| `npm run typecheck` | **clean** |
| `npm run lint` | **no new problems.** 11 errors remain in `app/skyhammer`, `app/colectivo` and `app/components/**` — pre-existing, untouched by this branch, the subject of the `fix-lint-react-19` stash |
| `npm run test:e2e` | **155 passed, 2 failed, 3 skipped, 8.0 min** — see "The browser pass" |

No suppressions. `openOn`'s removal surfaced nothing to suppress, because its four
tests went with it.

## Before and after, measured

Production build (`next build` + `next start`) against the local stack, signed in.

### Before

| Width | Columns drawn | Days shown | Arrows move | Arrows say | CLS |
|---|---|---|---|---|---|
| 390 | 2 | Thu 10 – Fri 11 | 7 days | "week" | 0 |
| 768 | 5 | Tue 8 – Sat 12 | 7 days | "week" | 0 |
| 1024 | 7 | Sun 6 – Sat 12 | 7 days | "week" | 0 |
| 1280 | 7 | Sun 6 – Sat 12 | 7 days | "week" | 0 |

At 390 and 768 the arrows moved seven days while two and five were on screen, so
five and two days per step were reachable only by a swipe nobody was told about.

### After

| Width | Columns | Opens on | One step forward | Arrows say | Abuts | Returns | CLS |
|---|---|---|---|---|---|---|---|
| 390 | 2 | Thu 10 – Fri 11 | Sat 12 – Sun 13 | **"2 days"** | yes | yes | **0** |
| 768 | 5 | Thu 10 – Mon 14 | Tue 15 – Sat 19 | **"5 days"** | yes | yes | **0** |
| 1024 | 7 | Thu 10 – Wed 16 | Thu 17 – Wed 23 | "week" | yes | yes | **0** |
| 1280 | 7 | Thu 10 – Wed 16 | Thu 17 – Wed 23 | "week" | yes | yes | **0** |

Every window begins on today. Consecutive windows abut. A step back returns
exactly. **"week" appears only where seven days IS the width** — there is no
branch for seven anywhere in the code, which is the test that the rule was
understood rather than special-cased.

## Each criterion, and what proved it

| | Criterion | Proved by |
|---|---|---|
| SC-1301 | every day in a fortnight reachable by the arrows alone at 390px | `meals-window.test.ts` walks it at 2, 5 and 7 columns; `meals.spec` "skips no day across several steps" walks four steps in a browser |
| SC-1302 | 1280px draws seven and moves seven | measured above; `MealsBoard.test.tsx` is the seven-column case, since jsdom measures nothing and the board draws its unmeasured ceiling |
| SC-1303 | five forward, five back, returns | `meals-window.test.ts` abutment; `meals.spec` forward-then-back |
| SC-1304 | today first at all four widths | measured above; `meals.spec` "opens on today, and Today brings it back" |
| SC-1305 | CLS 0 at all four widths | measured above |
| SC-1306 | the arrows state the distance they travel | measured above; `meals.spec` "the arrows say how far they go" derives the expected wording from the drawn count |
| SC-1307 | Tasks, Lists and Rewards unchanged | **18/18 on wall.** The one failure was `tasks.spec:69`, the documented time-of-day known-open, already proven twice to fail independently of this branch |
| FR-1308 | the midnight hold | `useMealWindow.test.ts`, and **nowhere else** — the e2e clock helper refuses jumps over three hours (009). Driven against the real clock store on its one-second interval rather than a mock, so the guarantee holds against the clock that ships. The overnight watch on the wall tablet is the operator's |

## Three things found while building

**The first paint draws seven columns and the measurement narrows it.** The server
cannot measure a viewport, so the grid renders its unmeasured ceiling and then
settles. On a phone that is seven columns replaced by two, inside the initial
paint — CLS stays 0, but it broke a journey helper of mine that counted columns
immediately and then failed a line later with a confusing message. `daysShown` now
waits for two reads to agree, and that wait is documented as behaviour rather than
padding.

**The seed anchors its meals on the week's SUNDAY, at +0, +3 and +6 days.** With a
window that begins on today, on a Thursday the Sunday breakfast and the Wednesday
dinners sit behind it. Two wall journeys needed a `findSeededMeal` helper that
pages back until it finds the meal, because how far back depends on the day the
suite runs.

**Recorded and NOT fixed**: the same arithmetic means a household opening Meals on
a Thursday with a freshly seeded database sees an emptier grid than before.
It affects the dev seed, not the real household, who plan forwards. Re-anchoring
the seed from today is the fix; it touches fixtures `harness.md` §3 documents and
several specs name by date, which is not a change to make at 03:40.

## The browser pass

**155 passed, 2 failed, 3 skipped, 8.0 minutes.**

| Failure | Verdict |
|---|---|
| `[wall] tasks.spec:69` | the documented time-of-day known-open. Proven twice this week to fail independently of the branch under test |
| `[tablet-landscape] meals.spec:90` | **passes 11/11 when its file runs alone on that project.** The interference class 012 documented: a failing journey leaves rows its cleanup never removed, and the failing set moves between runs |

The 3 skips are `lists.spec:94` on the three touch profiles — `swipeBoard` drives
`page.mouse`, which cannot reach framer's `onPan` on WebKit. Its reason is printed
and its claim is covered three other ways (012).

## What this phase reversed, on the record

**006 Assumption 3**: *"the seven days from the household's start day, a whole week
at a time — a planning grid, not the calendar's rolling window anchored on today"*.

Reversed because the devices the household actually uses contradicted it. The
operator's report, in their words: the tab *"doesn't really navigate days the way
calendar view does … calendar does it well on all my devices"*, and *"a week view
for meals is good enough but only if it navigates correctly"*.

Not a divergence from the reference: the 7-column grid is `[VERIFIED]` and
untouched. The navigation was `[UNKNOWN]`, and our own research had already
inferred parity with the Calendar tab
(`03-lists-meals-recipes.md:105`), which this restores.

**One further step from the reference, chosen by the operator rather than assumed**:
the window begins on today at every width, so the wall tablet shows a rolling seven
days rather than a Sunday-anchored week. They were shown a width-dependent
alternative that would have preserved the Sunday anchoring — moving seven days from
a Sunday always lands on a Sunday — and chose the single rule. Recorded in the
spec's Clarifications.

## Still the operator's

- The overnight watch: leave the grid open on the wall tablet across midnight and
  confirm today's marker moves while the window stays put.
- Whether the dev seed should anchor its meals from today (above).
- `tasks.spec:69` and `lists.spec:94`, both pre-existing and both documented.
