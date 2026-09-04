import { act, renderHook, type RenderHookResult } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";

import { addDays } from "@/lib/family/calendar/dates";
import type { Occurrence } from "@/lib/family/types";
import type { DragMetrics } from "@/lib/family/week-geometry";

import {
  PAGE_EDGE_PX,
  PAGE_HOLD_MS,
  useEventDrag,
  type DragHandle,
  type EventDragController,
  type UseEventDragOptions,
} from "../useEventDrag";

/**
 * T055 — the pointer adapter over the pure drag modules (R205), tested at the
 * tier R213 assigns it: targeted jsdom with **injected** `DragMetrics`, since
 * jsdom lays nothing out and the geometry is an input by design. What the
 * planners and the reducer decide is proven in their own unit suites
 * (`week-geometry`, `drag-state`); what is proven here is the wiring — the
 * slop flip, the capture on the scroll container, the rAF loop's auto-scroll
 * and edge-hold paging, the abort paths, the vanished source, and the frame
 * rebase that carries a gesture across a week page.
 *
 * The injected ruler is deliberately 60 px per hour, so **one px is one
 * minute** and every y below reads as a wall time: the grid viewport spans
 * screen y 200–800 (00:00 at the top, scrolled to the very start), the
 * all-day band 120–164, and column i spans x 60 + 100i … 160 + 100i.
 */

const POINTER_ID = 7;

const METRICS: DragMetrics = {
  hourRowPx: 60,
  columnWidthPx: 100,
  columnCount: 7,
  gridLeftPx: 60,
  gridTopPx: 200,
  scrollTopPx: 0,
  bandTopPx: 120,
  bandHeightPx: 44,
  viewportHeightPx: 600,
};

const WEEK_START = "2026-09-06"; // a Sunday — the household's week start
const COLUMN_DATES = [0, 1, 2, 3, 4, 5, 6].map((day) => addDays(WEEK_START, day));
const MONDAY = COLUMN_DATES[1];
const TUESDAY = COLUMN_DATES[2];

/** 09:00–10:00 on Monday: column 1, wall minutes 540–600. */
const PIANO: Occurrence = {
  eventId: "evt-piano",
  occurrenceDate: MONDAY,
  isRepeating: false,
  summary: "Piano",
  description: null,
  location: null,
  categoryIds: [],
  times: {
    allDay: false,
    startsAt: "2026-09-07T14:00:00.000Z",
    endsAt: "2026-09-07T15:00:00.000Z",
  },
};

const MOVE_HANDLE: DragHandle = {
  eventId: PIANO.eventId,
  occurrenceDate: PIANO.occurrenceDate,
  isRepeating: false,
  source: { allDay: false, columnIndex: 1, startMinutes: 540, endMinutes: 600 },
  mode: { kind: "move" },
};

/** The block's own top edge — grabbing there keeps the grab offset at zero. */
const BLOCK_TOP_Y = 740;
const BLOCK_X = 210;

/** Inside the right-hand paging zone (R211), and over the last column. */
const RIGHT_EDGE_X =
  METRICS.gridLeftPx + METRICS.columnCount * METRICS.columnWidthPx - PAGE_EDGE_PX / 2;

interface Harness {
  node: HTMLElement;
  hook: RenderHookResult<EventDragController, UseEventDragOptions>;
  options: UseEventDragOptions;
  onPage: Mock;
  setPointerCapture: Mock;
  stopPropagation: Mock;
}

function pointerEvent(type: string, x: number, y: number): Event {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, "pointerId", { value: POINTER_ID });
  return event;
}

function mount(overrides: Partial<UseEventDragOptions> = {}): Harness {
  const node = document.createElement("div");
  document.body.appendChild(node);
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  node.setPointerCapture = setPointerCapture;
  node.releasePointerCapture = releasePointerCapture;

  const onPage = vi.fn();
  const options: UseEventDragOptions = {
    metrics: METRICS,
    columnDates: COLUMN_DATES,
    weekStart: WEEK_START,
    occurrences: [PIANO],
    onPage,
    // R213: the metrics are injected, and they track the node's own scrolling
    // so the auto-scroll loop's effect on the candidate is observable.
    measureMetrics: () => ({ ...METRICS, scrollTopPx: node.scrollTop }),
    ...overrides,
  };

  const hook = renderHook((props: UseEventDragOptions) => useEventDrag(props), {
    initialProps: options,
  });
  hook.result.current.viewportRef(node);
  return { node, hook, options, onPage, setPointerCapture, stopPropagation: vi.fn() };
}

