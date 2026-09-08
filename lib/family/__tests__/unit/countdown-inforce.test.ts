import { describe, expect, it } from "vitest";

import { countdownsInForce, isInForce } from "@/lib/family/countdowns/inforce";
import type { CountdownStatus } from "@/lib/family/countdowns/target";
import { addDays } from "@/lib/family/calendar/dates";
import type { Event, EventTimes, ShowCountdowns } from "@/lib/family/types";

/**
 * 009 FR-903 / SC-904. The three Show Countdowns values, checked at a boundary
 * either side — which is only possible because the windows are a fixed number
 * of DAYS rather than calendar months (see inforce.ts).
 */

const CHICAGO = "America/Chicago";
const TODAY = "2026-09-07";

function statusAt(days: number, summary = "Vacation"): CountdownStatus {
  return {
    eventId: `event-${days}-${summary}`,
    summary,
    targetDate: addDays(TODAY, days),
    days,
    state: days > 0 ? "upcoming" : days === 0 ? "today" : "past",
  };
}

let nextId = 0;

function countdownOn(date: string, summary = "Vacation"): Event {
  nextId += 1;
  const times: EventTimes = { allDay: true, startDate: date, endDate: date };
  return {
    id: `event-${nextId}`,
    householdId: "household-1",
    summary,
    description: null,
    location: null,
    timezone: CHICAGO,
    rrule: null,
    countdownEnabled: true,
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

describe("isInForce — the three windows at their boundaries", () => {
  const cases: { setting: ShowCountdowns; lastIn: number; firstOut: number | null }[] = [
    { setting: "one_month", lastIn: 31, firstOut: 32 },
    { setting: "three_months", lastIn: 92, firstOut: 93 },
    { setting: "always", lastIn: 3650, firstOut: null },
  ];

  for (const { setting, lastIn, firstOut } of cases) {
    it(`${setting}: admits ${lastIn} days out`, () => {
      expect(isInForce(statusAt(lastIn), setting)).toBe(true);
    });

    it(`${setting}: ${firstOut === null ? "has no ceiling at all" : `excludes ${firstOut} days out`}`, () => {
      if (firstOut === null) expect(isInForce(statusAt(36500), setting)).toBe(true);
      else expect(isInForce(statusAt(firstOut), setting)).toBe(false);
    });

    it(`${setting}: admits today itself`, () => {
      expect(isInForce(statusAt(0), setting)).toBe(true);
    });

    it(`${setting}: excludes a countdown whose day has passed (FR-905)`, () => {
      expect(isInForce(statusAt(-1), setting)).toBe(false);
      expect(isInForce(statusAt(-400), setting)).toBe(false);
    });
  }
});

describe("countdownsInForce", () => {
  it("takes only the events that are countdowns", () => {
    const marked = countdownOn("2026-09-20");
    const unmarked = { ...countdownOn("2026-09-21", "Dentist"), countdownEnabled: false };

    const found = countdownsInForce([marked, unmarked], TODAY, CHICAGO, "always");
    expect(found.map((one) => one.summary)).toEqual(["Vacation"]);
  });

  it("orders soonest first", () => {
    const events = [
      countdownOn("2026-12-25", "Christmas"),
      countdownOn("2026-09-20", "Vacation"),
      countdownOn("2026-10-31", "Halloween"),
    ];
    expect(countdownsInForce(events, TODAY, CHICAGO, "always").map((one) => one.summary)).toEqual([
      "Vacation",
      "Halloween",
      "Christmas",
    ]);
  });

  it("breaks a same-day tie stably, so the bar does not reshuffle", () => {
    const events = [countdownOn("2026-09-20", "Zoo trip"), countdownOn("2026-09-20", "Airport")];
    const once = countdownsInForce(events, TODAY, CHICAGO, "always").map((one) => one.summary);
    const twice = countdownsInForce([...events].reverse(), TODAY, CHICAGO, "always").map(
      (one) => one.summary,
    );
    expect(once).toEqual(["Airport", "Zoo trip"]);
    expect(twice).toEqual(once);
  });

  it("narrows as the setting narrows, over the same events (SC-904)", () => {
    const events = [
      countdownOn(addDays(TODAY, 10), "Soon"),
      countdownOn(addDays(TODAY, 40), "Middling"),
      countdownOn(addDays(TODAY, 200), "Far"),
    ];
    const names = (setting: ShowCountdowns) =>
      countdownsInForce(events, TODAY, CHICAGO, setting).map((one) => one.summary);

    expect(names("always")).toEqual(["Soon", "Middling", "Far"]);
    expect(names("three_months")).toEqual(["Soon", "Middling"]);
    expect(names("one_month")).toEqual(["Soon"]);
  });

  it("gives a household with nothing marked an empty list, which is what draws no bar", () => {
    expect(countdownsInForce([], TODAY, CHICAGO, "always")).toEqual([]);
  });
});
