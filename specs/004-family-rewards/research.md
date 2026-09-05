# Phase 0 Research: Family Rewards

**Feature**: `004-family-rewards` | **Date**: 2026-09-05

Every decision the plan needs that the spec left to design, each with its rationale and the
alternatives it beat. Numbered R401–R418 so the plan, data model, contracts and tasks can cite
them; the spec's own numbered decisions are Assumptions 1–14 and are not restated here.

Phase 3's research (R301–R326) remains in force. Where a decision below **narrows** one of those
— chiefly R310's "no function on the write path" — the entry says so and why.

## What binds this phase before any decision is taken

- **The ledger is the truth** (spec Assumption 5, master map divergence 6): balances are sums of
  immutable entries, a reversal is a second entry, history survives every deletion.
- **A star movement is exact or it does not happen**: SC-402 (one entry per tick, one reversal
  per un-tick), SC-408/409 (nobody overspends, two devices cannot both redeem one balance).
- **Phase 3's shapes are inherited, not forked**: the resolution row every credit hangs off
  (`family.task_resolutions`, 019), the credited-Profile/actor distinction (`category_id` vs
  `created_by`), the reserved `reward_points` on `tasks` and `task_box_items` (017, 021), the
  streak checkpoint the week messages read (018), the counters' denominator the emoji rain reads
  (`lib/family/tasks/counters.ts`), the measured column layout and pager (`lib/family/tasks/layout.ts`,
  `ColumnPager.tsx`), the per-device filter stores, `requireVerifiedActor`/`requireParent`, the
  single realtime channel and its bare invalidation.
