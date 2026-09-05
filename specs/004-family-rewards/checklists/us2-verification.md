# US2 verification walk (T038) — the Rewards tab, by hand

**Feature**: [spec.md](../spec.md) · **Tasks**: T038 · **Created**: 2026-09-05

The ten acceptance scenarios of User Story 2 plus SC-417 at the four viewports.

**Status: automated tiers green; the screen walk is recorded in [quickstart-run.md](./quickstart-run.md)
(T055), which runs every story's scenarios together against the seeded local stack.** Rows below are
ticked only where that walk did them on a screen; the rest are proved in the tiers named at the end.

## Setup

```
supabase start · supabase db reset (001–027) · npm run family:seed -- --local · npm run dev:local
```

Seeded: Cleo 15 stars (one adjustment by Ana); Brush teeth 5 ⭐ (tracked, streak 11), Practice piano 5,
Feed the cat 10, Take out trash 20 (Ben), Clean the bathroom 15 (Ana); rewards Bake cookies 🍪 20
(renews, Cleo), Movie night 🍿 15 (one-time, Cleo + Ben), Ice cream 🍨 25 (one-time, everyone).
PINs are never seeded — set Ana's and Cleo's in Settings first.

## The ten scenarios

| # | Scenario | What to do | What must happen |
|---|---|---|---|
| [x] 1 | Columns | Open Rewards | One column per Profile in household order, avatar + name + balance; no Label; no chip row |
| [x] 2 | The bar | Cleo at 15, Bake cookies 20 | Bar three-quarters, "☆ 15/20" on it, no Redeem |
| [x] 3 | The button | Movie night 15 | "Redeem ⭐ 15", no bar |
| [ ] 4 | Create | Ana taps + | Six fields; refused with no Profile |
| [x] 5 | Two Profiles | Ice cream for Cleo and Ben | Each column shows its own progress; Ana's does not |
| [ ] 6 | Details | Tap a card body | Title, description, emoji, cost, renews?, who; Edit/Delete for a parent |
| [ ] 7 | Member refused | As Cleo | No create/edit/delete controls; a direct call refused |
| [ ] 8 | Cost edit | Bake cookies 20 → 30 | Every bar re-reads at once |
| [ ] 9 | Phone | 390×844 | One column, swipe to the next |
| [x] 10 | Punched out | Read the tab | Everything visible, no PIN asked |

## Where each row is already proved

| What | Tier |
|---|---|
| The three verbs, roles, the eligibility rewrite, the cost edit leaving redemptions | `rewards-actions.test` — policies |
| Bar / button / muted card at balance < / = / > cost; card order | `rewards-progress.test`, `RewardCard.test`, `RewardColumn.test` — unit |
| The chassis: one column per Profile, none for a Label, the pager, the chip row absent, the Redeemed switch | `RewardsBoard.test`, `nav.test`, `AppShell.chiprow.test` — unit |
| The form's refusals landing on fields; Labels never offered | `RewardForm.test` — unit |
