/**
 * 009 T012: the countdown's storage pinned at the store — migration 039 as
 * data-model.md writes it — over a direct connection, so every named
 * constraint is shown refusing a real row.
 *
 * Covered here:
 *   - **the household's one choice** (FR-903): a fresh household starts at
 *     `always` from the SCHEMA and not from a seed, and the check constraint
 *     admits exactly the reference's three values and refuses a fourth;
 *   - **the event's flag** (FR-901): it defaults to false, so an event that
 *     says nothing about countdowns is not one, and it survives a
 *     `split_event_series` onto the tail — the case 038 had to fix for the
 *     reminder and which 015's column list would otherwise silently reset;
 *   - **nothing new is exposed** (SC-911, R911): an anonymous reader of either
 *     column gets a REFUSAL, never an empty result. "We added a column to a
 *     table that was already protected" is exactly the reasoning that leaks a
 *     column one day, so it is proved rather than asserted.
 *
 * Fixture rows live in a run-tagged household of this file's own, never taken
 * from the seed, so nothing here can drift with — or damage — the seeded tabs.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";

import { anonClient, createPool, deleteHousehold, insertCategory, insertHousehold } from "./helpers";

/** A refusal's SQLSTATE and the constraint that produced it. */
async function refusal(
  pool: Pool,
  sql: string,
  params: unknown[] = [],
): Promise<{ code: string; constraint: string }> {
  try {
    await pool.query(sql, params);
  } catch (error) {
    const failure = error as { code?: string; constraint?: string };
    return { code: failure.code ?? "", constraint: failure.constraint ?? "" };
  }
  throw new Error(`expected a refusal, but the store accepted it: ${sql}`);
}

const CHECK_VIOLATION = "23514";

/** A timed event, in the shape 010's `event_time_shape` requires. */
const TIMED = {
  all_day: false,
  starts_at: "2026-10-08T17:00:00Z",
  ends_at: "2026-10-08T18:00:00Z",
} as const;

