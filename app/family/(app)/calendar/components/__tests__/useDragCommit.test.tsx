import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";

import { updateEvent } from "@/lib/family/actions/events";
import { addDays, viewWindowOf } from "@/lib/family/calendar/dates";
import type { LayoutMetrics, TimedSegment } from "@/lib/family/calendar/layout";
import { fail } from "@/lib/family/errors";
import { familyKeys } from "@/lib/family/queries";
import type { Event, Occurrence } from "@/lib/family/types";
import type { GridMetrics } from "@/lib/family/week-geometry";

import {
  makeActor,
  makeContext,
  withFamily,
} from "../../../components/__tests__/family-test-utils";
import { GONE_MESSAGE } from "../useCalendarEditor";
import {
  dragKeyActionOf,
  dragUpdateOf,
  placementTimesOf,
  timedSourceOf,
  dragAnnouncementOf,
  useDragCommit,
  useEventDrag,
  type DragHandle,
  type UseEventDragOptions,
} from "../useEventDrag";

/**
 * T057 + T058 — the drop pipeline and the keyboard alternative.
 *
 * The pointer wiring is proven in `useEventDrag.test.ts`; what is proven here
 * is what happens AFTER a block is let go, and the keyboard path that reaches
 * the same reducer without a pointer at all:
 *
 * - the prompt order of FR-250 (scope first, punch-in second) and FR-248's
 *   "on drop, never on grab";
 * - FR-249 on every abandonment — a dismissed scope, a dismissed punch-in, a
 *   refusal mid-flight, Escape — each writing NOTHING;
 * - the patch `updateEvent` receives, including scope `all`'s rebase onto the
 *   series' own start (a drag is an edit with a gesture — contracts);
 * - R208/SC-206's pending overlay: the block stays drawn at its target from
 *   the drop until the invalidated week has actually been read back;
 * - FR-288's refusals (offline, already deleted) surfacing as messages;
 * - FR-263's Alt+Arrow / Alt+Shift+Arrow / Enter / Escape and the
 *   slot-semantic announcement each nudge makes.
 *
 * jsdom lays nothing out, so the keyboard path is also the honest way to
 * drive a whole drag here: it needs no metrics by design (R213).
 */

