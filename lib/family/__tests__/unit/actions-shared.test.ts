/**
 * `lib/family/actions/shared.ts` — the translation layer every /family server
 * action funnels through.
 *
 * Two guarantees are checked here:
 *   1. `mapDbError` turns a database failure into exactly the contract error
 *      the household is supposed to see (contracts/server-actions.md →
 *      "Error handling"), and never repeats what Postgres said.
 *   2. `toActorSession` tells the client the truth about the punch-in it is
 *      holding — the cookie's identity, the profile's current name/colour, and
 *      a timer input that cannot outlive the cookie (D12).
 *
 * The messages used as fixtures are the real ones the migrations raise
 * (supabase/migrations/001, 003, 004), so a change to a constraint that
 * renames "LAST_PARENT" fails here rather than in production.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";

import { mapDbError, toActorSession } from "@/lib/family/actions/shared";
import { ACTION_MESSAGES, ActionFailure, runAction, type ActionError } from "@/lib/family/errors";
import type { Actor, Category } from "@/lib/family/types";

// The module under test reaches the service-role client through `adminFamily()`.
// Nothing tested here calls it, and constructing one would demand real Supabase
// env, so the module is replaced wholesale.
vi.mock("@/lib/family/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("createAdminClient must not be called by these tests");
  },
}));

/** A PostgrestError exactly as supabase-js hands one to an action. */
function dbError(code: string, message: string): PostgrestError {
  const shape = { name: "PostgrestError", message, details: "", hint: "", code };
  return { ...shape, toJSON: () => shape };
}

describe("mapDbError", () => {
  it("turns the last-parent trigger into CONFLICT with copy about keeping a parent", () => {
    // The exact text family.guard_last_parent() raises (003_categories.sql).
    const failure = mapDbError(
      dbError("23514", "LAST_PARENT: a household must keep at least one parent profile"),
    );

    expect(failure).toBeInstanceOf(ActionFailure);
    expect(failure.code).toBe("CONFLICT");
    // FR-026 / US3-9: the household is told what to do, not that a trigger fired.
    expect(failure.message).toMatch(/parent/i);
    expect(failure.message).not.toBe(ACTION_MESSAGES.CONFLICT);
    expect(failure.message).not.toMatch(/LAST_PARENT/);
  });

  it("treats any other CHECK violation as VALIDATION rather than CONFLICT", () => {
    // An off-palette colour rejected by the family.palette_color domain (001).
    const failure = mapDbError(
      dbError(
        "23514",
        'value for domain family.palette_color violates check constraint "palette_color_check"',
      ),
    );

    expect(failure.code).toBe("VALIDATION");
    expect(failure.code).not.toBe("CONFLICT");
    expect(failure.message).not.toMatch(/palette_color|check constraint/);
  });

  it("treats a Label carrying person-only fields as VALIDATION", () => {
    const failure = mapDbError(
      dbError(
        "23514",
        'new row for relation "categories" violates check constraint "label_has_no_person_fields"',
      ),
    );

    expect(failure.code).toBe("VALIDATION");
  });

  // Every code the actions can meet, with the message Postgres/PostgREST really
  // sends. The expected message is the fixed user-facing copy, which is also
  // the leak check: a mapping that passed `error.message` through would fail.
  const MAPPED: ReadonlyArray<[code: string, expected: ActionError, raw: string]> = [
    ["23505", "CONFLICT", 'duplicate key value violates unique constraint "categories_user_key"'],
    ["23503", "CONFLICT", "profile account is not a member of this household"],
    ["22023", "VALIDATION", "PIN must be exactly 4 digits"],
    ["P0002", "NOT_FOUND", "query returned no rows"],
    ["PGRST116", "NOT_FOUND", "JSON object requested, multiple (or no) rows returned"],
    ["42501", "FORBIDDEN", "permission denied for schema family"],
  ];

  for (const [code, expected, raw] of MAPPED) {
    it(`maps ${code} to ${expected} and answers with the household's copy`, () => {
      const failure = mapDbError(dbError(code, raw));

      expect(failure.code).toBe(expected);
      expect(failure.message).toBe(ACTION_MESSAGES[expected]);
    });
  }

  it("reports an unrecognised code as UNAVAILABLE, logged server-side and never returned", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = dbError("42P01", 'relation "family.chores" does not exist');

    const failure = mapDbError(error);

    expect(failure.code).toBe("UNAVAILABLE");
    expect(failure.message).toBe(ACTION_MESSAGES.UNAVAILABLE);
    // A failure is never silently swallowed: it is diagnosable in the server log.
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]).toContain(error);

    logged.mockRestore();
  });

  it("still reports UNAVAILABLE when the driver gives no code at all", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const failure = mapDbError(dbError("", "TypeError: fetch failed"));

    expect(failure.code).toBe("UNAVAILABLE");
    expect(failure.message).toBe(ACTION_MESSAGES.UNAVAILABLE);

    logged.mockRestore();
  });

  it("never repeats the database's own words, whatever the code", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // A message shaped like the worst case: internal names and a hash fragment.
    const raw =
      'insert into "family.profile_pins" (pin_hash) values ($2a$10$K3lsecrethash) violates constraint "pin_hash_len"';
    const codes = [...MAPPED.map(([code]) => code), "23514", "42P01", ""];

    for (const code of codes) {
      const { message } = mapDbError(dbError(code, raw));

      expect(message).not.toContain("profile_pins");
      expect(message).not.toContain("pin_hash");
      expect(message).not.toContain("$2a$10$K3lsecrethash");
      expect(message).not.toContain(raw);
    }

    logged.mockRestore();
  });

  it("crosses the action boundary as a typed failure", async () => {
    const result = await runAction(async () => {
      throw mapDbError(
        dbError("23514", "LAST_PARENT: a household must keep at least one parent profile"),
      );
    });

    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: "CONFLICT",
      message: expect.stringMatching(/parent/i) as unknown as string,
    });
  });
});

