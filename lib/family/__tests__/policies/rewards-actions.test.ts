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
 * T039 — `redeemReward` and `unredeemReward` (contracts §Redeeming), FR-424's
 * target rule and 026's money rules, every call again off-interface:
 *   - nobody punched in → `NO_ACTOR`, nothing written;
 *   - a **member** redeems only for themselves; for anyone else it is
 *     `FORBIDDEN` naming whose reward it is and that a parent may do it; a
 *     **parent** redeems for any eligible Profile and the row names both; a
 *     parent **demoted** on another device is refused at once (R323);
 *   - the insert carries the reward, the Profile and the punch-in and NOTHING
 *     else: the strict shape refuses a cost, a name or a day, and the row
 *     copies the STORED cost, the name and the household day (FR-428, FR-433);
 *   - `P0005` (not eligible) → `FORBIDDEN`, `P0006` (one-time, standing) and
 *     `P0007` (short) → `CONFLICT`, each with the contract's words; exactly the
 *     cost is enough (SC-408); a renewing reward redeems again from what is
 *     left (FR-430); `P0002` and a foreign or absent Profile → `NOT_FOUND`;
 *   - SC-409 as two concurrent calls: one row, one debit, one `CONFLICT`;
 *   - unredeem marks the row reversed and writes the refund exactly once
 *     (`P0008` → `CONFLICT`), under the same target rule on the redemption's
 *     Profile, and the one-time reward is redeemable again (FR-431);
 *   - both push the punch-in's idle expiry forward on success (FR-013).
 *
 * T045 — `adjustStars` (contracts §Giving stars by hand, FR-434–FR-436,
 * SC-412), every call off-interface once more:
 *   - nobody punched in → `NO_ACTOR`; a **member** → `FORBIDDEN`, the same
 *     call succeeding as a parent; a parent **demoted** elsewhere → `FORBIDDEN`
 *     (FR-435, R323) — and nothing written on any of them;
 *   - a parent gives two Profiles the same amount in ONE statement: one
 *     `adjustment` row each, `summary` null, `created_by` the punch-in,
 *     `entered_on` the HOUSEHOLD day, no occurrence and no redemption on the
 *     row; the answer is the resulting `star_balances` rows for exactly the
 *     chosen Profiles, in id order (FR-436, SC-412);
 *   - a negative amount takes stars away, and exactly to zero is allowed;
 *   - an amount that would leave any chosen Profile below zero is `VALIDATION`
 *     against `amount`, naming the FIRST such Profile in id order — and NOTHING
 *     is written for ANY of them, the one who could afford it included
 *     (`P0004`, FR-436, SC-412);
 *   - `0`, `501`, `−501`, a fraction and an invented key are `VALIDATION`
 *     against `amount` / the shape; an empty list, a repeat and a Label are
 *     `VALIDATION` against `categoryIds`; a Profile of another household and
 *     an unknown id are `NOT_FOUND` — nothing written on any (FR-442);
 *   - a success pushes the punch-in's idle expiry forward; a refusal does not.
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

import { signActorToken } from "@/lib/family/actor-token";
import { localDateOf } from "@/lib/family/calendar/dates";
import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { Redemption, Reward, Role, StarBalance } from "@/lib/family/types";
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

interface RedeemRewardPayload {
  rewardId: string;
  categoryId: string;
}

interface UnredeemRewardPayload {
  redemptionId: string;
}

interface AdjustStarsPayload {
  categoryIds: string[];
  amount: number;
}

interface RewardsModule {
  createReward(input: RewardInputPayload): Promise<ActionResult<Reward>>;
  updateReward(input: UpdateRewardPayload): Promise<ActionResult<Reward>>;
  deleteReward(input: DeleteRewardPayload): Promise<ActionResult<null>>;
  redeemReward(input: RedeemRewardPayload): Promise<ActionResult<Redemption>>;
  unredeemReward(input: UnredeemRewardPayload): Promise<ActionResult<Redemption>>;
  adjustStars(input: AdjustStarsPayload): Promise<ActionResult<StarBalance[]>>;
}

// Joined at runtime so `tsc` stays clean while a verb does not exist yet;
// Vitest resolves the `@` alias when the import actually runs.
const REWARDS_MODULE = ["@", "lib", "family", "actions", "rewards"].join("/");
const rewards = (await import(REWARDS_MODULE)) as Partial<RewardsModule>;

