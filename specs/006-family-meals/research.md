# Research: Family Meals (Phase 0)

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-06

Every decision below resolves something the spec left to the plan: how a requirement is met on
the shipped Phase 1–5 platform, never what the requirement is. Each records the decision, the
reasoning, and the alternatives that were weighed. Numbering continues the project's convention:
R601–R617.

## What binds this phase before any decision is taken

- **The shipped schema and conventions** (Phases 1–5): custom `family` schema, RLS by
  `is_member()` with `SELECT` to `authenticated`, `ALL` to `service_role`, nothing to `anon`; no
  client write path; every write a server action under `requireVerifiedActor`; guarded realtime
  publication at DEFAULT replica identity; migrations numbered from **030**; the hosted push before
  the merge.
- **The calendar's recurrence engine** (`lib/family/recurrence/`, Phase 2): the closed grammar
  (`parseRule`/`emitRule`), the one rule walk (`ruleDatesIn`), the household-timezone reading of
  `UNTIL`, and the exceptions pattern (`event_exceptions`, `split_event_series`). Spec FR-627–FR-630
  say "the same", so this phase reuses the walk and mirrors the tables; it never forks the grammar.
- **The board chassis** (`components/ColumnPager`, `useBoardGeometry`, `PagedColumns`,
  `BoardStrip`), now with three consumers; the per-device stores (`createDeviceSwitches`,
  `createDeviceKeySet`); the write surface, the serialised writes, the `<dialog>` sheets.
- **The Lists tab's item write** (Phase 5): FR-632 pushes lines as items; the item shape, bounds
  and attribution are Phase 5's, and Parents only lists are filtered by `visibleListsOf`.
- **The spec's fourteen assumptions** — in particular #9 (a meal references one recipe), #10 (the
  checklist push), #11 (tokens in the all-day band), #12 ("Just the recipe" marks it removed).

## R601 — Four tables and a seed function; a meal references a recipe; "removed" is a timestamp

**Decision**: `meal_categories` (exactly four per household, seeded once by
`seed_default_meal_categories()` by emptiness, never deleted), `recipes` (name, one category, one
text, `removed_at`), `meals` (date, category, recipe, note, `rrule`) and `meal_exceptions` (one row
per occurrence that diverges — a skip, or an override of date, category or note). A recipe deleted
"Just the recipe" gets `removed_at`; deleted "and planned meals" is a row delete whose composite FK
cascades to its meals.

**Rationale**: the master map's sketch (§4.6) is three tables; the fourth is the calendar's
exceptions pattern, which spec FR-629 requires by name. `removed_at` is the only shape under which
FR-616's first choice — the meals "remain on the Meal Plan" — and a meal that *references* its
recipe (Assumption 9) can both hold: the row stays readable for the meals that point at it and is
filtered out of the pane and the picker (FR-618). A count constraint cannot be a table CHECK, so
"exactly four" is enforced by there being no create and no delete action (R604) plus the seed.

**Alternatives**: a per-meal copy of the recipe's text (rejected — Assumption 9; two sources of
truth); copying the name onto the meal at delete time (rejected — the text would be lost and Open
Recipe would have nothing to open); a `deleted` boolean (a timestamp says when, and is the shape
`checked_at` set in Phase 5).

## R602 — The recurrence walk is reused; meals expand as dates

**Decision**: `lib/family/meals/expand.ts` expands a week of meals with the engine's
`ruleDatesIn(rule, anchorDate, range, zone)` — the one rule walk — applying the meal's exceptions
by `occurrenceDate` (skip drops; override moves the drawn date and replaces category or note). A
meal's `rrule` always carries a date-form `UNTIL` (`{ kind: "date" }`), never an instant, because a
meal has no clock time; `lib/family/meals/repeat.ts` turns the calendar's `RepeatChoice` into that
rule with `emitRule`, anchored on the meal's date, and truncates a rule to `cut − 1 day` for a split.

**Rationale**: FR-627/FR-628 — "the same canonical rule the calendar stores… expanded in the
household's timezone". The Tasks board already takes `ruleDatesIn`'s dates as they are (R304); meals
are the same date-only case. `expandSeries` itself is event-shaped (times, summary, location) and
is not reused; the walk beneath it is.

**Alternatives**: a second, date-only grammar (rejected — the spec forbids forking); calling
`expandSeries` with fake all-day times (rejected — it would invent `start_date`/`end_date` fields a
meal does not have and drag `EventTimes` into the meals zone).

