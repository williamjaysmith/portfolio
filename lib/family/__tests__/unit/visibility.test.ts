import { describe, expect, it } from "vitest";

import { isEventVisible, visibleOccurrences } from "@/lib/family/calendar/visibility";
import type { Occurrence } from "@/lib/family/types";

/**
 * T061 — FR-265's truth table, and the identity guarantees the memo chain
 * (R206) and FR-267 ("filtering is display only") rest on.
 *
 * The names are the spec's own story (US4, scenario 7): Ana hides Cleo on her
 * phone; an event carrying BOTH Cleo and Ana survives, because Ana is still
 * visible. Hidden ids are generic category ids — profiles and labels alike
 * (FR-266, R212) — so the same table covers "Bin day" (scenario 8).
 */

const ANA = "profile-ana";
const CLEO = "profile-cleo";
const BIN_DAY = "label-bin-day";

function makeOccurrence(overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    eventId: "event-1",
    occurrenceDate: "2026-09-07",
    isRepeating: false,
    summary: "Swim practice",
    description: null,
    location: null,
    categoryIds: [],
    times: {
      allDay: false,
      startsAt: "2026-09-07T14:00:00.000Z",
      endsAt: "2026-09-07T15:00:00.000Z",
    },
    ...overrides,
  };
}

describe("isEventVisible", () => {
  it("always shows an event with no categories (FR-265)", () => {
    expect(isEventVisible([], new Set())).toBe(true);
    expect(isEventVisible([], new Set([ANA, CLEO, BIN_DAY]))).toBe(true);
  });

  it("shows an event whose only category is visible", () => {
    expect(isEventVisible([CLEO], new Set())).toBe(true);
    expect(isEventVisible([CLEO], new Set([ANA]))).toBe(true);
  });

  it("hides an event whose only category is hidden", () => {
    expect(isEventVisible([CLEO], new Set([CLEO]))).toBe(false);
    expect(isEventVisible([BIN_DAY], new Set([BIN_DAY]))).toBe(false);
  });

  it("keeps a Cleo+Ana event when only Cleo is hidden (US4 scenario 7)", () => {
    expect(isEventVisible([CLEO, ANA], new Set([CLEO]))).toBe(true);
    expect(isEventVisible([ANA, CLEO], new Set([CLEO]))).toBe(true);
  });

  it("hides an event only once every category it carries is hidden", () => {
    expect(isEventVisible([CLEO, ANA], new Set([CLEO, ANA]))).toBe(false);
    expect(isEventVisible([CLEO, ANA, BIN_DAY], new Set([CLEO, ANA]))).toBe(true);
    expect(isEventVisible([CLEO, ANA, BIN_DAY], new Set([CLEO, ANA, BIN_DAY]))).toBe(false);
  });

  it("ignores hidden ids the event does not carry", () => {
    expect(isEventVisible([ANA], new Set(["profile-gone", BIN_DAY]))).toBe(true);
  });
});

describe("visibleOccurrences", () => {
  const cleoOnly = makeOccurrence({ eventId: "cleo", categoryIds: [CLEO] });
  const shared = makeOccurrence({ eventId: "shared", categoryIds: [CLEO, ANA] });
  const unassigned = makeOccurrence({ eventId: "bare" });
  const week = [cleoOnly, shared, unassigned];

  it("drops only the occurrences every category of which is hidden", () => {
    expect(visibleOccurrences(week, new Set([CLEO]))).toEqual([shared, unassigned]);
  });

  it("keeps the week's order", () => {
    const binDay = makeOccurrence({ eventId: "bin", categoryIds: [BIN_DAY] });
    const result = visibleOccurrences([cleoOnly, binDay, shared], new Set([CLEO]));

    expect(result.map((occurrence) => occurrence.eventId)).toEqual(["bin", "shared"]);
  });

  it("returns the SAME array when nothing is hidden, so layout never re-runs (R206)", () => {
    expect(visibleOccurrences(week, new Set())).toBe(week);
  });

  it("never touches the stored data it filters (FR-267)", () => {
    const result = visibleOccurrences(week, new Set([CLEO, ANA]));

    expect(result).toEqual([unassigned]);
    expect(week).toHaveLength(3);
    expect(shared.categoryIds).toEqual([CLEO, ANA]);
  });

  it("hides the whole week when every category is hidden", () => {
    expect(visibleOccurrences([cleoOnly, shared], new Set([CLEO, ANA]))).toEqual([]);
  });
});
