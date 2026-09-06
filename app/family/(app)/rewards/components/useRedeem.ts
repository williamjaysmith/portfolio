"use client";

import { useCallback } from "react";

import { redeemReward, unredeemReward } from "@/lib/family/actions/rewards";
import type { ActionResult } from "@/lib/family/errors";
import type { Redemption } from "@/lib/family/types";

import { useSerialisedWrites } from "../../components/useSerialisedWrites";
import { rewardCardKeyOf, type RewardCardTarget } from "./RewardCard";

/**
 * 004 T040 — the Rewards tab's **one** commit path, and the only place a
 * redemption is ever written or put back from (FR-424, FR-431, FR-441). It is
 * `useTaskResolve` with two verbs instead of five, and literally so since
 * T048: both are `useSerialisedWrites` — the same interceptor at the tap, the
 * same pessimism, the same queue, `NO_ACTOR` the same silence — with their
 * own verbs and keys on top.
 *
 * **Pessimistic, with no optimistic cache write anywhere** (FR-441): the tapped
 * card shows busy for one round trip and then paints from the refetch. Nothing
 * is ever shown as redeemed that is not stored, nothing is queued offline, and
 * the two things a hand-patched cache would get wrong — the balance and the
 * one-time reward's standing — both move server-side on the same write, under
 * the Profile's row lock (R403). There is deliberately no `setQueryData` here
 * and no reference to the query client at all.
 *
 * **The payload asserts nothing about identity** (FR-424): the acting Profile
 * comes from the signed punch-in cookie server-side. What travels is the
 * reward's id and the column's Profile — or, to put one back, the redemption's
 * id — and the server's `strictObject` refuses anything more. The cost, the
 * name and the day are copied by the trigger from the stored reward and the
 * household clock (FR-428, FR-433), never sent.
 *
 * **The returned row is handed back whole** because the modal is rendered
 * from it and from nothing guessed (FR-432): "Great work! `rewardName`
 * redeemed", "By <Profile> for `pointValue` stars on `redeemedOn`". The
 * board decides what to do with it; this hook only makes sure it is real.
 */

/**
 * The action's answer — the redemption written or reversed — or `null` when
 * no write was attempted at all, which is a second tap on a card that is
 * already waiting or writing.
 */
export type RedeemOutcome = ActionResult<Redemption> | null;

export interface RedeemState {
  /**
   * `rewardCardKeyOf` of every card with a write waiting or in flight
   * (FR-441) — a card shows busy from the tap until its own write settles.
   */
  busyKeys: ReadonlySet<string>;
  /** The refusal to show, in the server's own words (FR-424, FR-429); null when there is none. */
  notice: string | null;
  clearNotice: () => void;
  /** FR-424, FR-428: redeem this reward for the column's Profile. */
  redeem: (target: Pick<RewardCardTarget, "reward" | "categoryId">) => Promise<RedeemOutcome>;
  /** FR-431: put this redemption back — the refund is the trigger's. */
  unredeem: (redemption: Redemption) => Promise<RedeemOutcome>;
}

/** A redemption's card is the reward in the Profile's column — the key the column reads (FR-441). */
function keyOfRedemption(redemption: Redemption): string {
  return rewardCardKeyOf({ reward: { id: redemption.rewardId }, categoryId: redemption.categoryId });
}

export function useRedeem(): RedeemState {
  const { busyKeys, notice, clearNotice, commit } = useSerialisedWrites();

  // `async` so the queue's synchronous refusal of a repeated tap (`null`)
  // arrives the same way its answer does: as this promise's value.
  const redeem = useCallback(
    async (target: Pick<RewardCardTarget, "reward" | "categoryId">): Promise<RedeemOutcome> =>
      commit(rewardCardKeyOf(target), () =>
        redeemReward({ rewardId: target.reward.id, categoryId: target.categoryId }),
      ),
    [commit],
  );

  const unredeem = useCallback(
    async (redemption: Redemption): Promise<RedeemOutcome> =>
      commit(keyOfRedemption(redemption), () => unredeemReward({ redemptionId: redemption.id })),
    [commit],
  );

  return { busyKeys, notice, clearNotice, redeem, unredeem };
}