vi.mock("@/lib/family/actions/events", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

const updateEventMock = updateEvent as Mock;

const HOUSEHOLD = "household-1";
const ZONE = "America/Chicago";
const ANCHOR_DATE = "2026-09-06";
const COLUMN_DATES = [0, 1, 2, 3, 4, 5, 6].map((day) => addDays(ANCHOR_DATE, day));
/** The displayed window the harness renders — seven columns from the anchor. */
const WINDOW = viewWindowOf(ANCHOR_DATE, COLUMN_DATES.length, ZONE);
const MONDAY = COLUMN_DATES[1];
const TUESDAY = COLUMN_DATES[2];

const LAYOUT_METRICS: LayoutMetrics = {
  pxPerMinute: 1,
  columnWidth: 100,
  titleLineHeight: 20,
  blockPaddingY: 8,
};

/** 09:00–10:00 CDT on Monday: column 1, wall minutes 540–600. */
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

const PIANO_ROW: Event = {
  id: PIANO.eventId,
  householdId: HOUSEHOLD,
  summary: "Piano",
  description: null,
  location: null,
  times: PIANO.times,
  timezone: ZONE,
  rrule: null,
  countdownEnabled: false,
  categoryIds: [],
  exceptions: [],
  createdBy: null,
  updatedBy: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

/** The same slot, but one occurrence of a Monday series anchored a week earlier. */
const RECITAL: Occurrence = {
  ...PIANO,
  eventId: "evt-recital",
  isRepeating: true,
  summary: "Recital",
};

const RECITAL_ROW: Event = {
  ...PIANO_ROW,
  id: RECITAL.eventId,
  summary: "Recital",
  rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=MO",
  times: {
    allDay: false,
    startsAt: "2026-08-31T14:00:00.000Z",
    endsAt: "2026-08-31T15:00:00.000Z",
  },
};

function handleFor(occurrence: Occurrence): DragHandle {
  return {
    eventId: occurrence.eventId,
    occurrenceDate: occurrence.occurrenceDate,
    isRepeating: occurrence.isRepeating,
    occurrence,
    source: { allDay: false, columnIndex: 1, startMinutes: 540, endMinutes: 600 },
    mode: { kind: "move" },
  };
}

interface HarnessProps {
  handle: DragHandle;
  occurrences: readonly Occurrence[];
  refetch: () => Promise<Event[]>;
}

/**
 * The two hooks under test, wired the way `WeekView` wires them, plus the
 * week query whose refetch is R208's release signal.
 */
function Harness({ handle, occurrences, refetch }: HarnessProps) {
  const options: UseEventDragOptions = {
    metrics: null,
    layoutMetrics: LAYOUT_METRICS,
    columnDates: COLUMN_DATES,
    windowStart: WINDOW.startDate,
    occurrences,
  };
  const drag = useEventDrag(options);
  const commit = useDragCommit({
    prompt: drag.prompt,
    commitIntent: drag.commitIntent,
    dispatch: drag.dispatch,
    dateOfColumn: drag.dateOfColumn,
    sourceOccurrence: drag.sourceOccurrence,
    window: WINDOW,
    occurrences,
  });
  const announcement = dragAnnouncementOf(drag.state, {
    dateOfColumn: drag.dateOfColumn,
    timeFormat: "12h",
  });
  useQuery({ queryKey: familyKeys.week(HOUSEHOLD, WINDOW), queryFn: refetch });

  return (
    <div>
      <button type="button" {...drag.keyProps(handle)}>
        {handle.occurrence?.summary ?? "block"}
      </button>
      <output data-testid="preview">{JSON.stringify(drag.preview)}</output>
      <output data-testid="prompt">{drag.prompt ?? "none"}</output>
      <output data-testid="notice">{commit.notice ?? ""}</output>
      <output data-testid="announcement">{announcement}</output>
      <button type="button" onClick={() => drag.dispatch({ type: "SCOPE_CHOSEN", scope: "this" })}>
        choose scope
      </button>
      <button type="button" onClick={() => drag.dispatch({ type: "SCOPE_DISMISSED" })}>
        dismiss scope
      </button>
    </div>
  );
}

interface MountOptions {
  occurrence?: Occurrence;
  rows?: Event[];
  actorPunchedIn?: boolean;
  openPunchIn?: () => Promise<ReturnType<typeof makeActor> | null>;
  refetch?: () => Promise<Event[]>;
}

function mount(options: MountOptions = {}) {
  const occurrence = options.occurrence ?? PIANO;
  const rows = options.rows ?? [PIANO_ROW];
  const openPunchIn = vi.fn(options.openPunchIn ?? (async () => makeActor()));
  const refetch = vi.fn(options.refetch ?? (async () => rows));

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(familyKeys.week(HOUSEHOLD, WINDOW), rows);

  const context = makeContext({
    actor: options.actorPunchedIn === true ? makeActor() : null,
    openPunchIn,
  });

  render(
    <QueryClientProvider client={client}>
      {withFamily(
        context,
        <Harness handle={handleFor(occurrence)} occurrences={[occurrence]} refetch={refetch} />,
      )}
    </QueryClientProvider>,
  );

  return { openPunchIn, refetch, client };
}

function readOut(id: string): string {
  return screen.getByTestId(id).textContent ?? "";
}

async function pressKey(key: string, modifiers: { altKey?: boolean; shiftKey?: boolean } = {}) {
  await act(async () => {
    fireEvent.keyDown(screen.getByRole("button", { name: /piano|recital|block/i }), {
      key,
      altKey: modifiers.altKey ?? false,
      shiftKey: modifiers.shiftKey ?? false,
    });
  });
}

/** A keyboard drag one 15-minute step later, then the commit keypress. */
async function nudgeAndDrop() {
  await pressKey("ArrowDown", { altKey: true });
  await pressKey("Enter");
}

async function press(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

afterEach(() => {
  updateEventMock.mockReset();
});

describe("the drag drop pipeline (T057)", () => {
  it("asks the punch-in on the drop and writes the planned patch (FR-248)", async () => {
    updateEventMock.mockResolvedValue({ ok: true, data: { eventId: PIANO.eventId, splitEventId: null } });
    const { openPunchIn } = mount();

    await pressKey("ArrowDown", { altKey: true });
    // FR-248: the grab and the nudges demand nothing.
    expect(openPunchIn).not.toHaveBeenCalled();
    expect(updateEventMock).not.toHaveBeenCalled();

    await pressKey("Enter");

    expect(openPunchIn).toHaveBeenCalledTimes(1);
    expect(updateEventMock).toHaveBeenCalledWith({
      id: PIANO.eventId,
      patch: {
        allDay: false,
        startsAt: "2026-09-07T14:15:00.000Z",
        endsAt: "2026-09-07T15:15:00.000Z",
      },
    });
  });

  it("never asks a punched-in person again (FR-248, SC-206)", async () => {
    updateEventMock.mockResolvedValue({ ok: true, data: { eventId: PIANO.eventId, splitEventId: null } });
    const { openPunchIn } = mount({ actorPunchedIn: true });

    await nudgeAndDrop();

    expect(openPunchIn).not.toHaveBeenCalled();
    expect(updateEventMock).toHaveBeenCalledTimes(1);
  });

  it("asks the scope question FIRST on a repeat, and writes only after it (FR-250)", async () => {
    updateEventMock.mockResolvedValue({ ok: true, data: { eventId: RECITAL.eventId, splitEventId: null } });
    const { openPunchIn } = mount({
      occurrence: RECITAL,
      rows: [RECITAL_ROW],
      actorPunchedIn: true,
    });

    await nudgeAndDrop();
    expect(readOut("prompt")).toBe("scope");
    expect(updateEventMock).not.toHaveBeenCalled();

    await press(/choose scope/);

    expect(openPunchIn).not.toHaveBeenCalled();
    expect(updateEventMock).toHaveBeenCalledWith({
      id: RECITAL.eventId,
      patch: {
        allDay: false,
        startsAt: "2026-09-07T14:15:00.000Z",
        endsAt: "2026-09-07T15:15:00.000Z",
      },
      scope: "this",
      occurrenceDate: MONDAY,
    });
  });

  it("writes nothing when the scope question is dismissed (FR-249)", async () => {
    const { openPunchIn } = mount({ occurrence: RECITAL, rows: [RECITAL_ROW] });

    await nudgeAndDrop();
    await press(/dismiss scope/);

    expect(readOut("prompt")).toBe("none");
    expect(readOut("preview")).toBe("null");
    expect(openPunchIn).not.toHaveBeenCalled();
    expect(updateEventMock).not.toHaveBeenCalled();
  });

  it("writes nothing when the punch-in is dismissed, releasing the block (FR-249)", async () => {
    mount({ openPunchIn: async () => null });

    await nudgeAndDrop();

    expect(updateEventMock).not.toHaveBeenCalled();
    expect(readOut("preview")).toBe("null");
    expect(readOut("notice")).toBe("");
  });

  it("holds the block at its target until the refetch lands, then releases it (R208, SC-206)", async () => {
    updateEventMock.mockResolvedValue({ ok: true, data: { eventId: PIANO.eventId, splitEventId: null } });
    let releaseRefetch: (() => void) | null = null;
    const refetch = () =>
      new Promise<Event[]>((resolve) => {
        releaseRefetch = () => resolve([PIANO_ROW]);
      });
    mount({ actorPunchedIn: true, refetch });

    await nudgeAndDrop();

    // The write has answered, but the week has not been read back yet: the
    // block is still drawn at its target — in flight, never "saved".
    expect(readOut("preview")).toContain("555");
    expect(releaseRefetch).not.toBeNull();

    await act(async () => {
      releaseRefetch?.();
    });

    expect(readOut("preview")).toBe("null");
  });

  it("surfaces an offline refusal and writes nothing (FR-288)", async () => {
    updateEventMock.mockResolvedValue(fail("UNAVAILABLE"));
    mount({ actorPunchedIn: true });

    await nudgeAndDrop();

    expect(readOut("notice")).toBe("Can't reach the house right now. Try again in a moment.");
    expect(readOut("preview")).toBe("null");
  });

  it("says so when the event was already deleted elsewhere (FR-288)", async () => {
    updateEventMock.mockResolvedValue(fail("NOT_FOUND"));
    mount({ actorPunchedIn: true });

    await nudgeAndDrop();

    expect(readOut("notice")).toBe(GONE_MESSAGE);
  });

  it("stays silent when the write is refused for want of an actor (FR-249/275)", async () => {
    updateEventMock.mockResolvedValue(fail("NO_ACTOR"));
    mount({ actorPunchedIn: true });

    await nudgeAndDrop();

    expect(readOut("notice")).toBe("");
    expect(readOut("preview")).toBe("null");
  });
});

describe("the keyboard alternative (T058)", () => {
  it("moves by one snap step per Alt+Arrow, and by a whole day sideways (FR-263)", async () => {
    mount({ actorPunchedIn: true });

    await pressKey("ArrowDown", { altKey: true });
    expect(JSON.parse(readOut("preview"))).toEqual({
      allDay: false,
      columnIndex: 1,
      startMinutes: 555,
      endMinutes: 615,
    });

    await pressKey("ArrowRight", { altKey: true });
    expect(JSON.parse(readOut("preview"))).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 555,
      endMinutes: 615,
    });
  });

  it("resizes one edge per Alt+Shift+Arrow, duration changing and start not (FR-245)", async () => {
    mount({ actorPunchedIn: true });

    await pressKey("ArrowDown", { altKey: true, shiftKey: true });

    expect(JSON.parse(readOut("preview"))).toEqual({
      allDay: false,
      columnIndex: 1,
      startMinutes: 540,
      endMinutes: 615,
    });
  });

  it("cancels on Escape with nothing written (FR-249)", async () => {
    mount({ actorPunchedIn: true });

    await pressKey("ArrowDown", { altKey: true });
    await pressKey("Escape");

    expect(readOut("preview")).toBe("null");
    expect(readOut("prompt")).toBe("none");
    expect(updateEventMock).not.toHaveBeenCalled();
    // FR-249: nothing was written and the block never left its place, so the
    // live region has nothing to report.
    expect(readOut("announcement")).toBe("");
  });

  it("announces the slot each nudge lands in (FR-263)", async () => {
    mount({ actorPunchedIn: true });

    await pressKey("ArrowRight", { altKey: true });

    expect(readOut("announcement")).toBe("Moving to Tuesday, September 8, 9:00 AM – 10:00 AM");
  });

  it("ignores a plain arrow, so the grid still scrolls", async () => {
    mount({ actorPunchedIn: true });

    await pressKey("ArrowDown");

    expect(readOut("preview")).toBe("null");
  });
});

describe("dragKeyActionOf", () => {
  it("maps Alt+Arrow to a move and Alt+Shift+Arrow to the matching edge", () => {
    expect(dragKeyActionOf({ key: "ArrowUp", altKey: true, shiftKey: false })).toEqual({
      type: "KEY_MOVE",
      days: 0,
      steps: -1,
    });
    expect(dragKeyActionOf({ key: "ArrowLeft", altKey: true, shiftKey: false })).toEqual({
      type: "KEY_MOVE",
      days: -1,
      steps: 0,
    });
    expect(dragKeyActionOf({ key: "ArrowUp", altKey: true, shiftKey: true })).toEqual({
      type: "KEY_RESIZE",
      edge: "end",
      steps: -1,
    });
    expect(dragKeyActionOf({ key: "ArrowRight", altKey: true, shiftKey: true })).toEqual({
      type: "KEY_RESIZE",
      edge: "start",
      steps: 1,
    });
  });

  it("maps Enter to the drop and Escape to the cancel, and nothing else at all", () => {
    expect(dragKeyActionOf({ key: "Enter", altKey: false, shiftKey: false })).toEqual({
      type: "RELEASE",
    });
    expect(dragKeyActionOf({ key: "Escape", altKey: false, shiftKey: false })).toEqual({
      type: "ESCAPE",
    });
    expect(dragKeyActionOf({ key: "ArrowDown", altKey: false, shiftKey: false })).toBeNull();
    expect(dragKeyActionOf({ key: "a", altKey: true, shiftKey: false })).toBeNull();
  });
});

describe("placementTimesOf", () => {
  const dateOfColumn = (columnIndex: number) => COLUMN_DATES[columnIndex];

  it("reads a timed candidate's wall minutes in the household zone (FR-284)", () => {
    expect(
      placementTimesOf(
        { allDay: false, columnIndex: 2, startMinutes: 555, endMinutes: 615 },
        dateOfColumn,
        ZONE,
      ),
    ).toEqual({
      allDay: false,
      startsAt: "2026-09-08T14:15:00.000Z",
      endsAt: "2026-09-08T15:15:00.000Z",
    });
  });

  it("carries a candidate past midnight into the next day (FR-217)", () => {
    expect(
      placementTimesOf(
        { allDay: false, columnIndex: 1, startMinutes: 1380, endMinutes: 1500 },
        dateOfColumn,
        ZONE,
      ),
    ).toEqual({
      allDay: false,
      startsAt: "2026-09-08T04:00:00.000Z",
      endsAt: "2026-09-08T06:00:00.000Z",
    });
  });

  it("turns an all-day candidate into its inclusive date pair (FR-225/251)", () => {
    expect(
      placementTimesOf(
        { allDay: true, startColumnIndex: 2, endColumnIndex: 3 },
        dateOfColumn,
        ZONE,
      ),
    ).toEqual({ allDay: true, startDate: TUESDAY, endDate: COLUMN_DATES[3] });
  });
});

describe("dragUpdateOf", () => {
  const dateOfColumn = (columnIndex: number) => COLUMN_DATES[columnIndex];

  it("is a bare times patch on a one-off — no scope at all (FR-238)", () => {
    expect(
      dragUpdateOf(
        {
          eventId: PIANO.eventId,
          occurrenceDate: MONDAY,
          candidate: { allDay: false, columnIndex: 2, startMinutes: 540, endMinutes: 600 },
          scope: null,
        },
        { occurrence: PIANO, event: PIANO_ROW },
        ZONE,
        dateOfColumn,
      ),
    ).toEqual({
      id: PIANO.eventId,
      patch: {
        allDay: false,
        startsAt: "2026-09-08T14:00:00.000Z",
        endsAt: "2026-09-08T15:00:00.000Z",
      },
    });
  });

  it("re-anchors a scope-`all` time change onto the series' own start", () => {
    expect(
      dragUpdateOf(
        {
          eventId: RECITAL.eventId,
          occurrenceDate: MONDAY,
          candidate: { allDay: false, columnIndex: 2, startMinutes: 555, endMinutes: 615 },
          scope: "all",
        },
        { occurrence: RECITAL, event: RECITAL_ROW },
        ZONE,
        dateOfColumn,
      ),
    ).toEqual({
      id: RECITAL.eventId,
      // The whole series moves one day later and fifteen minutes on, from its
      // own first occurrence — not restarting at the one that was dragged.
      patch: {
        allDay: false,
        startsAt: "2026-09-01T14:15:00.000Z",
        endsAt: "2026-09-01T15:15:00.000Z",
      },
      scope: "all",
    });
  });

  it("carries the occurrence's key at the per-occurrence scopes (R204)", () => {
    const update = dragUpdateOf(
      {
        eventId: RECITAL.eventId,
        occurrenceDate: MONDAY,
        candidate: { allDay: true, startColumnIndex: 1, endColumnIndex: 1 },
        scope: "this_and_future",
      },
      { occurrence: RECITAL, event: RECITAL_ROW },
      ZONE,
      dateOfColumn,
    );

    expect(update).toEqual({
      id: RECITAL.eventId,
      // FR-251: dropped in the band, the clock times are discarded.
      patch: { allDay: true, startDate: MONDAY, endDate: MONDAY },
      scope: "this_and_future",
      occurrenceDate: MONDAY,
    });
  });

  it("is nothing at all when the block came back to the times it had", () => {
    expect(
      dragUpdateOf(
        {
          eventId: PIANO.eventId,
          occurrenceDate: MONDAY,
          candidate: { allDay: false, columnIndex: 1, startMinutes: 540, endMinutes: 600 },
          scope: null,
        },
        { occurrence: PIANO, event: PIANO_ROW },
        ZONE,
        dateOfColumn,
      ),
    ).toBeNull();
  });
});

describe("timedSourceOf", () => {
  /** 22:00 Monday → 02:00 Tuesday CDT: one event, two drawn segments (FR-217). */
  const crosser: Occurrence = {
    ...PIANO,
    times: {
      allDay: false,
      startsAt: "2026-09-08T03:00:00.000Z",
      endsAt: "2026-09-08T07:00:00.000Z",
    },
  };

  function segmentOf(overrides: Partial<TimedSegment>): TimedSegment {
    return {
      occurrence: crosser,
      columnIndex: 1,
      date: MONDAY,
      startMinutes: 1320,
      endMinutes: 1440,
      continuesFromPrevious: false,
      continuesToNext: true,
      top: 0,
      height: 44,
      leftFraction: 0,
      widthFraction: 1,
      ...overrides,
    };
  }

  it("reads the TRUE range in the grabbed column's frame (FR-217/247)", () => {
    expect(timedSourceOf(segmentOf({}))).toEqual({
      allDay: false,
      columnIndex: 1,
      startMinutes: 1320,
      endMinutes: 1560,
    });

    expect(
      timedSourceOf(
        segmentOf({
          columnIndex: 2,
          date: TUESDAY,
          startMinutes: 0,
          endMinutes: 120,
          continuesFromPrevious: true,
          continuesToNext: false,
        }),
      ),
    ).toEqual({ allDay: false, columnIndex: 2, startMinutes: -120, endMinutes: 120 });
  });

  it("takes a plain block's own drawn range", () => {
    expect(
      timedSourceOf(
        segmentOf({
          occurrence: PIANO,
          startMinutes: 540,
          endMinutes: 600,
          continuesToNext: false,
        }),
      ),
    ).toEqual({ allDay: false, columnIndex: 1, startMinutes: 540, endMinutes: 600 });
  });
});

/**
 * The live measurement, without the injection seam every other drag test
 * uses: `measureMetrics` exists for jsdom's benefit (R213), but the code the
 * tablet actually runs reads the mounted nodes, and that path deserves to be
 * exercised rather than mocked away.
 */
describe("the drag's own measurement of the mounted grid", () => {
  const GRID: GridMetrics = {
    hourRowPx: 60,
    columnWidthPx: 100,
    columnCount: 7,
    gridLeftPx: 60,
    gridTopPx: 200,
    scrollTopPx: 0,
  };

  /** A node that answers like a laid-out element: jsdom measures everything as 0. */
  function measuredNode(top: number, height: number): HTMLElement {
    const node = document.createElement("div");
    const rect: DOMRect = {
      top,
      height,
      bottom: top + height,
      left: 0,
      right: 700,
      width: 700,
      x: 0,
      y: top,
      toJSON: () => ({}),
    };
    Object.defineProperty(node, "clientHeight", { value: height, configurable: true });
    node.getBoundingClientRect = () => rect;
    document.body.appendChild(node);
    return node;
  }

  function mountLive(options: { metrics: GridMetrics | null; band: boolean; height: number }) {
    const viewport = measuredNode(GRID.gridTopPx, options.height);
    const hook = renderHook(() =>
      useEventDrag({
        metrics: options.metrics,
        columnDates: COLUMN_DATES,
        windowStart: WINDOW.startDate,
        occurrences: [PIANO],
      }),
    );
    hook.result.current.viewportRef(viewport);
    if (options.band) hook.result.current.bandRef(measuredNode(120, 44));
    return hook;
  }

  function pressBlock(hook: ReturnType<typeof mountLive>, y: number): void {
    const event = {
      isPrimary: true,
      button: 0,
      pointerId: 3,
      clientX: 210,
      clientY: y,
      stopPropagation: () => {},
    } as unknown as ReactPointerEvent<HTMLElement>;
    act(() => {
      hook.result.current.handleProps(handleFor(PIANO)).onPointerDown(event);
    });
  }

  it("arms a gesture from the measured viewport and band", () => {
    const hook = mountLive({ metrics: GRID, band: true, height: 600 });

    pressBlock(hook, 740);

    expect(hook.result.current.state.kind).toBe("armed");
  });

  it("arms one without a band attached — the grid alone is enough", () => {
    const hook = mountLive({ metrics: GRID, band: false, height: 600 });

    pressBlock(hook, 740);

    expect(hook.result.current.state.kind).toBe("armed");
  });

  it("refuses to start before the grid has been measured at all", () => {
    const unmeasured = mountLive({ metrics: null, band: true, height: 600 });
    pressBlock(unmeasured, 740);
    expect(unmeasured.result.current.state.kind).toBe("idle");

    // Mounted but laid out to nothing (a hidden tab): still not measurable.
    const collapsed = mountLive({ metrics: GRID, band: true, height: 0 });
    pressBlock(collapsed, 740);
    expect(collapsed.result.current.state.kind).toBe("idle");
  });
});
