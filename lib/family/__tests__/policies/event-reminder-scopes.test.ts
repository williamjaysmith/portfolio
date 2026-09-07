/**
 * 008 FR-808, FR-809, FR-810, R809: one event's own reminder, and how it
 * moves under the three shipped scopes.
 *
 * Same discipline as `event-scopes.test.ts`: a replica series is built in
 * this file's own run-tagged household as `postgres`, driven through the
 * REAL server actions (`createEvent`, `updateEvent`) over a real signed-in
 * Supabase session with an in-memory cookie jar, and read back from the
 * DATABASE — an action's return value is never the proof. The seed is never
 * touched.
 *
 * Covered here:
 *   - FR-808: a reminder has exactly three named states — `inherit` (follows
 *     the household), `none` (deliberately silent) and `custom` (its own
 *     at-time and/or lead time) — and an event created saying nothing about
 *     it is `inherit`, the column's own default;
 *   - FR-808/R809: a `custom` carrying neither half, and a lead time past
 *     seven days, are refused as a `VALIDATION` failure by the action AND,
 *     independently, by `events_reminder_payload` /
 *     `events_reminder_before_minutes` / `event_exceptions_reminder_minutes`
 *     at the store — the constraint is the authority, the Zod schema is the
 *     good error message (migration 035);
 *   - FR-810, data-model.md §035 "Who reads these columns": each scope
 *     writes where the resolution order says it must —
 *       `this`      → one `event_exceptions` row carrying ONLY the reminder,
 *                      every other override column left null (the shape
 *                      012's `exception_payload_shape` forbade until 035
 *                      widened it);
 *       `all`       → the three columns on `family.events` itself, an
 *                      occurrence's own exception still winning over it;
 *       `this_and_future` → the split's new tail, the head's own reminder
 *                      left alone;
 *   - R809's resolution order end to end, through `occurrenceReminder`
 *     (`lib/family/notifications/resolve.ts`) — the function the banner
 *     itself calls: an exception's reminder beats its series', and a null
 *     one (no exception override) inherits from the series.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import type { DateWindow } from "@/lib/family/calendar/dates";
import { fetchBoundsOf } from "@/lib/family/calendar/dates";
import type { ActionResult } from "@/lib/family/errors";
import { occurrenceReminder } from "@/lib/family/notifications/resolve";
import { fetchWeekEvents } from "@/lib/family/queries";
import { datePartsOf, epochDayOf } from "@/lib/family/recurrence/plain-date";
import { wallToInstant } from "@/lib/family/recurrence/zone";
import type { Event, EventInput, EventReminder, UpdateEventInput } from "@/lib/family/types";
import {
  LOCAL,
  adminClient,
  createPool,
  createUsers,
  deleteHousehold,
  deleteUsers,
  fixtures,
  insertCategory,
  insertHousehold,
  testEmail,
  userClient,
  type FixtureUser,
} from "./helpers";

// Hoisted: the mock factories below run before any import is evaluated.
const state = vi.hoisted(() => ({
  /** Name → value, exactly what the browser would send back on the next request. */
  cookies: new Map<string, string>(),
  /** The signed-in Supabase session this "request" carries. */
  client: null as SupabaseClient | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));
