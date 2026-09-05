/**
 * T029 — the three reward verbs (004 contracts/server-actions.md §Rewards):
 * FR-419's parent-only create, edit and delete; FR-415's six fields and its
 * "at least one eligible Profile"; FR-414's Profiles-only eligibility; FR-418's
 * edit of every field, eligibilities included, and its confirmed, irreversible
 * delete; FR-420's rule that a cost edit moves every bar and no redemption;
 * FR-421's rule that a deleted reward's redemptions leave the ledger's sum
 * where it was.
 *
 * Same plumbing as `task-box.test.ts` — Next's cookie store is an in-memory
 * jar, the request's Supabase session is a real signed-in client, and
 * everything else (the guards, the signed actor cookie, the admin client, RLS,
 * the triggers of 024–026) is production code. **Every call here bypasses the
 * interface by construction**: there is no form and no button in this file, so
 * the member rows below are FR-419's "not only by hiding the controls" proof.
 *
 * Covered here:
 *   - nobody punched in → `NO_ACTOR` on all three, nothing written;
 *   - a punched-in **member** → `FORBIDDEN` on all three, and the refusal is
 *     the DATABASE role — the same call succeeds as a parent;
 *   - create stores the six fields with ONE eligibility row per Profile,
 *     attributed to the punch-in (FR-415); no eligible Profile is `VALIDATION`
 *     against `categoryIds`; a Label is `VALIDATION` against `categoryIds` with
 *     no reward row left behind (FR-414); a Profile of another household is
 *     `NOT_FOUND`; a cost outside 1–500 and a key the form does not send are
 *     `VALIDATION` (FR-416, FR-442);
 *   - edit rewrites the eligibilities as a SET DIFFERENCE — a surviving
 *     Profile's link row is the same row (its `created_at` does not move) and
 *     their standing redemption is untouched (FR-418); changing the cost
 *     changes no redemption's stored cost and no ledger row (FR-420, FR-428);
 *     the merged shape refuses an emptied list, a Label and an invented key;
 *   - delete needs `confirm: true` (FR-418); with it the reward, its
 *     eligibilities and its redemptions go and the ledger's sum does not — the
 *     debit row keeps the reward's name by copy, not by link (FR-421, FR-411);
 *   - an id in another household is `NOT_FOUND` and never `FORBIDDEN`, on the
 *     edit and the delete path alike (FR-442).
 *
 * T039 (redeem / unredeem) and T045 (adjustStars) extend this file.
 *
 * Fixture rows live in run-tagged households of this file's own, never in the
 * seed, so nothing here can drift with — or damage — the seeded tab.
 *
 * RED by design until `lib/family/actions/rewards.ts` lands: `verb()` throws
 * by name for every export that does not exist yet.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { Reward } from "@/lib/family/types";
import {
  LOCAL,
  adminClient,
  createPool,
  createUsers,
  deleteHousehold,
  deleteUsers,
  fixtures,
  insertCategory,
  insertHousehold,
  testEmail,
  userClient,
  type FixtureUser,
} from "./helpers";

// Hoisted: the mock factories below run before any import is evaluated.
const state = vi.hoisted(() => ({
  /** Name → value, exactly what the browser would send back on the next request. */
  cookies: new Map<string, string>(),
  /** The signed-in Supabase session this "request" carries. */
  client: null as SupabaseClient | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));
