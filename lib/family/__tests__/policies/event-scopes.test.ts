/**
 * T037–T042 / SC-207: each of the three scopes does exactly what it says —
 * edit and delete, at `this`, `this_and_future` and `all` — six checks, each
 * comparing the FULL occurrence set before and after through the shared
 * expander (`expandWindow`, the one module the browser renders from and the
 * actions validate against), and each checking what became of the series'
 * per-occurrence edits.
 *
 * The subject is a replica of the seed's weekly "Piano" — Cleo, Tuesdays
 * 17:00–17:45 America/Chicago from 2026-09-15, UNTIL mid-December in the
 * observed Skylight shape (FR-233), carrying the saved this-occurrence time
 * change on 2026-10-06 (18:00–18:45, SC-207's precondition). Every check
 * builds its OWN replica in this file's run-tagged household as `postgres`,
 * so the seeded Piano — shared state — is never touched, and a destructive
 * check can never bleed into its neighbour.
 *
 * Same plumbing as event-actions.test.ts: Next's cookie store is an
 * in-memory jar, the request's Supabase session is a real signed-in client,
 * and everything else (guards, the signed actor cookie, the admin client, the
 * split function, the expander) is the production code. What the DATABASE
 * holds is read back directly; an action's return value is never the proof.
 *
 * RED by design until T044/T045 land `lib/family/actions/events.ts`: the
 * dynamic import below fails while the module does not exist, which is
 * exactly the failing state T037–T042 must leave behind.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import { fetchBoundsOf, localDateOf, type DateWindow } from "@/lib/family/calendar/dates";
import { expandWindow } from "@/lib/family/calendar/expand";
import type { ActionResult } from "@/lib/family/errors";
import { fetchWeekEvents } from "@/lib/family/queries";
import { parseRule } from "@/lib/family/recurrence/grammar";
import { datePartsOf, epochDayOf } from "@/lib/family/recurrence/plain-date";
import { wallToInstant } from "@/lib/family/recurrence/zone";
import type { DeleteEventInput, EventTimes, UpdateEventInput } from "@/lib/family/types";
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
    if (!state.client) throw new Error("event-scopes.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");

/** The surface T044/T045 must export (contracts/server-actions.md). */
interface EventActionsModule {
  updateEvent(
    input: UpdateEventInput,
  ): Promise<ActionResult<{ eventId: string; splitEventId: string | null }>>;
  deleteEvent(input: DeleteEventInput): Promise<ActionResult<null>>;
}

// Joined at runtime so `tsc` stays clean while the module does not exist yet;
// Vitest resolves the `@` alias when the import actually runs. Until T043
// creates the module this await throws and the whole suite is RED — the
// failing state these tasks must leave behind.
const EVENTS_MODULE = ["@", "lib", "family", "actions", "events"].join("/");
const { updateEvent, deleteEvent } = (await import(EVENTS_MODULE)) as EventActionsModule;

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

/* ------------------------------------------------------------------------- *
 * The Piano replica (scripts/family-seed.mjs, fixture 12)
 * ------------------------------------------------------------------------- */

/** The seed's household zone (Assumption 41) — expansion and every date key work in it. */
const ZONE = "America/Chicago";
/** The observed Skylight shape (FR-233); passes 010's `^FREQ=` / no-COUNT CHECK as stored. */
const PIANO_RRULE = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261215T235959Z;WKST=SU;BYDAY=TU";
/** The series' first occurrence — a Tuesday. */
const FIRST = "2026-09-15";
/** The occurrence carrying the seed's saved this-occurrence time change (18:00–18:45). */
const OVERRIDDEN = "2026-10-06";
/** Every Tuesday from the start through UNTIL's household-local date, inclusive. */
const TUESDAYS = [
  "2026-09-15",
  "2026-09-22",
  "2026-09-29",
  "2026-10-06",
  "2026-10-13",
  "2026-10-20",
  "2026-10-27",
  "2026-11-03",
  "2026-11-10",
  "2026-11-17",
  "2026-11-24",
  "2026-12-01",
  "2026-12-08",
  "2026-12-15",
] as const;

/** The household-zone wall clock `hour:minute` on `date`, as an epoch instant. */
function chicagoMs(date: string, hour: number, minute: number): number {
  const parts = datePartsOf(epochDayOf(date));
  return wallToInstant(ZONE, { ...parts, hour, minute, second: 0 });
}

function chicagoIso(date: string, hour: number, minute: number): string {
  return new Date(chicagoMs(date, hour, minute)).toISOString();
}

/** The timed member of the two-shape model — what every override here carries. */
type TimedTimes = Extract<EventTimes, { allDay: false }>;

