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
 */

interface Response {
  data: unknown[] | null;
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

/** t1 is shared with Ben, t2 and t3 are this Profile's alone. */
const EVERY_ASSIGNEE = [
  { task_id: "t1", category_id: "cat-1" },
  { task_id: "t1", category_id: "ben" },
  { task_id: "t2", category_id: "cat-1" },
  { task_id: "t3", category_id: "cat-1" },
];

describe("fetchCategoryTaskCounts", () => {
  it("splits this Profile's tasks into the ones that survive and the ones that go", async () => {
    const fake = fakeClient({ data: MINE, error: null }, { data: EVERY_ASSIGNEE, error: null });

    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).resolves.toEqual({
      losingAnAssignee: 1,
      deleted: 2,
    });
  });

  it("asks only for the columns it counts, scoped to the household both times", async () => {
    const fake = fakeClient({ data: MINE, error: null }, { data: EVERY_ASSIGNEE, error: null });
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
    ]);
  });

  it("answers zero and zero without a second round trip when nothing is assigned", async () => {
    const fake = fakeClient({ data: [], error: null });

    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).resolves.toEqual({
      losingAnAssignee: 0,
      deleted: 0,
    });
    expect(fake.calls.filter(([method]) => method === "from")).toHaveLength(1);
  });

  it("throws on a database error rather than reporting a false zero", async () => {
    const fake = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(fetchCategoryTaskCounts(fake.supabase, "hh-1", "cat-1")).rejects.toThrow(
      "permission denied",
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
