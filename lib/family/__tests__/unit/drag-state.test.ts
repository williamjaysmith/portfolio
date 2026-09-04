import { describe, expect, it } from "vitest";

import {
  DRAG_SLOP_PX,
  IDLE_DRAG_STATE,
  commitIntentOf,
  dragReducer,
  previewOf,
  promptOf,
  type DragAction,
  type DragGesture,
  type DragState,
} from "@/lib/family/drag-state";
import {
  minutesToViewportY,
  type AllDayPlacement,
  type DragMetrics,
  type Point,
  type TimedPlacement,
} from "@/lib/family/week-geometry";

/**
 * T054 — every transition of the drag reducer (R205), including every path
 * that ends the gesture without writing anything (FR-249).
 *
 * The reducer is the whole of the drag's decision-making: it owns arming by
 * distance (FR-253), the candidate the planners produce, the order of the
 * two prompts (FR-250: scope first, punch-in second, FR-248: on drop, not on
 * grab), and the single moment a commit intent exists at all. Pointer and
 * keyboard run the SAME transitions.
 *
 * `commitIntentOf(state)` is what the adapter calls `updateEvent` from, so
 * "wrote nothing" is asserted directly: it must be `null` after every cancel.
 */

/** The reference grid, scrolled so 09:00 sits at the hour viewport's top. */
const METRICS: DragMetrics = {
  hourRowPx: 195,
  columnWidthPx: 337,
  columnCount: 5,
  gridLeftPx: 219,
  gridTopPx: 311,
  scrollTopPx: 1755,
  bandTopPx: 200,
  bandHeightPx: 88,
  viewportHeightPx: 700,
};

/** Mid-column, at a wall minute — the point a pointer would be at. */
function pointAt(columnIndex: number, minutes: number): Point {
  return { x: 219 + columnIndex * 337 + 168, y: minutesToViewportY(METRICS, minutes) };
}

/** Mid-band, in a day column — a drop into the all-day band. */
function bandPointAt(columnIndex: number): Point {
  return { x: 219 + columnIndex * 337 + 168, y: 244 };
}

/** The hour rail: no slot, at any height (FR-249's invalid drop). */
const RAIL = { x: 40, y: 500 };

const TIMED: TimedPlacement = {
  allDay: false,
  columnIndex: 2,
  startMinutes: 540,
  endMinutes: 630,
};

const SPANNING: AllDayPlacement = { allDay: true, startColumnIndex: 1, endColumnIndex: 3 };

/** Where a press lands on the block: mid-block, 09:30 in its own column. */
const ORIGIN = pointAt(2, 570);

function gestureOf(overrides: Partial<DragGesture> = {}): DragGesture {
  return {
    eventId: "e1",
    occurrenceDate: "2026-09-16",
    isRepeating: false,
    mode: { kind: "move" },
    source: TIMED,
    grab: { offsetMinutes: 0, offsetDays: 0 },
    ...overrides,
  };
}

/** Run a script of actions from idle (or from a given state). */
function run(actions: DragAction[], from: DragState = IDLE_DRAG_STATE): DragState {
  return actions.reduce(dragReducer, from);
}

const press = (overrides: Partial<DragGesture> = {}): DragAction => ({
  type: "PRESS",
  gesture: gestureOf(overrides),
  point: ORIGIN,
});

const moveTo = (point: Point): DragAction => ({ type: "POINTER_MOVE", point, metrics: METRICS });

/** Press, then move far enough to be dragging, over the given point. */
function draggingOver(point: Point, overrides: Partial<DragGesture> = {}): DragState {
  return run([press(overrides), moveTo(point)]);
}

/** Every action, so a state's "ignores the rest" can be asserted as a set. */
const EVERY_ACTION: DragAction[] = [
  moveTo(pointAt(4, 540)),
  { type: "RELEASE" },
  { type: "KEY_MOVE", days: 1, steps: 1 },
  { type: "KEY_RESIZE", edge: "end", steps: 1 },
  { type: "SCOPE_CHOSEN", scope: "this" },
  { type: "SCOPE_DISMISSED" },
  { type: "PUNCH_IN_DISMISSED" },
  { type: "PUNCH_IN_REFUSED" },
  { type: "COMMIT" },
  { type: "COMMIT_SETTLED" },
  { type: "COMMIT_FAILED" },
  { type: "ESCAPE" },
  { type: "CANCEL" },
  { type: "SOURCE_GONE" },
];

