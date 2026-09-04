import { act, renderHook, type RenderHookResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  followScrollTop,
  useFollowScroll,
  type FollowScrollState,
  type UseFollowScrollOptions,
} from "../useFollowScroll";

/**
 * T034 — the FR-290 follow-scroll (US1-15, Assumption 42): an untouched grid
 * holds the now line about a third of the viewport from the top, repositioned
 * from Phase 1's shared minute clock; a manual hour-scroll pauses following
 * until the household-zone day rollover or a Today activation resumes it.
 *
 * The clock: Wednesday 2026-09-02 13:00 in America/Chicago (CDT, UTC-5) is
 * 2026-09-02T18:00:00Z. jsdom lays nothing out, so the viewport's sizes are
 * defined by hand and the px-per-minute scale is injected, exactly as the
 * measured grid injects it (T027).
 */

const ZONE = "America/Chicago";
const AFTERNOON = new Date("2026-09-02T18:00:00Z"); // Wed 13:00 Chicago
const ONE_MINUTE_LATER = new Date("2026-09-02T18:01:00Z");
const AFTER_ROLLOVER = new Date("2026-09-03T05:01:00Z"); // Thu 00:01 Chicago

const VIEWPORT_H = 600;
const CONTENT_H = 4800; // the 24-hour canvas at 200 px per hour
const PX_PER_MINUTE = CONTENT_H / 1440;

// 13:00 = 780 wall minutes → 780 · (10/3) − 600/3 = 2400.
const AFTERNOON_TOP = 2400;

function makeViewport(): HTMLElement {
  const node = document.createElement("div");
  Object.defineProperty(node, "clientHeight", { value: VIEWPORT_H });
  Object.defineProperty(node, "scrollHeight", { value: CONTENT_H });
  return node;
}

function mountFollow(
  options: Partial<UseFollowScrollOptions> = {},
): { node: HTMLElement; hook: RenderHookResult<FollowScrollState, unknown> } {
  const node = makeViewport();
  const hook = renderHook(() =>
    useFollowScroll({ zone: ZONE, pxPerMinute: PX_PER_MINUTE, ...options }),
  );
  act(() => {
    hook.result.current.viewportRef(node);
  });
  return { node, hook };
}

/** Move the mocked clock and let the shared store tick past a minute edge. */
async function advanceClockTo(instant: Date): Promise<void> {
  vi.setSystemTime(instant);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
}

describe("followScrollTop", () => {
  it("anchors the now line a third of the viewport from the top", () => {
    const top = followScrollTop(780, PX_PER_MINUTE, VIEWPORT_H, CONTENT_H);
    expect(top).toBeCloseTo(AFTERNOON_TOP, 5);
    // The now line's y minus the scroll offset IS the third.
    expect(780 * PX_PER_MINUTE - top).toBeCloseTo(VIEWPORT_H / 3, 5);
  });

  it("clamps to the top of the canvas in the small hours", () => {
    expect(followScrollTop(30, PX_PER_MINUTE, VIEWPORT_H, CONTENT_H)).toBe(0);
  });

  it("clamps to the bottom of the canvas late in the evening", () => {
    expect(followScrollTop(1439, PX_PER_MINUTE, VIEWPORT_H, CONTENT_H)).toBe(
      CONTENT_H - VIEWPORT_H,
    );
  });

  it("never scrolls a canvas shorter than its viewport", () => {
    expect(followScrollTop(780, 0.1, VIEWPORT_H, 100)).toBe(0);
  });
});

describe("useFollowScroll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AFTERNOON);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("positions the untouched grid with the now line a third from the top", () => {
    const { node, hook } = mountFollow();

    expect(hook.result.current.following).toBe(true);
    expect(node.scrollTop).toBeCloseTo(AFTERNOON_TOP, 5);
  });

  it("keeps following as the shared clock ticks — no reload, no own timer", async () => {
    const { node } = mountFollow();

    await advanceClockTo(ONE_MINUTE_LATER);

    expect(node.scrollTop).toBeCloseTo(781 * PX_PER_MINUTE - VIEWPORT_H / 3, 5);
  });

  it("does not mistake its own repositioning for a manual scroll", () => {
    const { hook } = mountFollow();

    // The browser fires a scroll event for the programmatic set; the offset
    // still matches what the hook wrote, so following must survive it.
    act(() => {
      hook.result.current.onScroll();
    });

    expect(hook.result.current.following).toBe(true);
  });

  it("pauses on a manual hour-scroll and stops moving the grid", async () => {
    const { node, hook } = mountFollow();

    node.scrollTop = 1000;
    act(() => {
      hook.result.current.onScroll();
    });

    expect(hook.result.current.following).toBe(false);

    await advanceClockTo(ONE_MINUTE_LATER);
    expect(node.scrollTop).toBe(1000);
  });

  it("a Today activation resumes following and repositions at once", () => {
    const { node, hook } = mountFollow();
    node.scrollTop = 1000;
    act(() => {
      hook.result.current.onScroll();
    });

    act(() => {
      hook.result.current.resume();
    });

    expect(hook.result.current.following).toBe(true);
    expect(node.scrollTop).toBeCloseTo(AFTERNOON_TOP, 5);
  });

  it("the household-zone day rollover resumes following by itself", async () => {
    const { node, hook } = mountFollow();
    node.scrollTop = 1000;
    act(() => {
      hook.result.current.onScroll();
    });

    await advanceClockTo(AFTER_ROLLOVER);

    expect(hook.result.current.following).toBe(true);
    // 00:01 clamps to the very top of the canvas.
    expect(node.scrollTop).toBe(0);
  });

  it("holds still while the grid is unmeasured", () => {
    const { node, hook } = mountFollow({ pxPerMinute: null });

    expect(hook.result.current.following).toBe(true);
    expect(node.scrollTop).toBe(0);
  });
});
