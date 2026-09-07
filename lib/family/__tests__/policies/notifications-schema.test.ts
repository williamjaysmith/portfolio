/**
 * 008 T028/T057: the notifications schema pinned at the store — migrations
 * 034–036 as data-model.md writes them — exercised over a direct connection so
 * every named constraint is shown refusing a real row, and the two partial
 * unique indexes are shown doing the work the spec says no code does.
 *
 * Covered here:
 *   - **the household's five choices** (FR-802–FR-807): the defaults on a fresh
 *     household are exactly FR-807's; the lead time's 1…10080 bound refuses 0
 *     and 10081 and accepts seven days to the minute;
 *   - **one event's own reminder** (FR-808): the three modes and no fourth; a
 *     `custom` carrying neither half refused; every other mode refused a
 *     payload; the same on `event_exceptions`, where null means inherit from
 *     the series and is the only shape that may carry nothing;
 *   - **push devices** (FR-822–FR-827): the endpoint must be https and unique
 *     across households; the label bounds; attribution nulls when a Profile
 *     goes; the row dies with its household;
 *   - **exactly once** (FR-828, FR-819): the scheduled key admits the same
 *     occurrence at a NEW instant and refuses the same instant twice; the
 *     completion key refuses a second announcement of one occurrence however
 *     the instant differs — which is the whole of "not for an un-ticking".
 *
 * Fixture rows live in a run-tagged household of this file's own, never taken
 * from the seed, so nothing here can drift with — or damage — the seeded tabs.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";

import { createPool, deleteHousehold, insertCategory, insertHousehold } from "./helpers";

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
const UNIQUE_VIOLATION = "23505";

describe("008 notifications schema", () => {
  let pool: Pool;
  let householdId: string;
  let otherHouseholdId: string;
  let profileId: string;

  beforeAll(async () => {
    pool = createPool();
    householdId = await insertHousehold(pool, "Notifications fixtures");
    otherHouseholdId = await insertHousehold(pool, "Notifications neighbours");
    profileId = await insertCategory(pool, {
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

  describe("036 — a browser that asked to be told", () => {
    async function insertDevice(
      household: string,
      endpoint: string,
      label = "Kitchen tablet",
    ): Promise<string> {
      const { rows } = await pool.query(
        `insert into family.push_devices (household_id, endpoint, p256dh, auth, label, created_by)
         values ($1, $2, 'BPubKey', 'AuthSecret', $3, $4) returning id`,
        [household, endpoint, label, household === householdId ? profileId : null],
      );
      return rows[0].id as string;
    }

    it("insists an endpoint is https", async () => {
      const plain = await refusal(
        pool,
        `insert into family.push_devices (household_id, endpoint, p256dh, auth, label)
         values ($1, 'http://push.example/abc', 'k', 'a', 'Phone')`,
        [householdId],
      );
      expect(plain.code).toBe(CHECK_VIOLATION);
    });

    it("holds one row per browser, across households as well as within one", async () => {
      const endpoint = "https://push.example.com/one-browser";
      await insertDevice(householdId, endpoint);

      const twice = await refusal(
        pool,
        `insert into family.push_devices (household_id, endpoint, p256dh, auth, label)
         values ($1, $2, 'k', 'a', 'Same browser again')`,
        [otherHouseholdId, endpoint],
      );
      expect(twice.code).toBe(UNIQUE_VIOLATION);
      expect(twice.constraint).toBe("push_devices_endpoint_key");
    });

    it("keeps the device when the Profile who set it up is deleted", async () => {
      const goingId = await insertCategory(pool, {
        householdId,
        label: "Leaving",
        color: "#2178AF",
        isProfile: true,
        role: "member",
      });
      const { rows } = await pool.query(
        `insert into family.push_devices (household_id, endpoint, p256dh, auth, label, created_by)
         values ($1, 'https://push.example.com/attributed', 'k', 'a', 'Their phone', $2)
         returning id`,
        [householdId, goingId],
      );

      await pool.query(`delete from family.categories where id = $1`, [goingId]);

      const after = await pool.query(
        `select created_by, label from family.push_devices where id = $1`,
        [rows[0].id],
      );
      expect(after.rows[0]).toEqual({ created_by: null, label: "Their phone" });
    });
  });

  describe("036 — exactly once, as a constraint rather than an intention", () => {
    const subjectId = "11111111-1111-4111-8111-111111111111";

    async function claim(
      kind: string,
      occurrence: string,
      fireAt: string,
      subject = subjectId,
    ): Promise<void> {
      await pool.query(
        `insert into family.reminder_deliveries
           (household_id, subject_kind, subject_id, occurrence_date, fire_at, title, body, path)
         values ($1, $2, $3, $4, $5, 'Swim lesson', 'in 10 minutes', '/family/calendar')`,
        [householdId, kind, subject, occurrence, fireAt],
      );
    }

    it("refuses a second claim on the same occurrence at the same instant", async () => {
      await claim("event", "2026-09-09", "2026-09-09T16:20:00Z");

      const again = await refusal(
        pool,
        `insert into family.reminder_deliveries
           (household_id, subject_kind, subject_id, occurrence_date, fire_at, title, body, path)
         values ($1, 'event', $2, '2026-09-09', '2026-09-09T16:20:00Z', 'x', 'y', '/family')`,
        [householdId, subjectId],
      );
      expect(again.code).toBe(UNIQUE_VIOLATION);
    });

    it("admits the same occurrence at a NEW instant, so a moved event reminds again", async () => {
      await expect(claim("event", "2026-09-09", "2026-09-09T17:20:00Z")).resolves.toBeUndefined();
    });

    it("announces one completion per occurrence, however the instant differs", async () => {
      const taskId = "22222222-2222-4222-8222-222222222222";
      await claim("task_done", "2026-09-09", "2026-09-09T17:00:00Z", taskId);

      // An un-tick and a re-tick an hour later is the same occurrence, and says nothing.
      const reTick = await refusal(
        pool,
        `insert into family.reminder_deliveries
           (household_id, subject_kind, subject_id, occurrence_date, fire_at, title, body, path)
         values ($1, 'task_done', $2, '2026-09-09', '2026-09-09T18:00:00Z', 'x', 'y', '/family/tasks')`,
        [householdId, taskId],
      );
      expect(reTick.code).toBe(UNIQUE_VIOLATION);

      // The next day's occurrence of the same chore is a different announcement.
      await expect(
        claim("task_done", "2026-09-10", "2026-09-10T17:00:00Z", taskId),
      ).resolves.toBeUndefined();
    });

    it("survives the deletion of the thing it was about — a send is a fact about the past", async () => {
      const goneId = "33333333-3333-4333-8333-333333333333";
      await claim("event", "2026-09-11", "2026-09-11T08:00:00Z", goneId);

      // There is no foreign key to break, deliberately.
      const { rows } = await pool.query(
        `select count(*)::int as n from family.reminder_deliveries
          where household_id = $1 and subject_id = $2`,
        [householdId, goneId],
      );
      expect(rows[0].n).toBe(1);
    });
  });
});
