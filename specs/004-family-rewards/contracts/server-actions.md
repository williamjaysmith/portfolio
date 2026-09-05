# Contracts: Server Actions & Database Triggers — Rewards

**Feature**: `004-family-rewards` | **Date**: 2026-09-05

What Phase 4 adds to the action surface of Phases 1–3 (their contracts remain in force, amended
only where this file says so). **Six new actions** in `lib/family/actions/rewards.ts`, **four
amended actions**, **one amended read**, **no RPC**, and an extended read path. Every action starts
with `"use server"`, returns `Promise<ActionResult<…>>` through `runAction()`, and is validated
with Zod 4 before anything reaches the database — the triggers of `data-model.md` are the second
line, not the first.

**The resolution verbs are not amended.** `completeTaskOccurrence`, `skipTaskOccurrence` and
`unresolveTaskOccurrence` keep their signatures and their one-statement bodies; the credit and the
retraction are the database's consequences of the row they already write (R401). A client that
never learns about stars still earns them.

**No function is on the write path.** Redeem is one INSERT, unredeem one UPDATE, a hand adjustment
one multi-row INSERT; the money rules run in triggers under a per-Profile row lock (R403).

---

## Guards

Unchanged: `requireParent()` and `requireVerifiedActor()` (Phase 3). `permissions.ts` gains six
operations — `reward.create`, `reward.edit`, `reward.delete`, `stars.adjust` (parent-only) and
`reward.redeem`, `reward.unredeem` (target-aware: a member for themselves, a parent for anyone,
FR-424) — as **affordances**; the actions decide.

## Shared result shape

`ActionResult<T>` and `ActionError` are unchanged. New situations map onto existing codes:

| Situation | Code | Message |
|---|---|---|
| not enough stars at the moment of the write (`P0007`) | `CONFLICT` | "<Name> no longer has enough stars for that." |
| a one-time reward already standing for that Profile (`P0006`) | `CONFLICT` | "<Name> has already redeemed that." |
| the Profile is not eligible (`P0005`) | `FORBIDDEN` | "That reward isn't for <Name>." |
| a member redeeming for someone else | `FORBIDDEN` | "That's <Name>'s reward — only <Name> or a parent can redeem it." |
| already unredeemed (`P0008`) | `CONFLICT` | "That was already put back." |
| an adjustment that would overdraw (`P0004`) | `VALIDATION` (field `amount`) | "That would leave <Name> below zero." |
| a reward with no eligible Profile | `VALIDATION` (field `categoryIds`) | "Choose at least one Profile." |
| a reward that another device deleted | `NOT_FOUND` | Phase 3's wording |

## Shared input shapes

```ts
type RewardInput = {
  name: string                    // 1–120, trimmed
  description?: string | null     // ≤ 2000
  emoji?: string | null           // ≤ 16
  pointValue: number              // integer 1–500 (FR-416)
  respawnOnRedemption: boolean    // FR-430
  categoryIds: string[]           // ≥ 1 distinct Profile ids (FR-415); a Label is VALIDATION
};

type Reward = {
  id, householdId, name, description, emoji, pointValue, respawnOnRedemption,
  categoryIds: string[], createdBy, updatedBy, createdAt, updatedAt
};

type Redemption = {
  id, householdId, rewardId, categoryId, pointValue, rewardName,
  redeemedOn: string, redeemedAt: string, redeemedBy: string | null,
  reversedAt: string | null, reversedBy: string | null
};

type StarBalance = { categoryId: string; balance: number };   // may be negative (Assumption 5)
```

`rewardPoints?: number | null` (integer 0–500; blank and 0 store `null`) joins `TaskInput` and
`TaskBoxItemInput`; every other key on those schemas is unchanged and unknown keys stay refused.

---

## Rewards

### `createReward(input: RewardInput): ActionResult<Reward>`

**Guard**: `requireParent()`. Inserts one `family.rewards` row and one `reward_eligibilities` row
per id, in that order; a Label among `categoryIds` is refused by Zod first and by the trigger
second (`23514` → `VALIDATION`). Returns the reward with its eligibilities.

### `updateReward(input: { id: string; patch: Partial<RewardInput> }): ActionResult<Reward>`

**Guard**: `requireParent()`. Re-reads the reward under the household (`NOT_FOUND` elsewhere),
validates the merged shape through the create schema, updates the row, and rewrites the
eligibilities as a set difference (delete the removed, insert the added) so surviving Profiles'
standing redemptions are untouched. Changing `pointValue` changes no redemption's stored cost
(FR-420, FR-428).

### `deleteReward(input: { id: string; confirm: true }): ActionResult<null>`

