# Tasks: Family Rewards

**Input**: Design documents from `/specs/004-family-rewards/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/server-actions.md, quickstart.md — all final

**Tests**: Included and mandatory. The constitution (§II) makes test-first non-negotiable for pure logic, and this phase's pure logic is money: the trigger truth table, the money rules under a lock, the celebration verdicts, the progress arithmetic and the permission matrix. Every one lands red before the code that makes it green.

**Organization**: Grouped by user story in the spec's priority order. Setup and Foundational block every story; then US1 (stars on the board) → US2 (the Rewards tab) → US3 (redeeming) → US4 (hand adjustments and the celebrations), each reading state the previous one creates.

**Phases 1–3 are shipped and live.** Nothing here forks them. No shipped table changes shape; the three resolution verbs are not edited (their ledger consequences are the database's, R401). **The hosted push (024–027) precedes the merge and the deploy** — Hard ordering, restated at T058.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelisable — different files, no dependency on an unfinished task
- **[Story]**: US1–US4 on story-phase tasks only
- Every task names its files; FR/SC references are the spec's; R references are research.md's

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the four migrations, the fallow zone and the seed fixtures, written against data-model.md before anything is applied.

- [x] T001 [P] Migration `supabase/migrations/024_rewards.sql` — `family.rewards` (`name` 1–120, `description` ≤2000, `emoji` ≤16, `point_value` 1–500, `respawn_on_redemption`, attribution, `unique (id, household_id)`), `family.reward_eligibilities` (PK `(reward_id, category_id)`, composite FKs cascading both ways, the `(household_id, category_id)` index), `assert_reward_eligibility()` (Profiles only, `23514`, `security definer`, `search_path = ''`, revoked from public), the `touch` trigger, RLS + `is_member()` read policies, SELECT to `authenticated`, ALL to `service_role`, **the fold-into-existing rejection header** (data-model §024). Serves FR-414–FR-421
- [x] T002 [P] Migration `supabase/migrations/025_star_ledger.sql` — `family.star_entries` per data-model §025 (`amount <> 0`, the five `kind`s, `star_entry_kind_shape`, `star_entry_sign_shape`, loose `resolution_id`/`redemption_id` with **no FK**, copied `summary`, `entered_on`), the two indexes and the **four partial unique indexes** (one credit / retraction / redemption / refund per source), `family.star_balances` `with (security_invoker = true)`, `family.household_today(uuid)`, `credit_task_resolution()` AFTER INSERT on `task_resolutions` (value at that moment, `earned_on = new.resolved_on`, nothing on skip / worth nothing / nobody credited), `retract_task_resolution()` BEFORE DELETE (once, never below-zero-checked, **and only while the task and the credited Profile still exist** — a cascade from a task or Profile deletion writes no retraction, FR-411/FR-443), `assert_star_adjustment()` BEFORE INSERT on kind `adjustment` (−500…500, lock the Profile's `categories` row, refuse below zero with `P0004`), RLS, grants, `notify pgrst`. Serves FR-405–FR-414, FR-434–FR-436, Assumption 5
- [x] T003 [P] Migration `supabase/migrations/026_redemptions.sql` — `family.redemptions` per data-model §026 (copied `point_value`, `reward_name`, `redeemed_on`, `reversed_at`/`reversed_by`, `redemption_reversal_shape`, composite FKs, the two indexes), `assert_redemption()` BEFORE INSERT (lock the Profile row, `for share` on the reward, `P0002`/`P0005`/`P0006`/`P0007`, copies cost/name/day, nulls the reversal columns), `record_redemption()` AFTER INSERT/UPDATE (the debit; the refund once with `P0008` on a second reversal; `23514` on any other update), RLS, grants, `notify pgrst`. Serves FR-424–FR-433
- [x] T004 [P] Migration `supabase/migrations/027_realtime_rewards.sql` — the 022 guard block verbatim over `rewards`, `reward_eligibilities`, `star_entries`, `redemptions`; replica identity left at default; `notify pgrst`. Serves FR-410, R411
- [x] T005 [P] `.fallowrc.json` — the `family-rewards-core` zone (`lib/family/rewards/**/*`), its rule (`family-rewards-core`, `family-tasks-core`, `lib`), and the name added to the allow lists of `family-actions`, `components`, `ui-pages`, `tests` (R418; data-model §"Dashboard / config steps"). A boundary widening in config, not a suppression
- [x] T006 [P] `scripts/family-seed.mjs` — the Phase 4 fixtures (R413), idempotent by emptiness: `reward_points` on Brush teeth 5, Practice piano 5, Feed the cat 10, Take out trash 20, Clean the bathroom 15; rewards **Bake cookies** 🍪 20 renewing (Cleo), **Movie night** 🍿 15 one-time (Cleo + Ben), **Ice cream** 🍨 25 one-time (every Profile); one `adjustment` entry giving Cleo 15 (`created_by` Ana, `entered_on` the anchor day); a log line per fixture. Applied at T012

**Checkpoint**: the four files review clean against data-model.md; nothing applied yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the schema proved by tests before the code that uses it; the types, reads and pure modules every story renders from.

### Schema, test-first (write red against the running 553xx stack — still on 001–023 until T012 resets it)

- [x] T007 [P] Failing policies tests `lib/family/__tests__/policies/rewards-schema.test.ts` — **the trigger truth table** (R401, SC-402/403/405): inserting a `complete` resolution on a 10-star task writes exactly one `credit` of 10 to `category_id` dated `resolved_on` with the task's `summary` and the resolution's `created_by`; a `skipped` one writes nothing; a task worth `null` or `0` writes nothing; deleting the resolution writes exactly one `retraction` of −10 and a second delete attempt (re-insert, delete again) never doubles because of the partial unique index; editing `reward_points` after the credit leaves the credit's amount; a retraction that takes the balance below zero succeeds (Assumption 5); **the cascade cases**: deleting the task after a credit leaves the credit and writes no retraction (FR-411), deleting the credited Profile removes their entries by cascade, writes no retraction and **succeeds** (the FK case C1 named), and `deleteTask` scope `this` on a completed occurrence retracts like an un-tick. **The CHECK/shape refusals**: `amount = 0`, a `credit` without `resolution_id`, a `redemption` with an `earned_on`, a negative `credit`, a `point_value` of 0 or 501, a `name` of 121, a Label as an eligibility (`23514`), `adjustment` of 501 (`23514`) and one that would overdraw (`P0004`)
- [x] T008 [P] Failing policies tests, same file — **the money rules** (R403, SC-408/409/411/412): `assert_redemption` refuses an ineligible Profile (`P0005`), a balance one short (`P0007`), and a second standing one-time redemption (`P0006`) while accepting a second redemption of a renewing reward; a successful insert copies `point_value`/`reward_name`/`redeemed_on` from the reward and the household day **ignoring caller-supplied values**, and writes one `redemption` entry; **two concurrent inserts** of the same reward for one Profile at exactly the cost (two `Promise.all`ed inserts through `pg` pool clients) end with exactly one row and one `P0007`; the reversal UPDATE writes one `refund`, a second reversal is `P0008`, an UPDATE of `point_value` is `23514`; a **multi-row adjustment** where one Profile would overdraw writes nothing for any Profile. **The cascades** (SC-419, FR-405, FR-421): deleting a reward removes eligibilities and redemptions and leaves `sum(amount)` unchanged; deleting a Profile removes their entries, redemptions and eligibilities and leaves a shared reward on the other Profile; `star_balances` returns one row per Profile, none per Label, 0 with no entries
- [x] T009 [P] Failing policies tests `lib/family/__tests__/policies/rewards-access.test.ts` — SC-416 per path: each of the four tables and the view read as a member (rows), cross-household (`[]`), anonymous (`42501`); an authenticated INSERT/UPDATE/DELETE on each refused (`42501`); the `events-access.test.ts` pattern
- [x] T010 [P] Extend `lib/family/__tests__/policies/privileges.test.ts` — `TABLES` gains the four tables and the view (SELECT `authenticated`, ALL `service_role`, view SELECT both, nothing to `anon`); `FUNCTIONS` gains `household_today`, `assert_reward_eligibility`, `credit_task_resolution`, `retract_task_resolution`, `assert_star_adjustment`, `assert_redemption`, `record_redemption` with **no** grant to anyone; `star_balances.reloptions` = `security_invoker=true`; the four tables in `pg_publication_tables` at replica identity `d`
- [x] T011 [P] Extend `lib/family/__tests__/policies/tasks-schema.test.ts` — `family.tasks.reward_points` and `family.task_box_items.reward_points` still accept `null`, `0` and `500` and refuse `-1` (the shipped CHECK, unchanged; the 500 ceiling is Zod's, T014)
- [x] T012 Apply: `supabase db reset` (001–**027**) → `npm run family:seed -- --local` → T007–T011 green → `npm run fallow:audit` clean with the new zone. **Only now** does story work begin

### Rows, types, validation, reads

- [x] T013 [P] `lib/family/rows.ts` + `lib/family/types.ts` — `reward_points` joins `TASK_COLUMNS` and `TASK_BOX_COLUMNS` (replace the two "absent by design" comments); `Task.rewardPoints`, `TaskBoxItem.rewardPoints`, `BoardOccurrence.rewardPoints` (`number | null`); `REWARD_COLUMNS`, `REWARD_ELIGIBILITY_COLUMNS`, `STAR_ENTRY_COLUMNS`, `STAR_BALANCE_COLUMNS`, `REDEMPTION_COLUMNS` and their mappers (`toReward` embedding `categoryIds`, `toStarEntry`, `toStarBalance`, `toRedemption`); the `Reward`, `StarEntry`, `StarBalance`, `Redemption`, `RewardFilters` types (contracts §Shared input shapes); `rewardsSelect()` built as a joined array like `eventsSelect()` (the bundler lesson); unit test `lib/family/__tests__/unit/rows.test.ts` for the new mappers and the select's bracket balance
- [x] T014 [P] Failing tests `lib/family/__tests__/unit/tasks-validation.test.ts` (extend) + `lib/family/__tests__/unit/rewards-validation.test.ts` → `lib/family/validation.ts`: `rewardPoints` on `taskObjectSchema` and `taskBoxItemSchema` — integer 0–500, `null`/blank/`0` normalised to `null`, `501` and `-1` and `2.5` refused with the field named (FR-402); `rewardInputSchema` (`name`, `description`, `emoji`, `pointValue` 1–500, `respawnOnRedemption`, `categoryIds` ≥1 distinct, unknown keys refused — a star-shaped or date key is `VALIDATION`), `updateRewardSchema` (`id` + partial patch, merged through the create schema), `deleteRewardSchema` (`confirm: true`), `redeemRewardSchema` (`rewardId`, `categoryId`), `unredeemRewardSchema` (`redemptionId`), `adjustStarsSchema` (`categoryIds` ≥1 distinct, `amount` integer −500…500 excluding 0) — all `z.strictObject`
- [x] T015 [P] `lib/family/queries.ts` — `familyKeys.starWeek(householdId, weekStartDate)`, `familyKeys.balances(householdId)`, `familyKeys.rewards(householdId)`, `familyKeys.redemptions(householdId)` (prefix-shaped under `familyKeys.all`); `fetchStarWeek` (entries with `earned_on` in the window, `kind in ('credit','retraction')`), `fetchStarBalances` (the view), `fetchRewards` (rewards + eligibilities embed), `fetchRedemptions` (all, `redeemed_at desc`); `useStarWeek`, `useStarBalances`, `useRewards`, `useRedemptions` with `initialData`; `fetchCategoryTaskCounts` gains `starsForfeited` from the view (FR-443); `prefetchTaskWeek` also warms `starWeek` (R407); a unit test for the four keys' prefix shape
- [x] T016 [P] `app/family/(app)/components/useFamilyRealtime.ts` — the four tables, unfiltered, with the R411 comment; `lib/family/actions/shared.ts` — `P0004`–`P0008` in `DB_ERROR_CODES` (`P0004`→`VALIDATION`, `P0005`→`FORBIDDEN`, `P0006`/`P0007`/`P0008`→`CONFLICT`) with a unit test for the map
- [x] T017 [P] `lib/family/tasks/expand.ts` — `rewardPoints` carried from the task onto every `BoardOccurrence` it generates; extend `lib/family/__tests__/unit/tasks-expand.test.ts` with one assertion per generator

### The rewards lib core — tests before every module (plan phasing step 3)

- [x] T018 [P] Failing tests `lib/family/__tests__/unit/rewards-stars.test.ts` → `lib/family/rewards/stars.ts`: `starsTodayOf(entries, profileId, day)` — the net of credits and retractions whose `earned_on` is `day` for that Profile, ignoring other kinds, other days, other Profiles, and returning 0 for none (FR-407); `balanceMapOf(rows)` → `Map<categoryId, balance>` (missing Profile → 0); `beforeAndAfterOf(balances, categoryIds, amount)` → the table rows and whether any result is below zero (FR-434/436)
- [x] T019 [P] Failing tests `lib/family/__tests__/unit/rewards-progress.test.ts` → `lib/family/rewards/progress.ts`: `rewardProgressOf(balance, cost)` → `{ kind: "bar", filled: 0–1, label: "☆ b/c" } | { kind: "redeem" }` at balance < / = / > cost, negative balances clamped to an empty bar (FR-420, FR-423); `orderRewardCards(cards)` — affordable first, then cost ascending, then `createdAt`, redeemed last (FR-427); `standingRedemptionOf(redemptions, rewardId, categoryId)` — the unreversed one or null; `isRedeemedOneTime(reward, redemptions, categoryId)`
- [x] T020 [P] Failing tests `lib/family/__tests__/unit/rewards-celebrations.test.ts` → `lib/family/rewards/celebrations.ts` (R408): `listCompletesWith(counters, occurrence, inFlightLocal = 0)` — true iff the occurrence is unresolved, in that Profile's column, and `counters.total - counters.completed - inFlightLocal === 1` **before** the write; false for a skip, for a second outstanding, for Up for Grabs, for an already-complete occurrence (FR-439, SC-414); `weekVerdictOf({ scheduledDays, completedDays, skippedDays })` → `"amazing"` when every scheduled day not skipped is completed and at least one is, `"strong"` when exactly one scheduled day is neither completed nor skipped and `scheduledDays.length >= 3`, else `null` — with the "skip is neither" cases from SC-415 and a routine scheduled twice a week never earning Strong (FR-440); `weekCelebrationKey(routineId, profileId, weekStart)`; `redemptionCelebration(redemption, profileName, zone)` → the modal's two lines with the household-local long date (FR-432/433)
- [x] T021 [P] Failing tests `lib/family/__tests__/unit/permissions.test.ts` (extend) → `lib/family/permissions.ts`: `reward.create`/`reward.edit`/`reward.delete`/`stars.adjust` parent-only; `reward.redeem`/`reward.unredeem` through a target rule `mayRedeemFor(actor, targetCategoryId)` — member only for themselves, parent for anyone, nobody without an actor — SC-407's four-check matrix (R410)

**Checkpoint**: both suites green against the reset stack; the ledger's truth table proved before any action or component exists; every read keyed and seeded.

---

## Phase 3: User Story 1 — Stars on the board (P1) 🎯 MVP

**Goal**: a parent sets a star value; the card shows the chip; ticking earns, un-ticking retracts, skipping earns nothing; the column's pill reads today's stars.

**Independent test**: US1's ten scenarios by hand on the seeded board plus SC-402's day read against the ledger.

- [x] T022 [P] [US1] Failing policies tests `lib/family/__tests__/policies/task-actions.test.ts` (extend) → `lib/family/actions/tasks.ts` and `lib/family/actions/task-box.ts`: `createTask`/`updateTask` write `reward_points` from `rewardPoints` (a member refused as before; `501` refused as `VALIDATION`); `createTask` from a template seed carries the template's value (the client passes it as `rewardPoints` — the action stores whatever validated value arrives, FR-404); `createTaskBoxItem`/`updateTaskBoxItem` accept the fourth field (FR-401, FR-380 inherited); `taskColumnsOf` includes `reward_points`; editing a value writes no ledger row (SC-405, asserted by counting `star_entries`)
- [x] T023 [US1] `app/family/(app)/tasks/components/TaskForm.tsx` + `useTaskForm.ts` — the **Stars** field after Phase 3's fields: numeric, 0–500, blank allowed, the guidance line ("a handful for a daily routine, up to a hundred for a big chore" — 36846200077723) as help text, `rewardPoints` in `TaskDraft`/`draftToTaskInput`; RTL in `TaskForm.test.tsx` for the field, its refusal message, and the edit form pre-filled from the task (FR-401, FR-402, SC-401)
- [x] T024 [US1] `app/family/(app)/tasks/components/TaskBoxSheet.tsx` — the template edit form's **fourth field** (stars, same rules) and the template `onChoose` seed carrying `rewardPoints` into the create form (FR-404); `TaskBoxSheet.test.tsx`: four fields, no fifth; the seed's value lands in the form
- [x] T025 [P] [US1] `app/family/(app)/tasks/components/StarChip.tsx` — the shipped `--fam-task-badge-*` pill, filled lucide `Star` inked `--fam-star-gold`, the count, `aria-hidden` with the value folded into the card's accessible name; `TaskCard.tsx` renders it beside the title when `rewardPoints > 0` and nothing otherwise (FR-403, SC-418); `StarChip.test.tsx` + `TaskCard.test.tsx`: present at 5, absent at null and 0, accessible name "…, worth 5 stars"
- [x] T026 [US1] `app/family/(app)/tasks/components/useBoardOccurrences.ts` — reads `useStarWeek(householdId, weekStartDate)` and computes `starsToday(profileId)` via `starsTodayOf` **in the counters memo, above the filters** (R317; the standing "no filter moves a number" assertion in `use-board-occurrences.test.ts` grows the pill); `BoardCounters` gains `starsToday`; `TasksBoard.tsx` passes it to the columns; `app/family/(app)/tasks/page.tsx` seeds `starWeek` (a fifth read) (FR-407)
- [x] T027 [US1] `app/family/(app)/tasks/components/ColumnHeader.tsx` + `ProfileColumn.tsx` — the **star pill** beside the completed-of-total pill (⭐ + count, the header pill tokens), never on `UpForGrabsColumn` (FR-407); `ColumnHeader.test.tsx`: reads 15 after a 5 + 10 day, 5 after a retraction, 0 with none; `TasksBoard.test.tsx`: the pill unmoved by every filter and by search (SC-320's helper `columnNumbers()` grows it)
- [ ] T028 [US1] US1 verification by hand — the ten scenarios in `specs/004-family-rewards/checklists/us1-verification.md` (the Phase 3 checklist format): the field and its guidance, the chip present/absent, the pill and balance after tick / un-tick / both slots / skip / parent-on-behalf / value edit / second device; SC-402's ledger read; SC-405. Record what was walked and what needs hardware

**Checkpoint**: stars are earned exactly and shown on the board — deployable MVP (the Rewards tab is still the placeholder, and that is fine).

---

## Phase 4: User Story 2 — The Rewards tab (P2)

**Goal**: columns per Profile with balances; reward cards with a bar or a Redeem button; a parent creates, edits and deletes rewards; a member cannot.

**Independent test**: US2's ten scenarios by hand on the seeded tab at the four viewports.

- [x] T029 [P] [US2] Failing policies tests `lib/family/__tests__/policies/rewards-actions.test.ts` → `lib/family/actions/rewards.ts` — `createReward`, `updateReward`, `deleteReward` (contracts §Rewards): `requireParent()`; a member `FORBIDDEN`; nobody punched in `NO_ACTOR`; no eligible Profile `VALIDATION` (field `categoryIds`); a Label `VALIDATION`; a cross-household id `NOT_FOUND`; `updateReward` rewrites eligibilities as a set difference leaving a surviving Profile's standing redemption in place and never changes a redemption's stored cost (FR-418, FR-420); `deleteReward` needs `confirm: true` and leaves the ledger sum unchanged (FR-421)
- [x] T030 [P] [US2] Failing tests `lib/family/__tests__/unit/rewards-filters.test.ts` → `app/family/(app)/rewards/components/useRewardFilters.ts` — the per-device **Redeemed** switch on the `useTaskFilters` pattern (key `family:reward-filters:v1`, default off, `persistent`, in-memory fallback) (FR-426, R409). If `fallow:dupes` flags it against `useTaskFilters`, extract `app/family/(app)/components/useDeviceSwitches.ts` and put both on it — never a threshold lift
- [x] T031 [US2] `app/family/(app)/rewards/page.tsx` — replaces the Phase 1 placeholder (FR-444): server reads `rewards`, `balances`, `redemptions` → `initialData`; `app/family/(app)/components/nav.ts` — `rewards: showsChipRow: false` (FR-422); an honest unavailable state when a read fails (the Phase 3 `page.tsx` pattern)
- [x] T032 [US2] **First** move `BoardStrip` — today a private function in `app/family/(app)/tasks/components/TasksBoard.tsx` — to an exported `app/family/(app)/components/BoardStrip.tsx` and rebind `TasksBoard` to it (a move inside `/family`, no behaviour change; `TasksBoard.test.tsx` still green). Then `app/family/(app)/rewards/components/RewardsBoard.tsx` — the chassis: `useBoardGeometry(columnCount)`, `useColumnPage`, `ColumnPager`, the shared `BoardStrip` grid, `visibleProfiles` as the columns in household order, the Redeemed switch and the Give-stars control in the tab's own chrome (the Give-stars control is wired at T051), the model split as `useRewardsView` + `useRewardsData` from the start (plan §V) (FR-422, SC-417); `RewardsBoard.test.tsx`: one column per Profile, none for a Label, the pager at seven columns, the chip row absent
- [x] T033 [P] [US2] `app/family/(app)/rewards/components/RewardColumn.tsx` — header (avatar, name, the balance pill reading the view's number, negative shown honestly — FR-413) and the cards in `orderRewardCards` order, with — only while the Redeemed switch is on — one muted "Redeemed on" card per standing redemption, most recent first, a renewing reward's live card staying above its history (FR-425–FR-427); `RewardColumn.test.tsx`
- [x] T034 [P] [US2] `app/family/(app)/rewards/components/RewardCard.tsx` — emoji, title, and **either** the bar (`rewardProgressOf` — track `--profile @40%`, fill `@100%`, "☆ b/c" centred on it and in the accessible name) **or** the Redeem button reading "Redeem ⭐ N" (≥44 pt) **or** the muted "Redeemed on <date>" card (FR-423, FR-425); the body opens details; `RewardCard.test.tsx`: the three states at balance < / = / > cost and redeemed
- [x] T035 [P] [US2] `app/family/(app)/rewards/components/RewardDetails.tsx` — title, description, emoji, cost, renews?, eligible Profiles; parent-only **Edit** / **Delete** (a confirmation saying it cannot be undone and that spent stars stay spent, FR-418); **Unredeem** on a redeemed card (wired at T047); `useModalDialog`; `RewardDetails.test.tsx`
- [x] T036 [US2] `app/family/(app)/rewards/components/RewardForm.tsx` + `useRewardForm.ts` — six fields on the shared `formSubmit` path (`settleSubmit`/`useSubmission`/`toggled`): title, description, emoji, cost 1–500, Renew after redeeming, eligible Profiles (Profiles only, ≥1 required — the picker lists `profiles`, never Labels); create from the FAB (`useRegisterFabAction`), edit from details; `RewardForm.test.tsx`: refusals land on fields, edit pre-filled (FR-415, FR-416, FR-419)
- [x] T037 [P] [US2] `app/family/tokens.css` — `[ESTIMATED]` tokens from 07 §4.12/§4.13/§7.1: reward card radius/emoji/title, the bar's height and radius, the modal's size and radius, the sprite size range and fall duration; the header balance pill reuses the counter pill tokens (R414)
- [ ] T038 [US2] US2 verification by hand — `checklists/us2-verification.md`: the ten scenarios, SC-417 at 1920×1080 / 1180×820 / 820×1180 / 390×844, the member refusals off-interface, the cost edit moving every bar

**Checkpoint**: the tab reads true and a parent can fill it; nothing can be redeemed yet, which is the point.

---

## Phase 5: User Story 3 — Redeeming (P3)

**Goal**: redeem behind the punch-in with the modal and the falling stars; unredeem refunds exactly; renewing vs one-time; two devices cannot overspend.

**Independent test**: US3's twelve scenarios by hand; SC-409 on two devices.

- [x] T039 [P] [US3] Failing policies tests `lib/family/__tests__/policies/rewards-actions.test.ts` (extend) → `redeemReward` and `unredeemReward` in `lib/family/actions/rewards.ts` (contracts §Redeeming): `requireVerifiedActor()` + `assertMayRedeem` (its own helper beside `assertMayResolve`, plan §V) — a member for themselves only (`FORBIDDEN` naming the Profile), a parent for any eligible Profile, a **demoted** parent refused; the insert carries only `reward_id`, `category_id`, `redeemed_by`; `P0005`→`FORBIDDEN`, `P0006`/`P0007`→`CONFLICT` with the contract's wording; the returned row's copied cost/name/day; `unredeemReward` reverses once (`P0008`→`CONFLICT`) under the same target rule on the redemption's Profile (FR-424, FR-428–FR-431); SC-409 issued as two concurrent action calls
- [x] T040 [US3] `app/family/(app)/rewards/components/useRedeem.ts` — the one `withActor` commit path for redeem and unredeem on the `useTaskResolve` pattern (per-card busy set, a queue, a notice), returning the outcome the modal is rendered from (FR-441)
- [x] T041 [US3] `app/family/(app)/rewards/components/RedeemModal.tsx` — the photographed modal (540×700 at the reference unit, r 40, the emoji at ~150, "Great work! <Reward> redeemed", "By <Profile> for N stars on <Month D, YYYY>", primary **Done**, secondary **Unredeem**), a `dialog` on `useModalDialog`, the backdrop **warmed not dimmed**; mounts `StarConfetti` (T042) on open; `RedeemModal.test.tsx`: the two lines from a redemption via `redemptionCelebration`, Unredeem calling through `useRedeem` (FR-432, FR-433)
- [x] T042 [P] [US3] `app/family/(app)/components/celebrations/StarConfetti.tsx` — 60–90 absolutely positioned five-pointed stars in `--fam-star-gold`, 28–48 px, random x / rotation / delay, falling over the **whole** viewport for 2.5–4 s with a fade, `aria-hidden`, unmounting itself on end; **renders nothing** under the shipped reduced-motion hook (FR-438, R408, R416); `StarConfetti.test.tsx`: mounts N sprites, none under reduced motion, unmounts after the duration (fake timers)
- [x] T043 [US3] Wire redeem end to end — `RewardCard`'s Redeem → `useRedeem` → the modal; the punch-in prompt when nobody is punched in; a refusal as the board's notice; `RewardDetails`'s **Unredeem** on a redeemed card (FR-431); the renewing reward back to a bar and the one-time one to the muted card after Done (FR-430, FR-425); `RewardsBoard.test.tsx`: the celebration mounts on the local success and **not** on a refetched redemption (R408)
- [ ] T044 [US3] US3 verification by hand — `checklists/us3-verification.md`: the twelve scenarios incl. SC-408's one-short and exact-cost checks, SC-409 on two devices, SC-410's two kinds, SC-411 from both places, the confetti's whole-screen fall and the warm wash, reduced motion

**Checkpoint**: stars can be spent and un-spent, exactly once each, from any device.

---

## Phase 6: User Story 4 — Giving stars by hand, and the celebrations (P4)

**Goal**: a parent's give-and-take with the before-and-after table; the whole-list emoji rain; the Amazing/Strong Week messages.

**Independent test**: US4's nine scenarios by hand; SC-412/413/414/415.

- [ ] T045 [P] [US4] Failing policies tests `lib/family/__tests__/policies/rewards-actions.test.ts` (extend) → `adjustStars` in `lib/family/actions/rewards.ts` (contracts §Giving stars): `requireParent()`; one multi-row INSERT sorted by `categoryIds`, each row `kind = 'adjustment'`, `summary = null`, `created_by = actor.profileId`, `entered_on` = the household day from `loadHouseholdZone`; `P0004`→`VALIDATION` naming the first Profile that would overdraw, with **nothing written for any**; returns the resulting balances; `0`, `501`, a Label, a cross-household id refused (FR-434–FR-436, SC-412)
- [ ] T046 [US4] `app/family/(app)/rewards/components/GiveStarsSheet.tsx` — Profiles (multi-select, Profiles only), the amount (integer, negative allowed, −500…500 ≠ 0), the **before-and-after table** from `beforeAndAfterOf` with the below-zero row flagged and Confirm disabled while any is, Confirm through `withActor`; opened from the tab's **Give stars** control (parent-only affordance; the server decides); `GiveStarsSheet.test.tsx`: the table equals the result for two Profiles and a negative, the refusal shown per Profile
- [ ] T047 [P] [US4] `app/family/(app)/components/celebrations/EmojiRain.tsx` — ~80 random emoji sprites falling over the whole viewport once, 2.5–4 s, `aria-hidden`, self-unmounting, nothing under reduced motion (FR-439); `EmojiRain.test.tsx` on the `StarConfetti` pattern
- [ ] T048 [US4] `app/family/(app)/tasks/components/TasksBoard.tsx` + `useTaskResolve.ts` — the mounting rule: at tap time compute `listCompletesWith(counters.column(profileId), occurrence, inFlightLocal)` where `inFlightLocal` is the number of this device's completions for that Profile still queued or writing in `useTaskResolve` (two quick taps on the last two outstanding cards must fire once, on the second); on that write's success mount `EmojiRain` once; never on a skip, never from a refetch, again after an undo and a re-completion (FR-439, SC-414); `TasksBoard.test.tsx`: mounts exactly when the last outstanding occurrence completes by tap, not on skip, not when a filter hides the last one, not on a refetched completion
- [ ] T049 [P] [US4] Failing tests `lib/family/__tests__/unit/week-celebrations.test.ts` → `app/family/(app)/tasks/components/useWeekCelebrations.ts` — on the household week's rollover (the shipped `useDayAnchor` zone and `weekStartOf`), for every tracked routine × assignee, judge the **previous** week from `taskWeek(prevWeekStart)` (already warmed) and the routine's scheduled days — obtained through `family-tasks-core` (a `scheduledDaysInWeek(task, weekStart, zone)` added to `lib/family/tasks/expand.ts` over the existing generators, **never** `ruleDatesIn` directly: `components` may not import `family-recurrence`) — with `weekVerdictOf`; remember shown keys per device in `family:week-celebrations:v1` (a small bounded store, oldest evicted) so each shows once per device; the judgement waits for the previous week's read to settle (FR-440, SC-415)
- [ ] T050 [P] [US4] `app/family/(app)/components/celebrations/WeekMessage.tsx` — the message on the board ("Amazing week, <Profile>! <Routine> every day." / "Strong week, <Profile>!"), a polite live region, dismissed by a tap or after a few seconds, its motion collapsed under reduced motion; `WeekMessage.test.tsx`
- [ ] T051 [US4] Wire the Give-stars control into `RewardsBoard.tsx`'s chrome and `WeekMessage` into `TasksBoard.tsx` from `useWeekCelebrations`; `RewardsBoard.test.tsx`: the control absent for a member's affordance and present for a parent
- [ ] T052 [US4] US4 verification by hand — `checklists/us4-verification.md`: the nine scenarios; SC-412's two-Profile table and the refusal; SC-413 under reduced motion and with motion on both devices; SC-414's skip / filter / undo cases; SC-415 with the clock across two weeks

**Checkpoint**: all four stories independently verified; every star write exact; every celebration local and once.

---

## Phase 7: Polish, the delete dialog, and the operator's steps

- [ ] T053 [P] Failing policies tests `lib/family/__tests__/policies/task-actions.test.ts` (extend, the `deleteCategory` cases) → `lib/family/actions/categories.ts`: after Phase 3's orphaned-task cleanup, delete every reward left with no eligibility (FR-443); a shared reward survives on the other Profile (SC-419)
- [ ] T054 [P] `app/family/(app)/components/settings/DeleteDialog.tsx` — the third sentence: how many stars the Profile forfeits (`fetchCategoryTaskCounts.starsForfeited`) when positive, "clears a debt of N stars" when negative (Assumption 5), nothing at zero — stated with Phase 3's two counts and two promises (FR-443); `DeleteDialog.test.tsx` for the three wordings
- [ ] T055 Full quickstart run against the local stack — every "Verifying the guarantees" row that runs locally (SC-401, 402, 403, 405, 406's authed paths, 407, 408, 410, 411, 412, 413, 414, 415 via a clock jump, 416, 417, 418, 419) plus the "Load-bearing FR spot-checks"; fix any drift between the documents and the behaviour, recording it in `checklists/quickstart-run.md`
- [ ] T056 [P] Gates + graph — `npm run test:coverage` first, then `npm run fallow:audit` (zero NEW findings with the new zone; the two per-device stores and `useRedeem` vs `useTaskResolve` are the likely `fallow:dupes` flags — extract a shared helper, never a threshold lift), `npm test`, `npm run typecheck`, `npm run lint`, `npm run graph`. **No suppressions anywhere**
- [ ] T057 **Constitution review gate** — `code-reviewer` over the whole diff against `main`, `security-guardian` over `supabase/migrations/024–027` (the five trigger functions, the row lock, `household_today`, the view, the privilege delta), `lib/family/actions/rewards.ts`, the `permissions.ts` delta, the `deleteCategory` amendment and the realtime change. Every finding fixed — or surfaced to the operator — before T058. Depends on T055, T056
- [ ] T058 **[OPERATOR — needs the hosted push]** `supabase db push --linked` (024–027; a dry run lists exactly those four), then quickstart §4's checks: no `anon` row on the four tables or the view; the seven functions executable by nobody; `star_balances` `security_invoker=true`; the four tables in `pg_publication_tables` at replica identity `d`; one `star_balances` row per Profile at 0. **The push MUST complete before the branch is merged or deployed** (R411). Then SC-404 and SC-409 on two real devices, SC-417 on the iPad in both orientations and on a phone, the falling stars and the emoji rain on the wall tablet
- [ ] T059 Documentation sync — `CLAUDE.md`'s active-feature block and status, `specs/004-family-rewards/plan.md` Progress, any quickstart drift T055 found, memory notes; final commit(s) on `004-family-rewards`. **Merge and deploy come after T058, never before it**

---

## Dependencies

- **Setup (T001–T006)** → **Foundational (T007–T021)** → every story. T012 is the gate between them: nothing story-shaped starts until the reset stack passes T007–T011.
- **US1 (T022–T028)** depends on T013–T018 (rows, validation, reads, `expand`, `stars.ts`). It is the MVP and needs nothing from US2–US4.
- **US2 (T029–T038)** depends on T013–T015, T019, T021 and on US1's T026 only for the shared `BoardStrip`/geometry (already shipped) — it can start in parallel with US1's component work once Foundational is green.
- **US3 (T039–T044)** depends on US2's tab (T031–T036) and on T020's `redemptionCelebration`.
- **US4 (T045–T052)** depends on US1's board wiring (T026, T027) for the rain and the week message, on US2's chrome (T032) for Give stars, and on T018/T020.
- **Polish (T053–T059)** depends on all four stories; T057 on T055 and T056; T058 on T057; T059 on T058.

**Hard ordering**: T012 before any story; T058's hosted push before T059's merge.

## Parallel opportunities

- Setup: T001–T006 all [P].
- Foundational: T007–T011 [P] (five test files, red), then T012; T013–T021 [P] after T012 (different files; T017 needs T013's type).
- US1: T022 and T025 [P] with T023/T024; T026 → T027 sequential.
- US2: T029, T030, T033, T034, T035, T037 [P]; T031 → T032 → T036 sequential.
- US3: T039 and T042 [P]; T040 → T041 → T043 sequential.
- US4: T045, T047, T049, T050 [P]; T046, T048, T051 sequential after them.
- Polish: T053, T054, T056 [P].

## Implementation strategy

**MVP = US1**: after T028 the board earns and shows stars exactly, and the Rewards tab is still the placeholder — a coherent, deployable increment on its own (behind the hosted push of 024–027). US2 makes the stars spendable in principle, US3 in fact, US4 adds the hand and the party. Each story ends in a by-hand checklist so the tiers and the screen are reconciled before the next begins.

## Format validation

Every task line begins `- [ ] T0nn`, carries `[P]` only where its files and inputs are independent of unfinished work, carries `[US1]`–`[US4]` on story-phase tasks and no label on Setup/Foundational/Polish, and names its files. 59 tasks: Setup 6, Foundational 15, US1 7, US2 10, US3 6, US4 8, Polish 7.
