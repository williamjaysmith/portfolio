/**
 * 005 T021 — the twelve list actions end to end (contracts/server-actions.md),
 * every call off-interface: there is no form and no button in this file, so
 * the member rows below are FR-534's "open to every punched-in Profile" and
 * FR-535's "refused at the server" proofs.
 *
 * Same plumbing as `rewards-actions.test.ts` — Next's cookie store is an
 * in-memory jar, the request's Supabase session is a real signed-in client, and
 * everything else (the guards, the signed actor cookie, the admin client, RLS,
 * 028's CHECKs) is production code.
 *
 * Covered here:
 *   - nobody punched in → `NO_ACTOR`, nothing written;
 *   - a **member** may create, edit and delete lists, and add, edit, check, move,
 *     delete and clear items — every verb the reference opens to anyone at the
 *     device (FR-534) — EXCEPT on a Parents only list, where every write is
 *     `NOT_FOUND` (never `FORBIDDEN`) and the same call succeeds as a parent
 *     (FR-514, FR-535, R505); a member cannot turn Parents only off on a list they
 *     cannot see;
 *   - `createList` appends and attributes (FR-502, FR-511); `updateList` judges
 *     the merged shape and moves `updated_by`; `deleteList` needs `confirm: true`
 *     and cascades (FR-512);
 *   - `addListItem` appends ungrouped and attributed (FR-516); `updateListItem`
 *     renames, and a section of `" dairy"` lands in **Dairy** (FR-529);
 *   - `setListItemChecked` twice is one state with no error, and unchecking nulls
 *     both columns (SC-504, R503);
 *   - `moveListItem` writes the position between the neighbours AND the section in
 *     one row, and refuses a neighbour of another list (FR-524, FR-532);
 *   - `clearCompletedItems` removes exactly the checked rows and returns the count
 *     (FR-521, SC-505);
 *   - `sectionItems` sets the chosen ids' section and merges case-insensitively;
 *     `renameSection` renames across items and merges into an existing spelling;
 *     `removeSection` ungroups and keeps every row (FR-528, FR-529, FR-533);
 *   - tenancy: an id of another household is `NOT_FOUND` on every path (FR-539).
 *
 * Fixture rows live in run-tagged households of this file's own, never in the
 * seed, so nothing here can drift with — or damage — the seeded tab.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import * as listsModule from "@/lib/family/actions/lists";
import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { List, ListItem } from "@/lib/family/types";
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
    if (!state.client) throw new Error("lists-actions.test: no signed-in client selected");
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
 * The surface T022 must export (contracts/server-actions.md). Restated here
 * rather than imported, so the payload shapes this suite pins are the CONTRACT's
 * and not whatever the implementation happens to accept.
 * ------------------------------------------------------------------------- */

interface ListInputPayload {
  name: string;
  kind: "to_do" | "grocery" | "other";
  color: string;
  parentsOnly: boolean;
}

interface ListsModule {
  createList(input: ListInputPayload): Promise<ActionResult<List>>;
  updateList(input: { id: string; patch: Partial<ListInputPayload> }): Promise<ActionResult<List>>;
  deleteList(input: { id: string; confirm: boolean }): Promise<ActionResult<null>>;
  addListItem(input: { listId: string; text: string }): Promise<ActionResult<ListItem>>;
  updateListItem(input: {
    id: string;
    patch: { text?: string; section?: string | null };
  }): Promise<ActionResult<ListItem>>;
  setListItemChecked(input: { id: string; checked: boolean }): Promise<ActionResult<ListItem>>;
  moveListItem(input: {
    id: string;
    previousItemId: string | null;
    nextItemId: string | null;
    section: string | null;
  }): Promise<ActionResult<ListItem>>;
  deleteListItem(input: { id: string }): Promise<ActionResult<null>>;
  clearCompletedItems(input: { listId: string; confirm: boolean }): Promise<ActionResult<{ removed: number }>>;
  sectionItems(input: {
    listId: string;
    name: string;
    itemIds: string[];
  }): Promise<ActionResult<{ section: string; moved: number }>>;
  renameSection(input: {
    listId: string;
    from: string;
    to: string;
  }): Promise<ActionResult<{ section: string; renamed: number }>>;
  removeSection(input: { listId: string; name: string }): Promise<ActionResult<{ ungrouped: number }>>;
}