describe("idle — nothing is happening", () => {
  it("starts idle, with no preview, no prompt and no intent", () => {
    expect(IDLE_DRAG_STATE).toEqual({ kind: "idle" });
    expect(previewOf(IDLE_DRAG_STATE)).toBeNull();
    expect(promptOf(IDLE_DRAG_STATE)).toBeNull();
    expect(commitIntentOf(IDLE_DRAG_STATE)).toBeNull();
  });

  it("ignores every action but a press", () => {
    for (const action of EVERY_ACTION) {
      expect(dragReducer(IDLE_DRAG_STATE, action)).toBe(IDLE_DRAG_STATE);
    }
  });

  it("arms on a press, and asks nobody to punch in yet (FR-248)", () => {
    const state = dragReducer(IDLE_DRAG_STATE, press());
    expect(state).toEqual({ kind: "armed", gesture: gestureOf(), origin: ORIGIN });
    expect(promptOf(state)).toBeNull();
    expect(commitIntentOf(state)).toBeNull();
    // Nothing is previewed until the gesture is really a drag.
    expect(previewOf(state)).toBeNull();
  });

  it("does not mutate the state it was given", () => {
    const state: DragState = IDLE_DRAG_STATE;
    dragReducer(state, press());
    expect(state).toEqual({ kind: "idle" });
  });
});

describe("armed → dragging — distance, never a hold (FR-253)", () => {
  it("stays armed under the slop, however many moves arrive", () => {
    expect(DRAG_SLOP_PX).toBe(8);
    const nudge = moveTo({ x: ORIGIN.x + 5, y: ORIGIN.y + 5 }); // 7.07 px
    let state = dragReducer(IDLE_DRAG_STATE, press());
    const armed = state;
    for (let repeat = 0; repeat < 12; repeat += 1) state = dragReducer(state, nudge);
    // No number of moves and no passage of time arms a drag — only distance.
    expect(state).toBe(armed);
    expect(state.kind).toBe("armed");
  });

  it("begins dragging at exactly the slop distance, in either axis", () => {
    for (const delta of [
      { x: DRAG_SLOP_PX, y: 0 },
      { x: 0, y: DRAG_SLOP_PX },
      { x: -6, y: -6 },
    ]) {
      const state = run([press(), moveTo({ x: ORIGIN.x + delta.x, y: ORIGIN.y + delta.y })]);
      expect(state.kind).toBe("dragging");
    }
  });

  it("carries the first candidate the planners produce", () => {
    const state = run([press(), moveTo({ x: ORIGIN.x + DRAG_SLOP_PX, y: ORIGIN.y })]);
    expect(previewOf(state)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 570,
      endMinutes: 660,
    });
    expect(commitIntentOf(state)).toBeNull();
  });

  it("releases as a tap, writing nothing (the tap belongs to details)", () => {
    const state = run([press(), { type: "RELEASE" }]);
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(commitIntentOf(state)).toBeNull();
  });

  it("cancels on Escape, on pointercancel, and when the source is refetched away", () => {
    for (const type of ["ESCAPE", "CANCEL", "SOURCE_GONE"] as const) {
      const state = run([press(), { type }]);
      expect(state).toBe(IDLE_DRAG_STATE);
      expect(commitIntentOf(state)).toBeNull();
    }
  });
});

