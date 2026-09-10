/**
 * 013 T002 — the Meals grid's window, before any component sees it.
 *
 * The window replaces a pair of independent states: a seven-day household week,
 * and a separately-paged slice of it. That pair is the reported defect rather
 * than an implementation detail — on a phone the labelled arrows moved seven
 * days while two columns were on screen, so five days per step were reachable
 * only by an unlabelled swipe.
 *
 * **Two of this phase's requirements can only be checked here.** FR-1303's
 * abutment is a property of a sequence of steps, and no browser journey walks a
 * fortnight; FR-1308's midnight hold cannot be driven in a browser at all,
 * because the e2e clock helper refuses jumps over three hours (009's finding).
 * So these are not a formality before the real tests. They are the only tests
 * those requirements get, and the hook's own suite continues the second one.
 */

import { describe, expect, it } from "vitest";

import { addDays } from "@/lib/family/calendar/dates";
import { shiftWindow, windowDatesOf, windowLabelOf } from "@/lib/family/meals/window";

/** A Thursday, so nothing here accidentally passes by sitting on a week boundary. */
const THURSDAY = "2026-09-10";

describe("the days a window shows", () => {
  it("is exactly as many consecutive days as it was asked for", () => {
    expect(windowDatesOf(THURSDAY, 2)).toEqual(["2026-09-10", "2026-09-11"]);
    expect(windowDatesOf(THURSDAY, 5)).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
    ]);
    expect(windowDatesOf(THURSDAY, 7)).toHaveLength(7);
  });

  it("begins on the anchor, whatever weekday that is", () => {
    // The whole point of the change: the household's start-of-week no longer
    // decides where the window begins.
    for (const columns of [1, 2, 3, 5, 7]) {
      expect(windowDatesOf(THURSDAY, columns)[0]).toBe(THURSDAY);
    }
  });

  it("shows one day when only one column fits", () => {
    // A very narrow screen, or a large text rung. It must not collapse to
    // nothing and it must not stall.
    expect(windowDatesOf(THURSDAY, 1)).toEqual([THURSDAY]);
  });

  it("crosses a week boundary without noticing it", () => {
    // Thursday + 5 runs through Saturday into Sunday and Monday. Under the old
    // model this was the boundary that made a page-sized step skip a day.
    expect(windowDatesOf(THURSDAY, 5)).toContain("2026-09-13");
    expect(windowDatesOf(THURSDAY, 5)).toContain("2026-09-14");
  });

  it("crosses a month and a year boundary", () => {
    expect(windowDatesOf("2026-09-29", 4)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(windowDatesOf("2026-12-30", 4)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("refuses a width no grid could have measured", () => {
    // Zero or negative would silently render nothing, which is worse than
    // throwing: the caller has a bug and the screen would merely look empty.
    expect(() => windowDatesOf(THURSDAY, 0)).toThrow();
    expect(() => windowDatesOf(THURSDAY, -1)).toThrow();
  });
});

describe("a step", () => {
  it("moves the anchor by exactly the width on show", () => {
    expect(shiftWindow(THURSDAY, 2, 1)).toBe("2026-09-12");
    expect(shiftWindow(THURSDAY, 2, -1)).toBe("2026-09-08");
    expect(shiftWindow(THURSDAY, 5, 1)).toBe("2026-09-15");
    expect(shiftWindow(THURSDAY, 7, 1)).toBe("2026-09-17");
  });

  it("moves seven days at seven columns — the wall tablet is the general rule, not a branch", () => {
    // US2. If an implementation ever needs a special case for 7, the rule is
    // wrong: a week is simply the width the wall happens to fit.
    expect(shiftWindow(THURSDAY, 7, 1)).toBe(addDays(THURSDAY, 7));
    expect(shiftWindow(THURSDAY, 7, -1)).toBe(addDays(THURSDAY, -7));
  });

  it("moves one day at one column", () => {
    expect(shiftWindow(THURSDAY, 1, 1)).toBe("2026-09-11");
  });
});

describe("abutment — FR-1303, and the reason this file exists", () => {
  it("returns to where it started, forward then back", () => {
    for (const columns of [1, 2, 3, 5, 7]) {
      const there = shiftWindow(THURSDAY, columns, 1);
      expect(shiftWindow(there, columns, -1)).toBe(THURSDAY);
    }
  });

  it("makes consecutive windows abut: the next begins the day after the last one ended", () => {
    for (const columns of [1, 2, 3, 5, 7]) {
      const first = windowDatesOf(THURSDAY, columns);
      const next = windowDatesOf(shiftWindow(THURSDAY, columns, 1), columns);
      expect(next[0]).toBe(addDays(first[first.length - 1], 1));
    }
  });

  it("skips no day and repeats none across a fortnight of steps", () => {
    // The property a household would actually notice, walked the way they walk
    // it. This is the defect stated as a test: under the shipped behaviour a
    // two-column window stepping seven days saw 4 of every 14 days.
    for (const columns of [2, 5, 7]) {
      const seen: string[] = [];
      let anchor = THURSDAY;
      const steps = Math.ceil(14 / columns);
      for (let step = 0; step < steps; step += 1) {
        seen.push(...windowDatesOf(anchor, columns));
        anchor = shiftWindow(anchor, columns, 1);
      }

      expect(new Set(seen).size, `${columns} columns repeated a day`).toBe(seen.length);
      // Every day from the first to the last is present — no gaps.
      const expected = Array.from({ length: seen.length }, (_, index) => addDays(THURSDAY, index));
      expect(seen, `${columns} columns skipped a day`).toEqual(expected);
    }
  });

  it("abuts backwards too", () => {
    for (const columns of [2, 5, 7]) {
      const earlier = windowDatesOf(shiftWindow(THURSDAY, columns, -1), columns);
      expect(addDays(earlier[earlier.length - 1], 1)).toBe(THURSDAY);
    }
  });
});

describe("the label", () => {
  it("names the days on show, not a week", () => {
    expect(windowLabelOf(windowDatesOf("2026-09-07", 7))).toBe("7–13 September");
    expect(windowLabelOf(windowDatesOf(THURSDAY, 2))).toBe("10–11 September");
  });

  it("spells out both months across a month boundary", () => {
    expect(windowLabelOf(windowDatesOf("2026-09-28", 7))).toBe("28 September – 4 October");
  });

  it("spells out both years across a year boundary", () => {
    expect(windowLabelOf(windowDatesOf("2026-12-28", 7))).toBe(
      "28 December 2026 – 3 January 2027",
    );
  });

  it("names a single day when one column fits", () => {
    // "10–10 September" would be absurd; a one-day window says one date.
    expect(windowLabelOf(windowDatesOf(THURSDAY, 1))).toBe("10 September");
  });
});
