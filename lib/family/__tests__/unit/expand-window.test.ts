import { describe, expect, it } from "vitest";
import { expandWindow } from "@/lib/family/calendar/expand";
import { weekWindowOf } from "@/lib/family/calendar/dates";
import type { Event, EventException, EventTimes } from "@/lib/family/types";

const CHICAGO = "America/Chicago";
// Sun 2026-09-06 … Sat 2026-09-12; startMs Sun 00:00 CDT, endMs next Sun 00:00.
const WEEK = weekWindowOf("2026-09-06", CHICAGO);

function timed(startsAt: string, endsAt: string): EventTimes {
  return { allDay: false, startsAt, endsAt };
}

function allDay(startDate: string, endDate: string): EventTimes {
  return { allDay: true, startDate, endDate };
}

let nextId = 0;

function makeEvent(input: Partial<Event> & Pick<Event, "times">): Event {
  nextId += 1;
  return {
    id: `event-${nextId}`,
    householdId: "household-1",
    summary: `Event ${nextId}`,
    description: null,
    location: null,
    timezone: CHICAGO,
    rrule: null,
    countdownEnabled: false,
    categoryIds: [],
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

function makeException(
  eventId: string,
  occurrenceDate: string,
  action: EventException["action"],
  patch: Partial<EventException> = {},
): EventException {
  nextId += 1;
  return {
    id: `exception-${nextId}`,
    eventId,
    householdId: "household-1",
    occurrenceDate,
    action,
    summary: null,
    description: null,
    location: null,
    times: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

// Weekly Tue 17:00–17:45 Chicago, anchored months before the window.
function pianoSeries(exceptions: EventException[] = []): Event {
  return makeEvent({
    id: "piano",
    summary: "Piano",
    rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
    times: timed("2026-01-06T23:00:00.000Z", "2026-01-06T23:45:00.000Z"),
    categoryIds: ["cleo"],
    exceptions,
  });
}

describe("one-off passthrough", () => {
  it("emits a timed one-off inside the window with its original local date", () => {
    const event = makeEvent({
      times: timed("2026-09-08T14:00:00.000Z", "2026-09-08T15:00:00.000Z"),
      categoryIds: ["ana", "cleo"],
    });
    const out = expandWindow([event], WEEK, CHICAGO);
    expect(out).toEqual([
      {
        eventId: event.id,
        occurrenceDate: "2026-09-08",
        isRepeating: false,
        summary: event.summary,
        description: null,
        location: null,
        categoryIds: ["ana", "cleo"],
        times: event.times,
      },
    ]);
  });

  it("drops a timed one-off outside the window", () => {
    const event = makeEvent({
      times: timed("2026-09-15T14:00:00.000Z", "2026-09-15T15:00:00.000Z"),
    });
    expect(expandWindow([event], WEEK, CHICAGO)).toEqual([]);
  });

  it("keeps a midnight-crosser that begins the day before the window", () => {
    // Sat 2026-09-05 22:00 → Sun 01:00 CDT: only the second hour is in the week.
    const event = makeEvent({
      times: timed("2026-09-06T03:00:00.000Z", "2026-09-06T06:00:00.000Z"),
    });
    const out = expandWindow([event], WEEK, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual(["2026-09-05"]);
  });

  it("treats all-day bounds as inclusive on both window edges", () => {
    const touchesStart = makeEvent({ times: allDay("2026-09-04", "2026-09-06") });
    const endsBefore = makeEvent({ times: allDay("2026-08-30", "2026-09-05") });
    const touchesEnd = makeEvent({ times: allDay("2026-09-12", "2026-09-14") });
    const out = expandWindow([touchesStart, endsBefore, touchesEnd], WEEK, CHICAGO);
    expect(out.map((occ) => occ.eventId)).toEqual([touchesStart.id, touchesEnd.id]);
    expect(out[0]?.occurrenceDate).toBe("2026-09-04");
  });
});

describe("series expansion in the household's timezone (FR-219)", () => {
  it("expands a series row whose start predates the window by months", () => {
    const out = expandWindow([pianoSeries()], WEEK, CHICAGO);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      eventId: "piano",
      occurrenceDate: "2026-09-08",
      isRepeating: true,
      summary: "Piano",
      categoryIds: ["cleo"],
      times: timed("2026-09-08T22:00:00.000Z", "2026-09-08T22:45:00.000Z"),
    });
  });

  it("ignores the event's own device timezone — the household zone decides", () => {
    const fromTokyo = { ...pianoSeries(), timezone: "Asia/Tokyo" };
    const fromChicago = pianoSeries();
    const [tokyoOut] = expandWindow([fromTokyo], WEEK, CHICAGO);
    const [chicagoOut] = expandWindow([fromChicago], WEEK, CHICAGO);
    expect(tokyoOut).toEqual(chicagoOut);
  });

  it("applies a skip", () => {
    const event = pianoSeries([makeException("piano", "2026-09-08", "skip")]);
    expect(expandWindow([event], WEEK, CHICAGO)).toEqual([]);
  });

  it("applies an override's field merge", () => {
    const event = pianoSeries([
      makeException("piano", "2026-09-08", "override", { summary: "Recital" }),
    ]);
    const out = expandWindow([event], WEEK, CHICAGO);
    expect(out[0]).toMatchObject({
      occurrenceDate: "2026-09-08",
      summary: "Recital",
      isRepeating: true,
    });
  });
});

describe("the moved-occurrence guarantee (R206)", () => {
  it("drops an occurrence whose override moved it OUT of the window", () => {
    const event = pianoSeries([
      makeException("piano", "2026-09-08", "override", {
        times: timed("2026-09-15T22:00:00.000Z", "2026-09-15T22:45:00.000Z"),
      }),
    ]);
    expect(expandWindow([event], WEEK, CHICAGO)).toEqual([]);
  });

  it("emits an occurrence whose override lands IN the window though its original date is outside", () => {
    // Original Tue 2026-09-01 (previous week), moved to Wed 2026-09-09 17:00.
    const event = pianoSeries([
      makeException("piano", "2026-09-01", "override", {
        times: timed("2026-09-09T22:00:00.000Z", "2026-09-09T22:45:00.000Z"),
      }),
    ]);
    const out = expandWindow([event], WEEK, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual(["2026-09-01", "2026-09-08"]);
    expect(out[0]?.times).toEqual(timed("2026-09-09T22:00:00.000Z", "2026-09-09T22:45:00.000Z"));
  });

  it("never invents an occurrence from an exception on a date the rule cannot produce", () => {
    // 2026-09-02 is a Wednesday — not a BYDAY=TU date — so the row is inert.
    const event = pianoSeries([
      makeException("piano", "2026-09-02", "override", {
        times: timed("2026-09-09T22:00:00.000Z", "2026-09-09T22:45:00.000Z"),
      }),
    ]);
    const out = expandWindow([event], WEEK, CHICAGO);
    expect(out.map((occ) => occ.occurrenceDate)).toEqual(["2026-09-08"]);
  });
});

describe("output shape", () => {
  it("orders deterministically by original date, then event id", () => {
    const later = makeEvent({
      id: "b-later",
      times: timed("2026-09-10T14:00:00.000Z", "2026-09-10T15:00:00.000Z"),
    });
    const earlier = makeEvent({
      id: "a-earlier",
      times: timed("2026-09-07T14:00:00.000Z", "2026-09-07T15:00:00.000Z"),
    });
    const out = expandWindow([later, earlier, pianoSeries()], WEEK, CHICAGO);
    expect(out.map((occ) => [occ.occurrenceDate, occ.eventId])).toEqual([
      ["2026-09-07", "a-earlier"],
      ["2026-09-08", "piano"],
      ["2026-09-10", "b-later"],
    ]);
  });
});
