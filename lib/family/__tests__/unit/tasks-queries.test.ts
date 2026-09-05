import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  fetchTaskBox,
  fetchTaskCarryForward,
  fetchTaskCursors,
  fetchTaskResolutions,
  fetchTasks,
} from "@/lib/family/queries";
import {
  TASK_BOX_COLUMNS,
  TASK_CURSOR_COLUMNS,
  TASK_RESOLUTION_COLUMNS,
  tasksSelect,
} from "@/lib/family/rows";

/**
 * T027 / R314 — the request SHAPE of the board's five reads, faked at the
 * query-builder surface the way `queries-count.test.ts` fakes it.
 *
 * The live-data half of this task is `__tests__/policies/tasks-read.test.ts`.
 * What only this tier can pin is the shape itself: the exact `or` string of the
 * week read, the disjointness of the carry window, and the two properties a
 * green board would hide if they broke — that the cursor tail is fetched by its
 * OWN query (a PostgREST embed on a view returns nothing rather than erroring,
 * so Completed Date would just be missing), and that no select ever names the
 * reserved star value (FR-329, SC-319).
 */

interface Response {
  data: unknown[] | null;
  error: { message: string } | null;
}

interface FakeQuery {
  eq(column: string, value: string): FakeQuery;
  or(filter: string): FakeQuery;
  gte(column: string, value: string): FakeQuery;
  lte(column: string, value: string): FakeQuery;
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
    or: record("or"),
    gte: record("gte"),
    lte: record("lte"),
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

const HOUSEHOLD = "hh-1";
// 2026-10-04 is a Sunday; 2026-10-07 the Wednesday inside that week.
const WEEK_START = "2026-10-04";
const TODAY = "2026-10-07";

describe("fetchTasks — read 1, unwindowed", () => {
  it("selects the task columns with the assignees embedded and filters only by household", async () => {
    const fake = fakeClient();

    await fetchTasks(fake.supabase, HOUSEHOLD);

    expect(fake.schema).toHaveBeenCalledWith("family");
    expect(fake.from).toHaveBeenCalledWith("tasks");
    expect(fake.select).toHaveBeenCalledWith(tasksSelect());
    expect(fake.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["order", "created_at", { ascending: true }],
    ]);
  });

  it("keeps the separator between the columns and the embed", () => {
    // The bundler folded two adjacent template literals in the shipped events
    // select and ate the seam, which reached production as PGRST100 on every
    // client-side read. The joined form has no seam to lose.
    expect(tasksSelect()).toContain("updated_at,task_assignees(");
  });

  it("never embeds the cursor view, and now selects the star value (004 SC-418)", () => {
    expect(tasksSelect()).not.toContain("task_cursors");
    expect(tasksSelect()).toContain("reward_points");
  });
});

describe("fetchTaskResolutions — read 2, the anchored week plus every undated row", () => {
  it("windows by occurrence_date and always ORs in the undated rows", async () => {
    const fake = fakeClient();

    await fetchTaskResolutions(fake.supabase, HOUSEHOLD, WEEK_START);

    expect(fake.from).toHaveBeenCalledWith("task_resolutions");
    expect(fake.select).toHaveBeenCalledWith(TASK_RESOLUTION_COLUMNS);
    expect(fake.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      [
        "or",
        'and(occurrence_date.gte."2026-10-04",occurrence_date.lte."2026-10-10"),' +
          "occurrence_date.is.null",
      ],
    ]);
  });

  it("throws a database error rather than reporting an empty board", async () => {
    const fake = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(fetchTaskResolutions(fake.supabase, HOUSEHOLD, WEEK_START)).rejects.toThrow(
      "permission denied",
    );
  });
});

describe("fetchTaskCarryForward — read 3, disjoint from the week", () => {
  it("bounds [today - CARRY_FORWARD_DAYS, weekStart(today) - 1] and takes no undated rows", async () => {
    const fake = fakeClient();

    await fetchTaskCarryForward(fake.supabase, HOUSEHOLD, TODAY, 0);

    expect(fake.select).toHaveBeenCalledWith(TASK_RESOLUTION_COLUMNS);
    expect(fake.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["gte", "occurrence_date", "2026-09-09"],
      // One day before the anchored week the other read already holds, so no
      // resolution row is ever fetched twice.
      ["lte", "occurrence_date", "2026-10-03"],
    ]);
  });

  it("follows the household's start-of-week when deciding where the week read takes over", async () => {
    const fake = fakeClient();

    await fetchTaskCarryForward(fake.supabase, HOUSEHOLD, TODAY, 1);

    expect(fake.calls).toContainEqual(["lte", "occurrence_date", "2026-10-04"]);
  });
});

describe("fetchTaskCursors — read 4, its own query", () => {
  it("reads the view directly, scoped to the household", async () => {
    const fake = fakeClient();

    await fetchTaskCursors(fake.supabase, HOUSEHOLD);

    expect(fake.from).toHaveBeenCalledWith("task_cursors");
    expect(fake.select).toHaveBeenCalledWith(TASK_CURSOR_COLUMNS);
    expect(fake.calls).toEqual([["eq", "household_id", HOUSEHOLD]]);
  });
});

describe("fetchTaskBox — read 5, lazy", () => {
  it("reads the three template fields, chores before routines", async () => {
    const fake = fakeClient();

    await fetchTaskBox(fake.supabase, HOUSEHOLD);

    expect(fake.from).toHaveBeenCalledWith("task_box_items");
    expect(fake.select).toHaveBeenCalledWith(TASK_BOX_COLUMNS);
    expect(TASK_BOX_COLUMNS).toContain("reward_points");
    expect(fake.calls).toEqual([
      ["eq", "household_id", HOUSEHOLD],
      ["order", "routine", { ascending: true }],
      ["order", "summary", { ascending: true }],
    ]);
  });
});
