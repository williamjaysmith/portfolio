import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  familyKeys,
  fetchRedemptions,
  fetchRewards,
  fetchStarBalances,
  fetchStarWeek,
  prefetchTaskWeek,
  useRedemptions,
  useRewards,
  useStarBalances,
  useStarWeek,
} from "@/lib/family/queries";
import {
  REDEMPTION_COLUMNS,
  STAR_BALANCE_COLUMNS,
  STAR_ENTRY_COLUMNS,
  rewardsSelect,
  toStarEntry,
  type StarEntryRow,
} from "@/lib/family/rows";

/**
 * 004 T015 / R407 — the four rewards reads: their keys, their request shapes,
 * and the hooks that seed them from a page's server read.
 *
 * Three things only this tier can pin. The keys are PREFIX-SHAPED under
 * `familyKeys.all`, which is what lets the Realtime channel's one bare
 * invalidation (R411) sweep a balance that moved on another device. The star
 * week is windowed on `earned_on` — the day the stars were EARNED, which for a
 * late chore is the day it was ticked — and takes credits and retractions only,
 * because the other three kinds carry no day and FR-407's pill is a day's net.
 * And `prefetchTaskWeek` warms the star week beside the resolutions, so a
 * Previous/Next tap across a week boundary lands on a pill that is already
 * right rather than one that flickers from 0.
 *
 * Faked at the query-builder surface the way `tasks-queries.test.ts` fakes it.
 */

interface Response {
  data: unknown;
  error: { message: string } | null;
}

interface FakeQuery {
  eq(column: string, value: string): FakeQuery;
  gte(column: string, value: string): FakeQuery;
  lte(column: string, value: string): FakeQuery;
  in(column: string, values: readonly string[]): FakeQuery;
  or(filter: string): FakeQuery;
  order(column: string, options: { ascending: boolean }): FakeQuery;
  then(resolve: (value: Response) => void): void;
}

function fakeClient(response: Response = { data: [], error: null }) {
  const calls: unknown[][] = [];
  const record =
    (method: string) =>
    (...args: unknown[]): FakeQuery => {
      calls.push([method, ...args]);
      return query;
    };
  const query: FakeQuery = {
    eq: record("eq"),
    gte: record("gte"),
    lte: record("lte"),
    in: record("in"),
    or: record("or"),
    order: record("order"),
    then(resolve) {
      resolve(response);
    },
  };
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));
  const schema = vi.fn(() => ({ from }));
  return { supabase: { schema } as unknown as SupabaseClient, schema, from, select, calls };
}

// The hooks and the prefetch reach Supabase through `createClient()`; the
// module is replaced with a recorder that answers every read with no rows.
const live = vi.hoisted(() => ({ tables: [] as string[] }));