**Guard**: `requireParent()`. One DELETE; eligibilities and redemptions cascade; ledger entries
stay (FR-421).

## Redeeming

### `redeemReward(input: { rewardId: string; categoryId: string }): ActionResult<Redemption>`

**Guard**: `requireVerifiedActor()` + the target rule: a `member` may pass only their own
`categoryId`; a `parent` any eligible Profile's (FR-424). Inserts one `family.redemptions` row
carrying `reward_id`, `category_id`, `redeemed_by = actor.profileId` and **nothing else** — the
trigger fills `point_value`, `reward_name` and `redeemed_on` from the stored reward and the
household day, after locking the Profile and checking eligibility, the one-time rule and the
balance (FR-428, FR-429, FR-430). The modal is rendered from the returned row: "Great work!
`rewardName` redeemed", "By `<Profile>` for `pointValue` stars on `redeemedOn`" (FR-432, FR-433).
Two devices in the same second reach exactly one row and one `CONFLICT` (SC-409).

### `unredeemReward(input: { redemptionId: string }): ActionResult<Redemption>`

**Guard**: `requireVerifiedActor()` + the same target rule, on the redemption's `category_id`.
One UPDATE setting `reversed_at = now()`, `reversed_by = actor.profileId`; the trigger refuses a
second reversal (`P0008`) and writes the refund (FR-431). Returns the reversed row.

## Giving stars by hand

### `adjustStars(input: { categoryIds: string[]; amount: number }): ActionResult<StarBalance[]>`

**Guard**: `requireParent()`. `amount` is an integer in −500…500 excluding 0; `categoryIds` ≥ 1
distinct Profile ids of this household (a Label is `VALIDATION`). Inserts one `star_entries` row
per Profile (kind `adjustment`, `created_by = actor.profileId`, `entered_on` = the household day)
**in one statement**, so the trigger's refusal for any one Profile rolls back all (FR-436). Returns
the resulting balances for the chosen Profiles. The before-and-after table is the client's
arithmetic over the balances it already holds; the server's answer is the truth (SC-412).

---

## Amendments to shipped actions

- **`createTask` / `updateTask`** (Phase 3): accept `rewardPoints` and write `reward_points`
  (FR-401, FR-402). `createTask` from a template copies the template's value (FR-404). Nothing
  else changes; editing a task's value touches no ledger row (FR-409).
- **`createTaskBoxItem` / `updateTaskBoxItem`** (Phase 3): the fourth field (FR-401);
  `TASK_BOX_COLUMNS` now selects it.
- **`deleteCategory`** (Phase 1, amended in Phase 3): after Phase 3's orphaned-task cleanup, delete
  every reward left with no eligibility (FR-443). Their entries and redemptions have already
  cascaded with the Profile.
- **`fetchCategoryTaskCounts`** (Phase 3 read, used by the delete dialog): gains
  `starsForfeited: number` from `star_balances` (FR-443).

## Database triggers (the write path's second line)

| Trigger | Table | When | Does |
|---|---|---|---|
| `task_resolution_credits_stars` | `task_resolutions` | AFTER INSERT | one `credit` at the task's value, or nothing |
| `task_resolution_retracts_stars` | `task_resolutions` | BEFORE DELETE | one `retraction`, or nothing |
| `star_adjustment_is_affordable` | `star_entries` | BEFORE INSERT (kind `adjustment`) | lock, sum, refuse below zero |
| `redemption_is_affordable` | `redemptions` | BEFORE INSERT | lock, eligibility, one-time rule, balance ≥ cost; copies cost/name/day |
| `redemption_records_stars` | `redemptions` | AFTER INSERT / UPDATE | the debit; the refund exactly once; refuses any other update |
| `reward_eligibility_is_profile` | `reward_eligibilities` | BEFORE INSERT / UPDATE | Profiles only |

All `security definer`, `search_path = ''`, revoked from `public`; none callable by anyone.

## Read path (not an action)

Four cached reads (R407): `useStarWeek(householdId, weekStartDate)`, `useStarBalances(householdId)`,
`useRewards(householdId)`, `useRedemptions(householdId)` — under the caller's RLS, seeded by the
two pages' server reads, swept by the bare invalidation. `BoardOccurrence.rewardPoints` reaches the
card through `expandTaskDay` unchanged in shape.

## Error-handling contract (delta)

The five new SQLSTATEs (`P0004`–`P0008`) are mapped in `shared.ts`'s `DB_ERROR_CODES` beside
Phase 1's; the actions override the message with the Profile's name where the table above says
so. Offline never reaches an action (FR-441).
