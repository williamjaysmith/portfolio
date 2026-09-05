/**
 * T018 — the column star pill's number (FR-407), the balance map the Rewards
 * tab reads from (FR-412), and the Give-stars before-and-after table
 * (FR-434, FR-436).
 *
 * `starsTodayOf` is SC-402 read the other way round: the pill is the net of
 * credits and retractions EARNED on the displayed day for one Profile, and
 * nothing else — not the balance, not another day, not another Profile, not a
 * redemption. The table cases are written as a day a person could check by
 * hand against the ledger.
 */

import { describe, expect, it } from "vitest";

import {
  balanceMapOf,
  balanceOf,
  beforeAndAfterOf,
  starsTodayOf,
} from "@/lib/family/rewards/stars";
import type { StarBalance, StarEntry, StarEntryKind } from "@/lib/family/types";

const HOUSEHOLD = "00000000-0000-4000-8000-000000000000";
const ANA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BEN = "22222222-2222-4222-8222-222222222222";
const CLEO = "11111111-1111-4111-8111-111111111111";

const TODAY = "2026-09-04";
const YESTERDAY = "2026-09-03";

let uniqueId = 0;

function entry(
  kind: StarEntryKind,
  amount: number,
  overrides: Partial<StarEntry> = {},
): StarEntry {
  uniqueId += 1;
  const offResolution = kind === "credit" || kind === "retraction";
  return {
    id: `entry-${uniqueId}`,
    householdId: HOUSEHOLD,
    categoryId: CLEO,
    amount,
    kind,
    earnedOn: offResolution ? TODAY : null,
    resolutionId: offResolution ? `resolution-${uniqueId}` : null,
    redemptionId: kind === "redemption" || kind === "refund" ? `redemption-${uniqueId}` : null,
    summary: kind === "adjustment" ? null : "Feed the cat",
    createdBy: CLEO,
    enteredOn: TODAY,
    createdAt: "2026-09-04T18:00:00.000+00:00",
    ...overrides,
  };
}

describe("starsTodayOf", () => {
  it("reads 0 with no entries at all", () => {
    expect(starsTodayOf([], CLEO, TODAY)).toBe(0);
  });

  it("sums the day's credits: 5 + 10 reads 15 (US1-3, US1-5)", () => {
    const entries = [entry("credit", 5, { summary: "Brush teeth" }), entry("credit", 10)];
    expect(starsTodayOf(entries, CLEO, TODAY)).toBe(15);
  });

  it("nets a retraction against its credit: an un-tick drops 15 back to 5 (US1-4)", () => {
    const entries = [
      entry("credit", 5, { summary: "Brush teeth" }),
      entry("credit", 10),
      entry("retraction", -10),
    ];
    expect(starsTodayOf(entries, CLEO, TODAY)).toBe(5);
  });

  it("ignores stars earned on another day — the pill rolls with the board (FR-407)", () => {
    const entries = [entry("credit", 10, { earnedOn: YESTERDAY }), entry("credit", 5)];
    expect(starsTodayOf(entries, CLEO, TODAY)).toBe(5);
    expect(starsTodayOf(entries, CLEO, YESTERDAY)).toBe(10);
  });

  it("ignores another Profile's stars", () => {
    const entries = [entry("credit", 20, { categoryId: BEN }), entry("credit", 5)];
    expect(starsTodayOf(entries, CLEO, TODAY)).toBe(5);
    expect(starsTodayOf(entries, BEN, TODAY)).toBe(20);
    expect(starsTodayOf(entries, ANA, TODAY)).toBe(0);
  });

  it("ignores redemptions, refunds and adjustments — they are balance movements, not earnings", () => {
    const entries = [
      entry("credit", 5),
      entry("redemption", -20),
      entry("refund", 20),
      entry("adjustment", 15),
      // An adjustment never carries `earnedOn` (025's kind shape); this
      // impossible row proves the kind is what is read, not the date alone.
      entry("adjustment", 100, { earnedOn: TODAY }),
    ];
    expect(starsTodayOf(entries, CLEO, TODAY)).toBe(5);
  });

  it("reads a mixed week the way SC-402 checks it by hand", () => {
    const entries = [
      entry("credit", 5, { earnedOn: "2026-08-31" }),
      entry("credit", 5, { earnedOn: "2026-09-01" }),
      entry("retraction", -5, { earnedOn: "2026-09-01" }),
      entry("credit", 5, { earnedOn: "2026-09-02", categoryId: BEN }),
      entry("credit", 5, { earnedOn: TODAY }),
      entry("credit", 10, { earnedOn: TODAY }),
      entry("adjustment", 15),
    ];
    const week = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", TODAY];
    expect(week.map((day) => starsTodayOf(entries, CLEO, day))).toEqual([5, 0, 0, 0, 15]);
  });
});

describe("balanceMapOf and balanceOf", () => {
  const rows: StarBalance[] = [
    { categoryId: CLEO, balance: 15 },
    { categoryId: BEN, balance: -20 },
  ];

  it("keys every Profile's balance by id, negatives kept honest (FR-413)", () => {
    const balances = balanceMapOf(rows);
    expect(balances.get(CLEO)).toBe(15);
    expect(balances.get(BEN)).toBe(-20);
    expect(balances.size).toBe(2);
  });

  it("reads 0 for a Profile with no row — a Profile who has never earned anything", () => {
    const balances = balanceMapOf(rows);
    expect(balanceOf(balances, ANA)).toBe(0);
    expect(balanceOf(balances, CLEO)).toBe(15);
    expect(balanceOf(balanceMapOf([]), CLEO)).toBe(0);
  });
});

describe("beforeAndAfterOf", () => {
  const balances = balanceMapOf([
    { categoryId: BEN, balance: 40 },
    { categoryId: ANA, balance: 3 },
  ]);

  it("gives every chosen Profile the same amount, in the order chosen: Cleo 0 → 10, Ben 40 → 50 (US4-2)", () => {
    const table = beforeAndAfterOf(balances, [CLEO, BEN], 10);
    expect(table.rows).toEqual([
      { categoryId: CLEO, before: 0, after: 10, belowZero: false },
      { categoryId: BEN, before: 40, after: 50, belowZero: false },
    ]);
    expect(table.anyBelowZero).toBe(false);
  });

  it("takes stars away with a negative amount: Ben 40 → 35 (US4-3)", () => {
    const table = beforeAndAfterOf(balances, [BEN], -5);
    expect(table.rows).toEqual([{ categoryId: BEN, before: 40, after: 35, belowZero: false }]);
    expect(table.anyBelowZero).toBe(false);
  });

  it("flags the row that would end below zero and the whole table with it: 3 → −2 (US4-4, FR-436)", () => {
    const table = beforeAndAfterOf(balances, [BEN, ANA], -5);
    expect(table.rows).toEqual([
      { categoryId: BEN, before: 40, after: 35, belowZero: false },
      { categoryId: ANA, before: 3, after: -2, belowZero: true },
    ]);
    expect(table.anyBelowZero).toBe(true);
  });

  it("lets a balance land exactly on zero", () => {
    const table = beforeAndAfterOf(balances, [ANA], -3);
    expect(table.rows[0]).toEqual({ categoryId: ANA, before: 3, after: 0, belowZero: false });
    expect(table.anyBelowZero).toBe(false);
  });
});
