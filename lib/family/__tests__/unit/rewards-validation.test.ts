import { describe, expect, it } from "vitest";

import { ActionFailure } from "@/lib/family/errors";
import type { Reward } from "@/lib/family/types";
import {
  adjustStarsSchema,
  deleteRewardSchema,
  parseOrThrow,
  redeemRewardSchema,
  rewardInputSchema,
  unredeemRewardSchema,
  updateRewardSchema,
  validateRewardPatch,
} from "@/lib/family/validation";

/**
 * 004 T014 — the reward write boundary (`contracts/server-actions.md` → "Shared
 * input shapes", "Rewards", "Redeeming", "Giving stars by hand").
 *
 * Every schema is a strict object, asserted in both directions: what the form
 * sends is accepted and normalised, and what a client might invent — a balance,
 * a redemption date, a cost on a redeem — is REFUSED rather than stripped. The
 * 024–026 CHECKs and triggers behind these are the second line (data-model,
 * "What the database enforces, and what the action does"); their messages are
 * never echoed to a parent.
 */

const CLEO = "00000000-0000-4000-8000-00000000000a";
const BEN = "00000000-0000-4000-8000-00000000000b";
const REWARD_ID = "00000000-0000-4000-8000-0000000000aa";
const REDEMPTION_ID = "00000000-0000-4000-8000-0000000000bb";

type Draft = Record<string, unknown>;

function reward(overrides: Draft = {}): Draft {
  return {
    name: "Bake cookies",
    pointValue: 20,
    respawnOnRedemption: true,
    categoryIds: [CLEO],
    ...overrides,
  };
}

/** The refusal a parent actually sees: an `ActionFailure`, not a ZodError. */
function refusalOf(input: unknown): ActionFailure {
  try {
    parseOrThrow(rewardInputSchema, input);
  } catch (error) {
    if (error instanceof ActionFailure) return error;
    throw error;
  }
  throw new Error("expected a VALIDATION refusal, got a parse");
}

function refusedFields(input: unknown): string[] {
  return Object.keys(refusalOf(input).fieldErrors ?? {});
}

function accepts(input: unknown): boolean {
  return rewardInputSchema.safeParse(input).success;
}

describe("rewardInputSchema — the six fields (FR-415, FR-416)", () => {
  it("accepts the four required fields and defaults nothing silently", () => {
    const parsed = parseOrThrow(rewardInputSchema, reward());
    expect(parsed).toEqual({
      name: "Bake cookies",
      pointValue: 20,
      respawnOnRedemption: true,
      categoryIds: [CLEO],
    });
  });

  it("requires a title, trims it and bounds it at 120", () => {
    const failure = refusalOf(reward({ name: "   " }));
    expect(failure.code).toBe("VALIDATION");
    expect(failure.fieldErrors?.name).toBeDefined();
    expect(refusedFields(reward({ name: undefined }))).toContain("name");
    expect(parseOrThrow(rewardInputSchema, reward({ name: "  Cookies  " })).name).toBe("Cookies");
    expect(accepts(reward({ name: "x".repeat(120) }))).toBe(true);
    expect(refusedFields(reward({ name: "x".repeat(121) }))).toContain("name");
  });

  it("bounds the description at 2000 and folds blank to null", () => {
    expect(accepts(reward({ description: "n".repeat(2000) }))).toBe(true);
    expect(refusedFields(reward({ description: "n".repeat(2001) }))).toContain("description");
    expect(parseOrThrow(rewardInputSchema, reward({ description: "  " })).description).toBeNull();
    expect(parseOrThrow(rewardInputSchema, reward({ description: null })).description).toBeNull();
  });

  it("takes one emoji glyph of at most 16 characters, or none", () => {
    expect(accepts(reward({ emoji: "🍪" }))).toBe(true);
    expect(accepts(reward({ emoji: "👨‍👩‍👧‍👦" }))).toBe(true);
    expect(accepts(reward({ emoji: null }))).toBe(true);
    expect(refusedFields(reward({ emoji: "🍪🍿" }))).toContain("emoji");
    expect(refusedFields(reward({ emoji: "x".repeat(17) }))).toContain("emoji");
  });

  it.each([1, 20, 500])("accepts a cost of %i", (pointValue) => {
    expect(accepts(reward({ pointValue }))).toBe(true);
  });

  it.each([0, 501, -1, 2.5, "20", null, undefined])("refuses a cost of %p naming the field", (pointValue) => {
    const failure = refusalOf(reward({ pointValue }));
    expect(failure.fieldErrors?.pointValue).toEqual(["Cost must be a whole number from 1 to 500."]);
  });

  it("requires the renew switch to be a real boolean", () => {
    expect(accepts(reward({ respawnOnRedemption: false }))).toBe(true);
    expect(refusedFields(reward({ respawnOnRedemption: "yes" }))).toContain("respawnOnRedemption");
    expect(refusedFields(reward({ respawnOnRedemption: undefined }))).toContain("respawnOnRedemption");
  });

  it("requires at least one eligible Profile, each once (FR-415, FR-417)", () => {
    const failure = refusalOf(reward({ categoryIds: [] }));
    expect(failure.message).toBe("Choose at least one Profile.");
    expect(failure.fieldErrors?.categoryIds).toEqual(["Choose at least one Profile."]);
    expect(refusedFields(reward({ categoryIds: undefined }))).toContain("categoryIds");
    expect(refusedFields(reward({ categoryIds: [CLEO, CLEO] }))).toContain("categoryIds");
    expect(refusedFields(reward({ categoryIds: ["Cleo"] }))).toContain("categoryIds");
    expect(accepts(reward({ categoryIds: [CLEO, BEN] }))).toBe(true);
  });

  it.each([
    ["a balance", { balance: 100 }],
    ["a per-reward progress counter", { progress: 5 }],
    ["a redemption date", { redeemedAt: "2026-09-05T10:00:00Z" }],
    ["a redeemed flag", { redeemed: true }],
    ["a creation date", { createdAt: "2026-09-05" }],
    ["a household", { householdId: REWARD_ID }],
  ])("refuses %s as VALIDATION rather than stripping it", (_label, extra) => {
    const failure = refusalOf(reward(extra));
    expect(failure.code).toBe("VALIDATION");
  });
});