describe("toActorSession", () => {
  // 2026-09-01T12:00:00.000Z — a fixed cookie expiry so every ttl is exact.
  const EXPIRES_AT = Date.UTC(2026, 8, 1, 12, 0, 0);
  const EXPIRES_AT_ISO = "2026-09-01T12:00:00.000Z";

  function makeActor(overrides: Partial<Actor> = {}): Actor {
    return {
      profileId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      householdId: "00000000-0000-4000-8000-000000000001",
      role: "parent",
      expiresAt: EXPIRES_AT,
      ...overrides,
    };
  }

  function makeProfile(overrides: Partial<Category> = {}): Category {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      householdId: "00000000-0000-4000-8000-000000000001",
      label: "Alex",
      color: "#2178AF",
      isProfile: true,
      avatarKind: "illustration",
      avatarId: "fox",
      avatarPath: null,
      birthday: null,
      dietaryPrefs: null,
      role: "parent",
      userId: null,
      emoji: null,
      showOnTasks: true,
      sortOrder: 1000,
      hasPin: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the profile's current name and colour with the cookie's identity", () => {
    vi.setSystemTime(EXPIRES_AT - 15 * 60 * 1000);

    const session = toActorSession(makeActor(), makeProfile({ label: "Alexandra" }));

    expect(session).toEqual({
      profileId: "11111111-1111-4111-8111-111111111111",
      label: "Alexandra",
      color: "#2178AF",
      role: "parent",
      expiresAt: EXPIRES_AT_ISO,
      ttlSeconds: 900,
    });
  });

  it("reports the role the cookie was minted with, not the row's current role", () => {
    vi.setSystemTime(EXPIRES_AT - 60 * 1000);

    // Someone punched in as a member whose profile has since been promoted:
    // the UI must keep showing member controls until they punch in again,
    // because that is what the guards will enforce on the next mutation.
    const session = toActorSession(
      makeActor({ role: "member" }),
      makeProfile({ role: "parent" }),
    );

    expect(session.role).toBe("member");
  });

  it("emits expiresAt as an ISO timestamp of the cookie's own expiry", () => {
    vi.setSystemTime(EXPIRES_AT - 5 * 60 * 1000);
    const actor = makeActor();

    const session = toActorSession(actor, makeProfile());

    expect(session.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(session.expiresAt)).toBe(actor.expiresAt);
  });

  it("floors ttlSeconds so a client timer fires before the cookie lapses", () => {
    // 900.5 seconds left: rounding up would let the timer run past the expiry.
    vi.setSystemTime(EXPIRES_AT - 900_500);

    const session = toActorSession(makeActor(), makeProfile());

    expect(session.ttlSeconds).toBe(900);
  });

  it("tracks the actor's own expiry rather than a fixed window", () => {
    vi.setSystemTime(EXPIRES_AT - 30 * 60 * 1000);

    const session = toActorSession(
      makeActor({ expiresAt: EXPIRES_AT - 25 * 60 * 1000 }),
      makeProfile(),
    );

    expect(session.ttlSeconds).toBe(300);
    expect(session.expiresAt).toBe(new Date(EXPIRES_AT - 25 * 60 * 1000).toISOString());
  });

  it("never reports a negative ttlSeconds for an actor that already expired", () => {
    vi.setSystemTime(EXPIRES_AT + 10 * 60 * 1000);

    const session = toActorSession(makeActor(), makeProfile());

    expect(session.ttlSeconds).toBe(0);
    // The expiry itself is still reported honestly, in the past.
    expect(session.expiresAt).toBe(EXPIRES_AT_ISO);
  });
});
