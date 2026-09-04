/**
 * T010 / SC-203 per path: `events`, `event_categories` and `event_exceptions`
 * each read as a member (rows arrive), as an authenticated non-member (`[]`)
 * and anonymously (HTTP 401, SQLSTATE 42501). No client write path exists on
 * any of the three (FR-270/FR-273): authenticated INSERT/UPDATE/DELETE all
 * fail 42501 with nothing written, and `split_event_series` refuses every
 * non-service caller. Fixture rows are inserted by this file as `postgres`,
 * never taken from the seed, so the suite cannot drift with seed fixtures.
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
const CALENDAR_TABLES = {
  events: "id, household_id",
  event_categories: "event_id, category_id, household_id",
  event_exceptions: "id, event_id, household_id",
} as const;

// Canonical grammar order (FREQ;INTERVAL;UNTIL;WKST;BYDAY) — must pass 010's
// `^FREQ=` / no-COUNT CHECK as stored.
const SERIES_RRULE = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261215T235959Z;WKST=SU;BYDAY=TU";

interface EventSeed {
  householdId: string;
  summary: string;
  rrule?: string;
}

/** Inserts a timed event as `postgres` (bypasses grants, not constraints). */
async function insertEvent(pool: Pool, seed: EventSeed): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.events (household_id, summary, all_day, starts_at, ends_at, timezone, rrule) " +
      "values ($1, $2, false, '2026-10-06T14:00:00Z', '2026-10-06T15:00:00Z', 'UTC', $3) returning id",
    [seed.householdId, seed.summary, seed.rrule ?? null],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.events returned no row");
  return row.id;
}

async function insertLink(
  pool: Pool,
  householdId: string,
  eventId: string,
  categoryId: string,
): Promise<void> {
  await pool.query(
    "insert into family.event_categories (household_id, event_id, category_id, position) " +
      "values ($1, $2, $3, 0)",
    [householdId, eventId, categoryId],
  );
}

async function insertSkip(
  pool: Pool,
  householdId: string,
  eventId: string,
  occurrenceDate: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.event_exceptions (household_id, event_id, occurrence_date, action) " +
      "values ($1, $2, $3, 'skip') returning id",
    [householdId, eventId, occurrenceDate],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.event_exceptions returned no row");
  return row.id;
}

