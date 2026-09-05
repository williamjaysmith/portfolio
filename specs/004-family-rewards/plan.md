# Implementation Plan: Family Rewards

**Branch**: `004-family-rewards` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-family-rewards/spec.md`

## Summary

Build the star economy and the Rewards tab for `/family` on the shipped Phase 1–3 platform: star
values on tasks and templates with a chip on the card; stars credited on completion and retracted
on undo, per Profile, as an append-only ledger; a Profile's balance and the board's stars-today
pill; reward cards per Profile with a progress bar or a Redeem button; redeem with the photographed
modal and falling gold stars, and unredeem; a parent's give-and-take with a before-and-after
table; the whole-list emoji rain and the Amazing/Strong Week messages — every write behind the
punch-in and the Phase 3 role rules.

The technical core is **one decision made three times: the database, not the action, keeps the
money exact.** A completion's credit and an un-tick's retraction are trigger consequences of the
resolution row Phase 3 already writes, so the three resolution verbs are untouched and "one tick,
one entry" is true on every path including cascades (R401). A redemption is one INSERT whose
trigger locks the Profile's row, checks eligibility, the one-time rule and the balance against
the **stored** cost, and writes the debit — so two devices cannot both spend one balance and no
RPC is needed (R403). The balance is a view over the ledger, and the board's pill is a windowed
read of the same rows, so neither can drift (R402). Everything else is reuse: the Rewards tab is
the Tasks board's chassis with different columns (R409), the celebrations are three pure verdicts
mounted only by the local write that earned them (R408), and the chip rides the shipped badge.

This phase adds **four migrations (024–027), zero dependencies, no shipped-table alterations, and
no function on the write path beyond triggers**; it amends five shipped surfaces named in the spec
and replaces one placeholder.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+
**Primary Dependencies**: Next.js 16.1.6, React 19.1.0, Tailwind 4, `@supabase/ssr` + `@supabase/supabase-js`, TanStack Query 5, `jose`, Zod 4, `framer-motion` (the modal's entrance, the sprites' fall) — **no new dependencies** (R416)
**Storage**: Supabase Postgres, schema `family`, project `zgmltllcyqylgtazunai`; migrations 024–027 on top of 001–023 — four tables, one view, six trigger functions and one helper, four publication entries; **no alteration to a shipped table**. PG 17 confirmed hosted (Phase 3 T081). Local stack on 553xx
**Testing**: Vitest 4 projects — unit (jsdom: the celebration verdicts, the memo-chain pill, progress bar/button arithmetic, permissions, validation, the RTL surfaces) and policies (node, local stack: trigger truth per kind, the money rules under concurrency, the privilege delta, SC-416 per path, cascades)
**Target Platform**: iPadOS Safari (the wall tablet, both orientations); iOS/Android phones; desktop for development
**Performance Goals**: a chip, a pill and a balance that agree within 5 s across devices (SC-404); a redeem that returns in one round trip; celebrations that end on their own within 6 s (SC-413); balance sums over hundreds of rows in single-digit milliseconds
**Constraints**: FR-441 — refuse, never queue; every star write serialised per Profile and exact (SC-402, SC-409); WCAG 2.1 AA + 44×44 pt on every new control (FR-445); reduced motion collapses every celebration; fallow budgets (cyc 20 / cog 15, CRAP needs coverage, no suppressions); Supabase free tier
**Scale/Scope**: one household; a few hundred ledger rows a year; 45 FRs (FR-401…FR-445), 19 SCs, 14 assumptions, 6 contradiction resolutions; 4 migrations, ~6 new `lib/family` modules, ~12 new components, 5 amended surfaces, 1 replaced placeholder. Zero NEEDS CLARIFICATION.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How this plan satisfies it |
|---|---|---|
| **I. Sub-apps are self-contained** | PASS | Everything lands in `app/family/**`, `lib/family/**`, `supabase/migrations/` and the seed script, with one deliberate root-level touch: a `family-rewards-core` zone in `.fallowrc.json` (`lib/family/rewards/**/*`), the Phase 2/3 pattern — a boundary widening in config, reviewable in the diff, not a suppression (R418). No new dependency, no `next.config`/`proxy`/`vitest.config` edit. Nothing moves between sub-apps; Phase 3's open §I question (the swipe helpers) is not reopened and nothing here adds a consumer outside `/family`. |
| **II. Test-first for logic** | PASS | The parts that can be silently wrong are pure or in the database and land test-first: the three celebration verdicts, the pill and progress arithmetic, the six permission operations, the validation bounds — and, in the policies tier before the actions exist, the trigger truth table (credit at the task's value, none on skip, one retraction and never two), the money rules (ineligible, one short, second one-time, two concurrent redemptions, refund once, adjustment refused below zero for all chosen Profiles, retraction below zero allowed) and the cascades. The falling stars, the rain and the modal's feel are verified by running the app. |
| **III. Accessible and touch-first** | PASS | FR-445: Redeem buttons, the Redeemed and Give-stars controls, the modal's two buttons and the adjustment's confirm are ≥44×44 with visible focus; the chip and the pill carry text, not colour alone; the modal is a `dialog` with focus management on the shipped `useModalDialog`; the bar's label is on the bar and in the accessible name; the three celebrations are `aria-hidden` decoration behind a reduced-motion check, and the week message is a polite live region. |
| **IV. Layered, boundary-enforced architecture** | PASS | Verdicts, progress arithmetic and the pill live in framework-free `lib/family/rewards/**`; components render from them; the actions send one statement each; the database keeps the invariants. `lib` imports nothing from `app/**`; the new zone may reach `family-tasks-core` (for the counters' types) and nothing else new. |
| **V. Quality gates** | PASS | The branchy new code is pure and table-tested; the two functions most likely to breach the absolute budget are planned split: `assertMayRedeem` (four cases) is its own helper beside `assertMayResolve`, and `RewardsBoard`'s model hook is composed from `useRewardsView` + `useRewardsData` from the start, the way Phase 3's board model had to be split under the gate. `rewardProgressOf` is one function with three outcomes. Duplication is handled by reuse rather than by the gate: the tab mounts the shipped geometry, pager and strip; the chip reuses the badge; the Redeemed switch reuses the filter-store shape (a second small store on the same pattern, as `useTaskFilters` was to `useDeviceVisibility` — if `fallow:dupes` flags the two stores, the answer is a shared `useDeviceSwitches` helper, never a threshold lift). No suppression anywhere. |
| **VI. Degrade gracefully** | PASS | FR-441 verbatim; a refused redemption leaves the card as it was and says why; a vanished reward closes its details; the Redeemed store keeps the in-memory fallback. Destructive copy states what is kept: the Profile-delete dialog gains the forfeited count; the reward-delete dialog says the stars already spent stay spent. |
| **VII. Private by default** | PASS | Four tables with `is_member()` read policies, SELECT to `authenticated`, ALL to `service_role`, nothing to `anon`; the view is `security_invoker`; every write is a `requireVerifiedActor`/`requireParent` action; every cross-table reference proves tenancy through a composite `(id, household_id)` FK; the trigger functions are `security definer`, `search_path = ''`, revoked from public and callable by nobody. Every entry and every redemption records the actor beside the Profile credited. Replica identity stays default. |
| **VIII. Fidelity is specified** | PASS | All 45 FRs are tagged; the two `[V-photo]` corrections Phase 3 recorded are inherited; the estimated geometry (chip, bar, modal, sprites) stays `[ESTIMATED]`/`[OURS]` in the token layer. No spec sentence is narrowed by design: FR-405's "the household-local day of the completion" is the resolution's `resolved_on` in the trigger — a late chore earns on the day it was ticked, as the spec's edge case and 003 FR-354 both say. |

**Result: PASS, no deviation claimed, no open question.** The one thing a reader might mistake for a
deviation is evaluated rather than waved through: Phase 3's "no function on the write path"
(R310) was a finding about *RPCs*, and this phase has none; its triggers are the database enforcing
its own invariants, the same kind of object as `assert_task_resolution()`, and the reason they
exist is stated in R401/R403 — a half-written star is a wrong balance, not a stale badge.

### Re-check after Phase 1 design

- **The database now writes rows on its own.** Tested against §II and §VII: the two resolution
  triggers are the first in this schema that insert into another table. They are `security
  definer` with an empty search path, revoked from public, and their truth table is the first thing
  the policies tier proves; the actions that fire them are unchanged, so no action grew a second
  statement. **PASS.**
- **A trigger holds a row lock.** Tested against §VI: `for update` on one `categories` row for the
  duration of one short transaction; at one household's write rate contention is nil, and a
  waiter is a device that redeems a moment later with a correct answer, never a stuck one. **PASS.**
- **A balance may read below zero.** Tested against §VI's "never lose the user's data": nothing is
  lost — the retraction is written, the redemption stands, and the number is honest (Assumption 5).
  The Redeem buttons hide, the bar reads the negative honestly, and the next credits climb back.
  **PASS.**
- **A shipped resolution's DELETE now has a side effect.** Tested against §II: `deleteTask`'s
  "this occurrence" path and `deleteCategory`'s cascade both delete resolutions — and both now
  retract correctly for free, which is the point of a trigger; the policies suite asserts the
  cascade case explicitly. **PASS.**

### Complexity Tracking

No deviation is claimed. Two design choices are recorded here because a reviewer could ask:

| Choice | Why not the simpler alternative |
|---|---|
| Triggers on `task_resolutions` write ledger rows | A second statement from the action leaves a completion without its credit on a crash or a retry — a wrong balance with no self-healing path (R401). An RPC would be the phase's only write-path function and would still need the trigger for the cascade paths. |
| The money rules live in `assert_redemption()` / `assert_star_adjustment()` rather than in the actions | The invariant is on a sum two devices race for; only the database can hold the lock that makes the sum true at the moment of the write (R403, SC-409). |

## Project Structure

### Documentation (this feature)

```text
specs/004-family-rewards/
├── plan.md              # This file
├── spec.md              # 45 FRs, 19 SCs, 14 assumptions, 6 contradiction resolutions
├── research.md          # Phase 0 — R401–R418
├── data-model.md        # Phase 1 — migrations 024–027 in full SQL, invariants, privilege delta
├── quickstart.md        # Phase 1 — setup, fixtures, per-guarantee verification, operator steps
├── contracts/
│   └── server-actions.md    # Phase 1 — six actions, four amendments, the trigger table
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/
├── 024_rewards.sql                  # rewards + eligibilities + assert_reward_eligibility
├── 025_star_ledger.sql              # star_entries + star_balances + the two resolution triggers + the adjustment guard
├── 026_redemptions.sql              # redemptions + assert_redemption + record_redemption
└── 027_realtime_rewards.sql

scripts/family-seed.mjs              # (~) star values, three rewards, Cleo's 15

lib/family/
├── rewards/                         # NEW zone family-rewards-core, framework-free
│   ├── progress.ts                  # rewardProgressOf(balance, cost) → bar | redeem; card order (FR-427)
│   ├── stars.ts                     # starsTodayOf(entries, profileId, day); balanceMapOf(rows)
│   └── celebrations.ts              # listCompletesWith · redemptionCelebration · weekVerdictOf (R408)
├── types.ts                         # (~) Task.rewardPoints, TaskBoxItem.rewardPoints, BoardOccurrence.rewardPoints;
│                                    #     Reward, RewardEligibility, StarEntry, StarBalance, Redemption, RewardFilters
├── rows.ts                          # (~) reward_points joins TASK_COLUMNS / TASK_BOX_COLUMNS; REWARD_*, STAR_ENTRY_*, REDEMPTION_* columns + mappers
├── validation.ts                    # (~) rewardPoints on both task schemas; rewardInputSchema; adjustStarsSchema; redeem schemas
├── queries.ts                       # (~) familyKeys.starWeek / balances / rewards / redemptions + fetch* + use*; categoryTaskCounts.starsForfeited
├── permissions.ts                   # (~) six operations; canRedeem target rule
├── actions/rewards.ts               # NEW: createReward, updateReward, deleteReward, redeemReward, unredeemReward, adjustStars
├── actions/tasks.ts, task-box.ts    # (~) rewardPoints through create/update; template copy
├── actions/categories.ts            # (~) deleteCategory: rewards left with nobody
├── actions/shared.ts                # (~) P0004–P0008 in DB_ERROR_CODES
├── tasks/expand.ts                  # (~) rewardPoints carried onto BoardOccurrence
└── __tests__/
    ├── unit/                        # rewards-progress, rewards-stars, rewards-celebrations, permissions delta, validation delta
    └── policies/                    # rewards-schema (trigger truth, money rules, concurrency), rewards-access (SC-416), rewards-actions, privileges delta

app/family/
├── tokens.css                       # (+) reward card, bar, modal, sprite tokens [ESTIMATED]; chip reuses badge tokens
└── (app)/
    ├── components/
    │   ├── nav.ts                   # (~) rewards: showsChipRow false
    │   ├── useFamilyRealtime.ts     # (~) + four tables
    │   ├── settings/DeleteDialog.tsx# (~) the forfeited-stars sentence
    │   ├── useDeviceSwitches.ts     # NEW (only if dupes flags the two stores) — else useRewardFilters mirrors useTaskFilters
    │   └── celebrations/            # NEW: EmojiRain.tsx, StarConfetti.tsx, WeekMessage.tsx — sprites + reduced motion
    ├── tasks/components/
    │   ├── TaskCard.tsx             # (~) StarChip beside the title
    │   ├── ColumnHeader.tsx         # (~) the star pill beside the count
    │   ├── useBoardOccurrences.ts   # (~) starsToday in the memo chain, above the filters
    │   ├── TasksBoard.tsx           # (~) mounts EmojiRain / WeekMessage on the local success; seeds starWeek
    │   ├── TaskForm.tsx, useTaskForm.ts, TaskBoxSheet.tsx  # (~) the Stars field, the fourth template field
    │   └── StarChip.tsx             # NEW (the badge pill, Star icon)
    └── rewards/
        ├── page.tsx                 # (~) replaces the placeholder: rewards + eligibilities + balances + redemptions → initialData
        └── components/
            ├── RewardsBoard.tsx     # chassis: useBoardGeometry + useColumnPage + ColumnPager + BoardStrip (shared), no reorder
            ├── RewardColumn.tsx     # header (avatar, name, balance) + cards in FR-427's order
            ├── RewardCard.tsx       # emoji, title, bar | Redeem | "Redeemed on"
            ├── RewardDetails.tsx    # details + parent Edit/Delete + Unredeem on a redeemed card
            ├── RewardForm.tsx, useRewardForm.ts  # six fields on the shipped formSubmit path
            ├── RedeemModal.tsx      # 540×700, the two lines, Done / Unredeem; mounts StarConfetti
            ├── GiveStarsSheet.tsx   # Profiles, amount, before-and-after, Confirm
            ├── useRewardFilters.ts  # the Redeemed switch (per device)
            └── useRedeem.ts         # the withActor commit path for redeem/unredeem (the useTaskResolve pattern)
```

**Structure Decision**: the Rewards tab replaces its Phase 1 placeholder inside the `(app)` route
group; the star surfaces on the Tasks tab are amendments to Phase 3's components. `BoardStrip`,
`ColumnPager`, `useBoardGeometry` and `useColumnPage` are consumed from the tasks components by the
rewards components (a `components` → `components` import, legal today); if that reads as a
tasks-to-rewards dependency worth breaking, `BoardStrip` moves to `app/family/(app)/components/`
in the same commit — a move inside one sub-app, no §I question.

## Implementation phasing

| # | Step | Verifiable by |
|---|---|---|
| 1 | Migrations 024–027 on the local stack + the `family-rewards-core` zone + the policies suites **written red first**: trigger truth (credit at value, none on skip, retraction once), money rules (ineligible, one short, second one-time, two concurrent redemptions, refund once, adjustment guard all-or-nothing, retraction below zero), cascades, the privilege delta, SC-416 per path | `supabase db reset`; every policies test green; `privileges.test.ts` exact |
| 2 | Rows / types / validation / the four reads + keys + `initialData` on both pages; `rewardPoints` through `expandTaskDay`; realtime tables | Unit validation tests (0–500, blank→null, cost, ≥1 Profile, unknown keys refused); reads under RLS |
| 3 | `lib/family/rewards/*` — `progress`, `stars`, `celebrations` — **tests first** | The progress truth table (< / = / >), FR-427's order, `starsTodayOf` over a mixed week, `listCompletesWith` incl. skip/filter cases, `weekVerdictOf` incl. "skip is neither" |
| 4 | Actions: `rewards.ts` (six), the four amendments, `permissions.ts` delta, `DB_ERROR_CODES` — **policies tests first** | SC-406/407/408/409/411/412 issued directly |
| 5 | The Tasks tab's star surfaces: the Stars field (both forms), the chip, the pill in the memo chain, the template pre-fill | RTL: chip present/absent, pill unmoved by filters, four template fields; Story 1 by hand |
| 6 | The Rewards tab: page, board chassis, columns, cards, details, form, Redeemed switch, chip-row suppression | Story 2 by hand at four viewports; RTL for bar/button/muted card and order |
| 7 | Redeem / unredeem: `useRedeem`, the modal, the punch-in, the refusal copy; Give stars sheet | Story 3 and Story 4's 1–5 by hand; RTL for the modal's two lines |
| 8 | Celebrations: the three components, the mounting rule on local success only, reduced motion, the week rollover judgement + per-device once store | SC-413/414/415 in RTL and by hand |
| 9 | Delete-dialog amendment, `deleteCategory` cleanup, seed fixtures, tokens | SC-419 by hand; a fresh reset shows the fixtures |
| 10 | Gates, graph, the T083-style review (code-reviewer + security-guardian over migrations, triggers, actions, guards), docs sync | All four gates green, no suppressions |
| 11 | **Hosted push (024–027) and the §4 checks, then merge and deploy** | Privileges with no `anon`; `star_balances` `security_invoker`; four tables published at replica identity default |

## Risks

| Risk | Mitigation |
|---|---|
| A trigger that inserts into another table hides a bug the tests never see | The trigger truth table is the first thing the policies tier proves, per kind, including "nothing" cases; the four partial unique indexes make doubling impossible rather than untested |
| The per-Profile row lock contends or deadlocks | One lock, one row, one short transaction, in a fixed order (Profile then reward `for share`); at family scale contention is a rounding error, and a deadlock would need two Profiles' writes in opposite orders inside one transaction, which no action does (each adjustment row locks one Profile; the multi-row INSERT locks in `categoryIds` order, sorted by the action) |
| `household_today()` disagrees with the actions' day arithmetic near midnight | Both read `household_settings.timezone`; the trigger uses `now()` at the write, the actions the same; a one-second skew at the rollover can only move `entered_on`, never an amount |
| The chip's height shifts the measured column fit | The fit measures a token probe, not a card; the card grows in height only, and the column scrolls |
| The emoji rain fires from the wrong counters | Computed from the **pre-write** counters at tap time (R408), so a refetch cannot move the decision; RTL asserts no mount on a refetch-only change |
| The week verdict is judged from an incomplete previous week | The neighbour-week prefetch already warms it; the judgement waits for the previous week's read to settle and is remembered per device so it is never shown twice or lost |
| Deploy before push takes the channel down | Phase 3's ordering rule, restated in quickstart §4 and the tasks file |
| The two per-device stores trip `fallow:dupes` | Extract `useDeviceSwitches` the moment it is flagged; never a threshold lift |

## Progress

- [x] Phase 0 — research complete ([research.md](./research.md): R401–R418, no open unknowns, zero new dependencies)
- [x] Constitution check — pass, before and after design, no deviation claimed
- [x] Phase 1 — design complete: [data-model.md](./data-model.md) (024–027 in full SQL, invariants, the privilege delta, the fallow zone), [contracts/server-actions.md](./contracts/server-actions.md) (six actions, four amendments, the trigger table, the SQLSTATE map), [quickstart.md](./quickstart.md)
- [ ] Phase 2 — `/speckit.tasks`
- [ ] Phase 3 — implementation per the phasing table above
