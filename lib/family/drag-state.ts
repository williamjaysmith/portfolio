/**
 * The drag state machine (T054, R205) — `idle → armed → dragging →
 * confirming → committing`, and back to `idle` down every path that ends a
 * gesture without writing anything.
 *
 * This is the whole of a drag's decision-making, and it is pure: no DOM, no
 * cache, no network, no clock. It arms on DISTANCE and never on a hold
 * (FR-253), asks the planners in `week-geometry.ts` where the block would
 * land, orders the two prompts (FR-250: the scope question first, the
 * punch-in second; FR-248: on DROP, never on grab), and produces a
 * `CommitIntent` at exactly one moment — the `committing` state. Everywhere
 * else `commitIntentOf` answers `null`, which is FR-249 stated as a type: a
 * cancelled, refused or invalid drop cannot describe a write, so there is
 * nothing to roll back (R208 — the calendar makes no optimistic writes).
 *
 * There is no drag action on the server: a committed drag is an edit with a
 * gesture, so the adapter turns the intent into `updateEvent` exactly as the
 * form does (contracts/server-actions.md).
 *
 * The adapter (`useEventDrag`, T055) owns only the wiring, and the sequence
 * it runs is:
 *
 *   pointerdown on a block  → PRESS (the gesture, measured from the block)
 *   pointermove             → POINTER_MOVE (a fresh metrics snapshot)
 *   pointerup               → RELEASE          Enter does the same
 *   the block was refetched away mid-gesture → SOURCE_GONE
 *   Escape / pointercancel  → ESCAPE / CANCEL
 *   then, once `confirming` is reached:
 *     promptOf() === "scope"   → the shared ScopeDialog → SCOPE_CHOSEN / SCOPE_DISMISSED
 *     promptOf() === "punchIn" → openPunchIn() → COMMIT, or
 *                                PUNCH_IN_DISMISSED (sheet closed) /
 *                                PUNCH_IN_REFUSED (a PIN that cannot identify anyone)
 *     COMMIT → withActor(updateEvent) → COMMIT_SETTLED once the refetch has
 *              landed (R208 holds the block at its target until then), or
 *              COMMIT_FAILED
 *
 * Placements are grid space (a column index and wall minutes) throughout —
 * mapping a column index to a date and minutes to an instant is the
 * adapter's job. A keyboard nudge may take a column index outside the
 * rendered window, exactly as an edge-hold page does (R211); the adapter
 * resolves the date by offset from the window's first day.
 */

import {
  NO_GRAB,
  SNAP_MINUTES,
  planMove,
  planResize,
  slotFromPoint,
  type DragGrab,
  type DragMetrics,
  type DropTarget,
  type Point,
  type ResizeEdge,
  type SlotPlacement,
  type TimedPlacement,
} from "./week-geometry";
import type { Scope } from "./types";

/** FR-253: a press plus this much movement is a drag. No timer anywhere. */
export const DRAG_SLOP_PX = 8;

/** What the gesture took hold of: the whole block, or one of its edges. */
export type DragMode =
  | { readonly kind: "move" }
  | { readonly kind: "resize"; readonly edge: ResizeEdge };

/** Everything about the dragged occurrence the machine needs, measured once at press. */
export interface DragGesture {
  /** The `events` row the occurrence expands from — what the write round-trips. */
  readonly eventId: string;
  /** The occurrence's ORIGINAL household-local date — the exception key (R204). */
  readonly occurrenceDate: string;
  /** Whether the scope question must be asked (FR-238/250). */
  readonly isRepeating: boolean;
  readonly mode: DragMode;
  /** Where the block sits now — every pointer move re-plans from this. */
  readonly source: SlotPlacement;
  /** Where inside the block the gesture took hold (FR-244's duration-preserving move). */
  readonly grab: DragGrab;
}

/** Which of the two prompts is up. Order is FR-250's, not the adapter's. */
export type ConfirmStep = "scope" | "punchIn";

