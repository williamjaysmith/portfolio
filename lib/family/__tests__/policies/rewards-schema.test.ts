/**
 * T007 / T008: the Phase 4 ledger pinned at the store — migrations 024–026 as
 * data-model.md writes them — exercised through the secret key the way the
 * server actions write, so every refusal surfaces as the SQLSTATE the actions
 * must map and every named CHECK is asserted by name. The `tasks-schema`
 * pattern: each trigger and each constraint is shown actually doing its job on
 * a real row, not merely declared.
 *
 * T007 — **the trigger truth table** (R401, SC-402/403/405, Assumption 5):
 * a `complete` resolution on a 10-star task writes exactly one `credit` of 10
 * to the Profile credited, dated `resolved_on`, carrying the task's summary and
 * the resolution's actor; a skip, a task worth `null` and a task worth `0`
 * write nothing; deleting the resolution writes exactly one `retraction` and
 * the partial unique indexes make a second one impossible rather than merely
 * unlikely; editing `reward_points` after the credit leaves the credit alone;
 * a retraction may take the balance below zero; **the cascade cases** — a
 * deleted task leaves its stars earned and writes no retraction (FR-411), a
 * deleted Profile takes their entries and SUCCEEDS (FR-443 — an insert for a
 * Profile mid-deletion would fail its FK and block the delete), and "this
 * occurrence" on a completed occurrence retracts like an un-tick; and the
 * CHECK / shape refusals on `star_entries`, `rewards` and `reward_eligibilities`.
 *
 * T008 — **the money rules** (R403, SC-408/409/411/412, SC-419, FR-421):
 * `assert_redemption` refusing the ineligible (`P0005`), the unaffordable by
 * one (`P0007`) and a second standing one-time redemption (`P0006`) while a
 * renewing reward redeems again; a redemption copying cost, name and day from
 * the reward and the household — never from the caller — and debiting once;
 * two concurrent inserts against one balance ending with ONE row and one
 * `P0007`, arbitrated by the Profile row lock; the reversal refunding exactly
 * once (`P0008` the second time) and refusing every other update (`23514`); a
 * multi-row adjustment that would overdraw one Profile writing nothing for any;
 * the cascades a reward's and a Profile's deletion run; and `star_balances`
 * reading one row per Profile, none per Label, 0 with no entries.
 *
 * Fixture rows are created here in a run-tagged household of this file's own,
 * never taken from the seed, so nothing here can drift with — or damage — the
 * seeded board.
 *
 * RED by design until T012 resets the stack onto 024–027: every write below
 * fails with `42P01` (no such relation) while the four tables do not exist.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import {
  adminClient,
  createPool,
  deleteHousehold,
  fixtures,
  insertCategory,
  insertHousehold,
} from "./helpers";

/** A repeating chore: skippable (FR-359), so every resolution shape below is legal on it. */
const CHORE = {
  starts_on: "2026-09-01",
  rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TU",
};
/** Two Tuesdays of that rule, and the day the first was ticked (a late tick, FR-405). */
const OCCURRENCE = "2026-09-15";
const LATER_OCCURRENCE = "2026-09-22";
const RESOLVED_ON = "2026-09-16";

const REDEMPTION_COLUMNS =
  "id, reward_id, category_id, point_value, reward_name, redeemed_on, redeemed_by, reversed_at, reversed_by";

/** One `family.star_entries` row as the assertions read it (dates as text). */
interface Entry {
  kind: string;
  amount: number;
  earned_on: string | null;
  resolution_id: string | null;
  redemption_id: string | null;
  summary: string | null;
  created_by: string | null;
  entered_on: string;
}

/** One `family.redemptions` row as PostgREST returns it. */
interface RedemptionRow {
  id: string;
  reward_id: string;
  category_id: string;
  point_value: number;
  reward_name: string;
  redeemed_on: string;
  redeemed_by: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
}

/** Every refusal this file asserts carries a SQLSTATE and a named reason. */
interface StoreRefusal {
  code: string;
  message: string;
}

interface RewardSeed {
  pointValue: number;
  respawn: boolean;
  eligible: readonly string[];
  name?: string;
}

function expectRefusal(error: StoreRefusal | null, sqlstate: string, detail: string): void {
  expect(error?.code, detail).toBe(sqlstate);
  expect(error?.message, detail).toContain(detail);
}

/** The pg error a raced statement rejects with, reduced to what the assertions read. */
function codeOf(outcome: PromiseSettledResult<unknown>): string | null {
  if (outcome.status === "fulfilled") return null;
  const reason = outcome.reason as { code?: string };
  return reason.code ?? "unknown";
}