function timedOn(date: string, start: [number, number], end: [number, number]): TimedTimes {
  return {
    allDay: false,
    startsAt: chicagoIso(date, start[0], start[1]),
    endsAt: chicagoIso(date, end[0], end[1]),
  };
}

/** Piano's nominal slot on `date`: 17:00–17:45 household time, DST or not. */
function pianoSlot(date: string): TimedTimes {
  return timedOn(date, [17, 0], [17, 45]);
}

/** The seed's saved override on 6 October: 18:00–18:45. */
const OVERRIDE_TIMES = timedOn(OVERRIDDEN, [18, 0], [18, 45]);

/**
 * The window the whole series lives in — a Sunday-start span from the week
 * of the first occurrence through the week of UNTIL. `expandWindow` is a
 * range walk; nothing in it insists on seven days.
 */
const SPAN: DateWindow = {
  startDate: "2026-09-13",
  endDate: "2026-12-19",
  startMs: chicagoMs("2026-09-13", 0, 0),
  endMs: chicagoMs("2026-12-20", 0, 0),
};

/** One occurrence as the checks compare it: effective fields, instants normalised. */
interface Snapshot {
  eventId: string;
  occurrenceDate: string;
  summary: string;
  location: string | null;
  categoryIds: string[];
  times: EventTimes;
}

// PostgREST returns `+00:00` instants and the expander emits `.000Z` ones;
// compare epoch-equal instants as one string.
function normaliseTimes(times: EventTimes): EventTimes {
  if (times.allDay) return times;
  return {
    allDay: false,
    startsAt: new Date(times.startsAt).toISOString(),
    endsAt: new Date(times.endsAt).toISOString(),
  };
}

function withChange(
  snapshots: readonly Snapshot[],
  date: string,
  change: Partial<Snapshot>,
): Snapshot[] {
  return snapshots.map((entry) =>
    entry.occurrenceDate === date ? { ...entry, ...change } : entry,
  );
}

function without(snapshots: readonly Snapshot[], ...dates: readonly string[]): Snapshot[] {
  return snapshots.filter((entry) => !dates.includes(entry.occurrenceDate));
}

function datesOf(snapshots: readonly Snapshot[]): string[] {
  return snapshots.map((entry) => entry.occurrenceDate);
}

/* ------------------------------------------------------------------------- *
 * What the database holds
 * ------------------------------------------------------------------------- */

interface EventSlice {
  summary: string;
  location: string | null;
  rrule: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  created_by: string | null;
  updated_by: string | null;
}

interface ExceptionSlice {
  occurrence_date: string;
  action: string;
  summary: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  updated_by: string | null;
}

type LinkSlice = { category_id: string; position: number };

/** `pg` hands timestamptz back as a Date; the checks compare ISO instants. */
function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** UNTIL as the household-local date it admits — the expander's own reading (R201). */
function untilDateOf(rrule: string | null): string {
  if (rrule === null) throw new Error("expected a series rule, found a one-off");
  const { until } = parseRule(rrule);
  if (until === null) throw new Error(`expected an UNTIL on "${rrule}"`);
  return until.kind === "date" ? until.date : localDateOf(ZONE, until.ms);
}