describe("dragging — the candidate follows the pointer", () => {
  it("moves the block to another day, keeping its duration (FR-244/247)", () => {
    const state = draggingOver(pointAt(4, 720));
    expect(previewOf(state)).toEqual({
      allDay: false,
      columnIndex: 4,
      startMinutes: 720,
      endMinutes: 810,
    });
  });

  it("resizes only the dragged edge when the gesture grabbed one (FR-245)", () => {
    const state = draggingOver(pointAt(2, 720), { mode: { kind: "resize", edge: "end" } });
    expect(previewOf(state)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 540,
      endMinutes: 720,
    });
  });

  it("converts between grid and band as the pointer crosses (FR-251)", () => {
    expect(previewOf(draggingOver(bandPointAt(3)))).toEqual({
      allDay: true,
      startColumnIndex: 3,
      endColumnIndex: 3,
    });
    expect(previewOf(draggingOver(pointAt(0, 720), { source: SPANNING }))).toEqual({
      allDay: false,
      columnIndex: 0,
      startMinutes: 720,
      endMinutes: 780,
    });
  });

  it("has no candidate over anything that is not a slot", () => {
    const state = draggingOver(RAIL);
    expect(state.kind).toBe("dragging");
    expect(previewOf(state)).toBeNull();
  });

  it("cannot resize an all-day bar — the band has no edges (FR-245)", () => {
    const state = draggingOver(pointAt(2, 720), {
      source: SPANNING,
      mode: { kind: "resize", edge: "end" },
    });
    expect(state.kind).toBe("dragging");
    expect(previewOf(state)).toBeNull();
  });

  it("re-plans from the ORIGINAL placement on every move, never from the last one", () => {
    const state = run([press(), moveTo(pointAt(4, 720)), moveTo(pointAt(3, 600))]);
    expect(previewOf(state)).toEqual({
      allDay: false,
      columnIndex: 3,
      startMinutes: 600,
      endMinutes: 690,
    });
  });

  it("holds its identity while the pointer stays in the slot it is in", () => {
    const state = draggingOver(pointAt(4, 720));
    // A different pixel in the same 15-minute slot is not a new candidate.
    const jitter = pointAt(4, 720);
    expect(dragReducer(state, moveTo({ x: jitter.x + 3, y: jitter.y + 2 }))).toBe(state);
    // And two moves over the rail in a row leave one candidate-less state.
    const off = dragReducer(state, moveTo(RAIL));
    expect(previewOf(off)).toBeNull();
    expect(dragReducer(off, moveTo({ x: RAIL.x, y: RAIL.y + 20 }))).toBe(off);
  });

  it("drops nothing on an invalid target (FR-249)", () => {
    const state = run([press(), moveTo(RAIL), { type: "RELEASE" }]);
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(promptOf(state)).toBeNull();
    expect(commitIntentOf(state)).toBeNull();
  });

  it("drops nothing when the block came back to where it started", () => {
    const state = run([
      press(),
      moveTo(pointAt(4, 720)),
      moveTo(pointAt(2, 540)),
      { type: "RELEASE" },
    ]);
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(promptOf(state)).toBeNull();
    expect(commitIntentOf(state)).toBeNull();
  });

  it("cancels on Escape, on pointercancel, and on SOURCE_GONE, writing nothing (FR-249)", () => {
    for (const type of ["ESCAPE", "CANCEL", "SOURCE_GONE"] as const) {
      const state = run([press(), moveTo(pointAt(4, 720)), { type }]);
      expect(state).toBe(IDLE_DRAG_STATE);
      expect(commitIntentOf(state)).toBeNull();
    }
  });

  it("ignores a prompt's answers — no prompt is up yet (FR-248)", () => {
    const dragging = draggingOver(pointAt(4, 720));
    for (const action of [
      { type: "SCOPE_CHOSEN", scope: "all" } as const,
      { type: "SCOPE_DISMISSED" } as const,
      { type: "PUNCH_IN_DISMISSED" } as const,
      { type: "PUNCH_IN_REFUSED" } as const,
      { type: "COMMIT" } as const,
      { type: "COMMIT_SETTLED" } as const,
      { type: "COMMIT_FAILED" } as const,
    ]) {
      expect(dragReducer(dragging, action)).toBe(dragging);
    }
  });

  it("restarts on a fresh press, so a lost pointerup cannot strand the grid", () => {
    const state = dragReducer(draggingOver(pointAt(4, 720)), press({ eventId: "e2" }));
    expect(state).toEqual({ kind: "armed", gesture: gestureOf({ eventId: "e2" }), origin: ORIGIN });
  });
});

describe("dropping a one-off — punch-in only (FR-238/248)", () => {
  const dropped = run([press(), moveTo(pointAt(4, 720)), { type: "RELEASE" }]);

  it("asks who is here, and never asks the scope question", () => {
    expect(dropped.kind).toBe("confirming");
    expect(promptOf(dropped)).toBe("punchIn");
    expect(commitIntentOf(dropped)).toBeNull();
  });

  it("holds the dropped block at its target while it asks (R208)", () => {
    expect(previewOf(dropped)).toEqual({
      allDay: false,
      columnIndex: 4,
      startMinutes: 720,
      endMinutes: 810,
    });
  });

  it("ignores a scope answer it never asked for", () => {
    expect(dragReducer(dropped, { type: "SCOPE_CHOSEN", scope: "all" })).toBe(dropped);
  });

  it("commits with no scope at all — a one-off takes none", () => {
    const state = dragReducer(dropped, { type: "COMMIT" });
    expect(state.kind).toBe("committing");
    expect(commitIntentOf(state)).toEqual({
      eventId: "e1",
      occurrenceDate: "2026-09-16",
      candidate: { allDay: false, columnIndex: 4, startMinutes: 720, endMinutes: 810 },
      scope: null,
    });
  });
});