function press(harness: Harness, handle: DragHandle, x: number, y: number): Mock {
  const stopPropagation = vi.fn();
  const event = {
    isPrimary: true,
    button: 0,
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
    stopPropagation,
  } as unknown as ReactPointerEvent<HTMLElement>;
  act(() => {
    harness.hook.result.current.handleProps(handle).onPointerDown(event);
  });
  return stopPropagation;
}

/** One rAF frame is 16 ms — the loop dispatches the stored point per frame. */
function frames(count: number): void {
  act(() => {
    vi.advanceTimersByTime(count * 16);
  });
}

function movePointer(harness: Harness, x: number, y: number, frameCount = 1): void {
  act(() => {
    harness.node.dispatchEvent(pointerEvent("pointermove", x, y));
  });
  frames(frameCount);
}

function releasePointer(harness: Harness, x = BLOCK_X, y = BLOCK_TOP_Y): void {
  act(() => {
    harness.node.dispatchEvent(pointerEvent("pointerup", x, y));
  });
}

/** Press the block's top-left, then drag past the slop to (x, y). */
function dragTo(harness: Harness, x: number, y: number, handle = MOVE_HANDLE): void {
  press(harness, handle, BLOCK_X, BLOCK_TOP_Y);
  movePointer(harness, x, y);
}