## R603 — Scopes: the calendar's three, on a smaller payload, with a mirrored split function

**Decision**: `updateMeal` and `deleteMeal` take `occurrenceDate` and, for a repeating meal, a
`scope`: `this` writes or upserts an exception (override for edit — date, category, note — skip for
delete); `this_and_future` calls `family.split_meal_series` (a copy of 015's shape: lock the head,
truncate its rule to the cut, insert the tail with the patch applied, re-home the exceptions on or
after the cut) for an edit, and truncates the rule for a delete; `all` updates or deletes the row.
A one-time meal never takes a scope (FR-629). A recipe change is refused at scope `this` (FR-630).

**Rationale**: FR-629 binds "exactly as the calendar's scopes do". The payload is three fields, so
the series helpers are re-implemented for meals in `actions/meals.ts` (about a third of the
events' size) rather than generalised out of `actions/events.ts`, whose helpers are private and
time-shaped (`reanchorRule`, `timeColumns`). The split stays a `security definer` function because
a truncated head must not exist without its tail — 015's reason, unchanged.

**Alternatives**: extracting a generic series-ops module from events (rejected for this phase —
the abstraction would be over two consumers with different payloads; recorded as a follow-up if
`fallow:dupes` flags the pair); doing the split as two statements from the action (rejected — 015's
atomicity argument).

## R604 — Eight actions, one statement each; the category set is closed

**Decision**: in `actions/meals.ts`: `updateMealCategory` (parent), `createRecipe`,
`updateRecipe`, `deleteRecipe` (with `mode: "recipe" | "recipe_and_meals"` and `confirm: true`),
`planMeal` (an existing recipe or a new entry that also creates the recipe), `updateMeal`,
`deleteMeal`; in `actions/lists.ts`: `addListItems` (a bulk append, one INSERT of N rows). No
`createMealCategory`, no `deleteMealCategory` — the set is seeded and closed (FR-609). Every one is
`requireVerifiedActor` (any role) except `updateMealCategory`, which re-checks `parent` from the
database (FR-640).

**Rationale**: FR-639/FR-640's rule; Phase 5's "one statement per verb"; the only multi-statement
paths are the split (a function) and a New Entry (recipe then meal — two inserts under one action,
the recipe first so a failure leaves at most an un-planned recipe, which is what the reference
keeps anyway). `addListItems` lives with the lists actions because it writes list rows; the meals
UI calls it with the chosen lines.

**Alternatives**: a `planMeals` batch (rejected — nothing in scope plans more than one at a
tap); `deleteRecipe` as two actions (rejected — one confirmation, one choice, one verb).

## R605 — Reads: three unwindowed keys; meals embed their exceptions; the calendar reads meals too

**Decision**: `familyKeys.mealCategories`, `familyKeys.recipes`, `familyKeys.meals` — all under
`familyKeys.all` so the shipped bare-sweep invalidation reaches them; `meals` are read whole with
`meal_exceptions(...)` embedded, as `events` embed theirs, so `expandMeals` never searches. The Meals
page performs the three reads under the session client and seeds each key; the Calendar page adds
the meals and categories reads for its tokens. The four tables join `useFamilyRealtime`'s list.

**Rationale**: a household's meals are a few rows per day; a windowed read would save nothing and
cost a key per window. Embedding the exceptions is R206's reason: a moved occurrence is found
without bookkeeping.

**Alternatives**: a per-week meals key (rejected — the calendar and the meals grid would hold
different windows of the same rows); expanding on the server (rejected — the client expands events
today, and one expander for both keeps them agreeing).

## R606 — The grid is the chassis with days as columns and a rail beside it; the week is the household's

**Decision**: `MealsBoard` mounts `useBoardGeometry(7, { widthToken: "--fam-meal-cell-w", layoutOf:
rowLayoutOf })` + `useColumnPage` + `PagedColumns` over the seven days of the shown week, each
column a stack of `MealCell`s in category order with a fixed cell height token, and a `MealRail`
at the left whose rows share that height. `useMealWeek` keeps the week: `weekStartOf(today,
startWeekOn)` from the calendar's date helpers plus an offset the arrows move; Today resets it; the
pager pages the visible slice within the week on narrow screens (FR-603).

**Rationale**: FR-602/FR-603 — a week grid anchored on the household's start day, whole columns,
a swipe that pages by what fits; the chassis already measures, pages and stands down for a hold.
The rail is outside the strip so the columns stay pure day columns and the pager's window is days.

**Alternatives**: the calendar's rolling window anchored on today (rejected — spec Assumption 3);
a CSS grid with seven fixed columns and horizontal scroll (rejected — a second paging idiom, and
Phase 5 already declined the clipped-card scroll).

## R607 — A cell is a slot; a hold adds; the chip is shared with the calendar

**Decision**: `slotsOf(occurrences)` groups the week's expanded meals by `(date, categoryId)`;
`MealCell` draws its slot's meals as `MealChip`s (the recipe's name, the mealtime's colour) in
planning order, an empty cell as a blank tappable surface. A tap on an empty cell opens the add
sheet for that slot; a tap on a chip opens `MealPopover`; a press-and-hold on a cell with meals
(`useHoldPress`, the machine's 400 ms hold, cancelled by movement) opens the add sheet for the slot
(FR-623). `MealChip` is the same component the calendar's token row draws.

**Rationale**: FR-604, FR-622, FR-623, FR-634; one chip component keeps the grid and the calendar
naming a meal the same way. `useListReorder` is a reorder machine and nothing reorders here, so the
hold is a small hook of its own, with the machine's timing.

**Alternatives**: a `+` button in every cell (rejected — the reference's cells are blank
`[V-photo]`; the popover's "Add another meal" is the keyboard path).

## R608 — The popover and the sheets are the shipped `<dialog>` patterns; two shipped pieces generalise

**Decision**: `MealPopover` (the four actions, opened from the grid and the calendar), `MealSheet`
(add/edit: date, mealtime, From Recipes / New Entry, note, Repeats), `RecipePane` (list + detail,
chips, search), `RecipeForm`, `RecipeDeleteDialog` (the two-way choice), `AddToListSheet`,
`CategoriesSheet` + `CategoryForm` — every one on `useModalDialog`, `useDraft`, `useSubmission`,
`FormFooter`. Two shipped pieces move to `components/` and take a parameter: the calendar's
`ScopeDialog` gains a noun (`event` / `meal`) so its titles and options read "This meal / This and
future meals / All meals" (FR-629); the Lists tab's `ConfirmDialog` moves home (its third consumer).
The calendar's `RepeatFieldset` is extracted from `EventForm` behind a small draft interface
(`repeatKind`, `weekdays`, `until`) so `MealSheet` mounts the same control.

**Rationale**: R510's reuse rule; the spec's wording for scopes is the calendar's with the noun
swapped; a second repeat control would drift from the first.

**Alternatives**: a bespoke scope dialog (rejected — same question, different noun); inline
repeat fields in the meal sheet (rejected — duplication the gate would flag).

## R609 — Per-device state: hidden mealtimes as a key set; Show Meals as a switch

**Decision**: `useHiddenMealtimes` on `createDeviceKeySet("family:meal-hidden:v1")` (category
ids); `useCalendarMealSwitch` on `createDeviceSwitches("family:calendar-meals:v1", { showMeals:
true })`, surfaced in the Filter sheet's new **Meals** section as "Show Meals on the calendar".
Both report `persistent` into the sheet's shipped notice (FR-648).

**Rationale**: FR-611, FR-635, FR-637, FR-648; the two stores are the shipped factories with new
keys. The category switches live in the Meals tab's Categories sheet (spec Assumption 6) and read
the same key set.

**Alternatives**: one store for both (rejected — a set of ids and a boolean are different shapes,
the reason Phase 3 gave for the Tasks switches).

## R610 — Add to List: pure line split, a checklist, one bulk write

**Decision**: `lib/family/meals/lines.ts` — `linesOf(text)` splits on any line break, trims, drops
blanks, marks lines over 200 characters as truncated; `AddToListSheet` lists them ticked, offers the
lists (`visibleListsOf` for the actor, Grocery first), and calls `addListItems({ listId, texts })`
once. Nothing is de-duplicated.

**Rationale**: spec Assumption 10 and FR-631–FR-633; `addListItems` appends with consecutive
`sort_order`s after `nextSortOrder`, so the items keep the recipe's order and the Lists tab draws
them at the end, ungrouped (Phase 5 FR-516).

**Alternatives**: N calls to `addListItem` (rejected — N writes, N realtime notices, and a
half-added list on a failure); parsing "ingredient-looking" lines (rejected — AI by another name).

## R611 — Meals on the calendar: a token row under the all-day band, read-only to drag

**Decision**: `calendar/components/MealRow.tsx` renders one grid row on `headerGridTemplate`
under `AllDayBand`: for each column date, that day's shown meals as `MealChip`s in mealtime order;
`useCalendarMeals` expands `familyKeys.meals` over the calendar's window, applies the hidden
mealtimes and the Show Meals switch (`mealTokensOf`), and hands the popover its occurrence. The row
is outside the drag layer: no pointer binding, no lift.

**Rationale**: FR-634–FR-637 and Assumption 11; the band's lanes are for spanning bars, and meals
never span, so a sibling row keeps `layoutWeek` untouched and the calendar's tests green.

**Alternatives**: meals as all-day bars (rejected — they would take lanes and could be dragged);
tokens in the hour grid (rejected — a meal has no time).

## R612 — Dietary notes are the Profiles' field, read from the provider

**Decision**: `dietaryNotesOf(profiles)` returns `{ name, note }` for every Profile whose
`dietaryPrefs` is non-blank; `DietaryNotes` renders "Name: note" lines below the sheets' fields
(FR-638).

**Rationale**: Phase 1 FR-024 stored it "readable by later phases"; `FamilyProvider` already
carries the Profiles.

## R613 — Migrations 030–033, the seed, and the fixtures

**Decision**: `030_meal_categories.sql` (table, `seed_default_meal_categories`, policies, grants),
`031_recipes.sql`, `032_meals.sql` (meals, exceptions, `split_meal_series`), `033_realtime_meals.sql`
(027's guard over the four tables). `scripts/family-seed.mjs`: `ensureHousehold` calls the seed
function in both modes; `--local` fixtures add seven recipes (one removed), a week of meals across
the four mealtimes, one weekly "🍕 Pizza" with a skipped occurrence and a moved one, and a meal that
references the removed recipe.

**Rationale**: Phase 5's shape (028 + the seed function + fixtures by emptiness); four files
because the split function and the exceptions belong with `meals` and the publication is its own
step, as 014/022/027/029 were.

## R614 — Tokens

**Decision**: `app/family/tokens.css` gains a Meals section: `--fam-meal-cell-w` (235),
`--fam-meal-cell-h` (250), `--fam-meal-gap-x` (20), `--fam-meal-gap-y` (38), `--fam-meal-cell-r`
(25), `--fam-meal-rail-w` (40), `--fam-meal-popover-w` (700), `--fam-meal-popover-r` (32), and the
cell label size (30, sampled) — every one `[ESTIMATED]`/`[SAMPLED]` per dossier 07 §3.7, read back by
`meal-tokens.test.ts` (SC-611).

## R615 — Testing strategy per layer

**Decision**: **unit** (jsdom): `meals-expand` (one-offs, weekly/daily/monthly walks, skips,
overrides that move a date across the window edge, the end date), `meals-slots`, `meals-repeat`
(choice → rule → choice, truncation), `meals-week` (the week's dates from the start day; the
visible slice), `meals-lines` (line endings, blanks, truncation), `meals-library` (chips, search
over name and text, removed recipes excluded), `meals-visibility` (hidden mealtimes, Show Meals),
`meals-dietary`, `meals-validation` (bounds, uniqueness message, `confirm: true`, the two delete
modes, scope required), `permissions` delta, `meal-tokens`; RTL for the board, the rail, a cell
(tap, hold, keyboard), the chip, the popover, the sheets, the pane, the categories sheet, the
calendar's `MealRow` and the Filter sheet's Meals section. **policies** (node, local stack):
`meals-schema` (CHECKs, uniqueness of names, the payload shapes, cascades — recipe → meals →
exceptions, `on delete restrict` on categories, the seed once), `meals-access` (RLS per role, SC-609),
`meals-actions` (each action end to end, the parent gate, the two delete modes, every scope,
`addListItems`), `privileges` delta (the two functions executable by `service_role` only).

## R616 — Dependencies: none added

**Decision**: nothing new. The date helpers are the calendar's, the rule walk the engine's, the
pager the chassis's, the dialogs native.

## R617 — The fallow zone

**Decision**: `.fallowrc.json` gains `family-meals-core` (`lib/family/meals/**/*`) allowed to reach
itself, `family-recurrence`, `family-calendar-core` (the date helpers and `RepeatChoice`) and `lib`;
`family-actions` gains `family-meals-core` in its allow list. Phase 5's shape.

## Resolved unknowns

None open. Every `NEEDS CLARIFICATION` candidate was answered in the spec's Clarifications and
Assumptions before this plan; the plan-level questions above are decided here.
