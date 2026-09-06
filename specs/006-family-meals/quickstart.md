# Quickstart: Family Meals

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-09-06

How to set the phase up, verify each guarantee by hand, and take it to the hosted project. Phases
1–5 must already be live (through migration 029).

## 1. Prerequisites

Node 20+, the Supabase CLI (2.105 or newer), Docker, Chrome. The local stack on **553xx**.

## 2. Environment

`.env.local` as Phase 5 left it — nothing new. The hosted keys are read only by the seed's `--yes`
mode.

## 3. Local stack

```sh
supabase start
supabase db reset                       # replays 001–033
npm run family:seed -- --local          # the household, Profiles, four mealtimes, the fixtures
npm run dev:local                       # sign in with family-dev-password
```

The seed prints `mealtimes  4 default mealtimes (seeded)` and the fixtures: seven recipes (one
removed), a week of meals with a weekly "🍕 Pizza" carrying a skip and a move, and a meal that
references the removed recipe. PINs are never seeded: set Ana `1234` in Settings before any write.

## 4. Hosted project — operator steps

> **Ordering constraint, unchanged since Phase 3**: the push happens **before** the branch is
> merged or deployed. Four more tables join the single shared realtime channel.

1. **Push**: `supabase db push --linked` (030–033; a dry run lists exactly those four).
2. **Privileges** (`supabase db query --linked`): `meal_categories`, `recipes`, `meals`,
   `meal_exceptions` — `authenticated` SELECT, `service_role` ALL, **no `anon` row**;
   `seed_default_meal_categories` and `split_meal_series` executable by `service_role` only.
3. **Publication**: the four tables in `pg_publication_tables` for `supabase_realtime`, replica
   identity `d` on each.
4. **Mealtimes**: `npm run family:seed -- --yes` → "4 default mealtimes (seeded)"; then
   `select name, color, position from family.meal_categories order by position;` — exactly
   Breakfast `#A8D4D3` 1, Lunch `#F66951` 2, Dinner `#915EA1` 3, Snack `#FDC36D` 4. A second run adds
   nothing.
5. Then merge, deploy, and the device pass (§"Verifying").

## 5. Run

Open Meals. The fixtures already fill the week, so the grid, the rail, a full slot, a repeating
meal and a removed-but-planned recipe are all there before anything is typed.

## Verifying the guarantees — by hand

| Criterion | What must hold | Verify by hand |
|---|---|---|
| **SC-601** four mealtimes once | Breakfast · Lunch · Dinner · Snack, seeded colours; re-seed adds none | Fresh reset without `--local` fixtures (or hosted step 4): four rows; seed again: still four |
| **SC-602** plan ≤5 s | The meal appears in the same slot on B; a New Entry appears in B's Recipes pane | Plan "🍝 Spaghetti" as a New Entry on A; B shows the chip and the recipe within 5 s |
| **SC-603** edit/move/delete ≤5 s; same-second plans | B follows each; two plans into one slot both land | Move it to Thursday with a note on A; B follows. Two devices plan into Saturday Snack together: two chips |
| **SC-604** mealtime rename/recolour; hide | Everywhere within 5 s, meals stay in the row; hide leaves this device within 1 s | Ana renames Snack → Tea and recolours; B follows. Hide Lunch on A: the row leaves A only |
| **SC-605** repeats and scopes | Every matching day, none after the end; each scope exact | Weekly Pizza until +8 weeks; page the weeks; edit one (This meal), then This and future, then All |
| **SC-606** Add to List | Exactly N items, one write, at the end, ungrouped; B's Lists tab agrees | Add to List from Spaghetti with 3 lines unticked; count the Grocery List on both |
| **SC-607** recipe delete both ways | "Just the recipe": gone from the pane, meals keep name and text; "and meals": everything gone | Delete "Old stew" recipe-only (its meal stays, Open Recipe works); delete "Older stew" with meals |
| **SC-608** offline / nobody / member | Refused with a message; keypad first; a member cannot rename | Airplane mode: plan → message, nothing stored. Punched out: tap a cell → keypad. As Cleo: no pencils; a direct `updateMealCategory` → `FORBIDDEN` |
| **SC-609** no stranger's data, no client write | `42501` for anon; zero rows for another household; `authenticated` cannot write | `curl` the four REST endpoints without a session; a second household's member; an `authenticated` INSERT |
| **SC-610** viewports | 7 columns at 1920; whole columns at 1180/820; 1 at 390; never sideways scroll | 1920×1080, 1180×820, 820×1180, 390×844 on `/family/meals` |
| **SC-611** tokens | Every meals metric one `--fam-meal-*` token `[ESTIMATED]`, read back by a test | `grep -c "fam-meal" app/family/tokens.css`; `meal-tokens.test.ts` |
| **SC-612** accessible names | Cell = "Wednesday 9 September, Dinner, 2 meals"; chip = the name; switches by name and state; keyboard adds a second meal | VoiceOver over a column; Tab into a chip, Enter, "Add another meal" |
| **SC-613** tests | Unit + policies green | `npm test`, `npm run test:policies` |
| **SC-614** channel intact; drag intact | Calendar, Tasks, Rewards, Lists still live ≤5 s; event drag unchanged with tokens present | Two devices: an event, a task, a redeem, a list tick; drag an event across a day with meal tokens showing |
| **SC-615** placeholder gone; no chips; "Add Meal"; no Recipes tab | Audit the tab; other tabs unchanged | Open `/family/meals`; screenshot the rail; screenshot Tasks/Rewards/Lists before/after |