vi.mock("next/headers", () => {
  const read = (name: string) => {
    const value = state.cookies.get(name);
    return value === undefined ? undefined : { name, value };
  };
  const jar = {
    get: read,
    getAll: () => [...state.cookies].map(([name, value]) => ({ name, value })),
    has: (name: string) => state.cookies.has(name),
    // `lib/family/actor.ts` only ever calls the (name, value, options) form.
    set(name: string, value: string, options?: { maxAge?: number }) {
      // Max-Age=0 is how `clearActor` deletes: the cookie is gone next request.
      if (options?.maxAge === 0) state.cookies.delete(name);
      else state.cookies.set(name, value);
      return jar;
    },
    delete(name: string) {
      state.cookies.delete(name);
      return jar;
    },
  };
  return { cookies: async () => jar, headers: async () => new Headers() };
});
vi.mock("@/lib/family/supabase/server", () => ({
  createClient: async () => {
    if (!state.client) throw new Error("event-reminder-scopes.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

// Imported dynamically, after the mocks and env vars above are in place —
// the same plumbing `event-scopes.test.ts` and `event-actions.test.ts` use.
const { punchIn } = await import("@/lib/family/actions/punch-in");

interface EventActionsModule {
  createEvent(input: EventInput): Promise<ActionResult<Event>>;
  updateEvent(
    input: UpdateEventInput,
  ): Promise<ActionResult<{ eventId: string; splitEventId: string | null }>>;
}

const { createEvent, updateEvent } = (await import(
  "@/lib/family/actions/events"
)) as EventActionsModule;

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

/* ------------------------------------------------------------------------- *
 * A small weekly replica — Wednesdays, so it shares no date with the seed's
 * Piano (Tuesdays), even though it lives in its own household and could
 * never touch it either way.
 * ------------------------------------------------------------------------- */

const ZONE = "America/Chicago";
const FIRST = "2026-09-16"; // Wednesday — the series' first occurrence
const SECOND = "2026-09-23";
const THIRD = "2026-09-30"; // the this_and_future cut below — not the first, so it really splits
const FOURTH = "2026-10-07"; // a neighbour on the tail, carrying no exception of its own
const SERIES_RRULE = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261216T235959Z;WKST=SU;BYDAY=WE";

function chicagoMs(date: string, hour: number, minute: number): number {
  const parts = datePartsOf(epochDayOf(date));
  return wallToInstant(ZONE, { ...parts, hour, minute, second: 0 });
}

function chicagoIso(date: string, hour: number, minute: number): string {
  return new Date(chicagoMs(date, hour, minute)).toISOString();
}

/** Wide enough that every occurrence above falls inside it; series rows arrive regardless (R206). */
const SPAN: DateWindow = {
  startDate: "2026-09-01",
  endDate: "2026-12-31",
  startMs: chicagoMs("2026-09-01", 0, 0),
  endMs: chicagoMs("2027-01-01", 0, 0),
};

function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** The three reminder columns as a plain insertable triple, from the domain shape. */
function reminderParams(reminder: EventReminder): [string, boolean | null, number | null] {
  if (reminder.mode !== "custom") return [reminder.mode, null, null];
  return ["custom", reminder.atTime, reminder.beforeMinutes];
}

describe("008 event reminders: FR-808/809/810 through the real actions", () => {
  const fx = fixtures();
  const run = fx.run;
  const PARENT_PIN = "8080";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let parentId: string;

  /** A refusal's SQLSTATE and the constraint that produced it (the store's own voice). */
  async function refusal(sql: string, params: unknown[] = []): Promise<{ code: string; constraint: string }> {
    try {
      await pool.query(sql, params);
    } catch (error) {
      const failure = error as { code?: string; constraint?: string };
      return { code: failure.code ?? "", constraint: failure.constraint ?? "" };
    }
    throw new Error(`expected a refusal, but the store accepted it: ${sql}`);
  }

  /** A fresh weekly "Reading", `postgres`-inserted, carrying the given series reminder. */
  async function insertSeries(reminder: EventReminder = { mode: "inherit" }): Promise<string> {
    const [mode, atTime, beforeMinutes] = reminderParams(reminder);
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.events " +
        "(household_id, summary, all_day, starts_at, ends_at, timezone, rrule, " +
        "reminder_mode, reminder_at_time, reminder_before_minutes) " +
        "values ($1, 'Reading', false, $2, $3, $4, $5, $6, $7, $8) returning id",
      [householdId, chicagoIso(FIRST, 19, 0), chicagoIso(FIRST, 19, 30), ZONE, SERIES_RRULE, mode, atTime, beforeMinutes],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.events returned no row");
    return row.id;
  }

  interface EventReminderSlice {
    reminder_mode: string;
    reminder_at_time: boolean | null;
    reminder_before_minutes: number | null;
  }

  async function readEventReminder(id: string): Promise<EventReminderSlice> {
    const { rows } = await pool.query<EventReminderSlice>(
      "select reminder_mode, reminder_at_time, reminder_before_minutes from family.events where id = $1",
      [id],
    );
    const [row] = rows;
    if (!row) throw new Error(`event ${id} not found`);
    return row;
  }

  interface ExceptionSlice {
    occurrence_date: string;
    action: string;
    summary: string | null;
    description: string | null;
    location: string | null;
    starts_at: string | null;
    ends_at: string | null;
    start_date: string | null;
    end_date: string | null;
    reminder_mode: string | null;
    reminder_at_time: boolean | null;
    reminder_before_minutes: number | null;
    updated_by: string | null;
  }

  async function exceptionRows(eventId: string): Promise<ExceptionSlice[]> {
    const { rows } = await pool.query<
      Omit<ExceptionSlice, "starts_at" | "ends_at"> & { starts_at: Date | null; ends_at: Date | null }
    >(
      "select occurrence_date::text as occurrence_date, action, summary, description, location, " +
        "starts_at, ends_at, start_date::text as start_date, end_date::text as end_date, " +
        "reminder_mode, reminder_at_time, reminder_before_minutes, updated_by " +
        "from family.event_exceptions where event_id = $1 order by occurrence_date",
      [eventId],
    );
    return rows.map((row) => ({ ...row, starts_at: iso(row.starts_at), ends_at: iso(row.ends_at) }));
  }

  /** The full domain `Event` — reminder and exceptions included — read through the production path. */
  async function loadEvent(id: string): Promise<Event> {
    const events = await fetchWeekEvents(admin, householdId, fetchBoundsOf(SPAN));
    const event = events.find((entry) => entry.id === id);
    if (!event) throw new Error(`event ${id} did not come back from the week read`);
    return event;
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-event-reminders`);
    await pool.query("update family.household_settings set timezone = $1 where household_id = $2", [
      ZONE,
      householdId,
    ]);
    const email = testEmail("event-reminder-scopes", run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      email,
    ]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error("expected one fixture account");
    user = created;

    parentId = await insertCategory(pool, {
      householdId,
      label: `Parent ${run}`,
      color: "#2178AF",
      role: "parent",
    });

    // Binds the allowlist row to the account, exactly as the first sign-in does.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    const { error: pinError } = await admin
      .schema("family")
      .rpc("set_pin", { p_user_id: user.id, p_profile: parentId, p_pin: PARENT_PIN });
    if (pinError) throw pinError;
  });

  beforeEach(async () => {
    state.cookies.clear();
    expectOk(await punchIn(parentId, PARENT_PIN));
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  /* ------------------------------------------------------------------------- */

  describe("the three named states, and their default (FR-808)", () => {
    it("an event created without a reminder is 'inherit' — the column's own default", async () => {
      const event = expectOk(
        await createEvent({
          summary: "Says nothing about reminding",
          timezone: ZONE,
          allDay: false,
          startsAt: chicagoIso(FIRST, 8, 0),
          endsAt: chicagoIso(FIRST, 8, 30),
          repeat: { kind: "never" },
          categoryIds: [],
        }),
      );

      expect(event.reminder).toEqual({ mode: "inherit" });
      expect(await readEventReminder(event.id)).toEqual({
        reminder_mode: "inherit",
        reminder_at_time: null,
        reminder_before_minutes: null,
      });
    });

    it("'none' is stored as deliberate silence, not the same thing as saying nothing", async () => {
      const event = expectOk(
        await createEvent({
          summary: "Deliberately silent",
          timezone: ZONE,
          allDay: false,
          startsAt: chicagoIso(FIRST, 9, 0),
          endsAt: chicagoIso(FIRST, 9, 30),
          repeat: { kind: "never" },
          categoryIds: [],
          reminder: { mode: "none" },
        }),
      );

      expect(event.reminder).toEqual({ mode: "none" });
      expect(await readEventReminder(event.id)).toEqual({
        reminder_mode: "none",
        reminder_at_time: null,
        reminder_before_minutes: null,
      });
    });

    it("'custom' carries at-time, a lead time, or both", async () => {
      const atTimeOnly = expectOk(
        await createEvent({
          summary: "At the start only",
          timezone: ZONE,
          allDay: false,
          startsAt: chicagoIso(FIRST, 10, 0),
          endsAt: chicagoIso(FIRST, 10, 30),
          repeat: { kind: "never" },
          categoryIds: [],
          reminder: { mode: "custom", atTime: true, beforeMinutes: null },
        }),
      );
      expect(atTimeOnly.reminder).toEqual({ mode: "custom", atTime: true, beforeMinutes: null });

      const leadOnly = expectOk(
        await createEvent({
          summary: "A lead time only",
          timezone: ZONE,
          allDay: false,
          startsAt: chicagoIso(FIRST, 11, 0),
          endsAt: chicagoIso(FIRST, 11, 30),
          repeat: { kind: "never" },
          categoryIds: [],
          reminder: { mode: "custom", atTime: false, beforeMinutes: 45 },
        }),
      );
      expect(leadOnly.reminder).toEqual({ mode: "custom", atTime: false, beforeMinutes: 45 });

      const both = expectOk(
        await createEvent({
          summary: "Both halves",
          timezone: ZONE,
          allDay: false,
          startsAt: chicagoIso(FIRST, 12, 0),
          endsAt: chicagoIso(FIRST, 12, 30),
          repeat: { kind: "never" },
          categoryIds: [],
          reminder: { mode: "custom", atTime: true, beforeMinutes: 45 },
        }),
      );
      expect(both.reminder).toEqual({ mode: "custom", atTime: true, beforeMinutes: 45 });
    });
  });

  describe("refused at both layers — the constraint is the authority, the schema is the good message (R809)", () => {
    it("a custom reminder carrying neither half is a VALIDATION failure from the action, not a raw database error", async () => {
      const result = await createEvent({
        summary: "Empty custom",
        timezone: ZONE,
        allDay: false,
        startsAt: chicagoIso(FIRST, 13, 0),
        endsAt: chicagoIso(FIRST, 13, 30),
        repeat: { kind: "never" },
        categoryIds: [],
        reminder: { mode: "custom", atTime: false, beforeMinutes: null },
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected the empty custom to be refused");
      expect(result.error).toBe("VALIDATION");
      expect(result.fieldErrors?.reminder).toEqual(["Choose when it reminds, or choose no reminder."]);
    });

    it("the database refuses the identical shape directly — events_reminder_payload, independent of the app", async () => {
      const empty = await refusal(
        "insert into family.events (household_id, summary, timezone, starts_at, ends_at, reminder_mode) " +
          "values ($1, 'x', $2, $3, $4, 'custom')",
        [householdId, ZONE, chicagoIso(FIRST, 13, 0), chicagoIso(FIRST, 13, 30)],
      );
      expect(empty.code).toBe("23514");
      expect(empty.constraint).toBe("events_reminder_payload");
    });

    it("a lead time past seven days is a VALIDATION failure from the action", async () => {
      const result = await createEvent({
        summary: "A lead time a minute too long",
        timezone: ZONE,
        allDay: false,
        startsAt: chicagoIso(FIRST, 14, 0),
        endsAt: chicagoIso(FIRST, 14, 30),
        repeat: { kind: "never" },
        categoryIds: [],
        reminder: { mode: "custom", atTime: false, beforeMinutes: 10081 },
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected the excess lead time to be refused");
      expect(result.error).toBe("VALIDATION");
      expect(result.fieldErrors?.reminder).toEqual(["A lead time cannot be more than 7 days."]);
    });

    it("the database refuses the same excess directly, on both tables a reminder can live on", async () => {
      const onEvent = await refusal(
        "insert into family.events " +
          "(household_id, summary, timezone, starts_at, ends_at, reminder_mode, reminder_before_minutes) " +
          "values ($1, 'x', $2, $3, $4, 'custom', 10081)",
        [householdId, ZONE, chicagoIso(FIRST, 14, 0), chicagoIso(FIRST, 14, 30)],
      );
      expect(onEvent.code).toBe("23514");
      expect(onEvent.constraint).toBe("events_reminder_before_minutes");

      const seriesId = await insertSeries();
      const onException = await refusal(
        "insert into family.event_exceptions " +
          "(household_id, event_id, occurrence_date, action, reminder_mode, reminder_before_minutes) " +
          "values ($1, $2, $3, 'override', 'custom', 10081)",
        [householdId, seriesId, SECOND],
      );
      expect(onException.code).toBe("23514");
      expect(onException.constraint).toBe("event_exceptions_reminder_minutes");
    });
  });

  describe("the three scopes write where data-model §035 says (FR-810)", () => {
    it("scope 'this': a reminder-only edit is a legal override on its own — every other override column stays null (035 widened exception_payload_shape)", async () => {
      const id = await insertSeries({ mode: "inherit" });

      // Before: no exception at all, so the occurrence follows the series.
      expect(await exceptionRows(id)).toEqual([]);
      expect(occurrenceReminder(await loadEvent(id), SECOND)).toEqual({ mode: "inherit" });

      expectOk(
        await updateEvent({
          id,
          patch: { reminder: { mode: "custom", atTime: true, beforeMinutes: null } },
          scope: "this",
          occurrenceDate: SECOND,
        }),
      );

      // After: one row, keyed by the occurrence, carrying the reminder and NOTHING else.
      expect(await exceptionRows(id)).toEqual([
        {
          occurrence_date: SECOND,
          action: "override",
          summary: null,
          description: null,
          location: null,
          starts_at: null,
          ends_at: null,
          start_date: null,
          end_date: null,
          reminder_mode: "custom",
          reminder_at_time: true,
          reminder_before_minutes: null,
          updated_by: parentId,
        },
      ]);
      // The series row is not the thing that changed.
      expect(await readEventReminder(id)).toEqual({
        reminder_mode: "inherit",
        reminder_at_time: null,
        reminder_before_minutes: null,
      });

      // Resolution order (R809): the touched occurrence's exception wins: the
      // household would say nothing at-time, this one now insists on it. Its
      // untouched neighbour still falls through to the series, which still says
      // "inherit".
      const event = await loadEvent(id);
      expect(occurrenceReminder(event, SECOND)).toEqual({ mode: "custom", atTime: true, beforeMinutes: null });
      expect(occurrenceReminder(event, FIRST)).toEqual({ mode: "inherit" });
      expect(occurrenceReminder(event, THIRD)).toEqual({ mode: "inherit" });

      // A second, unrelated field on the SAME occurrence merges onto the same
      // row (`mergedOverride`): the reminder it already carries survives untouched.
      expectOk(
        await updateEvent({
          id,
          patch: { location: "Room 2" },
          scope: "this",
          occurrenceDate: SECOND,
        }),
      );
      expect(await exceptionRows(id)).toEqual([
        {
          occurrence_date: SECOND,
          action: "override",
          summary: null,
          description: null,
          location: "Room 2",
          starts_at: null,
          ends_at: null,
          start_date: null,
          end_date: null,
          reminder_mode: "custom",
          reminder_at_time: true,
          reminder_before_minutes: null,
          updated_by: parentId,
        },
      ]);
    });

    it("scope 'all': the reminder lands on the events row itself, and a per-occurrence exception still wins over it (R809)", async () => {
      const id = await insertSeries({ mode: "inherit" });

      // One occurrence already has its own opinion — set directly, as Phase 2's own exception.
      await pool.query(
        "insert into family.event_exceptions " +
          "(household_id, event_id, occurrence_date, action, reminder_mode, reminder_at_time) " +
          "values ($1, $2, $3, 'override', 'custom', true)",
        [householdId, id, SECOND],
      );

      expectOk(
        await updateEvent({
          id,
          patch: { reminder: { mode: "none" } },
          scope: "all",
        }),
      );

      expect(await readEventReminder(id)).toEqual({
        reminder_mode: "none",
        reminder_at_time: null,
        reminder_before_minutes: null,
      });
      // The exception row is not what an 'all' write touches.
      expect(await exceptionRows(id)).toEqual([
        {
          occurrence_date: SECOND,
          action: "override",
          summary: null,
          description: null,
          location: null,
          starts_at: null,
          ends_at: null,
          start_date: null,
          end_date: null,
          reminder_mode: "custom",
          reminder_at_time: true,
          reminder_before_minutes: null,
          updated_by: null,
        },
      ]);

      const event = await loadEvent(id);
      // Every occurrence with no exception now follows the newly silenced series.
      expect(occurrenceReminder(event, FIRST)).toEqual({ mode: "none" });
      expect(occurrenceReminder(event, THIRD)).toEqual({ mode: "none" });
      // The one occurrence with its own exception still wins over the series (R809).
      expect(occurrenceReminder(event, SECOND)).toEqual({ mode: "custom", atTime: true, beforeMinutes: null });

      // An 'all' edit to an unrelated field never touches the reminder it just set.
      expectOk(await updateEvent({ id, patch: { location: "Room 3" }, scope: "all" }));
      expect(await readEventReminder(id)).toEqual({
        reminder_mode: "none",
        reminder_at_time: null,
        reminder_before_minutes: null,
      });
    });

    describe("scope 'this_and_future': the reminder belongs on the new tail, the head's own left alone (FR-810, FR-241)", () => {
      it("an explicit reminder in the patch lands on the tail; the head keeps what it had", async () => {
        const headId = await insertSeries({ mode: "custom", atTime: true, beforeMinutes: 60 });

        const result = expectOk(
          await updateEvent({
            id: headId,
            patch: { reminder: { mode: "custom", atTime: false, beforeMinutes: 15 } },
            scope: "this_and_future",
            occurrenceDate: THIRD,
          }),
        );
        const tailId = result.splitEventId;
        if (tailId === null) throw new Error("this_and_future off a non-first occurrence must split");

        // The head's own reminder is untouched by the split.
        expect(await readEventReminder(headId)).toEqual({
          reminder_mode: "custom",
          reminder_at_time: true,
          reminder_before_minutes: 60,
        });
        // The tail carries the reminder the patch asked for, not the head's old one.
        expect(await readEventReminder(tailId)).toEqual({
          reminder_mode: "custom",
          reminder_at_time: false,
          reminder_before_minutes: 15,
        });

        // Neighbours on each side resolve accordingly: before the cut, the
        // head's own; on and after the cut, the tail's own.
        const head = await loadEvent(headId);
        const tail = await loadEvent(tailId);
        expect(occurrenceReminder(head, FIRST)).toEqual({ mode: "custom", atTime: true, beforeMinutes: 60 });
        expect(occurrenceReminder(tail, THIRD)).toEqual({ mode: "custom", atTime: false, beforeMinutes: 15 });
        expect(occurrenceReminder(tail, FOURTH)).toEqual({ mode: "custom", atTime: false, beforeMinutes: 15 });
      });

      it("with no reminder in the patch, the tail carries over the series' existing reminder rather than resetting it", async () => {
        const headId = await insertSeries({ mode: "custom", atTime: true, beforeMinutes: 60 });

        const result = expectOk(
          await updateEvent({
            id: headId,
            patch: { location: "Room 4" },
            scope: "this_and_future",
            occurrenceDate: THIRD,
          }),
        );
        const tailId = result.splitEventId;
        if (tailId === null) throw new Error("this_and_future off a non-first occurrence must split");

        expect(await readEventReminder(headId)).toEqual({
          reminder_mode: "custom",
          reminder_at_time: true,
          reminder_before_minutes: 60,
        });
        // Untouched in the patch, the tail should still say what the series said —
        // not fall back to the column's bare 'inherit' default.
        expect(await readEventReminder(tailId)).toEqual({
          reminder_mode: "custom",
          reminder_at_time: true,
          reminder_before_minutes: 60,
        });
      });
    });
  });
});
