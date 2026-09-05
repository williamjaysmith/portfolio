# US1 verification walk (T028) — stars on the board, by hand

**Feature**: [spec.md](../spec.md) · **Tasks**: T028 · **Created**: 2026-09-05

The ten acceptance scenarios of User Story 1 plus SC-402's ledger read.

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
| [ ] 1 | Stars field | Edit a task as Ana | A **Stars** field after Phase 3's fields, 0–500, with the guidance line |
| [ ] 2 | Chip present / absent | Read Brush teeth (5) and Sort the recycling (none) | A gold chip on the first; none on the second, same card height |
| [ ] 3 | Tick earns | As Cleo, complete Brush teeth | Her column's star pill reads 5; the Rewards balance rises by 5; one credit row |
| [ ] 4 | Un-tick retracts | Un-tick it | Pill back; balance back by 5; a second reversing row, the first kept |
| [ ] 5 | Both slots | Complete both Brush teeth slots | 10, not 5 |
| [ ] 6 | Skip earns nothing | Skip Feed the cat, then unskip | Nothing credited either way |
| [ ] 7 | Parent on behalf | Ana completes Cleo's Feed the cat | Credited to Cleo; actor Ana |
| [ ] 8 | Value edit | Change Feed the cat 10 → 3 after a credit | Balance unchanged; the next tick earns 3 |
| [ ] 9 | Second device | Tick on A | B's pill and balance agree within 5 s |
| [ ] 10 | Template's fourth field | Edit a Task Box template; add from it | Four fields; the value pre-filled |

## Where each row is already proved

| What | Tier |
|---|---|
| The field, its bounds, blank/0 → none, the template's fourth field and pre-fill | `tasks-validation`, `rewards-validation`, `TaskForm.test`, `TaskBoxSheet.test` — unit; `task-actions`, `task-box` — policies |
| The chip present/absent and the accessible name | `StarChip.test`, `TaskCard.test` — unit |
| One credit per tick at the task's value, one retraction per un-tick, nothing on skip, the value edit rewriting nothing | `rewards-schema.test` — policies (the trigger truth table) |
| The pill above the filters, per day, per Profile | `use-board-occurrences.test`, `ColumnHeader.test`, `TasksBoard.test` — unit |
