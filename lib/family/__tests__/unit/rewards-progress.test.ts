/**
 * T019 — what a reward card shows and where it sits (FR-420, FR-423, FR-425,
 * FR-427, FR-430).
 *
 * The progress truth table is the spec's own: below the cost a bar with
 * "☆ balance/cost" centred on it, at or above the cost a Redeem button — never
 * both (FR-423). Progress is the balance against the cost and nothing else,
 * so a cost edit moves every bar at once (US2-8) and a negative balance after
 * an un-tick of spent stars reads as an empty bar (Assumption 5).
 */

import { describe, expect, it } from "vitest";

import {
  isRedeemedOneTime,
  orderRewardCards,
  rewardProgressOf,
  standingRedemptionOf,
  type OrderableRewardCard,
} from "@/lib/family/rewards/progress";
import type { Redemption, Reward } from "@/lib/family/types";

const HOUSEHOLD = "00000000-0000-4000-8000-000000000000";
const BEN = "22222222-2222-4222-8222-222222222222";
const CLEO = "11111111-1111-4111-8111-111111111111";
const COOKIES = "reward-cookies";
const MOVIE = "reward-movie";

let uniqueId = 0;

function reward(overrides: Partial<Reward> = {}): Reward {
  uniqueId += 1;
  return {
    id: `reward-${uniqueId}`,
    householdId: HOUSEHOLD,
    name: "Bake cookies",
    description: null,
    emoji: "🍪",
    pointValue: 20,
    respawnOnRedemption: false,
    categoryIds: [CLEO],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T12:00:00.000+00:00",
    updatedAt: "2026-09-01T12:00:00.000+00:00",
    ...overrides,
  };
}

function redemption(overrides: Partial<Redemption> = {}): Redemption {
  uniqueId += 1;
  return {
    id: `redemption-${uniqueId}`,
    householdId: HOUSEHOLD,
    rewardId: COOKIES,
    categoryId: CLEO,
    pointValue: 20,
    rewardName: "Bake cookies",
    redeemedOn: "2026-09-05",
    redeemedAt: "2026-09-05T20:00:00.000+00:00",
    redeemedBy: CLEO,
    reversedAt: null,
    reversedBy: null,
    ...overrides,
  };
}

describe("rewardProgressOf", () => {
  it("draws a bar three quarters full reading ☆ 15/20 below the cost (US2-2)", () => {
    expect(rewardProgressOf(15, 20)).toEqual({ kind: "bar", filled: 0.75, label: "☆ 15/20" });
  });

  it("offers Redeem at exactly the cost — enough is enough (US2-3)", () => {
    expect(rewardProgressOf(15, 15)).toEqual({ kind: "redeem" });
  });

  it("offers Redeem above the cost (US2 — Ben at 40 against 25)", () => {
    expect(rewardProgressOf(40, 25)).toEqual({ kind: "redeem" });
  });

  it("draws an empty bar at zero", () => {
    expect(rewardProgressOf(0, 20)).toEqual({ kind: "bar", filled: 0, label: "☆ 0/20" });
  });

  it("clamps a negative balance to an empty bar but keeps the number honest (Assumption 5)", () => {
    expect(rewardProgressOf(-20, 20)).toEqual({ kind: "bar", filled: 0, label: "☆ -20/20" });
  });

  it("is the balance against the cost, so a cost edit moves the bar: 15/20 → 15/30 (US2-8)", () => {
    expect(rewardProgressOf(15, 30)).toEqual({ kind: "bar", filled: 0.5, label: "☆ 15/30" });
  });

  it("one star short is still a bar (SC-408's one-short check)", () => {
    expect(rewardProgressOf(19, 20)).toEqual({ kind: "bar", filled: 0.95, label: "☆ 19/20" });
  });
});