export type DragState =
  | { readonly kind: "idle" }
  /** Pressed, not yet moved far enough to be a drag (FR-253). */
  | { readonly kind: "armed"; readonly gesture: DragGesture; readonly origin: Point }
  /** Dragging; `candidate` is `null` while the pointer is over no valid slot. */
  | {
      readonly kind: "dragging";
      readonly gesture: DragGesture;
      readonly candidate: SlotPlacement | null;
    }
  /** Dropped on a real slot; a prompt is up and nothing has been written. */
  | {
      readonly kind: "confirming";
      readonly gesture: DragGesture;
      readonly candidate: SlotPlacement;
      readonly step: ConfirmStep;
      /** The answered scope; `null` before the question and on a one-off (FR-238). */
      readonly scope: Scope | null;
    }
  /** The write is in flight; the block stays drawn at its target (R208). */
  | {
      readonly kind: "committing";
      readonly gesture: DragGesture;
      readonly candidate: SlotPlacement;
      readonly scope: Scope | null;
    };

export type DragAction =
  | { readonly type: "PRESS"; readonly gesture: DragGesture; readonly point: Point }
  | { readonly type: "POINTER_MOVE"; readonly point: Point; readonly metrics: DragMetrics }
  /** pointerup, or Enter on the keyboard path — the same transition. */
  | { readonly type: "RELEASE" }
  /** Alt+Arrow: whole days sideways, whole snap steps up or down. */
  | { readonly type: "KEY_MOVE"; readonly days: number; readonly steps: number }
  /** Alt+Shift+Arrow: one edge, whole snap steps. */
  | { readonly type: "KEY_RESIZE"; readonly edge: ResizeEdge; readonly steps: number }
  | { readonly type: "SCOPE_CHOSEN"; readonly scope: Scope }
  | { readonly type: "SCOPE_DISMISSED" }
  /** The punch-in sheet was closed without anyone identifying themselves. */
  | { readonly type: "PUNCH_IN_DISMISSED" }
  /** A PIN that cannot identify anyone — wrong, locked out, or no PIN at all. */
  | { readonly type: "PUNCH_IN_REFUSED" }
  | { readonly type: "COMMIT" }
  /** The action succeeded AND the invalidated week has been refetched (R208). */
  | { readonly type: "COMMIT_SETTLED" }
  | { readonly type: "COMMIT_FAILED" }
  | { readonly type: "ESCAPE" }
  /** pointercancel — the browser took the gesture away. */
  | { readonly type: "CANCEL" }
  /** The dragged block left the rendered week under us (a realtime refetch). */
  | { readonly type: "SOURCE_GONE" };

/** The one idle instance, so an ignored action re-renders nothing. */
export const IDLE_DRAG_STATE: DragState = { kind: "idle" };

/** Everything a commit needs, and nothing else. `scope` is `null` iff one-off. */
export interface CommitIntent {
  readonly eventId: string;
  readonly occurrenceDate: string;
  readonly candidate: SlotPlacement;
  readonly scope: Scope | null;
}

type Armed = Extract<DragState, { kind: "armed" }>;
type Dragging = Extract<DragState, { kind: "dragging" }>;
type Confirming = Extract<DragState, { kind: "confirming" }>;
type Committing = Extract<DragState, { kind: "committing" }>;
type PressAction = Extract<DragAction, { type: "PRESS" }>;
type KeyAction = Extract<DragAction, { type: "KEY_MOVE" | "KEY_RESIZE" }>;

/* ------------------------------------------------------- selectors ------ */

/** Where to draw the dragged block, from the first movement until it settles. */
export function previewOf(state: DragState): SlotPlacement | null {
  if (state.kind === "dragging") return state.candidate;
  if (state.kind === "confirming" || state.kind === "committing") return state.candidate;
  return null;
}

/** Which prompt to put up — nothing until the block has been dropped (FR-248). */
export function promptOf(state: DragState): ConfirmStep | null {
  return state.kind === "confirming" ? state.step : null;
}

