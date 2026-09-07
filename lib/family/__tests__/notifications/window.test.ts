/**
 * 008 T019: the run window and the fifteen-minute clamp (FR-817, FR-829, R803).
 *
 * The behaviour these pin is the one nobody can arrange by hand: what the
 * engine does after an outage. The reference documents nothing about it
 * [UNKNOWN] — this is spec Assumption 10, and it is the difference between a
 * wall tablet that catches up quietly and one that shows a morning's worth of
 * banners at once.
 */

import { describe, expect, it } from "vitest";

import { MAX_STALENESS_MS, inWindow, isCurrent, runWindowOf } from "../../notifications/window";

const NOW = Date.parse("2026-09-09T16:20:00.000Z");
const MINUTE = 60_000;

describe("runWindowOf", () => {
  it("considers everything since the last run, on a normal minute", () => {
    expect(runWindowOf(NOW - MINUTE, NOW)).toEqual({ fromMs: NOW - MINUTE, toMs: NOW });
  });

  it("clamps an hour-long gap to fifteen minutes, so an outage cannot flood", () => {
    const window = runWindowOf(NOW - 60 * MINUTE, NOW);
    expect(window).toEqual({ fromMs: NOW - MAX_STALENESS_MS, toMs: NOW });
    expect(window.toMs - window.fromMs).toBe(MAX_STALENESS_MS);
  });

  it("gives a first-ever run a full window, not the whole of history", () => {
    expect(runWindowOf(null, NOW)).toEqual({ fromMs: NOW - MAX_STALENESS_MS, toMs: NOW });
  });

  it("sends nothing when the last run is somehow in the future", () => {
    const window = runWindowOf(NOW + 5 * MINUTE, NOW);
    expect(window.fromMs).toBe(NOW);
    expect(window.toMs).toBe(NOW);
    expect(inWindow(NOW, window)).toBe(false);
  });

  it("never inverts, whatever it is given", () => {
    for (const last of [null, NOW - 10 * MINUTE, NOW, NOW + MINUTE, 0]) {
      const window = runWindowOf(last, NOW);
      expect(window.fromMs).toBeLessThanOrEqual(window.toMs);
    }
  });
});

describe("inWindow", () => {
  const window = runWindowOf(NOW - 5 * MINUTE, NOW);

  it("excludes the lower bound, so the previous run's last minute is not resent", () => {
    expect(inWindow(window.fromMs, window)).toBe(false);
    expect(inWindow(window.fromMs + 1, window)).toBe(true);
  });

  it("includes the upper bound, so a reminder due exactly now goes now", () => {
    expect(inWindow(window.toMs, window)).toBe(true);
    expect(inWindow(window.toMs + 1, window)).toBe(false);
  });
});

describe("isCurrent", () => {
  it("does not show a moment that has not arrived", () => {
    expect(isCurrent(NOW + MINUTE, NOW)).toBe(false);
  });

  it("shows the moment itself, and one fourteen minutes old", () => {
    expect(isCurrent(NOW, NOW)).toBe(true);
    expect(isCurrent(NOW - 14 * MINUTE, NOW)).toBe(true);
  });

  it("stops exactly at fifteen minutes", () => {
    expect(isCurrent(NOW - MAX_STALENESS_MS, NOW)).toBe(true);
    expect(isCurrent(NOW - MAX_STALENESS_MS - 1, NOW)).toBe(false);
  });

  it("shows nothing at all to a device that was asleep all morning", () => {
    const morning = [1, 2, 3].map((hours) => NOW - hours * 60 * MINUTE);
    expect(morning.filter((fireAt) => isCurrent(fireAt, NOW))).toEqual([]);
  });
});
