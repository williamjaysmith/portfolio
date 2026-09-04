/**
 * T036 / SC-205: the event write surface's gates, attribution and scope
 * discipline (`createEvent`, `updateEvent`, `deleteEvent`), against the live
 * local stack with the same plumbing as `actions-writes.test.ts` — Next's
 * cookie store is an in-memory jar, the request's Supabase session is a real
 * signed-in client, and everything else (guards, the signed actor cookie, the
 * admin client, RLS, the shared expander) is the production code.
 *
 * Covered here, per contracts/server-actions.md:
 *   - FR-270: create/update/delete each refuse with `NO_ACTOR` — no actor and
 *     a tampered cookie alike — and NOTHING is written;
 *   - FR-272: a punched-in CHILD creates successfully (events are not
 *     parent-only);
 *   - FR-271/US2-2: `created_by`/`updated_by` come from the actor, never the
 *     payload;
 *   - FR-238: scope on a one-off → `VALIDATION`; scope missing on a repeat →
 *     `VALIDATION`;
 *   - FR-287/FR-239: `categoryIds` or `repeat` in a `scope: 'this'` patch →
 *     `VALIDATION`;
 *   - a phantom or skipped `occurrenceDate` → `NOT_FOUND` (the shared
 *     expander is the judge);
 *   - FR-258: `confirm !== true` → `VALIDATION`;
 *   - tenancy: an id outside the household → `NOT_FOUND`, never `FORBIDDEN`.
 *
 * Fixture rows are created by this file in a run-tagged household of its own,
 * never taken from the seed (the events-access.test.ts pattern), so nothing
 * here can drift with — or damage — the shared seeded week.
 *
 * RED by design until T043–T045 land `lib/family/actions/events.ts`: the
 * dynamic import below fails while the module does not exist, which is
 * exactly the failing state T036 must leave behind.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pool } from "pg";

import type { ActionError, ActionResult } from "@/lib/family/errors";
import type { DeleteEventInput, Event, EventInput, UpdateEventInput } from "@/lib/family/types";
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

const ACTOR_COOKIE = "family_actor";

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
    if (!state.client) throw new Error("event-actions.test: no signed-in client selected");
    return state.client;
  },
}));

// The app reads its Supabase coordinates from these; point them at the local stack.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL.url;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = LOCAL.publishableKey;
process.env.SUPABASE_SECRET_KEY = LOCAL.secretKey;
process.env.FAMILY_ACTOR_SECRET ??= "policy-suite-actor-secret-0123456789abcdef0123456789";

const { punchIn } = await import("@/lib/family/actions/punch-in");

/** The surface T043–T045 must export (contracts/server-actions.md). */
interface EventActionsModule {
  createEvent(input: EventInput): Promise<ActionResult<Event>>;
  updateEvent(
    input: UpdateEventInput,
  ): Promise<ActionResult<{ eventId: string; splitEventId: string | null }>>;
  deleteEvent(input: DeleteEventInput): Promise<ActionResult<null>>;
}

// Joined at runtime so `tsc` stays clean while the module does not exist yet;
// Vitest resolves the `@` alias when the import actually runs. Until T043
// creates the module this await throws and the whole suite is RED — the
// failing state this task must leave behind.
const EVENTS_MODULE = ["@", "lib", "family", "actions", "events"].join("/");
const { createEvent, updateEvent, deleteEvent } = (await import(
  EVENTS_MODULE
)) as EventActionsModule;

function expectOk<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new Error(`expected success, got ${result.error} (${result.message})`);
}

function expectFailure(result: ActionResult<unknown>, code: ActionError): void {
  expect(result).toMatchObject({ ok: false, error: code });
}

