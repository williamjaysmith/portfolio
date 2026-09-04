import { describe, expect, it } from "vitest";

import type { Event, EventInput, Occurrence } from "@/lib/family/types";

import {
  householdWallInstant,
  isEmptyPatch,
  patchOf,
  rebasedOnSeries,
  seedOf,
  slotSeedOf,
  touchesSeriesFields,
  type EditTarget,
} from "../event-drafts";

/**
 * T050 — the pure translations between grid, form and actions. Two clocks
 * meet here (household zone in the data, the device's wall clock in the
 * form), so every expectation about a form value is computed through the
 * same device-local reading the form itself uses rather than pinned to one
 * machine's zone.
 */

const ZONE = "America/Chicago";
const ALEX = "11111111-1111-4111-8111-111111111111";
const CLEO = "22222222-2222-4222-8222-222222222222";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** The device's own reading of an instant — what the form's boxes show. */
function deviceWall(instantMs: number): { date: string; time: string } {
  const at = new Date(instantMs);
  return {
    date: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`,
    time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
  };
}

/** The weekly Piano series: Tuesdays 17:00–17:45 Chicago from 2026-09-15, until 2026-12-15. */
function makeSeries(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-piano",
    householdId: "household-1",
    summary: "Piano",
    description: null,
    location: null,
    times: { allDay: false, startsAt: "2026-09-15T22:00:00.000Z", endsAt: "2026-09-15T22:45:00.000Z" },
    timezone: ZONE,
    rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261216T055959Z;WKST=SU;BYDAY=TU",
    countdownEnabled: false,
    categoryIds: [CLEO],
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

/** The 6 October occurrence of that series, as the expander hands it out. */
function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    eventId: "event-piano",
    occurrenceDate: "2026-10-06",
    isRepeating: true,
    summary: "Piano",
    description: null,
    location: null,
    categoryIds: [CLEO],
    times: { allDay: false, startsAt: "2026-10-06T22:00:00.000Z", endsAt: "2026-10-06T22:45:00.000Z" },
    ...overrides,
  };
}

function target(overrides: { event?: Partial<Event>; occurrence?: Partial<Occurrence> } = {}): EditTarget {
  return { event: makeSeries(overrides.event), occurrence: makeOccurrence(overrides.occurrence) };
}

/** The form's submission for the occurrence exactly as shown — nothing changed. */
function unchangedInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    allDay: false,
    startsAt: "2026-10-06T22:00:00.000Z",
    endsAt: "2026-10-06T22:45:00.000Z",
    summary: "Piano",
    description: null,
    location: null,
    timezone: ZONE,
    repeat: { kind: "weekly", weekdays: ["TU"], until: "2026-12-15" },
    categoryIds: [CLEO],
    ...overrides,
  } as EventInput;
}

describe("householdWallInstant", () => {
  it("lands a household wall time on its instant", () => {
    // 2026-10-06 09:30 Chicago (CDT, UTC-5) is 14:30Z.
    expect(householdWallInstant(ZONE, "2026-10-06", 570)).toBe(Date.parse("2026-10-06T14:30:00Z"));
  });

  it("keeps the label on a fall-back day (FR-236): 03:00 is 03:00, not 02:00", () => {
    // 2026-11-01: clocks fall back at 02:00 CDT → 01:00 CST; 03:00 CST is 09:00Z.
    expect(householdWallInstant(ZONE, "2026-11-01", 180)).toBe(Date.parse("2026-11-01T09:00:00Z"));
  });

  it("keeps the label on a spring-forward day (FR-235): 23:45 stays on its own date", () => {
    // 2026-03-08: clocks spring forward at 02:00; 23:45 CDT is 2026-03-09T04:45Z.
    expect(householdWallInstant(ZONE, "2026-03-08", 1425)).toBe(Date.parse("2026-03-09T04:45:00Z"));
  });
});

describe("slotSeedOf (FR-255)", () => {
  it("prefills that day, that 15-minute slot and a one-hour end, in the device's clock", () => {
    const startMs = Date.parse("2026-10-06T14:30:00Z"); // 09:30 Chicago
    const start = deviceWall(startMs);
    const end = deviceWall(startMs + 60 * 60_000);

    expect(slotSeedOf(ZONE, "2026-10-06", 570)).toEqual({
      allDay: false,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
    });
  });
});

describe("seedOf", () => {
  it("prefills the edit form from the occurrence's effective fields and the series' repeat", () => {
    const seed = seedOf(
      target({
        occurrence: { summary: "Piano recital", location: "Hall", description: "Bring music" },
      }),
      ZONE,
    );
    const start = deviceWall(Date.parse("2026-10-06T22:00:00Z"));
    const end = deviceWall(Date.parse("2026-10-06T22:45:00Z"));

    expect(seed).toEqual({
      summary: "Piano recital",
      allDay: false,
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      repeatKind: "weekly",
      weekdays: ["TU"],
      until: "2026-12-15",
      categoryIds: [CLEO],
      location: "Hall",
      notes: "Bring music",
    });
  });

  it("seeds an all-day one-off as plain dates with repeat Never", () => {
    const seed = seedOf(
      target({
        event: { rrule: null, times: { allDay: true, startDate: "2026-09-18", endDate: "2026-09-20" } },
        occurrence: {
          isRepeating: false,
          times: { allDay: true, startDate: "2026-09-18", endDate: "2026-09-20" },
        },
      }),
      ZONE,
    );

    expect(seed).toMatchObject({
      allDay: true,
      startDate: "2026-09-18",
      endDate: "2026-09-20",
      repeatKind: "never",
      weekdays: [],
      until: "",
    });
    expect(seed.startTime).toBeUndefined();
  });
});

describe("patchOf", () => {
  it("is empty when nothing changed, whatever the instant spelling or category order", () => {
    const patch = patchOf(
      unchangedInput({
        startsAt: "2026-10-06T17:00:00-05:00",
        endsAt: "2026-10-06T17:45:00-05:00",
        categoryIds: [CLEO],
      }),
      target(),
      ZONE,
    );

    expect(patch).toEqual({});
    expect(isEmptyPatch(patch)).toBe(true);
  });

  it("carries only the fields that changed", () => {
    const patch = patchOf(
      unchangedInput({ summary: "Piano recital", location: "Hall" }),
      target(),
      ZONE,
    );

    expect(patch).toEqual({ summary: "Piano recital", location: "Hall" });
    expect(touchesSeriesFields(patch)).toBe(false);
  });

  it("carries a time change as the whole pair with its shape", () => {
    const patch = patchOf(
      unchangedInput({ startsAt: "2026-10-06T23:00:00.000Z", endsAt: "2026-10-06T23:45:00.000Z" }),
      target(),
      ZONE,
    );

    expect(patch).toEqual({
      allDay: false,
      startsAt: "2026-10-06T23:00:00.000Z",
      endsAt: "2026-10-06T23:45:00.000Z",
    });
  });

  it("marks Profiles/Labels and repeat changes as series fields (FR-287/239)", () => {
    const withCategory = patchOf(unchangedInput({ categoryIds: [ALEX, CLEO] }), target(), ZONE);
    expect(withCategory).toEqual({ categoryIds: [ALEX, CLEO] });
    expect(touchesSeriesFields(withCategory)).toBe(true);

    const withRepeat = patchOf(
      unchangedInput({ repeat: { kind: "weekly", weekdays: ["TU", "TH"], until: "2026-12-15" } }),
      target(),
      ZONE,
    );
    expect(withRepeat).toEqual({
      repeat: { kind: "weekly", weekdays: ["TU", "TH"], until: "2026-12-15" },
    });
    expect(touchesSeriesFields(withRepeat)).toBe(true);
  });

  it("does not read the stored weekday order as a change", () => {
    const patch = patchOf(
      unchangedInput({ repeat: { kind: "weekly", weekdays: ["TH", "TU"], until: "2026-12-15" } }),
      target({ event: { rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20261216T055959Z;WKST=SU;BYDAY=TU,TH" } }),
      ZONE,
    );

    expect(patch).toEqual({});
  });
});

describe("rebasedOnSeries (scope all)", () => {
  it("carries a new wall time and duration onto the series' own start, not the edited occurrence's date", () => {
    // 6 October edited from 17:00–17:45 to 18:00–19:00 Chicago.
    const input = unchangedInput({
      startsAt: "2026-10-06T23:00:00.000Z",
      endsAt: "2026-10-07T00:00:00.000Z",
    });
    const patch = patchOf(input, target(), ZONE);

    expect(rebasedOnSeries(patch, input, target(), ZONE)).toEqual({
      allDay: false,
      // The series still starts on 15 September — at the new 18:00 for an hour.
      startsAt: "2026-09-15T23:00:00.000Z",
      endsAt: "2026-09-16T00:00:00.000Z",
    });
  });

  it("carries a day shift too: moving the occurrence a day later moves the series' start a day later", () => {
    // 6 October (Tue) moved to 7 October (Wed), same time.
    const input = unchangedInput({
      startsAt: "2026-10-07T22:00:00.000Z",
      endsAt: "2026-10-07T22:45:00.000Z",
    });
    const patch = patchOf(input, target(), ZONE);

    expect(rebasedOnSeries(patch, input, target(), ZONE)).toEqual({
      allDay: false,
      startsAt: "2026-09-16T22:00:00.000Z",
      endsAt: "2026-09-16T22:45:00.000Z",
    });
  });

  it("keeps the other changed fields alongside the re-anchored times", () => {
    const input = unchangedInput({
      summary: "Piano recital",
      startsAt: "2026-10-06T23:00:00.000Z",
      endsAt: "2026-10-06T23:45:00.000Z",
    });
    const patch = patchOf(input, target(), ZONE);

    expect(rebasedOnSeries(patch, input, target(), ZONE)).toEqual({
      summary: "Piano recital",
      allDay: false,
      startsAt: "2026-09-15T23:00:00.000Z",
      endsAt: "2026-09-15T23:45:00.000Z",
    });
  });

  it("leaves a patch without times, or on a one-off, untouched", () => {
    const titleOnly = patchOf(unchangedInput({ summary: "Piano recital" }), target(), ZONE);
    expect(rebasedOnSeries(titleOnly, unchangedInput(), target(), ZONE)).toBe(titleOnly);

    const oneOff = target({ event: { rrule: null } });
    const input = unchangedInput({ startsAt: "2026-10-06T23:00:00.000Z", endsAt: "2026-10-06T23:45:00.000Z" });
    const timed = patchOf(input, oneOff, ZONE);
    expect(rebasedOnSeries(timed, input, oneOff, ZONE)).toBe(timed);
  });
});