describe("orderRewardCards", () => {
  function card(overrides: Partial<OrderableRewardCard> & { id: string }): OrderableRewardCard & {
    id: string;
  } {
    return {
      cost: 20,
      createdAt: "2026-09-01T12:00:00.000+00:00",
      affordable: false,
      redeemedAt: null,
      ...overrides,
    };
  }

  it("puts affordable cards first, then cost ascending, then creation order, then redeemed ones (FR-427)", () => {
    const cards = [
      card({ id: "redeemed-old", redeemedAt: "2026-09-01T10:00:00.000+00:00" }),
      card({ id: "far-50", cost: 50 }),
      card({ id: "affordable-25", cost: 25, affordable: true }),
      card({ id: "near-30-later", cost: 30, createdAt: "2026-09-02T12:00:00.000+00:00" }),
      card({ id: "near-30-earlier", cost: 30, createdAt: "2026-09-01T12:00:00.000+00:00" }),
      card({ id: "affordable-10", cost: 10, affordable: true }),
      card({ id: "redeemed-recent", redeemedAt: "2026-09-05T10:00:00.000+00:00" }),
    ];
    expect(orderRewardCards(cards).map((one) => one.id)).toEqual([
      "affordable-10",
      "affordable-25",
      "near-30-earlier",
      "near-30-later",
      "far-50",
      "redeemed-recent",
      "redeemed-old",
    ]);
  });

  it("keeps an affordable dear reward ahead of an unaffordable cheap one", () => {
    const cards = [
      card({ id: "cheap-unaffordable", cost: 5 }),
      card({ id: "dear-affordable", cost: 100, affordable: true }),
    ];
    expect(orderRewardCards(cards).map((one) => one.id)).toEqual([
      "dear-affordable",
      "cheap-unaffordable",
    ]);
  });

  it("orders redeemed cards most recent first (FR-426)", () => {
    const cards = [
      card({ id: "sep-1", redeemedAt: "2026-09-01T10:00:00.000+00:00" }),
      card({ id: "sep-5", redeemedAt: "2026-09-05T10:00:00.000+00:00" }),
      card({ id: "sep-3", redeemedAt: "2026-09-03T10:00:00.000+00:00" }),
    ];
    expect(orderRewardCards(cards).map((one) => one.id)).toEqual(["sep-5", "sep-3", "sep-1"]);
  });

  it("returns a new array and leaves the input as it was", () => {
    const cards = [card({ id: "b", cost: 30 }), card({ id: "a", cost: 10 })];
    const ordered = orderRewardCards(cards);
    expect(ordered).not.toBe(cards);
    expect(cards.map((one) => one.id)).toEqual(["b", "a"]);
    expect(ordered.map((one) => one.id)).toEqual(["a", "b"]);
  });
});

describe("standingRedemptionOf", () => {
  it("is null with no redemptions", () => {
    expect(standingRedemptionOf([], COOKIES, CLEO)).toBeNull();
  });

  it("is null when the only redemption was reversed (FR-431)", () => {
    const reversed = redemption({
      reversedAt: "2026-09-05T21:00:00.000+00:00",
      reversedBy: BEN,
    });
    expect(standingRedemptionOf([reversed], COOKIES, CLEO)).toBeNull();
  });

  it("finds the unreversed one for that reward and that Profile", () => {
    const standing = redemption();
    const others = [
      redemption({ rewardId: MOVIE }),
      redemption({ categoryId: BEN }),
      redemption({ reversedAt: "2026-09-04T21:00:00.000+00:00", reversedBy: CLEO }),
    ];
    expect(standingRedemptionOf([...others, standing], COOKIES, CLEO)).toBe(standing);
  });

  it("picks the most recent standing one of a renewing reward, whatever the input order", () => {
    const earlier = redemption({ redeemedAt: "2026-09-01T10:00:00.000+00:00" });
    const latest = redemption({ redeemedAt: "2026-09-05T10:00:00.000+00:00" });
    const middle = redemption({ redeemedAt: "2026-09-03T10:00:00.000+00:00" });
    expect(standingRedemptionOf([middle, earlier, latest], COOKIES, CLEO)).toBe(latest);
    expect(standingRedemptionOf([latest, earlier, middle], COOKIES, CLEO)).toBe(latest);
  });
});

describe("isRedeemedOneTime", () => {
  const oneTime = reward({ id: COOKIES, respawnOnRedemption: false });
  const renewing = reward({ id: COOKIES, respawnOnRedemption: true });

  it("is true for a one-time reward with a standing redemption for that Profile (FR-425)", () => {
    expect(isRedeemedOneTime(oneTime, [redemption()], CLEO)).toBe(true);
  });

  it("is false once that redemption is reversed — the card is a bar again (US3-8)", () => {
    const reversed = redemption({
      reversedAt: "2026-09-05T21:00:00.000+00:00",
      reversedBy: BEN,
    });
    expect(isRedeemedOneTime(oneTime, [reversed], CLEO)).toBe(false);
  });

  it("is false for a renewing reward however often it was redeemed (FR-430)", () => {
    expect(isRedeemedOneTime(renewing, [redemption(), redemption()], CLEO)).toBe(false);
  });

  it("is per Profile: Cleo's redemption leaves Ben's card live (US3-7)", () => {
    expect(isRedeemedOneTime(oneTime, [redemption()], BEN)).toBe(false);
  });
});