/** Re-encode the payload without re-signing: the signature no longer matches. */
function tamper(token: string): string {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("not a JWT");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
  claims.role = "parent";
  claims.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const forged = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${forged}.${signature}`;
}

// Canonical grammar order (research R201) — must pass 010's `^FREQ=` /
// no-COUNT CHECK as stored. Tuesdays from 2026-10-06 (a Tuesday).
const SERIES_RRULE = "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261215T235959Z;WKST=SU;BYDAY=TU";
const SERIES_START = "2026-10-06T14:00:00Z";
const SERIES_END = "2026-10-06T15:00:00Z";
/** A real, unskipped occurrence of the series above. */
const REAL_OCCURRENCE = "2026-10-06";
/** A Wednesday — never an occurrence of a Tuesday series. */
const PHANTOM_OCCURRENCE = "2026-10-07";
/** A Tuesday the fixture skips: a deleted occurrence is not editable. */
const SKIPPED_OCCURRENCE = "2026-10-13";

const DEVICE_TZ = "America/Chicago";

interface EventSeed {
  householdId: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  rrule?: string;
}

/** Inserts a timed event as `postgres` (bypasses grants, not constraints). */
async function insertEvent(pool: Pool, seed: EventSeed): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "insert into family.events (household_id, summary, all_day, starts_at, ends_at, timezone, rrule) " +
      "values ($1, $2, false, $3, $4, 'UTC', $5) returning id",
    [seed.householdId, seed.summary, seed.startsAt, seed.endsAt, seed.rrule ?? null],
  );
  const [row] = rows;
  if (!row) throw new Error("insert into family.events returned no row");
  return row.id;
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

describe("event actions: gates, attribution and scope discipline (T036)", () => {
  const fx = fixtures();
  const run = fx.run;
  const PARENT_PIN = "4141";
  const CHILD_PIN = "4242";

  let pool: Pool;
  let admin: SupabaseClient;
  let user: FixtureUser;
  let householdId: string;
  let otherHouseholdId: string;
  /** The household's parent profile — an actor for the scope suites. */
  let parentId: string;
  /** A member ("child") profile — FR-272's actor. */
  let childId: string;
  /** A non-repeating event in the household. */
  let oneOffId: string;
  /** The Tuesday series, with `SKIPPED_OCCURRENCE` skipped. */
  let seriesId: string;
  /** A live event in a household this user has no claim on. */
  let foreignEventId: string;
  /** Set by the FR-272 create; the attribution suite reads and updates it. */
  let childEventId: string;

  /** What the DATABASE holds — an action's return value is never the guarantee. */
  async function readEvent(
    id: string,
  ): Promise<{ summary: string; created_by: string | null; updated_by: string | null } | null> {
    const { rows } = await pool.query<{
      summary: string;
      created_by: string | null;
      updated_by: string | null;
    }>("select summary, created_by, updated_by from family.events where id = $1", [id]);
    return rows[0] ?? null;
  }

  async function eventExists(id: string): Promise<boolean> {
    return (await readEvent(id)) !== null;
  }

  async function eventCount(hid: string): Promise<number> {
    const { rows } = await pool.query<{ n: number }>(
      "select count(*)::int as n from family.events where household_id = $1",
      [hid],
    );
    return rows[0]?.n ?? 0;
  }

  async function exceptionRows(
    eventId: string,
  ): Promise<{ occurrence_date: string; action: string }[]> {
    const { rows } = await pool.query<{ occurrence_date: string; action: string }>(
      "select occurrence_date::text as occurrence_date, action from family.event_exceptions " +
        "where event_id = $1 order by occurrence_date",
      [eventId],
    );
    return rows;
  }

  async function linkRows(eventId: string): Promise<{ category_id: string; position: number }[]> {
    const { rows } = await pool.query<{ category_id: string; position: number }>(
      "select category_id, position from family.event_categories where event_id = $1 order by position",
      [eventId],
    );
    return rows;
  }

  /** Setup only: the action-level PIN path is Phase 1's suite's job. */
  async function givePin(profileId: string, pin: string): Promise<void> {
    const { error } = await admin
      .schema("family")
      .rpc("set_pin", { p_user_id: user.id, p_profile: profileId, p_pin: pin });
    if (error) throw error;
  }

  function timedInput(summary: string, categoryIds: string[] = []): EventInput {
    return {
      allDay: false,
      startsAt: "2026-10-09T16:00:00.000Z",
      endsAt: "2026-10-09T17:00:00.000Z",
      summary,
      timezone: DEVICE_TZ,
      repeat: { kind: "never" },
      categoryIds,
    };
  }

  beforeAll(async () => {
    pool = createPool();
    admin = adminClient();

    householdId = await insertHousehold(pool, `test-${run}-event-actions`);
    otherHouseholdId = await insertHousehold(pool, `test-${run}-event-actions-other`);
    const email = testEmail("event-actions", run);
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
    childId = await insertCategory(pool, {
      householdId,
      label: `Kid ${run}`,
      color: "#B6E085",
      role: "member",
    });

    oneOffId = await insertEvent(pool, {
      householdId,
      summary: `One-off ${run}`,
      startsAt: "2026-10-08T16:00:00Z",
      endsAt: "2026-10-08T17:00:00Z",
    });
    seriesId = await insertEvent(pool, {
      householdId,
      summary: `Series ${run}`,
      startsAt: SERIES_START,
      endsAt: SERIES_END,
      rrule: SERIES_RRULE,
    });
    await insertSkip(pool, householdId, seriesId, SKIPPED_OCCURRENCE);
    foreignEventId = await insertEvent(pool, {
      householdId: otherHouseholdId,
      summary: `Foreign ${run}`,
      startsAt: "2026-10-08T18:00:00Z",
      endsAt: "2026-10-08T19:00:00Z",
    });

    // Binds the allowlist row to the account, exactly as the first sign-in
    // does — `set_pin` refuses a caller who has not claimed yet.
    const client = await userClient(user);
    const claimed = await client.schema("family").rpc("claim_membership");
    if (claimed.error) throw claimed.error;
    state.client = client;
    state.cookies.clear();

    await givePin(parentId, PARENT_PIN);
    await givePin(childId, CHILD_PIN);
  });

  afterAll(async () => {
    state.client = null;
    state.cookies.clear();
    await deleteHousehold(pool, householdId);
    await deleteHousehold(pool, otherHouseholdId);
    await deleteUsers(admin, [user.id]);
    await pool.end();
  });

  describe("with nobody punched in every write is NO_ACTOR and nothing is written (FR-270, SC-205)", () => {
    beforeEach(() => {
      state.cookies.clear();
    });

    it("createEvent → NO_ACTOR and no row appears", async () => {
      const before = await eventCount(householdId);
      expectFailure(await createEvent(timedInput(`Ghost ${run}`)), "NO_ACTOR");
      expect(await eventCount(householdId)).toBe(before);
    });

    it("updateEvent → NO_ACTOR and the row is untouched", async () => {
      expectFailure(
        await updateEvent({ id: oneOffId, patch: { summary: `Renamed ${run}` } }),
        "NO_ACTOR",
      );
      expect((await readEvent(oneOffId))?.summary).toBe(`One-off ${run}`);
    });

    it("deleteEvent → NO_ACTOR and the row survives", async () => {
      expectFailure(await deleteEvent({ id: oneOffId, confirm: true }), "NO_ACTOR");
      expect(await eventExists(oneOffId)).toBe(true);
    });
  });

  describe("a tampered actor cookie is NO_ACTOR and nothing is written (FR-270)", () => {
    it("create, update and delete all refuse the forged cookie", async () => {
      state.cookies.clear();
      expectOk(await punchIn(parentId, PARENT_PIN));
      const token = state.cookies.get(ACTOR_COOKIE) ?? "";
      expect(token).not.toBe("");
      const forged = tamper(token);

      const before = await eventCount(householdId);
      state.cookies.set(ACTOR_COOKIE, forged);
      expectFailure(await createEvent(timedInput(`Forged ${run}`)), "NO_ACTOR");
      state.cookies.set(ACTOR_COOKIE, forged);
      expectFailure(
        await updateEvent({ id: oneOffId, patch: { summary: `Forged rename ${run}` } }),
        "NO_ACTOR",
      );
      state.cookies.set(ACTOR_COOKIE, forged);
      expectFailure(await deleteEvent({ id: oneOffId, confirm: true }), "NO_ACTOR");

      expect(await eventCount(householdId)).toBe(before);
      expect((await readEvent(oneOffId))?.summary).toBe(`One-off ${run}`);
      state.cookies.clear();
    });
  });

  describe("attribution comes from the actor, never the payload (FR-271/272, US2-2)", () => {
    it("a punched-in CHILD creates successfully — events are not parent-only (FR-272)", async () => {
      state.cookies.clear();
      expectOk(await punchIn(childId, CHILD_PIN));

      const created = expectOk(await createEvent(timedInput(`Child made ${run}`, [childId])));
      childEventId = created.id;
      expect(created).toMatchObject({ householdId, summary: `Child made ${run}` });

      expect(await readEvent(childEventId)).toMatchObject({
        summary: `Child made ${run}`,
        created_by: childId,
        updated_by: childId,
      });
      expect(await linkRows(childEventId)).toEqual([{ category_id: childId, position: 0 }]);
    });

    it("a payload smuggling its own attribution is refused, nothing written", async () => {
      const before = await eventCount(householdId);
      // Through `unknown` on purpose: the TYPE forbids attribution fields, so
      // smuggling one is exactly what a hand-rolled request would do.
      const smuggled = {
        ...timedInput(`Smuggled ${run}`),
        createdBy: parentId,
      } as unknown as EventInput;
      expectFailure(await createEvent(smuggled), "VALIDATION");
      expect(await eventCount(householdId)).toBe(before);
    });

    it("updated_by follows the punch-in on update; created_by never moves", async () => {
      state.cookies.clear();
      expectOk(await punchIn(parentId, PARENT_PIN));

      expectOk(
        await updateEvent({ id: childEventId, patch: { summary: `Parent renamed ${run}` } }),
      );
      expect(await readEvent(childEventId)).toMatchObject({
        summary: `Parent renamed ${run}`,
        created_by: childId,
        updated_by: parentId,
      });
    });
  });

  describe("scope discipline (FR-238, FR-287, FR-239)", () => {
    beforeAll(async () => {
      state.cookies.clear();
      expectOk(await punchIn(parentId, PARENT_PIN));
    });

    it("scope on a one-off update → VALIDATION, row untouched (FR-238)", async () => {
      expectFailure(
        await updateEvent({ id: oneOffId, patch: { summary: `Scoped ${run}` }, scope: "all" }),
        "VALIDATION",
      );
      expect((await readEvent(oneOffId))?.summary).toBe(`One-off ${run}`);
    });

    it("scope on a one-off delete → VALIDATION, row survives (FR-238)", async () => {
      expectFailure(await deleteEvent({ id: oneOffId, confirm: true, scope: "all" }), "VALIDATION");
      expect(await eventExists(oneOffId)).toBe(true);
    });

    it("scope missing on a repeat update → VALIDATION, row untouched", async () => {
      expectFailure(
        await updateEvent({ id: seriesId, patch: { summary: `Unscoped ${run}` } }),
        "VALIDATION",
      );
      expect((await readEvent(seriesId))?.summary).toBe(`Series ${run}`);
    });

    it("scope missing on a repeat delete → VALIDATION, row survives", async () => {
      expectFailure(await deleteEvent({ id: seriesId, confirm: true }), "VALIDATION");
      expect(await eventExists(seriesId)).toBe(true);
    });

    it("categoryIds in a scope:'this' patch → VALIDATION (FR-287)", async () => {
      expectFailure(
        await updateEvent({
          id: seriesId,
          patch: { categoryIds: [childId] },
          scope: "this",
          occurrenceDate: REAL_OCCURRENCE,
        }),
        "VALIDATION",
      );
      expect(await exceptionRows(seriesId)).toEqual([
        { occurrence_date: SKIPPED_OCCURRENCE, action: "skip" },
      ]);
    });

    it("repeat in a scope:'this' patch → VALIDATION (FR-239)", async () => {
      expectFailure(
        await updateEvent({
          id: seriesId,
          patch: { repeat: { kind: "never" } },
          scope: "this",
          occurrenceDate: REAL_OCCURRENCE,
        }),
        "VALIDATION",
      );
      expect(await exceptionRows(seriesId)).toEqual([
        { occurrence_date: SKIPPED_OCCURRENCE, action: "skip" },
      ]);
    });
  });

  describe("only a real, unskipped occurrence is editable (the shared expander)", () => {
    beforeAll(async () => {
      state.cookies.clear();
      expectOk(await punchIn(parentId, PARENT_PIN));
    });

    it("a phantom occurrenceDate on update → NOT_FOUND, no exception written", async () => {
      expectFailure(
        await updateEvent({
          id: seriesId,
          patch: { summary: `Phantom ${run}` },
          scope: "this",
          occurrenceDate: PHANTOM_OCCURRENCE,
        }),
        "NOT_FOUND",
      );
      expect(await exceptionRows(seriesId)).toEqual([
        { occurrence_date: SKIPPED_OCCURRENCE, action: "skip" },
      ]);
    });

    it("a skipped occurrenceDate on update → NOT_FOUND, the skip is all there is", async () => {
      expectFailure(
        await updateEvent({
          id: seriesId,
          patch: { summary: `Skipped ${run}` },
          scope: "this",
          occurrenceDate: SKIPPED_OCCURRENCE,
        }),
        "NOT_FOUND",
      );
      expect(await exceptionRows(seriesId)).toEqual([
        { occurrence_date: SKIPPED_OCCURRENCE, action: "skip" },
      ]);
      expect((await readEvent(seriesId))?.summary).toBe(`Series ${run}`);
    });

    it("a phantom occurrenceDate on delete → NOT_FOUND, no skip written", async () => {
      expectFailure(
        await deleteEvent({
          id: seriesId,
          confirm: true,
          scope: "this",
          occurrenceDate: PHANTOM_OCCURRENCE,
        }),
        "NOT_FOUND",
      );
      expect(await exceptionRows(seriesId)).toEqual([
        { occurrence_date: SKIPPED_OCCURRENCE, action: "skip" },
      ]);
    });
  });

  describe("the confirm gate and tenancy", () => {
    beforeAll(async () => {
      state.cookies.clear();
      expectOk(await punchIn(parentId, PARENT_PIN));
    });

    it("deleteEvent with confirm !== true → VALIDATION and the row survives (FR-258)", async () => {
      expectFailure(await deleteEvent({ id: oneOffId, confirm: false }), "VALIDATION");
      expect(await eventExists(oneOffId)).toBe(true);
    });

    it("an update on an id outside the household → NOT_FOUND, never FORBIDDEN", async () => {
      expectFailure(
        await updateEvent({ id: foreignEventId, patch: { summary: `Reached ${run}` } }),
        "NOT_FOUND",
      );
      expect((await readEvent(foreignEventId))?.summary).toBe(`Foreign ${run}`);
    });

    it("a delete on an id outside the household → NOT_FOUND and the row survives", async () => {
      expectFailure(await deleteEvent({ id: foreignEventId, confirm: true }), "NOT_FOUND");
      expect(await eventExists(foreignEventId)).toBe(true);
    });
  });
});