/** Names the missing export, so a RED run says which task has not landed yet. */
function verb<K extends keyof RewardsModule>(name: K): NonNullable<Partial<RewardsModule>[K]> {
  const fn = rewards[name];
  if (fn === undefined) {
    throw new Error(`lib/family/actions/rewards.ts does not export ${name} yet`);
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

function redeemReward(input: RedeemRewardPayload): Promise<ActionResult<Redemption>> {
  return verb("redeemReward")(input);
}

function unredeemReward(input: UnredeemRewardPayload): Promise<ActionResult<Redemption>> {
  return verb("unredeemReward")(input);
}

function adjustStars(input: AdjustStarsPayload): Promise<ActionResult<StarBalance[]>> {
  return verb("adjustStars")(input);
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
/** The fixture household's zone — every `redeemedOn` is judged in it (FR-433). */
const ZONE = "America/Chicago";
/** The punch-in cookie, and a life short enough that a touch is visible as `exp` moving. */
const ACTOR_COOKIE = "family_actor";
const SHORT_TTL_SECONDS = 90;

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

/** One hand adjustment as stored — every column FR-436 fixes, and the three it forbids. */
interface StoredAdjustment {
  category_id: string;
  amount: number;
  summary: string | null;
  created_by: string | null;
  entered_on: string;
  earned_on: string | null;
  resolution_id: string | null;
  redemption_id: string | null;
  /** `now()` is the transaction's: rows of ONE statement share it to the microsecond. */
  created_at: string;
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

  async function storedRedemptionsFor(rewardId: string): Promise<StoredRedemption[]> {
    const { rows } = await pool.query<StoredRedemption>(
      "select id, reward_id, category_id, point_value, reward_name, reversed_at::text as reversed_at " +
        "from family.redemptions where reward_id = $1 order by redeemed_at",
      [rewardId],
    );
    return rows;
  }

  /** The derived balance (025's view) — what every bar and every refusal is judged against. */
  async function balanceOf(profileId: string): Promise<number> {
    const { rows } = await pool.query<{ balance: number }>(
      "select balance from family.star_balances where category_id = $1",
      [profileId],
    );
    return rows[0]?.balance ?? 0;
  }

  /** A standing redemption in the OTHER household — never reachable from this one. */
  async function redeemForeign(): Promise<string> {
    await pool.query(
      "insert into family.star_entries (household_id, category_id, amount, kind, entered_on) " +
        "values ($1, $2, $3, 'adjustment', current_date)",
      [otherHouseholdId, foreignProfileId, STARS_GIVEN],
    );
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.redemptions (household_id, reward_id, category_id, redeemed_by) " +
        "values ($1, $2, $3, $3) returning id",
      [otherHouseholdId, foreignRewardId, foreignProfileId],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.redemptions returned no row");
    return row.id;
  }

  /**
   * Another device demotes a parent mid-session — the cookie still says
   * `parent` — and promotes them back afterwards whatever the body decided.
   */
  async function whileDemoted(profileId: string, body: () => Promise<void>): Promise<void> {
    await pool.query("update family.categories set role = 'member' where id = $1", [profileId]);
    try {
      await body();
    } finally {
      await pool.query("update family.categories set role = 'parent' where id = $1", [profileId]);
    }
  }

  /** The `exp` claim of the punch-in cookie now in the jar, in epoch seconds. */
  function actorCookieExp(): number {
    const token = state.cookies.get(ACTOR_COOKIE);
    if (!token) throw new Error("no punch-in cookie in the jar");
    const [, payload = ""] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp: number;
    };
    return claims.exp;
  }

  /** Re-sign the current punch-in with a short life, so a touch shows as `exp` moving forward. */
  async function shortenPunchIn(profileId: string, role: Role): Promise<void> {
    const { token } = await signActorToken(
      { profileId, userId: user.id, householdId, role },
      process.env.FAMILY_ACTOR_SECRET ?? "",
      SHORT_TTL_SECONDS,
    );
    state.cookies.set(ACTOR_COOKIE, token);
  }

  async function storedEntries(): Promise<StoredEntry[]> {
    const { rows } = await pool.query<StoredEntry>(
      "select kind, amount, redemption_id, summary from family.star_entries " +
        "where household_id = $1 order by created_at, kind",
      [householdId],
    );
    return rows;
  }

  /** The household's `adjustment` rows in id order — what T045's "nothing written" counts. */
  async function storedAdjustments(): Promise<StoredAdjustment[]> {
    const { rows } = await pool.query<StoredAdjustment>(
      "select category_id, amount, summary, created_by, entered_on::text as entered_on, " +
        "earned_on::text as earned_on, resolution_id, redemption_id, created_at::text as created_at " +
        "from family.star_entries where household_id = $1 and kind = 'adjustment' " +
        "order by category_id, created_at",
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

  /* ----------------------------------------------------------------------- *
   * T039 — redeemReward (contracts §Redeeming, FR-424, FR-428–FR-430)
   * ----------------------------------------------------------------------- */

  /** The one-time treat, for Cleo — the call every redeem test varies one thing about. */
  function redeemTreatFor(categoryId: string): Promise<ActionResult<Redemption>> {
    return redeemReward({ rewardId: treatRewardId, categoryId });
  }

  async function entriesOfKind(kind: string): Promise<StoredEntry[]> {
    return (await storedEntries()).filter((row) => row.kind === kind);
  }

  describe("redeemReward: FR-424's target rule, and the insert that carries nothing but the names (T039)", () => {
    it("with nobody punched in it is NO_ACTOR, and nothing is written", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      expectFailure(await redeemTreatFor(cleoId), "NO_ACTOR");
      expect(await storedRedemptionsFor(treatRewardId)).toEqual([]);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN);
    });

    it("a MEMBER redeems for themselves: one row copying cost, name and the household day, one debit (FR-428, FR-433)", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      await punchInAs(cleoId, CLEO_PIN);
      const before = localDateOf(ZONE, Date.now());
      const redemption = expectOk(await redeemTreatFor(cleoId));
      const after = localDateOf(ZONE, Date.now());

      expect(redemption).toMatchObject({
        householdId,
        rewardId: treatRewardId,
        categoryId: cleoId,
        pointValue: TREAT_COST,
        rewardName: `Ice cream ${run}`,
        redeemedBy: cleoId,
        reversedAt: null,
        reversedBy: null,
      });
      // The household's day of the write, never the device's (FR-433).
      expect([before, after]).toContain(redemption.redeemedOn);
      expect(redemption.redeemedAt).toEqual(expect.any(String));

      expect(await storedRedemption(redemption.id)).toMatchObject({
        reward_id: treatRewardId,
        category_id: cleoId,
        point_value: TREAT_COST,
        reward_name: `Ice cream ${run}`,
        reversed_at: null,
      });
      // One debit of exactly the cost, naming the reward by copy (FR-428).
      expect(await entriesOfKind("redemption")).toEqual([
        {
          kind: "redemption",
          amount: -TREAT_COST,
          redemption_id: redemption.id,
          summary: `Ice cream ${run}`,
        },
      ]);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN - TREAT_COST);
    });

    it("the cost is the STORED one at the moment of the write, never the caller's (FR-428)", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      await punchInAs(cleoId, CLEO_PIN);
      // The strict shape refuses a cost, a name or a day in the payload...
      for (const extra of [{ pointValue: 1 }, { rewardName: "Cheap" }, { redeemedOn: "2026-01-01" }]) {
        expectFailure(
          await redeemReward({
            rewardId: treatRewardId,
            categoryId: cleoId,
            ...extra,
          } as RedeemRewardPayload),
          "VALIDATION",
        );
      }
      expect(await storedRedemptionsFor(treatRewardId)).toEqual([]);

      // ...and a cost edited underneath the tap is what gets charged.
      await pool.query("update family.rewards set point_value = 7 where id = $1", [treatRewardId]);
      const redemption = expectOk(await redeemTreatFor(cleoId));
      expect(redemption.pointValue).toBe(7);
      expect((await storedRedemption(redemption.id))?.point_value).toBe(7);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN - 7);
    });

    it("a MEMBER redeeming for someone else is FORBIDDEN, naming whose reward it is, and nothing is written (FR-424)", async () => {
      await giveStars(beaId, STARS_GIVEN);
      await punchInAs(cleoId, CLEO_PIN);
      const message = expectFailure(await redeemTreatFor(beaId), "FORBIDDEN");
      expect(message).toBe(
        `That's Bea ${run}'s reward — only Bea ${run} or a parent can redeem it.`,
      );
      expect(await storedRedemptionsFor(treatRewardId)).toEqual([]);
      expect(await balanceOf(beaId)).toBe(STARS_GIVEN);
    });

    it("a PARENT redeems for any eligible Profile: the row credits the Profile and names the actor (FR-424)", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      await punchInAs(anaId, ANA_PIN);
      const redemption = expectOk(await redeemTreatFor(cleoId));
      expect(redemption).toMatchObject({ categoryId: cleoId, redeemedBy: anaId });
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN - TREAT_COST);
      expect(await balanceOf(anaId)).toBe(0);
    });

    it("a parent DEMOTED on another device is refused at once — the role is the database's, not the cookie's (R323)", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      await punchInAs(beaId, BEA_PIN);
      await whileDemoted(beaId, async () => {
        const message = expectFailure(await redeemTreatFor(cleoId), "FORBIDDEN");
        expect(message).toContain(`Cleo ${run}`);
        expect(await storedRedemptionsFor(treatRewardId)).toEqual([]);
        expect(await balanceOf(cleoId)).toBe(STARS_GIVEN);
      });
      // Promoted back: the same cookie, the same call, now allowed.
      expectOk(await redeemTreatFor(cleoId));
    });

    it("a Profile the reward is not for is FORBIDDEN with the contract's words, even for a parent (P0005)", async () => {
      await giveStars(anaId, STARS_GIVEN);
      await punchInAs(anaId, ANA_PIN);
      const message = expectFailure(await redeemTreatFor(anaId), "FORBIDDEN");
      expect(message).toBe(`That reward isn't for Ana ${run}.`);
      expect(await storedRedemptionsFor(treatRewardId)).toEqual([]);
      expect(await balanceOf(anaId)).toBe(STARS_GIVEN);
    });

    it("a one-time reward already standing for that Profile is CONFLICT (P0006, FR-430)", async () => {
      await giveStars(cleoId, STARS_GIVEN * 2);
      await punchInAs(cleoId, CLEO_PIN);
      expectOk(await redeemTreatFor(cleoId));
      const message = expectFailure(await redeemTreatFor(cleoId), "CONFLICT");
      expect(message).toBe(`Cleo ${run} has already redeemed that.`);
      expect(await storedRedemptionsFor(treatRewardId)).toHaveLength(1);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN * 2 - TREAT_COST);
    });

    it("one short is CONFLICT naming the shortfall, and exactly the cost is enough (P0007, SC-408)", async () => {
      await giveStars(cleoId, TREAT_COST - 1);
      await punchInAs(cleoId, CLEO_PIN);
      const message = expectFailure(await redeemTreatFor(cleoId), "CONFLICT");
      expect(message).toBe(`Cleo ${run} no longer has enough stars for that.`);
      expect(await storedRedemptionsFor(treatRewardId)).toEqual([]);
      expect(await balanceOf(cleoId)).toBe(TREAT_COST - 1);

      await giveStars(cleoId, 1);
      expectOk(await redeemTreatFor(cleoId));
      expect(await balanceOf(cleoId)).toBe(0);
    });

    it("a renewing reward redeems again from the remaining balance, until it runs short (FR-430)", async () => {
      const renewingId = await insertReward(householdId, {
        name: `Screen time ${run}`,
        pointValue: 4,
        respawn: true,
        categoryIds: [cleoId],
      });
      await giveStars(cleoId, STARS_GIVEN);
      await punchInAs(cleoId, CLEO_PIN);
      expectOk(await redeemReward({ rewardId: renewingId, categoryId: cleoId }));
      expectOk(await redeemReward({ rewardId: renewingId, categoryId: cleoId }));
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN - 8);
      expectFailure(await redeemReward({ rewardId: renewingId, categoryId: cleoId }), "CONFLICT");
      expect(await storedRedemptionsFor(renewingId)).toHaveLength(2);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN - 8);
    });

    it("a reward of another household, or none, is NOT_FOUND and never FORBIDDEN (P0002, FR-442)", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      await punchInAs(cleoId, CLEO_PIN);
      expectFailure(await redeemReward({ rewardId: foreignRewardId, categoryId: cleoId }), "NOT_FOUND");
      expectFailure(await redeemReward({ rewardId: UNKNOWN_ID, categoryId: cleoId }), "NOT_FOUND");
      expect(await storedRedemptionsFor(foreignRewardId)).toEqual([]);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN);
    });

    it("a Profile of another household, an unknown id and a Label are NOT_FOUND, even for a parent (FR-442, FR-414)", async () => {
      await punchInAs(anaId, ANA_PIN);
      for (const categoryId of [foreignProfileId, UNKNOWN_ID, choresLabelId]) {
        expectFailure(await redeemTreatFor(categoryId), "NOT_FOUND");
      }
      expect(await storedRedemptionsFor(treatRewardId)).toEqual([]);
    });

    it("a success pushes the punch-in's idle expiry forward; a refusal does not (FR-013)", async () => {
      await giveStars(cleoId, STARS_GIVEN);
      await punchInAs(cleoId, CLEO_PIN);

      await shortenPunchIn(cleoId, "member");
      const beforeRefusal = actorCookieExp();
      expectFailure(await redeemTreatFor(beaId), "FORBIDDEN");
      expect(actorCookieExp()).toBe(beforeRefusal);

      const beforeSuccess = actorCookieExp();
      expectOk(await redeemTreatFor(cleoId));
      expect(actorCookieExp()).toBeGreaterThan(beforeSuccess);
    });
  });

  describe("SC-409: two devices redeem for one Profile in the same second", () => {
    it("exactly one redemption and one debit; the other is CONFLICT naming the shortfall", async () => {
      const renewingId = await insertReward(householdId, {
        name: `Late night ${run}`,
        pointValue: TREAT_COST,
        respawn: true,
        categoryIds: [cleoId],
      });
      // Enough for one and not for two, so the loser meets the balance check
      // and not the one-time rule — SC-409's refusal is the shortfall.
      await giveStars(cleoId, TREAT_COST + 2);
      await punchInAs(anaId, ANA_PIN);

      // Issued together, serialised by 026's lock on the Profile's row alone —
      // no RPC, no read-then-write window to lose.
      const outcomes = await Promise.all([
        redeemReward({ rewardId: renewingId, categoryId: cleoId }),
        redeemReward({ rewardId: renewingId, categoryId: cleoId }),
      ]);
      expect(outcomes.filter((one) => one.ok)).toHaveLength(1);
      const [lost] = outcomes.filter((one) => !one.ok);
      if (lost === undefined || lost.ok) throw new Error("expected exactly one refusal");
      expect(lost.error).toBe("CONFLICT");
      expect(lost.message).toBe(`Cleo ${run} no longer has enough stars for that.`);

      expect(await storedRedemptionsFor(renewingId)).toHaveLength(1);
      expect(await entriesOfKind("redemption")).toHaveLength(1);
      expect(await balanceOf(cleoId)).toBe(2);
    });
  });

  /* ----------------------------------------------------------------------- *
   * T039 — unredeemReward (contracts §Redeeming, FR-431)
   * ----------------------------------------------------------------------- */

  describe("unredeemReward: the same target rule on the redemption's Profile, reversing once (FR-431)", () => {
    /** Cleo's standing redemption of the treat, made as `postgres`; her balance is 5. */
    let cleoRedemptionId: string;

    beforeEach(async () => {
      await giveStars(cleoId, STARS_GIVEN);
      await giveStars(beaId, STARS_GIVEN);
      cleoRedemptionId = await redeem(treatRewardId, cleoId);
    });

    it("with nobody punched in it is NO_ACTOR, and the redemption stands", async () => {
      expectFailure(await unredeemReward({ redemptionId: cleoRedemptionId }), "NO_ACTOR");
      expect((await storedRedemption(cleoRedemptionId))?.reversed_at).toBeNull();
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN - TREAT_COST);
    });

    it("a MEMBER puts back their own: marked reversed, never erased, and the refund is exactly the debit", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const reversed = expectOk(await unredeemReward({ redemptionId: cleoRedemptionId }));
      expect(reversed).toMatchObject({
        id: cleoRedemptionId,
        rewardId: treatRewardId,
        categoryId: cleoId,
        pointValue: TREAT_COST,
        rewardName: `Ice cream ${run}`,
        redeemedBy: cleoId,
        reversedBy: cleoId,
      });
      expect(reversed.reversedAt).toEqual(expect.any(String));

      // The row stays, marked; the debit stays; the refund is a second row.
      expect((await storedRedemption(cleoRedemptionId))?.reversed_at).toEqual(expect.any(String));
      expect(await entriesOfKind("redemption")).toHaveLength(1);
      expect(await entriesOfKind("refund")).toEqual([
        {
          kind: "refund",
          amount: TREAT_COST,
          redemption_id: cleoRedemptionId,
          summary: `Ice cream ${run}`,
        },
      ]);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN);
    });

    it("a second reversal is CONFLICT with the contract's words, and no second refund is written (P0008)", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      expectOk(await unredeemReward({ redemptionId: cleoRedemptionId }));
      const message = expectFailure(
        await unredeemReward({ redemptionId: cleoRedemptionId }),
        "CONFLICT",
      );
      expect(message).toBe("That was already put back.");
      expect(await entriesOfKind("refund")).toHaveLength(1);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN);
    });

    it("after an unredeem the one-time reward is redeemable again — the card returns to what it was", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      expectOk(await unredeemReward({ redemptionId: cleoRedemptionId }));
      const again = expectOk(await redeemTreatFor(cleoId));
      expect(again.id).not.toBe(cleoRedemptionId);
      expect(await storedRedemptionsFor(treatRewardId)).toHaveLength(2);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN - TREAT_COST);
    });

    it("a MEMBER putting back someone else's is FORBIDDEN naming whose it is, and nothing changes (FR-424)", async () => {
      const beaRedemptionId = await redeem(treatRewardId, beaId);
      await punchInAs(cleoId, CLEO_PIN);
      const message = expectFailure(
        await unredeemReward({ redemptionId: beaRedemptionId }),
        "FORBIDDEN",
      );
      expect(message).toContain(`Bea ${run}`);
      expect(message).toContain("a parent");
      expect((await storedRedemption(beaRedemptionId))?.reversed_at).toBeNull();
      expect(await entriesOfKind("refund")).toEqual([]);
      expect(await balanceOf(beaId)).toBe(STARS_GIVEN - TREAT_COST);
    });

    it("a PARENT puts back any Profile's, and the row names the parent as the reverser", async () => {
      await punchInAs(anaId, ANA_PIN);
      const reversed = expectOk(await unredeemReward({ redemptionId: cleoRedemptionId }));
      expect(reversed).toMatchObject({ categoryId: cleoId, redeemedBy: cleoId, reversedBy: anaId });
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN);
    });

    it("a parent DEMOTED on another device is refused the unredeem too (R323)", async () => {
      await punchInAs(beaId, BEA_PIN);
      await whileDemoted(beaId, async () => {
        const message = expectFailure(
          await unredeemReward({ redemptionId: cleoRedemptionId }),
          "FORBIDDEN",
        );
        expect(message).toContain(`Cleo ${run}`);
        expect((await storedRedemption(cleoRedemptionId))?.reversed_at).toBeNull();
      });
      expectOk(await unredeemReward({ redemptionId: cleoRedemptionId }));
    });

    it("a redemption of another household, or none, is NOT_FOUND and never FORBIDDEN (FR-442)", async () => {
      const foreignRedemptionId = await redeemForeign();
      await punchInAs(anaId, ANA_PIN);
      expectFailure(await unredeemReward({ redemptionId: foreignRedemptionId }), "NOT_FOUND");
      expectFailure(await unredeemReward({ redemptionId: UNKNOWN_ID }), "NOT_FOUND");
      expect((await storedRedemption(foreignRedemptionId))?.reversed_at).toBeNull();
    });

    it("two devices put back the same redemption in the same second: exactly one refund", async () => {
      await punchInAs(anaId, ANA_PIN);
      const outcomes = await Promise.all([
        unredeemReward({ redemptionId: cleoRedemptionId }),
        unredeemReward({ redemptionId: cleoRedemptionId }),
      ]);
      expect(outcomes.filter((one) => one.ok)).toHaveLength(1);
      expect(outcomes.filter((one) => !one.ok && one.error === "CONFLICT")).toHaveLength(1);
      expect(await entriesOfKind("refund")).toHaveLength(1);
      expect(await balanceOf(cleoId)).toBe(STARS_GIVEN);
    });

    it("a success pushes the punch-in's idle expiry forward (FR-013)", async () => {
      await punchInAs(anaId, ANA_PIN);
      await shortenPunchIn(anaId, "parent");
      const before = actorCookieExp();
      expectOk(await unredeemReward({ redemptionId: cleoRedemptionId }));
      expect(actorCookieExp()).toBeGreaterThan(before);
    });
  });

  /* ----------------------------------------------------------------------- *
   * T045 — adjustStars (contracts §Giving stars by hand, FR-434–FR-436, SC-412)
   * ----------------------------------------------------------------------- */

  describe("adjustStars: parent-only, ONE statement for every chosen Profile, refused whole below zero (T045)", () => {
    /** Bea and Cleo in the order the INSERT — and the answer — carries them. */
    function chosen(): string[] {
      return [beaId, cleoId].sort();
    }

    /** The name a refusal speaks of, by id. */
    function nameOf(profileId: string): string {
      return profileId === beaId ? `Bea ${run}` : `Cleo ${run}`;
    }

    function overdrawMessage(profileId: string): string {
      return `That would leave ${nameOf(profileId)} below zero.`;
    }

    /** The rows ONE call wrote, told apart from the fixture's by the amount. */
    async function writtenWith(amount: number): Promise<StoredAdjustment[]> {
      return (await storedAdjustments()).filter((row) => row.amount === amount);
    }

    it("with nobody punched in it is NO_ACTOR, and nothing is written", async () => {
      expectFailure(await adjustStars({ categoryIds: [cleoId], amount: 3 }), "NO_ACTOR");
      expect(await storedAdjustments()).toEqual([]);
      expect(await balanceOf(cleoId)).toBe(0);
    });

    it("a MEMBER is FORBIDDEN on every path — for themselves too — and the same call succeeds as a parent (FR-435)", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      expectFailure(await adjustStars({ categoryIds: [cleoId], amount: 3 }), "FORBIDDEN");
      expectFailure(await adjustStars({ categoryIds: [beaId], amount: 3 }), "FORBIDDEN");
      expect(await storedAdjustments()).toEqual([]);

      await punchInAs(anaId, ANA_PIN);
      expectOk(await adjustStars({ categoryIds: [cleoId], amount: 3 }));
      expect(await balanceOf(cleoId)).toBe(3);
    });

    it("a parent DEMOTED on another device is refused at once — the role is the database's, not the cookie's (R323)", async () => {
      await punchInAs(beaId, BEA_PIN);
      await whileDemoted(beaId, async () => {
        expectFailure(await adjustStars({ categoryIds: [cleoId], amount: 3 }), "FORBIDDEN");
        expect(await storedAdjustments()).toEqual([]);
      });
      // Promoted back: the same cookie, the same call, now allowed.
      expectOk(await adjustStars({ categoryIds: [cleoId], amount: 3 }));
      expect(await balanceOf(cleoId)).toBe(3);
    });

    it("gives two Profiles the same amount in ONE statement and answers with their resulting balances, in id order (FR-436, SC-412)", async () => {
      await giveStars(beaId, 4);
      await punchInAs(anaId, ANA_PIN);
      const before = localDateOf(ZONE, Date.now());
      // Sent in one order, carried in the other: the answer is by id, not by payload.
      const balances = expectOk(await adjustStars({ categoryIds: [cleoId, beaId], amount: 10 }));
      const after = localDateOf(ZONE, Date.now());

      expect(balances).toEqual(
        chosen().map((categoryId) => ({ categoryId, balance: categoryId === beaId ? 14 : 10 })),
      );
      expect(await balanceOf(beaId)).toBe(14);
      expect(await balanceOf(cleoId)).toBe(10);
      // The giver's own balance is not in the answer and did not move.
      expect(await balanceOf(anaId)).toBe(0);

      const written = await writtenWith(10);
      expect(written.map((row) => row.category_id)).toEqual(chosen());
      for (const row of written) {
        // FR-436's columns: the amount, the actor and the moment; nothing of an
        // occurrence or a redemption (025's kind shape); no title to copy.
        expect(row).toMatchObject({
          amount: 10,
          summary: null,
          created_by: anaId,
          earned_on: null,
          resolution_id: null,
          redemption_id: null,
        });
        // The household's day of the write, never the device's (FR-433).
        expect([before, after]).toContain(row.entered_on);
      }
      // One statement, one transaction: both rows carry the same `now()`.
      expect(new Set(written.map((row) => row.created_at)).size).toBe(1);
    });

    it("a negative amount takes stars away, and exactly to zero is allowed (FR-434, FR-436)", async () => {
      await giveStars(beaId, 10);
      await giveStars(cleoId, 4);
      await punchInAs(anaId, ANA_PIN);
      const balances = expectOk(await adjustStars({ categoryIds: [beaId, cleoId], amount: -4 }));
      expect(balances).toEqual(
        chosen().map((categoryId) => ({ categoryId, balance: categoryId === beaId ? 6 : 0 })),
      );
      expect((await writtenWith(-4)).map((row) => row.category_id)).toEqual(chosen());
      expect(await balanceOf(cleoId)).toBe(0);
    });

    it("an amount that would leave one chosen Profile below zero is VALIDATION against `amount` naming them, and NOTHING is written for anyone (P0004, FR-436, SC-412)", async () => {
      await giveStars(beaId, 10);
      await giveStars(cleoId, 3);
      const before = await storedAdjustments();
      await punchInAs(anaId, ANA_PIN);

      const result = await adjustStars({ categoryIds: [beaId, cleoId], amount: -5 });
      expectFieldError(result, "amount");
      expect(expectFailure(result, "VALIDATION")).toBe(overdrawMessage(cleoId));
      expect(result.ok ? undefined : result.fieldErrors).toEqual({
        amount: [overdrawMessage(cleoId)],
      });

      // Bea could afford it; her row rolls back with Cleo's — one statement.
      expect(await storedAdjustments()).toEqual(before);
      expect(await balanceOf(beaId)).toBe(10);
      expect(await balanceOf(cleoId)).toBe(3);
    });

    it("when more than one would overdraw, the refusal names the FIRST in id order — the row the database refused", async () => {
      await giveStars(beaId, 2);
      await giveStars(cleoId, 3);
      const before = await storedAdjustments();
      await punchInAs(anaId, ANA_PIN);
      const [first] = chosen();
      if (first === undefined) throw new Error("expected two chosen Profiles");

      const message = expectFailure(
        await adjustStars({ categoryIds: [cleoId, beaId], amount: -5 }),
        "VALIDATION",
      );
      expect(message).toBe(overdrawMessage(first));
      expect(await storedAdjustments()).toEqual(before);
    });

    it("a Profile who has never had a star cannot be taken below zero either", async () => {
      await punchInAs(anaId, ANA_PIN);
      const message = expectFailure(
        await adjustStars({ categoryIds: [cleoId], amount: -1 }),
        "VALIDATION",
      );
      expect(message).toBe(overdrawMessage(cleoId));
      expect(await storedAdjustments()).toEqual([]);
    });

    it("0, 501, −501, a fraction and an invented key are VALIDATION, and nothing is written (FR-436)", async () => {
      await giveStars(cleoId, 10);
      const before = await storedAdjustments();
      await punchInAs(anaId, ANA_PIN);
      for (const amount of [0, 501, -501, 2.5]) {
        expectFieldError(await adjustStars({ categoryIds: [cleoId], amount }), "amount");
      }
      // An adjustment carries no title (025: `summary` is null on the kind) — a
      // client that sends one is refused, not stripped.
      expectFailure(
        await adjustStars({
          categoryIds: [cleoId],
          amount: 3,
          summary: "Tidy room",
        } as AdjustStarsPayload),
        "VALIDATION",
      );
      expect(await storedAdjustments()).toEqual(before);
      expect(await balanceOf(cleoId)).toBe(10);
    });

    it("an empty list, a repeat and a Label are VALIDATION against `categoryIds`; a foreign or unknown id is NOT_FOUND (FR-414, FR-442)", async () => {
      const foreignBefore = await balanceOf(foreignProfileId);
      await punchInAs(anaId, ANA_PIN);
      expectFieldError(await adjustStars({ categoryIds: [], amount: 3 }), "categoryIds");
      expectFieldError(await adjustStars({ categoryIds: [cleoId, cleoId], amount: 3 }), "categoryIds");
      expectFieldError(
        await adjustStars({ categoryIds: [cleoId, choresLabelId], amount: 3 }),
        "categoryIds",
      );
      // Never FORBIDDEN: nothing confirms a row exists somewhere else.
      expectFailure(
        await adjustStars({ categoryIds: [cleoId, foreignProfileId], amount: 3 }),
        "NOT_FOUND",
      );
      expectFailure(await adjustStars({ categoryIds: [UNKNOWN_ID], amount: 3 }), "NOT_FOUND");

      // Cleo was in three of those lists and got nothing from any of them.
      expect(await storedAdjustments()).toEqual([]);
      expect(await balanceOf(cleoId)).toBe(0);
      expect(await balanceOf(foreignProfileId)).toBe(foreignBefore);
    });

    it("a success pushes the punch-in's idle expiry forward; a refusal does not (FR-013)", async () => {
      await punchInAs(anaId, ANA_PIN);
      await shortenPunchIn(anaId, "parent");
      const beforeRefusal = actorCookieExp();
      expectFailure(await adjustStars({ categoryIds: [cleoId], amount: -1 }), "VALIDATION");
      expect(actorCookieExp()).toBe(beforeRefusal);

      const beforeSuccess = actorCookieExp();
      expectOk(await adjustStars({ categoryIds: [cleoId], amount: 1 }));
      expect(actorCookieExp()).toBeGreaterThan(beforeSuccess);
    });
  });
});
