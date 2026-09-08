import { describe, expect, it } from "vitest";

import { countdownStateOf, daysUntil } from "@/lib/family/countdowns/days";
import { localDateOf } from "@/lib/family/calendar/dates";

/**
 * 009 R902 / T009. Days remaining, in the household's zone (FR-904, FR-905,
 * SC-902, SC-910).
 *
 * Pure date subtraction with no clock and no React, which is the point: the
 * midnight roll is a property of the shell's shipped minute store handing this
 * function a new `todayDate`, so what has to be proved here is only the
 * arithmetic — including both daylight-saving changes, where a naive
 * hours-divided-by-24 would be off by one for half the year.
 */

const CHICAGO = "America/Chicago";

describe("daysUntil", () => {
  it("counts tomorrow as one", () => {
    expect(daysUntil("2026-09-07", "2026-09-08")).toBe(1);
  });

  it("counts today as zero", () => {
    expect(daysUntil("2026-09-07", "2026-09-07")).toBe(0);
  });

  it("counts yesterday as minus one", () => {
    expect(daysUntil("2026-09-07", "2026-09-06")).toBe(-1);
  });

  it("counts a month out", () => {
    expect(daysUntil("2026-09-07", "2026-10-07")).toBe(30);
  });

  it("counts across a year boundary", () => {
    expect(daysUntil("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("counts across a leap day", () => {
    expect(daysUntil("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("counts whole days across the SPRING-FORWARD change, not 23-hour days", () => {
    // 2026-03-08 is the US spring-forward Sunday: that local day is 23 hours long.
    expect(daysUntil("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysUntil("2026-03-01", "2026-03-15")).toBe(14);
  });

  it("counts whole days across the FALL-BACK change, not 25-hour days", () => {
    // 2026-11-01 is the US fall-back Sunday: that local day is 25 hours long.
    expect(daysUntil("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysUntil("2026-10-25", "2026-11-08")).toBe(14);
  });
});

describe("the household's number, not the device's", () => {
  it("gives a device in another timezone the same answer", () => {
    // One instant, read as a local date in three zones. The countdown is
    // counted from the HOUSEHOLD's date, so every device agrees (FR-904).
    const instant = Date.UTC(2026, 8, 8, 3, 30); // 22:30 CDT on the 7th
    const household = localDateOf(CHICAGO, instant);

    expect(household).toBe("2026-09-07");
    expect(localDateOf("UTC", instant)).toBe("2026-09-08");
    expect(localDateOf("Asia/Tokyo", instant)).toBe("2026-09-08");

    // Both phones ask with the household's date and get the household's answer.
    expect(daysUntil(household, "2026-09-20")).toBe(13);
  });
});

describe("countdownStateOf", () => {
  it("is upcoming while there are days left", () => {
    expect(countdownStateOf(1)).toBe("upcoming");
    expect(countdownStateOf(365)).toBe("upcoming");
  });

  it("is today on the day itself, never zero-days-upcoming", () => {
    expect(countdownStateOf(0)).toBe("today");
  });

  it("is past the day after, so the bar lets it go (FR-905)", () => {
    expect(countdownStateOf(-1)).toBe("past");
    expect(countdownStateOf(-400)).toBe("past");
  });
});