describe("events access: SC-203 per path and the absent write path", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let otherHouseholdId: string;
  let memberEventId: string;
  let memberSeriesId: string;
  let memberExceptionId: string;
  let otherEventId: string;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    stranger = await userClient(fx.users.stranger);

    // A second household with a full calendar row set on every path, so
    // "returns nothing" is proven against rows that really exist.
    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-events-other`);
    const otherCategoryId = await insertCategory(pool, {
      householdId: otherHouseholdId,
      label: `Other kid ${fx.run}`,
      color: "#B6E085",
    });
    otherEventId = await insertEvent(pool, {
      householdId: otherHouseholdId,
      summary: `Other series ${fx.run}`,
      rrule: SERIES_RRULE,
    });
    await insertLink(pool, otherHouseholdId, otherEventId, otherCategoryId);
    await insertSkip(pool, otherHouseholdId, otherEventId, "2026-10-13");

    memberEventId = await insertEvent(pool, {
      householdId: fx.householdId,
      summary: `One-off ${fx.run}`,
    });
    memberSeriesId = await insertEvent(pool, {
      householdId: fx.householdId,
      summary: `Series ${fx.run}`,
      rrule: SERIES_RRULE,
    });
    await insertLink(pool, fx.householdId, memberEventId, fx.anchorParentId);
    memberExceptionId = await insertSkip(pool, fx.householdId, memberSeriesId, "2026-10-13");
  });

  afterAll(async () => {
    await deleteHousehold(pool, otherHouseholdId);
    // Links and exceptions cascade with the events.
    await pool.query("delete from family.events where id = any($1::uuid[])", [
      [memberEventId, memberSeriesId],
    ]);
    await pool.end();
  });

  it("a member reads their household's events — and no other household's", async () => {
    const result = await member.schema("family").from("events").select(CALENDAR_TABLES.events);
    expect(result.error).toBeNull();
    expect(result.data).toContainEqual({ id: memberEventId, household_id: fx.householdId });
    expect(result.data).toContainEqual({ id: memberSeriesId, household_id: fx.householdId });
    expect(result.data?.some((row) => row.id === otherEventId)).toBe(false);
    expect(result.data?.every((row) => row.household_id === fx.householdId)).toBe(true);
  });

  it("a member reads their household's event–category links — and no other household's", async () => {
    const result = await member
      .schema("family")
      .from("event_categories")
      .select(CALENDAR_TABLES.event_categories);
    expect(result.error).toBeNull();
    expect(result.data).toContainEqual({
      event_id: memberEventId,
      category_id: fx.anchorParentId,
      household_id: fx.householdId,
    });
    expect(result.data?.every((row) => row.household_id === fx.householdId)).toBe(true);
  });

  it("a member reads their household's occurrence exceptions — and no other household's", async () => {
    const result = await member
      .schema("family")
      .from("event_exceptions")
      .select(CALENDAR_TABLES.event_exceptions);
    expect(result.error).toBeNull();
    expect(result.data).toContainEqual({
      id: memberExceptionId,
      event_id: memberSeriesId,
      household_id: fx.householdId,
    });
    expect(result.data?.every((row) => row.household_id === fx.householdId)).toBe(true);
  });

  it("an authenticated non-member gets an empty set from every calendar table", async () => {
    for (const [table, columns] of Object.entries(CALENDAR_TABLES)) {
      const result = await stranger.schema("family").from(table).select(columns);
      expect(result.error, table).toBeNull();
      expect(result.data, table).toEqual([]);
    }
  });

  it("anon with no session is refused on every calendar table: HTTP 401, SQLSTATE 42501", async () => {
    // Raw REST probe — the exact shape quickstart's SC-203 row documents.
    const response = await fetch(`${LOCAL.url}/rest/v1/events?select=id`, {
      headers: { apikey: LOCAL.publishableKey, "Accept-Profile": "family" },
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("42501");

    const anon = anonClient();
    for (const [table, columns] of Object.entries(CALENDAR_TABLES)) {
      const result = await anon.schema("family").from(table).select(columns);
      expect(result.error?.code, table).toBe("42501");
      expect(result.data, table).toBeNull();
    }
  });

  it("authenticated INSERT is refused on every calendar table, nothing written (FR-270)", async () => {
    const eventInsert = await member.schema("family").from("events").insert({
      household_id: fx.householdId,
      summary: "Intruder",
      all_day: false,
      starts_at: "2026-10-07T09:00:00Z",
      ends_at: "2026-10-07T10:00:00Z",
      timezone: "UTC",
    });
    expect(eventInsert.error?.code).toBe("42501");

    const linkInsert = await member.schema("family").from("event_categories").insert({
      household_id: fx.householdId,
      event_id: memberSeriesId,
      category_id: fx.anchorParentId,
      position: 0,
    });
    expect(linkInsert.error?.code).toBe("42501");

    const exceptionInsert = await member.schema("family").from("event_exceptions").insert({
      household_id: fx.householdId,
      event_id: memberSeriesId,
      occurrence_date: "2026-10-20",
      action: "skip",
    });
    expect(exceptionInsert.error?.code).toBe("42501");

    const { rows } = await pool.query(
      "select 1 from family.events where household_id = $1 and summary = 'Intruder'",
      [fx.householdId],
    );
    expect(rows).toHaveLength(0);
  });

  it("authenticated UPDATE and DELETE are refused on every calendar table, rows intact", async () => {
    const update = await member
      .schema("family")
      .from("events")
      .update({ summary: "Hijacked" })
      .eq("id", memberEventId);
    expect(update.error?.code).toBe("42501");

    const remove = await member.schema("family").from("events").delete().eq("id", memberEventId);
    expect(remove.error?.code).toBe("42501");

    const linkUpdate = await member
      .schema("family")
      .from("event_categories")
      .update({ position: 5 })
      .eq("event_id", memberEventId);
    expect(linkUpdate.error?.code).toBe("42501");

    const linkDelete = await member
      .schema("family")
      .from("event_categories")
      .delete()
      .eq("event_id", memberEventId);
    expect(linkDelete.error?.code).toBe("42501");

    const exceptionUpdate = await member
      .schema("family")
      .from("event_exceptions")
      .update({ occurrence_date: "2026-10-27" })
      .eq("id", memberExceptionId);
    expect(exceptionUpdate.error?.code).toBe("42501");

    const exceptionDelete = await member
      .schema("family")
      .from("event_exceptions")
      .delete()
      .eq("id", memberExceptionId);
    expect(exceptionDelete.error?.code).toBe("42501");

    const { rows } = await pool.query<{ summary: string }>(
      "select summary from family.events where id = $1",
      [memberEventId],
    );
    expect(rows[0]?.summary).toBe(`One-off ${fx.run}`);
  });

  it("split_event_series refuses authenticated and anon callers: 42501, series untouched", async () => {
    const args = {
      p_household_id: fx.householdId,
      p_event_id: memberSeriesId,
      p_actor: null,
      p_head_rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261012T235959Z;WKST=SU;BYDAY=TU",
      p_cut: "2026-10-13",
      p_tail_event: {},
      p_tail_category_ids: [],
    };
    const asMember = await member.schema("family").rpc("split_event_series", args);
    expect(asMember.error?.code).toBe("42501");
    const asAnon = await anonClient().schema("family").rpc("split_event_series", args);
    expect(asAnon.error?.code).toBe("42501");

    // The head keeps its rule and no tail row appeared (a tail would carry the
    // head's summary — the split copies content columns verbatim).
    const { rows } = await pool.query<{ rrule: string | null }>(
      "select rrule from family.events where id = $1",
      [memberSeriesId],
    );
    expect(rows[0]?.rrule).toBe(SERIES_RRULE);
    const tail = await pool.query(
      "select 1 from family.events where household_id = $1 and summary = $2 and id <> $3",
      [fx.householdId, `Series ${fx.run}`, memberSeriesId],
    );
    expect(tail.rows).toHaveLength(0);
  });
});
