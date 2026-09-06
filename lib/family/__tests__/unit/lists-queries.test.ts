import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { familyKeys, fetchListItems, fetchLists, useListItems, useLists } from "@/lib/family/queries";
import { LIST_COLUMNS, LIST_ITEM_COLUMNS, toList, toListItem } from "@/lib/family/rows";

/**
 * 005 T014 — the two reads (R506): keys prefix-shaped under `familyKeys.all` so
 * the realtime sweep reaches them, named columns (never `select('*')`), the
 * household filter, and the one order every device draws.
 */

interface Response {
  data: unknown;
  error: { message: string } | null;
}

function fakeClient(response: Response = { data: [], error: null }) {
  const calls: unknown[][] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  const query = {
    eq: record("eq"),
    order: record("order"),
    then(resolve: (value: Response) => void) {
      resolve(response);
    },
  };
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  const schema = vi.fn(() => ({ from }));
  return { supabase: { schema } as unknown as SupabaseClient, schema, from, select, calls };
}

const HOUSEHOLD = "hh-1";

describe("familyKeys — the two lists keys are prefix-shaped under familyKeys.all (R506)", () => {
  it.each([
    ["lists", familyKeys.lists(HOUSEHOLD)],
    ["listItems", familyKeys.listItems(HOUSEHOLD)],
  ])("%s begins with familyKeys.all and names the household", (_name, key) => {
    expect(key.slice(0, familyKeys.all.length)).toEqual([...familyKeys.all]);
    expect(key).toContain(HOUSEHOLD);
  });

  it("keeps the two keys apart from each other and from the rewards keys", () => {
    expect(familyKeys.lists(HOUSEHOLD)).not.toEqual(familyKeys.listItems(HOUSEHOLD));
    expect(familyKeys.lists(HOUSEHOLD)).not.toEqual(familyKeys.rewards(HOUSEHOLD));
  });
});

describe("fetchLists", () => {
  it("reads the named columns of the household's lists in row order, mapped", async () => {
    const client = fakeClient({
      data: [
        {
          id: "l1",
          household_id: HOUSEHOLD,
          name: "Grocery List",
          kind: "grocery",
          color: "#B6E085",
          parents_only: false,
          sort_order: "1000",
          created_by: null,
          updated_by: null,
          created_at: "2026-09-05T10:00:00.000Z",
          updated_at: "2026-09-05T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const lists = await fetchLists(client.supabase, HOUSEHOLD);

    expect(client.schema).toHaveBeenCalledWith("family");
    expect(client.from).toHaveBeenCalledWith("lists");
    expect(client.select).toHaveBeenCalledWith(LIST_COLUMNS);
    expect(client.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["order", "sort_order", { ascending: true }],
      ["order", "created_at", { ascending: true }],
    ]);
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ id: "l1", kind: "grocery", sortOrder: 1000 });
  });

  it("throws the store's message on an error", async () => {
    const client = fakeClient({ data: null, error: { message: "boom" } });
    await expect(fetchLists(client.supabase, HOUSEHOLD)).rejects.toThrow("boom");
  });
});

describe("fetchListItems", () => {
  it("reads every item of the household, unwindowed, in position order, mapped", async () => {
    const client = fakeClient({
      data: [
        {
          id: "i1",
          household_id: HOUSEHOLD,
          list_id: "l1",
          text: "Milk",
          section: null,
          checked_at: null,
          checked_by: null,
          sort_order: "2000",
          created_by: null,
          created_at: "2026-09-05T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const items = await fetchListItems(client.supabase, HOUSEHOLD);

    expect(client.from).toHaveBeenCalledWith("list_items");
    expect(client.select).toHaveBeenCalledWith(LIST_ITEM_COLUMNS);
    expect(client.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["order", "sort_order", { ascending: true }],
      ["order", "created_at", { ascending: true }],
    ]);
    expect(items[0]).toMatchObject({ id: "i1", listId: "l1", sortOrder: 2000 });
  });

  it("answers an empty array for no rows", async () => {
    const client = fakeClient({ data: null, error: null });
    expect(await fetchListItems(client.supabase, HOUSEHOLD)).toEqual([]);
  });
});

/* ------------------------------------------------------------ the hooks -- */

// The hooks reach Supabase through `createClient()`; the module is replaced
// with a recorder that answers every read with no rows.
const live = vi.hoisted(() => ({ tables: [] as string[] }));

vi.mock("@/lib/family/supabase/client", () => {
  const query = {
    eq: () => query,
    order: () => query,
    then(resolve: (value: { data: unknown[]; error: null }) => void) {
      resolve({ data: [], error: null });
    },
  };
  return {
    createClient: () => ({
      schema: () => ({
        from: (table: string) => {
          live.tables.push(table);
          return { select: () => query };
        },
      }),
    }),
  };
});

function renderWith<T>(queryClient: QueryClient, hook: () => T) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(hook, { wrapper });
}

const SEEDED_LIST = toList({
  id: "l1",
  household_id: HOUSEHOLD,
  name: "Grocery List",
  kind: "grocery",
  color: "#B6E085",
  parents_only: false,
  sort_order: "1000",
  created_by: null,
  updated_by: null,
  created_at: "2026-09-05T10:00:00.000Z",
  updated_at: "2026-09-05T10:00:00.000Z",
});

const SEEDED_ITEM = toListItem({
  id: "i1",
  household_id: HOUSEHOLD,
  list_id: "l1",
  text: "Milk",
  section: null,
  checked_at: null,
  checked_by: null,
  sort_order: "1000",
  created_by: null,
  created_at: "2026-09-05T10:00:00.000Z",
});

describe("useLists / useListItems — seeded by the page, keyed under familyKeys (R506)", () => {
  it("answers the page's seed at once, under the lists key, without a fetch", () => {
    const queryClient = new QueryClient();
    live.tables.length = 0;
    const { result } = renderWith(queryClient, () => useLists(HOUSEHOLD, [SEEDED_LIST]));
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toEqual([SEEDED_LIST]);
    expect(queryClient.getQueryData(familyKeys.lists(HOUSEHOLD))).toEqual([SEEDED_LIST]);
    expect(live.tables).toEqual([]);
  });

  it("answers the page's seed at once, under the list-items key, without a fetch", () => {
    const queryClient = new QueryClient();
    live.tables.length = 0;
    const { result } = renderWith(queryClient, () => useListItems(HOUSEHOLD, [SEEDED_ITEM]));
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toEqual([SEEDED_ITEM]);
    expect(queryClient.getQueryData(familyKeys.listItems(HOUSEHOLD))).toEqual([SEEDED_ITEM]);
    expect(live.tables).toEqual([]);
  });

  it("reads the two tables when a component mounts without a seed", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    live.tables.length = 0;
    renderWith(queryClient, () => useLists(HOUSEHOLD));
    renderWith(queryClient, () => useListItems(HOUSEHOLD));
    await vi.waitFor(() => expect(live.tables.sort()).toEqual(["list_items", "lists"]));
  });
});
