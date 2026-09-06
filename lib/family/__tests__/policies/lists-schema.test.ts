/**
 * 005 T008: the Lists schema pinned at the store — migration 028 as
 * data-model.md writes it — exercised through the secret key the way the server
 * actions write, so every refusal surfaces as the SQLSTATE the actions must map
 * and every named CHECK is asserted by name. The `rewards-schema` pattern: each
 * constraint is shown actually doing its job on a real row, not merely declared.
 *
 * Covered here:
 *   - **the CHECKs** (FR-509, FR-510, FR-517, FR-527): a list name of 0 or 121
 *     characters, or spaces only, is `23514`; an item's text of 0 or 201; a
 *     section of `''`, of 61 characters, or untrimmed (`' Dairy'`) is refused
 *     while `'Dairy'` and null are accepted; `kind = 'shopping'` — the
 *     reference's API word — is refused and the three the device offers are
 *     accepted; an off-palette colour is refused by the shipped domain and a
 *     palette colour accepted; `checked_by` without `checked_at` is refused and
 *     `checked_at` alone accepted (the one asymmetric state a deletion leaves);
 *   - **cascades and attribution** (FR-512, FR-540): deleting a list removes its
 *     items; deleting a Profile who created a list, added an item and checked an
 *     item leaves all three rows and nulls the three attribution columns;
 *   - **the touch trigger** moves `updated_at` on a list;
 *   - **`seed_default_lists`** (FR-513, R511): 2 on an empty household with
 *     exactly the two rows — names, kinds, the live default colours, sort 1000
 *     then 2000 — then 0 and nothing added; 0 for a household that has one list
 *     of its own.
 *
 * Fixture rows are created here in a run-tagged household of this file's own,
 * never taken from the seed, so nothing here can drift with — or damage — the
 * seeded tab.
 *
 * RED by design until T011 resets the stack onto 028–029: every write below
 * fails with `42P01` (no such relation) while the two tables do not exist.
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
} from "./helpers";

/** Every refusal this file asserts carries a SQLSTATE and a named reason. */
interface StoreRefusal {
  code: string;
  message: string;
}

function expectRefusal(error: StoreRefusal | null, sqlstate: string, detail: string): void {
  expect(error?.code, detail).toBe(sqlstate);
  expect(error?.message, detail).toContain(detail);
}

const LIST_COLUMNS = "id, name, kind, color, parents_only, sort_order, created_by, updated_by, updated_at";
const ITEM_COLUMNS = "id, list_id, text, section, checked_at, checked_by, sort_order, created_by";