describe("event scopes: SC-207's six checks against the Piano replica (T037–T042)", () => {
  const fx = fixtures();
  const run = fx.run;
  const PARENT_PIN = "5151";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  /** Ana — the punched-in parent every write here is attributed to. */
  let anaId: string;
  /** Cleo — the profile Piano is for (never the actor: FR-271). */
  let cleoId: string;

  /* ---- fixtures, as `postgres` (bypasses grants, not constraints) ---- */

  async function insertSeries(): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "insert into family.events (household_id, summary, all_day, starts_at, ends_at, timezone, rrule) " +
        "values ($1, 'Piano', false, $2, $3, $4, $5) returning id",
      [householdId, chicagoIso(FIRST, 17, 0), chicagoIso(FIRST, 17, 45), ZONE, PIANO_RRULE],
    );
    const [row] = rows;
    if (!row) throw new Error("insert into family.events returned no row");
    await pool.query(
      "insert into family.event_categories (household_id, event_id, category_id, position) " +
        "values ($1, $2, $3, 0)",
      [householdId, row.id, cleoId],
    );
    return row.id;
  }

  interface OverrideSeed {
    summary?: string;
    location?: string;
    times?: TimedTimes;
  }

  async function insertOverride(
    eventId: string,
    occurrenceDate: string,
    seed: OverrideSeed,
  ): Promise<void> {
    await pool.query(
      "insert into family.event_exceptions " +
        "(household_id, event_id, occurrence_date, action, summary, location, starts_at, ends_at) " +
        "values ($1, $2, $3, 'override', $4, $5, $6, $7)",
      [
        householdId,
        eventId,
        occurrenceDate,
        seed.summary ?? null,
        seed.location ?? null,
        seed.times?.startsAt ?? null,
        seed.times?.endsAt ?? null,
      ],
    );
  }

  async function insertSkip(eventId: string, occurrenceDate: string): Promise<void> {
    await pool.query(
      "insert into family.event_exceptions (household_id, event_id, occurrence_date, action) " +
        "values ($1, $2, $3, 'skip')",
      [householdId, eventId, occurrenceDate],
    );
  }

  /** A fresh Piano: the series, Cleo's link, and the saved 6 October time change. */
  async function makePiano(): Promise<string> {
    const id = await insertSeries();
    await insertOverride(id, OVERRIDDEN, { times: OVERRIDE_TIMES });
    return id;
  }

  /* ---- readers ---- */

  /**
   * The FULL occurrence set of the given segments over the series' life, read
   * through the production read path and the shared expander — exactly what
   * a renderer would draw, and what the actions validate `occurrenceDate`
   * against. Sorted by original date (then event id) by the expander itself.
   */
  async function occurrencesOf(ids: readonly string[]): Promise<Snapshot[]> {
    const events = await fetchWeekEvents(admin, householdId, fetchBoundsOf(SPAN));
    const segments = events.filter((event) => ids.includes(event.id));
    return expandWindow(segments, SPAN, ZONE).map((occurrence) => ({
      eventId: occurrence.eventId,
      occurrenceDate: occurrence.occurrenceDate,
      summary: occurrence.summary,
      location: occurrence.location,
      categoryIds: occurrence.categoryIds,
      times: normaliseTimes(occurrence.times),
    }));
  }

  /** The replica as the seed renders it: 14 Tuesdays, 6 October at 18:00. */
  function seededPiano(eventId: string): Snapshot[] {
    return TUESDAYS.map((date) => ({
      eventId,
      occurrenceDate: date,
      summary: "Piano",
      location: null,
      categoryIds: [cleoId],
      times: date === OVERRIDDEN ? OVERRIDE_TIMES : pianoSlot(date),
    }));
  }

  async function readEvent(id: string): Promise<EventSlice | null> {
    const { rows } = await pool.query<
      Omit<EventSlice, "starts_at" | "ends_at"> & { starts_at: Date | null; ends_at: Date | null }
    >(
      "select summary, location, rrule, starts_at, ends_at, timezone, created_by, updated_by " +
        "from family.events where id = $1",
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return { ...row, starts_at: iso(row.starts_at), ends_at: iso(row.ends_at) };
  }

  async function exceptionRows(eventId: string): Promise<ExceptionSlice[]> {
    const { rows } = await pool.query<
      Omit<ExceptionSlice, "starts_at" | "ends_at"> & { starts_at: Date | null; ends_at: Date | null }
    >(
      "select occurrence_date::text as occurrence_date, action, summary, location, starts_at, ends_at, " +
        "start_date::text as start_date, end_date::text as end_date, updated_by " +
        "from family.event_exceptions where event_id = $1 order by occurrence_date",
      [eventId],
    );
    return rows.map((row) => ({ ...row, starts_at: iso(row.starts_at), ends_at: iso(row.ends_at) }));
  }

  /** Just the keys and kinds — for "which exceptions live on which segment". */
  async function exceptionKeys(eventId: string): Promise<{ occurrence_date: string; action: string }[]> {
    return (await exceptionRows(eventId)).map(({ occurrence_date, action }) => ({
      occurrence_date,
      action,
    }));
  }

  async function linkRows(eventId: string): Promise<LinkSlice[]> {
    const { rows } = await pool.query<LinkSlice>(
      "select category_id, position from family.event_categories where event_id = $1 order by position",
      [eventId],
    );
    return rows;
  }

  async function eventCount(): Promise<number> {
    const { rows } = await pool.query<{ n: number }>(
      "select count(*)::int as n from family.events where household_id = $1",
      [householdId],
    );
    return rows[0]?.n ?? 0;
  }

  /** Setup only: the action-level PIN path is Phase 1's suite's job. */
  async function givePin(profileId: string, pin: string): Promise<void> {
    const { error } = await admin
      .schema("family")
      .rpc("set_pin", { p_user_id: user.id, p_profile: profileId, p_pin: pin });
    if (error) throw error;
  }

  /** The seed's override row exactly as `makePiano` wrote it — untouched by a series-level write. */
  function seededOverrideRow(): ExceptionSlice {
    return {
      occurrence_date: OVERRIDDEN,
      action: "override",
      summary: null,
      location: null,
      starts_at: OVERRIDE_TIMES.startsAt,
      ends_at: OVERRIDE_TIMES.endsAt,
      start_date: null,
      end_date: null,
      updated_by: null,
    };
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-event-scopes`);
    // Expansion and every occurrence key work in the household's zone (FR-284).
    await pool.query("update family.household_settings set timezone = $1 where household_id = $2", [
      ZONE,
      householdId,
    ]);
    const email = testEmail("event-scopes", run);
    await pool.query("insert into family.household_users (household_id, email) values ($1, $2)", [
      householdId,
      email,
    ]);
    const [created] = await createUsers(admin, [email]);
    if (!created) throw new Error("expected one fixture account");
    user = created;

    anaId = await insertCategory(pool, {
      householdId,
      label: `Ana ${run}`,
      color: "#915EA1",
      role: "parent",
    });
    cleoId = await insertCategory(pool, {
      householdId,
      label: `Cleo ${run}`,
      color: "#93D1E6",
      role: "member",
    });

    // Binds the allowlist row to the account, exactly as the first sign-in
    // does — `set_pin` refuses a caller who has not claimed yet.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(anaId, PARENT_PIN);
  });

  // A fresh punch-in per check: the idle TTL is three minutes by default and
  // the checks are many round trips long. Ana is the actor throughout.
  beforeEach(async () => {
    state.cookies.clear();
    expectOk(await punchIn(anaId, PARENT_PIN));
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  it("precondition: the replica expands like the seeded Piano — 14 Tuesdays, 6 October at 18:00", async () => {
    const id = await makePiano();
    expect(await occurrencesOf([id])).toEqual(seededPiano(id));
    expect(await exceptionRows(id)).toEqual([seededOverrideRow()]);
  });

  describe("check 1 — edit at 'this': an override upsert on the one occurrence (T037, US2-7, FR-239)", () => {
    let id: string;
    let before: Snapshot[];

    beforeAll(async () => {
      id = await makePiano();
      before = await occurrencesOf([id]);
    });

    it("retitles only 6 October, merging onto the saved time override", async () => {
      expectOk(
        await updateEvent({
          id,
          patch: { summary: "Piano recital" },
          scope: "this",
          occurrenceDate: OVERRIDDEN,
        }),
      );

      expect(await occurrencesOf([id])).toEqual(
        withChange(before, OVERRIDDEN, { summary: "Piano recital" }),
      );
      // One row on the key, the 18:00 time still in it — a merge, not a replacement.
      expect(await exceptionRows(id)).toEqual([
        { ...seededOverrideRow(), summary: "Piano recital", updated_by: anaId },
      ]);
      // The series itself is untouched: every other Tuesday still reads "Piano".
      expect(await readEvent(id)).toMatchObject({ summary: "Piano", rrule: PIANO_RRULE });
    });

    it("a second field merges onto the same row: place joins title and time", async () => {
      expectOk(
        await updateEvent({
          id,
          patch: { location: "Hall B" },
          scope: "this",
          occurrenceDate: OVERRIDDEN,
        }),
      );

      expect(await occurrencesOf([id])).toEqual(
        withChange(before, OVERRIDDEN, { summary: "Piano recital", location: "Hall B" }),
      );
      expect(await exceptionRows(id)).toEqual([
        { ...seededOverrideRow(), summary: "Piano recital", location: "Hall B", updated_by: anaId },
      ]);
    });

    it("a grid→band time override on the timed-overridden occurrence nulls the instant pair in the same upsert (contracts step 4, FR-251)", async () => {
      expectOk(
        await updateEvent({
          id,
          patch: { allDay: true, startDate: OVERRIDDEN, endDate: OVERRIDDEN },
          scope: "this",
          occurrenceDate: OVERRIDDEN,
        }),
      );

      expect(await occurrencesOf([id])).toEqual(
        withChange(before, OVERRIDDEN, {
          summary: "Piano recital",
          location: "Hall B",
          times: { allDay: true, startDate: OVERRIDDEN, endDate: OVERRIDDEN },
        }),
      );
      // `exception_time_shape` holds: the date pair is populated, the instant pair is gone.
      expect(await exceptionRows(id)).toEqual([
        {
          occurrence_date: OVERRIDDEN,
          action: "override",
          summary: "Piano recital",
          location: "Hall B",
          starts_at: null,
          ends_at: null,
          start_date: OVERRIDDEN,
          end_date: OVERRIDDEN,
          updated_by: anaId,
        },
      ]);
    });

    it("band→grid back, landing on the Wednesday: the date pair is nulled and the key stays 6 October", async () => {
      const moved = timedOn("2026-10-07", [18, 0], [18, 45]);
      expectOk(
        await updateEvent({
          id,
          patch: moved,
          scope: "this",
          occurrenceDate: OVERRIDDEN,
        }),
      );

      // The occurrence renders on 7 October but is still keyed by its ORIGINAL date (R204).
      expect(await occurrencesOf([id])).toEqual(
        withChange(before, OVERRIDDEN, { summary: "Piano recital", location: "Hall B", times: moved }),
      );
      expect(await exceptionRows(id)).toEqual([
        {
          occurrence_date: OVERRIDDEN,
          action: "override",
          summary: "Piano recital",
          location: "Hall B",
          starts_at: moved.startsAt,
          ends_at: moved.endsAt,
          start_date: null,
          end_date: null,
          updated_by: anaId,
        },
      ]);
      expect(await readEvent(id)).toMatchObject({
        summary: "Piano",
        location: null,
        rrule: PIANO_RRULE,
        starts_at: chicagoIso(FIRST, 17, 0),
      });
    });
  });

  describe("check 2 — edit at 'this_and_future': the atomic split (T038, US2-8, FR-241, R204)", () => {
    it("truncates the head to 5 October, grows a self-contained 18:00 tail from the cut, re-homes exceptions ≥ cut keys-unchanged, copies categories", async () => {
      const headId = await makePiano();
      // Exceptions on both sides of the cut: one before it (stays), a skip and a
      // title override after it (move with their keys).
      await insertOverride(headId, "2026-09-29", { location: "Hall A" });
      await insertSkip(headId, "2026-11-03");
      await insertOverride(headId, "2026-11-17", { summary: "Piano (recital)" });

      const before = await occurrencesOf([headId]);
      expect(before).toEqual(
        withChange(
          withChange(without(seededPiano(headId), "2026-11-03"), "2026-09-29", { location: "Hall A" }),
          "2026-11-17",
          { summary: "Piano (recital)" },
        ),
      );
      const countBefore = await eventCount();

      const result = expectOk(
        await updateEvent({
          id: headId,
          patch: { startsAt: OVERRIDE_TIMES.startsAt, endsAt: OVERRIDE_TIMES.endsAt },
          scope: "this_and_future",
          occurrenceDate: OVERRIDDEN,
        }),
      );
      expect(result.eventId).toBe(headId);
      const tailId = result.splitEventId;
      if (tailId === null) throw new Error("this_and_future off the first occurrence must split");
      expect(tailId).not.toBe(headId);
      expect(await eventCount()).toBe(countBefore + 1);

      // The FULL set: 15/22/29 September still 17:00 on the head; 6 October and
      // every later Tuesday read 18:00 on the tail; the skip is still skipped and
      // the retitled occurrence still retitled — same keys, new home.
      const expected = before.map((entry) =>
        entry.occurrenceDate < OVERRIDDEN
          ? entry
          : {
              ...entry,
              eventId: tailId,
              times: timedOn(entry.occurrenceDate, [18, 0], [18, 45]),
            },
      );
      expect(await occurrencesOf([headId, tailId])).toEqual(expected);
      expect(await occurrencesOf([headId])).toEqual(
        before.filter((entry) => entry.occurrenceDate < OVERRIDDEN),
      );

      // Head: UNTIL = cut − 1 day, everything else as it was, attributed to the actor.
      const head = await readEvent(headId);
      expect(head).toMatchObject({
        summary: "Piano",
        starts_at: chicagoIso(FIRST, 17, 0),
        ends_at: chicagoIso(FIRST, 17, 45),
        updated_by: anaId,
      });
      expect(untilDateOf(head?.rrule ?? null)).toBe("2026-10-05");
      expect(parseRule(head?.rrule ?? "")).toMatchObject({ freq: "WEEKLY", byDay: ["TU"] });

      // Tail: self-contained — starts on the chosen occurrence with the patch
      // applied, the original UNTIL carried over, provenance copied, created by the actor.
      const tail = await readEvent(tailId);
      expect(tail).toMatchObject({
        summary: "Piano",
        location: null,
        starts_at: OVERRIDE_TIMES.startsAt,
        ends_at: OVERRIDE_TIMES.endsAt,
        timezone: ZONE,
        created_by: anaId,
        updated_by: anaId,
      });
      expect(untilDateOf(tail?.rrule ?? null)).toBe("2026-12-15");
      expect(parseRule(tail?.rrule ?? "")).toMatchObject({ freq: "WEEKLY", byDay: ["TU"] });
      expect(await linkRows(tailId)).toEqual([{ category_id: cleoId, position: 0 }]);
      expect(await linkRows(headId)).toEqual([{ category_id: cleoId, position: 0 }]);

      // Exceptions: < cut stayed on the head; ≥ cut moved to the tail, keys unchanged.
      expect(await exceptionKeys(headId)).toEqual([
        { occurrence_date: "2026-09-29", action: "override" },
      ]);
      expect(await exceptionKeys(tailId)).toEqual([
        { occurrence_date: OVERRIDDEN, action: "override" },
        { occurrence_date: "2026-11-03", action: "skip" },
        { occurrence_date: "2026-11-17", action: "override" },
      ]);
      // The re-homed 6 October override still carries its own time and nothing else.
      expect((await exceptionRows(tailId))[0]).toEqual(seededOverrideRow());
    });

    it("on the first occurrence the scope is promoted to 'all': in place, no split, no empty segment (FR-241)", async () => {
      const id = await makePiano();
      const before = await occurrencesOf([id]);
      const countBefore = await eventCount();

      const result = expectOk(
        await updateEvent({
          id,
          patch: { summary: "Piano lessons" },
          scope: "this_and_future",
          occurrenceDate: FIRST,
        }),
      );
      expect(result).toEqual({ eventId: id, splitEventId: null });
      expect(await eventCount()).toBe(countBefore);

      expect(await occurrencesOf([id])).toEqual(
        before.map((entry) => ({ ...entry, summary: "Piano lessons" })),
      );
      expect(await readEvent(id)).toMatchObject({
        summary: "Piano lessons",
        rrule: PIANO_RRULE,
        updated_by: anaId,
      });
      expect(await exceptionRows(id)).toEqual([seededOverrideRow()]);
    });

    it("split atomicity: a failing tail insert leaves the series whole (R204, 015)", async () => {
      const id = await makePiano();
      const before = await occurrencesOf([id]);
      const countBefore = await eventCount();

      // Straight at the database function as the service role, with a tail that
      // trips 010's summary CHECK: the head is truncated FIRST inside the same
      // transaction, so only a rollback can explain an intact head afterwards.
      const { error } = await admin.schema("family").rpc("split_event_series", {
        p_household_id: householdId,
        p_event_id: id,
        p_actor: anaId,
        p_head_rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261006T045959Z;WKST=SU;BYDAY=TU",
        p_cut: OVERRIDDEN,
        p_tail_event: {
          summary: "",
          description: null,
          location: null,
          all_day: false,
          starts_at: OVERRIDE_TIMES.startsAt,
          ends_at: OVERRIDE_TIMES.endsAt,
          start_date: null,
          end_date: null,
          timezone: ZONE,
          rrule: PIANO_RRULE,
          countdown_enabled: false,
        },
        p_tail_category_ids: [cleoId],
      });
      expect(error?.code).toBe("23514");

      expect(await eventCount()).toBe(countBefore);
      expect(await readEvent(id)).toMatchObject({ rrule: PIANO_RRULE, updated_by: null });
      expect(await exceptionRows(id)).toEqual([seededOverrideRow()]);
      expect(await occurrencesOf([id])).toEqual(before);
    });
  });

  describe("check 3 — edit at 'all': the segment in place, past and future (T039, US2-9, FR-242)", () => {
    it("reassigns the profile and retitles every occurrence, the saved override untouched", async () => {
      const id = await makePiano();
      const before = await occurrencesOf([id]);
      const countBefore = await eventCount();

      expectOk(
        await updateEvent({
          id,
          patch: { summary: "Piano lessons", categoryIds: [anaId, cleoId] },
          scope: "all",
        }),
      );

      expect(await eventCount()).toBe(countBefore);
      expect(await occurrencesOf([id])).toEqual(
        before.map((entry) => ({
          ...entry,
          summary: "Piano lessons",
          categoryIds: [anaId, cleoId],
        })),
      );
      expect(await linkRows(id)).toEqual([
        { category_id: anaId, position: 0 },
        { category_id: cleoId, position: 1 },
      ]);
      expect(await readEvent(id)).toMatchObject({
        summary: "Piano lessons",
        rrule: PIANO_RRULE,
        updated_by: anaId,
      });
      // 6 October still reads 18:00 (in the set above) and its row is exactly as saved.
      expect(await exceptionRows(id)).toEqual([seededOverrideRow()]);
    });

    it("after a prior split, 'all' reaches only the chosen segment (FR-242)", async () => {
      const headId = await makePiano();
      const split = expectOk(
        await updateEvent({
          id: headId,
          patch: { location: "Hall C" },
          scope: "this_and_future",
          occurrenceDate: "2026-10-13",
        }),
      );
      const tailId = split.splitEventId;
      if (tailId === null) throw new Error("this_and_future off the first occurrence must split");
      const before = await occurrencesOf([headId, tailId]);
      expect(datesOf(before.filter((entry) => entry.eventId === headId))).toEqual([
        "2026-09-15",
        "2026-09-22",
        "2026-09-29",
        OVERRIDDEN,
      ]);

      expectOk(await updateEvent({ id: tailId, patch: { summary: "Piano (new term)" }, scope: "all" }));
      const afterTail = await occurrencesOf([headId, tailId]);
      expect(afterTail).toEqual(
        before.map((entry) =>
          entry.eventId === tailId ? { ...entry, summary: "Piano (new term)" } : entry,
        ),
      );
      expect((await readEvent(headId))?.summary).toBe("Piano");

      // And the other way round: the head is its own series now.
      expectOk(await updateEvent({ id: headId, patch: { summary: "Piano (old term)" }, scope: "all" }));
      expect(await occurrencesOf([headId, tailId])).toEqual(
        afterTail.map((entry) =>
          entry.eventId === headId ? { ...entry, summary: "Piano (old term)" } : entry,
        ),
      );
      expect((await readEvent(tailId))?.summary).toBe("Piano (new term)");
      // The 6 October override sat before the cut, so it stayed with the head — and still holds.
      expect(await exceptionKeys(headId)).toEqual([{ occurrence_date: OVERRIDDEN, action: "override" }]);
      expect(await exceptionKeys(tailId)).toEqual([]);
    });

    it("a series-level time change does not orphan the date-keyed override (R204)", async () => {
      const id = await makePiano();
      const before = await occurrencesOf([id]);

      // 17:00 → 16:00 on the series' own Tuesday: the instants are the series start moved an hour.
      expectOk(
        await updateEvent({
          id,
          patch: { startsAt: chicagoIso(FIRST, 16, 0), endsAt: chicagoIso(FIRST, 16, 45) },
          scope: "all",
        }),
      );

      const after = await occurrencesOf([id]);
      expect(after).toEqual(
        before.map((entry) =>
          entry.occurrenceDate === OVERRIDDEN
            ? entry
            : { ...entry, times: timedOn(entry.occurrenceDate, [16, 0], [16, 45]) },
        ),
      );
      // The override is still found on its date key and still wins on 6 October.
      expect(after.find((entry) => entry.occurrenceDate === OVERRIDDEN)?.times).toEqual(OVERRIDE_TIMES);
      expect(await exceptionRows(id)).toEqual([seededOverrideRow()]);

      const row = await readEvent(id);
      expect(row).toMatchObject({
        starts_at: chicagoIso(FIRST, 16, 0),
        ends_at: chicagoIso(FIRST, 16, 45),
        updated_by: anaId,
      });
      // Same weekday, so the rule's anchor parts are unchanged and UNTIL is carried.
      expect(parseRule(row?.rrule ?? "")).toMatchObject({ freq: "WEEKLY", byDay: ["TU"] });
      expect(untilDateOf(row?.rrule ?? null)).toBe("2026-12-15");
    });
  });

  describe("check 4 — delete at 'this': a skip on the date (T040, US2-10, FR-240)", () => {
    let id: string;
    let before: Snapshot[];

    beforeAll(async () => {
      id = await makePiano();
      before = await occurrencesOf([id]);
    });

    it("13 October disappears; 6 and 20 October remain", async () => {
      expectOk(
        await deleteEvent({ id, confirm: true, scope: "this", occurrenceDate: "2026-10-13" }),
      );

      const after = await occurrencesOf([id]);
      expect(after).toEqual(without(before, "2026-10-13"));
      expect(datesOf(after)).toEqual(expect.arrayContaining([OVERRIDDEN, "2026-10-20"]));
      expect(datesOf(after)).not.toContain("2026-10-13");

      expect(await exceptionRows(id)).toEqual([
        seededOverrideRow(),
        {
          occurrence_date: "2026-10-13",
          action: "skip",
          summary: null,
          location: null,
          starts_at: null,
          ends_at: null,
          start_date: null,
          end_date: null,
          updated_by: anaId,
        },
      ]);
      // The series row is not the thing that changed.
      expect(await readEvent(id)).toMatchObject({ rrule: PIANO_RRULE, summary: "Piano" });
    });

    it("deleting 6 October replaces its saved override with a skip — the per-occurrence edit goes with the occurrence", async () => {
      expectOk(
        await deleteEvent({ id, confirm: true, scope: "this", occurrenceDate: OVERRIDDEN }),
      );

      expect(await occurrencesOf([id])).toEqual(without(before, "2026-10-13", OVERRIDDEN));
      // Still one row on the key — now a skip carrying nothing (exception_payload_shape).
      expect(await exceptionRows(id)).toEqual([
        {
          occurrence_date: OVERRIDDEN,
          action: "skip",
          summary: null,
          location: null,
          starts_at: null,
          ends_at: null,
          start_date: null,
          end_date: null,
          updated_by: anaId,
        },
        expect.objectContaining({ occurrence_date: "2026-10-13", action: "skip" }),
      ]);
    });
  });

  describe("check 5 — delete at 'this_and_future': the series ends before the cut (T041, US2-19, FR-286)", () => {
    it("6 October and every later Tuesday go, the saved override with them; 15/22/29 September still read 17:00", async () => {
      const id = await makePiano();
      await insertOverride(id, "2026-09-29", { location: "Hall A" });
      await insertSkip(id, "2026-11-03");
      const before = await occurrencesOf([id]);
      const countBefore = await eventCount();

      expectOk(
        await deleteEvent({
          id,
          confirm: true,
          scope: "this_and_future",
          occurrenceDate: OVERRIDDEN,
        }),
      );

      // Truncated, not deleted: the row stays, its links stay.
      expect(await eventCount()).toBe(countBefore);
      expect(await linkRows(id)).toEqual([{ category_id: cleoId, position: 0 }]);

      const after = await occurrencesOf([id]);
      expect(after).toEqual(before.filter((entry) => entry.occurrenceDate < OVERRIDDEN));
      expect(datesOf(after)).toEqual(["2026-09-15", "2026-09-22", "2026-09-29"]);
      expect(after.map((entry) => entry.times)).toEqual(
        ["2026-09-15", "2026-09-22", "2026-09-29"].map(pianoSlot),
      );

      const row = await readEvent(id);
      expect(untilDateOf(row?.rrule ?? null)).toBe("2026-10-05");
      expect(row).toMatchObject({ summary: "Piano", updated_by: anaId });

      // Every exception dated ≥ cut is gone — the 6 October override and the
      // November skip — and the earlier per-occurrence edit is untouched.
      expect(await exceptionRows(id)).toEqual([
        {
          occurrence_date: "2026-09-29",
          action: "override",
          summary: null,
          location: "Hall A",
          starts_at: null,
          ends_at: null,
          start_date: null,
          end_date: null,
          updated_by: null,
        },
      ]);

      // Why truncate-first is safe (data-model 012): an exception dated beyond
      // the new UNTIL is inert — the expander never reaches it, so a failure
      // between the two statements could never show a wrong calendar.
      await insertOverride(id, "2026-10-20", { summary: "Stray" });
      expect(await occurrencesOf([id])).toEqual(after);
    });

    it("on the first occurrence the whole series goes", async () => {
      const id = await makePiano();
      const countBefore = await eventCount();

      expectOk(
        await deleteEvent({ id, confirm: true, scope: "this_and_future", occurrenceDate: FIRST }),
      );

      expect(await eventCount()).toBe(countBefore - 1);
      expect(await readEvent(id)).toBeNull();
      expect(await linkRows(id)).toEqual([]);
      expect(await exceptionRows(id)).toEqual([]);
      expect(await occurrencesOf([id])).toEqual([]);
    });
  });

  describe("check 6 — delete at 'all': the row goes and everything cascades (T042, FR-243)", () => {
    it("links and exceptions cascade with the row — no skip ghost survives", async () => {
      const id = await makePiano();
      await insertSkip(id, "2026-10-13");
      expect(await exceptionKeys(id)).toEqual([
        { occurrence_date: OVERRIDDEN, action: "override" },
        { occurrence_date: "2026-10-13", action: "skip" },
      ]);
      const countBefore = await eventCount();

      expectOk(await deleteEvent({ id, confirm: true, scope: "all" }));

      expect(await eventCount()).toBe(countBefore - 1);
      expect(await readEvent(id)).toBeNull();
      expect(await linkRows(id)).toEqual([]);
      expect(await exceptionRows(id)).toEqual([]);
      expect(await occurrencesOf([id])).toEqual([]);
    });

    it("after a prior split, 'all' deletes only the chosen segment; the other survives whole", async () => {
      const headId = await makePiano();
      const split = expectOk(
        await updateEvent({
          id: headId,
          patch: { location: "Hall C" },
          scope: "this_and_future",
          occurrenceDate: "2026-10-13",
        }),
      );
      const tailId = split.splitEventId;
      if (tailId === null) throw new Error("this_and_future off the first occurrence must split");
      const before = await occurrencesOf([headId, tailId]);
      const countBefore = await eventCount();

      expectOk(await deleteEvent({ id: tailId, confirm: true, scope: "all" }));

      expect(await eventCount()).toBe(countBefore - 1);
      expect(await readEvent(tailId)).toBeNull();
      expect(await occurrencesOf([headId, tailId])).toEqual(
        before.filter((entry) => entry.eventId === headId),
      );
      expect(await exceptionRows(headId)).toEqual([seededOverrideRow()]);
      expect(await linkRows(headId)).toEqual([{ category_id: cleoId, position: 0 }]);
    });
  });
});
