import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { fetchCategoryEventCount } from "@/lib/family/queries";

/**
 * T051 — FR-274's affected-event count is a head-only RLS read on
 * `event_categories`, filtered by the pair `event_categories_category_idx`
 * is keyed on. The client is faked at the query-builder surface: what
 * matters is the exact request shape and how the answer is read.
 */

interface CountResponse {
  count: number | null;
  error: { message: string } | null;
}

function fakeClient(response: CountResponse) {
  const filters: [string, string][] = [];
  const query = {
    eq(column: string, value: string) {
      filters.push([column, value]);
      return query;
    },
    then(resolve: (value: CountResponse) => void) {
      resolve(response);
    },
  };
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  const schema = vi.fn(() => ({ from }));
  return { supabase: { schema } as unknown as SupabaseClient, schema, from, select, filters };
}

describe("fetchCategoryEventCount", () => {
  it("asks for an exact head-only count of the household's links to the category", async () => {
    const fake = fakeClient({ count: 3, error: null });

    await expect(fetchCategoryEventCount(fake.supabase, "hh-1", "cat-1")).resolves.toBe(3);

    expect(fake.schema).toHaveBeenCalledWith("family");
    expect(fake.from).toHaveBeenCalledWith("event_categories");
    expect(fake.select).toHaveBeenCalledWith("category_id", { count: "exact", head: true });
    expect(fake.filters).toEqual([
      ["household_id", "hh-1"],
      ["category_id", "cat-1"],
    ]);
  });

  it("reads a missing count as zero", async () => {
    const fake = fakeClient({ count: null, error: null });
    await expect(fetchCategoryEventCount(fake.supabase, "hh-1", "cat-1")).resolves.toBe(0);
  });

  it("throws on a database error rather than reporting a false zero", async () => {
    const fake = fakeClient({ count: null, error: { message: "permission denied" } });
    await expect(fetchCategoryEventCount(fake.supabase, "hh-1", "cat-1")).rejects.toThrow(
      "permission denied",
    );
  });
});