### Load-bearing FR spot-checks

- **FR-611 / FR-637**: hide Lunch on the wall — its row leaves the grid and its tokens leave the
  wall's calendar; the phone shows both; planning into Lunch from the phone still lands.
- **FR-616**: after "Just the recipe", the recipe is not in From Recipes; its meal's popover still
  opens the text.
- **FR-622**: a New Entry named exactly like an existing recipe makes a second recipe (names are
  not unique — the reference's are not either); the picker shows both.
- **FR-629**: Edit on a one-time meal never asks a scope; on a repeating meal always does, first.
- **FR-632**: the pushed items are at the end of the list, ungrouped, in the recipe's order, all
  unchecked, attributed to the actor.
- **FR-635**: Show Meals off leaves the Meals tab untouched and every token gone from this device.
- **FR-645**: delete a throwaway Profile who planned meals and kept recipes: everything stays;
  nothing about meals in the confirmation.

## Automated checks — which suite covers what

| Suite | Covers |
|---|---|
| `lib/family/__tests__/unit/meals-*.test.ts` | expand (walks, skips, moves, the end), slots, repeat rules, the week, lines, the library filter/search, visibility, dietary notes, validation, tokens |
| `lib/family/__tests__/unit/permissions.test.ts` | `mealtime.edit` parent-only; `meal.write`/`recipe.write` open |
| `app/family/(app)/meals/components/__tests__/*.test.tsx` | the board, rail, cell (tap/hold/keyboard), chip, popover, sheets, pane, categories sheet |
| `app/family/(app)/calendar/components/__tests__/MealRow.test.tsx`, `FilterSheet.test.tsx` | tokens by day and order, hidden mealtimes, Show Meals; the sheet's Meals section |
| `lib/family/__tests__/policies/meals-*.test.ts`, `privileges.test.ts` | schema, access, every action and scope, the two functions' grants |

## Quality gates

`npm run fallow:audit` (zero new findings, duplication 0), `npm test`, `npm run typecheck`,
`npm run lint` on `app/family` + `lib/family` — before every commit, no suppressions.

## Common problems

- **"That name is already used."** — mealtime names are unique trimmed and case-insensitively.
- **A repeating meal's occurrence will not take a new recipe** — by design (FR-630): delete this
  meal and add the other, or change the recipe for the whole series.
- **The two-device checks do not fire on the local stack** — the local realtime image may lag this
  supabase-js (Phase 5's run record); verify on hosted, or `brew upgrade supabase` first.
- **PINs gone after a reset** — set them in Settings; they are never seeded.
