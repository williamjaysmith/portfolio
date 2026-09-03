/**
 * T011: the data-model invariants pinned at the store, exercised through the
 * secret key the way the server actions write — so every refusal surfaces as
 * the SQLSTATE the actions must map. Covered: the time-shape XOR and
 * ends-after-start CHECKs (FR-222/225/226), the rrule grammar CHECK
 * (FR-231/232/233), the IANA-timezone triggers on both tables (22023,
 * FR-224/284), the exception payload/time-shape CHECKs (FR-239/240), the
 * one-exception-per-occurrence key, composite-FK tenancy (FR-273), and the
 * two cascade directions (FR-274/SC-214; FR-243 — no skip ghost).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";
import {
  adminClient,
  createPool,
  deleteHousehold,
  fixtures,
  insertCategory,
  insertHousehold,
} from "./helpers";

// Exactly one shape per row (010's event_time_shape): the timed base carries
// explicit nulls on the date pair so overrides swap shapes without residue.
const TIMED = {
  all_day: false,
  starts_at: "2026-10-06T17:00:00Z",
  ends_at: "2026-10-06T17:45:00Z",
  start_date: null,
  end_date: null,
} as const;

const ALL_DAY = {
  all_day: true,
  starts_at: null,
  ends_at: null,
  start_date: "2026-10-06",
  end_date: "2026-10-08",
} as const;

// The verified Skylight capture minus the RRULE: prefix and array wrapper —
// FR-233 requires it stored byte-for-byte.
const SKYLIGHT_RRULE = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260106T235959Z;WKST=SU;BYDAY=MO,TU";

describe("events schema: the data-model invariants", () => {
  const fx = fixtures();
  let pool: Pool;
  let admin: SupabaseClient;
  /** Household A holds every fixture row; B exists only to prove tenancy. */
  let householdA: string;
  let householdB: string;
  let categoryA: string;
  let categoryB: string;
  let seriesId: string;

  const insertEvent = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("events")
      .insert({
        household_id: householdA,
        summary: `Probe ${fx.run}`,
        timezone: "UTC",
        ...TIMED,
        ...row,
      })
      .select("id")
      .single();

  const insertException = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("event_exceptions")
      .insert({ household_id: householdA, event_id: seriesId, ...row })
      .select("id")
      .single();

  const insertLink = (row: Record<string, unknown>) =>
    admin
      .schema("family")
      .from("event_categories")
      .insert({ household_id: householdA, position: 0, ...row });

  async function createEvent(row: Record<string, unknown>): Promise<string> {
    const { data, error } = await insertEvent(row);
    if (error) throw error;
    return (data as { id: string }).id;
  }

  async function count(table: string, column: string, value: string): Promise<number> {
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from family.${table} where ${column} = $1`,
      [value],
    );
    return Number(rows[0]?.n ?? 0);
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();
    householdA = await insertHousehold(pool, `test-${fx.run}-schema`);
    householdB = await insertHousehold(pool, `test-${fx.run}-schema-b`);
    categoryA = await insertCategory(pool, {
      householdId: householdA,
      label: `Schema kid ${fx.run}`,
      color: "#B6E085",
    });
    categoryB = await insertCategory(pool, {
      householdId: householdB,
      label: `Schema stranger ${fx.run}`,
      color: "#CB434C",
    });
    seriesId = await createEvent({ rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU" });
  });

  afterAll(async () => {
    await deleteHousehold(pool, householdA);
    await deleteHousehold(pool, householdB);
    await pool.end();
  });

  it("an event holds exactly one time shape, switched by all_day (23514)", async () => {
    const bothShapes = await insertEvent({
      all_day: true,
      start_date: "2026-10-06",
      end_date: "2026-10-08",
    });
    expect(bothShapes.error?.code).toBe("23514");

    const timedMissingEnd = await insertEvent({ ends_at: null });
    expect(timedMissingEnd.error?.code).toBe("23514");

    const allDayMissingEnd = await insertEvent({ ...ALL_DAY, end_date: null });
    expect(allDayMissingEnd.error?.code).toBe("23514");

    const timedWithDates = await insertEvent({ start_date: "2026-10-06", end_date: "2026-10-06" });
    expect(timedWithDates.error?.code).toBe("23514");

    const allDay = await insertEvent(ALL_DAY);
    expect(allDay.error).toBeNull();
  });

  it("timed ends strictly after starts; all-day end inclusive (23514, FR-225/226)", async () => {
    const equalInstants = await insertEvent({ ends_at: TIMED.starts_at });
    expect(equalInstants.error?.code).toBe("23514");

    const backwards = await insertEvent({ ends_at: "2026-10-06T16:00:00Z" });
    expect(backwards.error?.code).toBe("23514");

    const backwardsDates = await insertEvent({ ...ALL_DAY, end_date: "2026-10-05" });
    expect(backwardsDates.error?.code).toBe("23514");

    // start_date = end_date is one day (FR-225), not a refusal.
    const oneDay = await insertEvent({ ...ALL_DAY, end_date: ALL_DAY.start_date });
    expect(oneDay.error).toBeNull();

    // A timed event may cross midnight — FR-217 is a rendering rule, not a constraint.
    const midnightCrosser = await insertEvent({
      starts_at: "2026-10-09T22:00:00Z",
      ends_at: "2026-10-10T01:00:00Z",
    });
    expect(midnightCrosser.error).toBeNull();
  });

  it("rrule is bare FREQ=… with no COUNT; a Skylight rule survives byte-for-byte", async () => {
    const prefixed = await insertEvent({ rrule: "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TU" });
    expect(prefixed.error?.code).toBe("23514");

    const counted = await insertEvent({ rrule: "FREQ=DAILY;INTERVAL=1;COUNT=5" });
    expect(counted.error?.code).toBe("23514");

    const stored = await admin
      .schema("family")
      .from("events")
      .insert({
        household_id: householdA,
        summary: `Skylight ${fx.run}`,
        timezone: "UTC",
        ...TIMED,
        rrule: SKYLIGHT_RRULE,
      })
      .select("rrule")
      .single();
    expect(stored.error).toBeNull();
    expect((stored.data as { rrule: string }).rrule).toBe(SKYLIGHT_RRULE);
  });

  it("timezone must be a real IANA name on events and household_settings (22023)", async () => {
    const badEventZone = await insertEvent({ timezone: "America/Nowhere" });
    expect(badEventZone.error?.code).toBe("22023");

    const badSettingsZone = await admin
      .schema("family")
      .from("household_settings")
      .update({ timezone: "Mars/Olympus" })
      .eq("household_id", householdA);
    expect(badSettingsZone.error?.code).toBe("22023");

    const goodSettingsZone = await admin
      .schema("family")
      .from("household_settings")
      .update({ timezone: "America/Chicago" })
      .eq("household_id", householdA);
    expect(goodSettingsZone.error).toBeNull();

    const { rows } = await pool.query<{ timezone: string }>(
      "select timezone from family.household_settings where household_id = $1",
      [householdA],
    );
    expect(rows[0]?.timezone).toBe("America/Chicago");
  });

  it("a skip carries nothing; an override carries at least one field (23514)", async () => {
    const loadedSkip = await insertException({
      occurrence_date: "2026-10-13",
      action: "skip",
      summary: "ghost payload",
    });
    expect(loadedSkip.error?.code).toBe("23514");

    const emptyOverride = await insertException({ occurrence_date: "2026-10-13", action: "override" });
    expect(emptyOverride.error?.code).toBe("23514");

    const skip = await insertException({ occurrence_date: "2026-10-13", action: "skip" });
    expect(skip.error).toBeNull();

    const titleOnly = await insertException({
      occurrence_date: "2026-10-20",
      action: "override",
      summary: "Recital rehearsal",
    });
    expect(titleOnly.error).toBeNull();
  });

  it("override time comes as coherent pairs, at most one shape (23514)", async () => {
    const halfInstantPair = await insertException({
      occurrence_date: "2026-10-27",
      action: "override",
      starts_at: "2026-10-27T18:00:00Z",
    });
    expect(halfInstantPair.error?.code).toBe("23514");

    const halfDatePair = await insertException({
      occurrence_date: "2026-10-27",
      action: "override",
      start_date: "2026-10-27",
    });
    expect(halfDatePair.error?.code).toBe("23514");

    const bothShapes = await insertException({
      occurrence_date: "2026-10-27",
      action: "override",
      starts_at: "2026-10-27T18:00:00Z",
      ends_at: "2026-10-27T18:45:00Z",
      start_date: "2026-10-27",
      end_date: "2026-10-27",
    });
    expect(bothShapes.error?.code).toBe("23514");

    // ends_at must be strictly after starts_at — equal instants are refused.
    const equalInstants = await insertException({
      occurrence_date: "2026-10-27",
      action: "override",
      starts_at: "2026-10-27T18:00:00Z",
      ends_at: "2026-10-27T18:00:00Z",
    });
    expect(equalInstants.error?.code).toBe("23514");

    const backwardsDates = await insertException({
      occurrence_date: "2026-10-27",
      action: "override",
      start_date: "2026-10-27",
      end_date: "2026-10-26",
    });
    expect(backwardsDates.error?.code).toBe("23514");

    const timedOverride = await insertException({
      occurrence_date: "2026-10-27",
      action: "override",
      starts_at: "2026-10-27T18:00:00Z",
      ends_at: "2026-10-27T18:45:00Z",
    });
    expect(timedOverride.error).toBeNull();
  });

  it("at most one exception per occurrence: unique (event_id, occurrence_date) (23505)", async () => {
    // 2026-10-20 already carries the title-only override.
    const duplicate = await insertException({ occurrence_date: "2026-10-20", action: "skip" });
    expect(duplicate.error?.code).toBe("23505");
  });

  it("a cross-household link or exception is unrepresentable, even for the service role (23503)", async () => {
    const foreignCategory = await insertLink({ event_id: seriesId, category_id: categoryB });
    expect(foreignCategory.error?.code).toBe("23503");

    const foreignEvent = await insertLink({
      household_id: householdB,
      event_id: seriesId,
      category_id: categoryB,
    });
    expect(foreignEvent.error?.code).toBe("23503");

    const foreignException = await admin
      .schema("family")
      .from("event_exceptions")
      .insert({
        household_id: householdB,
        event_id: seriesId,
        occurrence_date: "2026-11-03",
        action: "skip",
      });
    expect(foreignException.error?.code).toBe("23503");
  });

  it("deleting a category cascades its links and leaves the event standing (FR-274, SC-214)", async () => {
    const doomedCategory = await insertCategory(pool, {
      householdId: householdA,
      label: `Doomed label ${fx.run}`,
      color: "#FDC36D",
      isProfile: false,
    });
    const eventId = await createEvent({ summary: `Survivor ${fx.run}` });
    const link = await insertLink({ event_id: eventId, category_id: doomedCategory });
    expect(link.error).toBeNull();

    const remove = await admin.schema("family").from("categories").delete().eq("id", doomedCategory);
    expect(remove.error).toBeNull();

    expect(await count("event_categories", "category_id", doomedCategory)).toBe(0);
    expect(await count("events", "id", eventId)).toBe(1);
  });

  it("deleting an event cascades its links and exceptions — no skip ghost (FR-243)", async () => {
    const eventId = await createEvent({
      summary: `Doomed series ${fx.run}`,
      rrule: "FREQ=DAILY;INTERVAL=1",
    });
    const link = await insertLink({ event_id: eventId, category_id: categoryA });
    expect(link.error).toBeNull();
    const skip = await admin
      .schema("family")
      .from("event_exceptions")
      .insert({ household_id: householdA, event_id: eventId, occurrence_date: "2026-11-03", action: "skip" });
    expect(skip.error).toBeNull();

    const remove = await admin.schema("family").from("events").delete().eq("id", eventId);
    expect(remove.error).toBeNull();

    expect(await count("events", "id", eventId)).toBe(0);
    expect(await count("event_categories", "event_id", eventId)).toBe(0);
    expect(await count("event_exceptions", "event_id", eventId)).toBe(0);
  });
});
