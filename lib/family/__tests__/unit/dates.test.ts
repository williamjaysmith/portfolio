import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  localDateOf,
  sliceStarts,
  weekStartFor,
  weekStartOf,
  weekWindowOf,
} from "@/lib/family/calendar/dates";

const CHICAGO = "America/Chicago";
const HOUR = 3_600_000;

describe("plain-date maths", () => {
  it("adds days across month, leap and year boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-09-06", 0)).toBe("2026-09-06");
  });

  it("measures signed day distances", () => {
    expect(diffDays("2026-01-01", "2026-12-31")).toBe(364);
    expect(diffDays("2026-09-13", "2026-09-06")).toBe(-7);
    expect(diffDays("2026-09-06", "2026-09-06")).toBe(0);
  });

  it("refuses a date that is not real", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow();
    expect(() => addDays("garbage", 1)).toThrow();
    expect(() => addDays("2026-09-06", 1.5)).toThrow();
  });
});

describe("week anchoring (FR-203)", () => {
  it("anchors on Sunday by default", () => {
    expect(weekStartOf("2026-09-09", 0)).toBe("2026-09-06"); // Wednesday → Sunday
    expect(weekStartOf("2026-09-06", 0)).toBe("2026-09-06"); // Sunday → itself
    expect(weekStartOf("2026-09-12", 0)).toBe("2026-09-06"); // Saturday → Sunday
  });

  it("anchors on Monday when the household starts there", () => {
    expect(weekStartOf("2026-09-06", 1)).toBe("2026-08-31"); // Sunday → previous Monday
    expect(weekStartOf("2026-09-07", 1)).toBe("2026-09-07"); // Monday → itself
  });

  it("reads the instant's date in the NAMED zone before anchoring", () => {
    // 2026-09-06T03:00Z is Sunday in UTC but still Saturday evening in Chicago.
    const instant = Date.UTC(2026, 8, 6, 3);
    expect(localDateOf(CHICAGO, instant)).toBe("2026-09-05");
    expect(weekStartFor(CHICAGO, instant, 0)).toBe("2026-08-30");
    expect(weekStartFor("UTC", instant, 0)).toBe("2026-09-06");
  });
});

describe("sliceStarts tiling (FR-289)", () => {
  it("tiles the week and pulls the last slice back to end on the week's last day", () => {
    expect(sliceStarts(3)).toEqual([0, 3, 4]);
    expect(sliceStarts(5)).toEqual([0, 2]);
    expect(sliceStarts(7)).toEqual([0]);
  });

  it("covers the remaining column counts contiguously", () => {
    expect(sliceStarts(1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(sliceStarts(2)).toEqual([0, 2, 4, 5]);
    expect(sliceStarts(4)).toEqual([0, 3]);
    expect(sliceStarts(6)).toEqual([0, 1]);
  });

  it("refuses a column count outside 1–7", () => {
    expect(() => sliceStarts(0)).toThrow();
    expect(() => sliceStarts(8)).toThrow();
    expect(() => sliceStarts(3.5)).toThrow();
  });
});

describe("fetch-window derivation", () => {
  it("derives the week's inclusive dates and half-open instants in the zone", () => {
    const window = weekWindowOf("2026-09-06", CHICAGO);
    expect(window.startDate).toBe("2026-09-06");
    expect(window.endDate).toBe("2026-09-12");
    expect(window.startMs).toBe(Date.UTC(2026, 8, 6, 5)); // Sunday 00:00 CDT
    expect(window.endMs).toBe(Date.UTC(2026, 8, 13, 5)); // NEXT Sunday 00:00 — exclusive
  });

  it("lets a DST transition inside the week change the window's width", () => {
    const springForward = weekWindowOf("2026-03-08", CHICAGO);
    expect(springForward.startMs).toBe(Date.UTC(2026, 2, 8, 6)); // midnight CST
    expect(springForward.endMs).toBe(Date.UTC(2026, 2, 15, 5)); // midnight CDT
    expect(springForward.endMs - springForward.startMs).toBe(167 * HOUR);
  });
});
