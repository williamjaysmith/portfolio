import { describe, expect, it } from "vitest";

import { countdownStatusOf } from "@/lib/family/countdowns/target";
import type { Event, EventTimes } from "@/lib/family/types";

/**
 * 009 R903 / Assumption 2. What a countdown counts towards, composed from the
 * calendar's own next-occurrence walk.
 */

const CHICAGO = "America/Chicago";
const TODAY = "2026-09-07";

function allDay(startDate: string, endDate = startDate): EventTimes {
  return { allDay: true, startDate, endDate };
}

let nextId = 0;

function makeEvent(input: Partial<Event> & Pick<Event, "times">): Event {
  nextId += 1;
  return {
    id: `event-${nextId}`,
    householdId: "household-1",
    summary: "Vacation",
    description: null,
    location: null,
    timezone: CHICAGO,
    rrule: null,
    countdownEnabled: true,
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

describe("countdownStatusOf", () => {
  it("is null for an event nobody marked", () => {
    const event = makeEvent({ times: allDay("2026-09-20"), countdownEnabled: false });
    expect(countdownStatusOf(event, TODAY, CHICAGO)).toBeNull();
  });

  it("counts a one-off towards its own day", () => {
    const event = makeEvent({ times: allDay("2026-09-20") });
    expect(countdownStatusOf(event, TODAY, CHICAGO)).toMatchObject({
      summary: "Vacation",
      targetDate: "2026-09-20",
      days: 13,
      state: "upcoming",
    });
  });

  it("reads as today on the day itself, not as zero days upcoming", () => {
    const event = makeEvent({ times: allDay(TODAY) });
    expect(countdownStatusOf(event, TODAY, CHICAGO)).toMatchObject({ days: 0, state: "today" });
  });

  it("counts a repeat towards its NEXT occurrence, not the series' first", () => {
    const event = makeEvent({
      times: allDay("2026-01-01"),
      rrule: "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1",
    });
    expect(countdownStatusOf(event, TODAY, CHICAGO)).toMatchObject({
      targetDate: "2026-10-01",
      days: 24,
      state: "upcoming",
    });
  });

  it("falls back to a finished repeat's LAST occurrence, marked past", () => {
    const event = makeEvent({
      times: allDay("2026-08-01"),
      rrule: "FREQ=MONTHLY;INTERVAL=1;UNTIL=20260901;BYMONTHDAY=1",
    });
    expect(countdownStatusOf(event, TODAY, CHICAGO)).toMatchObject({
      targetDate: "2026-09-01",
      state: "past",
    });
  });

  it("is null when a repeat has nothing inside the bounded walk either way", () => {
    const event = makeEvent({ times: allDay("2030-01-01") });
    expect(countdownStatusOf(event, TODAY, CHICAGO)).toBeNull();
  });
});
