import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import type { TimedSegment } from "@/lib/family/calendar/layout";
import type { Occurrence } from "@/lib/family/types";
import type { DragMetrics } from "@/lib/family/week-geometry";

import { DayColumn } from "../DayColumn";
import { EventBlock } from "../EventBlock";
import {
  DRAG_KEY_SHORTCUTS,
  DragSurfaceContext,
  useEventDrag,
  type DragHandle,
  type DragSurface,
} from "../useEventDrag";

/**
 * T058's block end of the drag, and T056's ghost in its column — the two
 * places the drag layer reaches the drawn grid, both through
 * `DragSurfaceContext`.
 *
 * What matters here is the contract, not the physics (R213): the block hands
 * the surface a handle describing itself, carries the keyboard shortcuts it
 * advertises and the `touch-action: none` that makes a press a drag, dims
 * itself while it is the one being dragged — and, with no surface in the
 * tree, renders exactly the read-only block US1 shipped.
 */

const MONDAY = "2026-09-07";
const TUESDAY = "2026-09-08";

const PIANO: Occurrence = {
  eventId: "evt-piano",
  occurrenceDate: MONDAY,
  isRepeating: true,
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

const SEGMENT: TimedSegment = {
  occurrence: PIANO,
  columnIndex: 1,
  date: MONDAY,
  startMinutes: 540,
  endMinutes: 600,
  continuesFromPrevious: false,
  continuesToNext: false,
  top: 540,
  height: 60,
  leftFraction: 0,
  widthFraction: 1,
};

function makeSurface(overrides: Partial<DragSurface> = {}) {
  const onPointerDown = vi.fn();
  const onKeyDown = vi.fn();
  const handles: DragHandle[] = [];
  const surface: DragSurface = {
    handleProps: (handle) => {
      handles.push(handle);
      return { onPointerDown, style: { touchAction: "none" } };
    },
    keyProps: () => ({ onKeyDown, "aria-keyshortcuts": DRAG_KEY_SHORTCUTS }),
    isDragSource: () => false,
    preview: null,
    sourceOccurrence: null,
    dateOfColumn: (columnIndex) => (columnIndex === 1 ? MONDAY : TUESDAY),
    layoutMetrics: { columnWidth: 100, pxPerMinute: 1, titleLineHeight: 20, blockPaddingY: 8 },
    ...overrides,
  };
  return { surface, onPointerDown, onKeyDown, handles };
}

function withSurface(surface: DragSurface, children: ReactNode) {
  return <DragSurfaceContext.Provider value={surface}>{children}</DragSurfaceContext.Provider>;
}

function renderBlock(surface: DragSurface | null) {
  const block = (
    <EventBlock segment={SEGMENT} fills={[]} dimmed={false} zone="America/Chicago" timeFormat="12h" />
  );
  return render(surface === null ? block : withSurface(surface, block));
}

describe("EventBlock under a drag surface (T058)", () => {
  it("describes itself to the drag layer as the occurrence in its own column", () => {
    const { surface, handles } = makeSurface();

    renderBlock(surface);

    expect(handles[0]).toMatchObject({
      eventId: PIANO.eventId,
      occurrenceDate: MONDAY,
      isRepeating: true,
      occurrence: PIANO,
      source: { allDay: false, columnIndex: 1, startMinutes: 540, endMinutes: 600 },
      mode: { kind: "move" },
    });
  });

  it("takes the press and the keys, and advertises the shortcuts (FR-263, R205)", () => {
    const { surface, onPointerDown, onKeyDown } = makeSurface();
    renderBlock(surface);
    const block = screen.getByRole("button", { name: /Piano/ });

    expect(block).toHaveAttribute("aria-keyshortcuts", DRAG_KEY_SHORTCUTS);
    expect(block).toHaveStyle({ touchAction: "none" });

    fireEvent.pointerDown(block);
    fireEvent.keyDown(block, { key: "ArrowDown", altKey: true });

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("dims itself in place while it is the block being dragged (R205)", () => {
    const { surface } = makeSurface({ isDragSource: () => true });

    renderBlock(surface);

    expect(screen.getByRole("button", { name: /Piano/ })).toHaveAttribute("data-dragging", "true");
  });

  it("is the read-only US1 block when no drag surface is in the tree", () => {
    renderBlock(null);
    const block = screen.getByRole("button", { name: /Piano/ });

    expect(block).not.toHaveAttribute("aria-keyshortcuts");
    expect(block).not.toHaveAttribute("data-dragging");
  });
});

describe("DayColumn's ghost (T056/T057)", () => {
  function renderColumn(surface: DragSurface, date: string) {
    return render(
      withSurface(
        surface,
        <DayColumn
          date={date}
          todayDate={null}
          zone="America/Chicago"
          timeFormat="12h"
          segments={[SEGMENT]}
          overflow={[]}
          colorsById={{}}
        />,
      ),
    );
  }

  it("draws the candidate in the column it lands in, hidden from assistive tech", () => {
    const { surface } = makeSurface({
      preview: { allDay: false, columnIndex: 2, startMinutes: 600, endMinutes: 660 },
      sourceOccurrence: PIANO,
      isDragSource: () => true,
    });

    const { container } = renderColumn(surface, TUESDAY);

    // The ghost is a copy: `EventBlock`'s own markup, inside an aria-hidden
    // wrapper, so the announced control stays the real block.
    const ghost = container.querySelector('[aria-hidden="true"][inert]');
    expect(ghost?.textContent).toContain("Piano");
    // And it is drawn solid, not dimmed as the source: the source is the
    // block still sitting in its own column.
    expect(ghost?.querySelector("button")).not.toHaveAttribute("data-dragging");
  });

  it("draws nothing in the columns the candidate is not in", () => {
    const { surface } = makeSurface({
      preview: { allDay: false, columnIndex: 2, startMinutes: 600, endMinutes: 660 },
      sourceOccurrence: PIANO,
    });

    const { container } = renderColumn(surface, MONDAY);

    expect(container.querySelector('[aria-hidden="true"][inert]')).toBeNull();
  });

  it("draws nothing for an all-day candidate — that conversion is the band's (FR-251)", () => {
    const { surface } = makeSurface({
      preview: { allDay: true, startColumnIndex: 2, endColumnIndex: 2 },
      sourceOccurrence: PIANO,
    });

    const { container } = renderColumn(surface, TUESDAY);

    expect(container.querySelector('[aria-hidden="true"][inert]')).toBeNull();
  });
});

/**
 * T057's last guarantee at the DOM level: a drag that ends over empty grid
 * must not also read as a tap on that slot. The create form has exactly two
 * doors (FR-254) and a finished gesture is neither of them.
 */
describe("a drag does not open the create form on the slot it ends over", () => {
  /** One px is one minute: the hour viewport spans screen y 200–800. */
  const METRICS: DragMetrics = {
    hourRowPx: 60,
    columnWidthPx: 100,
    columnCount: 2,
    gridLeftPx: 0,
    gridTopPx: 200,
    scrollTopPx: 0,
    bandTopPx: 120,
    bandHeightPx: 44,
    viewportHeightPx: 600,
  };

  function GridHarness({ onSlotTap }: { onSlotTap: (date: string, minutes: number) => void }) {
    const { surface, viewportRef } = useEventDrag({
      metrics: METRICS,
      columnDates: [MONDAY, TUESDAY],
      weekStart: MONDAY,
      occurrences: [PIANO],
      measureMetrics: () => METRICS,
    });
    return (
      <div ref={viewportRef}>
        <DragSurfaceContext.Provider value={surface}>
          <DayColumn
            date={MONDAY}
            todayDate={null}
            zone="America/Chicago"
            timeFormat="12h"
            segments={[SEGMENT]}
            overflow={[]}
            colorsById={{}}
            onSlotTap={onSlotTap}
          />
        </DragSurfaceContext.Provider>
      </div>
    );
  }

  function pointer(type: string, x: number, y: number): Event {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    Object.defineProperty(event, "pointerId", { value: 1 });
    return event;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("swallows the click a finished drag ends with (FR-254 against T050's tap)", () => {
    const onSlotTap = vi.fn();
    const { container } = render(<GridHarness onSlotTap={onSlotTap} />);
    const viewport = container.firstElementChild as HTMLElement;
    const cell = container.querySelector('[data-hour="10"]') as HTMLElement;
    const block = screen.getByRole("button", { name: /Piano/ });

    act(() => {
      fireEvent.pointerDown(block, {
        isPrimary: true,
        button: 0,
        pointerId: 1,
        clientX: 50,
        clientY: 740,
      });
    });
    act(() => {
      viewport.dispatchEvent(pointer("pointermove", 50, 800));
      vi.advanceTimersByTime(32);
    });
    act(() => {
      viewport.dispatchEvent(pointer("pointerup", 50, 800));
    });
    act(() => {
      fireEvent.click(cell, { clientX: 50, clientY: 800 });
    });

    expect(onSlotTap).not.toHaveBeenCalled();
  });

  it("still opens the form on a plain tap of empty grid (FR-255)", () => {
    const onSlotTap = vi.fn();
    const { container } = render(<GridHarness onSlotTap={onSlotTap} />);
    const cell = container.querySelector('[data-hour="10"]') as HTMLElement;

    act(() => {
      fireEvent.click(cell, { clientX: 50, clientY: 800 });
    });

    expect(onSlotTap).toHaveBeenCalledWith(MONDAY, 600);
  });
});
