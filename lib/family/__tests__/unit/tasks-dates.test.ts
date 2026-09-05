import { describe, expect, it } from "vitest";
import {
  CARRY_FORWARD_DAYS,
  carryReadWindowOf,
  carryWalkRangeOf,
  dueInstantOf,
  timeOfDayAt,
  withinCarryBound,
} from "@/lib/family/tasks/dates";

const CHICAGO = "America/Chicago";
const LONDON = "Europe/London";

describe("CARRY_FORWARD_DAYS (FR-357, R316)", () => {
  it("is 28, declared once", () => {
    expect(CARRY_FORWARD_DAYS).toBe(28);
  });
});

describe("withinCarryBound — todayEpochDay − scheduledEpochDay < CARRY_FORWARD_DAYS", () => {
  const today = "2026-09-04";

  it.each([
    ["2026-09-03", 1, true],
    ["2026-08-09", 26, true],
    ["2026-08-08", 27, true],
    ["2026-08-07", 28, false],
    ["2026-08-06", 29, false],
    ["2026-07-27", 39, false],
  ])("%s is %i days back → carried: %s", (scheduled, _days, carried) => {
    expect(withinCarryBound(scheduled as string, today)).toBe(carried);
  });

  it("carries an occurrence scheduled today or later — the bound is a tail, not a filter", () => {
    expect(withinCarryBound("2026-09-04", today)).toBe(true);
    expect(withinCarryBound("2026-09-05", today)).toBe(true);
  });
});

describe("carryWalkRangeOf — the past days the pass walks", () => {
  it("spans [today − (CARRY_FORWARD_DAYS − 1), today − 1]", () => {
    expect(carryWalkRangeOf("2026-09-04")).toEqual({ start: "2026-08-08", end: "2026-09-03" });
  });

  it("agrees with the bound at both ends", () => {
    const range = carryWalkRangeOf("2026-09-04");
    expect(withinCarryBound(range.start, "2026-09-04")).toBe(true);
    expect(withinCarryBound("2026-08-07", "2026-09-04")).toBe(false);
  });

  it("crosses a year boundary", () => {
    expect(carryWalkRangeOf("2027-01-05")).toEqual({ start: "2026-12-09", end: "2027-01-04" });
  });
});

describe("carryReadWindowOf — the resolution rows the pass needs (R314 read 3)", () => {
  it("runs from today − CARRY_FORWARD_DAYS to the day before the anchored week", () => {
    // 2026-09-04 is a Friday; the Sunday-started week begins 2026-08-30.
    expect(carryReadWindowOf("2026-09-04", 0)).toEqual({
      startDate: "2026-08-07",
      endDate: "2026-08-29",
    });
  });

  it("follows the household's start-of-week", () => {
    expect(carryReadWindowOf("2026-09-04", 1)).toEqual({
      startDate: "2026-08-07",
      endDate: "2026-08-30",
    });
  });

  it("reads exactly one day wider than the pass walks, so the day-28 row is known resolved", () => {
    const read = carryReadWindowOf("2026-09-04", 0);
    const walk = carryWalkRangeOf("2026-09-04");
    expect(read.startDate < walk.start).toBe(true);
    expect(withinCarryBound(read.startDate, "2026-09-04")).toBe(false);
  });
});

describe("dueInstantOf — FR-326's DST rules, inherited from the shipped zone module", () => {
  it("places an ordinary wall clock in the household zone", () => {
    expect(dueInstantOf("2026-09-04", "18:00", CHICAGO)).toBe(Date.UTC(2026, 8, 4, 23));
    expect(dueInstantOf("2026-09-04", "18:00", LONDON)).toBe(Date.UTC(2026, 8, 4, 17));
  });

  it("lands a time that does not exist on the first valid time that date", () => {
    // 2026-03-08 skips 02:00→03:00 in Chicago; 02:30 becomes 03:00 CDT.
    expect(dueInstantOf("2026-03-08", "02:30", CHICAGO)).toBe(Date.UTC(2026, 2, 8, 8));
    expect(dueInstantOf("2027-03-14", "02:30", CHICAGO)).toBe(Date.UTC(2027, 2, 14, 8));
  });

  it("takes the FIRST instant of a time that happens twice", () => {
    // 2026-11-01 repeats 01:00→02:00 in Chicago; the first 01:30 is CDT.
    expect(dueInstantOf("2026-11-01", "01:30", CHICAGO)).toBe(Date.UTC(2026, 10, 1, 6, 30));
  });

  it("refuses a time that is not a wall clock", () => {
    expect(() => dueInstantOf("2026-09-04", "6pm", CHICAGO)).toThrow();
    expect(() => dueInstantOf("2026-09-04", "24:00", CHICAGO)).toThrow();
    expect(() => dueInstantOf("2026-09-04", "18:60", CHICAGO)).toThrow();
    expect(() => dueInstantOf("2026-02-30", "18:00", CHICAGO)).toThrow();
  });
});

describe("timeOfDayAt — FR-306's three windows", () => {
  const at = (hour: number, minute = 0): string =>
    timeOfDayAt(CHICAGO, Date.UTC(2026, 8, 4, hour + 5, minute));

  it.each([
    [0, "morning"],
    [6, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [15, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [23, "evening"],
  ])("Chicago %i:00 is %s", (hour, slot) => {
    expect(at(hour as number)).toBe(slot);
  });

  it("puts the boundary minutes on the later side", () => {
    expect(at(11, 59)).toBe("morning");
    expect(at(12, 0)).toBe("afternoon");
    expect(at(17, 59)).toBe("afternoon");
    expect(at(18, 0)).toBe("evening");
  });

  it("reads the household zone, not the runtime's", () => {
    // 2026-09-04T23:30Z is late evening in Chicago and already Saturday morning in Tokyo.
    const instant = Date.UTC(2026, 8, 4, 23, 30);
    expect(timeOfDayAt(CHICAGO, instant)).toBe("evening");
    expect(timeOfDayAt("Asia/Tokyo", instant)).toBe("morning");
  });
});
