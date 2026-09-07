/**
 * 008 T028: the notifications schema pinned at the store — migrations 034 and
 * 035 as data-model.md writes them — exercised over a direct connection so
 * every named constraint is shown refusing a real row.
 *
 * Covered here:
 *   - **the household's five choices** (FR-802–FR-807): the defaults on a fresh
 *     household are exactly FR-807's; the lead time's 1…10080 bound refuses 0
 *     and 10081 and accepts seven days to the minute;
 *   - **one event's own reminder** (FR-808): the three modes and no fourth; a
 *     `custom` carrying neither half refused; every other mode refused a
 *     payload; the same on `event_exceptions`, where null means inherit from
 *     the series and is the only shape that may carry nothing;
 *
 * Migrations 036 and 037 — the push subscriptions and the delivery ledger —
 * were deleted when Web Push was dropped, and their tests with them. Nothing
 * server-side records a reminder any more: a banner is shown once per device
 * because that device remembers its own key (lib/family/notifications/
 * identity.ts), which is a browser convention rather than a database
 * constraint. That trade is recorded in the spec.
 *
 * Fixture rows live in a run-tagged household of this file's own, never taken
 * from the seed, so nothing here can drift with — or damage — the seeded tabs.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";

import { anonClient, createPool, deleteHousehold, insertCategory, insertHousehold } from "./helpers";

/** A refusal's SQLSTATE and the constraint that produced it. */
async function refusal(pool: Pool, sql: string, params: unknown[] = []): Promise<{
  code: string;
  constraint: string;
}> {
  try {
    await pool.query(sql, params);
  } catch (error) {
    const failure = error as { code?: string; constraint?: string };
    return { code: failure.code ?? "", constraint: failure.constraint ?? "" };
  }
  throw new Error(`expected a refusal, but the store accepted it: ${sql}`);
}

const CHECK_VIOLATION = "23514";

