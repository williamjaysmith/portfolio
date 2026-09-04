import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  deleteEventInputSchema,
  eventInputSchema,
  parseOrThrow,
  repeatChoiceSchema,
  scopeSchema,
  updateEventInputSchema,
  validateEventInput,
} from "@/lib/family/validation";
import { ActionFailure } from "@/lib/family/errors";
import type { DeleteEventInput, EventInput, UpdateEventInput } from "@/lib/family/types";

const UUID_A = "00000000-0000-4000-8000-000000000001";
const UUID_B = "00000000-0000-4000-8000-000000000002";

/** The operator's household zone (FR-284, Assumption 41) — every cross-field date rule works in it. */
const HOUSEHOLD_TZ = "America/Chicago";

function makeTimedInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    allDay: false,
    startsAt: "2026-10-06T22:00:00.000Z",
    endsAt: "2026-10-06T22:45:00.000Z",
    summary: "Piano",
    timezone: "America/Chicago",
    repeat: { kind: "never" },
    categoryIds: [],
    ...overrides,
  };
}

function makeAllDayInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    allDay: true,
    startDate: "2026-10-06",
    endDate: "2026-10-08",
    summary: "Camping",
    timezone: "America/Chicago",
    repeat: { kind: "never" },
    categoryIds: [],
    ...overrides,
  };
}

function failurePaths(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

/** Throws unless `fn` throws an ActionFailure('VALIDATION'); returns it for further assertions. */
function expectValidationFailure(fn: () => unknown): ActionFailure {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ActionFailure);
  const failure = caught as ActionFailure;
  expect(failure.code).toBe("VALIDATION");
  return failure;
}

