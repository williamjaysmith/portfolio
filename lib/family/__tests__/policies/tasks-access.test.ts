/**
 * T010 / SC-305 per path: `tasks`, `task_assignees`, `task_resolutions`,
 * `task_box_items` and the `task_cursors` view each read as a member (rows
 * arrive), as an authenticated non-member (`[]`) and anonymously (HTTP 401,
 * SQLSTATE 42501). **No client write path exists** on any of the four tables
 * (FR-390, data-model invariant 16): authenticated INSERT/UPDATE/DELETE all
 * fail 42501 with nothing written, because every task mutation goes through a
 * server action holding the secret key — RLS can see which account is asking
 * but never which Profile is punched in. The view is asserted
 * `security_invoker`, so it inherits `is_member()` on the underlying tables
 * rather than reading them as its owner and leaking every household.
 *
 * Fixture rows are inserted by this file as `postgres`, never taken from the
 * seed, so the suite cannot drift with seed fixtures.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import {
  LOCAL,
  anonClient,
  createPool,
  deleteHousehold,
  fixtures,
  insertCategory,
  insertHousehold,
  userClient,
} from "./helpers";

// Table → the columns a probe selects; RLS decides whether rows come back.
const TASK_TABLES = {
  tasks: "id, household_id",
  task_assignees: "task_id, category_id, household_id",
  task_resolutions: "id, task_id, household_id",
  task_box_items: "id, household_id",
} as const;

const CURSOR_VIEW = "task_cursors";
const CURSOR_COLUMNS = "household_id, task_id, assignee_id, tail_id, tail_resolved_on";

// A Completed Date chore: `renew_after_amount` is the mode (data-model 016),
// so one resolution on it publishes a row through the cursor view.
const STARTS_ON = "2026-09-01";
const OCCURRENCE_DATE = "2026-09-15";
const RESOLVED_ON = "2026-09-16";

/** A whole Completed Date chore — task, assignee, one resolution, one template. */
interface TaskFixture {
  taskId: string;
  resolutionId: string;
  boxItemId: string;
}

async function insertOne(pool: Pool, sql: string, values: readonly unknown[]): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(sql, [...values]);
  const [row] = rows;
  if (!row) throw new Error(`${sql} returned no row`);
  return row.id;
}

/** Inserts the whole set as `postgres` (bypasses grants, not constraints). */
async function insertTaskFixture(
  pool: Pool,
  householdId: string,
  profileId: string,
  tag: string,
): Promise<TaskFixture> {
  const taskId = await insertOne(
    pool,
    "insert into family.tasks (household_id, summary, starts_on, renew_after_amount, renew_after_unit) " +
      "values ($1, $2, $3, 14, 'day') returning id",
    [householdId, `Descale the kettle ${tag}`, STARTS_ON],
  );
  await pool.query(
    "insert into family.task_assignees (household_id, task_id, category_id) values ($1, $2, $3)",
    [householdId, taskId, profileId],
  );
  const resolutionId = await insertOne(
    pool,
    "insert into family.task_resolutions " +
      "(household_id, task_id, occurrence_date, assignee_id, category_id, status, resolved_on) " +
      "values ($1, $2, $3, $4, $4, 'complete', $5) returning id",
    [householdId, taskId, OCCURRENCE_DATE, profileId, RESOLVED_ON],
  );
  const boxItemId = await insertOne(
    pool,
    "insert into family.task_box_items (household_id, summary, emoji, routine) " +
      "values ($1, $2, '🪥', true) returning id",
    [householdId, `Brush teeth ${tag}`],
  );
  return { taskId, resolutionId, boxItemId };
}

