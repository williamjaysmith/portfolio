# US3 verification walk (T044) — redeeming, by hand

**Feature**: [spec.md](../spec.md) · **Tasks**: T044 · **Created**: 2026-09-05

The twelve acceptance scenarios of User Story 3.

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

## The twelve scenarios

| # | Scenario | What must happen |
|---|---|---|
| [ ] 1 | Punched out taps Redeem | "Who's here?" first; dismissing changes nothing |
| [ ] 2 | Cleo redeems Bake cookies at 20 | Balance 0; one redemption; the modal's two lines, Done, Unredeem |
| [ ] 3 | Cleo taps Ben's reward | Refused, names Ben |
| [ ] 4 | Ana redeems for Cleo | Cleo's balance; "By Cleo"; actor Ana |
| [ ] 5 | Motion allowed / reduced | Gold stars over the whole screen, backdrop warmed / nothing |
| [ ] 6 | Renewing after Done | Back at ☆ 0/20 |
| [ ] 7 | One-time after Done | Muted "Redeemed on <date>" for Cleo; Ben's card untouched |
| [ ] 8 | Unredeem from the modal | Balance back exactly; redemption kept as reversed; card restored |
| [ ] 9 | Unredeem later from the card | Same, from details |
| [ ] 10 | Two devices, same second | Exactly one redemption; the other told "no longer has enough" |
| [ ] 11 | Second device | Balance and card follow within 5 s; no stars fall there |
| [ ] 12 | Balance 19, cost 20, off-interface | Refused, nothing written |

## Where each row is already proved

| What | Tier |
|---|---|
| Eligibility, the one-time rule, the balance against the STORED cost, the copied cost/name/day, SC-409's race, the refund once | `rewards-schema.test`, `rewards-actions.test` — policies |
| The target rule (member self / parent anyone / demoted parent) | `permissions.test` — unit; `rewards-actions.test` — policies |
| The modal's two lines, Unredeem through the hook, the confetti mounted once and not under reduced motion, not on a refetched redemption | `RedeemModal.test`, `useRedeem.test`, `StarConfetti.test`, `RewardsBoard.test` — unit |
