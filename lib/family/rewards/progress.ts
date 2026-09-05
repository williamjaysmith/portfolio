/**
 * What a reward card shows, and where it sits in its Profile's column (004
 * FR-420, FR-423, FR-425–FR-427, FR-430).
 *
 * Progress is the Profile's BALANCE against the reward's COST — there is no
 * per-reward counter (FR-420, Assumption 7) — so a cost edit or a new entry
 * moves every card at once, and the same reward reads differently in two
 * columns (FR-417). Below the cost the card draws a bar with "☆ balance/cost"
 * centred on it; at or above it a Redeem button — never both (FR-423). A
 * balance below zero after an un-tick of spent stars is an empty bar with the
 * number kept honest (Assumption 5, FR-413).
 *
 * A redemption row survives its reversal (FR-431); what makes a one-time
 * reward's card muted is a STANDING (unreversed) redemption for that Profile,
 * and a renewing reward is never muted, however often it was redeemed
 * (FR-425, FR-430).
 *
 * Framework-free and pure: no React, no storage, no clock.
 */

import type { Redemption, Reward } from "../types";

/** FR-423's two faces of a live card. `filled` is 0–1; `label` is the bar's centred text. */
export type RewardProgress =
  | { kind: "bar"; filled: number; label: string }
  | { kind: "redeem" };

/**
 * The keys FR-427 orders by, on whatever the column renders. A live card
 * carries `redeemedAt: null`; a muted "Redeemed on" card (FR-425, FR-426)
 * carries the redemption's instant and sorts last, most recent first.
 */
export interface OrderableRewardCard {
  /** The reward's cost — FR-427's second key. */
  cost: number;
  /** The reward's creation instant — FR-427's third key, ties in creation order. */
  createdAt: string;
  /** Balance ≥ cost — FR-427's first key. */
  affordable: boolean;
  /** The redemption a muted card stands for; null on a live card. */
  redeemedAt: string | null;
}

/** FR-420 and FR-423 in one function: the balance against the cost, bar or button. */
export function rewardProgressOf(balance: number, cost: number): RewardProgress {
  if (balance >= cost) return { kind: "redeem" };
  return {
    kind: "bar",
    filled: Math.max(0, Math.min(1, balance / cost)),
    label: `☆ ${balance}/${cost}`,
  };
}

/**
 * FR-427 verbatim: affordable first, then cost ascending, then creation order;
 * redeemed cards last, and among themselves most recent first (FR-426). A new
 * array — the input is left as it was.
 */
export function orderRewardCards<T extends OrderableRewardCard>(cards: readonly T[]): T[] {
  return [...cards].sort(compareCards);
}

/**
 * The unreversed redemption of one reward for one Profile, or null. A
 * one-time reward has at most one (026's invariant 6); a renewing one may
 * have several, and the most recent is the one the tab acts on.
 */
export function standingRedemptionOf(
  redemptions: readonly Redemption[],
  rewardId: string,
  categoryId: string,
): Redemption | null {
  const standing = redemptions.filter(
    (one) => one.rewardId === rewardId && one.categoryId === categoryId && one.reversedAt === null,
  );
  return standing.reduce<Redemption | null>(
    (latest, one) => (latest === null || one.redeemedAt > latest.redeemedAt ? one : latest),
    null,
  );
}

/**
 * FR-425/FR-430: a one-time reward with a standing redemption for this Profile
 * leaves their column (or reads "Redeemed on" under the switch); a renewing
 * reward's card is live again the moment it is redeemed.
 */
export function isRedeemedOneTime(
  reward: Reward,
  redemptions: readonly Redemption[],
  categoryId: string,
): boolean {
  if (reward.respawnOnRedemption) return false;
  return standingRedemptionOf(redemptions, reward.id, categoryId) !== null;
}

function compareCards(a: OrderableRewardCard, b: OrderableRewardCard): number {
  if (a.redeemedAt !== null && b.redeemedAt !== null) return compareText(b.redeemedAt, a.redeemedAt);
  if (a.redeemedAt !== null || b.redeemedAt !== null) return a.redeemedAt === null ? -1 : 1;
  return compareLive(a, b);
}

function compareLive(a: OrderableRewardCard, b: OrderableRewardCard): number {
  if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
  if (a.cost !== b.cost) return a.cost - b.cost;
  return compareText(a.createdAt, b.createdAt);
}

/** ISO instants from one source compare as text; the same tie-break Phase 3's layout uses. */
function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
