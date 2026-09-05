# Quickstart run (T078) — the local stack, 2026-09-04

**Feature**: [spec.md](../spec.md) · **Tasks**: T078, T079 · **Stack**: `supabase start` (553xx),
`supabase db reset` replaying 001–**023**, `npm run family:seed -- --local`, `npm run dev:local`,
Chrome via the DevTools MCP (1920×1080 window; 390×844 and 820×1180 emulated).

## Gates (T079, the run after migration 023)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` on `app/family` + `lib/family` | clean (the whole-repo run carries 11 pre-existing `react-hooks/refs` errors in `app/skyhammer`, `app/colectivo`, `app/components/**` — untouched by this phase, on `main` before it) |
| `npx vitest --project unit` | 121 files, **1970** tests |
| `npx vitest --project policies` | 20 files, **294** tests, on the 001–023 schema |
| `npm run fallow:audit` (with coverage) | no issues in the changed files — dead code 0, complexity 0, duplication 0; no suppressions anywhere |
| `npm run fallow:dupes` vs `main` | **no code duplication found** (it reported 408 lines across ten files before the shared halves were extracted: `useSwipePan`, `probeAttachment`, `formSubmit`, `DetailRow`, `loadHouseholdZone`) |
| `npm run graph` | rebuilt |

## "Verifying the guarantees" — where each row was proved

Every SC with an automated tier ran green in that tier (the tables in `quickstart.md` §5 name the
files). The rows that only a screen can prove were walked as far as a script can drive them:

| Row | How | Result |
|---|---|---|
| SC-303/304/310 counters, and FR-384's "filters never move them" | board at 1920: Late off, Completed off, a Profile hidden, Show all; then search `trash` / `bin` / clear | Ana `1/4`, Ben `0/7`, Cleo `0/19` unmoved through every step; cards moved, numbers did not |
| SC-312 streak, FR-371/372 badge | the seeded board | "Brush teeth" carries the bolt reading **11**; "Practice piano" (skipped) reads 5 and appears only once Skipped is on |
| SC-318 Task Box | Add Task → Task Box | 17 templates — 9 Chores, 8 Routines — own search; "Take out trash" pre-fills the Add form (title, type Chore; no assignee, no date) |
| SC-315 nothing unreachable / no sideways scroll | `scrollWidth === clientWidth` at 1920, 820 and 390; Ben's column body scrolls its own 511 px in 296 | pass |
| SC-316 / FR-397 44-pt floor | every `main` control measured at 390×844 | none under 44×44 |
| FR-395 portrait wrap | 820×1180: six columns wrap 3×2; seven page three at a time | pass — **with the two-row bound added during this run** (see below) |
| FR-396 phone pager | 390×844: one 370-px column, Up for Grabs first; swipes left/right step one Profile; ends clamp | pass |
| FR-357/358 late | Ben's three carried "Take out trash" (Aug 14/21/28) and Ana's "Hoover the stairs" badged `Late · <date>` and sorted first | pass |
| FR-305/312 ring + routine progress | rings and `n/m` per column; "Brush teeth 0/2" | pass |
| SC-305 anon probe, SC-306/311 two devices, SC-314 overnight, SC-301/302 stopwatch, the reorder feel | need the hosted endpoint, a second device, a night, a stopwatch, a finger | **T084 (operator)**; the rules behind them are in the policies and unit tiers |
| Resolve/skip/claim/delete by hand, template edit/delete | need a punched-in actor (no PIN is seeded) | proved in `task-actions.test.ts`, `task-box.test.ts`, `useTaskResolve.test.tsx`, `TasksBoard.test.tsx`, `TaskDetails.test.tsx`, `ClaimDialog.test.tsx`, `DeleteScopeDialog.test.tsx` |

## Drift found, and what won

1. **The portrait wrap needed a bound.** FR-395 says "a second row"; `boardLayoutOf` wrapped onto
   as many rows as it took, and the seeded seven-column household on a portrait iPad became three
   rows of ~330 px with no readable card. Reality won: the wrap is now to two rows at most
   (`MAX_WRAPPED_ROWS`), pages otherwise; R320 carries the note; three cases added to
   `tasks-layout.test.ts`. The four-column spec household is unaffected.
2. **The day controls stranded the Next arrow** on its own line under the search at 390 px. They
   now wrap as one unit (`BoardNav`).
3. **A tap on a second card while the first was writing was silently dropped** (`useTaskResolve`'s
   one board-wide lock — the T083 review's finding). Writes are now queued per card and never
   dropped, with both cards busy; a repeat tap on the same card is still the same tap twice.
4. **Migration citations** still said 016 for `family.tasks` after the hotfix renumbering; now 017.

Nothing in `quickstart.md` itself needed to change: its rows describe behaviour, not row counts.