describe("dropping one occurrence of a repeat — scope first (FR-250)", () => {
  const dropped = run([
    press({ isRepeating: true }),
    moveTo(pointAt(4, 720)),
    { type: "RELEASE" },
  ]);

  it("asks the scope question before the punch-in, and never commits silently", () => {
    expect(promptOf(dropped)).toBe("scope");
    expect(commitIntentOf(dropped)).toBeNull();

    const chosen = dragReducer(dropped, { type: "SCOPE_CHOSEN", scope: "this_and_future" });
    expect(promptOf(chosen)).toBe("punchIn");
    expect(commitIntentOf(chosen)).toBeNull();

    const committing = dragReducer(chosen, { type: "COMMIT" });
    expect(commitIntentOf(committing)).toEqual({
      eventId: "e1",
      occurrenceDate: "2026-09-16",
      candidate: { allDay: false, columnIndex: 4, startMinutes: 720, endMinutes: 810 },
      scope: "this_and_future",
    });
  });

  it("refuses to commit while the scope question is still up (FR-250)", () => {
    expect(dragReducer(dropped, { type: "COMMIT" })).toBe(dropped);
    expect(commitIntentOf(dragReducer(dropped, { type: "COMMIT" }))).toBeNull();
  });

  it("refuses to commit a repeat whose scope is somehow unanswered", () => {
    // A state that skipped the question cannot exist through the reducer;
    // built by hand, it still cannot produce a write (FR-250 is structural).
    const unanswered: DragState = {
      kind: "confirming",
      gesture: gestureOf({ isRepeating: true }),
      candidate: { allDay: false, columnIndex: 4, startMinutes: 720, endMinutes: 810 },
      step: "punchIn",
      scope: null,
    };
    expect(dragReducer(unanswered, { type: "COMMIT" })).toBe(unanswered);
  });

  it("carries every scope the dialog can answer with", () => {
    for (const scope of ["this", "this_and_future", "all"] as const) {
      const state = run([{ type: "SCOPE_CHOSEN", scope }, { type: "COMMIT" }], dropped);
      expect(commitIntentOf(state)?.scope).toBe(scope);
    }
  });

  it("returns the block and writes nothing when the scope question is dismissed (FR-249)", () => {
    const state = dragReducer(dropped, { type: "SCOPE_DISMISSED" });
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(previewOf(state)).toBeNull();
    expect(commitIntentOf(state)).toBeNull();
  });

  it("cancels from the scope question on Escape and on SOURCE_GONE", () => {
    for (const type of ["ESCAPE", "CANCEL", "SOURCE_GONE"] as const) {
      const state = dragReducer(dropped, { type });
      expect(state).toBe(IDLE_DRAG_STATE);
      expect(commitIntentOf(state)).toBeNull();
    }
  });
});

describe("the punch-in prompt — refused means nothing was written (FR-249)", () => {
  const asked = run([press(), moveTo(pointAt(4, 720)), { type: "RELEASE" }]);

  it("returns the block when the sheet is dismissed", () => {
    const state = dragReducer(asked, { type: "PUNCH_IN_DISMISSED" });
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(commitIntentOf(state)).toBeNull();
  });

  it("returns the block when the PIN is wrong", () => {
    const state = dragReducer(asked, { type: "PUNCH_IN_REFUSED" });
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(commitIntentOf(state)).toBeNull();
  });

  it("cancels on Escape and on SOURCE_GONE while the sheet is up", () => {
    for (const type of ["ESCAPE", "CANCEL", "SOURCE_GONE"] as const) {
      expect(dragReducer(asked, { type })).toBe(IDLE_DRAG_STATE);
    }
  });

  it("ignores pointer input while it waits for an answer", () => {
    expect(dragReducer(asked, moveTo(pointAt(0, 60)))).toBe(asked);
    expect(dragReducer(asked, { type: "RELEASE" })).toBe(asked);
    expect(dragReducer(asked, press())).toBe(asked);
    expect(dragReducer(asked, { type: "COMMIT_SETTLED" })).toBe(asked);
  });
});

