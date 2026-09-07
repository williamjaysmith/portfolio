# Quickstart run — 007 Family End-to-End Pass

**Run**: 2026-09-06, branch `007-family-e2e`, local stack on 553xx, Chromium at the wall (1280×800)
and WebKit at 1024×768, 768×1024 and 390×844.
**Command**: `npm run test:e2e` — nothing else prepared by hand.

## What the suite is, after this feature

| | |
|---|---|
| Journeys | 53 at the wall, of which 12 also run on each of the three device profiles |
| Files | 9 spec files, 8 helpers, 1 setup project |
| Full run | **2.8 minutes** at the wall; 2.5 minutes for the three device profiles; both well inside SC-702's ten |
| Door and punch-in alone | 42 seconds, inside SC-702's minute |
| Skips | the two live-update journeys, with their reason printed (below) |

## The gates (T065)

| Gate | Result |
|------|--------|
| `npm run test:e2e` | 51 passed, 2 skipped, 0 failed at the wall; 38 passed on the device profiles |
| `npm run fallow:audit` | clean — no new dead code, duplication or complexity |
| `npm test` | green |
| `npm run test:policies` | green |
| `npm run typecheck` | 0 errors |
| `npx eslint app/family lib/family e2e playwright.config.ts` | 0 errors, 0 warnings |
| `npm run lint` (whole repo) | the 11 pre-existing `react-hooks/refs` errors in `/skyhammer`, `/colectivo` and the marketing components, untouched by this branch |

No threshold was lifted, no baseline bumped, no suppression added. Two pieces of configuration were
added and are named here so they can be judged: `e2e/**` joins the quality tool's existing `tests`
zone (it is tests), and the React hooks rule is scoped away from `e2e/**` (Playwright hands each
fixture a `use` callback, which the React plugin reads as the `use` hook; no rule is weakened
anywhere React runs).

## What the suite found (FR-727)

Seven defects in shipped code, each fixed on this branch. Five could not have been found any other
way: they depend on a real browser, a real pointer, a measured layout or a real palette.

1. **A tap on a calendar event never opened its details** (Phase 2, `4b22560`). The drag took the
   pointer capture at the press, on the hour grid's scroll container; a captured pointer decides
   where the browser sends the click that follows, so every tap's click landed on the container and
   the block's own handler never ran. FR-256's "a press that never travels is a tap" held for the
   keyboard and not for a pointer. The capture now waits until the press becomes a drag, which is
   when it is needed. Confirmed by hand in Chrome before and after.
2. **A paged Tasks board reordered the wrong column** (Phase 3, `8adf2ac`). The reorder machine
   matches a pressed row to an item by position among the rendered rows, and a paged board renders
   only its window — so on any page but the first, pressing the leftmost header picked up the
   household's first Profile. The board now hands the machine the columns it is showing, which is
   what `householdOrderOf` was written for.
3. **The calendar's hour grid could not be reached by keyboard** (`4b9d63f`). It scrolls, and with no
   events in view there was nothing inside it to tab to. It now takes focus and says what it is.
4. **A reward bar drew its fill label at zero fill** (`4b9d63f`), where it reads as pale text on the
   track. It is drawn only when there is fill to clip it to.
5. **A checked list item's ink fell under the contrast floor** on a tinted card, 4.35:1 (`4b9d63f`).
   The line through it and the tick beside it say "done"; the text keeps its own ink.
6. **A list's count badge was white on the list's own colour** (`892d121`… `1d260d7`), 1.7:1 on a
   light palette entry. It now chooses its ink against its fill, as every other tinted surface does.
7. **Six identical "Edit", "Delete" and "Set PIN" buttons on Settings** (`09966f9`) — one per
   Profile, none saying whose. Each is now named for its Profile, which is what let the suite reach
   them at all.

Each fix carries its own unit test where one can exist. Two cannot: (1) and (2) depend on pointer
capture and on a measured, paged board, neither of which exists in a simulated DOM — their
regression tests are the browser journeys that found them, named in the commits above.

## Proving the suite can fail (SC-713, T061)

For each of the six writing surfaces, one deliberate fault made the write silently not persist —
the action returned success and wrote nothing — and the matching journey was run. Every one failed,
and the tree was left clean afterwards.

| Fault | Journey | Result |
|---|---|---|
| `createEvent` | the calendar's create | **failed**, as it must |
| `completeTaskOccurrence` | ticking a chore | **failed** |
| `redeemReward` | redeeming a reward | **failed** |
| `addListItem` | adding a list item | **failed** |
| `planMeal` | planning a meal | **failed** |
| `setProfilePin` | the punch-in gate | **failed** |

## The suite's own rules (T063)

| Rule | Check |
|---|---|
| No fixed delays (FR-710) | no `waitForTimeout` or sleep anywhere in `e2e/**` |
| Accessible names, not styling (FR-709) | no class or style selector; four structural locators, each a label around a screen-reader-only input or the topmost open dialog, each explained where it is used |
| Local only (FR-703, SC-711) | no address, key or flag but the local stack's, which comes from `supabase status` through the same helper the seed uses. The saved sign-in and every artefact are gitignored |
| Reads its result back (FR-721) | every writing journey re-asserts after a reload |

## Live updates (FR-725, SC-707)

**Skipped, with the reason printed**: the probe found no `realtime.subscription` row after both
browsers had a `/family` page mounted — the same gap seen in Phases 5 and 6 with the local realtime
image, where a Node client subscribes and a browser does not. The journeys are written and will run
the moment the environment can carry them; on the hosted project the two-device check remains the
operator's, as it has been each phase.

## Notes for whoever runs this next

- The suite resets and seeds the database, so anything typed into the local app by hand is gone when
  it runs. That is the point, and it is why it never touches the hosted project.
- The development server is started by the runner and reused if one is already up.
- A failure leaves a trace, a screenshot and the console; `npm run test:e2e:report` opens them.
- The accessibility sweep runs with reduced motion. Without it, it catches the celebration banner
  mid-entrance and measures half-faded ink rather than the app's colours.
