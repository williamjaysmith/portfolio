import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  boardGeometryOf,
  useBoardGeometry,
  type BoardMeasurement,
} from "@/app/family/(app)/components/useBoardGeometry";

/**
 * T040 / R320: the board measures itself. `boardGeometryOf` is the branchy,
 * jsdom-safe half — one raw read of the mounted board and its token probe
 * either becomes a `BoardLayout` or honestly becomes `null` — and it is what
 * this suite drives, exactly as `geometryOf` drives the calendar's.
 *
 * The fit table itself (1920×1080 → 4 · 1180×820 → 4 · 820×1180 → 3 wrapped ·
 * 390×844 → 1 paged) belongs to `boardLayoutOf` and is asserted once, in
 * `tasks-layout.test.ts`. What is asserted here is the seam: that a real
 * measurement reaches that function unaltered, that an unlaid-out DOM produces
 * no layout at all rather than a layout built from zeroes, and that the board
 * still renders every column it has while it waits to be measured — the wall
 * tablet's first paint is the board, never a loading state (R314).
 */

const WALL_TABLET: BoardMeasurement = {
  viewportWidth: 1920,
  viewportHeight: 1080,
  boardWidth: 1778,
  referenceColumnWidth: 400,
};

/** `--fam-task-col-w` at the reference unit, which is what the probe resolves. */
const PROBE_WIDTH = 400;

describe("boardGeometryOf — one measurement, or none", () => {
  it("passes a real measurement through to the fit rule", () => {
    expect(boardGeometryOf(WALL_TABLET, 4)).toEqual({ perRow: 4, mode: "grid" });
  });

  it("pages when more columns exist than the measured width fits", () => {
    expect(boardGeometryOf(WALL_TABLET, 6)).toEqual({ perRow: 4, mode: "pager" });
  });

  it("refuses a board that has not been laid out — jsdom, display:none, mid-unmount", () => {
    expect(boardGeometryOf({ ...WALL_TABLET, boardWidth: 0 }, 4)).toBeNull();
  });

  it("refuses an unresolved token probe rather than dividing by zero", () => {
    expect(boardGeometryOf({ ...WALL_TABLET, referenceColumnWidth: 0 }, 4)).toBeNull();
  });

  it("refuses a viewport it cannot orient, because wrap-or-page turns on it", () => {
    expect(boardGeometryOf({ ...WALL_TABLET, viewportHeight: 0 }, 4)).toBeNull();
    expect(boardGeometryOf({ ...WALL_TABLET, viewportWidth: 0 }, 4)).toBeNull();
  });

  it("refuses a measurement that is not a finite number", () => {
    expect(boardGeometryOf({ ...WALL_TABLET, boardWidth: Number.NaN }, 4)).toBeNull();
  });
});

/* ------------------------------------------------------------- the hook -- */

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(target: Element): void {
    this.observed.push(target);
  }
  disconnect(): void {
    this.observed.length = 0;
  }
  fire(): void {
    this.callback();
  }
}

/**
 * jsdom lays nothing out, so every `getBoundingClientRect` is zero. This makes
 * the board node and the hook's own probe report real widths — the probe is
 * recognised by the token it is sized with, which is the only thing the hook
 * guarantees about it.
 */
function stubLayout(boardWidth: number, probeToken = "var(--fam-task-col-w)"): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ): DOMRect {
    const width =
      this instanceof HTMLElement && this.style.width === probeToken
        ? PROBE_WIDTH
        : boardWidth;
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
}