describe("committing — the write is in flight (R208)", () => {
  const committing = run([
    press(),
    moveTo(pointAt(4, 720)),
    { type: "RELEASE" },
    { type: "COMMIT" },
  ]);

  it("keeps the block at its target until the refetch settles it", () => {
    expect(committing.kind).toBe("committing");
    expect(previewOf(committing)).toEqual({
      allDay: false,
      columnIndex: 4,
      startMinutes: 720,
      endMinutes: 810,
    });
    expect(promptOf(committing)).toBeNull();

    const settled = dragReducer(committing, { type: "COMMIT_SETTLED" });
    expect(settled).toBe(IDLE_DRAG_STATE);
    expect(previewOf(settled)).toBeNull();
    expect(commitIntentOf(settled)).toBeNull();
  });

  it("releases the block, unwritten, when the action fails", () => {
    const state = dragReducer(committing, { type: "COMMIT_FAILED" });
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(commitIntentOf(state)).toBeNull();
  });

  it("releases the block when the retried punch-in is dismissed or refused", () => {
    for (const type of ["PUNCH_IN_DISMISSED", "PUNCH_IN_REFUSED"] as const) {
      const state = dragReducer(committing, { type });
      expect(state).toBe(IDLE_DRAG_STATE);
      expect(commitIntentOf(state)).toBeNull();
    }
  });

  it("releases the block when the source is refetched away mid-write", () => {
    for (const type of ["ESCAPE", "CANCEL", "SOURCE_GONE"] as const) {
      expect(dragReducer(committing, { type })).toBe(IDLE_DRAG_STATE);
    }
  });

  it("ignores everything a gesture would say — the gesture is over", () => {
    expect(dragReducer(committing, moveTo(pointAt(0, 60)))).toBe(committing);
    expect(dragReducer(committing, { type: "RELEASE" })).toBe(committing);
    expect(dragReducer(committing, press())).toBe(committing);
    expect(dragReducer(committing, { type: "COMMIT" })).toBe(committing);
    expect(dragReducer(committing, { type: "SCOPE_CHOSEN", scope: "all" })).toBe(committing);
    expect(dragReducer(committing, { type: "KEY_MOVE", days: 1, steps: 0 })).toBe(committing);
  });
});

describe("the keyboard runs the same transitions (R205, FR-263)", () => {
  it("moves by whole steps and whole days, and needs no slop", () => {
    const nudged = run([press(), { type: "KEY_MOVE", days: 0, steps: 1 }]);
    expect(nudged.kind).toBe("dragging");
    expect(previewOf(nudged)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 555,
      endMinutes: 645,
    });

    const across = run([press(), { type: "KEY_MOVE", days: 1, steps: -2 }]);
    expect(previewOf(across)).toEqual({
      allDay: false,
      columnIndex: 3,
      startMinutes: 510,
      endMinutes: 600,
    });
  });

  it("accumulates, unlike the pointer, because each key press is a step", () => {
    const state = run([
      press(),
      { type: "KEY_MOVE", days: 0, steps: 1 },
      { type: "KEY_MOVE", days: 0, steps: 1 },
      { type: "KEY_MOVE", days: -1, steps: 0 },
    ]);
    expect(previewOf(state)).toEqual({
      allDay: false,
      columnIndex: 1,
      startMinutes: 570,
      endMinutes: 660,
    });
  });

  it("snaps a block whose stored times were off the grid onto it (FR-246)", () => {
    const offGrid: TimedPlacement = {
      allDay: false,
      columnIndex: 2,
      startMinutes: 547,
      endMinutes: 637,
    };
    const state = run([press({ source: offGrid }), { type: "KEY_MOVE", days: 0, steps: 1 }]);
    expect(previewOf(state)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 555,
      endMinutes: 645,
    });
  });

  it("moves an all-day bar by days alone, keeping its span", () => {
    const state = run([press({ source: SPANNING }), { type: "KEY_MOVE", days: 2, steps: 3 }]);
    expect(previewOf(state)).toEqual({
      allDay: true,
      startColumnIndex: 3,
      endColumnIndex: 5,
    });
  });

  it("resizes the named edge, whichever way the gesture began", () => {
    const later = run([press(), { type: "KEY_RESIZE", edge: "end", steps: 2 }]);
    expect(previewOf(later)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 540,
      endMinutes: 660,
    });

    const earlier = run([press(), { type: "KEY_RESIZE", edge: "start", steps: -1 }]);
    expect(previewOf(earlier)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 525,
      endMinutes: 630,
    });
  });

  it("keeps the one-step minimum however hard the key is held (FR-247)", () => {
    const state = run([
      press(),
      { type: "KEY_RESIZE", edge: "end", steps: -3 },
      { type: "KEY_RESIZE", edge: "end", steps: -3 },
      { type: "KEY_RESIZE", edge: "end", steps: -3 },
    ]);
    expect(previewOf(state)).toEqual({
      allDay: false,
      columnIndex: 2,
      startMinutes: 540,
      endMinutes: 555,
    });
  });

  it("cannot resize an all-day bar (FR-245)", () => {
    const armed = dragReducer(IDLE_DRAG_STATE, press({ source: SPANNING }));
    expect(dragReducer(armed, { type: "KEY_RESIZE", edge: "end", steps: 1 })).toBe(armed);
  });

  it("commits on Enter through the same prompts, in the same order (FR-250)", () => {
    const dropped = run([
      press({ isRepeating: true }),
      { type: "KEY_MOVE", days: 1, steps: 0 },
      { type: "RELEASE" },
    ]);
    expect(promptOf(dropped)).toBe("scope");

    const state = run([{ type: "SCOPE_CHOSEN", scope: "this" }, { type: "COMMIT" }], dropped);
    expect(commitIntentOf(state)).toEqual({
      eventId: "e1",
      occurrenceDate: "2026-09-16",
      candidate: { allDay: false, columnIndex: 3, startMinutes: 540, endMinutes: 630 },
      scope: "this",
    });
  });

  it("cancels on Escape, writing nothing (FR-249)", () => {
    const state = run([press(), { type: "KEY_MOVE", days: 1, steps: 0 }, { type: "ESCAPE" }]);
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(commitIntentOf(state)).toBeNull();
  });

  it("drops nothing when the keys brought the block back to where it started", () => {
    const state = run([
      press(),
      { type: "KEY_MOVE", days: 1, steps: 1 },
      { type: "KEY_MOVE", days: -1, steps: -1 },
      { type: "RELEASE" },
    ]);
    expect(state).toBe(IDLE_DRAG_STATE);
    expect(commitIntentOf(state)).toBeNull();
  });
});

