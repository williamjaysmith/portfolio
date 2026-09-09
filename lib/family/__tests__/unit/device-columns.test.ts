/**
 * 012 — the width hint the calendar's server render reads from the device.
 *
 * The whole value of this cookie is that the FIRST paint is right, so the two
 * things worth proving are that a real measurement survives the round trip and
 * that nothing else does. It is client-supplied, and a server that clamped
 * "14" to seven would be inventing a measurement no device could have taken;
 * refusing it and falling back to the default is the same behaviour the
 * calendar had before the cookie existed, which is the only safe thing for a
 * hint to degrade to.
 */

import { describe, expect, it } from "vitest";

import {
  COLUMNS_COOKIE,
  columnCookieString,
  parseColumnCount,
} from "@/lib/family/calendar/device-columns";
import { MAX_COLUMN_COUNT, MIN_COLUMN_COUNT } from "@/lib/family/week-geometry";

describe("reading the hint", () => {
  it("takes every count a device can actually measure", () => {
    for (let count = MIN_COLUMN_COUNT; count <= MAX_COLUMN_COUNT; count += 1) {
      expect(parseColumnCount(String(count))).toBe(count);
    }
  });

  it("has nothing to say when the device has never measured", () => {
    expect(parseColumnCount(undefined)).toBeNull();
    expect(parseColumnCount(null)).toBeNull();
    expect(parseColumnCount("")).toBeNull();
    expect(parseColumnCount("   ")).toBeNull();
  });

  it("refuses a count outside the range a grid can produce", () => {
    // Below FR-278's floor and above its ceiling. Refused rather than clamped:
    // the caller then seeds the default window, which is what it always did.
    expect(parseColumnCount(String(MIN_COLUMN_COUNT - 1))).toBeNull();
    expect(parseColumnCount(String(MAX_COLUMN_COUNT + 1))).toBeNull();
    expect(parseColumnCount("0")).toBeNull();
    expect(parseColumnCount("-3")).toBeNull();
  });

  it("refuses anything that is not a whole number of columns", () => {
    expect(parseColumnCount("3.5")).toBeNull();
    expect(parseColumnCount("seven")).toBeNull();
    expect(parseColumnCount("7; DROP TABLE events")).toBeNull();
    expect(parseColumnCount("Infinity")).toBeNull();
    expect(parseColumnCount("NaN")).toBeNull();
  });
});

describe("writing the hint", () => {
  it("scopes it to /family and to same-site requests", () => {
    const cookie = columnCookieString(3);

    expect(cookie).toContain(`${COLUMNS_COOKIE}=3`);
    expect(cookie).toContain("Path=/family");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("writes what the next server render will read back", () => {
    const value = /family_columns=([^;]+)/.exec(columnCookieString(5))?.[1];

    expect(parseColumnCount(value)).toBe(5);
  });
});