describe("008 notifications schema", () => {
  let pool: Pool;
  let householdId: string;
  let otherHouseholdId: string;

  beforeAll(async () => {
    pool = createPool();
    householdId = await insertHousehold(pool, "Notifications fixtures");
    otherHouseholdId = await insertHousehold(pool, "Notifications neighbours");
    await insertCategory(pool, {
      householdId,
      label: "Ana",
      color: "#2178AF",
      isProfile: true,
      role: "parent",
    });
  });

  afterAll(async () => {
    await deleteHousehold(pool, householdId);
    await deleteHousehold(pool, otherHouseholdId);
    await pool.end();
  });

  describe("034 — the household's five choices", () => {
    it("starts a household at FR-807's defaults, from the schema and not a seed", async () => {
      const { rows } = await pool.query(
        `select notify_event_at_time, notify_event_before, notify_event_before_minutes,
                notify_task_due, notify_task_completed
           from family.household_settings where household_id = $1`,
        [householdId],
      );
      expect(rows[0]).toEqual({
        notify_event_at_time: false,
        notify_event_before: true,
        notify_event_before_minutes: 10,
        notify_task_due: true,
        notify_task_completed: false,
      });
    });

    it("accepts seven days to the minute and refuses a minute more", async () => {
      await pool.query(
        `update family.household_settings set notify_event_before_minutes = 10080
          where household_id = $1`,
        [householdId],
      );

      const tooLong = await refusal(
        pool,
        `update family.household_settings set notify_event_before_minutes = 10081
          where household_id = $1`,
        [householdId],
      );
      expect(tooLong.code).toBe(CHECK_VIOLATION);
      expect(tooLong.constraint).toBe("household_settings_notify_before_minutes");

      const zero = await refusal(
        pool,
        `update family.household_settings set notify_event_before_minutes = 0
          where household_id = $1`,
        [householdId],
      );
      expect(zero.code).toBe(CHECK_VIOLATION);

      await pool.query(
        `update family.household_settings set notify_event_before_minutes = 10
          where household_id = $1`,
        [householdId],
      );
    });
  });

  describe("035 — one event's own reminder", () => {
    async function insertEvent(mode: string, atTime: boolean | null, minutes: number | null) {
      const { rows } = await pool.query(
        `insert into family.events
           (household_id, summary, timezone, starts_at, ends_at,
            reminder_mode, reminder_at_time, reminder_before_minutes)
         values ($1, 'Swim lesson', 'America/Chicago',
                 '2026-09-09T16:30:00Z', '2026-09-09T17:30:00Z', $2, $3, $4)
         returning id`,
        [householdId, mode, atTime, minutes],
      );
      return rows[0].id as string;
    }

    it("defaults every existing event to inherit, so nothing changes behaviour", async () => {
      const { rows } = await pool.query(
        `insert into family.events (household_id, summary, timezone, starts_at, ends_at)
         values ($1, 'Dentist', 'America/Chicago',
                 '2026-09-10T09:00:00Z', '2026-09-10T10:00:00Z')
         returning reminder_mode, reminder_at_time, reminder_before_minutes`,
        [householdId],
      );
      expect(rows[0]).toEqual({
        reminder_mode: "inherit",
        reminder_at_time: null,
        reminder_before_minutes: null,
      });
    });

    it("accepts the three modes and knows no fourth", async () => {
      await expect(insertEvent("inherit", null, null)).resolves.toBeTruthy();
      await expect(insertEvent("none", null, null)).resolves.toBeTruthy();
      await expect(insertEvent("custom", true, null)).resolves.toBeTruthy();
      await expect(insertEvent("custom", null, 120)).resolves.toBeTruthy();
      await expect(insertEvent("custom", true, 120)).resolves.toBeTruthy();

      const unknown = await refusal(
        pool,
        `insert into family.events (household_id, summary, timezone, starts_at, ends_at, reminder_mode)
         values ($1, 'x', 'America/Chicago', '2026-09-09T16:30:00Z', '2026-09-09T17:30:00Z', 'sometimes')`,
        [householdId],
      );
      expect(unknown.code).toBe(CHECK_VIOLATION);
      expect(unknown.constraint).toBe("events_reminder_mode");
    });

    it("refuses a custom that carries neither half — that is just 'none' written badly", async () => {
      const empty = await refusal(
        pool,
        `insert into family.events (household_id, summary, timezone, starts_at, ends_at, reminder_mode)
         values ($1, 'x', 'America/Chicago', '2026-09-09T16:30:00Z', '2026-09-09T17:30:00Z', 'custom')`,
        [householdId],
      );
      expect(empty.code).toBe(CHECK_VIOLATION);
      expect(empty.constraint).toBe("events_reminder_payload");
    });

    it("refuses a payload on any mode but custom", async () => {
      const inheriting = await refusal(
        pool,
        `insert into family.events
           (household_id, summary, timezone, starts_at, ends_at, reminder_mode, reminder_before_minutes)
         values ($1, 'x', 'America/Chicago', '2026-09-09T16:30:00Z', '2026-09-09T17:30:00Z', 'inherit', 30)`,
        [householdId],
      );
      expect(inheriting.constraint).toBe("events_reminder_payload");

      const silent = await refusal(
        pool,
        `insert into family.events
           (household_id, summary, timezone, starts_at, ends_at, reminder_mode, reminder_at_time)
         values ($1, 'x', 'America/Chicago', '2026-09-09T16:30:00Z', '2026-09-09T17:30:00Z', 'none', true)`,
        [householdId],
      );
      expect(silent.constraint).toBe("events_reminder_payload");
    });

    it("lets one occurrence carry a reminder and nothing else — the 'This event' scope", async () => {
      const eventId = await insertEvent("custom", null, 30);

      // 012's exception_payload_shape said an override must carry one of SEVEN columns; it was
      // written before reminders existed. Widened by 035, this is now a legal exception.
      const { rows } = await pool.query(
        `insert into family.event_exceptions
           (household_id, event_id, occurrence_date, action, reminder_mode, reminder_before_minutes)
         values ($1, $2, '2026-09-16', 'override', 'custom', 120)
         returning reminder_mode, reminder_before_minutes, summary`,
        [householdId, eventId],
      );
      expect(rows[0]).toEqual({
        reminder_mode: "custom",
        reminder_before_minutes: 120,
        summary: null,
      });
    });

    it("still refuses an override that changes nothing at all", async () => {
      const eventId = await insertEvent("inherit", null, null);
      const empty = await refusal(
        pool,
        `insert into family.event_exceptions (household_id, event_id, occurrence_date, action)
         values ($1, $2, '2026-09-16', 'override')`,
        [householdId, eventId],
      );
      expect(empty.code).toBe(CHECK_VIOLATION);
      expect(empty.constraint).toBe("exception_payload_shape");
    });

    it("refuses a reminder on a skipped occurrence — a skip has nothing to remind about", async () => {
      const eventId = await insertEvent("inherit", null, null);
      const skipped = await refusal(
        pool,
        `insert into family.event_exceptions
           (household_id, event_id, occurrence_date, action, reminder_mode, reminder_at_time)
         values ($1, $2, '2026-09-16', 'skip', 'custom', true)`,
        [householdId, eventId],
      );
      expect(skipped.code).toBe(CHECK_VIOLATION);
      expect(skipped.constraint).toBe("exception_payload_shape");
    });

    it("refuses an occurrence that inherits its series yet carries a payload", async () => {
      const eventId = await insertEvent("custom", true, null);
      const nullWithPayload = await refusal(
        pool,
        `insert into family.event_exceptions
           (household_id, event_id, occurrence_date, action, summary, reminder_before_minutes)
         values ($1, $2, '2026-09-23', 'override', 'Moved', 45)`,
        [householdId, eventId],
      );
      expect(nullWithPayload.code).toBe(CHECK_VIOLATION);
      expect(nullWithPayload.constraint).toBe("event_exceptions_reminder_payload");
    });
  });

  describe("SC-815 — the new columns inherit the shipped policy", () => {
    /**
     * Data-model §The privilege delta says there is no new policy to write: the
     * five settings columns and the six reminder columns sit on tables that
     * already carry `is_member()` SELECT and service-role ALL. That is a claim
     * worth proving rather than asserting, because "we added columns to a table
     * that was already protected" is exactly the reasoning that leaks a column
     * one day.
     *
     * An anonymous reader must get a REFUSAL (42501), never an empty result —
     * an empty result would mean the row was found and filtered, which tells a
     * stranger the household exists.
     */
    it("refuses an anonymous reader the household's reminder settings", async () => {
      const anon = anonClient();
      const result = await anon
        .schema("family")
        .from("household_settings")
        .select(
          "notify_event_at_time, notify_event_before, notify_event_before_minutes, " +
            "notify_task_due, notify_task_completed",
        );

      expect(result.error?.code).toBe("42501");
      expect(result.data).toBeNull();
    });

    it("refuses an anonymous reader an event's own reminder", async () => {
      const anon = anonClient();
      for (const table of ["events", "event_exceptions"]) {
        const result = await anon
          .schema("family")
          .from(table)
          .select("reminder_mode, reminder_at_time, reminder_before_minutes");

        expect(result.error?.code, table).toBe("42501");
        expect(result.data, table).toBeNull();
      }
    });
  });
});
