import { describe, expect, it } from "vitest";

import { dayHeaderOf, dayWordsOf } from "@/lib/family/meals/week";

/**
 * 006 T021 — how the Meals grid words a day (FR-625, FR-646).
 *
 * This file used to cover the grid's week too — `weekDatesOf`, `shiftWeek` and
 * `weekLabelOf`. 013 replaced the week with a window and those moved to
 * `meals-window.test.ts`, which covers them far more thoroughly because two of
 * that phase's requirements can only be checked in a unit test. What is left
 * here is the wording of a single day, which no model of the window affects.
 */

describe("dayWordsOf / dayHeaderOf", () => {
  it("reads a date in words and as a column header", () => {
    expect(dayWordsOf("2026-09-09")).toBe("Wednesday 9 September");
    expect(dayWordsOf("2026-12-27")).toBe("Sunday 27 December");
    expect(dayHeaderOf("2026-09-09")).toEqual({ weekday: "Wed", numeral: "9" });
  });
});
