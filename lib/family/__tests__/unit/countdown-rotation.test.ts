import { describe, expect, it } from "vitest";

import { rotates, rotationAt } from "@/lib/family/countdowns/rotation";
import type { CountdownStatus } from "@/lib/family/countdowns/target";

/**
 * 009 FR-908 / SC-903. The rotation as a function of a step number, so
 * "every active countdown reaches the first position" is a property this test
 * can prove rather than something you have to watch a wall display to believe.
 */

function statusFor(summary: string, days: number): CountdownStatus {
  return {
    eventId: `event-${summary}`,
    summary,
    targetDate: "2026-09-20",
    days,
    state: "upcoming",
  };
}

const FIVE = ["A", "B", "C", "D", "E"].map((name, index) => statusFor(name, index + 1));
const names = (list: readonly CountdownStatus[]) => list.map((one) => one.summary);

describe("rotates", () => {
  it("is false when everything fits, whatever the numbers", () => {
    expect(rotates(3, 3)).toBe(false);
    expect(rotates(1, 3)).toBe(false);
    expect(rotates(0, 3)).toBe(false);
  });

  it("is true only when there is more than there is room for", () => {
    expect(rotates(4, 3)).toBe(true);
  });

  it("is false with no room at all, rather than dividing by zero", () => {
    expect(rotates(4, 0)).toBe(false);
  });
});

describe("rotationAt — when everything fits", () => {
  it("never changes the order, however far the step runs", () => {
    for (const step of [0, 1, 7, 999]) {
      expect(names(rotationAt(FIVE.slice(0, 3), 3, step))).toEqual(["A", "B", "C"]);
    }
  });

  it("draws fewer than the slots without padding", () => {
    expect(names(rotationAt(FIVE.slice(0, 2), 3, 4))).toEqual(["A", "B"]);
  });
});

describe("rotationAt — when it does not fit", () => {
  it("moves the window one place per step", () => {
    expect(names(rotationAt(FIVE, 3, 0))).toEqual(["A", "B", "C"]);
    expect(names(rotationAt(FIVE, 3, 1))).toEqual(["B", "C", "D"]);
    expect(names(rotationAt(FIVE, 3, 2))).toEqual(["C", "D", "E"]);
  });

  it("wraps rather than running off the end", () => {
    expect(names(rotationAt(FIVE, 3, 3))).toEqual(["D", "E", "A"]);
    expect(names(rotationAt(FIVE, 3, 4))).toEqual(["E", "A", "B"]);
    expect(names(rotationAt(FIVE, 3, 5))).toEqual(["A", "B", "C"]);
  });

  it("brings EVERY countdown to the first position within one cycle (SC-903)", () => {
    const first = new Set<string>();
    for (let step = 0; step < FIVE.length; step += 1) {
      first.add(rotationAt(FIVE, 3, step)[0].summary);
    }
    expect([...first].sort()).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("stays in range when a step number has run for days", () => {
    expect(names(rotationAt(FIVE, 3, 100_003))).toEqual(names(rotationAt(FIVE, 3, 3)));
  });

  it("stays in range when the list shrinks under a step that outran it", () => {
    // An event edited on another device drops out mid-rotation. The bar must
    // keep drawing, not blank until the next tick.
    const shown = rotationAt(FIVE.slice(0, 4), 3, 9);
    expect(shown).toHaveLength(3);
    expect(shown.every((one) => one !== undefined)).toBe(true);
  });
});

describe("rotationAt — the empty cases", () => {
  it("draws nothing from nothing", () => {
    expect(rotationAt([], 3, 0)).toEqual([]);
  });

  it("draws nothing into no room", () => {
    expect(rotationAt(FIVE, 0, 0)).toEqual([]);
  });
});
