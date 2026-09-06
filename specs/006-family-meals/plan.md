# Implementation Plan: Family Meals

**Branch**: `006-family-meals` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-family-meals/spec.md`

## Summary

Build the Meals tab for `/family` on the shipped Phase 1–5 platform: a week grid of seven day
columns by up to four mealtime rows with a rotated rail, today marked, week arrows and a paging
swipe; four mealtimes seeded once and renamable/recolourable by a parent, hideable per device;
recipes folded into the tab as a pane (list, chips, search, detail); planning from a recipe or a
new entry, with a note, multiple meals per slot, a popover with Open Recipe / Add to List / Edit /
Delete; repeating meals on the calendar's recurrence engine with its three scopes; a recipe's lines
pushed as a checklist onto a list of the person's choosing in one write; meal tokens on the Week
calendar behind a per-device Show Meals switch; and each Profile's dietary note shown while
planning — every write open to any punched-in Profile and refused, never queued, when it cannot
complete.

The technical core is **one recurrence engine, one recipe record, one chip.** Four tables where a
meal references its recipe and "removed" is a timestamp, so the reference's two delete choices
both hold (R601); the calendar's rule walk expanded as dates, with mirrored exceptions and a
mirrored split function, so a meal repeats exactly as an event does (R602, R603); eight actions,
one statement each, the category set closed by having no create or delete (R604); the grid on the
shipped chassis with days as columns and a rail beside it (R606); a `MealChip` the grid and the
calendar share (R607, R611); the shipped `<dialog>` patterns, with the calendar's scope dialog and
repeat fieldset generalised by a noun and an interface (R608); the two per-device stores (R609);
a pure line split and one bulk item write for the push (R610).

This phase adds **four migrations (030–033), zero dependencies, no shipped-table alterations, one
new function on the write path (the split), and one shipped action file amended** (`addListItems`);
it amends six shipped surfaces named in the spec and replaces one placeholder.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+
**Primary Dependencies**: Next.js 16.1.6, React 19.1.0, Tailwind 4, `@supabase/ssr` + `@supabase/supabase-js`, TanStack Query 5, `jose`, Zod 4, `framer-motion` (the pager's swipe only) — **no new dependencies** (R616)
**Storage**: Supabase Postgres, schema `family`, project `zgmltllcyqylgtazunai`; migrations 030–033 on top of 001–029 — four tables, two functions, four publication entries; **no alteration to a shipped table**. PG 17 hosted. Local stack on 553xx
**Testing**: Vitest 4 projects — unit (jsdom: the expansion, slots, repeat rules, the week, lines, the library, visibility, dietary, validation, permissions, tokens, the RTL surfaces) and policies (node, local stack: RLS and grants, CHECKs, uniqueness, the payload shapes, the cascades, every action and scope, the two functions)
**Target Platform**: iPadOS Safari (the wall tablet, both orientations); iOS/Android phones; desktop for development
**Performance Goals**: a plan, edit, move or delete that agrees across devices within 5 s (SC-602/603); a rename everywhere within 5 s and a hide within 1 s on the device (SC-604); a push of N lines in one write (SC-606); three unwindowed reads for the whole tab (R605)
**Constraints**: FR-642 — refuse, never queue; one statement per write (the split excepted, as 015 is); WCAG 2.1 AA + 44×44 px on every new control (FR-646); reduced motion (FR-647); fallow budgets (cyc 20 / cog 15, CRAP needs coverage, no suppressions); Supabase free tier
**Scale/Scope**: one household; four mealtimes, tens of recipes, a few meals a day; 49 FRs (FR-601…FR-649), 15 SCs, 14 assumptions, 4 contradiction resolutions; 4 migrations, ~8 new `lib/family/meals` modules, ~18 new components, 6 amended surfaces, 3 generalised shipped pieces, 1 replaced placeholder. Zero NEEDS CLARIFICATION.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How this plan satisfies it |
|---|---|---|
| **I. Sub-apps are self-contained** | PASS | Everything lands in `app/family/**`, `lib/family/**`, `supabase/migrations/` and the seed script; the one root-level touch is the `family-meals-core` zone in `.fallowrc.json` (R617), the Phase 2–5 pattern. No new dependency, no config edit beyond that. Three shipped pieces generalise inside the sub-app (`ScopeDialog`, `RepeatFieldset`, `ConfirmDialog` → `(app)/components/`). |
| **II. Test-first for logic** | PASS | The parts that can be silently wrong are pure or in the database and land test-first: `expandMeals` (walks, skips, an override that moves an occurrence into or out of the window, the end date), `slotsOf`, `mealRuleOf`/truncation round-trips, the week's dates from the start day, `linesOf`, the library filter, the two visibility rules, validation, permissions — and, in the policies tier before the actions exist, the CHECKs, the unique name, the payload shapes, the cascades, `seed_default_meal_categories` by emptiness, `split_meal_series` atomicity, and the privilege delta. |
| **III. Accessible and touch-first** | PASS | FR-646/647: a cell is a button named by its day, mealtime and count; a chip a button named by the meal; the rail's names are text, not only rotated decoration; every switch is a real checkbox named by its mealtime; the popover, pane and sheets are native `<dialog>`s on `useModalDialog`; the hold has "Add another meal" as its keyboard path; week paging has arrows; every control ≥44×44 with visible focus; reduced motion collapses every open/close. |
| **IV. Layered, boundary-enforced architecture** | PASS | Expansion, slots, rules, the week, lines, the library and visibility live in framework-free `lib/family/meals/**`; components render from them; the actions send one statement each; the database keeps the shape. `lib` imports nothing from `app/**`; the new zone may reach the engine, the calendar's date helpers and `lib`, nothing else. |
| **V. Quality gates** | PASS | The branchy new code is pure and table-tested. `MealsBoard`'s model is composed from named hooks from the start (`useMealsData`, `useMealsView`, `useMealWeek`, `useMealEditor`, `useMealWrites`), the Phase 4/5 shape; the series helpers in `actions/meals.ts` are small named functions per scope. Duplication is handled by reuse: the chip is one component for two screens, the scope dialog and repeat fieldset are generalised rather than copied, the confirmation dialog moves home; the series ops are re-implemented on a smaller payload (R603) and watched by `fallow:dupes`. |
| **VI. Degrade gracefully** | PASS | FR-642 verbatim; a refused plan keeps the sheet's draft and says why; a vanished meal or recipe closes its surface with the shipped message; the hidden mealtimes and Show Meals keep an in-memory fallback with the shipped notice. Destructive copy states what is lost and kept: Delete a meal names it; the recipe delete names the mode and the meal count; "Just the recipe" says the meals stay. |
| **VII. Private by default** | PASS | Four tables with `is_member()` read policies, SELECT to `authenticated`, ALL to `service_role`, nothing to `anon`; every write is a `requireVerifiedActor` action scoped by `household_id`; every cross-table reference is a composite `(id, household_id)` FK; both functions are `security definer`, `search_path = ''`, revoked from public, executable by the service role only; replica identity stays default so a DELETE never carries a recipe's text. Every row records its actor. |
| **VIII. Fidelity is specified** | PASS | All 49 FRs are tagged; the three knowing divergences from `[V]` behaviours are named in the spec's preamble and Assumptions 2, 9 and 10, each with its reason; every meals metric stays `[ESTIMATED]` in the token layer. No spec sentence is narrowed by design: FR-616's "meals remain" is `removed_at`, FR-629's "exactly as the calendar's" is the same walk and the mirrored split, FR-632's "one write" is one INSERT. |

**Result: PASS, no deviation claimed, no open question.**

### Re-check after Phase 1 design

- **The series operations are re-implemented for meals rather than shared with events.** Tested
  against §V: the events' helpers are private and time-shaped; a shared module would generalise
  over two payloads for two consumers. The meal versions are a third of the size, table-tested at
  the policies tier, and `fallow:dupes` will say if the pair drifts into a clone — the remedy is
  extraction, never a threshold. **PASS.**
- **`ScopeDialog` and `RepeatFieldset` change shape under a shipped screen.** Tested against §II
  and §V: a noun parameter with the event strings as defaults, and an interface the event form
  already satisfies; every calendar test carried along and green before any meal code. **PASS.**
- **A removed recipe is readable by the meals that reference it.** Tested against §VI and §VII:
  nothing is lost, and the row stays inside its household's RLS. **PASS.**
- **`addListItems` amends a shipped action file.** Tested against §V: one new exported function,
  the same guards, a policies test of its own; nothing shipped changes. **PASS.**

### Complexity Tracking

No deviation is claimed. Two design choices are recorded here because a reviewer could ask:

| Choice | Why not the simpler alternative |
|---|---|
| A fourth table for meal exceptions, and a split function | The spec binds repeating meals to the calendar's scopes (FR-629); an exception row and an atomic split are what make "this" and "this and future" true, as 012/015 found (R603). |
| `removed_at` on recipes instead of a delete | The reference's "Just the recipe" keeps planned meals; a referenced row cannot be deleted without orphaning them (R601). |

## Project Structure

### Documentation (this feature)

```text
specs/006-family-meals/
├── plan.md              # This file
├── spec.md              # 49 FRs, 15 SCs, 14 assumptions, 4 contradiction resolutions
├── research.md          # Phase 0 — R601–R617
├── data-model.md        # Phase 1 — migrations 030–033 in SQL, invariants, privilege delta
├── quickstart.md        # Phase 1 — setup, fixtures, per-guarantee verification, operator steps
├── contracts/
│   └── server-actions.md    # Phase 1 — eight actions, the read path, the error contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/
├── 030_meal_categories.sql          # meal_categories + seed_default_meal_categories + policies/grants
├── 031_recipes.sql                  # recipes (removed_at) + policies/grants
├── 032_meals.sql                    # meals + meal_exceptions + split_meal_series + policies/grants
└── 033_realtime_meals.sql

scripts/family-seed.mjs              # (~) ensureHousehold calls seed_default_meal_categories (both modes); --local fixtures (R613)

lib/family/
├── meals/                           # NEW zone family-meals-core, framework-free
│   ├── expand.ts                    # expandMeals(meals, range, zone) → MealOccurrence[] (R602); occurrenceOf
│   ├── slots.ts                     # slotKeyOf, slotsOf(occurrences) → Map<slotKey, MealOccurrence[]>
│   ├── repeat.ts                    # mealRuleOf(choice, date), mealRepeatChoiceOf(rrule), truncatedMealRule(rrule, cut)
│   ├── week.ts                      # weekDatesOf(anchor, startWeekOn), shiftWeek, todayColumnOf
│   ├── lines.ts                     # linesOf(text) → { text, truncated }[] (R610)
│   ├── library.ts                   # activeRecipes, filterRecipes(recipes, { categoryId, query })
│   ├── visibility.ts                # shownCategoriesOf(categories, hidden), mealTokensOf(occurrences, categories, hidden, showMeals)
│   └── dietary.ts                   # dietaryNotesOf(profiles)
├── types.ts                         # (~) MealCategory, Recipe, Meal, MealException, MealOccurrence, RecipeChoice, MealScope
├── rows.ts                          # (~) MEAL_CATEGORY_COLUMNS / RECIPE_COLUMNS / MEAL_COLUMNS (+ exceptions embed) + toMealCategory / toRecipe / toMeal
├── validation.ts                    # (~) the mealtime, recipe, meal and addListItems schemas
├── queries.ts                       # (~) familyKeys.mealCategories / recipes / meals + fetch* + use*
├── permissions.ts                   # (~) mealtime.edit (parent), meal.write, recipe.write (open)
├── actions/meals.ts                 # NEW: the seven actions (R604); the series helpers per scope (R603)
├── actions/lists.ts                 # (~) + addListItems
└── __tests__/
    ├── unit/                        # meals-expand, meals-slots, meals-repeat, meals-week, meals-lines, meals-library, meals-visibility, meals-dietary, meals-validation, permissions delta, meal-tokens
    └── policies/                    # meals-schema, meals-access, meals-actions, privileges delta

app/family/
├── tokens.css                       # (+) the Meals section (R614)
└── (app)/
    ├── components/
    │   ├── ScopeDialog.tsx          # MOVED from calendar/components; (~) noun: "event" | "meal" (R608)
    │   ├── RepeatFieldset.tsx       # EXTRACTED from calendar/components/EventForm.tsx behind a RepeatDraft interface
    │   ├── ConfirmDialog.tsx        # MOVED from lists/components (third consumer)
    │   ├── FilterSheet.tsx          # (~) the Meals section: "Show Meals on the calendar"
    │   ├── nav.ts                   # (~) meals: showsChipRow false
    │   └── useFamilyRealtime.ts     # (~) + meal_categories, recipes, meals, meal_exceptions
    ├── calendar/
    │   ├── page.tsx                 # (~) + meals and mealtimes reads seeded
    │   └── components/
    │       ├── MealRow.tsx          # NEW: the token row under the all-day band (R611)
    │       ├── useCalendarMeals.ts  # NEW: meals + hidden + Show Meals → tokens by date; the popover's occurrence
    │       ├── WeekView.tsx         # (~) mounts MealRow and MealPopover; reads the stores
    │       └── EventForm.tsx        # (~) mounts the extracted RepeatFieldset
    └── meals/
        ├── page.tsx                 # (~) replaces the placeholder: mealtimes + recipes + meals → initialData; MealsUnavailable copy
        └── components/
            ├── MealsBoard.tsx       # chassis: useBoardGeometry(7, { widthToken, layoutOf: rowLayoutOf }) + useColumnPage + PagedColumns; the rail; model hooks; FAB "Add Meal"; the empty-rows note
            ├── MealRail.tsx         # the rotated mealtime names, rows aligned to the cell height
            ├── MealDayColumn.tsx    # one day: header (today marked) + a MealCell per shown mealtime
            ├── MealCell.tsx         # the slot: chips in planning order; tap adds; hold adds another (useHoldPress)
            ├── MealChip.tsx         # one meal, name + mealtime colour — shared with the calendar (R607)
            ├── MealPopover.tsx      # name, date · mealtime, note; Open Recipe / Add to List / Edit / Delete / Add another meal
            ├── MealSheet.tsx, useMealForm.ts   # add/edit: date, mealtime, RecipePicker, note, RepeatFieldset; DietaryNotes
            ├── RecipePicker.tsx     # From Recipes (chips + search) / New Entry
            ├── RecipePane.tsx       # the library: list + detail (two panels wide, stacked narrow); Plan Meal / Add to List / Edit / Delete
            ├── RecipeForm.tsx, useRecipeForm.ts   # name, mealtime, text; DietaryNotes
            ├── RecipeDeleteDialog.tsx   # "Just the recipe" / "This recipe and planned meals", with the meal count
            ├── AddToListSheet.tsx   # the line checklist + the list chooser → addListItems
            ├── CategoriesSheet.tsx, CategoryForm.tsx   # four rows: switch (device) + pencil (parent) → name, colour
            ├── DietaryNotes.tsx     # "Name: note" lines (R612)
            ├── WeekNav.tsx          # ‹ Today ›, the week's label
            ├── useMealWeek.ts       # the anchor week from startWeekOn, the offset, Today
            ├── useHoldPress.ts      # 400 ms hold, cancelled by movement (R607)
            ├── useHiddenMealtimes.ts    # createDeviceKeySet('family:meal-hidden:v1')
            ├── useCalendarMealSwitch.ts # createDeviceSwitches('family:calendar-meals:v1', { showMeals: true })
            └── useMealWrites.ts     # useSerialisedWrites bound to the eight actions
```

**Structure Decision**: the Meals tab replaces its Phase 1 placeholder inside the `(app)` route
group. Three shipped pieces move to `app/family/(app)/components/` in the first task because each
now has a second or third consumer (R608); the calendar keeps its event-specific pieces and gains
one token row. Nothing leaves the sub-app.

## Implementation phasing

| # | Step | Verifiable by |
|---|---|---|
| 1 | **Three shipped pieces generalise** (R608): `ScopeDialog` → `components/` with a noun (event defaults), `RepeatFieldset` extracted from `EventForm` behind `RepeatDraft`, `ConfirmDialog` → `components/`; tests move; tokens for meals added; `family-meals-core` zone | Every existing test green; `npm run fallow:audit` clean; the calendar and Lists unchanged by hand |
| 2 | Migrations 030–033 on the local stack + the policies suites **written red first**: CHECKs, the unique name, the rule grammar, the payload shapes, the cascades and restricts, `seed_default_meal_categories` once, `split_meal_series` atomicity, the privilege delta, SC-609 per path | `supabase db reset`; every policies test green; `privileges.test.ts` exact |
| 3 | Rows / types / validation / the three reads + keys + `initialData` on both pages; realtime tables; `nav.ts` chip row off | Unit validation tests (bounds, modes, scope rules, `confirm: true`); reads under RLS; `nav.test.ts` |
| 4 | `lib/family/meals/*` — `expand`, `slots`, `repeat`, `week`, `lines`, `library`, `visibility`, `dietary` — **tests first** | The walks and exceptions tables; slot grouping; rule round-trips; the week from each start day; line splitting; filter/search; the two visibility rules; notes |
| 5 | Actions: `meals.ts` (seven), the series helpers per scope, `permissions.ts` delta, `addListItems` — **policies tests first** | SC-605's scopes end to end; the parent gate; both delete modes; a removed recipe refused; the bulk append's order and attribution |
| 6 | The tab: page, `MealsBoard` on the chassis, `MealRail`, `MealDayColumn`, `MealCell`, `MealChip`, `WeekNav`, `useMealWeek`, the hidden-mealtimes store, the empty-rows note, the FAB | Story 1's scenarios 1, 2, 5, 6 by hand at four viewports; RTL for the grid, the rail, today, paging, hidden rows |
| 7 | Planning: `MealSheet`, `useMealForm`, `RecipePicker`, `MealPopover`, `useHoldPress`, `useMealWrites`, `DietaryNotes`, delete confirm | Story 2 by hand; RTL for add/edit/delete, hold, "Add another meal", the notes |
| 8 | Recipes: `RecipePane`, `RecipeForm`, `RecipeDeleteDialog`, Plan Meal from the detail | Story 3 by hand; RTL for chips, search, two panels vs stacked, both delete choices |
| 9 | Repeats and scopes: `RepeatFieldset` in the sheet, `ScopeDialog` with the meal noun, the scope flows through `useMealWrites` | Story 5 by hand; RTL for the scope question (asked/not asked), each scope's write |
| 10 | Add to List: `AddToListSheet` → `addListItems`; `CategoriesSheet` + `CategoryForm` with the parent gate | Story 4 and Story 1's 3–4 by hand; RTL for the checklist, the chooser (Grocery first, Parents only filtered), the empty cases; the pencils absent for a member |
| 11 | The calendar: `MealRow`, `useCalendarMeals`, `WeekView` mount, `FilterSheet`'s Meals section, `useCalendarMealSwitch`, the calendar page's reads | Story 6 by hand; RTL for tokens by day and order, hidden mealtimes, Show Meals, the popover from a token; the calendar's drag suite still green |
| 12 | Seed fixtures, docs sync, gates, graph, the review (code-reviewer + security-guardian over 030–033, `actions/meals.ts`, the scope helpers, the parent gate, `addListItems`) | All four gates green, no suppressions; a fresh reset shows the fixtures |
| 13 | **Hosted push (030–033), the §4 checks and the hosted seed run, then merge and deploy** | Privileges with no `anon`; four tables published at replica identity default; four mealtimes once; SC-614 on the live site |

## Risks

| Risk | Mitigation |
|---|---|
| The three generalisations break the calendar or the Lists tab | Step 1 is behaviour-preserving with every existing test carried along and green before any meal code; the by-hand check of both screens is part of its verification |
| The meal series helpers drift from the events' | Same grammar, same walk, same exception key; the policies suite runs every scope end to end; `fallow:dupes` watches the pair — extraction, never a threshold, if it flags |
| An override moves an occurrence into another week and it is drawn twice or not at all | `expandMeals` keys by the original date and draws at the override date; the unit table covers "moved into the window" and "moved out of it" |
| A New Entry fails after the recipe is written | The recipe is inserted first; the worst outcome is an un-planned recipe in the pane, which the person can plan or delete — no half-meal |
| A removed recipe is planned again through a stale picker | `planMeal` refuses a removed recipe (`NOT_FOUND`); the picker filters on the refetch |
| The rail's rotated text is unreadable to a screen reader or too small to tap | The names are real text with the pencils and switches in the Categories sheet, not on the rail; the rail is decoration with an accessible list behind it |
| The token row steals the calendar's drag | The row is outside the drag layer with no pointer binding; the calendar's drag suite is part of step 11's gate |
| Show Meals off is mistaken for "meals deleted" | The switch lives beside the other filters with the shipped "on this device" heading; the Meals tab is untouched |
| Deploy before push takes the channel down | The ordering rule restated in quickstart §4 and the tasks file |
| The punch-in prompt arrives at the tap, as on every tab | The operator's open UX question from Phase 4 stands; every meal write is `withActor`, so moving the prompt later is one place |

## Progress

- [x] Phase 0 — research complete ([research.md](./research.md): R601–R617, no open unknowns, zero new dependencies)
- [x] Constitution check — pass, before and after design, no deviation claimed
- [x] Phase 1 — design complete: [data-model.md](./data-model.md) (030–033 in SQL, invariants, the privilege delta), [contracts/server-actions.md](./contracts/server-actions.md) (eight actions, the read path, the error contract), [quickstart.md](./quickstart.md)
- [x] Phase 2 — `/speckit.tasks` ([tasks.md](./tasks.md): 62 tasks, test-first, the three generalisations first)
- [ ] Phase 3 — implementation per the phasing table above