- **The hosted push precedes the deploy** (Phase 3's Hard ordering 7): four more tables join the
  shared realtime channel.

---

## R401 — Credits and retractions are written by the database, on the resolution row

**Decision**: `family.star_entries` gains its credit rows from an **AFTER INSERT** trigger on
`family.task_resolutions` and its retraction rows from a **BEFORE DELETE** trigger on the same
table. A `complete` resolution whose task carries a positive `reward_points` and whose
`category_id` is not null writes one `credit` entry (amount = the task's value **at that moment**,
FR-409; `earned_on` = the resolution's `resolved_on` — the day it was ticked, so a late
chore earns today, FR-405; `resolution_id` = the row's id, no FK). Deleting that resolution writes one
`retraction` entry (amount = −credit) if a credit exists for it, no retraction yet, **and the task
and the credited Profile still exist** — a cascade from a task's or a Profile's deletion writes
none (FR-411, FR-443), so a deliberate delete of one resolution (an un-tick, or "this occurrence"
on a completed one) is the only thing that retracts. A `skipped`
resolution writes nothing; a `complete` one with no credited Profile (impossible under
`task_resolution_credit_shape`, but stated) writes nothing.

**Rationale**: FR-405/408 and SC-402 make "one tick, one entry; one un-tick, one reversal" a
correctness property of money-like state. Phase 3's actions write a resolution as **one INSERT**
(R310); a second statement from the action for the credit would create a half-state that is a
*wrong balance* — not a stale badge that self-heals (the argument R310 made for the streak
checkpoint), but an amount a child is owed and never receives, or receives twice on a retry.
A trigger makes the credit part of the same statement, so it cannot be skipped, doubled or
reordered, and every existing write path (the three resolution verbs, `deleteTask`'s
"this occurrence" skip, `deleteCategory`'s cascade) is covered without being edited. Reading
`tasks.reward_points` inside the trigger is exactly what makes FR-409 ("the value at the moment of
the completion") true by construction.

**Alternatives rejected**: a second INSERT from the action (the half-state above; also misses the
cascade and the delete-scope paths); computing balances from `resolutions × tasks.reward_points`
at read time (a later edit to a task's value would rewrite history, violating FR-409/SC-405, and a
deleted task would erase its stars, violating FR-411); an RPC per verb (Phase 3 cut them for the
same reasons R310 gives, and a trigger keeps the action's contract as one statement).

## R402 — The balance is a view, and the pill is a windowed read of the same rows

**Decision**: `family.star_balances` — `with (security_invoker = true)`, one row per Profile:
`category_id`, `household_id`, `balance = coalesce(sum(amount), 0)`. The Rewards tab reads it;
every progress bar and Redeem button is `balance` against `rewards.point_value` (FR-420). The
Tasks column's star pill (FR-407) is **not** the view: the board fetches `star_entries` windowed by
`earned_on` for the anchored week — the same shape and key discipline as `taskWeek` — and
sums the displayed day's rows per Profile in the memo chain, above the display filters, beside the
counters (R317's branch).

**Rationale**: a view is derived, so it can never drift from the entries (FR-412); at one
household's scale (hundreds of entries a year) a sum is free and an index on
`(household_id, category_id)` keeps it so. The pill's number is a *different* number from the
balance by decision (Assumption 6), and it must roll with the board at midnight and read
yesterday's stars on yesterday — exactly the behaviour a windowed-by-day read gives and a
running total cannot.

**Alternatives rejected**: a stored `current_point_balance` counter on `categories` (the mutable
counter divergence 6 exists to avoid; every trigger would have to keep it in step); deriving the
pill from `resolutions × reward_points` (see R401's rejection).

## R403 — Redeem, unredeem and hand adjustments: one statement each, with the money rules in triggers under a per-Profile lock

**Decision**: no RPC. `redeemReward` is **one INSERT** into `family.redemptions`; a BEFORE INSERT
trigger `assert_redemption()` takes `select … for update` on the Profile's `categories` row —
which serialises every star write for that Profile — then checks the Profile is eligible, that a
one-time reward has no standing redemption for that Profile, and that the Profile's balance
(summed inside the same transaction) is at least the reward's **stored** `point_value`, which it
copies onto the row; an AFTER INSERT trigger writes the `redemption` ledger entry (amount =
−cost). `unredeemReward` is **one UPDATE** setting `reversed_at`/`reversed_by`; a BEFORE UPDATE
trigger refuses a second reversal and an AFTER UPDATE trigger writes the `refund` entry
(amount = +cost). `adjustStars` is **one multi-row INSERT** into `star_entries` (kind
`adjustment`, one row per chosen Profile); a BEFORE INSERT trigger on `adjustment` rows locks the
Profile and refuses when `balance + amount < 0`, and because a multi-row INSERT is one statement,
any refusal rolls back every Profile's row (FR-436).

**Rationale**: FR-428/429 and SC-408/409 need check-and-debit to be one act against a balance
two devices can race for, and unlike Phase 3's claim race there is no unique index that can
arbitrate — the invariant is on a *sum*. The row lock on the Profile's category row is the
smallest serialisation that makes the sum trustworthy, and putting the check in a trigger keeps
Phase 3's contract intact: the action sends one statement and the database either wholly accepts
it or wholly refuses it, with a distinguishable SQLSTATE the action maps to `CONFLICT`
("no longer has enough", FR-429) or `FORBIDDEN`. Retractions (R401) deliberately bypass the
non-negative check — Assumption 5's one legitimate overdraft — because they are kind `retraction`,
not `adjustment`.

**Alternatives rejected**: three `SECURITY DEFINER` RPCs (would be the phase's only write-path
functions, need grants and matrix rows, and give nothing a trigger on the row does not); an
optimistic client check only (SC-408's off-interface refusal is impossible without the server
holding the rule); a `CHECK` constraint (cannot see a sum).

## R404 — One reward, a table of eligibilities, and a redemption row that survives reversal

**Decision**: `family.rewards` (`name`, `description`, `emoji`, `point_value` 1–500,
`respawn_on_redemption`) with `family.reward_eligibilities (reward_id, category_id)` — Profiles
only, enforced by a trigger on the same pattern as `assert_task_assignee()`, cascading with the
Profile — and `family.redemptions` carrying the reward, the Profile, the cost **as it was**, the
household day, the moment, the actor, and `reversed_at`/`reversed_by`. A reversed redemption is
kept (FR-431: "marked reversed rather than erased"). One-time rewards have at most one *standing*
(unreversed) redemption per eligible Profile, enforced in `assert_redemption()`.

**Rationale**: Assumption 7 — one record, several eligibilities, progress derived. The cost is
copied onto the redemption because the reward's cost may be edited afterwards (FR-420) and the
modal, the history card and the refund must all say what was actually spent. The reward's own
`redeemed_at` from the reference's API is deliberately **not** carried: with several eligible
Profiles it cannot describe the state, and the reference only has it because it makes one row per
Profile.

**Alternatives rejected**: one reward row per Profile (the reference's fan-out; "edit the cookies
reward" becomes three edits); a `redeemed_at` on the reward (above); deleting the redemption on
unredeem (loses the history SC-411 asserts, and makes the refund entry orphaned).

## R405 — Deleting a reward keeps the stars spent; deleting a Profile forfeits theirs

**Decision**: `redemptions.reward_id` cascades on reward deletion — the redemption rows go, the
ledger entries (which carry the reward's name and cost and reference the redemption **without a
foreign key**) stay, so balances are unchanged (FR-411, FR-421). `star_entries.category_id`
cascades on Profile deletion — their entries, their balance and their redemptions go with them
(FR-443). `deleteCategory` gains the FR-443 cleanup beside Phase 3's orphaned-task cleanup:
delete every reward left with no eligibility; `fetchCategoryTaskCounts` grows a `starsForfeited`
figure from the balances view for the dialog's third sentence.

**Rationale**: the ledger's loose references (`summary`, `point_value` copied; ids without FKs)
are the whole point of divergence 6 — history that survives deletion. A Profile's deletion is
already the one destructive act Phase 3 made total for that Profile's own records (their
resolutions cascade), so their stars follow the same rule and the dialog says so.

**Alternatives rejected**: a `restrict` FK from redemptions to rewards (a redeemed reward could
never be deleted, contradicting the reference's "unless deleted"); keeping a deleted Profile's
entries with a null category (a balance for nobody).

## R406 — The star chip and the Stars field ride the shipped surfaces

**Decision**: `reward_points` joins `TASK_COLUMNS` and `TASK_BOX_COLUMNS` (`rows.ts`), the `Task`
and `TaskBoxItem` types gain `rewardPoints: number | null`, `BoardOccurrence` carries it through
`expandTaskDay`, and `TaskCard` draws the chip with the shipped badge tokens and a filled lucide
`Star` when `rewardPoints > 0`. `taskObjectSchema` and `taskBoxItemSchema` gain
`rewardPoints: int 0–500 | null` (blank and 0 both store `null`, FR-402); `TaskForm` and the
template form gain the field; `createTask` from a template copies it (FR-404). Phase 3's
column-list comments ("`reward_points` is absent by design") are replaced, and SC-319's audit is
inverted into SC-418.

**Rationale**: the columns and types were reserved for exactly this (003 FR-329); the card, the
form and the schema are the surfaces the spec names as amended. No new component is needed for
the chip — it is the streak badge's pill with a different icon and colour.

**Alternatives rejected**: a separate `task_star_values` table (a column already exists); a chip
component of its own (a second badge geometry to keep in step with the first).

## R407 — Reads: four cached keys, one of them windowed

**Decision**: `familyKeys.starWeek(householdId, weekStartDate)` — entries with `earned_on`
in the anchored week (credits and retractions only carry one), seeded by `page.tsx` beside
`taskWeek`; `familyKeys.balances(householdId)` — the view; `familyKeys.rewards(householdId)` —
rewards with their eligibilities embedded; `familyKeys.redemptions(householdId)` — every
redemption, standing and reversed (the Redeemed switch and the history card both read it; at
household scale that is a few hundred rows a year). All prefix-shaped under `familyKeys.all` so
the bare invalidation sweeps them (R324).

**Rationale**: R314's discipline — definitions unwindowed, day-dependent rows windowed by the
anchored week — applied to the one new row kind the board reads per day. The Rewards tab's three
reads are not day-dependent at all.

**Alternatives rejected**: a `balances` embed on `categories` (a view cannot be embedded through
a foreign key, the same finding as `task_cursors`); windowing redemptions (the history card needs
all of them, and there are few).

## R408 — Celebrations are pure verdicts rendered once, on the device that made the write

**Decision**: `lib/family/rewards/celebrations.ts` holds three pure functions and nothing else
decides when something plays: `listCompletesWith(counters, occurrence)` — true when the tapped
occurrence is outstanding and its Profile's day has exactly one outstanding left (FR-439, the
denominator being `columnCountersOf`'s); `redemptionCelebration(outcome)` — the modal's payload;
`weekVerdictOf(scheduledDays, resolvedDays, skippedDays)` → `"amazing" | "strong" | null`
(FR-440). The components — `EmojiRain`, `StarConfetti`, `WeekMessage` — are mounted by the board
or the tab **in response to the local write's success**, never to a realtime refetch, which is
what makes Assumption 12 structural: another device's change arrives as data, and data never
mounts a celebration. Every one collapses to nothing under the shipped reduced-motion hook.
Week verdicts are judged when the household week rolls over (the shipped clock, `useDayAnchor`'s
zone) from the previous week's resolutions — already warmed by `usePrefetchNeighbourWeeks` — and
shown once per device per (routine, Profile, week), remembered in a small per-device store on the
Phase 3 filter-store pattern.

**Rationale**: the spec's SC-413/414 need "once, on this device, ended on its own, never under
reduced motion" to be testable, and a pure verdict with a single mounting rule is what makes each
of those a unit test rather than a screen recording. The emoji rain's trigger is computed **from
the pre-write counters** so it cannot race the refetch that repaints the board.

**Alternatives rejected**: mounting on a counters transition after refetch (fires on the other
device too; races); a server-side "celebration" record (stores nothing the spec wants stored);
a dependency for confetti (R416).

## R409 — The Rewards tab is the Tasks board's chassis with different columns

**Decision**: `RewardsBoard` reuses `useBoardGeometry`, `useColumnPage`, `ColumnPager`,
`BoardStrip`'s grid and the `boardLayoutOf` fit rule unchanged (FR-422); `RewardColumn` replaces
`ProfileColumn`; no reorder, no sections, no Up for Grabs. The per-device Redeemed switch is a
second boolean store on the `useTaskFilters` pattern (`family:reward-filters:v1`); the shipped
`FilterSheet`'s Profile toggles apply because the tab reads `visibleProfiles`. `nav.ts` gets
`showsChipRow: false` for `rewards` (FR-422, the Phase 3 `AppShell` rule).

**Rationale**: the fit rule, the wrap bound and the pager are measured, tested and shipped; a
second set would be the duplication the gate exists to catch. The Redeemed switch is a device
preference with the same storage semantics as the four task switches.

**Alternatives rejected**: a rewards-specific layout hook (duplication); putting the Redeemed
switch in the shared `FilterSheet` (the reference photographs it in the tab's own chrome).

## R410 — Roles: three new parent-only operations, one target-aware one

**Decision**: `permissions.ts` gains `reward.create`, `reward.edit`, `reward.delete`,
`stars.adjust` (parent-only, `can()`), and `reward.redeem` / `reward.unredeem` decided by the
target-aware rule Phase 3 introduced (`ownsOccurrence`'s shape, on a redemption target: a member
for themselves, a parent for anyone — FR-424). The actions enforce it with
`requireVerifiedActor()` (the database role, never the cookie's) and `requireParent()`.

**Rationale**: FR-419/424/435 are FR-389/351's rules on new nouns; the affordance-only posture
(controls may be shown, the server decides) is unchanged.

## R411 — Realtime: four tables join the channel, and the deploy ordering rule returns

**Decision**: 027 adds `star_entries`, `rewards`, `reward_eligibilities`, `redemptions` to
`supabase_realtime` with the 022 guard verbatim, default replica identity; `useFamilyRealtime`
subscribes to them unfiltered; bare invalidation sweeps the four new keys. The hosted push
must precede the merge and the deploy, for the reason Phase 3 stated (a binding for a missing
table fails the whole channel).

## R412 — The migrations: four, numbered 024–027, none touching a shipped table's shape

**Decision**: 024 `rewards` + `reward_eligibilities` (+ `assert_reward_eligibility()`);
025 `star_entries` + `star_balances` + the two resolution triggers + the adjustment guard;
026 `redemptions` + `assert_redemption()` + the two ledger-writing triggers; 027 realtime. The
only edits to shipped tables are **none** — `tasks.reward_points` and `task_box_items.reward_points`
exist and keep their `>= 0` CHECK; the 0–500 bound is Zod's (Assumption 4), so no constraint
tightening and no last-migration hazard this time. Each `CREATE TABLE` header carries the
fold-into-existing rejection paragraph the T083 review asked for.

## R413 — Seed fixtures

**Decision**: the seed gives star values to five seeded tasks (Brush teeth 5, Practice piano 5,
Feed the cat 10, Take out trash 20, Clean the bathroom 15), leaves the rest at none, seeds three
rewards (Bake cookies 🍪 20 renewing, for Cleo; Movie night 🍿 15 one-time, for Cleo and Ben;
Ice cream 🍨 25 one-time, for everyone) and gives Cleo a starting balance of 15 by one
adjustment entry — so US2's scenarios (a bar at 15/20, a Redeem button at 15) hold on a fresh
`db reset`. Idempotent by emptiness like `seed_task_box`.

## R414 — Tokens

**Decision**: `--fam-star-gold` (shipped) inks the chip, the pill and the confetti; new
`[ESTIMATED]`-tagged tokens for the reward card (emoji ~110 at the reference unit, title serif,
bar h ~44 r 22), the redeem modal (540×700 r 40 at the reference unit) and the confetti sprite
range (28–48 px), each citing 07 §4.12/§4.13. The chip reuses `--fam-task-badge-*`. The card's
height with a chip is left to content (`min-h` unchanged) rather than a second fixed height.

## R415 — Testing strategy per layer

| Layer | What is proved, and where |
|---|---|
| Unit (jsdom) | `celebrations.ts` (list-completes truth table incl. skip and filter cases; week verdicts over the scheduled/resolved/skipped sets incl. "skip is neither"); the balance/pill arithmetic in the memo chain (SC-402's day, the counters and the pill unmoved by filters); `rewardProgressOf` (bar vs button at balance < / = / > cost); the Redeemed store; `permissions.ts`'s six new operations incl. the four-check redeem matrix; validation (0–500, blank/0 → null, cost 1–500, at least one eligible, unknown keys refused) |
| Policies (node, local stack) | SC-416 per path incl. the view; the privilege delta (no `anon`, trigger functions revoked); trigger truth: a completion writes exactly one credit at the task's value, a skip none, an un-tick one retraction and never two, a second un-tick nothing; editing `reward_points` after a credit leaves the entry (SC-405); `assert_redemption` refusing the ineligible, the unaffordable (by one), and the second one-time redemption; two concurrent redemptions of one balance → exactly one (SC-409); unredeem refunding exactly and refusing twice; the adjustment guard refusing below zero for **all** chosen Profiles in one statement; a retraction below zero allowed (Assumption 5); Profile deletion cascading entries and redemptions and the reward-with-nobody cleanup; reward deletion leaving the ledger's sum unchanged |
| RTL (jsdom) | the chip on a card with a value and not without; the header pill; the Stars field on both forms and the template pre-fill; the Rewards tab's columns, bars, buttons, the muted Redeemed card behind its switch; the modal's copy from a redemption; the celebrations mounting on a local success and not on a refetch, and not under reduced motion |
| By hand + DevTools | the falling stars and the warm wash; the emoji rain; SC-417's four viewports; the modal at 540×700; SC-404's two devices |

## R416 — Dependencies: none added

`framer-motion` (installed) drives the modal's entrance and the sprites' fall; the emoji rain and
the star confetti are ~80 absolutely positioned sprites with staggered CSS transforms
(07 §7.1's suggestion, `[ESTIMATED]`). No confetti library, no state library, no new Supabase
feature.

## R417 — What this phase does **not** build, restated for the plan

No ledger screen, no reset, no lifetime figure (FR-437); no notifications; no sounds; no
celebration on any device but the one that wrote; no per-reward progress counter; no
`redeemed_at` on a reward; no function on the write path beyond triggers.

## R418 — The fallow zone

**Decision**: `.fallowrc.json` gains a `family-rewards-core` zone (`lib/family/rewards/**/*`)
allowed to reach `family-rewards-core`, `family-tasks-core` and `lib`, and added to the allow lists
of `family-actions`, `components`, `ui-pages` and `tests` — the Phase 3 pattern, a boundary
widening in config and reviewable in the diff, not a suppression. Nothing in `lib/family/rewards`
touches `family-recurrence`.

## Resolved unknowns

Every NEEDS CLARIFICATION the plan template could have raised is answered above: the write
mechanism (R401, R403), the balance's home (R402), the record shapes (R404, R405), the read
shapes (R407), the celebration mechanism (R408), the tab's chassis (R409), roles (R410),
realtime and ordering (R411), migrations (R412), fixtures (R413), tokens (R414), tests (R415),
dependencies (R416). None remain.