describe("scopeSchema", () => {
  it("accepts exactly the verified pyskylight enum", () => {
    for (const scope of ["this", "this_and_future", "all"]) {
      expect(scopeSchema.safeParse(scope).success).toBe(true);
    }
  });

  it("refuses anything outside the enum", () => {
    for (const bad of ["THIS", "future", "", null, 1]) {
      expect(scopeSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("repeatChoiceSchema", () => {
  it("accepts each of the four kinds", () => {
    expect(repeatChoiceSchema.safeParse({ kind: "never" }).success).toBe(true);
    expect(repeatChoiceSchema.safeParse({ kind: "daily" }).success).toBe(true);
    expect(repeatChoiceSchema.safeParse({ kind: "daily", until: null }).success).toBe(true);
    expect(
      repeatChoiceSchema.safeParse({ kind: "weekly", weekdays: ["MO", "TH"], until: "2026-12-15" })
        .success,
    ).toBe(true);
    expect(repeatChoiceSchema.safeParse({ kind: "monthly", until: null }).success).toBe(true);
  });

  it("refuses an unknown kind", () => {
    expect(repeatChoiceSchema.safeParse({ kind: "yearly" }).success).toBe(false);
    expect(repeatChoiceSchema.safeParse({ kind: "weekly" }).success).toBe(false);
  });

  it("requires weekly weekdays to be non-empty", () => {
    expect(failurePaths(repeatChoiceSchema, { kind: "weekly", weekdays: [] })).toContain(
      "weekdays",
    );
  });

  it("refuses duplicate weekdays", () => {
    expect(failurePaths(repeatChoiceSchema, { kind: "weekly", weekdays: ["MO", "MO"] })).toContain(
      "weekdays",
    );
  });

  it("refuses anything outside the BYDAY alphabet", () => {
    expect(repeatChoiceSchema.safeParse({ kind: "weekly", weekdays: ["MON"] }).success).toBe(false);
    expect(repeatChoiceSchema.safeParse({ kind: "weekly", weekdays: [1] }).success).toBe(false);
  });

  it("refuses a malformed until date", () => {
    expect(repeatChoiceSchema.safeParse({ kind: "daily", until: "12/15/2026" }).success).toBe(
      false,
    );
    expect(repeatChoiceSchema.safeParse({ kind: "daily", until: "2026-13-01" }).success).toBe(
      false,
    );
  });

  it("never accepts a BYMONTHDAY — the emitter derives it from the start", () => {
    expect(repeatChoiceSchema.safeParse({ kind: "monthly", bymonthday: 31 }).success).toBe(false);
  });

  it("never accepts a count-of-occurrences limit (FR-232)", () => {
    expect(repeatChoiceSchema.safeParse({ kind: "daily", count: 10 }).success).toBe(false);
  });
});

describe("eventInputSchema — time shapes", () => {
  it("accepts a coherent timed input and a coherent all-day input", () => {
    expect(eventInputSchema.safeParse(makeTimedInput()).success).toBe(true);
    expect(eventInputSchema.safeParse(makeAllDayInput()).success).toBe(true);
  });

  it("accepts a midnight-crosser — Fri 22:00 to Sat 01:00 compared as instants (FR-226)", () => {
    const input = makeTimedInput({
      // 2026-10-09 is a Friday; 22:00 CDT = 03:00Z next day.
      startsAt: "2026-10-10T03:00:00.000Z",
      endsAt: "2026-10-10T06:00:00.000Z",
    });
    expect(eventInputSchema.safeParse(input).success).toBe(true);
  });

  it("refuses a timed end at or before its start (FR-226)", () => {
    const equal = makeTimedInput({ endsAt: "2026-10-06T22:00:00.000Z" });
    expect(failurePaths(eventInputSchema, equal)).toContain("endsAt");
    const before = makeTimedInput({ endsAt: "2026-10-06T21:00:00.000Z" });
    expect(failurePaths(eventInputSchema, before)).toContain("endsAt");
  });

  it("accepts an all-day event whose end equals its start — one day, inclusive (FR-225)", () => {
    expect(
      eventInputSchema.safeParse(makeAllDayInput({ endDate: "2026-10-06" })).success,
    ).toBe(true);
  });

  it("refuses an all-day end before its start (FR-225)", () => {
    expect(failurePaths(eventInputSchema, makeAllDayInput({ endDate: "2026-10-05" }))).toContain(
      "endDate",
    );
  });

  it("refuses a missing or mixed shape (FR-222)", () => {
    const noDiscriminant = makeTimedInput();
    delete noDiscriminant.allDay;
    expect(eventInputSchema.safeParse(noDiscriminant).success).toBe(false);
    expect(
      eventInputSchema.safeParse(makeTimedInput({ startDate: "2026-10-06" })).success,
    ).toBe(false);
    expect(
      eventInputSchema.safeParse(makeAllDayInput({ startsAt: "2026-10-06T22:00:00.000Z" }))
        .success,
    ).toBe(false);
  });

  it("refuses a non-instant start", () => {
    expect(eventInputSchema.safeParse(makeTimedInput({ startsAt: "2026-10-06" })).success).toBe(
      false,
    );
    expect(eventInputSchema.safeParse(makeTimedInput({ startsAt: "tomorrow" })).success).toBe(
      false,
    );
  });

  it("accepts an offset-carrying instant — the reference's own stored form (FR-223)", () => {
    const input = makeTimedInput({
      startsAt: "2025-12-29T09:30:00.000-05:00",
      endsAt: "2025-12-29T10:30:00.000-05:00",
    });
    expect(eventInputSchema.safeParse(input).success).toBe(true);
  });
});

describe("eventInputSchema — fields", () => {
  it("trims the summary and requires 1–120 characters (FR-220)", () => {
    expect(failurePaths(eventInputSchema, makeTimedInput({ summary: "" }))).toContain("summary");
    expect(failurePaths(eventInputSchema, makeTimedInput({ summary: "   " }))).toContain(
      "summary",
    );
    expect(
      eventInputSchema.safeParse(makeTimedInput({ summary: "x".repeat(120) })).success,
    ).toBe(true);
    expect(failurePaths(eventInputSchema, makeTimedInput({ summary: "x".repeat(121) }))).toContain(
      "summary",
    );
  });

  it("caps description at 2000 and location at 200", () => {
    expect(
      eventInputSchema.safeParse(makeTimedInput({ description: "x".repeat(2000) })).success,
    ).toBe(true);
    expect(
      failurePaths(eventInputSchema, makeTimedInput({ description: "x".repeat(2001) })),
    ).toContain("description");
    expect(
      eventInputSchema.safeParse(makeTimedInput({ location: "x".repeat(200) })).success,
    ).toBe(true);
    expect(
      failurePaths(eventInputSchema, makeTimedInput({ location: "x".repeat(201) })),
    ).toContain("location");
  });

  it("requires the timezone to be a supported IANA name (FR-224)", () => {
    expect(
      eventInputSchema.safeParse(makeTimedInput({ timezone: "Australia/Lord_Howe" })).success,
    ).toBe(true);
    for (const bad of ["America/Springfield", "CST", "", "utc"]) {
      expect(failurePaths(eventInputSchema, makeTimedInput({ timezone: bad }))).toContain(
        "timezone",
      );
    }
  });

  it("refuses duplicate categoryIds but accepts an empty list (FR-213)", () => {
    expect(
      failurePaths(eventInputSchema, makeTimedInput({ categoryIds: [UUID_A, UUID_A] })),
    ).toContain("categoryIds");
    expect(
      eventInputSchema.safeParse(makeTimedInput({ categoryIds: [UUID_A, UUID_B] })).success,
    ).toBe(true);
    expect(eventInputSchema.safeParse(makeTimedInput({ categoryIds: [] })).success).toBe(true);
  });

  it("refuses a non-uuid categoryId", () => {
    expect(
      failurePaths(eventInputSchema, makeTimedInput({ categoryIds: ["piano"] })),
    ).toContain("categoryIds.0");
  });

  it("never accepts an rrule string from a client (R201)", () => {
    expect(eventInputSchema.safeParse(makeTimedInput({ rrule: "FREQ=DAILY" })).success).toBe(
      false,
    );
    expect(
      eventInputSchema.safeParse(makeAllDayInput({ rrule: "RRULE:FREQ=WEEKLY;BYDAY=TU" }))
        .success,
    ).toBe(false);
  });
});

describe("validateEventInput — until against the start, as household-local dates", () => {
  it("returns the parsed input when the rule holds", () => {
    const input = makeTimedInput({ repeat: { kind: "daily", until: "2026-12-15" } });
    const parsed: EventInput = validateEventInput(input, HOUSEHOLD_TZ);
    expect(parsed.repeat).toEqual({ kind: "daily", until: "2026-12-15" });
  });

  it("compares in the household zone, not UTC: a 03:30Z start is still the previous Chicago date", () => {
    // 2026-03-10T03:30Z = 2026-03-09 21:30 in America/Chicago.
    const input = makeTimedInput({
      startsAt: "2026-03-10T03:30:00.000Z",
      endsAt: "2026-03-10T04:30:00.000Z",
      repeat: { kind: "daily", until: "2026-03-09" },
    });
    expect(() => validateEventInput(input, HOUSEHOLD_TZ)).not.toThrow();
  });

  it("refuses an until before the start's household-local date, against the repeat field (FR-262)", () => {
    const input = makeTimedInput({
      startsAt: "2026-03-10T03:30:00.000Z",
      endsAt: "2026-03-10T04:30:00.000Z",
      repeat: { kind: "daily", until: "2026-03-08" },
    });
    const failure = expectValidationFailure(() => validateEventInput(input, HOUSEHOLD_TZ));
    expect(Object.keys(failure.fieldErrors ?? {})).toEqual(["repeat"]);
  });

  it("compares an all-day series' until against its start date directly", () => {
    const ok = makeAllDayInput({ repeat: { kind: "monthly", until: "2026-10-06" } });
    expect(() => validateEventInput(ok, HOUSEHOLD_TZ)).not.toThrow();
    const bad = makeAllDayInput({ repeat: { kind: "monthly", until: "2026-10-05" } });
    expectValidationFailure(() => validateEventInput(bad, HOUSEHOLD_TZ));
  });

  it("throws field-keyed VALIDATION for schema failures too", () => {
    const failure = expectValidationFailure(() =>
      validateEventInput(makeTimedInput({ summary: "" }), HOUSEHOLD_TZ),
    );
    expect(failure.fieldErrors).toHaveProperty("summary");
  });
});

describe("updateEventInputSchema", () => {
  const move: UpdateEventInput = {
    id: UUID_A,
    patch: { startsAt: "2026-10-06T23:00:00.000Z", endsAt: "2026-10-06T23:45:00.000Z" },
  };

  it("accepts a drag-shaped time patch with no scope", () => {
    expect(updateEventInputSchema.safeParse(move).success).toBe(true);
  });

  it("accepts a scoped patch naming its occurrence", () => {
    const input = { ...move, scope: "this", occurrenceDate: "2026-10-06" };
    expect(updateEventInputSchema.safeParse(input).success).toBe(true);
  });

  it("accepts both band↔grid conversions (FR-251)", () => {
    const toBand = {
      id: UUID_A,
      patch: { allDay: true, startDate: "2026-10-06", endDate: "2026-10-06" },
    };
    expect(updateEventInputSchema.safeParse(toBand).success).toBe(true);
    const toGrid = {
      id: UUID_A,
      patch: {
        allDay: false,
        startsAt: "2026-10-06T15:00:00.000Z",
        endsAt: "2026-10-06T16:00:00.000Z",
      },
    };
    expect(updateEventInputSchema.safeParse(toGrid).success).toBe(true);
  });

  it("refuses an empty patch", () => {
    expect(updateEventInputSchema.safeParse({ id: UUID_A, patch: {} }).success).toBe(false);
  });

  it("refuses a timezone in the patch — provenance is written once (FR-224)", () => {
    const input = { id: UUID_A, patch: { timezone: "Europe/London" } };
    expect(updateEventInputSchema.safeParse(input).success).toBe(false);
  });

  it("refuses an rrule in the patch (R201)", () => {
    const input = { id: UUID_A, patch: { rrule: "FREQ=DAILY" } };
    expect(updateEventInputSchema.safeParse(input).success).toBe(false);
  });

  it("requires occurrenceDate for scope this and this_and_future, not for all", () => {
    for (const scope of ["this", "this_and_future"]) {
      expect(failurePaths(updateEventInputSchema, { ...move, scope })).toContain(
        "occurrenceDate",
      );
    }
    expect(updateEventInputSchema.safeParse({ ...move, scope: "all" }).success).toBe(true);
  });

  it("refuses categoryIds and repeat in a scope 'this' patch (FR-287/FR-239)", () => {
    const categories = {
      id: UUID_A,
      patch: { categoryIds: [UUID_B] },
      scope: "this",
      occurrenceDate: "2026-10-06",
    };
    expect(failurePaths(updateEventInputSchema, categories)).toContain("patch.categoryIds");
    const repeat = {
      id: UUID_A,
      patch: { repeat: { kind: "never" } },
      scope: "this",
      occurrenceDate: "2026-10-06",
    };
    expect(failurePaths(updateEventInputSchema, repeat)).toContain("patch.repeat");
  });

  it("allows categoryIds and repeat at series scope", () => {
    const input = {
      id: UUID_A,
      patch: { categoryIds: [UUID_B], repeat: { kind: "daily" } },
      scope: "all",
    };
    expect(updateEventInputSchema.safeParse(input).success).toBe(true);
  });

  it("requires time fields to arrive as whole pairs", () => {
    expect(
      failurePaths(updateEventInputSchema, {
        id: UUID_A,
        patch: { startsAt: "2026-10-06T23:00:00.000Z" },
      }),
    ).toContain("patch.endsAt");
    expect(
      failurePaths(updateEventInputSchema, { id: UUID_A, patch: { endDate: "2026-10-06" } }),
    ).toContain("patch.startDate");
  });

  it("refuses both time shapes at once", () => {
    const input = {
      id: UUID_A,
      patch: {
        startsAt: "2026-10-06T15:00:00.000Z",
        endsAt: "2026-10-06T16:00:00.000Z",
        startDate: "2026-10-06",
        endDate: "2026-10-06",
      },
    };
    expect(updateEventInputSchema.safeParse(input).success).toBe(false);
  });

  it("requires a shape change to carry the new shape's times", () => {
    expect(
      updateEventInputSchema.safeParse({ id: UUID_A, patch: { allDay: true } }).success,
    ).toBe(false);
    expect(
      updateEventInputSchema.safeParse({ id: UUID_A, patch: { allDay: false } }).success,
    ).toBe(false);
    expect(
      updateEventInputSchema.safeParse({
        id: UUID_A,
        patch: { allDay: true, startsAt: "2026-10-06T15:00:00.000Z", endsAt: "2026-10-06T16:00:00.000Z" },
      }).success,
    ).toBe(false);
  });

  it("holds patched times to the same coherence rules (FR-225/226)", () => {
    expect(
      failurePaths(updateEventInputSchema, {
        id: UUID_A,
        patch: { startsAt: "2026-10-06T16:00:00.000Z", endsAt: "2026-10-06T15:00:00.000Z" },
      }),
    ).toContain("patch.endsAt");
    expect(
      failurePaths(updateEventInputSchema, {
        id: UUID_A,
        patch: { startDate: "2026-10-08", endDate: "2026-10-06" },
      }),
    ).toContain("patch.endDate");
  });

  it("refuses a malformed id or occurrenceDate", () => {
    expect(updateEventInputSchema.safeParse({ ...move, id: "not-a-uuid" }).success).toBe(false);
    expect(
      updateEventInputSchema.safeParse({ ...move, scope: "this", occurrenceDate: "Oct 6" })
        .success,
    ).toBe(false);
  });
});

describe("deleteEventInputSchema", () => {
  it("accepts a confirmed one-off delete", () => {
    const input: DeleteEventInput = { id: UUID_A, confirm: true };
    expect(deleteEventInputSchema.safeParse(input).success).toBe(true);
  });

  it("accepts each confirmed scoped delete", () => {
    for (const scope of ["this", "this_and_future"]) {
      expect(
        deleteEventInputSchema.safeParse({
          id: UUID_A,
          confirm: true,
          scope,
          occurrenceDate: "2026-10-13",
        }).success,
      ).toBe(true);
    }
    expect(
      deleteEventInputSchema.safeParse({ id: UUID_A, confirm: true, scope: "all" }).success,
    ).toBe(true);
  });

  it("refuses confirm false or missing — the FR-258 gate", () => {
    expect(failurePaths(deleteEventInputSchema, { id: UUID_A, confirm: false })).toContain(
      "confirm",
    );
    expect(failurePaths(deleteEventInputSchema, { id: UUID_A })).toContain("confirm");
  });

  it("requires occurrenceDate for scope this and this_and_future", () => {
    for (const scope of ["this", "this_and_future"]) {
      expect(
        failurePaths(deleteEventInputSchema, { id: UUID_A, confirm: true, scope }),
      ).toContain("occurrenceDate");
    }
  });

  it("surfaces the confirm refusal as field-keyed VALIDATION", () => {
    const failure = expectValidationFailure(() =>
      parseOrThrow(deleteEventInputSchema, { id: UUID_A, confirm: false }),
    );
    expect(failure.fieldErrors).toHaveProperty("confirm");
  });
});
