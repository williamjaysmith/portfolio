import { describe, expect, it } from "vitest";

import { swipeAxisOf, swipeStepOf, travelOf, type SwipeAxis } from "@/lib/family/swipe";

/**
 * T073 — the three pure decisions behind every paging swipe, moved out of the
 * calendar's `WeekPager` when the Tasks board grew a pager of its own (R320).
 *
 * The assertions are unmoved from `WeekPager.test.tsx`, deliberately: this is a
 * relocation and not a rewrite, so a behaviour change on either pager would have
 * to fail one of the tests that already passed. What stayed behind in that file
 * is everything that needs a mounted component or the DOM — the gesture-long
 * axis lock, "one swipe is one page", and `beginsOnBlock`.
 */

const UNLOCKED: SwipeAxis = "unlocked";

describe("swipeAxisOf", () => {
  it("stays unlocked until the displacement is worth claiming (FR-280)", () => {
    expect(swipeAxisOf(UNLOCKED, { x: 9, y: 0 })).toBe("unlocked");
    expect(swipeAxisOf(UNLOCKED, { x: 0, y: -9 })).toBe("unlocked");
  });

  it("claims the gesture horizontally only when the horizontal dominates", () => {
    expect(swipeAxisOf(UNLOCKED, { x: -14, y: 4 })).toBe("horizontal");
    expect(swipeAxisOf(UNLOCKED, { x: 4, y: 14 })).toBe("vertical");
  });

  it("leaves an equal diagonal to the hour scroll (FR-280)", () => {
    expect(swipeAxisOf(UNLOCKED, { x: -20, y: 20 })).toBe("vertical");
  });

  it("never re-locks once the gesture has an axis", () => {
    expect(swipeAxisOf("vertical", { x: -200, y: 12 })).toBe("vertical");
    expect(swipeAxisOf("horizontal", { x: 4, y: 200 })).toBe("horizontal");
  });
});

describe("swipeStepOf", () => {
  it("pages later for a swipe left and earlier for a swipe right (FR-279)", () => {
    expect(swipeStepOf("horizontal", -60)).toBe(1);
    expect(swipeStepOf("horizontal", 60)).toBe(-1);
  });

  it("does not page a release that never travelled far enough", () => {
    expect(swipeStepOf("horizontal", -40)).toBeNull();
    expect(swipeStepOf("horizontal", 40)).toBeNull();
  });

  it("does not page a gesture the hour scroll owns", () => {
    expect(swipeStepOf("vertical", -400)).toBeNull();
    expect(swipeStepOf(UNLOCKED, -400)).toBeNull();
  });
});

describe("travelOf", () => {
  it("follows the finger, capped so the strip cannot run off the page", () => {
    expect(travelOf(-30, false)).toBe(-30);
    expect(travelOf(-4000, false)).toBe(-72);
    expect(travelOf(4000, null)).toBe(72);
  });

  it("collapses to an instant jump under reduced motion (FR-252)", () => {
    expect(travelOf(-30, true)).toBe(0);
    expect(travelOf(4000, true)).toBe(0);
  });
});