interface ListRow {
  id: string;
  name: string;
  kind: string;
  color: string;
  parents_only: boolean;
  sort_order: string | number;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface ItemRow {
  id: string;
  list_id: string;
  text: string;
  section: string | null;
  checked_at: string | null;
  checked_by: string | null;
  sort_order: string | number;
  created_by: string | null;
}

describe("lists schema: the two tables, their CHECKs, cascades and the default lists", () => {
  const fx = fixtures();
  let pool: Pool;
  let admin: SupabaseClient;
  /** Every fixture row lives here. */
  let householdId: string;
  /** The Profile who creates, adds and checks — the attribution every row records. */
  let anaId: string;

  // ── writes through the secret key, the way the actions write ─────────────

  const insertList = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("lists")
      .insert({ household_id: householdId, kind: "to_do", color: "#B6E085", created_by: anaId, updated_by: anaId, ...row })
      .select(LIST_COLUMNS)
      .single();

  async function createList(name: string, row: Record<string, unknown> = {}): Promise<ListRow> {
    const { data, error } = await insertList({ name: `${name} ${fx.run}`, ...row });
    if (error) throw error;
    return data as ListRow;
  }

  const insertItem = (listId: string, row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("list_items")
      .insert({ household_id: householdId, list_id: listId, created_by: anaId, ...row })
      .select(ITEM_COLUMNS)
      .single();

  async function createItem(listId: string, text: string, row: Record<string, unknown> = {}): Promise<ItemRow> {
    const { data, error } = await insertItem(listId, { text, ...row });
    if (error) throw error;
    return data as ItemRow;
  }

  async function readItems(listId: string): Promise<ItemRow[]> {
    const { data, error } = await admin.schema("family").from("list_items").select(ITEM_COLUMNS).eq("list_id", listId);
    if (error) throw error;
    return data as ItemRow[];
  }

  async function seedDefaults(forHousehold: string): Promise<number> {
    const { rows } = await pool.query<{ seeded: number }>("select family.seed_default_lists($1) as seeded", [forHousehold]);
    return rows[0].seeded;
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();
    householdId = await insertHousehold(pool, `test-${fx.run}-lists-schema`);
    anaId = await insertCategory(pool, { householdId, label: `Ana ${fx.run}`, color: "#915EA1", role: "parent" });
  });

  afterAll(async () => {
    try {
      await deleteHousehold(pool, householdId);
    } finally {
      await pool.end();
    }
  });

  // ── the CHECKs ─────────────────────────────────────────────────────────────

  describe("a list's shape (FR-509, FR-510)", () => {
    it("refuses a blank, spaces-only or 121-character name and accepts 1 and 120", async () => {
      expectRefusal((await insertList({ name: "" })).error, "23514", "lists_name_check");
      expectRefusal((await insertList({ name: "   " })).error, "23514", "lists_name_check");
      expectRefusal((await insertList({ name: "x".repeat(121) })).error, "23514", "lists_name_check");
      expect((await insertList({ name: "x" })).error).toBeNull();
      expect((await insertList({ name: "y".repeat(120) })).error).toBeNull();
    });

    it("accepts the three types the device offers and refuses the API's own word", async () => {
      for (const kind of ["to_do", "grocery", "other"]) {
        expect((await insertList({ name: `${kind} ${fx.run}`, kind })).error, kind).toBeNull();
      }
      expectRefusal((await insertList({ name: `shopping ${fx.run}`, kind: "shopping" })).error, "23514", "lists_kind_check");
    });

    it("takes only a palette colour — the shipped domain, not a second rule", async () => {
      const refused = await insertList({ name: `off palette ${fx.run}`, color: "#123456" });
      expect(refused.error?.code).toBe("23514");
      expect(refused.error?.message).toContain("palette_color");
      expect((await insertList({ name: `sprout ${fx.run}`, color: "#B6E085" })).error).toBeNull();
    });

    it("defaults to not Parents only, at sort 1000, with the actor recorded", async () => {
      const list = await createList("defaults");
      expect(list.parents_only).toBe(false);
      expect(Number(list.sort_order)).toBe(1000);
      expect(list.created_by).toBe(anaId);
      expect(list.updated_by).toBe(anaId);
    });

    it("moves updated_at on an update — the shipped touch trigger", async () => {
      const list = await createList("touched");
      await new Promise((resolve) => setTimeout(resolve, 20));
      const { data, error } = await admin
        .schema("family")
        .from("lists")
        .update({ name: `touched again ${fx.run}` })
        .eq("id", list.id)
        .select("updated_at")
        .single();
      expect(error).toBeNull();
      expect(new Date((data as { updated_at: string }).updated_at).getTime()).toBeGreaterThan(
        new Date(list.updated_at).getTime(),
      );
    });
  });

  describe("an item's shape (FR-517, FR-527, R503)", () => {
    let listId: string;
    beforeAll(async () => {
      listId = (await createList("items")).id;
    });

    it("refuses blank or 201-character text and accepts 1 and 200", async () => {
      expectRefusal((await insertItem(listId, { text: "" })).error, "23514", "list_items_text_check");
      expectRefusal((await insertItem(listId, { text: "  " })).error, "23514", "list_items_text_check");
      expectRefusal((await insertItem(listId, { text: "x".repeat(201) })).error, "23514", "list_items_text_check");
      expect((await insertItem(listId, { text: "x" })).error).toBeNull();
      expect((await insertItem(listId, { text: "🥚 Eggs x".repeat(1).padEnd(200, "y") })).error).toBeNull();
    });

    it("stores a section trimmed, 1–60, or none — and refuses the untrimmed, the empty and the long", async () => {
      expect((await insertItem(listId, { text: "Milk", section: "Dairy" })).error).toBeNull();
      expect((await insertItem(listId, { text: "Bread", section: null })).error).toBeNull();
      expectRefusal((await insertItem(listId, { text: "a", section: "" })).error, "23514", "list_items_section_check");
      expectRefusal((await insertItem(listId, { text: "b", section: " Dairy" })).error, "23514", "list_items_section_check");
      expectRefusal((await insertItem(listId, { text: "c", section: "Dairy " })).error, "23514", "list_items_section_check");
      expectRefusal(
        (await insertItem(listId, { text: "d", section: "s".repeat(61) })).error,
        "23514",
        "list_items_section_check",
      );
    });

    it("is checked exactly while checked_at is set; checked_by alone is refused, checked_at alone stands", async () => {
      const now = new Date().toISOString();
      expectRefusal(
        (await insertItem(listId, { text: "who", checked_by: anaId })).error,
        "23514",
        "list_item_checked_shape",
      );
      expect((await insertItem(listId, { text: "when", checked_at: now })).error).toBeNull();
      const both = await createItem(listId, "both", { checked_at: now, checked_by: anaId });
      expect(both.checked_by).toBe(anaId);
      expect(both.checked_at).not.toBeNull();
    });

    it("belongs to a list of the SAME household — the composite FK, not a bare id", async () => {
      const other = await insertHousehold(pool, `test-${fx.run}-lists-other`);
      try {
        const { error } = await admin
          .schema("family")
          .from("list_items")
          .insert({ household_id: other, list_id: listId, text: "stray" });
        expect(error?.code).toBe("23503");
      } finally {
        await deleteHousehold(pool, other);
      }
    });
  });

  // ── cascades and attribution ──────────────────────────────────────────────

  describe("cascades and attribution (FR-512, FR-540)", () => {
    it("deleting a list removes its items", async () => {
      const list = await createList("doomed");
      await createItem(list.id, "one");
      await createItem(list.id, "two");
      const { error } = await admin.schema("family").from("lists").delete().eq("id", list.id);
      expect(error).toBeNull();
      expect(await readItems(list.id)).toEqual([]);
    });

    it("deleting a Profile leaves every list and item, clearing only who did what", async () => {
      const cleoId = await insertCategory(pool, { householdId, label: `Cleo ${fx.run}`, color: "#93D1E6" });
      const { data: made, error: listError } = await insertList({
        name: `Cleo's ${fx.run}`,
        created_by: cleoId,
        updated_by: cleoId,
      });
      expect(listError).toBeNull();
      const list = made as ListRow;
      const added = await createItem(list.id, "Cleo added", { created_by: cleoId });
      const ticked = await createItem(list.id, "Cleo ticked", {
        checked_at: new Date().toISOString(),
        checked_by: cleoId,
      });

      await pool.query("delete from family.categories where id = $1", [cleoId]);

      const { data: after } = await admin.schema("family").from("lists").select(LIST_COLUMNS).eq("id", list.id).single();
      expect((after as ListRow).created_by).toBeNull();
      expect((after as ListRow).updated_by).toBeNull();
      const items = await readItems(list.id);
      expect(items.map((one) => one.id).sort()).toEqual([added.id, ticked.id].sort());
      const stillTicked = items.find((one) => one.id === ticked.id);
      expect(stillTicked?.checked_at).not.toBeNull();
      expect(stillTicked?.checked_by).toBeNull();
      expect(items.find((one) => one.id === added.id)?.created_by).toBeNull();
    });
  });

  // ── the default lists ─────────────────────────────────────────────────────

  describe("seed_default_lists (FR-513, R511)", () => {
    it("makes exactly the two defaults once on an empty household, then nothing", async () => {
      const fresh = await insertHousehold(pool, `test-${fx.run}-lists-fresh`);
      try {
        expect(await seedDefaults(fresh)).toBe(2);
        const { rows } = await pool.query<{ name: string; kind: string; color: string; sort_order: string }>(
          "select name, kind, color, sort_order::text from family.lists where household_id = $1 order by sort_order",
          [fresh],
        );
        expect(rows).toEqual([
          { name: "Grocery List", kind: "grocery", color: "#B6E085", sort_order: "1000" },
          { name: "To-Do List", kind: "to_do", color: "#A8D4D3", sort_order: "2000" },
        ]);
        expect(await seedDefaults(fresh)).toBe(0);
        const { rows: again } = await pool.query("select id from family.lists where household_id = $1", [fresh]);
        expect(again).toHaveLength(2);
      } finally {
        await deleteHousehold(pool, fresh);
      }
    });

    it("adds nothing to a household that already has a list of its own", async () => {
      const own = await insertHousehold(pool, `test-${fx.run}-lists-own`);
      try {
        await pool.query(
          "insert into family.lists (household_id, name, kind, color) values ($1, 'Mine', 'other', '#FDC36D')",
          [own],
        );
        expect(await seedDefaults(own)).toBe(0);
        const { rows } = await pool.query<{ name: string }>("select name from family.lists where household_id = $1", [own]);
        expect(rows).toEqual([{ name: "Mine" }]);
      } finally {
        await deleteHousehold(pool, own);
      }
    });
  });
});
