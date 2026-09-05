import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { redeemReward, unredeemReward } from "@/lib/family/actions/rewards";
import { ACTION_MESSAGES, fail, type ActionResult } from "@/lib/family/errors";
import type { Redemption, Reward } from "@/lib/family/types";

import { callAction } from "../../../components/action-client";
import type { FamilyContextValue } from "../../../components/FamilyProvider";
import { makeContext, withFamily } from "../../../components/__tests__/family-test-utils";
import { rewardCardKeyOf, type RewardCardTarget } from "../RewardCard";
import { useRedeem, type RedeemOutcome } from "../useRedeem";

/**
 * 004 T040 — the Rewards tab's ONE commit path (FR-424, FR-431, FR-441), on
 * the Tasks board's `useTaskResolve` pattern.
 *
 * What is proved here is the shape of the write rather than its effect: the
 * server action's own behaviour is the policies tier's (T039), and the
 * punch-in sheet is Phase 1's. This file pins the things a second write path
 * would get wrong —
 *
 *   - both verbs go through `withActor`, so the punch-in arrives AT THE TAP
 *     and a dismissed sheet writes nothing (FR-424);
 *   - the payload carries the two ids (or the one) and nothing else — no
 *     identity, no cost, no copied row (strict Zod server-side);
 *   - the returned row is handed back whole, because the modal is rendered
 *     from it and from nothing guessed (FR-441);
 *   - nothing is painted optimistically: the card is busy for the round trip
 *     and the cache is never written by hand.
 */

vi.mock("@/lib/family/actions/rewards", () => ({
  redeemReward: vi.fn(),
  unredeemReward: vi.fn(),
}));

const redeemMock = redeemReward as Mock;
const unredeemMock = unredeemReward as Mock;

const CLEO = "11111111-1111-4111-8111-111111111111";
const BEN = "33333333-3333-4333-8333-333333333333";
const COOKIES = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MOVIE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const REFUSAL = "That's Ben's reward — only Ben or a parent can redeem it.";

