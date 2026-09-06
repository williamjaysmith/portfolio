# Tasks: Family Meals

**Input**: Design documents from `/specs/006-family-meals/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md — all final

**Tests**: Included and mandatory. The constitution (§II) makes test-first non-negotiable for pure logic, and this phase's pure logic is what two devices and two screens must agree on: which meals land in which slot of a week (the rule walk, the skips, the moves), the slot order, the rule round-trips, the week from the start day, the line split, the library filter, the two visibility rules. Every pure module, every migration and every action lands red first.

**Organization**: Grouped by user story in the spec's priority order. Setup (including the three generalisations, R608) and Foundational block every story; then US1 (the grid and the mealtimes), US2 (planning), US3 (recipes), US4 (ingredients to a list), US5 (repeats), US6 (the calendar), then Polish.

**Phases 1–5 are shipped and live.** Nothing here forks them. No shipped table changes shape; no trigger writes; the one function on the write path is the mirrored split (R603). The three refactors — `ScopeDialog`, `RepeatFieldset`, `ConfirmDialog` moving to `(app)/components/` — are behaviour-preserving and land first, green, before any meal code.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US6 from spec.md; Setup, Foundational and Polish tasks carry none
- Every task names its files; `(~)` marks a shipped file amended

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the four migrations, the fallow zone, the tokens, the seed, and the three generalisations — written against data-model.md and research.md before anything is applied.

- [x] T001 [P] Migration `supabase/migrations/030_meal_categories.sql` — `family.meal_categories` (`name` 1–40 trimmed, `color family.palette_color not null`, `position` unique per household, attribution set-null, timestamps, `unique (id, household_id)`, the `(household_id, lower(trim(name)))` unique index), the touch trigger, `seed_default_meal_categories(uuid)` (`security definer`, `search_path = ''`, by emptiness: Breakfast `#A8D4D3` 1, Lunch `#F66951` 2, Dinner `#915EA1` 3, Snack `#FDC36D` 4; revoked from public/anon/authenticated, granted to service_role), RLS `members read meal categories`, grants, `notify pgrst`. Serves FR-608–FR-612, R601, R613
- [x] T002 [P] Migration `supabase/migrations/031_recipes.sql` — `family.recipes` (`name` 1–120 trimmed, `category_id` composite FK `(category_id, household_id)` → `meal_categories` on delete restrict, `text` ≤ 10 000 default `''`, `removed_at`, attribution, timestamps, `unique (id, household_id)`, the `(household_id, removed_at)` index), touch trigger, RLS, grants. Serves FR-613–FR-617, R601
- [x] T003 [P] Migration `supabase/migrations/032_meals.sql` — `family.meals` (`date`, `category_id` restrict, `recipe_id` composite FK **cascade**, `note` null or 1–200 trimmed, `rrule` under 023's grammar with no `COUNT` and a date-form `UNTIL` only, attribution, timestamps, `unique (id, household_id)`, the two partial indexes), `family.meal_exceptions` (`meal_id` composite FK cascade, `occurrence_date`, `action in ('skip','override')`, `date`, `category_id` restrict, `note` ≤ 200, `unique (meal_id, occurrence_date)`, `meal_exception_payload_shape`), `split_meal_series(uuid, uuid, uuid, text, date, jsonb)` mirroring 015 (lock the head, truncate, insert the tail from the jsonb, re-home exceptions on/after the cut, return the tail id; revoked/granted as 015), touch triggers, RLS on both, grants, `notify pgrst`. Serves FR-622–FR-630, R601–R603
- [x] T004 [P] Migration `supabase/migrations/033_realtime_meals.sql` — the 027/029 guard block verbatim over `meal_categories`, `recipes`, `meals`, `meal_exceptions`; replica identity left default; `notify pgrst`; the Hard ordering comment. Serves FR-643, R605
- [x] T005 [P] `.fallowrc.json` — the `family-meals-core` zone (`lib/family/meals/**/*`) before the catch-all `lib` zone, its rule (`family-meals-core`, `family-recurrence`, `family-calendar-core`, `lib`), and the name added to the allow lists of `family-actions`, `components`, `ui-pages`, `tests` — not `lib` (R617)
- [x] T006 [P] `app/family/tokens.css` — the Meals section (R614): `--fam-meal-cell-w 235`, `--fam-meal-cell-h 250`, `--fam-meal-gap-x 20`, `--fam-meal-gap-y 38`, `--fam-meal-cell-r 25`, `--fam-meal-rail-w 40`, `--fam-meal-popover-w 700`, `--fam-meal-popover-r 32` (each `× --fam-u`, `[ESTIMATED]`), `--fam-fs-meal-cell 30` (`[SAMPLED]`, on `--fam-t`), the "WHAT IS REUSED" list (the tint ladder for the rows, `--fam-allday-h` for the calendar token, the pill and touch tokens); unit test `lib/family/__tests__/unit/meal-tokens.test.ts` reading each back (SC-611)
- [x] T007 **Three shipped pieces generalise** (R608; constitution §I): `app/family/(app)/calendar/components/ScopeDialog.tsx` → `app/family/(app)/components/ScopeDialog.tsx` with a `noun: "event" | "meal"` prop (default `"event"`) driving the titles and the three option labels ("This meal" / "This and future meals" / "All meals"), its test moved and extended for the noun; `RepeatFieldset` extracted from `calendar/components/EventForm.tsx` into `components/RepeatFieldset.tsx` behind a `RepeatDraft` interface (`repeatKind`, `weekdays`, `until`, `setRepeatKind`, `toggleWeekday`, `set("until")`, `errors.repeat`) that `EventFormState` already satisfies, with its RTL test; `lists/components/ConfirmDialog.tsx` → `components/ConfirmDialog.tsx`, its test moved, the Lists imports updated. Every calendar and Lists test green; both screens unchanged by hand
- [x] T008 [P] `scripts/family-seed.mjs` — `ensureHousehold` calls `rpc("seed_default_meal_categories")` after `seed_default_lists` in **both** modes (R613); `--local` fixtures by fixed id (recipes `…0007NN`, meals `…0008NN`, exceptions `…0009NN`): recipes **Pancakes** (Breakfast, a four-line text), **Sandwiches** (Lunch), **🍝 Spaghetti** (Dinner, nine lines: six ingredients, three steps), **Garlic bread** (Dinner), **🍕 Pizza** (Dinner), **Banana bread** (Snack, with text), **Old stew** (Dinner, `removed_at` set); meals in the current household week: Sun Breakfast Pancakes, Wed Lunch Sandwiches, Wed Dinner Spaghetti + Garlic bread (note "Ben cooks"), Sat Snack Banana bread, Fri Dinner 🍕 Pizza `FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=<+8 weeks>` with a **skip** on the second Friday and an **override** moving the third Friday to Saturday, and yesterday's Dinner **Old stew**; idempotent by emptiness of `meals`; a log line per group

**Checkpoint**: 030–033 review clean against data-model.md; the three generalisations are green and behaviour-identical; nothing meal-shaped exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the schema proved by tests before the code that uses it; the types, reads, pure modules and actions every story renders from.

### Schema, test-first (write red against the running 553xx stack — still on 001–029 until T012 resets it)

- [x] T009 [P] Failing policies test `lib/family/__tests__/policies/meals-schema.test.ts` — the four tables exist; name bounds and the case-insensitive unique index (`"tea"` vs `"Tea"` refused); `color` must be a palette member; `position` unique; recipe name/text bounds; `removed_at` nullable; meal `note` bounds; the `rrule` CHECK (accepts `FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20261231`, refuses `COUNT=`, an instant `UNTIL=…T235959Z`, a bare `FREQ=`); `meal_exception_payload_shape` (a skip with a payload refused, an override without one refused); one exception per occurrence; cascades — delete a recipe → its meals → their exceptions gone; `on delete restrict` — a category referenced by a recipe cannot be deleted; attribution nulls when a Profile goes; `seed_default_meal_categories` inserts four then 0; `split_meal_series` — head truncated, tail inserted, exceptions on/after the cut re-homed, atomic on a bad payload (nothing changes)
- [x] T010 [P] Failing policies test `lib/family/__tests__/policies/meals-access.test.ts` — SC-609 per table: `anon` refused (`42501`), another household's member reads zero rows, this household's member reads its rows and cannot insert/update/delete; the two functions not executable by `authenticated`
- [x] T011 [P] `lib/family/__tests__/policies/privileges.test.ts` (~) — the six new rows of the privilege matrix (four tables, two functions)
- [x] T012 `supabase db reset` onto 001–033, `npm run family:seed -- --local`; T009–T011 green; `npm run test:policies` whole-suite green

### Rows, types, validation, reads, channel, nav

- [x] T013 [P] `lib/family/types.ts` (~) — `MealCategory`, `Recipe`, `Meal` (with `exceptions: MealException[]`), `MealException`, `MealOccurrence` (`mealId`, `occurrenceDate`, `isRepeating`, `date`, `categoryId`, `recipeId`, `note`), `RecipeChoice`, `MealScope` (= `Scope`), `CalendarMealSwitches`; `lib/family/rows.ts` (~) — `MEAL_CATEGORY_COLUMNS`, `RECIPE_COLUMNS`, `MEAL_COLUMNS` with the `meal_exceptions(...)` embed built as the events select is (never a template literal a bundler can break), `toMealCategory`, `toRecipe`, `toMeal`; unit test `lib/family/__tests__/unit/meals-rows.test.ts`
- [x] T014 [P] `lib/family/validation.ts` (~) — `mealtimeNameSchema` (1–40 trimmed), `updateMealCategorySchema`, `recipeNameSchema` (1–120), `recipeTextSchema` (≤ 10 000), `createRecipeSchema`, `updateRecipeSchema`, `deleteRecipeSchema` (`mode`, `confirm: z.literal(true)`), `mealNoteSchema` (≤ 200, `''` → null), `repeatInputSchema` (the calendar's `RepeatChoice` shape), `recipeChoiceSchema`, `planMealSchema`, `updateMealSchema` (scope optional, the `this` + `recipeId`/`repeat` refusal as a superRefine), `deleteMealSchema` (`confirm: true`), `addListItemsSchema` (1–200 texts, each trimmed non-blank); messages in the household's words ("Keep it under 40 characters.", "That name is already used.", "Choose a scope for a repeating meal.", "A recipe can only change for the whole series."); unit test `lists-validation`'s sibling `meals-validation.test.ts`
- [x] T015 [P] `lib/family/queries.ts` (~) — `familyKeys.mealCategories`, `familyKeys.recipes`, `familyKeys.meals` (all under `familyKeys.all`); `fetchMealCategories` (by `position`), `fetchRecipes` (by `name`), `fetchMeals` (by `date`, exceptions embedded) on `fetchInRowOrder`'s pattern; `useMealCategories`, `useRecipes`, `useMeals` with `initialData`; unit test `meals-queries.test.ts` (keys under `all`, the hooks seed their key)
- [x] T016 [P] `app/family/(app)/components/useFamilyRealtime.ts` (~) — `meal_categories`, `recipes`, `meals`, `meal_exceptions` appended with the R605 comment; `app/family/(app)/components/nav.ts` (~) — `meals: showsChipRow: false`; `nav.test.ts` extended (FR-606)
- [x] T017 [P] `lib/family/permissions.ts` (~) — operations `mealtime.edit` (parent only), `meal.write`, `recipe.write` (open to any punched-in Profile, via `memberMayWriteList`'s sibling `memberMayWriteMeals`); `permissions.test.ts` MATRIX rows and count updated (FR-639, FR-640)

### Pure modules, tests first (`lib/family/meals/`, zone `family-meals-core`)

- [x] T018 [P] Failing unit test `lib/family/__tests__/unit/meals-expand.test.ts` then `lib/family/meals/expand.ts` — `expandMeals(meals, range, zone): MealOccurrence[]`: a one-off inside/outside the range; a weekly rule on chosen weekdays counting from the meal's date; daily and monthly walks; the end date inclusive; a skip removes; an override moves the drawn date (into the window from outside, out of the window from inside — keyed by the original date), replaces the category, replaces or clears the note; `isRepeating`; ordering by date then planning order (R602)
- [x] T019 [P] Failing unit test `meals-slots.test.ts` then `lib/family/meals/slots.ts` — `slotKeyOf(date, categoryId)`, `slotsOf(occurrences): Map<string, MealOccurrence[]>` in planning order (`createdAt`, then id)
- [x] T020 [P] Failing unit test `meals-repeat.test.ts` then `lib/family/meals/repeat.ts` — `mealRuleOf(choice, date): string | null` (never → null; daily; weekly with the chosen weekdays, `wkst` from the household; monthly on the date's day; `until` as a date UNTIL; an `until` before the date throws the field error), `mealRepeatChoiceOf(rrule)` (the round trip), `truncatedMealRule(rrule, cut)` (UNTIL = cut − 1 day; a rule already ending before the cut unchanged) — on `parseRule`/`emitRule`, never a hand-built string
- [x] T021 [P] Failing unit test `meals-week.test.ts` then `lib/family/meals/week.ts` — `weekDatesOf(anchorDate, startWeekOn): string[]` (seven, from the start day, on the calendar's `weekStartOf`/`addDays`), `shiftWeek(anchorDate, weeks)`, `weekLabelOf(dates)` ("7–13 September"), `visibleSliceOf(dates, perRow, page)` (FR-603)
- [x] T022 [P] Failing unit test `meals-lines.test.ts` then `lib/family/meals/lines.ts` — `linesOf(text): { text: string; truncated: boolean }[]` (any line break, trimmed, blanks dropped, cut to 200 with `truncated`) (R610)
- [x] T023 [P] Failing unit test `meals-library.test.ts` then `lib/family/meals/library.ts` — `activeRecipes(recipes)` (`removedAt === null`), `filterRecipes(recipes, { categoryId, query })` (case-insensitive over name **and** text; every word of the query must match), `recipesByName`
- [x] T024 [P] Failing unit test `meals-visibility.test.ts` then `lib/family/meals/visibility.ts` — `shownCategoriesOf(categories, hiddenIds)` in position order; `mealTokensOf(occurrences, categories, hiddenIds, showMeals): Map<date, MealOccurrence[]>` in mealtime order, empty when `showMeals` is off (FR-611, FR-635, FR-637)
- [x] T025 [P] Failing unit test `meals-dietary.test.ts` then `lib/family/meals/dietary.ts` — `dietaryNotesOf(profiles): { name, note }[]` for non-blank notes only, in profile order (FR-638)

### Actions, tests first

- [x] T026 Failing policies test `lib/family/__tests__/policies/meals-actions.test.ts` — with a signed actor cookie per role: `updateMealCategory` rename/recolour as a parent, `FORBIDDEN` as a member, `CONFLICT` on a taken name (case-insensitive), `NOT_FOUND` across households; `createRecipe`/`updateRecipe` (a removed recipe → `NOT_FOUND`); `deleteRecipe` both modes (`removedMeals` counts; the meals kept or cascaded); `planMeal` existing/new (the new recipe created in the slot's category), with `repeat`, a removed recipe refused, an `until` before the date refused; `updateMeal`: one-time (no scope; a scope → `VALIDATION`), `this` (override upserted and merged; `recipeId` → `VALIDATION`), `this_and_future` (first occurrence → as `all`; otherwise the split: head truncated, tail with the patch, exceptions re-homed), `all`; `deleteMeal`: one-time, `this` (skip; an override becomes a skip), `this_and_future` (truncate), `all` (cascade); a wrong `occurrenceDate` → `NOT_FOUND`; `addListItems` (N rows, consecutive `sort_order` after the last, ungrouped, attributed, a Parents only list → `NOT_FOUND` for a member); every write refused with `NO_ACTOR` when nobody is punched in
- [x] T027 `lib/family/actions/meals.ts` — the seven actions of contracts/server-actions.md, one statement each (the split excepted): `loadCategory`, `loadRecipe` (active unless told otherwise), `loadMeal` (with exceptions), `requireOccurrence` (via `expandMeals` over a one-day range), the scope helpers `overrideThis`, `skipThis`, `splitFrom`, `truncateFrom`, `updateAll`, `deleteAll`, `requireScope`/`refuseScope`; `mapDbError` extended for the unique-name violation → `CONFLICT` with `fields.name`; `touchActor` on every write. Serves FR-615, FR-616, FR-622–FR-630, FR-639–FR-642 (R603, R604)
- [x] T028 `lib/family/actions/lists.ts` (~) — `addListItems({ listId, texts })`: `loadList` (the Parents only rule), `itemsOfList`, one INSERT of N rows with `sort_order = nextSortOrder + i × gap`, `section: null`, `created_by` the actor; returns `{ added }` (R610)
- [x] T029 T026 green; `npm run test:policies` whole-suite green; `npm run fallow:audit` clean (CRAP: the actions covered by the policies tier, the pure modules by unit)

**Checkpoint**: the schema, the reads, the pure rules and the eight actions exist and are proven; no pixel has been drawn.

---

## Phase 3: User Story 1 — The Meals grid and its mealtimes (Priority: P1) 🎯 MVP

**Goal**: the placeholder replaced by the week grid on the shipped chassis — seven day columns, today marked, the rail, four mealtime rows in their colours, week arrows and Today, the paging swipe — with the Categories sheet's per-device show/hide and the parent's rename/recolour.

**Independent Test**: spec US1's six scenarios by hand at 1920×1080, 1180×820, 820×1180 and 390×844; the RTL suites below.

- [x] T030 [P] [US1] Failing RTL `app/family/(app)/meals/components/__tests__/MealsBoard.test.tsx` — seven day headers from the household's start day with today marked; four rail rows in position order and colour; a cell per day × shown mealtime named "Wednesday 9 September, Dinner, 2 meals" / "…, empty"; arrows shift the week, Today returns; a hidden mealtime's row absent, its meals untouched; the "No mealtimes shown on this device" note when all four are hidden; the FAB reads "Add Meal"; no chip row; the read error as the one line
- [x] T031 [P] [US1] Failing RTL `__tests__/CategoriesSheet.test.tsx` — four rows with a checkbox named by the mealtime and its state; the pencil offered to a parent, absent for a member and for nobody; the form's name and colour; a `CONFLICT` shown against the name; the hidden set written to `family:meal-hidden:v1`
- [x] T032 [US1] `app/family/(app)/meals/page.tsx` (~) — replaces `Placeholder`: `getMember`, the session client, `Promise.all([fetchMealCategories, fetchRecipes, fetchMeals])` → `<MealsBoard initialCategories initialRecipes initialMeals />`; `MealsUnavailable` ("Meals can't be loaded right now. Everything else still works.") (FR-601)
- [x] T033 [US1] `meals/components/useMealWeek.ts` (the anchor from `weekStartOf(today, startWeekOn)`, an offset, `page(±1)`, `today()`, the household clock's `todayDate`), `useHiddenMealtimes.ts` (`createDeviceKeySet("family:meal-hidden:v1")`, `isHidden`, `toggle`, `persistent`), `WeekNav.tsx` (‹ Today ›, the label), `MealRail.tsx` (the shown mealtimes as an accessible list; names rotated −90° by CSS; rows at `--fam-meal-cell-h`), `MealDayColumn.tsx` (the day header with the calendar's today marker; a `MealCell` per shown mealtime), `MealCell.tsx` (the slot surface: `data-slot`, a button named by day, mealtime and count; chips in planning order; tap → `onAdd(slot)`), `MealChip.tsx` (the meal's name on its mealtime's tint; a button named by the meal → `onOpen(occurrence)`) (FR-602–FR-605, R606, R607)
- [x] T034 [US1] `meals/components/MealsBoard.tsx` — the model split from the start (plan §V): `useMealsData` (the three reads, `expandMeals` over the week, `slotsOf`, `shownCategoriesOf`), `useMealsView` (`useBoardGeometry(7, { widthToken: "--fam-meal-cell-w", layoutOf: rowLayoutOf })` + `useColumnPage` + `useMealWeek` + the hidden store), `useMealEditor` (`useWriteSurface` over `closed | categories | category-form | …` — the later stories add their surfaces), `useMealWrites` (`useSerialisedWrites` bound to the eight actions; keys `meal:<id>`, `recipe:<id>`, `category:<id>`, `push:<listId>`); `PagedColumns` over the seven `MealDayColumn`s with the rail beside it and `label="Meals"`; `BoardNotice`; the empty-rows note; `useRegisterFabAction("Add Meal", …)` (FR-606, FR-607)
- [x] T035 [US1] `CategoriesSheet.tsx` (four rows: the switch bound to the hidden store; the pencil for a parent → `CategoryForm.tsx` — name, colour via the settings `ColorPicker`, `useDraft` + `useSubmission`, `updateMealCategory` through `withActor`); the Categories control in the tab's top bar beside Filter (FR-610–FR-612, FR-640)
- [x] T036 [US1] T030–T031 green; `npm run typecheck`; `npx eslint app/family lib/family`; `npm run fallow:audit`; commit

**Checkpoint**: US1's six scenarios by hand on the local stack; four viewports show 7 / whole / whole / 1 columns, a swipe pages by what fits, the page never scrolls sideways; a member sees no pencils.

---

## Phase 4: User Story 2 — Planning a meal (Priority: P2)

**Goal**: the add sheet (From Recipes / New Entry, note, the dietary notes), the popover (Open Recipe / Add to List / Edit / Delete / Add another meal), edit and delete of a one-time meal, several meals per slot via the hold, every write through the queue.

**Independent Test**: spec US2's eight scenarios by hand on two devices; the RTL suites below.

- [x] T037 [P] [US2] Failing RTL `__tests__/MealSheet.test.tsx` — the slot's date and mealtime prefilled and changeable; From Recipes lists active recipes with the slot's mealtime first, with chips and search; New Entry takes a name and optional text; the note field; the dietary notes ("Cleo: no nuts", none for a Profile without one); Save calls `planMeal` with the choice; a refusal shown at its field; Cancel/Escape close
- [x] T038 [P] [US2] Failing RTL `__tests__/MealPopover.test.tsx` — the name, "Wednesday 9 September · Dinner", the note; the five actions; Delete confirms by name then calls `deleteMeal` (no scope on a one-time meal); "Add another meal" opens the sheet for the slot; a vanished meal closes it with the gone message
- [x] T039 [P] [US2] Failing RTL `__tests__/MealCell.test.tsx` — a tap on an empty cell calls `onAdd`; a tap on a chip calls `onOpen`; a press-and-hold (400 ms, fake timers) on a filled cell calls `onAddAnother`; movement before the hold cancels it; the keyboard: Enter on the cell adds, Enter on a chip opens
- [x] T040 [US2] `useHoldPress.ts` (400 ms, `pointerdown` → timer, `pointermove` beyond 8 px or `pointerup`/`cancel` clears; `data-held` while armed), `RecipePicker.tsx` (the two modes; chips + search on `filterRecipes`; the slot's mealtime first), `DietaryNotes.tsx`, `MealSheet.tsx` + `useMealForm.ts` (`MealDraft { date, categoryId, recipe: RecipeChoice | null, note, repeatKind, weekdays, until }`; validation before send; `planMeal` or `updateMeal`), `MealPopover.tsx` (the surface for a `MealOccurrence`; Open Recipe → the recipe detail; Edit → the sheet in edit mode; Delete → `ConfirmDialog`), the editor's surfaces `add | edit | popover | delete-meal` and the gone-check on the meal (FR-622–FR-626, FR-638, R607, R608, R612)
- [x] T041 [US2] T037–T039 green; gates; commit

**Checkpoint**: US2's scenarios by hand on two devices; SC-602/SC-603 within 5 s.

---

## Phase 5: User Story 3 — The recipes (Priority: P3)

**Goal**: the Recipes pane from the tab's top bar — list with badges, chips, search, detail with Plan Meal / Add to List / Edit / Delete — create and edit, and the two-way delete.

**Independent Test**: spec US3's seven scenarios by hand; the RTL suites below.

- [x] T042 [P] [US3] Failing RTL `__tests__/RecipePane.test.tsx` — every active recipe by name with its mealtime's badge; a removed recipe absent; the four chips filter; the search matches name and text; the selected detail (name, "● Dinner", the text with line breaks); two panels at a wide width, stacked at a narrow one; the four actions; New recipe opens the form
- [x] T043 [P] [US3] Failing RTL `__tests__/RecipeForm.test.tsx` and `__tests__/RecipeDeleteDialog.test.tsx` — name, mealtime, text with their bounds; the dietary notes; Save calls `createRecipe`/`updateRecipe`; the delete dialog's two choices worded exactly, the meal count in the confirmation, `deleteRecipe` called with the mode and `confirm: true`
- [x] T044 [US3] `RecipePane.tsx` (the `<dialog>` library; `useDraft` for the chip and query; the detail beside or over the list by a container query on the pane's width), `RecipeForm.tsx` + `useRecipeForm.ts`, `RecipeDeleteDialog.tsx`, Plan Meal from the detail → `MealSheet` with the recipe chosen; the Recipes control in the top bar; the editor's surfaces `recipes | recipe-form | recipe-delete` (FR-613–FR-621)
- [x] T045 [US3] T042–T043 green; gates; commit

**Checkpoint**: US3's scenarios by hand; SC-607 both ways.

---

## Phase 6: User Story 4 — Ingredients onto a list (Priority: P4)

**Goal**: Add to List from the popover and the recipe detail — the line checklist, the list chooser (Grocery first, Parents only filtered), one bulk write.

**Independent Test**: spec US4's five scenarios by hand on two devices; the RTL suite below.

- [x] T046 [P] [US4] Failing RTL `__tests__/AddToListSheet.test.tsx` — every non-blank line ticked, a long line marked "cut to 200 characters"; the chooser with Grocery lists first, a Parents only list absent for a member; untick three, choose, confirm → `addListItems({ listId, texts })` with exactly the six; the closing line "6 items added to Grocery List"; "No list to add to" with the Lists tab link; "Nothing to add" for an empty text
- [x] T047 [US4] `AddToListSheet.tsx` (on `linesOf`, `visibleListsOf`, `useDraft` for the ticks and the list; `addListItems` through the queue under `push:<listId>`); wired from `MealPopover` and `RecipePane`'s detail (FR-631–FR-633, R610)
- [x] T048 [US4] T046 green; gates; commit

**Checkpoint**: US4's scenarios by hand; SC-606 on two devices.

---

## Phase 7: User Story 5 — Repeating meals (Priority: P5)

**Goal**: Repeats in the sheet on the shared fieldset; the scope question with the meal noun on edit and delete; every scope's write through the queue.

**Independent Test**: spec US5's six scenarios by hand; the RTL suites below.

- [x] T049 [P] [US5] Failing RTL additions to `MealSheet.test.tsx` and `MealPopover.test.tsx` — the Repeats fieldset offers Never / Every day / Every week on chosen weekdays / Every month on the date and an until date; Save on a repeating meal passes the `repeat`; Edit and Delete on a repeating occurrence ask "This meal / This and future meals / All meals" **first**, never on a one-time meal; each answer reaches `updateMeal`/`deleteMeal` with that scope and the `occurrenceDate`; a recipe change at `this` is refused in the sheet before sending
- [x] T050 [US5] `MealSheet` mounts `RepeatFieldset` over the meal draft; the editor's `scope` step (`ScopeDialog` with `noun="meal"`) before the sheet or the confirmation for a repeating occurrence; `useMealWrites.update/remove` carry `occurrenceDate` and `scope`; the sheet hides the recipe picker at scope `this` (FR-627–FR-630, R603, R608)
- [x] T051 [US5] T049 green; gates; commit

**Checkpoint**: US5's scenarios by hand; SC-605 across the weeks.

---

## Phase 8: User Story 6 — Meals on the calendar (Priority: P6)

**Goal**: the token row under the Week calendar's all-day band, the Filter sheet's Show Meals switch, hidden mealtimes honoured, the popover from a token, the drag untouched.

**Independent Test**: spec US6's six scenarios by hand; the RTL suites below; the calendar's drag suite still green.

- [x] T052 [P] [US6] Failing RTL `app/family/(app)/calendar/components/__tests__/MealRow.test.tsx` — one row on the header grid; Wednesday's two tokens in mealtime order, each named by the meal with its colour; a hidden mealtime's token absent; the row empty when Show Meals is off; a token press calls `onOpen`; a pointer drag on a token lifts nothing
- [x] T053 [P] [US6] `app/family/(app)/components/__tests__/FilterSheet.test.tsx` (~) — the Meals section's "Show Meals on the calendar", on by default, written to `family:calendar-meals:v1`, Show all turns it back on
- [x] T054 [US6] `meals/components/useCalendarMealSwitch.ts` (`createDeviceSwitches("family:calendar-meals:v1", { showMeals: true })`), `calendar/components/useCalendarMeals.ts` (`useMeals` + `useMealCategories` over the calendar's `viewWindow` → `expandMeals` → `mealTokensOf`), `calendar/components/MealRow.tsx` (on `headerGridTemplate`; `MealChip`s; no pointer binding), `WeekView.tsx` (~) mounts the row under the band and `MealPopover` for a token, `calendar/page.tsx` (~) seeds the two extra reads, `FilterSheet.tsx` (~) the Meals section (FR-634–FR-637, R609, R611)
- [x] T055 [US6] T052–T053 green; the calendar's suites green; gates; commit

**Checkpoint**: every story's scenarios pass by hand; SC-614 with tokens present.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T056 [P] Seed fixtures verified on a fresh `supabase db reset` + `npm run family:seed -- --local`: the four mealtimes, seven recipes (Old stew removed and still planned), the week's meals, the weekly Pizza with its skip and its move; a second seed run adds nothing
- [ ] T057 [P] Docs sync: plan.md Progress; CLAUDE.md's active-feature block (state, the ordering rule); every task ticked here; `specs/006-family-meals/checklists/quickstart-run.md` with the gates, what was walked and where
- [ ] T058 Gates: `npm run fallow:audit` (zero new findings, duplication 0 — a flagged clone is extracted, never suppressed; the meal/event series helpers watched), `npm test`, `npm run test:policies`, `npm run typecheck`, `npx eslint app/family lib/family`; `npm run graph`
- [ ] T059 Review gate: code-reviewer over the whole diff; security-guardian over 030–033, `actions/meals.ts`, the scope helpers, the parent gate, `addListItems`; findings fixed with a red-then-green test each
- [ ] T060 Hand walk: quickstart §"Verifying the guarantees" on the local stack with chrome-devtools at the four viewports and the phone emulation; the two-device checks on hosted if the local realtime still does not deliver (Phase 5's run record)
- [ ] T061 **Hosted, in this order** (Hard ordering, R605): `supabase db push --linked` (030–033) → quickstart §4 steps 2–3 (no `anon` grant; both functions `service_role` only; four tables published at replica identity `d`) → `npm run family:seed -- --yes` → exactly four mealtimes → merge to `main`, push, deploy → SC-614 and SC-615 on the live site
- [ ] T062 Device pass (the operator's, by hand on hardware): SC-602–SC-606 across two devices, SC-610 on the iPad in both orientations and on a phone, SC-612 with VoiceOver, SC-608's airplane mode

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T006 and T008 in parallel; T007 alone (it touches shipped files) — all before Foundational
- **Foundational (Phase 2)**: T009–T011 red first → T012 resets and greens them → T013–T017 in parallel → T018–T025 in parallel → T026 red → T027–T028 → T029
- **US1 (Phase 3)**: after Foundational; T030–T031 red first; T032 → T033 → T034 → T035 → T036
- **US2 (Phase 4)**: after US1 (the grid, the cells); T037–T039 red first; T040 → T041
- **US3 (Phase 5)**: after US2 (the sheet and popover it plans from); T042–T043 red first; T044 → T045
- **US4 (Phase 6)**: after US2 and US3 (the popover and the detail it hangs off); T046 red first; T047 → T048
- **US5 (Phase 7)**: after US2 (the sheet) and T007 (the shared fieldset and dialog); T049 red first; T050 → T051
- **US6 (Phase 8)**: after US2 (the chip and the popover); T052–T053 red first; T054 → T055
- **Polish (Phase 9)**: after every story; T061 after T058–T060; T062 after T061

### Within Each User Story

Tests red → implementation → tests green → gates → commit. A story's checkpoint is walked by hand before the next story begins.

### Parallel Opportunities

- Setup: T001 ∥ T002 ∥ T003 ∥ T004 ∥ T005 ∥ T006 ∥ T008
- Foundational: T009 ∥ T010 ∥ T011; T013 ∥ T014 ∥ T015 ∥ T016 ∥ T017; T018 ∥ … ∥ T025
- US1: T030 ∥ T031; US2: T037 ∥ T038 ∥ T039; US3: T042 ∥ T043; US6: T052 ∥ T053
- Polish: T056 ∥ T057

## Parallel Example: Foundational pure modules

```text
T018 expand   T019 slots   T020 repeat   T021 week   T022 lines   T023 library   T024 visibility   T025 dietary
        — eight files, eight tests, no shared state; each red, then green, in any order —
```

## Implementation Strategy

### MVP First (User Story 1 Only)

Setup + Foundational + US1 gives a Meals tab that shows the household's week with its four
mealtimes, seeded once, renamable by a parent and hideable per device — every cell empty, but the
tab real and the placeholder gone. It is deployable on its own after the push.

### Incremental Delivery

US2 makes it a planner; US3 a library; US4 ties it to Lists; US5 repeats; US6 puts dinner on the
wall calendar. Each story is walked by hand and committed before the next; the hosted push,
merge and deploy come once, at the end.