const existing: Reward = {
  id: REWARD_ID,
  householdId: "00000000-0000-4000-8000-000000000001",
  name: "Bake cookies",
  description: null,
  emoji: "🍪",
  pointValue: 20,
  respawnOnRedemption: true,
  categoryIds: [CLEO],
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
};

describe("updateRewardSchema — the envelope, and the patch judged merged (FR-418)", () => {
  it("takes an id and a patch of bare keys", () => {
    const parsed = updateRewardSchema.parse({ id: REWARD_ID, patch: { pointValue: 30 } });
    expect(parsed).toEqual({ id: REWARD_ID, patch: { pointValue: 30 } });
  });

  it("refuses a bad id, a missing patch, and anything beside them", () => {
    expect(updateRewardSchema.safeParse({ id: "cookies", patch: {} }).success).toBe(false);
    expect(updateRewardSchema.safeParse({ id: REWARD_ID }).success).toBe(false);
    expect(updateRewardSchema.safeParse({ id: REWARD_ID, patch: {}, scope: "all" }).success).toBe(false);
  });

  it("validates the MERGED shape through the create schema, never the patch alone", () => {
    expect(validateRewardPatch(existing, { pointValue: 30 })).toEqual({
      name: "Bake cookies",
      description: null,
      emoji: "🍪",
      pointValue: 30,
      respawnOnRedemption: true,
      categoryIds: [CLEO],
    });
  });

  it("lands a refusal against the field itself, for the form to show", () => {
    expect(() => validateRewardPatch(existing, { pointValue: 501 })).toThrow(ActionFailure);
    try {
      validateRewardPatch(existing, { pointValue: 501 });
    } catch (error) {
      expect((error as ActionFailure).fieldErrors).toEqual({
        pointValue: ["Cost must be a whole number from 1 to 500."],
      });
    }
  });

  it("refuses a patch that leaves nobody eligible, and one that invents a key", () => {
    expect(() => validateRewardPatch(existing, { categoryIds: [] })).toThrow("Choose at least one Profile.");
    expect(() => validateRewardPatch(existing, { redeemedAt: "2026-09-05" })).toThrow(ActionFailure);
  });

  it("lets a patch change every field, the eligible Profiles included", () => {
    const merged = validateRewardPatch(existing, {
      name: "Movie night",
      emoji: "🍿",
      respawnOnRedemption: false,
      categoryIds: [CLEO, BEN],
    });
    expect(merged.name).toBe("Movie night");
    expect(merged.respawnOnRedemption).toBe(false);
    expect(merged.categoryIds).toEqual([CLEO, BEN]);
  });
});