describe("every cancel path, gathered (FR-249)", () => {
  const CANCELS: DragAction[] = [
    { type: "ESCAPE" },
    { type: "CANCEL" },
    { type: "SOURCE_GONE" },
    { type: "SCOPE_DISMISSED" },
    { type: "PUNCH_IN_DISMISSED" },
    { type: "PUNCH_IN_REFUSED" },
  ];

  const OUTRIGHT: DragAction[] = [{ type: "ESCAPE" }, { type: "CANCEL" }, { type: "SOURCE_GONE" }];

  const STAGES: { name: string; state: DragState }[] = [
    { name: "armed", state: dragReducer(IDLE_DRAG_STATE, press({ isRepeating: true })) },
    { name: "dragging", state: draggingOver(pointAt(4, 720), { isRepeating: true }) },
    {
      name: "confirming (scope)",
      state: run([press({ isRepeating: true }), moveTo(pointAt(4, 720)), { type: "RELEASE" }]),
    },
    {
      name: "confirming (punch-in)",
      state: run([
        press({ isRepeating: true }),
        moveTo(pointAt(4, 720)),
        { type: "RELEASE" },
        { type: "SCOPE_CHOSEN", scope: "all" },
      ]),
    },
    {
      name: "committing",
      state: run([
        press({ isRepeating: true }),
        moveTo(pointAt(4, 720)),
        { type: "RELEASE" },
        { type: "SCOPE_CHOSEN", scope: "all" },
        { type: "COMMIT" },
      ]),
    },
  ];

  it("either ends the gesture with nothing written, or is ignored outright", () => {
    for (const stage of STAGES) {
      for (const action of CANCELS) {
        const state = dragReducer(stage.state, action);
        const label = `${stage.name} \u2190 ${action.type}`;
        // A prompt's dismissal reaches only the stage where that prompt is
        // up; anywhere else it must change nothing at all.
        if (state === stage.state) continue;
        expect(state, label).toBe(IDLE_DRAG_STATE);
        expect(commitIntentOf(state), label).toBeNull();
      }
    }
  });

  it("cancels every stage outright on Escape, pointercancel and SOURCE_GONE", () => {
    for (const stage of STAGES) {
      for (const action of OUTRIGHT) {
        expect(dragReducer(stage.state, action), `${stage.name} \u2190 ${action.type}`).toBe(
          IDLE_DRAG_STATE,
        );
      }
    }
  });
});