function reward(overrides: Partial<Reward> = {}): Reward {
  return {
    id: COOKIES,
    householdId: "household-1",
    name: "Bake cookies",
    description: null,
    emoji: "🍪",
    pointValue: 20,
    respawnOnRedemption: true,
    categoryIds: [CLEO, BEN],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function redemption(overrides: Partial<Redemption> = {}): Redemption {
  return {
    id: "redemption-1",
    householdId: "household-1",
    rewardId: COOKIES,
    categoryId: CLEO,
    pointValue: 20,
    rewardName: "Bake cookies",
    redeemedOn: "2026-09-05",
    redeemedAt: "2026-09-05T20:00:00.000Z",
    redeemedBy: CLEO,
    reversedAt: null,
    reversedBy: null,
    ...overrides,
  };
}

function target(overrides: Partial<RewardCardTarget> = {}): RewardCardTarget {
  return { reward: reward(), categoryId: CLEO, redemption: null, ...overrides };
}

/**
 * The shipped interceptor's own shape, minus its network: it runs the write
 * only once somebody is punched in, and turns a rejected transport into
 * `UNAVAILABLE` exactly as `callAction` does for the real one.
 */
function withActorThatRuns(): FamilyContextValue["withActor"] {
  return (run) => callAction(run);
}

/** A sheet nobody answers: `withActor` refuses before the write is reached. */
function withActorThatPrompts(): FamilyContextValue["withActor"] {
  return async () => fail("NO_ACTOR");
}

function withActorThatRefuses(): FamilyContextValue["withActor"] {
  return async () => fail("FORBIDDEN", REFUSAL);
}

function renderRedeem(withActor: FamilyContextValue["withActor"] = withActorThatRuns()) {
  const queryClient = new QueryClient();
  const setQueryData = vi.spyOn(queryClient, "setQueryData");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      withFamily(makeContext({ withActor }), children),
    );
  return { setQueryData, ...renderHook(() => useRedeem(), { wrapper }) };
}

/** A promise this test resolves by hand, so the in-flight state can be read. */
function deferred<T>() {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

beforeEach(() => {
  vi.clearAllMocks();
  redeemMock.mockResolvedValue({ ok: true, data: redemption() });
  unredeemMock.mockResolvedValue({
    ok: true,
    data: redemption({ reversedAt: "2026-09-05T20:05:00.000Z", reversedBy: CLEO }),
  });
});

describe("useRedeem", () => {
  describe("redeem", () => {
    it("sends the reward and the column's Profile to redeemReward, and nothing else (FR-424)", async () => {
      const { result } = renderRedeem();

      await act(async () => {
        await result.current.redeem(target());
      });

      expect(redeemMock).toHaveBeenCalledTimes(1);
      // No identity, no cost, no name: the server copies those from the stored
      // reward and the signed punch-in cookie (FR-428).
      expect(redeemMock).toHaveBeenCalledWith({ rewardId: COOKIES, categoryId: CLEO });
    });

    it("hands back the returned row whole, so the modal is rendered from it (FR-441)", async () => {
      const { result } = renderRedeem();
      let outcome: RedeemOutcome = null;

      await act(async () => {
        outcome = await result.current.redeem(target());
      });

      expect(outcome).toEqual({ ok: true, data: redemption() });
      expect(result.current.notice).toBeNull();
    });

    it("writes nothing when the punch-in sheet is dismissed, and says nothing (FR-424)", async () => {
      const { result } = renderRedeem(withActorThatPrompts());
      let outcome: RedeemOutcome = null;

      await act(async () => {
        outcome = await result.current.redeem(target());
      });

      expect(redeemMock).not.toHaveBeenCalled();
      expect(outcome).toEqual(fail("NO_ACTOR"));
      // A dismissal is a decision, not a failure: the card is left as it was.
      expect(result.current.notice).toBeNull();
    });

    it("surfaces a refusal verbatim, and clears it on request", async () => {
      const { result } = renderRedeem(withActorThatRefuses());

      await act(async () => {
        await result.current.redeem(target());
      });
      expect(result.current.notice).toBe(REFUSAL);

      act(() => {
        result.current.clearNotice();
      });
      expect(result.current.notice).toBeNull();
    });

    it("surfaces the lost race in the server's words (FR-429)", async () => {
      const moved = "Cleo no longer has enough stars for that.";
      redeemMock.mockResolvedValue(fail("CONFLICT", moved));
      const { result } = renderRedeem();

      await act(async () => {
        await result.current.redeem(target());
      });

      expect(result.current.notice).toBe(moved);
    });

    it("marks only the tapped card busy, and paints nothing itself (FR-441)", async () => {
      const one = target();
      const gate = deferred<ActionResult<Redemption>>();
      redeemMock.mockReturnValue(gate.promise);
      const { result, setQueryData } = renderRedeem();

      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = result.current.redeem(one);
      });
      expect(result.current.busyKeys.has(rewardCardKeyOf(one))).toBe(true);
      // The same reward in ANOTHER column is another card (FR-417).
      expect(result.current.busyKeys.has(rewardCardKeyOf({ ...one, categoryId: BEN }))).toBe(false);

      await act(async () => {
        gate.settle({ ok: true, data: redemption() });
        await pending;
      });

      expect(result.current.busyKeys.size).toBe(0);
      // No optimistic cache write anywhere: the refetch `withActor` triggers is
      // the only thing that repaints the tab.
      expect(setQueryData).not.toHaveBeenCalled();
    });

    it("ignores a second tap on the same card while its write is in flight", async () => {
      const gate = deferred<ActionResult<Redemption>>();
      redeemMock.mockReturnValue(gate.promise);
      const { result } = renderRedeem();
      let second: RedeemOutcome = { ok: true, data: redemption() };

      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = result.current.redeem(target());
        second = await result.current.redeem(target());
      });

      expect(second).toBeNull();
      expect(redeemMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        gate.settle({ ok: true, data: redemption() });
        await pending;
      });
    });

    it("queues a tap on a DIFFERENT card behind the write in flight — busy on both, dropped on neither", async () => {
      const gate = deferred<ActionResult<Redemption>>();
      const second = redemption({ id: "redemption-2", rewardId: MOVIE, rewardName: "Movie night" });
      redeemMock.mockReturnValueOnce(gate.promise).mockResolvedValueOnce({ ok: true, data: second });
      const { result } = renderRedeem();
      const first = target();
      const other = target({ reward: reward({ id: MOVIE, name: "Movie night" }) });

      let firstPending: Promise<unknown> = Promise.resolve();
      let secondPending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        firstPending = result.current.redeem(first);
        secondPending = result.current.redeem(other);
      });
      // Waiting, not dropped: the second card shows busy and has not written yet.
      expect(result.current.busyKeys.has(rewardCardKeyOf(first))).toBe(true);
      expect(result.current.busyKeys.has(rewardCardKeyOf(other))).toBe(true);
      expect(redeemMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        gate.settle({ ok: true, data: redemption() });
        await firstPending;
        await secondPending;
      });
      expect(redeemMock).toHaveBeenCalledTimes(2);
      expect(await secondPending).toEqual({ ok: true, data: second });
      expect(result.current.busyKeys.size).toBe(0);
    });

    it("refuses offline rather than queueing (FR-441)", async () => {
      redeemMock.mockRejectedValue(new Error("Failed to fetch"));
      const { result } = renderRedeem();
      let outcome: RedeemOutcome = null;

      await act(async () => {
        outcome = await result.current.redeem(target());
      });

      expect(outcome).toEqual(fail("UNAVAILABLE"));
      expect(result.current.notice).toBe(ACTION_MESSAGES.UNAVAILABLE);
      // One attempt, and nothing held for later.
      expect(redeemMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("unredeem (FR-431)", () => {
    it("sends the redemption's id to unredeemReward, and nothing else", async () => {
      const { result } = renderRedeem();

      await act(async () => {
        await result.current.unredeem(redemption());
      });

      expect(unredeemMock).toHaveBeenCalledTimes(1);
      expect(unredeemMock).toHaveBeenCalledWith({ redemptionId: "redemption-1" });
      expect(redeemMock).not.toHaveBeenCalled();
    });

    it("hands back the reversed row", async () => {
      const { result } = renderRedeem();
      let outcome: RedeemOutcome = null;

      await act(async () => {
        outcome = await result.current.unredeem(redemption());
      });

      expect(outcome).toEqual({
        ok: true,
        data: redemption({ reversedAt: "2026-09-05T20:05:00.000Z", reversedBy: CLEO }),
      });
    });

    it("marks the redemption's own card busy — the same key the column reads", async () => {
      const gate = deferred<ActionResult<Redemption>>();
      unredeemMock.mockReturnValue(gate.promise);
      const { result } = renderRedeem();

      let pending: Promise<unknown> = Promise.resolve();
      await act(async () => {
        pending = result.current.unredeem(redemption());
      });
      expect(result.current.busyKeys.has(rewardCardKeyOf(target()))).toBe(true);

      await act(async () => {
        gate.settle({ ok: true, data: redemption() });
        await pending;
      });
      expect(result.current.busyKeys.size).toBe(0);
    });

    it("surfaces a second put-back in the server's words (P0008)", async () => {
      const already = "That was already put back.";
      unredeemMock.mockResolvedValue(fail("CONFLICT", already));
      const { result } = renderRedeem();
      let outcome: RedeemOutcome = null;

      await act(async () => {
        outcome = await result.current.unredeem(redemption());
      });

      expect(outcome).toEqual(fail("CONFLICT", already));
      expect(result.current.notice).toBe(already);
    });

    it("writes nothing when the punch-in sheet is dismissed", async () => {
      const { result } = renderRedeem(withActorThatPrompts());

      await act(async () => {
        await result.current.unredeem(redemption());
      });

      expect(unredeemMock).not.toHaveBeenCalled();
      expect(result.current.notice).toBeNull();
    });
  });
});
