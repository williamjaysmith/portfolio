/**
 * T042: the CHECK constraints and the last-parent guard on `family.categories`,
 * exercised through the secret key the way the server actions write — every
 * refusal must surface as SQLSTATE 23514 so `updateCategory`/`deleteCategory`
 * can map it (D29).
 */

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
  testEmail,
} from "./helpers";

describe("categories: constraints and the last-parent guard", () => {
  const fx = fixtures();
  let pool: Pool;
  let admin: SupabaseClient;
  /** A household of its own, so "last parent" means exactly one parent. */
  let householdId: string;
  let parentId: string;

  const insert = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("categories")
      .insert({ household_id: fx.householdId, label: `Probe ${fx.run}`, color: "#2178AF", ...row })
      .select("id")
      .single();

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
    householdId = await insertHousehold(pool, `test-${fx.run}-cats`);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      testEmail("cats", fx.run),
    ]);
    parentId = await insertCategory(pool, {
      householdId,
      label: `Only parent ${fx.run}`,
      color: "#CB434C",
      role: "parent",
    });
  });

  afterAll(async () => {
    await deleteHousehold(pool, householdId);
    await pool.end();
  });

  it("rejects a colour outside the palette (23514)", async () => {
    const { error } = await insert({ color: "#123456" });
    expect(error?.code).toBe("23514");
    const lowercase = await insert({ color: "#2178af" });
    expect(lowercase.error?.code).toBe("23514");
  });

  it("rejects a label that carries person fields (23514)", async () => {
    const { error } = await insert({ is_profile: false, birthday: "2020-01-01" });
    expect(error?.code).toBe("23514");
    const parentLabel = await insert({ is_profile: false, role: "parent" });
    expect(parentLabel.error?.code).toBe("23514");
  });

  it("rejects a profile with an emoji (23514)", async () => {
    const { error } = await insert({ is_profile: true, emoji: "🎉" });
    expect(error?.code).toBe("23514");
  });

  it("refuses to delete the last parent profile (23514 LAST_PARENT)", async () => {
    const { error } = await admin.schema("family").from("categories").delete().eq("id", parentId);
    expect(error?.code).toBe("23514");
    expect(error?.message).toMatch(/LAST_PARENT/);
    expect(await count("categories", "id", parentId)).toBe(1);
  });

  it("refuses to demote the last parent profile (23514)", async () => {
    const { error } = await admin
      .schema("family")
      .from("categories")
      .update({ role: "member" })
      .eq("id", parentId);
    expect(error?.code).toBe("23514");

    const { rows } = await pool.query<{ role: string }>(
      "select role from family.categories where id = $1",
      [parentId],
    );
    expect(rows[0]?.role).toBe("parent");
  });

  it("allows demoting or deleting a parent while another parent remains", async () => {
    const secondParentId = await insertCategory(pool, {
      householdId,
      label: `Second parent ${fx.run}`,
      color: "#408257",
      role: "parent",
    });

    const demote = await admin
      .schema("family")
      .from("categories")
      .update({ role: "member" })
      .eq("id", parentId);
    expect(demote.error).toBeNull();

    const remove = await admin.schema("family").from("categories").delete().eq("id", parentId);
    expect(remove.error).toBeNull();
    expect(await count("categories", "id", parentId)).toBe(0);

    parentId = secondParentId;
  });

  it("deleting the household cascades to categories, settings and the allowlist", async () => {
    expect(await count("categories", "household_id", householdId)).toBe(1);
    expect(await count("household_settings", "household_id", householdId)).toBe(1);
    expect(await count("household_users", "household_id", householdId)).toBe(1);

    await deleteHousehold(pool, householdId);

    expect(await count("households", "id", householdId)).toBe(0);
    expect(await count("categories", "household_id", householdId)).toBe(0);
    expect(await count("household_settings", "household_id", householdId)).toBe(0);
    expect(await count("household_users", "household_id", householdId)).toBe(0);
  });
});