describe("useEventDrag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("arms on a press and becomes a drag only past the slop — no timed hold (FR-253)", () => {
    const harness = mount();

    press(harness, MOVE_HANDLE, BLOCK_X, BLOCK_TOP_Y);
    expect(harness.hook.result.current.state.kind).toBe("armed");
    expect(harness.hook.result.current.preview).toBeNull();

    // Four px of travel, and a whole second of frames: still not a drag.
    movePointer(harness, BLOCK_X + 4, BLOCK_TOP_Y + 2, 60);
    expect(harness.hook.result.current.isDragging).toBe(false);
    expect(harness.hook.result.current.preview).toBeNull();

    movePointer(harness, BLOCK_X + 10, BLOCK_TOP_Y + 8);
    expect(harness.hook.result.current.isDragging).toBe(true);
    expect(harness.hook.result.current.preview).not.toBeNull();
  });

  it("captures the pointer on the grid's scroll container, not on the block", () => {
    const harness = mount();

    press(harness, MOVE_HANDLE, BLOCK_X, BLOCK_TOP_Y);

    expect(harness.setPointerCapture).toHaveBeenCalledWith(POINTER_ID);
    // The container is where the moves arrive, so the gesture survives the
    // source block being refetched away underneath it.
    movePointer(harness, 320, 770);
    expect(harness.hook.result.current.isDragging).toBe(true);
  });

  it("keeps the surface partition: a block press never reaches the slice pager", () => {
    const harness = mount();

    const stopPropagation = press(harness, MOVE_HANDLE, BLOCK_X, BLOCK_TOP_Y);

    expect(stopPropagation).toHaveBeenCalled();
    expect(harness.hook.result.current.handleProps(MOVE_HANDLE).style).toEqual({
      touchAction: "none",
    });
  });

  it("plans a cross-day move on the 15-minute step, duration preserved", () => {
    const harness = mount();

    dragTo(harness, 320, 770);

    expect(harness.hook.result.current.preview).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 570,
      endMinutes: 630,
    });
    expect(harness.hook.result.current.dateOfColumn(2)).toBe(TUESDAY);
  });

  it("converts a drop in the all-day band into an all-day placement (FR-251)", () => {
    const harness = mount();

    dragTo(harness, 320, 140);

    expect(harness.hook.result.current.preview).toEqual({
      allDay: true,
      startColumnIndex: 2,
      endColumnIndex: 2,
    });
  });

  it("resizes only the grabbed edge (FR-245)", () => {
    const harness = mount();
    const handle: DragHandle = { ...MOVE_HANDLE, mode: { kind: "resize", edge: "end" } };

    press(harness, handle, BLOCK_X, 798);
    movePointer(harness, BLOCK_X, 770);

    expect(harness.hook.result.current.preview).toEqual({
      allDay: false,
      columnIndex: 1,
      startMinutes: 540,
      endMinutes: 570,
    });
  });

  it("Escape reverts the gesture and describes no write (FR-249)", () => {
    const harness = mount();
    dragTo(harness, 320, 770);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(harness.hook.result.current.state.kind).toBe("idle");
    expect(harness.hook.result.current.preview).toBeNull();
    expect(harness.hook.result.current.commitIntent).toBeNull();
  });

  it("pointercancel reverts the gesture too", () => {
    const harness = mount();
    dragTo(harness, 320, 770);

    act(() => {
      harness.node.dispatchEvent(pointerEvent("pointercancel", 320, 770));
    });

    expect(harness.hook.result.current.state.kind).toBe("idle");
    expect(harness.hook.result.current.commitIntent).toBeNull();
  });

  it("a drop back in the slot it started in asks nothing and writes nothing", () => {
    const harness = mount();
    dragTo(harness, BLOCK_X + 8, BLOCK_TOP_Y + 2);

    releasePointer(harness, BLOCK_X + 8, BLOCK_TOP_Y + 2);

    expect(harness.hook.result.current.state.kind).toBe("idle");
    expect(harness.hook.result.current.prompt).toBeNull();
  });

  it("asks for the punch-in on a one-off drop, the scope first on a repeat (FR-248/250)", () => {
    const oneOff = mount();
    dragTo(oneOff, 320, 770);
    releasePointer(oneOff, 320, 770);
    expect(oneOff.hook.result.current.prompt).toBe("punchIn");

    const repeat = mount();
    dragTo(repeat, 320, 770, { ...MOVE_HANDLE, isRepeating: true });
    releasePointer(repeat, 320, 770);
    expect(repeat.hook.result.current.prompt).toBe("scope");
  });

  it("auto-scrolls the hour viewport while the pointer hovers its bottom edge", () => {
    const harness = mount();

    dragTo(harness, 250, 790);
    const firstStart = placementStart(harness);
    frames(8);

    expect(harness.node.scrollTop).toBeGreaterThan(0);
    expect(placementStart(harness)).toBeGreaterThan(firstStart);
  });

  it("pages the week on an edge hold — after the dwell, never before (R211)", () => {
    const harness = mount();

    dragTo(harness, RIGHT_EDGE_X, 500);
    frames(Math.floor(PAGE_HOLD_MS / 16) - 4);
    expect(harness.onPage).not.toHaveBeenCalled();

    frames(8);
    expect(harness.onPage).toHaveBeenCalledWith(1);
  });

  it("ends the gesture when a refetch takes the source away (SOURCE_GONE)", () => {
    const harness = mount();
    dragTo(harness, 320, 770);

    act(() => {
      harness.hook.rerender({ ...harness.options, occurrences: [] });
    });

    expect(harness.hook.result.current.state.kind).toBe("idle");
    expect(harness.hook.result.current.preview).toBeNull();
  });

  it("carries the gesture across a week page and re-frames its columns", () => {
    const harness = mount();
    // Held right where it started: without a re-frame this drop is a no-op.
    dragTo(harness, BLOCK_X + 8, BLOCK_TOP_Y + 2);

    const nextWeek = addDays(WEEK_START, 7);
    act(() => {
      harness.hook.rerender({
        ...harness.options,
        weekStart: nextWeek,
        columnDates: [0, 1, 2, 3, 4, 5, 6].map((day) => addDays(nextWeek, day)),
      });
    });
    expect(harness.hook.result.current.isDragging).toBe(true);

    releasePointer(harness, BLOCK_X + 8, BLOCK_TOP_Y + 2);

    expect(harness.hook.result.current.prompt).toBe("punchIn");
    expect(harness.hook.result.current.dateOfColumn(1)).toBe(addDays(MONDAY, 7));
  });

  it("swallows the click a real drag ends with, and lets a tap's click through", () => {
    const harness = mount();
    const onClick = vi.fn();
    harness.node.addEventListener("click", onClick);

    dragTo(harness, 320, 770);
    releasePointer(harness, 320, 770);
    act(() => {
      harness.node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClick).not.toHaveBeenCalled();

    press(harness, MOVE_HANDLE, BLOCK_X, BLOCK_TOP_Y);
    releasePointer(harness);
    act(() => {
      harness.node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("reports the dragged occurrence so the grid can dim the source in place", () => {
    const harness = mount();
    dragTo(harness, 320, 770);

    expect(harness.hook.result.current.isDragSource(PIANO)).toBe(true);
    expect(
      harness.hook.result.current.isDragSource({ eventId: "other", occurrenceDate: MONDAY }),
    ).toBe(false);
  });
});

/** The candidate's start, or a failure — the preview must be a timed one here. */
function placementStart(harness: Harness): number {
  const preview = harness.hook.result.current.preview;
  if (preview === null || preview.allDay) throw new Error("expected a timed candidate");
  return preview.startMinutes;
}
