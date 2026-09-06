# Quickstart run — 006 Family Meals

**Run**: 2026-09-06, branch `006-family-meals`, local stack on 553xx (`supabase db reset` → `npm run family:seed -- --local` → `npm run dev:local`), Chrome DevTools MCP at 1280×800 (wall), 1024×768 and 768×1024 (iPad), 390×844 (phone).
**Commits**: `5956767` (T001–T055), `53199e4` (weekday default, seed dietary note), `9c1e622` (the review's findings), then the docs commit.

## Gates (T058)

| Gate | Result |
|------|--------|
| `npm run fallow:audit` | ✓ No issues in 115 changed files; 3368 unit tests green; duplication 0 new (the two flagged clones were extracted: `NameField`, the shared `weekdayOfDate`) |
| `npm run test:policies` | 29 files, 475 tests green against the reset local stack (030–033 applied, the amended `split_meal_series` lock) |
| `npm run typecheck` | 0 errors |
| `npx eslint app/family lib/family scripts/family-seed.mjs` | 0 errors, 0 warnings |
| `npm run lint` (whole repo) | 11 pre-existing errors in `app/skyhammer`, `app/colectivo`, `app/components/**` (`react-hooks/refs`, untouched by this branch) — outside this phase |
| `npm run graph` | rebuilt |

## Review gate (T059)

A three-lens workflow (correctness, security, spec conformance) over `git diff main...HEAD`, each finding verified by an adversarial reader: 15 agents, 12 findings confirmed, 0 dismissed. Every one was fixed with a red-then-green test in `9c1e622`:

- weekly `reanchoredMealRule` never shifted BYDAY → shifts by the move (`meals-repeat.test`)
- scope-all date change re-anchored the series on the edited occurrence → moves the anchor by the same delta (`mealForm.test`)
- `isFirstOccurrence` judged drawn dates → `isFirstOccurrenceOf` on the series' own dates, skips only (`meals-expand.test`)
- a date move past UNTIL left an unreachable row → `assertMealRuleReachable` (`meals-repeat.test`)
- `mealDateSchema` was a bare regex → `z.iso.date` (`meals-validation.test`)
- `split_meal_series` locked a head that no longer repeated → `rrule is not null` (`meals-schema.test`)
- a meal deleted under an open surface closed silently → "That meal is no longer here." (`MealsBoard.test`)
- a calendar token was named by its recipe only → "Mealtime: name" (`MealRow.test`, `WeekView.test`)
- the shown week re-anchored at midnight → held anchor, Today brings the new week (`useMealWeek.test`)
- a removed recipe's detail offered Plan/Edit/Delete → read-only with Add to List (`RecipePane.test`)
- Add to List said "No list" while the lists were loading → loading/failed states (`AddToListSheet.test`)
- `useHoldPress` timer could outlive the cell → cleared on unmount (`useHoldPress.test`)

Two acceptance scenarios were reworded to the FRs they contradicted (US2 AS5 → FR-604's fixed cell; US5 AS3 → FR-630).

## Seed (T056)

Fresh reset + seed: 4 mealtimes (Breakfast #A8D4D3, Lunch #F66951, Dinner #915EA1, Snack #FDC36D), 7 recipes (Old stew removed, still planned by one meal), 7 meals, the Friday pizza weekly with a skip (18 Sep) and a move (25 → 26 Sep); Cleo carries the dietary note "no nuts". A second seed run re-seeds nothing.

## Hand walk (T060) — quickstart §"Verifying the guarantees"

Punched in as Ana (PIN set in Settings after the reset; Cleo's too).

- **Grid (US1)**: seven days from Sunday with today marked, the rotated rail, cells named "day, mealtime, count/empty"; 1024 wide keeps seven columns; 768 portrait shows five whole days and the phone two, paged by the chassis swipe/arrow keys; the week arrows and Today.
- **Categories**: hide Lunch → its row leaves this device, its meals stay; Edit Snack → "Treats" in Sprout → the rail, the cells and every select follow; the pencil is offered only to a parent.
- **Planning (US2)**: empty Monday Dinner → "Add to Dinner, Monday 7 September", From Recipes with the slot's mealtime chip preselected, Garlic bread → the chip lands; the popover with Open Recipe / Add to List / Edit / Delete / Add another meal; Edit with note + Every week (Monday pre-ticked) → "· repeats" and the note.
- **Repeats and scopes (US5)**: Edit on the repeating occurrence asks "This meal / This and future meals / All meals" in the meal's words; scope This → the sheet without recipe or repeat, dietary note "Cleo: no nuts" beneath; the override "Ana cooks, just this week" on Mon 7 only, Mon 14 keeps the series note; Delete at Mon 14 with This and future → UNTIL=20260913 on the head, the override kept.
- **Recipes (US3)**: the pane lists the six active recipes with mealtime badges (Old stew absent), chips and search; the detail with its text and four actions; New recipe "🥣 Porridge" with the dietary note under the form; Delete Sandwiches → "The 1 planned meal stays / goes too" → recipe and planned meals → both gone.
- **Add to List (US4)**: from the pane's detail, nine lines ticked, three instruction lines unticked, Grocery List first in the chooser → "6 items added to Grocery List." and six items appended after Bagels, Yoghurt in order.
- **Calendar (US6)**: the token row under the day headers on the header grid, tokens in mealtime order named "Dinner: 🍝 Spaghetti"; a token opens the same popover; Filter → Meals → Show Meals off → the row leaves this device (`family:calendar-meals:v1` = `{"showMeals":false}`), Show all brings it back.
- **Console**: no errors or warnings on the Meals tab or the Calendar throughout.

Not walked here: the two-device SC-606 check (the local realtime caveat from Phase 5 stands — verify on hosted after the push); VoiceOver and airplane mode are the operator's device pass (T062).

## Hosted (T061)

_Recorded after the push:_ `supabase db push --linked` (030–033) → §4 checks → `npm run family:seed -- --yes` → four mealtimes → merge → deploy → live check.