describe("rewards schema: the ledger's truth table and the money rules", () => {
  const fx = fixtures();
  let pool: Pool;
  let admin: SupabaseClient;
  /** Every fixture row lives here; the household day is UTC (013's default). */
  let householdId: string;
  /** The parent who ticks, redeems and adjusts — the actor, never the credited. */
  let anaId: string;
  /** A Label: no balance, never eligible, never credited (FR-414). */
  let labelId: string;

  // ── writes through the secret key, the way the actions write ─────────────

  async function createProfile(label: string): Promise<string> {
    return insertCategory(pool, { householdId, label: `${label} ${fx.run}`, color: "#B6E085" });
  }

  async function createTask(rewardPoints: number | null, summary = "Feed the cat"): Promise<string> {
    const { data, error } = await admin
      .schema("family")
      .from("tasks")
      .insert({ household_id: householdId, summary: `${summary} ${fx.run}`, ...CHORE, reward_points: rewardPoints })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  }

  const insertResolution = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("task_resolutions")
      .insert({
        household_id: householdId,
        occurrence_date: OCCURRENCE,
        status: "complete",
        resolved_on: RESOLVED_ON,
        created_by: anaId,
        ...row,
      })
      .select("id")
      .single();

  /** A tick: the assigned Profile completes their own occurrence. */
  async function complete(taskId: string, profileId: string, extra: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await insertResolution({
      task_id: taskId,
      assignee_id: profileId,
      category_id: profileId,
      ...extra,
    });
    if (error) throw error;
    return (data as { id: string }).id;
  }

  /** An un-tick: the one deliberate, single-row delete of a resolution. */
  async function unresolve(resolutionId: string): Promise<void> {
    const { error } = await admin.schema("family").from("task_resolutions").delete().eq("id", resolutionId);
    if (error) throw error;
  }

  const insertEntry = (row: Record<string, unknown>) =>
    admin.schema("family").from("star_entries").insert({ household_id: householdId, ...row });

  /** A hand adjustment — one multi-row INSERT, as `adjustStars` writes it. */
  const adjust = (rows: readonly { category_id: string; amount: number }[], today: string) =>
    admin
      .schema("family")
      .from("star_entries")
      .insert(
        rows.map((row) => ({
          household_id: householdId,
          kind: "adjustment",
          created_by: anaId,
          entered_on: today,
          ...row,
        })),
      );

  async function give(profileId: string, amount: number): Promise<void> {
    const { error } = await adjust([{ category_id: profileId, amount }], await householdDay());
    if (error) throw error;
  }

  const insertReward = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("rewards")
      .insert({ household_id: householdId, name: `Bake cookies ${fx.run}`, ...row })
      .select("id")
      .single();

  const insertEligibility = (rewardId: string, categoryId: string) =>
    admin
      .schema("family")
      .from("reward_eligibilities")
      .insert({ household_id: householdId, reward_id: rewardId, category_id: categoryId });

  async function createReward(seed: RewardSeed): Promise<string> {
    const { data, error } = await insertReward({
      name: `${seed.name ?? "Bake cookies"} ${fx.run}`,
      point_value: seed.pointValue,
      respawn_on_redemption: seed.respawn,
    });
    if (error) throw error;
    const rewardId = (data as { id: string }).id;
    for (const categoryId of seed.eligible) {
      const link = await insertEligibility(rewardId, categoryId);
      if (link.error) throw link.error;
    }
    return rewardId;
  }

  /** The one INSERT `redeemReward` sends: reward, Profile, actor — and nothing else. */
  const redeem = (rewardId: string, categoryId: string, extra: Record<string, unknown> = {}) =>
    admin
      .schema("family")
      .from("redemptions")
      .insert({ household_id: householdId, reward_id: rewardId, category_id: categoryId, redeemed_by: anaId, ...extra })
      .select(REDEMPTION_COLUMNS)
      .single();

  async function redeemOk(rewardId: string, categoryId: string): Promise<RedemptionRow> {
    const { data, error } = await redeem(rewardId, categoryId);
    if (error) throw error;
    return data as RedemptionRow;
  }

  /** The one UPDATE `unredeemReward` sends. */
  const reverse = (redemptionId: string, patch: Record<string, unknown> = {}) =>
    admin
      .schema("family")
      .from("redemptions")
      .update({ reversed_at: new Date().toISOString(), reversed_by: anaId, ...patch })
      .eq("id", redemptionId)
      .select(REDEMPTION_COLUMNS)
      .single();

  // ── reads as `postgres`: the ledger, the view, the counts ─────────────────

  async function householdDay(): Promise<string> {
    const { rows } = await pool.query<{ day: string }>(
      "select (now() at time zone s.timezone)::date::text as day " +
        "from family.household_settings s where s.household_id = $1",
      [householdId],
    );
    return rows[0]?.day ?? "";
  }

  async function entriesOf(categoryId: string): Promise<Entry[]> {
    const { rows } = await pool.query<Entry>(
      "select kind, amount, earned_on::text as earned_on, resolution_id, redemption_id, summary, " +
        "created_by, entered_on::text as entered_on " +
        "from family.star_entries where category_id = $1 order by created_at, kind",
      [categoryId],
    );
    return rows;
  }

  async function balanceOf(categoryId: string): Promise<number> {
    const { rows } = await pool.query<{ balance: number }>(
      "select coalesce(sum(amount), 0)::integer as balance from family.star_entries where category_id = $1",
      [categoryId],
    );
    return rows[0]?.balance ?? Number.NaN;
  }

  /** The view's answer, or `undefined` when the view has no row for that category. */
  async function viewBalanceOf(categoryId: string): Promise<number | undefined> {
    const { rows } = await pool.query<{ balance: number }>(
      "select balance from family.star_balances where household_id = $1 and category_id = $2",
      [householdId, categoryId],
    );
    return rows[0]?.balance;
  }

  async function count(table: string, column: string, value: string): Promise<number> {
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from family.${table} where ${column} = $1`,
      [value],
    );
    return Number(rows[0]?.n ?? 0);
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();
    householdId = await insertHousehold(pool, `test-${fx.run}-rewards-schema`);
    anaId = await insertCategory(pool, {
      householdId,
      label: `Ana ${fx.run}`,
      color: "#2178AF",
      role: "parent",
    });
    labelId = await insertCategory(pool, {
      householdId,
      label: `Bin day ${fx.run}`,
      color: "#915EA1",
      isProfile: false,
    });
  });

  afterAll(async () => {
    await deleteHousehold(pool, householdId);
    await pool.end();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // T007 — the trigger truth table (R401)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("credit_task_resolution: what a completion writes (FR-405, FR-406, FR-409)", () => {
    it("a completion credits the task's value to the Profile, dated the day it was ticked, naming the actor", async () => {
      const cleoId = await createProfile("Cleo");
      const taskId = await createTask(10);
      const resolutionId = await complete(taskId, cleoId);

      expect(await entriesOf(cleoId)).toEqual([
        {
          kind: "credit",
          amount: 10,
          // The day it was TICKED, not the day it was due (a late chore earns today).
          earned_on: RESOLVED_ON,
          resolution_id: resolutionId,
          redemption_id: null,
          summary: `Feed the cat ${fx.run}`,
          // The credited Profile is the row's `category_id`; the actor is kept apart.
          created_by: anaId,
          entered_on: await householdDay(),
        },
      ]);
      expect(await balanceOf(cleoId)).toBe(10);
      expect(await viewBalanceOf(cleoId)).toBe(10);
    });

    it("a skip, a task worth nothing and a task worth null write nothing (FR-406, SC-403)", async () => {
      const cleoId = await createProfile("Cleo skip");
      const tenStars = await createTask(10);
      const zeroStars = await createTask(0, "Sweep");
      const unvalued = await createTask(null, "Tidy");

      await complete(tenStars, cleoId, { status: "skipped" });
      await complete(zeroStars, cleoId);
      await complete(unvalued, cleoId);

      expect(await entriesOf(cleoId)).toEqual([]);
      expect(await viewBalanceOf(cleoId)).toBe(0);
    });

    it("editing the task's value after a credit rewrites nothing; only the next tick earns the new value (SC-405)", async () => {
      const cleoId = await createProfile("Cleo edit");
      const taskId = await createTask(10);
      const first = await complete(taskId, cleoId);

      const edit = await admin.schema("family").from("tasks").update({ reward_points: 3 }).eq("id", taskId);
      expect(edit.error).toBeNull();
      expect((await entriesOf(cleoId)).map((entry) => entry.amount)).toEqual([10]);

      const second = await complete(taskId, cleoId, { occurrence_date: LATER_OCCURRENCE });
      expect(second).not.toBe(first);
      expect((await entriesOf(cleoId)).map((entry) => [entry.resolution_id, entry.amount])).toEqual([
        [first, 10],
        [second, 3],
      ]);
      expect(await balanceOf(cleoId)).toBe(13);
    });
  });

  describe("retract_task_resolution: what an un-tick writes, and only an un-tick (FR-408, FR-411)", () => {
    it("an un-tick retracts exactly the credit, as a second entry, and the indexes forbid a second one", async () => {
      const cleoId = await createProfile("Cleo undo");
      const taskId = await createTask(10);
      const resolutionId = await complete(taskId, cleoId);
      await unresolve(resolutionId);

      const entries = await entriesOf(cleoId);
      expect(entries.map((entry) => [entry.kind, entry.amount])).toEqual([
        ["credit", 10],
        ["retraction", -10],
      ]);
      // The reversal names what it reverses and keeps the day it was earned;
      // the credit's actor is the tick's, so the retraction records nobody.
      expect(entries[1]).toMatchObject({
        resolution_id: resolutionId,
        earned_on: RESOLVED_ON,
        summary: `Feed the cat ${fx.run}`,
        created_by: null,
        entered_on: await householdDay(),
      });
      expect(await balanceOf(cleoId)).toBe(0);

      // SC-402 by index, not by care taken: a second retraction for the same
      // resolution is unrepresentable, whoever tries to write it.
      const doubled = await insertEntry({
        category_id: cleoId,
        amount: -10,
        kind: "retraction",
        earned_on: RESOLVED_ON,
        resolution_id: resolutionId,
        entered_on: await householdDay(),
      });
      expectRefusal(doubled.error, "23505", "star_entries_retraction_once_idx");

      // …and so is a second CREDIT: re-inserting the resolution under its old id
      // fails in the credit trigger, leaving no resolution row at all.
      const resurrected = await insertResolution({
        id: resolutionId,
        task_id: taskId,
        assignee_id: cleoId,
        category_id: cleoId,
      });
      expectRefusal(resurrected.error, "23505", "star_entries_credit_once_idx");
      expect(await count("task_resolutions", "id", resolutionId)).toBe(0);

      // A re-tick is a NEW resolution: one more credit and, un-ticked, one more
      // retraction — the first pair untouched, the sum still zero.
      const again = await complete(taskId, cleoId);
      await unresolve(again);
      expect((await entriesOf(cleoId)).map((entry) => [entry.resolution_id, entry.amount])).toEqual([
        [resolutionId, 10],
        [resolutionId, -10],
        [again, 10],
        [again, -10],
      ]);
      expect(await balanceOf(cleoId)).toBe(0);
    });

    it("a retraction may take the balance below zero — the one legitimate overdraft (Assumption 5)", async () => {
      const cleoId = await createProfile("Cleo overdraft");
      const taskId = await createTask(10);
      const resolutionId = await complete(taskId, cleoId);
      // Spent to exactly zero: an adjustment of -10 against 10 is affordable.
      await give(cleoId, -10);
      expect(await balanceOf(cleoId)).toBe(0);

      await unresolve(resolutionId);

      expect((await entriesOf(cleoId)).map((entry) => [entry.kind, entry.amount])).toEqual([
        ["credit", 10],
        ["adjustment", -10],
        ["retraction", -10],
      ]);
      expect(await balanceOf(cleoId)).toBe(-10);
      expect(await viewBalanceOf(cleoId)).toBe(-10);
    });

    it("'this occurrence' on a completed occurrence is an un-tick: the retraction, then a skip that earns nothing", async () => {
      // The store sequence behind FR-411's second sentence: the single-row
      // delete of the completion (which retracts) and the skip row that
      // replaces it (which credits nothing, FR-406).
      const cleoId = await createProfile("Cleo this");
      const taskId = await createTask(10);
      const resolutionId = await complete(taskId, cleoId);

      await unresolve(resolutionId);
      await complete(taskId, cleoId, { status: "skipped" });

      expect((await entriesOf(cleoId)).map((entry) => [entry.kind, entry.amount])).toEqual([
        ["credit", 10],
        ["retraction", -10],
      ]);
      expect(await balanceOf(cleoId)).toBe(0);
    });

    it("deleting the TASK leaves the credit and writes no retraction — a deleted task's stars stay earned (FR-411)", async () => {
      const cleoId = await createProfile("Cleo task gone");
      const taskId = await createTask(10, "Clean the bathroom");
      const resolutionId = await complete(taskId, cleoId);

      const remove = await admin.schema("family").from("tasks").delete().eq("id", taskId);
      expect(remove.error).toBeNull();
      expect(await count("task_resolutions", "id", resolutionId)).toBe(0);

      const entries = await entriesOf(cleoId);
      expect(entries.map((entry) => [entry.kind, entry.amount])).toEqual([["credit", 10]]);
      // The loose reference and the copied title are what let history outlive the task.
      expect(entries[0]).toMatchObject({
        resolution_id: resolutionId,
        summary: `Clean the bathroom ${fx.run}`,
      });
      expect(await balanceOf(cleoId)).toBe(10);
    });

    it("deleting the credited PROFILE forfeits their entries by cascade, writes no retraction, and SUCCEEDS (FR-443)", async () => {
      // The FK case: the retraction trigger fires on the cascading delete of
      // the Profile's resolutions. Were it to write a retraction for a Profile
      // mid-deletion, the insert would fail its FK and block the delete —
      // so "the delete succeeds" is the whole assertion, and the entries going
      // with the Profile is FR-443.
      const doomedId = await createProfile("Doomed");
      const benId = await createProfile("Ben survives");
      const taskId = await createTask(10);
      const doomedResolution = await complete(taskId, doomedId);
      await complete(taskId, benId);
      expect(await balanceOf(doomedId)).toBe(10);

      const remove = await admin.schema("family").from("categories").delete().eq("id", doomedId);
      expect(remove.error).toBeNull();

      expect(await count("task_resolutions", "id", doomedResolution)).toBe(0);
      expect(await entriesOf(doomedId)).toEqual([]);
      expect(await viewBalanceOf(doomedId)).toBeUndefined();
      // The other Profile's history on the same task is untouched.
      expect((await entriesOf(benId)).map((entry) => [entry.kind, entry.amount])).toEqual([["credit", 10]]);
      expect(await count("tasks", "id", taskId)).toBe(1);
    });
  });

  describe("the ledger's shape: what star_entries and rewards refuse (23514, P0004)", () => {
    it("an entry is never zero, and each kind carries exactly its own references and sign", async () => {
      const cleoId = await createProfile("Cleo shape");
      const today = await householdDay();

      const zero = await insertEntry({
        category_id: cleoId,
        amount: 0,
        kind: "adjustment",
        created_by: anaId,
        entered_on: today,
      });
      expect(zero.error?.code).toBe("23514");

      const creditWithoutSource = await insertEntry({
        category_id: cleoId,
        amount: 5,
        kind: "credit",
        earned_on: RESOLVED_ON,
        entered_on: today,
      });
      expectRefusal(creditWithoutSource.error, "23514", "star_entry_kind_shape");

      const redemptionWithDay = await insertEntry({
        category_id: cleoId,
        amount: -5,
        kind: "redemption",
        redemption_id: randomUUID(),
        earned_on: RESOLVED_ON,
        entered_on: today,
      });
      expectRefusal(redemptionWithDay.error, "23514", "star_entry_kind_shape");

      const negativeCredit = await insertEntry({
        category_id: cleoId,
        amount: -5,
        kind: "credit",
        earned_on: RESOLVED_ON,
        resolution_id: randomUUID(),
        entered_on: today,
      });
      expectRefusal(negativeCredit.error, "23514", "star_entry_sign_shape");

      const unknownKind = await insertEntry({
        category_id: cleoId,
        amount: 5,
        kind: "bonus",
        entered_on: today,
      });
      expect(unknownKind.error?.code).toBe("23514");

      expect(await entriesOf(cleoId)).toEqual([]);
    });

    it("assert_star_adjustment: -500…500, and never below zero (FR-436, P0004)", async () => {
      const cleoId = await createProfile("Cleo adjust");
      const today = await householdDay();

      const tooMany = await adjust([{ category_id: cleoId, amount: 501 }], today);
      expectRefusal(tooMany.error, "23514", "between -500 and 500");
      const tooFew = await adjust([{ category_id: cleoId, amount: -501 }], today);
      expectRefusal(tooFew.error, "23514", "between -500 and 500");

      const overdraw = await adjust([{ category_id: cleoId, amount: -1 }], today);
      expectRefusal(overdraw.error, "P0004", "below zero");
      expect(await entriesOf(cleoId)).toEqual([]);

      expect((await adjust([{ category_id: cleoId, amount: 500 }], today)).error).toBeNull();
      expect((await adjust([{ category_id: cleoId, amount: -500 }], today)).error).toBeNull();
      expect(await balanceOf(cleoId)).toBe(0);
    });

    it("a reward costs 1–500, has a title, and is only ever for a Profile (FR-414, FR-416)", async () => {
      expect((await insertReward({ point_value: 0 })).error?.code).toBe("23514");
      expect((await insertReward({ point_value: 501 })).error?.code).toBe("23514");
      expect((await insertReward({ point_value: 20, name: "x".repeat(121) })).error?.code).toBe("23514");
      expect((await insertReward({ point_value: 20, name: "   " })).error?.code).toBe("23514");
      expect((await insertReward({ point_value: 20, description: "d".repeat(2001) })).error?.code).toBe("23514");
      expect((await insertReward({ point_value: 20, emoji: "e".repeat(17) })).error?.code).toBe("23514");

      const rewardId = await createReward({ pointValue: 20, respawn: true, eligible: [] });
      const asLabel = await insertEligibility(rewardId, labelId);
      expectRefusal(asLabel.error, "23514", "a reward can only be for a Profile");

      const cleoId = await createProfile("Cleo eligible");
      expect((await insertEligibility(rewardId, cleoId)).error).toBeNull();
      // (reward, Profile) is the key: the same Profile cannot be eligible twice.
      expect((await insertEligibility(rewardId, cleoId)).error?.code).toBe("23505");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // T008 — the money rules under the Profile lock (R403)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("assert_redemption: eligibility, the one-time rule and the balance (FR-424, FR-428–FR-430)", () => {
    it("refuses a Profile the reward is not for (P0005) and a reward that is not there (P0002)", async () => {
      const cleoId = await createProfile("Cleo eligible");
      const benId = await createProfile("Ben ineligible");
      await give(benId, 50);
      const rewardId = await createReward({ pointValue: 20, respawn: true, eligible: [cleoId] });

      const ineligible = await redeem(rewardId, benId);
      expectRefusal(ineligible.error, "P0005", "not for this Profile");
      expect(await entriesOf(benId)).toHaveLength(1);

      const missing = await redeem(randomUUID(), benId);
      expectRefusal(missing.error, "P0002", "no such reward");
      expect(await count("redemptions", "category_id", benId)).toBe(0);
    });

    it("one star short is refused with nothing written; exactly the cost succeeds and leaves zero (SC-408)", async () => {
      const cleoId = await createProfile("Cleo short");
      const rewardId = await createReward({ pointValue: 20, respawn: true, eligible: [cleoId] });
      await give(cleoId, 19);

      const short = await redeem(rewardId, cleoId);
      expectRefusal(short.error, "P0007", "not enough stars");
      expect(await count("redemptions", "category_id", cleoId)).toBe(0);
      expect(await balanceOf(cleoId)).toBe(19);

      await give(cleoId, 1);
      const exact = await redeemOk(rewardId, cleoId);
      expect(exact.point_value).toBe(20);
      expect(await balanceOf(cleoId)).toBe(0);
      expect(await viewBalanceOf(cleoId)).toBe(0);
    });

    it("a one-time reward stands once per Profile (P0006); a renewing one redeems again; a reversed one can be redeemed again", async () => {
      const cleoId = await createProfile("Cleo twice");
      await give(cleoId, 40);
      const oneTime = await createReward({ pointValue: 10, respawn: false, eligible: [cleoId], name: "Movie night" });
      const renewing = await createReward({ pointValue: 10, respawn: true, eligible: [cleoId] });

      const first = await redeemOk(oneTime, cleoId);
      const again = await redeem(oneTime, cleoId);
      expectRefusal(again.error, "P0006", "already redeemed");
      expect(await count("redemptions", "reward_id", oneTime)).toBe(1);

      await redeemOk(renewing, cleoId);
      await redeemOk(renewing, cleoId);
      expect(await count("redemptions", "reward_id", renewing)).toBe(2);
      expect(await balanceOf(cleoId)).toBe(10);

      // "Standing" means unreversed: putting the one-time reward back makes it
      // redeemable again (FR-430, FR-431).
      expect((await reverse(first.id)).error).toBeNull();
      expect((await redeem(oneTime, cleoId)).error).toBeNull();
      expect(await balanceOf(cleoId)).toBe(10);
    });

    it("copies the cost, the name and the household day from the reward — never from the caller — and debits once", async () => {
      const cleoId = await createProfile("Cleo copy");
      await give(cleoId, 30);
      const rewardId = await createReward({ pointValue: 20, respawn: true, eligible: [cleoId], name: "Ice cream" });
      const today = await householdDay();

      const { data, error } = await redeem(rewardId, cleoId, {
        point_value: 1,
        reward_name: "Spoofed",
        redeemed_on: "2000-01-01",
        reversed_at: "2000-01-01T00:00:00Z",
        reversed_by: anaId,
      });
      expect(error).toBeNull();
      const row = data as RedemptionRow;
      expect(row).toMatchObject({
        reward_id: rewardId,
        category_id: cleoId,
        point_value: 20,
        reward_name: `Ice cream ${fx.run}`,
        redeemed_on: today,
        redeemed_by: anaId,
        reversed_at: null,
        reversed_by: null,
      });

      const entries = await entriesOf(cleoId);
      expect(entries.map((entry) => [entry.kind, entry.amount])).toEqual([
        ["adjustment", 30],
        ["redemption", -20],
      ]);
      expect(entries[1]).toMatchObject({
        redemption_id: row.id,
        resolution_id: null,
        earned_on: null,
        summary: `Ice cream ${fx.run}`,
        created_by: anaId,
        entered_on: today,
      });
      expect(await balanceOf(cleoId)).toBe(10);
    });

    it("SC-409: two devices redeem one balance in the same second — one row, one debit, one P0007", async () => {
      const cleoId = await createProfile("Cleo raced");
      await give(cleoId, 20);
      const rewardId = await createReward({ pointValue: 20, respawn: true, eligible: [cleoId] });

      // Two connections, one statement each, issued together. The BEFORE INSERT
      // trigger's `for update` on the Profile's row serialises them: the loser
      // re-sums after the winner commits and finds the balance gone.
      const sql =
        "insert into family.redemptions (household_id, reward_id, category_id, redeemed_by) " +
        "values ($1, $2, $3, $4) returning id";
      const params = [householdId, rewardId, cleoId, anaId];
      const [one, two] = await Promise.all([pool.connect(), pool.connect()]);
      let outcomes: PromiseSettledResult<unknown>[];
      try {
        outcomes = await Promise.allSettled([one.query(sql, params), two.query(sql, params)]);
      } finally {
        one.release();
        two.release();
      }

      // Whichever connection won is the pool's business, not the assertion's;
      // a comparator because the default sort stringifies `null` after "P0007".
      const codes = outcomes.map(codeOf).sort((a, b) => (a ?? "").localeCompare(b ?? ""));
      expect(codes).toEqual([null, "P0007"]);
      expect(await count("redemptions", "reward_id", rewardId)).toBe(1);
      expect((await entriesOf(cleoId)).map((entry) => [entry.kind, entry.amount])).toEqual([
        ["adjustment", 20],
        ["redemption", -20],
      ]);
      expect(await balanceOf(cleoId)).toBe(0);
    });
  });

  describe("record_redemption: the refund exactly once, and nothing else may change (FR-431)", () => {
    it("the reversal refunds the stored cost as one entry naming the actor; a second reversal is P0008", async () => {
      const cleoId = await createProfile("Cleo refund");
      await give(cleoId, 20);
      const rewardId = await createReward({ pointValue: 20, respawn: false, eligible: [cleoId], name: "Movie night" });
      const redemption = await redeemOk(rewardId, cleoId);
      expect(await balanceOf(cleoId)).toBe(0);
      const today = await householdDay();

      const { data, error } = await reverse(redemption.id);
      expect(error).toBeNull();
      expect(data as RedemptionRow).toMatchObject({ id: redemption.id, point_value: 20, reversed_by: anaId });
      expect((data as RedemptionRow).reversed_at).not.toBeNull();

      const entries = await entriesOf(cleoId);
      expect(entries.map((entry) => [entry.kind, entry.amount])).toEqual([
        ["adjustment", 20],
        ["redemption", -20],
        ["refund", 20],
      ]);
      expect(entries[2]).toMatchObject({
        redemption_id: redemption.id,
        summary: `Movie night ${fx.run}`,
        created_by: anaId,
        entered_on: today,
        earned_on: null,
      });
      expect(await balanceOf(cleoId)).toBe(20);
      // Kept, marked reversed — never erased (SC-411).
      expect(await count("redemptions", "id", redemption.id)).toBe(1);

      const twice = await reverse(redemption.id);
      expectRefusal(twice.error, "P0008", "already unredeemed");
      expect(await entriesOf(cleoId)).toHaveLength(3);

      // And by index as well as by trigger: a second refund row is unrepresentable.
      const doubledRefund = await insertEntry({
        category_id: cleoId,
        amount: 20,
        kind: "refund",
        redemption_id: redemption.id,
        entered_on: today,
      });
      expectRefusal(doubledRefund.error, "23505", "star_entries_refund_once_idx");
      const doubledDebit = await insertEntry({
        category_id: cleoId,
        amount: -20,
        kind: "redemption",
        redemption_id: redemption.id,
        entered_on: today,
      });
      expectRefusal(doubledDebit.error, "23505", "star_entries_redemption_once_idx");
    });

    it("a redemption is otherwise immutable: any other UPDATE is 23514, and reversed_by needs reversed_at", async () => {
      const cleoId = await createProfile("Cleo immutable");
      await give(cleoId, 20);
      const rewardId = await createReward({ pointValue: 20, respawn: true, eligible: [cleoId] });
      const redemption = await redeemOk(rewardId, cleoId);

      const repriced = await admin
        .schema("family")
        .from("redemptions")
        .update({ point_value: 1 })
        .eq("id", redemption.id)
        .select(REDEMPTION_COLUMNS)
        .single();
      expectRefusal(repriced.error, "23514", "a redemption can only be reversed");

      const halfReversed = await admin
        .schema("family")
        .from("redemptions")
        .update({ reversed_by: anaId })
        .eq("id", redemption.id);
      expectRefusal(halfReversed.error, "23514", "redemption_reversal_shape");

      // A reversal that also changes the cost is refused as a whole.
      const reversedAndRepriced = await reverse(redemption.id, { point_value: 1 });
      expectRefusal(reversedAndRepriced.error, "23514", "a redemption can only be reversed");

      const { rows } = await pool.query<{ point_value: number; reversed_at: string | null }>(
        "select point_value, reversed_at from family.redemptions where id = $1",
        [redemption.id],
      );
      expect(rows[0]).toEqual({ point_value: 20, reversed_at: null });
      expect(await balanceOf(cleoId)).toBe(0);
    });
  });

  describe("a multi-row adjustment is one statement (FR-436, SC-412)", () => {
    it("one Profile that would overdraw refuses the whole write; nothing lands for anyone", async () => {
      const cleoId = await createProfile("Cleo rich");
      const benId = await createProfile("Ben broke");
      await give(cleoId, 10);
      const today = await householdDay();

      const refused = await adjust(
        [
          { category_id: cleoId, amount: -5 },
          { category_id: benId, amount: -5 },
        ],
        today,
      );
      expectRefusal(refused.error, "P0004", "below zero");
      expect(await balanceOf(cleoId)).toBe(10);
      expect(await entriesOf(benId)).toEqual([]);

      const accepted = await adjust(
        [
          { category_id: cleoId, amount: -5 },
          { category_id: benId, amount: 5 },
        ],
        today,
      );
      expect(accepted.error).toBeNull();
      expect(await balanceOf(cleoId)).toBe(5);
      expect(await entriesOf(benId)).toEqual([
        {
          kind: "adjustment",
          amount: 5,
          earned_on: null,
          resolution_id: null,
          redemption_id: null,
          summary: null,
          created_by: anaId,
          entered_on: today,
        },
      ]);
    });
  });

  describe("the cascades, and the view (FR-421, FR-443, SC-419)", () => {
    it("deleting a reward removes its eligibilities and redemptions and leaves the ledger's sum unchanged (FR-421)", async () => {
      const cleoId = await createProfile("Cleo keeps");
      await give(cleoId, 50);
      const rewardId = await createReward({ pointValue: 20, respawn: true, eligible: [cleoId], name: "Ice cream" });
      const redemption = await redeemOk(rewardId, cleoId);
      expect(await balanceOf(cleoId)).toBe(30);

      const remove = await admin.schema("family").from("rewards").delete().eq("id", rewardId);
      expect(remove.error).toBeNull();

      expect(await count("reward_eligibilities", "reward_id", rewardId)).toBe(0);
      expect(await count("redemptions", "reward_id", rewardId)).toBe(0);
      // The debit stays, still saying what it was for: spent stars stay spent.
      const entries = await entriesOf(cleoId);
      expect(entries.map((entry) => [entry.kind, entry.amount])).toEqual([
        ["adjustment", 50],
        ["redemption", -20],
      ]);
      expect(entries[1]).toMatchObject({ redemption_id: redemption.id, summary: `Ice cream ${fx.run}` });
      expect(await balanceOf(cleoId)).toBe(30);
      expect(await viewBalanceOf(cleoId)).toBe(30);
    });

    it("deleting a Profile removes their entries, redemptions and eligibilities; a shared reward stays on the other Profile (SC-419)", async () => {
      const doomedId = await createProfile("Doomed spender");
      const cleoId = await createProfile("Cleo shares");
      await give(doomedId, 30);
      await give(cleoId, 5);
      const shared = await createReward({ pointValue: 20, respawn: false, eligible: [doomedId, cleoId], name: "Ice cream" });
      const theirs = await createReward({ pointValue: 10, respawn: true, eligible: [doomedId] });
      const redemption = await redeemOk(shared, doomedId);

      const remove = await admin.schema("family").from("categories").delete().eq("id", doomedId);
      expect(remove.error).toBeNull();

      expect(await entriesOf(doomedId)).toEqual([]);
      expect(await count("redemptions", "id", redemption.id)).toBe(0);
      expect(await count("reward_eligibilities", "category_id", doomedId)).toBe(0);
      expect(await viewBalanceOf(doomedId)).toBeUndefined();

      // The shared reward survives with the other Profile's eligibility and
      // progress; the reward left for nobody is the ACTION's cleanup (T053),
      // so at the store it simply stands with no eligibility.
      expect(await count("reward_eligibilities", "reward_id", shared)).toBe(1);
      expect(await count("rewards", "id", shared)).toBe(1);
      expect(await count("rewards", "id", theirs)).toBe(1);
      expect(await count("reward_eligibilities", "reward_id", theirs)).toBe(0);
      expect(await viewBalanceOf(cleoId)).toBe(5);
    });

    it("star_balances: one row per Profile, none per Label, 0 with no entries (FR-412, FR-414)", async () => {
      const householdC = await insertHousehold(pool, `test-${fx.run}-rewards-schema-balances`);
      const quiet = await insertCategory(pool, { householdId: householdC, label: `Quiet ${fx.run}`, color: "#B6E085" });
      const busy = await insertCategory(pool, { householdId: householdC, label: `Busy ${fx.run}`, color: "#FDC36D" });
      const label = await insertCategory(pool, {
        householdId: householdC,
        label: `Chores ${fx.run}`,
        color: "#2178AF",
        isProfile: false,
      });
      await pool.query(
        "insert into family.star_entries (household_id, category_id, amount, kind, entered_on) " +
          "values ($1, $2, 7, 'adjustment', current_date), ($1, $2, -2, 'adjustment', current_date)",
        [householdC, busy],
      );

      const { rows } = await pool.query<{ category_id: string; balance: number }>(
        "select category_id, balance from family.star_balances where household_id = $1 order by balance",
        [householdC],
      );
      expect(rows).toEqual([
        { category_id: quiet, balance: 0 },
        { category_id: busy, balance: 5 },
      ]);
      expect(rows.some((row) => row.category_id === label)).toBe(false);

      await deleteHousehold(pool, householdC);
    });
  });
});
