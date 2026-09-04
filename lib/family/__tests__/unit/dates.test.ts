import { describe, expect, it } from "vitest";
import {
  addDays,
  diffDays,
  localDateOf,
  START_ON_CURRENT_DAY,
  viewWindowOf,
  weekAnchorOf,
  weekStartFor,
  weekStartOf,
  zoneMidnightMs,
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

describe("weekAnchorOf — Skylight's \"Start on current day\" toggle (36835449004315)", () => {
  it("is on by default in this phase", () => {
    expect(START_ON_CURRENT_DAY).toBe(true);
  });

  it("anchors on the date itself when the toggle is on — no start-of-week snap", () => {
    expect(weekAnchorOf("2026-09-09", 0, true)).toBe("2026-09-09"); // Wednesday stays put
    expect(weekAnchorOf("2026-09-06", 1, true)).toBe("2026-09-06"); // Sunday stays put too
  });

  it("defaults the third argument from the exported toggle", () => {
    expect(weekAnchorOf("2026-09-09", 0)).toBe("2026-09-09");
  });

  it("still falls back to the start-of-week snap when the toggle is off", () => {
    // The branch a later phase's settings UI will expose (dates.ts) — it
    // must keep matching `weekStartOf` exactly.
    expect(weekAnchorOf("2026-09-09", 0, false)).toBe("2026-09-06"); // Wednesday → Sunday
    expect(weekAnchorOf("2026-09-09", 1, false)).toBe("2026-09-07"); // Wednesday → Monday
    expect(weekAnchorOf("2026-09-06", 0, false)).toBe("2026-09-06"); // Sunday → itself
  });
});

describe("fetch-window derivation", () => {
  it("derives the window's inclusive dates and half-open instants in the zone", () => {
    const window = viewWindowOf("2026-09-06", 7, CHICAGO);
    expect(window.startDate).toBe("2026-09-06");
    expect(window.endDate).toBe("2026-09-12");
    expect(window.startMs).toBe(Date.UTC(2026, 8, 6, 5)); // Sunday 00:00 CDT
    expect(window.endMs).toBe(Date.UTC(2026, 8, 13, 5)); // NEXT Sunday 00:00 — exclusive
  });

  it("spans exactly the days the grid draws, whatever the column count", () => {
    // The fix's core: the window IS the visible span, so a phone fetches its
    // three days and a tablet its seven — neither a fixed seven-day box.
    expect(viewWindowOf("2026-09-06", 3, CHICAGO)).toMatchObject({
      startDate: "2026-09-06",
      endDate: "2026-09-08",
    });
    expect(viewWindowOf("2026-09-06", 5, CHICAGO)).toMatchObject({
      startDate: "2026-09-06",
      endDate: "2026-09-10",
    });
    expect(viewWindowOf("2026-09-06", 1, CHICAGO)).toMatchObject({
      startDate: "2026-09-06",
      endDate: "2026-09-06",
    });
  });

  it("closes a window on the midnight AFTER its last day, at every width", () => {
    for (const days of [1, 3, 5, 7]) {
      const window = viewWindowOf("2026-09-06", days, CHICAGO);
      expect(window.endMs).toBe(zoneMidnightMs(CHICAGO, addDays(window.endDate, 1)));
      expect(diffDays(window.startDate, window.endDate)).toBe(days - 1);
    }
  });

  it("abuts the next page's window exactly — no gap, no overlap", () => {
    // Paging moves the anchor by the column count, so consecutive windows
    // meet: the second starts on the instant the first ends.
    for (const days of [3, 5, 7]) {
      const first = viewWindowOf("2026-09-06", days, CHICAGO);
      const second = viewWindowOf(addDays("2026-09-06", days), days, CHICAGO);
      expect(second.startDate).toBe(addDays(first.endDate, 1));
      expect(second.startMs).toBe(first.endMs);
    }
  });

  it("lets a DST transition inside the window change its width", () => {
    const springForward = viewWindowOf("2026-03-08", 7, CHICAGO);
    expect(springForward.startMs).toBe(Date.UTC(2026, 2, 8, 6)); // midnight CST
    expect(springForward.endMs).toBe(Date.UTC(2026, 2, 15, 5)); // midnight CDT
    expect(springForward.endMs - springForward.startMs).toBe(167 * HOUR);
  });

  it("refuses a width that is not a whole number of days", () => {
    expect(() => viewWindowOf("2026-09-06", 0, CHICAGO)).toThrow(/days/);
    expect(() => viewWindowOf("2026-09-06", -3, CHICAGO)).toThrow(/days/);
    expect(() => viewWindowOf("2026-09-06", 3.5, CHICAGO)).toThrow(/days/);
  });
});
