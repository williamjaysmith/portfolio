"use client";

import { useCallback, useRef, useState } from "react";

import { redeemReward, unredeemReward } from "@/lib/family/actions/rewards";
import type { ActionResult } from "@/lib/family/errors";
import type { Redemption } from "@/lib/family/types";

import { useFamily } from "../../components/FamilyProvider";
import { rewardCardKeyOf, type RewardCardTarget } from "./RewardCard";

/**
 * 004 T040 — the Rewards tab's **one** commit path, and the only place a
 * redemption is ever written or put back from (FR-424, FR-431, FR-441). It is
 * `useTaskResolve` with two verbs instead of five, and deliberately so: the
 * same interceptor, the same pessimism, the same queue.
 *
 * Every write goes `withActor(() => action(payload))` through Phase 1's shipped
 * interceptor, unchanged: it produces the punch-in **at the moment of the tap**
 * when nobody is punched in, retries once on a lapsed cookie, extends the idle
 * expiry on success and invalidates `familyKeys.all`, which is how the tab's
 * three reads refresh. This hook adds no plumbing of its own.
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

/**
 * What a refusal says on the board. `NO_ACTOR` is the one silence: it means the
 * punch-in sheet was dismissed, which is a decision rather than a failure, and
 * FR-424's promise is that the card is simply left as it was.
 */
function noticeOf(result: ActionResult<Redemption>): string | null {
  if (result.ok) return null;
  return result.error === "NO_ACTOR" ? null : result.message;
}

/** A redemption's card is the reward in the Profile's column — the key the column reads (FR-441). */
function keyOfRedemption(redemption: Redemption): string {
  return rewardCardKeyOf({ reward: { id: redemption.rewardId }, categoryId: redemption.categoryId });
}

const NO_KEYS: ReadonlySet<string> = new Set();

export function useRedeem(): RedeemState {
  const { withActor } = useFamily();
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const [notice, setNotice] = useState<string | null>(null);
  // Refs, not `busyKeys`: two taps landing in one tick would both read the
  // same rendered state. `waiting` is every card with a write queued or in
  // flight; `chain` is the queue itself.
  const waiting = useRef(new Set<string>());
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const clearNotice = useCallback(() => setNotice(null), []);

  // Writes are serialised, never dropped. A tap on a SECOND card while the
  // first is writing waits its turn — one punch-in sheet at a time, and the
  // actor the first tap earned serves the second — and shows busy while it
  // waits. A second tap on the SAME card while it is waiting or writing is the
  // same tap twice, and is ignored.
  const commit = useCallback(
    async (key: string, write: () => Promise<ActionResult<Redemption>>): Promise<RedeemOutcome> => {
      if (waiting.current.has(key)) return null;
      waiting.current.add(key);
      setBusyKeys(new Set(waiting.current));
      const turn = chain.current.then(() => withActor(write));
      // The queue moves on whatever this write's fate; the caller still sees it.
      chain.current = turn.catch(() => undefined);
      try {
        const result = await turn;
        setNotice(noticeOf(result));
        return result;
      } finally {
        waiting.current.delete(key);
        setBusyKeys(waiting.current.size === 0 ? NO_KEYS : new Set(waiting.current));
      }
    },
    [withActor],
  );

  const redeem = useCallback(
    (target: Pick<RewardCardTarget, "reward" | "categoryId">) =>
      commit(rewardCardKeyOf(target), () =>
        redeemReward({ rewardId: target.reward.id, categoryId: target.categoryId }),
      ),
    [commit],
  );

  const unredeem = useCallback(
    (redemption: Redemption) =>
      commit(keyOfRedemption(redemption), () => unredeemReward({ redemptionId: redemption.id })),
    [commit],
  );

  return { busyKeys, notice, clearNotice, redeem, unredeem };
}