vi.mock("next/headers", () => {
  const read = (name: string) => {
    const value = state.cookies.get(name);
    return value === undefined ? undefined : { name, value };
  };
  const jar = {
    get: read,
    getAll: () => [...state.cookies].map(([name, value]) => ({ name, value })),
    has: (name: string) => state.cookies.has(name),
    set(name: string, value: string, options?: { maxAge?: number }) {
      if (options?.maxAge === 0) state.cookies.delete(name);
      else state.cookies.set(name, value);
      return jar;
    },
    delete(name: string) {
      state.cookies.delete(name);
      return jar;
    },
  };
  return { cookies: async () => jar, headers: async () => new Headers() };
});
vi.mock("@/lib/family/supabase/server", () => ({
  createClient: async () => {
    if (!state.client) throw new Error("rewards-actions.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");

/* ------------------------------------------------------------------------- *
 * The surface T029 must export (contracts/server-actions.md §Rewards).
 * Restated here rather than imported, so the payload shapes this suite pins
 * are the CONTRACT's and not whatever the implementation happens to accept.
 * ------------------------------------------------------------------------- */

interface RewardInputPayload {
  name: string;
  description?: string | null;
  emoji?: string | null;
  pointValue: number;
  respawnOnRedemption: boolean;
  categoryIds: string[];
}

interface UpdateRewardPayload {
  id: string;
  patch: Partial<RewardInputPayload>;
}

interface DeleteRewardPayload {
  id: string;
  confirm: boolean;
}

interface RewardsModule {
  createReward(input: RewardInputPayload): Promise<ActionResult<Reward>>;
  updateReward(input: UpdateRewardPayload): Promise<ActionResult<Reward>>;
  deleteReward(input: DeleteRewardPayload): Promise<ActionResult<null>>;
}

// Joined at runtime so `tsc` stays clean while the three verbs do not exist;
// Vitest resolves the `@` alias when the import actually runs.
const REWARDS_MODULE = ["@", "lib", "family", "actions", "rewards"].join("/");
const rewards = (await import(REWARDS_MODULE)) as Partial<RewardsModule>;

/** Names the missing export, so a RED run says which task has not landed yet. */
function verb<K extends keyof RewardsModule>(name: K): NonNullable<Partial<RewardsModule>[K]> {
  const fn = rewards[name];
  if (fn === undefined) {
    throw new Error(`lib/family/actions/rewards.ts does not export ${name} yet (T029)`);
  }
  return fn;
}

function createReward(input: RewardInputPayload): Promise<ActionResult<Reward>> {
  return verb("createReward")(input);
}

function updateReward(input: UpdateRewardPayload): Promise<ActionResult<Reward>> {
  return verb("updateReward")(input);
}

function deleteReward(input: DeleteRewardPayload): Promise<ActionResult<null>> {
  return verb("deleteReward")(input);
}

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

function expectFailure(result: ActionResult<unknown>, code: ActionError): string {
  expect(result).toMatchObject({ ok: false, error: code });
  return result.ok ? "" : result.message;
}

/** A refusal names the field, so the form can preserve everything else. */
function expectFieldError(result: ActionResult<unknown>, field: string): void {
  expect(result).toMatchObject({ ok: false, error: "VALIDATION" });
  expect(Object.keys(result.ok ? {} : (result.fieldErrors ?? {}))).toContain(field);
}

const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000ff";

/** The reward every test starts from: one-time, costs 5. */
const TREAT_COST = 5;
/** Enough for one redemption with change: the balance afterwards is 5. */
const STARS_GIVEN = 10;

interface StoredReward {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  point_value: number;
  respawn_on_redemption: boolean;
  created_by: string | null;
  updated_by: string | null;
}

interface StoredEligibility {
  category_id: string;
  created_at: string;
}

interface StoredRedemption {
  id: string;
  reward_id: string;
  category_id: string;
  point_value: number;
  reward_name: string;
  reversed_at: string | null;
}

interface StoredEntry {
  kind: string;
  amount: number;
  redemption_id: string | null;
  summary: string | null;
}

/** Rewards with their eligibility sets — what "nothing is written" compares. */
interface RewardSnapshot {
  reward: StoredReward;
  categoryIds: string[];
}

describe("rewards: FR-419's parent-only verbs, FR-415's fields, FR-418/420/421's edits and deletes (T029)", () => {
  const fx = fixtures();
  const run = fx.run;
  const ANA_PIN = "7171";
  const BEA_PIN = "7272";
  const CLEO_PIN = "7373";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  /** The parent who creates everything. */
  let anaId: string;
  /** A second parent, so `updated_by` can be seen to move off `created_by`. */
  let beaId: string;
  /** A member — FR-419's refusal target on all three verbs, and the one who redeems. */
  let cleoId: string;
  /** A Label — FR-414: never eligible. */
  let choresLabelId: string;
  /** A Profile of the other household — never reachable from this one. */
  let foreignProfileId: string;
  let foreignRewardId: string;

  /** Re-seeded before every test: ids change, shape does not. Eligible: Bea and Cleo. */
  let treatRewardId: string;

  async function insertReward(
    targetHouseholdId: string,
    seed: { name: string; pointValue?: number; respawn?: boolean; categoryIds: string[] },
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.rewards (household_id, name, point_value, respawn_on_redemption, created_by, updated_by) " +
        "values ($1, $2, $3, $4, $5, $5) returning id",
      [
        targetHouseholdId,
        seed.name,
        seed.pointValue ?? TREAT_COST,
        seed.respawn ?? false,
        targetHouseholdId === householdId ? anaId : null,
      ],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.rewards returned no row");
    for (const categoryId of seed.categoryIds) {
      await pool.query(
        "insert into family.reward_eligibilities (household_id, reward_id, category_id) values ($1, $2, $3)",
        [targetHouseholdId, row.id, categoryId],
      );
    }
    return row.id;
  }

  /** A hand adjustment as `postgres`: the balance the redemption below spends from. */
  async function giveStars(profileId: string, amount: number): Promise<void> {
    await pool.query(
      "insert into family.star_entries (household_id, category_id, amount, kind, created_by, entered_on) " +
        "values ($1, $2, $3, 'adjustment', $4, current_date)",
      [householdId, profileId, amount, anaId],
    );
  }

  /** A redemption as `postgres` — 026's trigger copies cost, name and day and writes the debit. */
  async function redeem(rewardId: string, profileId: string): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.redemptions (household_id, reward_id, category_id, redeemed_by) " +
        "values ($1, $2, $3, $3) returning id",
      [householdId, rewardId, profileId],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.redemptions returned no row");
    return row.id;
  }

  async function storedRewards(targetHouseholdId = householdId): Promise<StoredReward[]> {
    const { rows } = await pool.query<StoredReward>(
      "select id, name, description, emoji, point_value, respawn_on_redemption, created_by, updated_by " +
        "from family.rewards where household_id = $1 order by name",
      [targetHouseholdId],
    );
    return rows;
  }

  async function storedReward(id: string): Promise<StoredReward | undefined> {
    return (await storedRewards()).find((row) => row.id === id);
  }

  async function storedEligibilities(rewardId: string): Promise<StoredEligibility[]> {
    const { rows } = await pool.query<StoredEligibility>(
      "select category_id, created_at::text as created_at from family.reward_eligibilities " +
        "where reward_id = $1 order by category_id",
      [rewardId],
    );
    return rows;
  }

  async function eligibleIds(rewardId: string): Promise<string[]> {
    return (await storedEligibilities(rewardId)).map((row) => row.category_id);
  }

  async function storedRedemption(id: string): Promise<StoredRedemption | undefined> {
    const { rows } = await pool.query<StoredRedemption>(
      "select id, reward_id, category_id, point_value, reward_name, reversed_at::text as reversed_at " +
        "from family.redemptions where id = $1",
      [id],
    );
    return rows[0];
  }

  async function storedEntries(): Promise<StoredEntry[]> {
    const { rows } = await pool.query<StoredEntry>(
      "select kind, amount, redemption_id, summary from family.star_entries " +
        "where household_id = $1 order by created_at, kind",
      [householdId],
    );
    return rows;
  }

  async function ledgerSum(): Promise<number> {
    const { rows } = await pool.query<{ sum: number }>(
      "select coalesce(sum(amount), 0)::integer as sum from family.star_entries where household_id = $1",
      [householdId],
    );
    return rows[0]?.sum ?? 0;
  }

  async function snapshot(): Promise<RewardSnapshot[]> {
    const rows = await storedRewards();
    const out: RewardSnapshot[] = [];
    for (const reward of rows) out.push({ reward, categoryIds: await eligibleIds(reward.id) });
    return out;
  }

  /** Setup only: the action-level PIN path is Phase 1's suite's job. */
  async function givePin(profileId: string, pin: string): Promise<void> {
    const { error } = await admin
      .schema("family")
      .rpc("set_pin", { p_user_id: user.id, p_profile: profileId, p_pin: pin });
    if (error) throw error;
  }

  async function punchInAs(profileId: string, pin: string): Promise<void> {
    state.cookies.clear();
    expectOk(await punchIn(profileId, pin));
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-rewards-actions`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-rewards-actions-other`);
    await pool.query(
      "update family.household_settings set timezone = $1 where household_id = $2",
      ["America/Chicago", householdId],
    );

    const email = testEmail("rewards-actions", run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      email,
    ]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error("expected one fixture account");
    user = created;

    anaId = await insertCategory(pool, {
      householdId,
      label: `Ana ${run}`,
      color: "#2178AF",
      role: "parent",
    });
    beaId = await insertCategory(pool, {
      householdId,
      label: `Bea ${run}`,
      color: "#FBD97E",
      role: "parent",
    });
    cleoId = await insertCategory(pool, { householdId, label: `Cleo ${run}`, color: "#B6E085" });
    choresLabelId = await insertCategory(pool, {
      householdId,
      label: `Chores ${run}`,
      color: "#F66951",
      isProfile: false,
    });
    foreignProfileId = await insertCategory(pool, {
      householdId: otherHouseholdId,
      label: `Other kid ${run}`,
      color: "#B6E085",
    });
    foreignRewardId = await insertReward(otherHouseholdId, {
      name: `Foreign ${run}`,
      categoryIds: [foreignProfileId],
    });

    // Binds the allowlist row to the account, exactly as the first sign-in does.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(anaId, ANA_PIN);
    await givePin(beaId, BEA_PIN);
    await givePin(cleoId, CLEO_PIN);
  });

  beforeEach(async () => {
    // Eligibilities and redemptions cascade with the reward; entries never do.
    await pool.query("delete from family.rewards where household_id = $1", [householdId]);
    await pool.query("delete from family.star_entries where household_id = $1", [householdId]);
    treatRewardId = await insertReward(householdId, {
      name: `Ice cream ${run}`,
      categoryIds: [beaId, cleoId],
    });
    state.cookies.clear();
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteHousehold(pool, otherHouseholdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  /** The three verbs behind one name, so "every verb refuses X" is written once. */
  async function everyRewardVerb(): Promise<ActionResult<unknown>[]> {
    return [
      await createReward({
        name: `Refused ${run}`,
        pointValue: 3,
        respawnOnRedemption: false,
        categoryIds: [cleoId],
      }),
      await updateReward({ id: treatRewardId, patch: { name: `Refused ${run}` } }),
      await deleteReward({ id: treatRewardId, confirm: true }),
    ];
  }

  describe("with nobody punched in every verb is NO_ACTOR", () => {
    it("create, edit and delete are all refused and nothing is written", async () => {
      const before = await snapshot();
      for (const result of await everyRewardVerb()) expectFailure(result, "NO_ACTOR");
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("a punched-in MEMBER is refused every reward verb (FR-419)", () => {
    beforeEach(async () => {
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("createReward, updateReward and deleteReward are FORBIDDEN and nothing is written", async () => {
      const before = await snapshot();
      for (const result of await everyRewardVerb()) expectFailure(result, "FORBIDDEN");
      expect(await snapshot()).toEqual(before);
    });

    it("the refusal is the DATABASE role, not the cookie's: the same call succeeds as a parent", async () => {
      const input = {
        name: `Movie night ${run}`,
        pointValue: 20,
        respawnOnRedemption: true,
        categoryIds: [cleoId],
      };
      expectFailure(await createReward(input), "FORBIDDEN");
      await punchInAs(anaId, ANA_PIN);
      expectOk(await createReward(input));
      expect((await storedRewards()).map((row) => row.name)).toContain(`Movie night ${run}`);
    });
  });

  describe("create holds the six fields and one eligibility per Profile (FR-415, FR-416)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("stores every field, one link row per Profile, attributed to the punch-in", async () => {
      const reward = expectOk(
        await createReward({
          name: `Bake cookies ${run}`,
          description: "With sprinkles",
          emoji: "🍪",
          pointValue: 25,
          respawnOnRedemption: true,
          categoryIds: [cleoId, beaId],
        }),
      );
      expect(reward).toMatchObject({
        householdId,
        name: `Bake cookies ${run}`,
        description: "With sprinkles",
        emoji: "🍪",
        pointValue: 25,
        respawnOnRedemption: true,
        createdBy: anaId,
        updatedBy: anaId,
      });
      // Pinned order (`toReward`), not the order the payload happened to carry.
      expect(reward.categoryIds).toEqual([cleoId, beaId].sort());

      expect(await storedReward(reward.id)).toMatchObject({
        name: `Bake cookies ${run}`,
        description: "With sprinkles",
        emoji: "🍪",
        point_value: 25,
        respawn_on_redemption: true,
        created_by: anaId,
        updated_by: anaId,
      });
      expect(await eligibleIds(reward.id)).toEqual([cleoId, beaId].sort());
    });

    it("a description and an emoji are optional and store NULL; renew defaults to nothing", async () => {
      const reward = expectOk(
        await createReward({
          name: `Stay up late ${run}`,
          pointValue: 1,
          respawnOnRedemption: false,
          categoryIds: [cleoId],
        }),
      );
      expect(reward.description).toBeNull();
      expect(reward.emoji).toBeNull();
      expect(reward.respawnOnRedemption).toBe(false);
      expect(await storedReward(reward.id)).toMatchObject({
        description: null,
        emoji: null,
        respawn_on_redemption: false,
      });
    });

    it("no eligible Profile is VALIDATION against `categoryIds`, and nothing is stored (FR-415)", async () => {
      const before = await snapshot();
      expectFieldError(
        await createReward({
          name: `Nobody ${run}`,
          pointValue: 5,
          respawnOnRedemption: false,
          categoryIds: [],
        }),
        "categoryIds",
      );
      // The same Profile twice is not two Profiles.
      expectFieldError(
        await createReward({
          name: `Twice ${run}`,
          pointValue: 5,
          respawnOnRedemption: false,
          categoryIds: [cleoId, cleoId],
        }),
        "categoryIds",
      );
      expect(await snapshot()).toEqual(before);
    });

    it("a Label is VALIDATION against `categoryIds`, and NO reward row is left behind (FR-414)", async () => {
      const before = await snapshot();
      expectFieldError(
        await createReward({
          name: `For a label ${run}`,
          pointValue: 5,
          respawnOnRedemption: false,
          categoryIds: [cleoId, choresLabelId],
        }),
        "categoryIds",
      );
      // The check runs BEFORE the reward row is written: a refused create must
      // not leave a reward eligible for nobody (data-model invariant 7).
      expect(await snapshot()).toEqual(before);
    });

    it("a Profile of another household is NOT_FOUND, and nothing is stored (FR-442)", async () => {
      const before = await snapshot();
      expectFailure(
        await createReward({
          name: `Reached ${run}`,
          pointValue: 5,
          respawnOnRedemption: false,
          categoryIds: [cleoId, foreignProfileId],
        }),
        "NOT_FOUND",
      );
      expectFailure(
        await createReward({
          name: `Unknown ${run}`,
          pointValue: 5,
          respawnOnRedemption: false,
          categoryIds: [UNKNOWN_ID],
        }),
        "NOT_FOUND",
      );
      expect(await snapshot()).toEqual(before);
    });

    it("a cost of 0 or 501, a blank title, and a key the form never sends are VALIDATION (FR-416)", async () => {
      const before = await snapshot();
      for (const pointValue of [0, 501, 2.5]) {
        expectFieldError(
          await createReward({
            name: `Priced wrong ${run}`,
            pointValue,
            respawnOnRedemption: false,
            categoryIds: [cleoId],
          }),
          "pointValue",
        );
      }
      expectFieldError(
        await createReward({
          name: "   ",
          pointValue: 5,
          respawnOnRedemption: false,
          categoryIds: [cleoId],
        }),
        "name",
      );
      // Progress is derived (FR-420); a balance, a counter or a redemption date
      // in the payload is refused rather than stripped.
      for (const extra of [{ balance: 10 }, { progress: 3 }, { redeemedAt: "2026-09-05" }]) {
        expectFailure(
          await createReward({
            name: `Invented ${run}`,
            pointValue: 5,
            respawnOnRedemption: false,
            categoryIds: [cleoId],
            ...extra,
          } as RewardInputPayload),
          "VALIDATION",
        );
      }
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("edit changes every field and rewrites eligibilities as a set difference (FR-418, FR-420)", () => {
    beforeEach(async () => {
      await punchInAs(beaId, BEA_PIN);
    });

    it("changes the title, the cost and the switch, and moves `updated_by` to the editor", async () => {
      const reward = expectOk(
        await updateReward({
          id: treatRewardId,
          patch: {
            name: `Gelato ${run}`,
            emoji: "🍨",
            pointValue: 50,
            respawnOnRedemption: true,
          },
        }),
      );
      expect(reward).toMatchObject({
        id: treatRewardId,
        name: `Gelato ${run}`,
        emoji: "🍨",
        pointValue: 50,
        respawnOnRedemption: true,
        createdBy: anaId,
        updatedBy: beaId,
      });
      expect(reward.categoryIds).toEqual([beaId, cleoId].sort());
      expect(await storedReward(treatRewardId)).toMatchObject({
        name: `Gelato ${run}`,
        emoji: "🍨",
        point_value: 50,
        respawn_on_redemption: true,
        created_by: anaId,
        updated_by: beaId,
      });
    });

    it("a patch of another field keeps the eligible Profiles, and a description can be cleared", async () => {
      await pool.query("update family.rewards set description = $1 where id = $2", [
        "Two scoops",
        treatRewardId,
      ]);
      const kept = expectOk(await updateReward({ id: treatRewardId, patch: { pointValue: 6 } }));
      expect(kept.description).toBe("Two scoops");
      expect(kept.categoryIds).toEqual([beaId, cleoId].sort());
      expect(await eligibleIds(treatRewardId)).toEqual([beaId, cleoId].sort());

      const cleared = expectOk(
        await updateReward({ id: treatRewardId, patch: { description: null } }),
      );
      expect(cleared.description).toBeNull();
      expect((await storedReward(treatRewardId))?.description).toBeNull();
    });

    it("removes and adds Profiles as a set difference: the survivor's link row and standing redemption stay", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      const redemptionId = await redeem(treatRewardId, cleoId);
      const [beforeLink] = (await storedEligibilities(treatRewardId)).filter(
        (row) => row.category_id === cleoId,
      );
      expect(beforeLink).toBeDefined();

      // Bea out, Ana in; Cleo survives.
      const reward = expectOk(
        await updateReward({ id: treatRewardId, patch: { categoryIds: [cleoId, anaId] } }),
      );
      expect(reward.categoryIds).toEqual([cleoId, anaId].sort());

      const links = await storedEligibilities(treatRewardId);
      expect(links.map((row) => row.category_id)).toEqual([cleoId, anaId].sort());
      // The SAME row, not a delete-and-reinsert: its timestamp did not move.
      expect(links.find((row) => row.category_id === cleoId)?.created_at).toBe(
        beforeLink?.created_at,
      );
      // Cleo's redemption is still standing, at the cost it was made at.
      expect(await storedRedemption(redemptionId)).toMatchObject({
        reward_id: treatRewardId,
        category_id: cleoId,
        point_value: TREAT_COST,
        reversed_at: null,
      });
      expect(await ledgerSum()).toBe(STARS_GIVEN - TREAT_COST);
    });

    it("changing the cost changes no redemption's stored cost and no ledger row (FR-420, FR-428)", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      const redemptionId = await redeem(treatRewardId, cleoId);
      const entriesBefore = await storedEntries();

      const reward = expectOk(
        await updateReward({ id: treatRewardId, patch: { pointValue: 50 } }),
      );
      expect(reward.pointValue).toBe(50);
      expect((await storedReward(treatRewardId))?.point_value).toBe(50);

      // What was spent stays what was spent: the redemption and the debit.
      expect((await storedRedemption(redemptionId))?.point_value).toBe(TREAT_COST);
      expect(await storedEntries()).toEqual(entriesBefore);
      expect(await ledgerSum()).toBe(STARS_GIVEN - TREAT_COST);
    });

    it("emptying the eligible Profiles, or naming a Label, is VALIDATION against `categoryIds` and nothing changes", async () => {
      const before = await snapshot();
      expectFieldError(
        await updateReward({ id: treatRewardId, patch: { categoryIds: [] } }),
        "categoryIds",
      );
      expectFieldError(
        await updateReward({ id: treatRewardId, patch: { categoryIds: [cleoId, choresLabelId] } }),
        "categoryIds",
      );
      expect(await snapshot()).toEqual(before);
    });

    it("a Profile of another household in the patch is NOT_FOUND and nothing changes (FR-442)", async () => {
      const before = await snapshot();
      expectFailure(
        await updateReward({ id: treatRewardId, patch: { categoryIds: [cleoId, foreignProfileId] } }),
        "NOT_FOUND",
      );
      expect(await snapshot()).toEqual(before);
    });

    it("a cost outside 1–500, a blank title and an invented key are VALIDATION and nothing changes", async () => {
      const before = await snapshot();
      expectFieldError(
        await updateReward({ id: treatRewardId, patch: { pointValue: 0 } }),
        "pointValue",
      );
      expectFieldError(
        await updateReward({ id: treatRewardId, patch: { pointValue: 501 } }),
        "pointValue",
      );
      expectFieldError(await updateReward({ id: treatRewardId, patch: { name: " " } }), "name");
      expectFailure(
        await updateReward({
          id: treatRewardId,
          patch: { redeemedAt: "2026-09-05" } as Partial<RewardInputPayload>,
        }),
        "VALIDATION",
      );
      expect(await snapshot()).toEqual(before);
    });

    it("a reward in another household is NOT_FOUND, never FORBIDDEN (FR-442)", async () => {
      expectFailure(
        await updateReward({ id: foreignRewardId, patch: { name: `Reached ${run}` } }),
        "NOT_FOUND",
      );
      expectFailure(await updateReward({ id: UNKNOWN_ID, patch: {} }), "NOT_FOUND");

      const [foreign] = await storedRewards(otherHouseholdId);
      expect(foreign?.name).toBe(`Foreign ${run}`);
      expect(await eligibleIds(foreignRewardId)).toEqual([foreignProfileId]);
    });
  });

  describe("delete is confirmed, permanent, and leaves the ledger's sum alone (FR-418, FR-421)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("without `confirm: true` it is VALIDATION and the reward survives", async () => {
      const before = await snapshot();
      expectFailure(await deleteReward({ id: treatRewardId, confirm: false }), "VALIDATION");
      expectFailure(
        await deleteReward({ id: treatRewardId } as DeleteRewardPayload),
        "VALIDATION",
      );
      expect(await snapshot()).toEqual(before);
    });

    it("with `confirm: true` the reward, its eligibilities and its redemptions go — and the ledger's sum does not", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      const redemptionId = await redeem(treatRewardId, cleoId);
      expect(await ledgerSum()).toBe(STARS_GIVEN - TREAT_COST);
      const otherRewardId = await insertReward(householdId, {
        name: `Neighbour ${run}`,
        categoryIds: [beaId],
      });

      expect(expectOk(await deleteReward({ id: treatRewardId, confirm: true }))).toBeNull();

      expect((await storedRewards()).map((row) => row.id)).toEqual([otherRewardId]);
      expect(await eligibleIds(treatRewardId)).toEqual([]);
      expect(await eligibleIds(otherRewardId)).toEqual([beaId]);
      expect(await storedRedemption(redemptionId)).toBeUndefined();

      // FR-421 / FR-411: the debit stays, naming the reward by copy and the
      // redemption by a reference no cascade follows; the balance is unchanged.
      expect(await storedEntries()).toEqual([
        { kind: "adjustment", amount: STARS_GIVEN, redemption_id: null, summary: null },
        {
          kind: "redemption",
          amount: -TREAT_COST,
          redemption_id: redemptionId,
          summary: `Ice cream ${run}`,
        },
      ]);
      expect(await ledgerSum()).toBe(STARS_GIVEN - TREAT_COST);
    });

    it("a reward in another household is NOT_FOUND and survives; so is an unknown id (FR-442)", async () => {
      expectFailure(await deleteReward({ id: foreignRewardId, confirm: true }), "NOT_FOUND");
      expectFailure(await deleteReward({ id: UNKNOWN_ID, confirm: true }), "NOT_FOUND");

      const [foreign] = await storedRewards(otherHouseholdId);
      expect(foreign?.id).toBe(foreignRewardId);
      expect(await eligibleIds(foreignRewardId)).toEqual([foreignProfileId]);
    });
  });
});
