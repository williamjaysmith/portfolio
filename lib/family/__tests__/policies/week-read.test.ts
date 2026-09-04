/**
 * T020 / R206: the anchored-week read. `fetchWeekEvents` is one RLS-governed
 * round trip: every series row arrives whatever the window (its `starts_at`
 * may predate it by months), one-offs are windowed by their REAL bounds
 * (timed instants exclusive, all-day dates inclusive per FR-225), category
 * links and every exception ride along embedded, and a non-member gets `[]`.
 * Fixture rows are inserted by this file as `postgres`, never taken from the
 * seed, so the suite cannot drift with seed fixtures.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import { familyKeys, fetchWeekEvents, type WeekFetchBounds } from "@/lib/family/queries";
import {
  createPool,
  deleteHousehold,
  fixtures,
  insertCategory,
  insertHousehold,
  userClient,
} from "./helpers";

// The anchored week 2026-10-04 (Sun) → 2026-10-10 in America/Chicago (CDT,
// UTC-5): instant bounds are the zone's midnights, date bounds the inclusive
// all-day pair.
const WINDOW: WeekFetchBounds = {
  startDate: "2026-10-04",
  endDate: "2026-10-10",
  startsAt: "2026-10-04T05:00:00Z",
  endsAt: "2026-10-11T05:00:00Z",
};

// Canonical grammar order (FREQ;INTERVAL;UNTIL;WKST;BYDAY) — must pass 010's
// `^FREQ=` / no-COUNT CHECK as stored.
const SERIES_RRULE = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261215T235959Z;WKST=SU;BYDAY=TU";

interface TimedSeed {
  summary: string;
  startsAt: string;
  endsAt: string;
  rrule?: string;
}

/** Inserts a timed event as `postgres` (bypasses grants, not constraints). */
async function insertTimed(pool: Pool, householdId: string, seed: TimedSeed): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.events (household_id, summary, all_day, starts_at, ends_at, timezone, rrule) " +
      "values ($1, $2, false, $3, $4, 'UTC', $5) returning id",
    [householdId, seed.summary, seed.startsAt, seed.endsAt, seed.rrule ?? null],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.events returned no row");
  return row.id;
}

/** Inserts an all-day event (inclusive `end_date`) as `postgres`. */
async function insertAllDay(
  pool: Pool,
  householdId: string,
  summary: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.events (household_id, summary, all_day, start_date, end_date, timezone) " +
      "values ($1, $2, true, $3, $4, 'UTC') returning id",
    [householdId, summary, startDate, endDate],
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
  position: number,
): Promise<void> {
  await pool.query(
    "insert into family.event_categories (household_id, event_id, category_id, position) " +
      "values ($1, $2, $3, $4)",
    [householdId, eventId, categoryId, position],
  );
}

async function insertSkip(
  pool: Pool,
  householdId: string,
  eventId: string,
  occurrenceDate: string,
): Promise<void> {
  await pool.query(
    "insert into family.event_exceptions (household_id, event_id, occurrence_date, action) " +
      "values ($1, $2, $3, 'skip')",
    [householdId, eventId, occurrenceDate],
  );
}