describe("deleteRewardSchema (FR-418)", () => {
  it("needs a literal confirm: true beside the id", () => {
    expect(deleteRewardSchema.safeParse({ id: REWARD_ID, confirm: true }).success).toBe(true);
    expect(deleteRewardSchema.safeParse({ id: REWARD_ID, confirm: false }).success).toBe(false);
    expect(deleteRewardSchema.safeParse({ id: REWARD_ID }).success).toBe(false);
    expect(deleteRewardSchema.safeParse({ id: REWARD_ID, confirm: true, scope: "all" }).success).toBe(false);
  });
});

describe("redeemRewardSchema (FR-424, FR-428)", () => {
  it("names the reward and the Profile, and nothing about the cost", () => {
    expect(redeemRewardSchema.parse({ rewardId: REWARD_ID, categoryId: CLEO })).toEqual({
      rewardId: REWARD_ID,
      categoryId: CLEO,
    });
    expect(redeemRewardSchema.safeParse({ rewardId: REWARD_ID }).success).toBe(false);
    expect(redeemRewardSchema.safeParse({ rewardId: "cookies", categoryId: CLEO }).success).toBe(false);
  });

  it.each([
    ["a cost", { pointValue: 1 }],
    ["a name", { rewardName: "Free" }],
    ["a day", { redeemedOn: "2026-09-05" }],
    ["an actor", { redeemedBy: CLEO }],
  ])("refuses %s — the trigger copies those from the stored reward", (_label, extra) => {
    expect(redeemRewardSchema.safeParse({ rewardId: REWARD_ID, categoryId: CLEO, ...extra }).success).toBe(
      false,
    );
  });
});

describe("unredeemRewardSchema (FR-431)", () => {
  it("takes the redemption id alone", () => {
    expect(unredeemRewardSchema.parse({ redemptionId: REDEMPTION_ID })).toEqual({
      redemptionId: REDEMPTION_ID,
    });
    expect(unredeemRewardSchema.safeParse({}).success).toBe(false);
    expect(unredeemRewardSchema.safeParse({ redemptionId: REDEMPTION_ID, reversedBy: CLEO }).success).toBe(
      false,
    );
  });
});

describe("adjustStarsSchema (FR-434, FR-436)", () => {
  const adjust = (overrides: Draft = {}): Draft => ({ categoryIds: [CLEO, BEN], amount: 15, ...overrides });

  function refusal(input: unknown): ActionFailure {
    try {
      parseOrThrow(adjustStarsSchema, input);
    } catch (error) {
      if (error instanceof ActionFailure) return error;
      throw error;
    }
    throw new Error("expected a VALIDATION refusal, got a parse");
  }

  it.each([1, 15, 500, -1, -500])("accepts a whole amount of %i", (amount) => {
    expect(parseOrThrow(adjustStarsSchema, adjust({ amount }))).toEqual({ categoryIds: [CLEO, BEN], amount });
  });

  it.each([0, 501, -501, 2.5, "15", null, undefined])("refuses an amount of %p naming the field", (amount) => {
    expect(refusal(adjust({ amount })).fieldErrors?.amount).toBeDefined();
  });

  it("says why 0 is refused: it would move nothing", () => {
    expect(refusal(adjust({ amount: 0 })).fieldErrors?.amount).toEqual(["Enter a number other than 0."]);
  });

  it("requires at least one Profile, each once", () => {
    expect(refusal(adjust({ categoryIds: [] })).fieldErrors?.categoryIds).toEqual(["Choose at least one Profile."]);
    expect(refusal(adjust({ categoryIds: [CLEO, CLEO] })).fieldErrors?.categoryIds).toBeDefined();
    expect(refusal(adjust({ categoryIds: undefined })).fieldErrors?.categoryIds).toBeDefined();
  });

  it("refuses a note, a day or an actor — the action supplies those", () => {
    expect(adjustStarsSchema.safeParse(adjust({ summary: "Bonus" })).success).toBe(false);
    expect(adjustStarsSchema.safeParse(adjust({ enteredOn: "2026-09-05" })).success).toBe(false);
    expect(adjustStarsSchema.safeParse(adjust({ createdBy: CLEO })).success).toBe(false);
  });
});
