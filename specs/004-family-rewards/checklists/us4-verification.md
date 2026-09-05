# US4 verification walk (T052) — giving stars by hand, and the celebrations, by hand

**Feature**: [spec.md](../spec.md) · **Tasks**: T052 · **Created**: 2026-09-05

The nine acceptance scenarios of User Story 4.

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

## The nine scenarios

| # | Scenario | What must happen |
|---|---|---|
| [x] 1 | Give stars | Profiles, an amount (negative allowed), the before-and-after table |
| [x] 2 | 10 to Cleo and Ben | Both balances exact; one entry each naming Ana |
| [ ] 3 | −5 from Ben at 50 | 45 |
| [ ] 4 | −5 from Ben at 3 | Refused: 3 → −2 shown, Confirm disabled; nothing written |
| [x] 5 | As Cleo | No Give stars; a direct call refused |
| [x] 6 | Last outstanding completed | Emoji rain once; again after undo + re-tick |
| [ ] 7 | Reduced motion / completed by skip | Nothing |
| [ ] 8 | A full week / one missed / two missed | Amazing / Strong / nothing, at the next week's first paint |
| [ ] 9 | Second device | Data only, no rain |

## Where each row is already proved

| What | Tier |
|---|---|
| adjustStars: one statement, all-or-nothing below zero, roles, bounds | `rewards-actions.test`, `rewards-schema.test` — policies |
| The before-and-after arithmetic and the sheet | `rewards-stars.test`, `GiveStarsSheet.test`, `RewardsBoard.test` — unit |
| `listCompletesWith` incl. skip / filter / in-flight taps; the mounting rule | `rewards-celebrations.test`, `TasksBoard.test`, `useTaskResolve.test` — unit |
| `weekVerdictOf` incl. "skip is neither"; the rollover judgement and once-per-device memory | `rewards-celebrations.test`, `week-celebrations.test`, `WeekMessage.test` — unit |
| The two showers: sprites, reduced motion, onDone | `StarConfetti.test`, `EmojiRain.test`, `shower.test` — unit |
