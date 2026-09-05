/**
 * Star arithmetic the board and the Rewards tab read from (004 R402).
 *
 * The balance is the sum of a Profile's ledger entries and lives in the
 * `star_balances` view (FR-412); the Tasks column's star pill is a DIFFERENT
 * number by decision (Assumption 6): the net of credits and retractions EARNED
 * on the displayed day, read from the anchored week's entries in the memo
 * chain above every display filter (R317's branch), so it rolls with the
 * board at midnight and reads yesterday's stars on yesterday (FR-407).
 *
 * The before-and-after table (FR-434) is advisory — the database refuses the
 * write if the stored balance would end below zero (FR-436) — so it is
 * computed here from the balances the tab already holds, one row per chosen
 * Profile, in the order chosen.
 *
 * Framework-free and pure: no React, no storage, no clock.
 */

import type { StarBalance, StarEntry } from "../types";

/** One row of the Give-stars table: a Profile's balance before and after (FR-434). */
export interface BalanceChange {
  categoryId: string;
  before: number;
  after: number;
  /** FR-436: the write will be refused while any row reads true. */
  belowZero: boolean;
}

/** The whole table, with the one bit the Confirm control is disabled on. */
export interface BeforeAndAfter {
  rows: BalanceChange[];
  anyBelowZero: boolean;
}

/**
 * FR-407's pill: the stars one Profile EARNED on one household-local day —
 * credits less retractions dated that day. A redemption, a refund or a hand
 * adjustment moves the balance, not the day's earnings, and carries no
 * `earnedOn` (025's kind shape); the kind is what is read, not the date alone.
 */
export function starsTodayOf(
  entries: readonly StarEntry[],
  profileId: string,
  day: string,
): number {
  return entries
    .filter((one) => one.categoryId === profileId && one.earnedOn === day)
    .filter((one) => one.kind === "credit" || one.kind === "retraction")
    .reduce((sum, one) => sum + one.amount, 0);
}

/** The view's rows keyed by Profile. A negative balance is kept as it is (FR-413). */
export function balanceMapOf(rows: readonly StarBalance[]): Map<string, number> {
  return new Map(rows.map((row) => [row.categoryId, row.balance]));
}

/**
 * One Profile's balance from the map — 0 for a Profile with no row, which is
 * a Profile who has never earned, spent or been given anything (the view
 * returns one row per Profile with entries, and nothing is a balance of 0).
 */
export function balanceOf(balances: ReadonlyMap<string, number>, profileId: string): number {
  return balances.get(profileId) ?? 0;
}

/**
 * The Give-stars table (FR-434): every chosen Profile gets the same amount,
 * negative to take away, and any row that would end below zero flags the whole
 * table (FR-436) — the confirmation stays disabled until it is fixed, and the
 * server refuses it anyway if the balance moved underneath.
 */
export function beforeAndAfterOf(
  balances: ReadonlyMap<string, number>,
  categoryIds: readonly string[],
  amount: number,
): BeforeAndAfter {
  const rows = categoryIds.map((categoryId) => {
    const before = balanceOf(balances, categoryId);
    const after = before + amount;
    return { categoryId, before, after, belowZero: after < 0 };
  });
  return { rows, anyBelowZero: rows.some((row) => row.belowZero) };
}