describe("tasks access: SC-305 per path and the absent write path", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let otherHouseholdId: string;
  let mine: TaskFixture;
  let theirs: TaskFixture;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    stranger = await userClient(fx.users.stranger);

    // A second household with a full task row set on every path, so "returns
    // nothing" is proven against rows that really exist.
    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-tasks-other`);
    const otherProfileId = await insertCategory(pool, {
      householdId: otherHouseholdId,
      label: `Other kid ${fx.run}`,
      color: "#B6E085",
    });
    theirs = await insertTaskFixture(pool, otherHouseholdId, otherProfileId, `other-${fx.run}`);
    mine = await insertTaskFixture(pool, fx.householdId, fx.anchorParentId, fx.run);
  });

  afterAll(async () => {
    await deleteHousehold(pool, otherHouseholdId);
    // Assignees and resolutions cascade with the task.
    await pool.query("delete from family.tasks where id = $1", [mine.taskId]);
    await pool.query("delete from family.task_box_items where id = $1", [mine.boxItemId]);
    await pool.end();
  });

  it("a member reads their household's task rows — and no other household's", async () => {
    for (const table of Object.keys(TASK_TABLES)) {
      const result = await member.schema("family").from(table).select("household_id");
      expect(result.error, table).toBeNull();
      expect(result.data?.length, table).toBeGreaterThan(0);
      expect(result.data?.every((row) => row.household_id === fx.householdId), table).toBe(true);
    }

    const tasks = await member.schema("family").from("tasks").select(TASK_TABLES.tasks);
    expect(tasks.data).toContainEqual({ id: mine.taskId, household_id: fx.householdId });
    expect(tasks.data?.some((row) => row.id === theirs.taskId)).toBe(false);

    const assignees = await member
      .schema("family")
      .from("task_assignees")
      .select(TASK_TABLES.task_assignees);
    expect(assignees.data).toContainEqual({
      task_id: mine.taskId,
      category_id: fx.anchorParentId,
      household_id: fx.householdId,
    });

    const resolutions = await member
      .schema("family")
      .from("task_resolutions")
      .select(TASK_TABLES.task_resolutions);
    expect(resolutions.data).toContainEqual({
      id: mine.resolutionId,
      task_id: mine.taskId,
      household_id: fx.householdId,
    });

    const templates = await member
      .schema("family")
      .from("task_box_items")
      .select(TASK_TABLES.task_box_items);
    expect(templates.data).toContainEqual({ id: mine.boxItemId, household_id: fx.householdId });
  });

  it("a member reads the cursor view — the chain tail, and only their own", async () => {
    const result = await member.schema("family").from(CURSOR_VIEW).select(CURSOR_COLUMNS);
    expect(result.error).toBeNull();
    expect(result.data).toContainEqual({
      household_id: fx.householdId,
      task_id: mine.taskId,
      assignee_id: fx.anchorParentId,
      tail_id: mine.resolutionId,
      tail_resolved_on: RESOLVED_ON,
    });
    expect(result.data?.some((row) => row.task_id === theirs.taskId)).toBe(false);
    expect(result.data?.every((row) => row.household_id === fx.householdId)).toBe(true);
  });

  it("the cursor view is security_invoker, so it inherits is_member() (FR-390)", async () => {
    // Without it a view is read with its OWNER's privileges, which would hand
    // every household's chain tails to any authenticated caller.
    const { rows } = await pool.query<{ reloptions: string[] | null }>(
      "select reloptions from pg_class where oid = 'family.task_cursors'::regclass",
    );
    expect(rows[0]?.reloptions).toContain("security_invoker=true");
  });

  it("an authenticated non-member gets an empty set from every task path", async () => {
    for (const [table, columns] of Object.entries(TASK_TABLES)) {
      const result = await stranger.schema("family").from(table).select(columns);
      expect(result.error, table).toBeNull();
      expect(result.data, table).toEqual([]);
    }
    const cursors = await stranger.schema("family").from(CURSOR_VIEW).select(CURSOR_COLUMNS);
    expect(cursors.error).toBeNull();
    expect(cursors.data).toEqual([]);
  });

  it("anon with no session is refused on every task path: HTTP 401, SQLSTATE 42501", async () => {
    // Raw REST probe — the exact shape quickstart's SC-305 row documents.
    const response = await fetch(`${LOCAL.url}/rest/v1/tasks?select=id`, {
      headers: { apikey: LOCAL.publishableKey, "Accept-Profile": "family" },
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("42501");

    const anon = anonClient();
    for (const [table, columns] of Object.entries(TASK_TABLES)) {
      const result = await anon.schema("family").from(table).select(columns);
      expect(result.error?.code, table).toBe("42501");
      expect(result.data, table).toBeNull();
    }
    const cursors = await anon.schema("family").from(CURSOR_VIEW).select(CURSOR_COLUMNS);
    expect(cursors.error?.code).toBe("42501");
    expect(cursors.data).toBeNull();
  });

  it("authenticated INSERT is refused on every task table, nothing written (FR-390)", async () => {
    const probes: Record<string, Record<string, unknown>> = {
      tasks: { household_id: fx.householdId, summary: `Intruder ${fx.run}` },
      task_assignees: {
        household_id: fx.householdId,
        task_id: mine.taskId,
        category_id: fx.anchorParentId,
      },
      task_resolutions: {
        household_id: fx.householdId,
        task_id: mine.taskId,
        occurrence_date: "2026-09-29",
        assignee_id: fx.anchorParentId,
        category_id: fx.anchorParentId,
        status: "complete",
        resolved_on: "2026-09-29",
      },
      task_box_items: { household_id: fx.householdId, summary: `Intruder ${fx.run}` },
    };

    for (const [table, row] of Object.entries(probes)) {
      const result = await member.schema("family").from(table).insert(row);
      expect(result.error?.code, table).toBe("42501");
    }

    const { rows } = await pool.query(
      "select 1 from family.tasks where household_id = $1 and summary = $2",
      [fx.householdId, `Intruder ${fx.run}`],
    );
    expect(rows).toHaveLength(0);
  });

  it("authenticated UPDATE and DELETE are refused on every task table, rows intact", async () => {
    const updates: [string, Record<string, unknown>, string, string][] = [
      ["tasks", { summary: "Hijacked" }, "id", mine.taskId],
      ["task_assignees", { sort_order: 5 }, "task_id", mine.taskId],
      ["task_resolutions", { status: "skipped" }, "id", mine.resolutionId],
      ["task_box_items", { summary: "Hijacked" }, "id", mine.boxItemId],
    ];

    for (const [table, patch, column, value] of updates) {
      const update = await member.schema("family").from(table).update(patch).eq(column, value);
      expect(update.error?.code, `${table} update`).toBe("42501");
      const remove = await member.schema("family").from(table).delete().eq(column, value);
      expect(remove.error?.code, `${table} delete`).toBe("42501");
    }

    const { rows } = await pool.query<{ summary: string; n: string }>(
      "select t.summary, (select count(*)::text from family.task_resolutions r where r.task_id = t.id) as n " +
        "from family.tasks t where t.id = $1",
      [mine.taskId],
    );
    expect(rows[0]?.summary).toBe(`Descale the kettle ${fx.run}`);
    expect(rows[0]?.n).toBe("1");
  });
});
