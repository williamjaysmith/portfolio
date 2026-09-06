# Contracts: Family Meals — server actions (Phase 1)

**Feature**: [../spec.md](../spec.md) · **Data model**: [../data-model.md](../data-model.md) · **Date**: 2026-09-06

Eight actions: seven in `lib/family/actions/meals.ts`, one added to `lib/family/actions/lists.ts`.
Every one is a Next server action under `runAction`, validated with a `z.strictObject` schema,
scoped by the actor's `household_id` on every query, and answers the shipped `ActionResult<T>`.

## Guards

- **`requireVerifiedActor()`** on every action — the punch-in cookie re-read against the database
  (any role). A dismissed keypad is `NO_ACTOR`, the one silent refusal.
- **Parent** on `updateMealCategory` only: the actor's role is re-read from the database; a member
  is `FORBIDDEN` (FR-640). Nothing here is Parents only in the Lists sense — there is no hidden
  record — so `FORBIDDEN` is the honest answer.
- **Scope discipline** (FR-629, FR-630): `updateMeal`/`deleteMeal` on a meal whose `rrule` is set
  require `scope`; on a one-time meal `scope` must be absent; `scope: "this"` with `recipeId` in
  the patch is `VALIDATION`.

## Shared result shape

`ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError; message: string; fields?: FieldErrors }`
with the shipped `ActionError` set (`VALIDATION`, `NO_ACTOR`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`UNAVAILABLE`). `CONFLICT` is new to this phase's use: a mealtime name already taken (FR-610), mapped
from the unique index to a field error on `name`.

## Shared input shapes

```ts
type RepeatInput =                       // the calendar's RepeatChoice, reused (FR-627)
  | { kind: "never" }
  | { kind: "daily"; until: string | null }
  | { kind: "weekly"; weekdays: RuleWeekday[]; until: string | null }
  | { kind: "monthly"; until: string | null };

type RecipeChoice =
  | { kind: "existing"; id: string }       // must be the household's and not removed
  | { kind: "new"; name: string; text?: string };   // FR-622: also creates the recipe

type MealScope = "this" | "this_and_future" | "all";   // the calendar's Scope
```

Bounds (mirroring the database): mealtime name 1–40, recipe name 1–120, recipe text ≤ 10 000,
note ≤ 200, a date `YYYY-MM-DD`, `until` a date not before the meal's date.

## Mealtime categories

### `updateMealCategory(input: { id: string; patch: { name?: string; color?: PaletteColor } }): ActionResult<MealCategory>`
Parent only. Renames and/or recolours one of the four. A name colliding with another mealtime's
(trimmed, case-insensitive) → `CONFLICT` with `fields.name`. Unknown id in this household →
`NOT_FOUND`.

## Recipes

### `createRecipe(input: { name: string; categoryId: string; text?: string }): ActionResult<Recipe>`
One INSERT. The category must be the household's → else `NOT_FOUND`.

### `updateRecipe(input: { id: string; patch: { name?: string; categoryId?: string; text?: string } }): ActionResult<Recipe>`
One UPDATE on a recipe that is not removed; a removed recipe → `NOT_FOUND` (it is un-editable, as
it is un-plannable).

### `deleteRecipe(input: { id: string; mode: "recipe" | "recipe_and_meals"; confirm: true }): ActionResult<{ removedMeals: number }>`
`mode: "recipe"` → one UPDATE setting `removed_at` (the meals stay; `removedMeals` is 0).
`mode: "recipe_and_meals"` → one DELETE; the meals and their exceptions cascade; `removedMeals` is
the count of `meals` rows that went. Not undoable (FR-616).

## Planned meals

### `planMeal(input: { date: string; categoryId: string; recipe: RecipeChoice; note?: string; repeat?: RepeatInput }): ActionResult<Meal>`
A `new` recipe → INSERT the recipe (in the slot's category) then INSERT the meal; an `existing`
one → one INSERT. `repeat` other than `never` → `rrule = mealRuleOf(repeat, date)`; `until` before
`date` → `VALIDATION` on `repeat`. Returns the meal with its (empty) exceptions.

### `updateMeal(input: { id: string; occurrenceDate: string; scope?: MealScope; patch: { date?: string; categoryId?: string; note?: string | null; recipeId?: string; repeat?: RepeatInput } }): ActionResult<Meal>`
`occurrenceDate` must be an occurrence the expander produces for this meal → else `NOT_FOUND`.
- One-time meal (`scope` absent): one UPDATE; `repeat` may turn it into a series.
- `scope: "this"`: upsert an `override` exception on `occurrenceDate` with the patched `date`,
  `categoryId`, `note` (an existing override is merged); `recipeId` or `repeat` here → `VALIDATION`.
- `scope: "this_and_future"`: on the first occurrence, behaves as `all`; otherwise
  `split_meal_series` with the head truncated to `occurrenceDate − 1` and a tail starting on the
  patched date with the patched fields and rule. Returns the tail.
- `scope: "all"`: one UPDATE on the row; a changed `date` re-anchors the series on that date;
  `repeat: never` deletes the exceptions.

### `deleteMeal(input: { id: string; occurrenceDate: string; scope?: MealScope; confirm: true }): ActionResult<null>`
- One-time: one DELETE.
- `this`: upsert a `skip` exception (an override on that date becomes a skip).
- `this_and_future`: on the first occurrence, as `all`; otherwise one UPDATE truncating the rule.
- `all`: one DELETE; exceptions cascade.

## Lists (amendment)

### `addListItems(input: { listId: string; texts: string[] }): ActionResult<{ added: number }>`
Phase 5's list rule (any punched-in Profile; a Parents only list answers `NOT_FOUND` to a member).
`texts` 1–200 entries, each trimmed and cut to 200 characters, blanks refused by validation. One
INSERT of N rows, `section = null`, consecutive `sort_order`s from `nextSortOrder`, all attributed
to the actor. Not de-duplicated.

## Database functions (delta)

- `family.seed_default_meal_categories(uuid) → integer` — called by the seed script, never by an
  action; 0 when the household already has mealtimes.
- `family.split_meal_series(uuid, uuid, uuid, text, date, jsonb) → uuid` — called by `updateMeal`
  at `this_and_future` only.

## Read path (not an action)

`fetchMealCategories`, `fetchRecipes`, `fetchMeals` under the session client (RLS); the pages seed
`familyKeys.mealCategories | recipes | meals`; `useMealCategories`, `useRecipes`, `useMeals` on the
client; realtime invalidates by the bare sweep.

## Error-handling contract (delta)

| Situation | Answer |
|---|---|
| Nobody punched in | `NO_ACTOR` (the client opens the keypad, writes nothing) |
| A member renames a mealtime | `FORBIDDEN` |
| A meal, recipe or mealtime of another household, or a removed recipe planned or edited | `NOT_FOUND` |
| A mealtime name already in use | `CONFLICT`, `fields.name = ["That name is already used."]` |
| A scope on a one-time meal, no scope on a repeating one, a recipe change at `this`, an `until` before the date | `VALIDATION` with the field |
| `occurrenceDate` not an occurrence | `NOT_FOUND` |
| The split function fails mid-way | `UNAVAILABLE`; nothing partial (one transaction) |
| Offline | the shipped fetch failure → `UNAVAILABLE`, shown where the tap happened (FR-642) |
