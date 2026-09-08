import { describe, expect, it } from "vitest";

import {
  LOOKAHEAD_DAYS,
  lastOccurrenceBefore,
  nextOccurrenceOn,
} from "@/lib/family/calendar/next-occurrence";
import { addDays } from "@/lib/family/calendar/dates";
import type { Event, EventTimes } from "@/lib/family/types";

/**
 * 009 R903 / T007. The ONE bounded walk both a countdown's target date and a
 * search result's date read (FR-902, FR-916, FR-918).
 *
 * The bound is asserted against the exported constant rather than the literal
 * 400, so the number lives in one place and this test binds it instead of
 * guessing it.
 */

const CHICAGO = "America/Chicago";

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
    reminder: { mode: "inherit" },
    categoryIds: [],
    exceptions: [],
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

describe("nextOccurrenceOn — a one-off", () => {
  it("returns its own household-local date when it is ahead", () => {
    // 18:00 CDT on the 20th.
    const event = makeEvent({ times: timed("2026-09-20T23:00:00.000Z", "2026-09-21T00:00:00.000Z") });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBe("2026-09-20");
  });

  it("returns today when it is today", () => {
    const event = makeEvent({ times: allDay("2026-09-07", "2026-09-07") });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBe("2026-09-07");
  });

  it("returns null when it is already past", () => {
    const event = makeEvent({ times: allDay("2026-09-06", "2026-09-06") });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBeNull();
  });

  it("reads the date in the HOUSEHOLD's zone, not UTC", () => {
    // 19:30 CDT on the 20th is 00:30 UTC on the 21st. The household says the 20th.
    const event = makeEvent({ times: timed("2026-09-21T00:30:00.000Z", "2026-09-21T01:30:00.000Z") });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBe("2026-09-20");
    expect(nextOccurrenceOn(event, "2026-09-07", "UTC")).toBe("2026-09-21");
  });
});

describe("nextOccurrenceOn — a repeat", () => {
  const weeklyThursday = () =>
    makeEvent({
      times: timed("2026-09-03T21:00:00.000Z", "2026-09-03T22:00:00.000Z"), // Thu 16:00 CDT
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
    });

  it("returns the next matching day, not the series' first", () => {
    expect(nextOccurrenceOn(weeklyThursday(), "2026-09-07", CHICAGO)).toBe("2026-09-10");
  });

  it("returns the day itself when that day matches", () => {
    expect(nextOccurrenceOn(weeklyThursday(), "2026-09-10", CHICAGO)).toBe("2026-09-10");
  });

  it("skips an occurrence the household has skipped", () => {
    const event = makeEvent({
      times: timed("2026-09-03T21:00:00.000Z", "2026-09-03T22:00:00.000Z"),
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
      exceptions: [
        {
          id: "exception-1",
          householdId: "household-1",
          eventId: "event-x",
          occurrenceDate: "2026-09-10",
          action: "skip",
          summary: null,
          description: null,
          location: null,
          times: null,
          reminder: null,
          createdBy: null,
          updatedBy: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBe("2026-09-17");
  });

  it("returns null once the series' UNTIL has passed", () => {
    const event = makeEvent({
      times: timed("2026-09-03T21:00:00.000Z", "2026-09-03T22:00:00.000Z"),
      rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260918T235959Z;BYDAY=TH",
    });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBe("2026-09-10");
    expect(nextOccurrenceOn(event, "2026-09-19", CHICAGO)).toBeNull();
  });

  it("crosses a daylight-saving change keeping the household's wall day", () => {
    // Weekly Sunday at 02:30 CST/CDT across the November 2026 fall-back.
    const event = makeEvent({
      times: timed("2026-11-01T07:30:00.000Z", "2026-11-01T08:30:00.000Z"),
      rrule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=SU",
    });
    expect(nextOccurrenceOn(event, "2026-11-02", CHICAGO)).toBe("2026-11-08");
  });
});

describe("nextOccurrenceOn — the bound", () => {
  it("finds an occurrence on the last day of the window", () => {
    const target = addDays("2026-09-07", LOOKAHEAD_DAYS);
    const event = makeEvent({ times: allDay(target, target) });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBe(target);
  });

  it("returns null one day beyond it — a repeat nobody is counting to", () => {
    const target = addDays("2026-09-07", LOOKAHEAD_DAYS + 1);
    const event = makeEvent({ times: allDay(target, target) });
    expect(nextOccurrenceOn(event, "2026-09-07", CHICAGO)).toBeNull();
  });

  it("clears a full year, so every repeat grammar this project can express is found", () => {
    expect(LOOKAHEAD_DAYS).toBeGreaterThanOrEqual(366);
  });
});

describe("lastOccurrenceBefore — what a finished thing shows", () => {
  it("returns a one-off's own date", () => {
    const event = makeEvent({ times: allDay("2026-08-20", "2026-08-20") });
    expect(lastOccurrenceBefore(event, "2026-09-07", CHICAGO)).toBe("2026-08-20");
  });

  it("returns a repeat's most recent occurrence, not its first", () => {
    const event = makeEvent({
      times: timed("2026-08-06T21:00:00.000Z", "2026-08-06T22:00:00.000Z"), // Thu
      rrule: "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260828T235959Z;BYDAY=TH",
    });
    expect(lastOccurrenceBefore(event, "2026-09-07", CHICAGO)).toBe("2026-08-27");
  });

  it("returns null for something that has not happened yet", () => {
    const event = makeEvent({ times: allDay("2026-10-01", "2026-10-01") });
    expect(lastOccurrenceBefore(event, "2026-09-07", CHICAGO)).toBeNull();
  });
});
