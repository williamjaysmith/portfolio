import { describe, expect, it } from "vitest";

import { searchResultsOf } from "@/lib/family/calendar/search";
import type { Event, EventTimes } from "@/lib/family/types";

/**
 * 009 FR-916 / FR-918 / SC-909. What a result says and where it points.
 *
 * The load-bearing assertion is the repeat one: an implementation that expanded
 * before shaping would pass everything else here and still flood the household
 * with fifty identical rows.
 */

const CHICAGO = "America/Chicago";
const TODAY = "2026-09-07";

let nextId = 0;

function eventOn(
  startDate: string,
  summary: string,
  rrule: string | null = null,
): Event {
  nextId += 1;
  const times: EventTimes = { allDay: true, startDate, endDate: startDate };
  return {
    id: `event-${nextId}`,
    householdId: "household-1",
    summary,
    description: null,
    location: null,
    timezone: CHICAGO,
    rrule,
    countdownEnabled: false,
    reminder: { mode: "inherit" },
    categoryIds: [],
    exceptions: [],
    times,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const shape = (events: Event[]) => searchResultsOf(events, TODAY, CHICAGO);

describe("searchResultsOf", () => {
  it("names the day a one-off falls on", () => {
    expect(shape([eventOn("2026-09-20", "School photos")])).toEqual([
      {
        eventId: "event-1",
        summary: "School photos",
        onDate: "2026-09-20",
        isPast: false,
        isRepeating: false,
      },
    ]);
  });

  it("gives a REPEAT one row, on its next occurrence (FR-918, SC-909)", () => {
    const weekly = eventOn("2026-01-01", "Swim lesson", "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH");
    const results = shape([weekly]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      summary: "Swim lesson",
      onDate: "2026-09-10",
      isRepeating: true,
      isPast: false,
    });
  });

  it("still answers about something that has finished, on its last day", () => {
    const finished = eventOn(
      "2026-08-06",
      "Summer camp",
      "FREQ=WEEKLY;INTERVAL=1;UNTIL=20260828T235959Z;BYDAY=TH",
    );
    expect(shape([finished])[0]).toMatchObject({ onDate: "2026-08-27", isPast: true });
  });

  it("puts what is coming before what has gone", () => {
    const results = shape([
      eventOn("2026-08-20", "Past thing"),
      eventOn("2026-09-20", "Future thing"),
    ]);
    expect(results.map((one) => one.summary)).toEqual(["Future thing", "Past thing"]);
  });

  it("orders the upcoming soonest first and the past most-recent first", () => {
    const results = shape([
      eventOn("2026-10-20", "Later"),
      eventOn("2026-09-09", "Sooner"),
      eventOn("2026-01-01", "Long ago"),
      eventOn("2026-09-01", "Just gone"),
    ]);
    expect(results.map((one) => one.summary)).toEqual([
      "Sooner",
      "Later",
      "Just gone",
      "Long ago",
    ]);
  });

  it("breaks a same-day tie by title, so the order is stable", () => {
    const results = shape([eventOn("2026-09-20", "Zoo"), eventOn("2026-09-20", "Airport")]);
    expect(results.map((one) => one.summary)).toEqual(["Airport", "Zoo"]);
  });

  it("drops an event the calendar could not navigate to", () => {
    // Nothing inside the bounded walk in either direction.
    expect(shape([eventOn("2031-01-01", "Far future")])).toEqual([]);
  });

  it("gives nothing back for nothing found (FR-917's empty case)", () => {
    expect(shape([])).toEqual([]);
  });
});