vi.mock("@/lib/family/supabase/client", () => {
  const query = {
    eq: () => query,
    gte: () => query,
    lte: () => query,
    in: () => query,
    or: () => query,
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

const HOUSEHOLD = "hh-1";
// 2026-10-04 is a Sunday; the anchored week runs to Saturday the 10th.
const WEEK_START = "2026-10-04";
const CLEO = "33333333-3333-4333-8333-333333333333";

describe("familyKeys — the four rewards keys are prefix-shaped under familyKeys.all (R407, R411)", () => {
  it.each([
    ["starWeek", familyKeys.starWeek(HOUSEHOLD, WEEK_START)],
    ["balances", familyKeys.balances(HOUSEHOLD)],
    ["rewards", familyKeys.rewards(HOUSEHOLD)],
    ["redemptions", familyKeys.redemptions(HOUSEHOLD)],
  ])("%s begins with familyKeys.all and names the household", (_name, key) => {
    expect(key.slice(0, familyKeys.all.length)).toEqual([...familyKeys.all]);
    expect(key).toContain(HOUSEHOLD);
  });

  it("keys the star week by its first day, the same unit as taskWeek", () => {
    expect(familyKeys.starWeek(HOUSEHOLD, WEEK_START)).toEqual([
      "family",
      "star-week",
      HOUSEHOLD,
      WEEK_START,
    ]);
    expect(familyKeys.starWeek(HOUSEHOLD, "2026-10-11")).not.toEqual(
      familyKeys.starWeek(HOUSEHOLD, WEEK_START),
    );
  });

  it("gives the three unwindowed reads distinct keys from each other and from the task reads", () => {
    const keys = [
      familyKeys.balances(HOUSEHOLD),
      familyKeys.rewards(HOUSEHOLD),
      familyKeys.redemptions(HOUSEHOLD),
      familyKeys.tasks(HOUSEHOLD),
      familyKeys.taskCursors(HOUSEHOLD),
    ].map((key) => JSON.stringify(key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("fetchStarWeek — the anchored week's credits and retractions, windowed on earned_on", () => {
  it("windows earned_on over the seven days from the week's first and takes the two dated kinds", async () => {
    const fake = fakeClient();

    await fetchStarWeek(fake.supabase, HOUSEHOLD, WEEK_START);

    expect(fake.schema).toHaveBeenCalledWith("family");
    expect(fake.from).toHaveBeenCalledWith("star_entries");
    expect(fake.select).toHaveBeenCalledWith(STAR_ENTRY_COLUMNS);
    expect(fake.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["gte", "earned_on", "2026-10-04"],
      ["lte", "earned_on", "2026-10-10"],
      ["in", "kind", ["credit", "retraction"]],
    ]);
  });

  it("maps each row to a StarEntry", async () => {
    const row: StarEntryRow = {
      id: "entry-1",
      household_id: HOUSEHOLD,
      category_id: CLEO,
      amount: 10,
      kind: "credit",
      earned_on: "2026-10-07",
      resolution_id: "res-1",
      redemption_id: null,
      summary: "Feed the cat",
      created_by: CLEO,
      entered_on: "2026-10-07",
      created_at: "2026-10-07T21:00:00.000Z",
    };
    const fake = fakeClient({ data: [row], error: null });

    await expect(fetchStarWeek(fake.supabase, HOUSEHOLD, WEEK_START)).resolves.toEqual([
      toStarEntry(row),
    ]);
  });

  it("throws a database error rather than reporting an empty week", async () => {
    const fake = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(fetchStarWeek(fake.supabase, HOUSEHOLD, WEEK_START)).rejects.toThrow(
      "permission denied",
    );
  });
});

describe("fetchStarBalances — the view, one row per Profile", () => {
  it("reads the view directly, scoped to the household, and never a wildcard", async () => {
    const fake = fakeClient({ data: [{ category_id: CLEO, balance: 15 }], error: null });

    await expect(fetchStarBalances(fake.supabase, HOUSEHOLD)).resolves.toEqual([
      { categoryId: CLEO, balance: 15 },
    ]);
    expect(fake.from).toHaveBeenCalledWith("star_balances");
    expect(fake.select).toHaveBeenCalledWith(STAR_BALANCE_COLUMNS);
    expect(fake.calls).toEqual([["eq", "household_id", HOUSEHOLD]]);
  });

  it("throws a database error rather than reporting every balance as nothing", async () => {
    const fake = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(fetchStarBalances(fake.supabase, HOUSEHOLD)).rejects.toThrow("permission denied");
  });
});

describe("fetchRewards — definitions with their eligibilities embedded", () => {
  it("selects the joined embed, oldest first", async () => {
    const fake = fakeClient();

    await fetchRewards(fake.supabase, HOUSEHOLD);

    expect(fake.from).toHaveBeenCalledWith("rewards");
    expect(fake.select).toHaveBeenCalledWith(rewardsSelect());
    expect(fake.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["order", "created_at", { ascending: true }],
    ]);
  });

  it("embeds the eligible Profiles as categoryIds", async () => {
    const fake = fakeClient({
      data: [
        {
          id: "reward-1",
          household_id: HOUSEHOLD,
          name: "Bake cookies",
          description: null,
          emoji: "🍪",
          point_value: 20,
          respawn_on_redemption: true,
          created_by: null,
          updated_by: null,
          created_at: "2026-10-01T00:00:00.000Z",
          updated_at: "2026-10-01T00:00:00.000Z",
          reward_eligibilities: [
            { household_id: HOUSEHOLD, reward_id: "reward-1", category_id: CLEO, created_at: "x" },
          ],
        },
      ],
      error: null,
    });

    const [reward] = await fetchRewards(fake.supabase, HOUSEHOLD);
    expect(reward.categoryIds).toEqual([CLEO]);
    expect(reward.pointValue).toBe(20);
    expect(reward.respawnOnRedemption).toBe(true);
  });

  it("throws a database error rather than reporting no rewards", async () => {
    const fake = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(fetchRewards(fake.supabase, HOUSEHOLD)).rejects.toThrow("permission denied");
  });
});

describe("fetchRedemptions — all of them, standing and reversed, newest first", () => {
  it("is unwindowed and ordered by redeemed_at descending", async () => {
    const fake = fakeClient();

    await fetchRedemptions(fake.supabase, HOUSEHOLD);

    expect(fake.from).toHaveBeenCalledWith("redemptions");
    expect(fake.select).toHaveBeenCalledWith(REDEMPTION_COLUMNS);
    expect(fake.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["order", "redeemed_at", { ascending: false }],
    ]);
  });

  it("keeps a reversed redemption in the list, mapped", async () => {
    const fake = fakeClient({
      data: [
        {
          id: "red-1",
          household_id: HOUSEHOLD,
          reward_id: "reward-1",
          category_id: CLEO,
          point_value: 20,
          reward_name: "Bake cookies",
          redeemed_on: "2026-10-05",
          redeemed_at: "2026-10-05T20:00:00.000Z",
          redeemed_by: CLEO,
          reversed_at: "2026-10-06T08:00:00.000Z",
          reversed_by: null,
        },
      ],
      error: null,
    });

    const [redemption] = await fetchRedemptions(fake.supabase, HOUSEHOLD);
    expect(redemption.reversedAt).toBe("2026-10-06T08:00:00.000Z");
    expect(redemption.rewardName).toBe("Bake cookies");
  });

  it("throws a database error rather than reporting no history", async () => {
    const fake = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(fetchRedemptions(fake.supabase, HOUSEHOLD)).rejects.toThrow("permission denied");
  });
});

/* ------------------------------------------------------------ the hooks -- */

function renderWith<T>(queryClient: QueryClient, hook: () => T) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(hook, { wrapper });
}

const SEEDED_ENTRY = toStarEntry({
  id: "entry-1",
  household_id: HOUSEHOLD,
  category_id: CLEO,
  amount: 5,
  kind: "credit",
  earned_on: WEEK_START,
  resolution_id: "res-1",
  redemption_id: null,
  summary: "Brush teeth",
  created_by: CLEO,
  entered_on: WEEK_START,
  created_at: "2026-10-04T13:00:00.000Z",
});

/** One hook, the key it must live under, and the seed a page would hand it. */
interface HookCase {
  name: string;
  key: readonly string[];
  seed: unknown[];
  useHook: () => { data: unknown; isPending: boolean };
}

const SEEDED_HOOKS: HookCase[] = [
  {
    name: "useStarWeek",
    key: familyKeys.starWeek(HOUSEHOLD, WEEK_START),
    seed: [SEEDED_ENTRY],
    useHook: () => useStarWeek(HOUSEHOLD, WEEK_START, [SEEDED_ENTRY]),
  },
  {
    name: "useStarBalances",
    key: familyKeys.balances(HOUSEHOLD),
    seed: [{ categoryId: CLEO, balance: 15 }],
    useHook: () => useStarBalances(HOUSEHOLD, [{ categoryId: CLEO, balance: 15 }]),
  },
  { name: "useRewards", key: familyKeys.rewards(HOUSEHOLD), seed: [], useHook: () => useRewards(HOUSEHOLD, []) },
  {
    name: "useRedemptions",
    key: familyKeys.redemptions(HOUSEHOLD),
    seed: [],
    useHook: () => useRedemptions(HOUSEHOLD, []),
  },
];

describe("the four hooks seed a page's server read as initialData under their own key", () => {
  beforeEach(() => {
    live.tables.length = 0;
  });

  it.each(SEEDED_HOOKS)("$name paints the seed at once, under its key, with no fetch", ({ key, seed, useHook }) => {
    const queryClient = new QueryClient();

    const { result } = renderWith(queryClient, useHook);

    expect(result.current.data).toEqual(seed);
    expect(result.current.isPending).toBe(false);
    expect(queryClient.getQueryData(key)).toEqual(seed);
    // Fresh under STALE_TIME: the first paint IS the server read (R314's shape).
    expect(live.tables).toEqual([]);
  });

  it("fetches through the browser client when nothing is seeded", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderWith(queryClient, () => useRewards(HOUSEHOLD));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(live.tables).toEqual(["rewards"]);
  });
});

describe("prefetchTaskWeek — warms the star week beside the resolutions (R407)", () => {
  beforeEach(() => {
    live.tables.length = 0;
  });

  it("fills BOTH windowed keys for the week it is given", async () => {
    const queryClient = new QueryClient();

    await prefetchTaskWeek(queryClient, HOUSEHOLD, WEEK_START);

    expect(queryClient.getQueryData(familyKeys.taskWeek(HOUSEHOLD, WEEK_START))).toEqual([]);
    expect(queryClient.getQueryData(familyKeys.starWeek(HOUSEHOLD, WEEK_START))).toEqual([]);
    expect([...live.tables].sort()).toEqual(["star_entries", "task_resolutions"]);
  });
});