// Imported statically (unlike the rewards suite's runtime join): the module exists, and a
// static import is what makes it reachable to the dead-code gate before the tab mounts it.
const lists = listsModule as Partial<ListsModule>;

/** Names the missing export, so a RED run says which task has not landed yet. */
function verb<K extends keyof ListsModule>(name: K): NonNullable<Partial<ListsModule>[K]> {
  const fn = lists[name];
  if (fn === undefined) throw new Error(`lib/family/actions/lists.ts does not export ${name} yet`);
  return fn;
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

interface StoredList {
  id: string;
  name: string;
  kind: string;
  color: string;
  parents_only: boolean;
  sort_order: string;
  created_by: string | null;
  updated_by: string | null;
}

interface StoredItem {
  id: string;
  list_id: string;
  text: string;
  section: string | null;
  checked_at: string | null;
  checked_by: string | null;
  sort_order: string;
  created_by: string | null;
}

describe("lists: the twelve actions, open to every punched-in Profile save on a Parents only list", () => {
  const fx = fixtures();
  const run = fx.run;
  const ANA_PIN = "8181";
  const CLEO_PIN = "8383";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  /** A parent. */
  let anaId: string;
  /** A member — FR-534's "anyone", and FR-535's refusal target on the Parents only list. */
  let cleoId: string;
  /** Re-seeded before every test: a plain list with four items, and a Parents only list with one. */
  let groceryId: string;
  let partyId: string;
  let eggsId: string;
  let milkId: string;
  let bagelsId: string;
  let yoghurtId: string;
  let cakeId: string;
  /** A list and an item of the other household — never reachable from this one. */
  let foreignListId: string;
  let foreignItemId: string;

  async function insertList(
    targetHouseholdId: string,
    seed: { name: string; parentsOnly?: boolean; sortOrder?: number; kind?: string },
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.lists (household_id, name, kind, color, parents_only, sort_order, created_by, updated_by) " +
        "values ($1, $2, $3, '#B6E085', $4, $5, $6, $6) returning id",
      [
        targetHouseholdId,
        seed.name,
        seed.kind ?? "grocery",
        seed.parentsOnly ?? false,
        seed.sortOrder ?? 1000,
        targetHouseholdId === householdId ? anaId : null,
      ],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.lists returned no row");
    return row.id;
  }

  async function insertItem(
    targetHouseholdId: string,
    listId: string,
    seed: { text: string; sortOrder: number; section?: string | null; checked?: boolean },
  ): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.list_items (household_id, list_id, text, section, sort_order, checked_at, checked_by, created_by) " +
        "values ($1, $2, $3, $4, $5, $6, $7, $8) returning id",
      [
        targetHouseholdId,
        listId,
        seed.text,
        seed.section ?? null,
        seed.sortOrder,
        seed.checked ? new Date().toISOString() : null,
        seed.checked && targetHouseholdId === householdId ? anaId : null,
        targetHouseholdId === householdId ? anaId : null,
      ],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.list_items returned no row");
    return row.id;
  }

  async function storedLists(targetHouseholdId = householdId): Promise<StoredList[]> {
    const { rows } = await pool.query<StoredList>(
      "select id, name, kind, color, parents_only, sort_order::text as sort_order, created_by, updated_by " +
        "from family.lists where household_id = $1 order by sort_order, created_at",
      [targetHouseholdId],
    );
    return rows;
  }

  async function storedList(id: string): Promise<StoredList | undefined> {
    return (await storedLists()).find((row) => row.id === id);
  }

  async function storedItems(listId: string): Promise<StoredItem[]> {
    const { rows } = await pool.query<StoredItem>(
      "select id, list_id, text, section, checked_at::text as checked_at, checked_by, sort_order::text as sort_order, created_by " +
        "from family.list_items where list_id = $1 order by sort_order, created_at",
      [listId],
    );
    return rows;
  }

  async function storedItem(id: string): Promise<StoredItem | undefined> {
    const { rows } = await pool.query<StoredItem>(
      "select id, list_id, text, section, checked_at::text as checked_at, checked_by, sort_order::text as sort_order, created_by " +
        "from family.list_items where id = $1",
      [id],
    );
    return rows[0];
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

    householdId = await insertHousehold(pool, `test-${run}-lists-actions`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-lists-actions-other`);

    const email = testEmail("lists-actions", run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      email,
    ]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error("expected one fixture account");
    user = created;

    anaId = await insertCategory(pool, { householdId, label: `Ana ${run}`, color: "#2178AF", role: "parent" });
    cleoId = await insertCategory(pool, { householdId, label: `Cleo ${run}`, color: "#93D1E6" });

    foreignListId = await insertList(otherHouseholdId, { name: `Foreign ${run}` });
    foreignItemId = await insertItem(otherHouseholdId, foreignListId, { text: "Foreign item", sortOrder: 1000 });

    // Binds the allowlist row to the account, exactly as the first sign-in does.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(anaId, ANA_PIN);
    await givePin(cleoId, CLEO_PIN);
  });

  beforeEach(async () => {
    // Items cascade with the list.
    await pool.query("delete from family.lists where household_id = $1", [householdId]);
    groceryId = await insertList(householdId, { name: `Grocery ${run}`, sortOrder: 1000 });
    partyId = await insertList(householdId, { name: `Party ${run}`, parentsOnly: true, sortOrder: 2000, kind: "other" });
    eggsId = await insertItem(householdId, groceryId, { text: "Eggs", sortOrder: 1000 });
    milkId = await insertItem(householdId, groceryId, { text: "Milk", sortOrder: 2000 });
    bagelsId = await insertItem(householdId, groceryId, { text: "Bagels", sortOrder: 3000, section: "Bakery" });
    yoghurtId = await insertItem(householdId, groceryId, { text: "Yoghurt", sortOrder: 4000, section: "Dairy", checked: true });
    cakeId = await insertItem(householdId, partyId, { text: "Cake", sortOrder: 1000 });
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

  const plainList = (overrides: Partial<ListInputPayload> = {}): ListInputPayload => ({
    name: `Packing ${run}`,
    kind: "other",
    color: "#FBA994",
    parentsOnly: false,
    ...overrides,
  });

  // ── nobody ────────────────────────────────────────────────────────────────

  describe("with nobody punched in every verb is NO_ACTOR and nothing is written", () => {
    it("createList, addListItem, setListItemChecked, clearCompletedItems", async () => {
      const listsBefore = await storedLists();
      const itemsBefore = await storedItems(groceryId);
      expectFailure(await verb("createList")(plainList()), "NO_ACTOR");
      expectFailure(await verb("addListItem")({ listId: groceryId, text: "Coffee" }), "NO_ACTOR");
      expectFailure(await verb("setListItemChecked")({ id: eggsId, checked: true }), "NO_ACTOR");
      expectFailure(await verb("clearCompletedItems")({ listId: groceryId, confirm: true }), "NO_ACTOR");
      expect(await storedLists()).toEqual(listsBefore);
      expect(await storedItems(groceryId)).toEqual(itemsBefore);
    });
  });

  // ── a member, on a plain list (FR-534) ────────────────────────────────────

  describe("a punched-in MEMBER writes a plain list like anyone (FR-534)", () => {
    beforeEach(async () => {
      await punchInAs(cleoId, CLEO_PIN);
    });

    it("createList appends the list at the end of the row, attributed to the member", async () => {
      const made = expectOk(await verb("createList")(plainList()));
      expect(made).toMatchObject({ name: `Packing ${run}`, kind: "other", color: "#FBA994", parentsOnly: false });
      expect(made.createdBy).toBe(cleoId);
      expect(made.updatedBy).toBe(cleoId);
      expect(made.sortOrder).toBeGreaterThan(2000);
      const rows = await storedLists();
      expect(rows.map((row) => row.name)).toEqual([`Grocery ${run}`, `Party ${run}`, `Packing ${run}`]);
    });

    it("createList refuses a bad kind, an off-palette colour and an invented key, writing nothing", async () => {
      const before = await storedLists();
      expectFieldError(await verb("createList")({ ...plainList(), kind: "shopping" as "other" }), "kind");
      expectFieldError(await verb("createList")(plainList({ color: "#123456" })), "color");
      expectFailure(
        await verb("createList")({ ...plainList(), count: 3 } as unknown as ListInputPayload),
        "VALIDATION",
      );
      expect(await storedLists()).toEqual(before);
    });

    it("updateList judges the MERGED list and moves updated_by; the rest stays", async () => {
      const updated = expectOk(await verb("updateList")({ id: groceryId, patch: { name: `Shopping ${run}` } }));
      expect(updated).toMatchObject({ name: `Shopping ${run}`, kind: "grocery", color: "#B6E085", parentsOnly: false });
      const stored = await storedList(groceryId);
      expect(stored?.created_by).toBe(anaId);
      expect(stored?.updated_by).toBe(cleoId);
      expectFieldError(await verb("updateList")({ id: groceryId, patch: { kind: "shopping" as "other" } }), "kind");
    });

    it("deleteList needs confirm: true, then cascades the items", async () => {
      expectFailure(await verb("deleteList")({ id: groceryId, confirm: false }), "VALIDATION");
      expect(await storedList(groceryId)).toBeDefined();
      expectOk(await verb("deleteList")({ id: groceryId, confirm: true }));
      expect(await storedList(groceryId)).toBeUndefined();
      expect(await storedItems(groceryId)).toEqual([]);
    });

    it("addListItem appends ungrouped, trimmed and attributed; blank or 201 characters is VALIDATION", async () => {
      const added = expectOk(await verb("addListItem")({ listId: groceryId, text: "  Coffee " }));
      expect(added).toMatchObject({ listId: groceryId, text: "Coffee", section: null, checkedAt: null, createdBy: cleoId });
      expect(added.sortOrder).toBe(5000);
      expectFieldError(await verb("addListItem")({ listId: groceryId, text: "   " }), "text");
      expectFieldError(await verb("addListItem")({ listId: groceryId, text: "x".repeat(201) }), "text");
      expect((await storedItems(groceryId)).map((row) => row.text)).toEqual(["Eggs", "Milk", "Bagels", "Yoghurt", "Coffee"]);
    });

    it("updateListItem renames, and a section typed as ' dairy' lands in the existing Dairy (FR-529)", async () => {
      const renamed = expectOk(await verb("updateListItem")({ id: eggsId, patch: { text: "Free-range eggs" } }));
      expect(renamed.text).toBe("Free-range eggs");
      expect(renamed.section).toBeNull();
      const moved = expectOk(await verb("updateListItem")({ id: milkId, patch: { section: " dairy " } }));
      expect(moved.section).toBe("Dairy");
      const fresh = expectOk(await verb("updateListItem")({ id: eggsId, patch: { section: "Pantry" } }));
      expect(fresh.section).toBe("Pantry");
      const ungrouped = expectOk(await verb("updateListItem")({ id: bagelsId, patch: { section: null } }));
      expect(ungrouped.section).toBeNull();
      expectFailure(await verb("updateListItem")({ id: eggsId, patch: {} }), "VALIDATION");
    });

    it("setListItemChecked is a state, not a transition: twice is once, and unchecking nulls both (SC-504)", async () => {
      const first = expectOk(await verb("setListItemChecked")({ id: eggsId, checked: true }));
      expect(first.checkedAt).not.toBeNull();
      expect(first.checkedBy).toBe(cleoId);
      const second = expectOk(await verb("setListItemChecked")({ id: eggsId, checked: true }));
      expect(second.checkedBy).toBe(cleoId);
      expect(second.checkedAt).not.toBeNull();
      const back = expectOk(await verb("setListItemChecked")({ id: eggsId, checked: false }));
      expect(back.checkedAt).toBeNull();
      expect(back.checkedBy).toBeNull();
      const again = expectOk(await verb("setListItemChecked")({ id: eggsId, checked: false }));
      expect(again.checkedAt).toBeNull();
    });

    it("moveListItem writes the position between the neighbours AND the section in one row", async () => {
      // Milk goes just under the Bakery header: between Eggs (1000) and Bagels (3000), section Bakery.
      const moved = expectOk(
        await verb("moveListItem")({ id: milkId, previousItemId: eggsId, nextItemId: bagelsId, section: "Bakery" }),
      );
      expect(moved.sortOrder).toBe(2000);
      expect(moved.section).toBe("Bakery");
      // Bagels to the very top, ungrouped.
      const top = expectOk(await verb("moveListItem")({ id: bagelsId, previousItemId: null, nextItemId: eggsId, section: null }));
      expect(top.sortOrder).toBeLessThan(1000);
      expect(top.section).toBeNull();
      // Yoghurt to the end of Dairy spelled loosely: keeps the stored spelling.
      const tail = expectOk(
        await verb("moveListItem")({ id: yoghurtId, previousItemId: milkId, nextItemId: null, section: "dairy" }),
      );
      expect(tail.section).toBe("Dairy");
      expect(tail.sortOrder).toBeGreaterThan(2000);
    });

    it("moveListItem refuses a neighbour that is not an item of the same list", async () => {
      expectFailure(
        await verb("moveListItem")({ id: milkId, previousItemId: cakeId, nextItemId: null, section: null }),
        "NOT_FOUND",
      );
      expectFailure(
        await verb("moveListItem")({ id: milkId, previousItemId: null, nextItemId: foreignItemId, section: null }),
        "NOT_FOUND",
      );
      expect((await storedItem(milkId))?.sort_order).toBe("2000");
    });

    it("deleteListItem removes the one row", async () => {
      expectOk(await verb("deleteListItem")({ id: milkId }));
      expect((await storedItems(groceryId)).map((row) => row.text)).toEqual(["Eggs", "Bagels", "Yoghurt"]);
    });

    it("clearCompletedItems removes exactly the checked rows, in one write, and says how many (SC-505)", async () => {
      expectOk(await verb("setListItemChecked")({ id: eggsId, checked: true }));
      expectFailure(await verb("clearCompletedItems")({ listId: groceryId, confirm: false }), "VALIDATION");
      const cleared = expectOk(await verb("clearCompletedItems")({ listId: groceryId, confirm: true }));
      expect(cleared).toEqual({ removed: 2 });
      expect((await storedItems(groceryId)).map((row) => row.text)).toEqual(["Milk", "Bagels"]);
      // The Parents only list's item is untouched — the clear is per list.
      expect((await storedItems(partyId)).map((row) => row.text)).toEqual(["Cake"]);
    });

    it("sectionItems puts the chosen items under one name, merging case-insensitively into Dairy", async () => {
      const made = expectOk(await verb("sectionItems")({ listId: groceryId, name: " DAIRY", itemIds: [eggsId, milkId] }));
      expect(made).toEqual({ section: "Dairy", moved: 2 });
      expect((await storedItem(eggsId))?.section).toBe("Dairy");
      const fresh = expectOk(await verb("sectionItems")({ listId: groceryId, name: "Pantry", itemIds: [bagelsId] }));
      expect(fresh).toEqual({ section: "Pantry", moved: 1 });
      expectFieldError(await verb("sectionItems")({ listId: groceryId, name: "Pantry", itemIds: [] }), "itemIds");
      expectFailure(await verb("sectionItems")({ listId: groceryId, name: "Pantry", itemIds: [cakeId] }), "NOT_FOUND");
    });

    it("renameSection renames across every item, merges into an existing spelling, and refuses an unknown one", async () => {
      expect(await verb("renameSection")({ listId: groceryId, from: "Bakery", to: "Bread & cakes" })).toMatchObject({
        ok: true,
        data: { section: "Bread & cakes", renamed: 1 },
      });
      expect((await storedItem(bagelsId))?.section).toBe("Bread & cakes");
      const merged = expectOk(await verb("renameSection")({ listId: groceryId, from: "Bread & cakes", to: "dairy" }));
      expect(merged).toEqual({ section: "Dairy", renamed: 1 });
      expect((await storedItem(bagelsId))?.section).toBe("Dairy");
      expectFailure(await verb("renameSection")({ listId: groceryId, from: "Nope", to: "Whatever" }), "NOT_FOUND");
    });

    it("removeSection ungroups the items and keeps every one of them", async () => {
      const removed = expectOk(await verb("removeSection")({ listId: groceryId, name: "Dairy" }));
      expect(removed).toEqual({ ungrouped: 1 });
      const yoghurt = await storedItem(yoghurtId);
      expect(yoghurt?.section).toBeNull();
      expect(yoghurt?.checked_at).not.toBeNull();
      expect(await storedItems(groceryId)).toHaveLength(4);
      expectFailure(await verb("removeSection")({ listId: groceryId, name: "Dairy" }), "NOT_FOUND");
    });
  });

  // ── Parents only (FR-514, FR-535, R505) ───────────────────────────────────

  describe("a Parents only list is NOT_FOUND to a member on every write, and a parent's like any other", () => {
    it("a member: every list and item verb answers NOT_FOUND, never FORBIDDEN, and nothing is written", async () => {
      await punchInAs(cleoId, CLEO_PIN);
      const before = await storedItems(partyId);
      const list = await storedList(partyId);
      const results = [
        await verb("updateList")({ id: partyId, patch: { name: `Seen ${run}` } }),
        await verb("updateList")({ id: partyId, patch: { parentsOnly: false } }),
        await verb("deleteList")({ id: partyId, confirm: true }),
        await verb("addListItem")({ listId: partyId, text: "Balloons" }),
        await verb("updateListItem")({ id: cakeId, patch: { text: "Cupcakes" } }),
        await verb("setListItemChecked")({ id: cakeId, checked: true }),
        await verb("moveListItem")({ id: cakeId, previousItemId: null, nextItemId: null, section: null }),
        await verb("deleteListItem")({ id: cakeId }),
        await verb("clearCompletedItems")({ listId: partyId, confirm: true }),
        await verb("sectionItems")({ listId: partyId, name: "Food", itemIds: [cakeId] }),
        await verb("renameSection")({ listId: partyId, from: "Food", to: "Drinks" }),
        await verb("removeSection")({ listId: partyId, name: "Food" }),
      ];
      for (const result of results) expectFailure(result, "NOT_FOUND");
      expect(await storedItems(partyId)).toEqual(before);
      expect(await storedList(partyId)).toEqual(list);
    });

    it("a parent: the same calls succeed, and may turn Parents only off", async () => {
      await punchInAs(anaId, ANA_PIN);
      const added = expectOk(await verb("addListItem")({ listId: partyId, text: "Balloons" }));
      expect(added.listId).toBe(partyId);
      expectOk(await verb("setListItemChecked")({ id: cakeId, checked: true }));
      const opened = expectOk(await verb("updateList")({ id: partyId, patch: { parentsOnly: false } }));
      expect(opened.parentsOnly).toBe(false);
      // Now a member can reach it.
      await punchInAs(cleoId, CLEO_PIN);
      expectOk(await verb("addListItem")({ listId: partyId, text: "Candles" }));
    });

    it("a parent may turn Parents only ON, after which the member's next write is refused", async () => {
      await punchInAs(anaId, ANA_PIN);
      expectOk(await verb("updateList")({ id: groceryId, patch: { parentsOnly: true } }));
      await punchInAs(cleoId, CLEO_PIN);
      expectFailure(await verb("addListItem")({ listId: groceryId, text: "Coffee" }), "NOT_FOUND");
    });
  });

  // ── tenancy (FR-539) ─────────────────────────────────────────────────────

  describe("another household's rows are absent, not forbidden (FR-539)", () => {
    beforeEach(async () => {
      await punchInAs(anaId, ANA_PIN);
    });

    it("a foreign list and item, and an unknown id, are NOT_FOUND on every path", async () => {
      expectFailure(await verb("updateList")({ id: foreignListId, patch: { name: "Mine now" } }), "NOT_FOUND");
      expectFailure(await verb("deleteList")({ id: foreignListId, confirm: true }), "NOT_FOUND");
      expectFailure(await verb("addListItem")({ listId: foreignListId, text: "Intruder" }), "NOT_FOUND");
      expectFailure(await verb("setListItemChecked")({ id: foreignItemId, checked: true }), "NOT_FOUND");
      expectFailure(await verb("deleteListItem")({ id: foreignItemId }), "NOT_FOUND");
      expectFailure(await verb("clearCompletedItems")({ listId: foreignListId, confirm: true }), "NOT_FOUND");
      expectFailure(await verb("removeSection")({ listId: UNKNOWN_ID, name: "Dairy" }), "NOT_FOUND");
      expect(await storedLists(otherHouseholdId)).toHaveLength(1);
      expect((await storedItems(foreignListId)).map((row) => row.text)).toEqual(["Foreign item"]);
    });
  });
});