describe("useBoardGeometry", () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    setViewport(1920, 1080);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "ResizeObserver");
  });

  it("shows every column it has while unmeasured, so the first paint is the board", () => {
    const { result } = renderHook(() => useBoardGeometry(4));

    expect(result.current.measured).toBe(false);
    expect(result.current.layout).toEqual({ perRow: 4, mode: "grid" });
  });

  it("still holds one column for a household with none to show", () => {
    const { result } = renderHook(() => useBoardGeometry(0));

    expect(result.current.layout).toEqual({ perRow: 1, mode: "grid" });
  });

  it("stays unmeasured on a mounted board that jsdom never lays out", () => {
    const { result } = renderHook(() => useBoardGeometry(4));

    act(() => {
      result.current.boardRef(document.createElement("div"));
    });

    expect(result.current.measured).toBe(false);
    expect(result.current.layout).toEqual({ perRow: 4, mode: "grid" });
  });

  it("measures the mounted board against its own token probe", () => {
    stubLayout(1778);
    const { result } = renderHook(() => useBoardGeometry(6));

    act(() => {
      result.current.boardRef(document.createElement("div"));
    });

    expect(result.current.measured).toBe(true);
    expect(result.current.layout).toEqual({ perRow: 4, mode: "pager" });
  });

  it("re-measures when the observer fires, and again on demand", () => {
    Reflect.set(globalThis, "ResizeObserver", FakeResizeObserver);
    stubLayout(1778);
    const { result } = renderHook(() => useBoardGeometry(6));
    const node = document.createElement("div");

    act(() => {
      result.current.boardRef(node);
    });
    expect(result.current.layout).toEqual({ perRow: 4, mode: "pager" });

    stubLayout(820);
    act(() => {
      FakeResizeObserver.instances[0].fire();
    });
    expect(result.current.layout).toEqual({ perRow: 2, mode: "pager" });

    stubLayout(1778);
    act(() => {
      result.current.remeasure();
    });
    expect(result.current.layout).toEqual({ perRow: 4, mode: "pager" });
  });

  it("watches the probe too, because a text-size or scale change resizes it and not the board", () => {
    Reflect.set(globalThis, "ResizeObserver", FakeResizeObserver);
    stubLayout(1778);
    const { result } = renderHook(() => useBoardGeometry(4));
    const node = document.createElement("div");

    act(() => {
      result.current.boardRef(node);
    });

    expect(FakeResizeObserver.instances[0].observed).toHaveLength(2);
    expect(FakeResizeObserver.instances[0].observed[0]).toBe(node);
  });

  it("takes its probe back out of the board it leaves, and returns to unmeasured", () => {
    Reflect.set(globalThis, "ResizeObserver", FakeResizeObserver);
    stubLayout(1778);
    const { result } = renderHook(() => useBoardGeometry(4));
    const node = document.createElement("div");

    act(() => {
      result.current.boardRef(node);
    });
    expect(node.childElementCount).toBe(1);

    act(() => {
      result.current.boardRef(null);
    });

    expect(node.childElementCount).toBe(0);
    expect(result.current.measured).toBe(false);
  });

  it("re-decides the layout when the column count changes without a resize", () => {
    stubLayout(1778);
    const { result, rerender } = renderHook((columns: number) => useBoardGeometry(columns), {
      initialProps: 4,
    });

    act(() => {
      result.current.boardRef(document.createElement("div"));
    });
    expect(result.current.layout).toEqual({ perRow: 4, mode: "grid" });

    rerender(6);

    expect(result.current.layout).toEqual({ perRow: 4, mode: "pager" });
  });

  it("probes the token it is given and applies the rule it is given (005 T006, R507)", () => {
    stubLayout(1778, "var(--fam-list-card-w)");
    const layoutOf = vi.fn(() => ({ perRow: 2, mode: "pager" as const }));
    const { result } = renderHook(() =>
      useBoardGeometry(5, { widthToken: "--fam-list-card-w", layoutOf }),
    );

    act(() => {
      result.current.boardRef(document.createElement("div"));
    });

    expect(layoutOf).toHaveBeenCalledWith(
      expect.objectContaining({ referenceColumnWidth: PROBE_WIDTH, boardWidth: 1778, columnCount: 5 }),
    );
    expect(result.current.measured).toBe(true);
    expect(result.current.layout).toEqual({ perRow: 2, mode: "pager" });
  });
});