/**
 * The write, or `null` — which is every state but `committing`. FR-249's
 * guarantee is exactly this function's shape: no cancelled gesture can
 * describe a change.
 */
export function commitIntentOf(state: DragState): CommitIntent | null {
  if (state.kind !== "committing") return null;
  return {
    eventId: state.gesture.eventId,
    occurrenceDate: state.gesture.occurrenceDate,
    candidate: state.candidate,
    scope: state.scope,
  };
}

/* --------------------------------------------------------- planning ----- */

function samePlacement(a: SlotPlacement, b: SlotPlacement): boolean {
  if (a.allDay) {
    if (!b.allDay) return false;
    return a.startColumnIndex === b.startColumnIndex && a.endColumnIndex === b.endColumnIndex;
  }
  return (
    !b.allDay &&
    a.columnIndex === b.columnIndex &&
    a.startMinutes === b.startMinutes &&
    a.endMinutes === b.endMinutes
  );
}

/** The planner this gesture's mode calls for; `null` = nothing valid here. */
function candidateFor(gesture: DragGesture, target: DropTarget | null): SlotPlacement | null {
  if (target === null) return null;
  if (gesture.mode.kind === "move") return planMove(gesture.source, target, gesture.grab);
  // FR-245 resizes a TIMED block; an all-day bar has no edges to drag.
  if (gesture.source.allDay) return null;
  return planResize(gesture.source, gesture.mode.edge, target);
}

/** Alt+Arrow as a synthetic drop target, so the keys run the same planners. */
function keyMoveTarget(current: SlotPlacement, days: number, steps: number): DropTarget {
  if (current.allDay) return { kind: "band", columnIndex: current.startColumnIndex + days };
  return {
    kind: "grid",
    columnIndex: current.columnIndex + days,
    minutes: current.startMinutes + steps * SNAP_MINUTES,
  };
}

/** Alt+Shift+Arrow: the dragged edge, one step at a time, in its own column. */
function keyResizeTarget(current: TimedPlacement, edge: ResizeEdge, steps: number): DropTarget {
  const from = edge === "start" ? current.startMinutes : current.endMinutes;
  return { kind: "grid", columnIndex: current.columnIndex, minutes: from + steps * SNAP_MINUTES };
}

/**
 * A keyboard nudge accumulates from where the block is NOW (each press is a
 * step), where a pointer move re-plans from the original placement (the
 * pointer carries its own absolute position). `null` = the keys asked for
 * something this gesture cannot do.
 */
function keyDragged(
  gesture: DragGesture,
  candidate: SlotPlacement | null,
  action: KeyAction,
): DragState | null {
  const current = candidate ?? gesture.source;
  if (action.type === "KEY_MOVE") {
    const target = keyMoveTarget(current, action.days, action.steps);
    return { kind: "dragging", gesture, candidate: planMove(current, target, NO_GRAB) };
  }
  if (current.allDay) return null;
  const target = keyResizeTarget(current, action.edge, action.steps);
  return { kind: "dragging", gesture, candidate: planResize(current, action.edge, target) };
}

/* ------------------------------------------------------ transitions ----- */

function armedOn(action: PressAction): DragState {
  return { kind: "armed", gesture: action.gesture, origin: action.point };
}

function movedFar(origin: Point, point: Point): boolean {
  return Math.hypot(point.x - origin.x, point.y - origin.y) >= DRAG_SLOP_PX;
}

/** Hold the state's identity while the pointer stays in the slot it is in. */
function draggedTo(state: Dragging, candidate: SlotPlacement | null): DragState {
  if (candidate === null) return state.candidate === null ? state : { ...state, candidate: null };
  if (state.candidate !== null && samePlacement(state.candidate, candidate)) return state;
  return { ...state, candidate };
}

/**
 * The drop (FR-248 — this is where a punch-in is demanded). An invalid
 * target and a block that came back to where it started both write nothing
 * and ask nothing; a repeat's scope question comes first (FR-250), a one-off
 * never sees it (FR-238).
 */
