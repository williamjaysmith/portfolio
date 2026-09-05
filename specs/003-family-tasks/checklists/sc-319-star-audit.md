# SC-319 star audit (T080) — no star value anywhere in Phase 3

**Feature**: [spec.md](../spec.md) · **Tasks**: T080 · **Run**: 2026-09-04, locally, ahead of the
operator block (needs neither migration 023 nor hosted access)

## Finding: PASS

**Concrete, not by inspection alone.** `reward_points` appears in neither `TASK_COLUMNS` nor
`TASK_BOX_COLUMNS` (`lib/family/rows.ts` — both column lists carry a comment saying it is absent
by design, and the string occurs nowhere else in that file) and in neither the `Task` nor the
`TaskBoxItem` row type (`lib/family/types.ts`), so the value cannot reach a component to be
rendered by accident. Both reserved columns still exist (`017_tasks.sql`, `021_task_box.sql`) and
are read by nothing: the only mentions in `app/family/**` and `lib/family/**` outside tests are
doc comments stating the absence (`actions/task-box.ts`, `actions/tasks.ts`, `validation.ts`,
`types.ts`, `TaskForm.tsx`, `TaskBoxSheet.tsx`). The create and edit validators refuse — rather
than strip — an unknown key, which is how a star value sent by a client is rejected
(`tasks-schema.test.ts` "the reserved star value are bounded", `task-box.test.ts`).

Grep used (case-insensitive, non-test sources): `reward_points|\bstars?\b|celebrat|Amazing Week|
balance|redemption|redeem`. Every hit is either one of the doc comments above, `rebalance` (the
shipped `ordering.ts` fractional-index helper — a different word), or the one carve-out below.

## Surfaces walked

| Surface | Star value / chip / total / balance / celebration | 
|---|---|
| Board (`TasksBoard.tsx`, `BoardStrip`, `ColumnPager`) | none |
| Card (`TaskCard.tsx`, `CompleteCircle`, `LateBadge`, `StreakBadge`) | none — the streak badge is a lightning bolt over `streak_count` (FR-371), not a star |
| Column header (`ColumnHeader.tsx`) | none — the ring and the "n of m" count only (FR-305) |
| Details view (`TaskDetails.tsx`) | none |
| Create / edit form (`TaskForm.tsx`, `useTaskForm.ts`) | none — no field, no seed key |
| Delete dialogs (`DeleteScopeDialog.tsx`, `DeleteConfirm`) | none |
| Filter sheet (`FilterSheet.tsx`) | none — four switches, Profiles, Labels |
| Search (`TaskSearch.tsx`) | none |
| Task Box sheet (`TaskBoxSheet.tsx`) | none — two sections and a title search |
| Template edit form (in `TaskBoxSheet.tsx`) | **exactly three fields**: summary, emoji, routine (FR-380) |
| Completion feedback (`CompleteCircle`, `TaskCard` cross-fade) | one card's own cross-fade only — no whole-list emoji rain, no "Amazing Week" (held back with the rest of the celebrations) |

## The one pre-existing, out-of-scope exclusion, by name

Phase 1's shipped shell renders a **Rewards** nav tab with a lucide `Star` icon
(`app/family/(app)/components/nav.ts:30`), and `app/family/(app)/rewards` is a live placeholder
route reachable from every tab including Tasks. Neither is a Phase 3 surface and neither is
touched by this phase; SC-319 carries the same carve-out so the criterion is decidable.
