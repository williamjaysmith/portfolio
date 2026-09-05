import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { familyKeys, fetchCategoryTaskCounts } from "@/lib/family/queries";

/**
 * T055 / FR-391 — the two numbers the Profile-delete confirmation has to state,
 * because they are OPPOSITE and a household will notice: a task this Profile
 * shares with somebody else survives without them, and a task nobody else is
 * assigned to is deleted along with the Profile. A chore becomes up-for-grabs by
 * an explicit choice, never by attrition.
 *
 * A read, so not an action: the RLS path, over the pair
 * `task_assignees_category_idx` is keyed on. Faked at the query-builder surface
 * the way `queries-count.test.ts` fakes it — what matters is the request shape
 * and how the answer is counted.
 *
 * 004 FR-443 adds the dialog's third number: the stars the Profile forfeits,
 * read from `star_balances` as its SIGNED balance — positive is forfeited,
 * negative is a debt the deletion clears (Assumption 5), and the dialog words
 * each (T054). A Label, or a Profile with no entries, has no row and forfeits 0.
 */

interface Response {
  data: unknown;
  error: { message: string } | null;
}

function fakeClient(...responses: Response[]) {
  const calls: unknown[][] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  let next = 0;
  const query = {
    eq: record("eq"),
    in: record("in"),
    maybeSingle: record("maybeSingle"),
    then(resolve: (value: Response) => void) {
      resolve(responses[next++] ?? { data: [], error: null });
    },
  };
  const select = vi.fn((columns: string) => {
    calls.push(["select", columns]);
    return query;
  });
  const from = vi.fn((table: string) => {
    calls.push(["from", table]);
    return { select };
  });
  const schema = vi.fn(() => ({ from }));
  return { supabase: { schema } as unknown as SupabaseClient, schema, calls };
}

const MINE = [{ task_id: "t1" }, { task_id: "t2" }, { task_id: "t3" }];

/** The view's row for this Profile, as `.maybeSingle()` hands it over. */
const BALANCE = { data: { balance: 12 }, error: null };

/** t1 is shared with Ben, t2 and t3 are this Profile's alone. */
const EVERY_ASSIGNEE = [
  { task_id: "t1", category_id: "cat-1" },
  { task_id: "t1", category_id: "ben" },
  { task_id: "t2", category_id: "cat-1" },
  { task_id: "t3", category_id: "cat-1" },
];

describe("fetchCategoryTaskCounts", () => {
  it("splits this Profile's tasks into the ones that survive and the ones that go, and names the stars", async () => {
    const fake = fakeClient(
      { data: MINE, error: null },
      { data: EVERY_ASSIGNEE, error: null },
      BALANCE,
    );

    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).resolves.toEqual({
      losingAnAssignee: 1,
      deleted: 2,
      starsForfeited: 12,
    });
  });

  it("asks only for the columns it counts, scoped to the household every time", async () => {
    const fake = fakeClient(
      { data: MINE, error: null },
      { data: EVERY_ASSIGNEE, error: null },
      BALANCE,
    );
    await fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1");

    expect(fake.schema).toHaveBeenCalledWith("family");
    expect(fake.calls).toEqual([
      ["from", "task_assignees"],
      ["select", "task_id"],
      ["eq", "household_id", "hh-1"],
      ["eq", "category_id", "cat-1"],
      ["from", "task_assignees"],
      ["select", "task_id, category_id"],
      ["eq", "household_id", "hh-1"],
      ["in", "task_id", ["t1", "t2", "t3"]],
      // The view (025) is `security_invoker`, so this is the caller's own RLS.
      ["from", "star_balances"],
      ["select", "balance"],
      ["eq", "household_id", "hh-1"],
      ["eq", "category_id", "cat-1"],
      ["maybeSingle"],
    ]);
  });

  it("answers zero tasks without the second task read when nothing is assigned, and still reads the stars", async () => {
    const fake = fakeClient({ data: [], error: null }, BALANCE);

    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).resolves.toEqual({
      losingAnAssignee: 0,
      deleted: 0,
      starsForfeited: 12,
    });
    expect(fake.calls.filter(([method]) => method === "from")).toEqual([
      ["from", "task_assignees"],
      ["from", "star_balances"],
    ]);
  });

  it("forfeits nothing when the view has no row — a Label, or a Profile with no entries", async () => {
    const fake = fakeClient({ data: [], error: null }, { data: null, error: null });

    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).resolves.toMatchObject({
      starsForfeited: 0,
    });
  });

  it("keeps a negative balance signed — a debt the deletion clears (Assumption 5)", async () => {
    const fake = fakeClient({ data: [], error: null }, { data: { balance: -7 }, error: null });

    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).resolves.toMatchObject({
      starsForfeited: -7,
    });
  });

  it("throws on a database error rather than reporting a false zero", async () => {
    const fake = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).rejects.toThrow(
      "permission denied",
    );
  });

  it("throws when the balance read fails rather than promising nothing is forfeited", async () => {
    const fake = fakeClient(
      { data: [], error: null },
      { data: null, error: { message: "permission denied for view star_balances" } },
    );
    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).rejects.toThrow(
      "permission denied for view star_balances",
    );
  });

  /** Under the `["family"]` prefix, so Phase 1's bare sweep reaches it. */
  it("caches under a key the household-wide invalidation already sweeps", () => {
    expect(familyKeys.categoryTaskCounts("hh-1", "cat-1")).toEqual([
      "family",
      "category-task-counts",
      "hh-1",
      "cat-1",
    ]);
  });
});