function released(state: Dragging): DragState {
  const { gesture, candidate } = state;
  if (candidate === null || samePlacement(candidate, gesture.source)) return IDLE_DRAG_STATE;
  return {
    kind: "confirming",
    gesture,
    candidate,
    step: gesture.isRepeating ? "scope" : "punchIn",
    scope: null,
  };
}

/**
 * FR-250 made structural: the punch-in is the last gate, and a repeating
 * occurrence whose scope is unanswered cannot reach a write at all.
 */
function committed(state: Confirming): DragState {
  if (state.step !== "punchIn") return state;
  if (state.gesture.isRepeating && state.scope === null) return state;
  return {
    kind: "committing",
    gesture: state.gesture,
    candidate: state.candidate,
    scope: state.scope,
  };
}

function reduceIdle(state: DragState, action: DragAction): DragState {
  return action.type === "PRESS" ? armedOn(action) : state;
}

function reduceArmed(state: Armed, action: DragAction): DragState {
  switch (action.type) {
    case "PRESS":
      return armedOn(action);
    case "POINTER_MOVE":
      if (!movedFar(state.origin, action.point)) return state;
      return {
        kind: "dragging",
        gesture: state.gesture,
        candidate: candidateFor(state.gesture, slotFromPoint(action.metrics, action.point)),
      };
    case "KEY_MOVE":
    case "KEY_RESIZE":
      // The keyboard has no slop to cross — the first nudge IS the drag.
      return keyDragged(state.gesture, null, action) ?? state;
    case "RELEASE":
      // A press that never moved is a tap; details own that (FR-256).
      return IDLE_DRAG_STATE;
    default:
      return state;
  }
}

function reduceDragging(state: Dragging, action: DragAction): DragState {
  switch (action.type) {
    case "PRESS":
      // A pointerup lost to the browser must not strand the grid mid-drag.
      return armedOn(action);
    case "POINTER_MOVE":
      return draggedTo(
        state,
        candidateFor(state.gesture, slotFromPoint(action.metrics, action.point)),
      );
    case "KEY_MOVE":
    case "KEY_RESIZE":
      return keyDragged(state.gesture, state.candidate, action) ?? state;
    case "RELEASE":
      return released(state);
    default:
      return state;
  }
}

function reduceConfirming(state: Confirming, action: DragAction): DragState {
  switch (action.type) {
    case "SCOPE_CHOSEN":
      return state.step === "scope" ? { ...state, step: "punchIn", scope: action.scope } : state;
    case "SCOPE_DISMISSED":
      return state.step === "scope" ? IDLE_DRAG_STATE : state;
    case "PUNCH_IN_DISMISSED":
    case "PUNCH_IN_REFUSED":
      return state.step === "punchIn" ? IDLE_DRAG_STATE : state;
    case "COMMIT":
      return committed(state);
    default:
      return state;
  }
}

function reduceCommitting(state: Committing, action: DragAction): DragState {
  switch (action.type) {
    case "COMMIT_SETTLED":
    case "COMMIT_FAILED":
    // The lapsed-cookie retry asks again mid-flight; a refusal there wrote
    // nothing either (FR-249, FR-275).
    case "PUNCH_IN_DISMISSED":
    case "PUNCH_IN_REFUSED":
      return IDLE_DRAG_STATE;
    default:
      return state;
  }
}

/** Escape, pointercancel and a vanished source end any gesture, at any stage. */
function isAbort(action: DragAction): boolean {
  return action.type === "ESCAPE" || action.type === "CANCEL" || action.type === "SOURCE_GONE";
}

export function dragReducer(state: DragState, action: DragAction): DragState {
  if (state.kind === "idle") return reduceIdle(state, action);
  if (isAbort(action)) return IDLE_DRAG_STATE;
  switch (state.kind) {
    case "armed":
      return reduceArmed(state, action);
    case "dragging":
      return reduceDragging(state, action);
    case "confirming":
      return reduceConfirming(state, action);
    case "committing":
      return reduceCommitting(state, action);
  }
}
