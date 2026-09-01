/**
 * T034 / SC-002 at the database: `set_pin`, `verify_pin` and `clear_pin`
 * called the way the server actions call them — through the secret key with
 * the VERIFIED caller passed explicitly (D3), since `auth.uid()` is null under
 * service_role. The lock counter is driven by real bcrypt comparisons and the
 * clock is moved with a direct `update` on `family.profile_pins`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import { adminClient, createPool, fixtures, insertCategory, userClient } from "./helpers";

interface VerifyRow {
  ok: boolean;
  reason: string;
}

interface PinState {
  failed_attempts: number;
  locked: boolean | null;
  locked_until: string | null;
}

const PIN = "1234";
const WRONG = "0000";

describe("pins: set_pin / verify_pin / clear_pin", () => {
  const fx = fixtures();
  let pool: Pool;
  let admin: SupabaseClient;
  let member: SupabaseClient;
  let profileId: string;
  let labelId: string;

  const setPin = (userId: string | null, profile: string, pin: string) =>
    admin.schema("family").rpc("set_pin", { p_user_id: userId, p_profile: profile, p_pin: pin });

  const clearPin = (userId: string | null, profile: string) =>
    admin.schema("family").rpc("clear_pin", { p_user_id: userId, p_profile: profile });

  async function verify(userId: string | null, profile: string, candidate: string): Promise<VerifyRow> {
    const { data, error } = await admin
      .schema("family")
      .rpc("verify_pin", { p_user_id: userId, p_profile: profile, p_candidate: candidate })
      .single();
    if (error) throw error;
    return data as VerifyRow;
  }

  async function pinState(): Promise<PinState | undefined> {
    const { rows } = await pool.query<PinState>(
      "select failed_attempts, locked_until > now() as locked, locked_until " +
        "from family.profile_pins where profile_id = $1",
      [profileId],
    );
    return rows[0];
  }

  async function hasPin(): Promise<boolean> {
    const { data, error } = await member
      .schema("family")
      .from("categories")
      .select("has_pin")
      .eq("id", profileId)
      .single();
    if (error) throw error;
    return (data as { has_pin: boolean }).has_pin;
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    profileId = await insertCategory(pool, {
      householdId: fx.householdId,
      label: `Pin kid ${fx.run}`,
      color: "#B6E085",
    });
    labelId = await insertCategory(pool, {
      householdId: fx.householdId,
      label: `Bin day ${fx.run}`,
      color: "#DADADA",
      isProfile: false,
    });
  });

  afterAll(async () => {
    await pool.query("delete from family.categories where id = any($1::uuid[])", [[profileId, labelId]]);
    await pool.end();
  });

  it("verify_pin reports no_pin for a profile without one", async () => {
    expect(await hasPin()).toBe(false);
    expect(await verify(fx.users.a.id, profileId, PIN)).toEqual({ ok: false, reason: "no_pin" });
  });

  it("set_pin by a member stores a bcrypt hash and flips has_pin", async () => {
    const { error } = await setPin(fx.users.a.id, profileId, PIN);
    expect(error).toBeNull();
    expect(await hasPin()).toBe(true);

    const { rows } = await pool.query<{ pin_hash: string }>(
      "select pin_hash from family.profile_pins where profile_id = $1",
      [profileId],
    );
    expect(rows[0]?.pin_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(rows[0]?.pin_hash).not.toContain(PIN);
  });

  it("verify_pin accepts the right PIN and counts a wrong one", async () => {
    expect(await verify(fx.users.a.id, profileId, PIN)).toEqual({ ok: true, reason: "ok" });
    expect(await verify(fx.users.a.id, profileId, WRONG)).toEqual({ ok: false, reason: "bad_pin" });
    expect(await pinState()).toMatchObject({ failed_attempts: 1, locked: null });
  });

  it("five wrong guesses lock the profile; even the right PIN is refused while locked", async () => {
    expect(await verify(fx.users.a.id, profileId, PIN)).toMatchObject({ ok: true });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(await verify(fx.users.a.id, profileId, WRONG), `attempt ${attempt}`).toEqual({
        ok: false,
        reason: "bad_pin",
      });
    }
    expect(await verify(fx.users.a.id, profileId, PIN)).toEqual({ ok: false, reason: "locked" });
    expect(await pinState()).toMatchObject({ failed_attempts: 5, locked: true });
  });

  it("after the lock expires a wrong guess starts a fresh count instead of re-locking", async () => {
    await pool.query(
      "update family.profile_pins set locked_until = now() - interval '1 minute' where profile_id = $1",
      [profileId],
    );
    expect(await verify(fx.users.a.id, profileId, WRONG)).toEqual({ ok: false, reason: "bad_pin" });
    expect(await pinState()).toMatchObject({ failed_attempts: 1, locked_until: null });
  });

  it("a correct PIN resets the counter and the lock", async () => {
    expect(await verify(fx.users.a.id, profileId, PIN)).toEqual({ ok: true, reason: "ok" });
    expect(await pinState()).toMatchObject({ failed_attempts: 0, locked_until: null });
  });

  it("an account outside the household is refused by both functions", async () => {
    expect(await verify(fx.users.stranger.id, profileId, PIN)).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(await verify(null, profileId, PIN)).toEqual({ ok: false, reason: "forbidden" });

    const stranger = await setPin(fx.users.stranger.id, profileId, "9999");
    expect(stranger.error?.code).toBe("42501");
    const nobody = await setPin(null, profileId, "9999");
    expect(nobody.error?.code).toBe("42501");
    // The PIN is untouched.
    expect(await verify(fx.users.a.id, profileId, PIN)).toMatchObject({ ok: true });
  });

  it("an authenticated client cannot call verify_pin or set_pin at all", async () => {
    const verifyAttempt = await member
      .schema("family")
      .rpc("verify_pin", { p_user_id: fx.users.a.id, p_profile: profileId, p_candidate: PIN });
    expect(verifyAttempt.error?.code).toBe("42501");

    const setAttempt = await member
      .schema("family")
      .rpc("set_pin", { p_user_id: fx.users.a.id, p_profile: profileId, p_pin: "9999" });
    expect(setAttempt.error?.code).toBe("42501");
  });

  it("set_pin rejects a malformed PIN and non-profile targets", async () => {
    const malformed = await setPin(fx.users.a.id, profileId, "12a4");
    expect(malformed.error?.code).toBe("22023");

    const label = await setPin(fx.users.a.id, labelId, PIN);
    expect(label.error?.code).toBe("P0002");

    const missing = await setPin(fx.users.a.id, "00000000-0000-4000-8000-00000000dead", PIN);
    expect(missing.error?.code).toBe("P0002");

    expect(await verify(fx.users.a.id, labelId, PIN)).toEqual({ ok: false, reason: "not_found" });
  });

  it("clear_pin removes the PIN, flips has_pin back, and is refused for outsiders", async () => {
    const stranger = await clearPin(fx.users.stranger.id, profileId);
    expect(stranger.error?.code).toBe("42501");
    expect(await hasPin()).toBe(true);

    const { error } = await clearPin(fx.users.a.id, profileId);
    expect(error).toBeNull();
    expect(await hasPin()).toBe(false);
    expect(await pinState()).toBeUndefined();
    expect(await verify(fx.users.a.id, profileId, PIN)).toEqual({ ok: false, reason: "no_pin" });
  });
});