describe("009 countdowns schema", () => {
  let pool: Pool;
  let householdId: string;
  let actorId: string;

  beforeAll(async () => {
    pool = createPool();
    householdId = await insertHousehold(pool, "Countdown fixtures");
    actorId = await insertCategory(pool, {
      householdId,
      label: "Ana",
      color: "#2178AF",
      isProfile: true,
      role: "parent",
    });
  });

  afterAll(async () => {
    await deleteHousehold(pool, householdId);
    await pool.end();
  });

  async function insertEvent(options: { rrule?: string | null; countdown?: boolean }): Promise<string> {
    const { rows } = await pool.query(
      `insert into family.events
         (household_id, summary, all_day, starts_at, ends_at, timezone, rrule,
          ${options.countdown === undefined ? "" : "countdown_enabled,"} created_by, updated_by)
       values ($1, 'Holiday', $2, $3, $4, 'America/Chicago', $5,
          ${options.countdown === undefined ? "" : "$7,"} $6, $6)
       returning id`,
      options.countdown === undefined
        ? [householdId, TIMED.all_day, TIMED.starts_at, TIMED.ends_at, options.rrule ?? null, actorId]
        : [
            householdId,
            TIMED.all_day,
            TIMED.starts_at,
            TIMED.ends_at,
            options.rrule ?? null,
            actorId,
            options.countdown,
          ],
    );
    return rows[0].id as string;
  }

  describe("039 — the household's one countdown choice", () => {
    it("starts a household at 'always', from the schema and not a seed", async () => {
      const { rows } = await pool.query(
        `select show_countdowns from family.household_settings where household_id = $1`,
        [householdId],
      );
      expect(rows[0]).toEqual({ show_countdowns: "always" });
    });

    it("accepts exactly the reference's three values", async () => {
      for (const value of ["always", "three_months", "one_month"]) {
        await pool.query(
          `update family.household_settings set show_countdowns = $2 where household_id = $1`,
          [householdId, value],
        );
        const { rows } = await pool.query(
          `select show_countdowns from family.household_settings where household_id = $1`,
          [householdId],
        );
        expect(rows[0].show_countdowns).toBe(value);
      }
      await pool.query(
        `update family.household_settings set show_countdowns = 'always' where household_id = $1`,
        [householdId],
      );
    });

    it("refuses a fourth value, including a plausible one", async () => {
      for (const value of ["never", "six_months", "3 months prior to the event", ""]) {
        const failure = await refusal(
          pool,
          `update family.household_settings set show_countdowns = $2 where household_id = $1`,
          [householdId, value],
        );
        expect(failure.code, value).toBe(CHECK_VIOLATION);
        expect(failure.constraint, value).toBe("household_settings_show_countdowns");
      }
    });

    it("refuses null — a missing preference is not a state this has", async () => {
      const failure = await refusal(
        pool,
        `update family.household_settings set show_countdowns = null where household_id = $1`,
        [householdId],
      );
      // A not-null violation, not a check violation: the column, not the enum.
      expect(failure.code).toBe("23502");
    });
  });

  describe("010 — the event's flag, written at last", () => {
    it("defaults to false, so an event that says nothing is not a countdown", async () => {
      const id = await insertEvent({});
      const { rows } = await pool.query(`select countdown_enabled from family.events where id = $1`, [
        id,
      ]);
      expect(rows[0]).toEqual({ countdown_enabled: false });
    });

    it("stores true when the form's switch sends it", async () => {
      const id = await insertEvent({ countdown: true });
      const { rows } = await pool.query(`select countdown_enabled from family.events where id = $1`, [
        id,
      ]);
      expect(rows[0]).toEqual({ countdown_enabled: true });
    });

    it("carries onto the tail of a split series (038's column list)", async () => {
      const eventId = await insertEvent({
        rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
        countdown: true,
      });

      const { rows } = await pool.query(
        `select family.split_event_series($1, $2, $3, $4, $5, $6, $7) as tail_id`,
        [
          householdId,
          eventId,
          actorId,
          "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261014T235959Z;BYDAY=TH",
          "2026-10-15",
          JSON.stringify({
            summary: "Holiday",
            description: null,
            location: null,
            all_day: false,
            starts_at: "2026-10-15T17:00:00Z",
            ends_at: "2026-10-15T18:00:00Z",
            start_date: null,
            end_date: null,
            timezone: "America/Chicago",
            rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
            countdown_enabled: true,
            reminder_mode: "inherit",
            reminder_at_time: null,
            reminder_before_minutes: null,
          }),
          [],
        ],
      );

      const tailId = rows[0].tail_id as string;
      const tail = await pool.query(`select countdown_enabled from family.events where id = $1`, [
        tailId,
      ]);
      expect(tail.rows[0]).toEqual({ countdown_enabled: true });
    });
  });

  describe("nothing new is exposed (R911, SC-911)", () => {
    /**
     * This phase adds one column to a table that already had row-level
     * security and reads one that has shipped since 010. No new policy was
     * written, and that is a claim worth proving.
     *
     * An anonymous reader must get a REFUSAL (42501), never an empty result —
     * an empty result would mean the row was found and filtered, which tells a
     * stranger the household exists.
     */
    it("refuses an anonymous reader the household's countdown setting", async () => {
      const result = await anonClient()
        .schema("family")
        .from("household_settings")
        .select("show_countdowns");

      expect(result.error?.code).toBe("42501");
      expect(result.data).toBeNull();
    });

    it("refuses an anonymous reader an event's countdown flag", async () => {
      const result = await anonClient().schema("family").from("events").select("countdown_enabled");

      expect(result.error?.code).toBe("42501");
      expect(result.data).toBeNull();
    });

    /**
     * 009 T051 / SC-911. The search is a READ of `events`, so it is policed by
     * the same policy as every other read — but the search is the one path a
     * stranger could reach with a guessed term, so it is proved on its own
     * rather than assumed from the row above.
     */
    it("refuses an anonymous searcher, whatever they type", async () => {
      for (const term of ["holiday", "%", "_", "", "a"]) {
        const result = await anonClient()
          .schema("family")
          .from("events")
          .select("id, summary")
          .ilike("summary", `%${term}%`)
          .limit(50);

        expect(result.error?.code, term).toBe("42501");
        expect(result.data, term).toBeNull();
      }
    });
  });
});