describe("week read: the three-branch OR, embeds, and RLS", () => {
  const fx = fixtures();
  let pool: Pool;
  let member: SupabaseClient;
  let stranger: SupabaseClient;
  let otherHouseholdId: string;
  let otherEventId: string;
  let extraCategoryId: string;
  let seriesId: string;
  let inWindowId: string;
  let outOfWindowId: string;
  let allDayInId: string;
  let allDayOutId: string;

  beforeAll(async () => {
    pool = createPool();
    member = await userClient(fx.users.a);
    await member.schema("family").rpc("claim_membership");
    stranger = await userClient(fx.users.stranger);

    extraCategoryId = await insertCategory(pool, {
      householdId: fx.householdId,
      label: `Swim ${fx.run}`,
      color: "#B6E085",
    });

    // The series row starts nine months before the window — only the
    // unconditional `rrule not null` branch can fetch it.
    seriesId = await insertTimed(pool, fx.householdId, {
      summary: `Piano ${fx.run}`,
      startsAt: "2026-01-06T23:00:00Z",
      endsAt: "2026-01-06T23:45:00Z",
      rrule: SERIES_RRULE,
    });
    // Positions deliberately invert insertion order: `categoryIds` must sort
    // by `position` (FR-227), not by arrival.
    await insertLink(pool, fx.householdId, seriesId, fx.anchorParentId, 1);
    await insertLink(pool, fx.householdId, seriesId, extraCategoryId, 0);
    // One exception inside the window, one far outside it: EVERY exception is
    // embedded — that totality is the moved-occurrence guarantee (R206).
    await insertSkip(pool, fx.householdId, seriesId, "2026-11-03");
    await insertSkip(pool, fx.householdId, seriesId, "2026-10-06");

    inWindowId = await insertTimed(pool, fx.householdId, {
      summary: `Dentist ${fx.run}`,
      startsAt: "2026-10-06T14:00:00Z",
      endsAt: "2026-10-06T15:00:00Z",
    });
    outOfWindowId = await insertTimed(pool, fx.householdId, {
      summary: `Last month ${fx.run}`,
      startsAt: "2026-09-01T14:00:00Z",
      endsAt: "2026-09-01T15:00:00Z",
    });
    // Ends ON the window's first day — the inclusive `end_date` boundary.
    allDayInId = await insertAllDay(pool, fx.householdId, `Camping ${fx.run}`, "2026-10-01", "2026-10-04");
    allDayOutId = await insertAllDay(pool, fx.householdId, `Earlier trip ${fx.run}`, "2026-10-01", "2026-10-03");

    // Another household with an in-window event: "scoped to the household"
    // is proven against a row that really exists.
    otherHouseholdId = await insertHousehold(pool, `test-${fx.run}-week-other`);
    otherEventId = await insertTimed(pool, otherHouseholdId, {
      summary: `Other household ${fx.run}`,
      startsAt: "2026-10-06T16:00:00Z",
      endsAt: "2026-10-06T17:00:00Z",
    });
  });

  afterAll(async () => {
    await deleteHousehold(pool, otherHouseholdId);
    // Links and exceptions cascade with the events.
    await pool.query("delete from family.events where id = any($1::uuid[])", [
      [seriesId, inWindowId, outOfWindowId, allDayInId, allDayOutId],
    ]);
    await pool.query("delete from family.categories where id = $1", [extraCategoryId]);
    await pool.end();
  });

  it("keys the displayed window under the swept ['family'] prefix", () => {
    const key = familyKeys.week("hid", { startDate: "2026-10-04", endDate: "2026-10-06" });
    expect(key).toEqual(["family", "events", "hid", "2026-10-04..2026-10-06"]);
    expect(key[0]).toBe(familyKeys.all[0]);
    // Both bounds are in the key: a three-day and a seven-day window from the
    // same day are different reads and must not share a cache entry.
    expect(key).not.toEqual(
      familyKeys.week("hid", { startDate: "2026-10-04", endDate: "2026-10-10" }),
    );
    expect(familyKeys.events("hid")).toEqual(key.slice(0, -1));
  });

  it("a series row whose start predates the window still arrives, every exception embedded", async () => {
    const events = await fetchWeekEvents(member, fx.householdId, WINDOW);
    const series = events.find((event) => event.id === seriesId);
    expect(series).toBeDefined();
    expect(series?.rrule).toBe(SERIES_RRULE);
    // Date-sorted, and the out-of-window 2026-11-03 skip is NOT filtered away.
    expect(series?.exceptions.map((exception) => exception.occurrenceDate)).toEqual([
      "2026-10-06",
      "2026-11-03",
    ]);
    expect(series?.exceptions.every((exception) => exception.action === "skip")).toBe(true);
  });

  it("embeds category links ordered by position, not arrival", async () => {
    const events = await fetchWeekEvents(member, fx.householdId, WINDOW);
    const series = events.find((event) => event.id === seriesId);
    expect(series?.categoryIds).toEqual([extraCategoryId, fx.anchorParentId]);
  });

  it("windows one-offs by real bounds; the all-day end date is inclusive", async () => {
    const events = await fetchWeekEvents(member, fx.householdId, WINDOW);
    const ids = events.map((event) => event.id);
    expect(ids).toContain(inWindowId);
    expect(ids).not.toContain(outOfWindowId);
    expect(ids).toContain(allDayInId);
    expect(ids).not.toContain(allDayOutId);
  });

  it("returns only the asked-for household's rows", async () => {
    const events = await fetchWeekEvents(member, fx.householdId, WINDOW);
    expect(events.some((event) => event.id === otherEventId)).toBe(false);
    expect(events.every((event) => event.householdId === fx.householdId)).toBe(true);
  });

  it("answers an authenticated non-member with an empty week", async () => {
    const events = await fetchWeekEvents(stranger, fx.householdId, WINDOW);
    expect(events).toEqual([]);
  });
});
