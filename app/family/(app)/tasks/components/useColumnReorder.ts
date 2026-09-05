"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import type { ColumnSections } from "@/lib/family/tasks/layout";
import { reorderList, type Reorder, type ReorderItem } from "@/lib/family/tasks/reorder";
import type { BoardOccurrence, TimeOfDay } from "@/lib/family/types";

/**
 * T076: press-and-hold to reorder, for both of the board's lists (FR-309,
 * FR-310, FR-397, R321).
 *
 * One binding serves both, because both are the same gesture over the same pure
 * reducer and differ only in what they are a list OF: the profile columns run
 * across the board and a section's routines run down a column. Everything that
 * differs is an argument — the axis, which element a press may begin on, and
 * what a drop commits to.
 *
 * **Press and hold, then move.** The reference specifies exactly that gesture
 * for both lists, and it is deliberately NOT `lib/family/drag-state.ts`: that
 * reducer is a distance-slop machine built for the calendar's drag, which
 * FR-253 forbids a timed hold in. Here the hold IS the gesture, so a press that
 * moves before the timer is a scroll or a swipe and gives the pointer up.
 *
 * **The keyboard reaches the same reducer** (FR-397). Enter or Space on a
 * handle picks the row up, the arrow keys along the list's own axis move it,
 * Enter or Space drops it and Escape puts it back — every step announced
 * through `announcement`, which the caller renders in an `aria-live` region. A
 * keyboard move is not a second implementation of anything: it produces the
 * same two indices the pointer does and hands them to `reorderList`.
 *
 * **The rows are found in the DOM, not measured.** A drop is a list reorder and
 * has no geometry (R321), so the only thing the DOM is asked is which row the
 * pointer is over — rect containment, nothing else. The rows must appear in the
 * container in the same order as `items`, which is exactly how both callers
 * render them.
 */

/** How long a press must be held before it becomes a drag rather than a tap. */
const HOLD_MS = 400;

/** Movement before the hold completes: the gesture belonged to a scroll or a swipe. */
const SLOP_PX = 8;

/** Enter and Space both pick up and both drop — whichever the person reaches for. */
const PICK_KEYS: ReadonlySet<string> = new Set([" ", "Enter"]);

/** Which way the list runs: columns across the board, routines down a column. */
export type ReorderAxis = "horizontal" | "vertical";

export interface ListReorderOptions {
  /** The rows in the order they are drawn — the same order the DOM has them in. */
  items: readonly ReorderItem[];
  axis: ReorderAxis;
  /** A CSS selector matching ONE row inside the container. */
  rowSelector: string;
  /** Where a press may begin; the whole row when it is not given (FR-309's name). */
  handleSelector?: string;
  /** How a row is named when a move is announced (FR-397). */
  labelOf: (id: string) => string;
  /** False for a person this list is not open to — no hold, no keys (FR-389). */
  enabled: boolean;
  /**
   * Whether Enter/Space on a handle picks a row up. Off for a list whose rows
   * are themselves controls with a primary action: on a task card Enter opens
   * the details view (FR-352), and stealing it to arm a reorder would cost more
   * than the keyboard reorder is worth. The columns' handle has no other action
   * and keeps it (FR-397).
   */
  keyboard?: boolean;
  /** The drop, as the pure reducer answered it, and the id that moved. */
  onDrop: (move: Reorder, movedId: string) => void;
}

/** Spread onto the element that CONTAINS the rows. */
export interface ListReorderContainerProps {
  ref: (node: HTMLElement | null) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

export interface ListReorder {
  containerProps: ListReorderContainerProps;
  /** True while a drag or a keyboard pick-up owns the row — the pager stands down. */
  active: boolean;
  /** The ids in the order to PAINT right now; `null` when nothing is in flight. */
  order: readonly string[] | null;
  /** The running commentary an `aria-live` region reads out (FR-397). */
  announcement: string;
}

/** Where a gesture has got to. Only `dragging` and `keys` are ever painted. */
type ReorderPhase =
  | { kind: "idle" }
  | { kind: "holding"; from: number; x: number; y: number }
  | { kind: "dragging"; from: number; to: number }
  | { kind: "keys"; from: number; to: number };

const IDLE: ReorderPhase = { kind: "idle" };

/* ------------------------------------------------------------------ pure -- */

/**
 * FR-309's reconstruction rule, and the one place it is written.
 *
 * `reorderCategories` takes the COMPLETE ordered id list of every household
 * category and rebalances all of them, while the Tasks board renders a filtered
 * subset: Labels never appear, a Profile with **Show on Tasks tab** off is
 * absent (FR-313), and per-device hidden profiles are absent (FR-383). So a
 * drag re-emits the whole household order with the rendered ids — and only
 * those — taking the positions they already occupied, in their new order. Every
 * id the board does not draw keeps the exact slot it had.
 *
 * A `visible` list that is not a subset of `all` is a caller bug and would
 * silently drop ids, so it returns the household order untouched instead.
 */
export function householdOrderOf(all: readonly string[], visible: readonly string[]): string[] {
  const shown = new Set(visible);
  const slots = all.filter((id) => shown.has(id));
  if (slots.length !== visible.length) return [...all];
  let taken = 0;
  return all.map((id) => (shown.has(id) ? visible[taken++] : id));
}

/** Which way an arrow key moves a row that is already picked up (FR-397). */
export function reorderKeyStepOf(key: string, axis: ReorderAxis): -1 | 1 | null {
  if (axis === "horizontal") {
    if (key === "ArrowRight") return 1;
    return key === "ArrowLeft" ? -1 : null;
  }
  if (key === "ArrowDown") return 1;
  return key === "ArrowUp" ? -1 : null;
}

/* ------------------------------------------------------------------- DOM -- */

function rowsIn(container: HTMLElement | null, selector: string): HTMLElement[] {
  if (container === null) return [];
  return [...container.querySelectorAll<HTMLElement>(selector)];
}

/** The row a press landed in — but only when it landed on that row's HANDLE. */
function handleRowOf(
  rows: readonly HTMLElement[],
  target: EventTarget | null,
  rowSelector: string,
  handleSelector: string,
): number | null {
  if (!(target instanceof Element)) return null;
  if (target.closest(handleSelector) === null) return null;
  const row = target.closest<HTMLElement>(rowSelector);
  const index = row === null ? -1 : rows.indexOf(row);
  return index === -1 ? null : index;
}

/** Which row the pointer is over — rect containment, and no other geometry. */
function rowAtPoint(rows: readonly HTMLElement[], x: number, y: number): number | null {
  const index = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
  return index === -1 ? null : index;
}

/* ----------------------------------------------------------------- words -- */

function positionWords(label: string, index: number, total: number): string {
  return `${label}, position ${index + 1} of ${total}`;
}

/* -------------------------------------------------------------- the hold -- */

interface HoldTimer {
  /** Arms the hold; `onHeld` runs when it completes uninterrupted. */
  start: (onHeld: () => void) => void;
  cancel: () => void;
}

/** The timer between a press and a drag — cleared on movement, release, unmount. */
function useHoldTimer(): HoldTimer {
  const holding = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (holding.current === null) return;
    clearTimeout(holding.current);
    holding.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  const start = useCallback(
    (onHeld: () => void) => {
      cancel();
      holding.current = setTimeout(() => {
        holding.current = null;
        onHeld();
      }, HOLD_MS);
    },
    [cancel],
  );
  return useMemo(() => ({ start, cancel }), [start, cancel]);
}

/* ------------------------------------------------------------------ rows -- */

interface RowFinder {
  setContainer: (node: HTMLElement | null) => void;
  /** The row a press or a key landed on — when it landed on that row's handle. */
  pressedRowOf: (target: EventTarget | null) => number | null;
  /** The row under a point — rect containment, and no other geometry. */
  rowAt: (x: number, y: number) => number | null;
}

/** The container's rows, asked the only two things a gesture needs to know. */
function useRowFinder(rowSelector: string, handleSelector: string): RowFinder {
  const container = useRef<HTMLElement | null>(null);
  const setContainer = useCallback((node: HTMLElement | null) => {
    container.current = node;
  }, []);
  const pressedRowOf = useCallback(
    (target: EventTarget | null) =>
      handleRowOf(rowsIn(container.current, rowSelector), target, rowSelector, handleSelector),
    [rowSelector, handleSelector],
  );
  const rowAt = useCallback(
    (x: number, y: number) => rowAtPoint(rowsIn(container.current, rowSelector), x, y),
    [rowSelector],
  );
  return useMemo(
    () => ({ setContainer, pressedRowOf, rowAt }),
    [setContainer, pressedRowOf, rowAt],
  );
}

/* --------------------------------------------------------------- machine -- */

/**
 * What the pointer and the keyboard share: where the gesture has got to, the
 * rows it is over, and how a step is spoken. The transitions below are plain
 * functions of it, so each input's rules read on their own and neither input
 * is a hook of its own.
 */
interface ReorderMachine {
  items: readonly ReorderItem[];
  phase: ReorderPhase;
  announcement: string;
  setPhase: (phase: ReorderPhase) => void;
  announce: (message: string) => void;
  /** Back to idle, whatever was in flight, with the hold timer cleared. */
  reset: () => void;
  nameOf: (index: number) => string;
  onDrop: ListReorderOptions["onDrop"];
  hold: HoldTimer;
  rows: RowFinder;
}

function useReorderMachine(options: ListReorderOptions): ReorderMachine {
  const { items, rowSelector, labelOf, onDrop } = options;
  const [phase, setPhase] = useState<ReorderPhase>(IDLE);
  const [announcement, announce] = useState("");
  const hold = useHoldTimer();
  const rows = useRowFinder(rowSelector, options.handleSelector ?? rowSelector);
  const reset = useCallback(() => {
    hold.cancel();
    setPhase(IDLE);
  }, [hold]);
  const nameOf = useCallback(
    (index: number) => labelOf(items[index]?.id ?? ""),
    [items, labelOf],
  );
  return useMemo(
    () => ({ items, phase, announcement, setPhase, announce, reset, nameOf, onDrop, hold, rows }),
    [items, phase, announcement, reset, nameOf, onDrop, hold, rows],
  );
}

/* ----------------------------------------------------------- transitions -- */

/** The row is picked up — by the finger or by the keyboard — and says so. */
function pickUp(m: ReorderMachine, from: number, kind: "dragging" | "keys"): void {
  m.setPhase({ kind, from, to: from });
  m.announce(`${positionWords(m.nameOf(from), from, m.items.length)}. Picked up.`);
}

/** The drop: the pure reducer answers, the caller writes, the region speaks. */
function commit(m: ReorderMachine, from: number, to: number): void {
  m.reset();
  const move = reorderList({ items: m.items, fromIndex: from, toIndex: to });
  if (move === null) {
    m.announce(`${m.nameOf(from)} stayed where it was.`);
    return;
  }
  m.onDrop(move, m.items[from].id);
  m.announce(`${positionWords(m.nameOf(from), to, m.items.length)}. Dropped.`);
}

/** A press on a handle arms the hold; anything else was never this list's. */
function pressDown(m: ReorderMachine, enabled: boolean, event: PointerEvent<HTMLElement>): void {
  if (!enabled || m.phase.kind !== "idle") return;
  const from = m.rows.pressedRowOf(event.target);
  if (from === null) return;
  m.setPhase({ kind: "holding", from, x: event.clientX, y: event.clientY });
  m.hold.start(() => pickUp(m, from, "dragging"));
}

function pressMove(m: ReorderMachine, event: PointerEvent<HTMLElement>): void {
  const { phase } = m;
  if (phase.kind === "holding") {
    // The press turned into a scroll or a paging swipe before the hold
    // completed, so the gesture was never this list's.
    const moved = Math.abs(event.clientX - phase.x) + Math.abs(event.clientY - phase.y);
    if (moved > SLOP_PX) m.reset();
    return;
  }
  if (phase.kind !== "dragging") return;
  const to = m.rows.rowAt(event.clientX, event.clientY);
  if (to === null || to === phase.to) return;
  m.setPhase({ kind: "dragging", from: phase.from, to });
  m.announce(positionWords(m.nameOf(phase.from), to, m.items.length));
}

/** Release: a drop if a row was being carried; otherwise nothing happened. */
function pressUp(m: ReorderMachine, dropped: { current: boolean }): void {
  const { phase } = m;
  if (phase.kind !== "dragging") {
    m.reset();
    return;
  }
  // The card under the finger is also a button; the click that ends this
  // gesture must not also open it.
  dropped.current = true;
  commit(m, phase.from, phase.to);
}

/** The click a pointer drop ends with is not a tap on the row it landed on. */
function swallowDropClick(dropped: { current: boolean }, event: MouseEvent<HTMLElement>): void {
  if (!dropped.current) return;
  dropped.current = false;
  event.preventDefault();
  event.stopPropagation();
}

/** The keys that matter only once a row is already picked up (FR-397). */
function carryKey(
  m: ReorderMachine,
  axis: ReorderAxis,
  event: KeyboardEvent<HTMLElement>,
  held: { from: number; to: number },
): void {
  if (event.key === "Escape") {
    event.preventDefault();
    m.setPhase(IDLE);
    m.announce(`${positionWords(m.nameOf(held.from), held.from, m.items.length)}. Put back.`);
    return;
  }
  if (PICK_KEYS.has(event.key)) {
    event.preventDefault();
    commit(m, held.from, held.to);
    return;
  }
  const step = reorderKeyStepOf(event.key, axis);
  if (step === null) return;
  event.preventDefault();
  const to = Math.min(Math.max(0, held.to + step), m.items.length - 1);
  if (to === held.to) return;
  m.setPhase({ kind: "keys", from: held.from, to });
  m.announce(positionWords(m.nameOf(held.from), to, m.items.length));
}

/** Enter or Space on a handle picks a row up; every key after that is `carryKey`'s. */
function keyDown(
  m: ReorderMachine,
  axis: ReorderAxis,
  enabled: boolean,
  event: KeyboardEvent<HTMLElement>,
): void {
  if (!enabled) return;
  if (m.phase.kind === "keys") {
    carryKey(m, axis, event, m.phase);
    return;
  }
  if (!PICK_KEYS.has(event.key)) return;
  const from = m.rows.pressedRowOf(event.target);
  if (from === null) return;
  event.preventDefault();
  pickUp(m, from, "keys");
}

/** Only `dragging` and `keys` are ever painted. */
function isCarrying(phase: ReorderPhase): phase is Extract<ReorderPhase, { to: number }> {
  return phase.kind === "dragging" || phase.kind === "keys";
}

/** The ids in the order to PAINT right now; `null` when nothing is in flight. */
function previewOrderOf(
  items: readonly ReorderItem[],
  phase: ReorderPhase,
): readonly string[] | null {
  if (!isCarrying(phase)) return null;
  const move = reorderList({ items, fromIndex: phase.from, toIndex: phase.to });
  return move?.order ?? items.map((one) => one.id);
}

/* ------------------------------------------------------------------ hook -- */

export function useListReorder(options: ListReorderOptions): ListReorder {
  const { axis, enabled } = options;
  const keyboard = options.keyboard ?? true;
  const m = useReorderMachine(options);
  /** A pointer drop just happened: the click it ends with is not a tap. */
  const dropped = useRef(false);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => pressDown(m, enabled, event),
    [m, enabled],
  );
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => pressMove(m, event),
    [m],
  );
  const onPointerUp = useCallback(() => pressUp(m, dropped), [m]);
  const onPointerCancel = useCallback(() => m.reset(), [m]);
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => keyDown(m, axis, enabled && keyboard, event),
    [m, axis, enabled, keyboard],
  );
  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) => swallowDropClick(dropped, event),
    [],
  );
  const order = useMemo(() => previewOrderOf(m.items, m.phase), [m.items, m.phase]);

  return {
    containerProps: {
      ref: m.rows.setContainer,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown,
      onClickCapture,
    },
    active: isCarrying(m.phase),
    order,
    announcement: m.announcement,
  };
}

/* -------------------------------------------------------------- routines -- */

/** What a routine drop asks the server for (contracts §moveRoutine). */
export interface RoutineMove {
  taskId: string;
  previousTaskId: string | null;
  nextTaskId: string | null;
}

/** One binding per time of day — and none for Chores, which never reorder (FR-311). */
export type RoutineReorders = Record<TimeOfDay, ListReorder>;

/**
 * Spacing for the CLIENT's copy of the list only. The browser never writes a
 * `sort_order`: it names the two neighbours a routine was dropped between and
 * the server computes the value from the stored ones (contracts §moveRoutine),
 * so these numbers exist purely to give the shared reducer an ascending list.
 */
const CLIENT_GAP = 1000;

/**
 * One section of one column. The list is a single time of day, which is what
 * makes FR-310 structural rather than checked: there is no index in it that is
 * in another section, so a drop cannot name a neighbour from one.
 */
function useSectionReorder(
  occurrences: readonly BoardOccurrence[],
  enabled: boolean,
  onMove: (move: RoutineMove) => void,
): ListReorder {
  const items = useMemo(
    () =>
      occurrences.map((one, index) => ({ id: one.taskId, sortOrder: (index + 1) * CLIENT_GAP })),
    [occurrences],
  );

  const labelOf = useCallback(
    (id: string) => occurrences.find((one) => one.taskId === id)?.summary ?? "",
    [occurrences],
  );

  const onDrop = useCallback(
    (move: Reorder, movedId: string) => {
      const at = move.order.indexOf(movedId);
      onMove({
        taskId: movedId,
        previousTaskId: move.order[at - 1] ?? null,
        nextTaskId: move.order[at + 1] ?? null,
      });
    },
    [onMove],
  );

  return useListReorder({
    items,
    axis: "vertical",
    // The card IS the handle: FR-310's gesture is a press and hold on the
    // routine itself, and the keyboard is deliberately left to FR-352's tap.
    rowSelector: "[data-task-card]",
    labelOf,
    enabled,
    keyboard: false,
    onDrop,
  });
}

/**
 * FR-310's three lists, one per time of day. Three fixed calls rather than a
 * loop, because there are exactly three sections a routine can live in and a
 * hook count may not vary; Chores is absent by construction, which is FR-311.
 */
export function useRoutineReorder(
  sections: ColumnSections,
  enabled: boolean,
  onMove: (move: RoutineMove) => void,
): RoutineReorders {
  return {
    morning: useSectionReorder(sections.morning, enabled, onMove),
    afternoon: useSectionReorder(sections.afternoon, enabled, onMove),
    evening: useSectionReorder(sections.evening, enabled, onMove),
  };
}

/**
 * The list order to PAINT, given the drag preview. `null` means nothing is in
 * flight, and then the drawn order is the stored one — so a list that is not
 * being dragged costs nothing at all.
 */
export function previewed<T>(
  rows: readonly T[],
  order: readonly string[] | null,
  idOf: (row: T) => string,
): readonly T[] {
  if (order === null) return rows;
  const byId = new Map(rows.map((row) => [idOf(row), row]));
  const moved = order.map((id) => byId.get(id)).filter((row): row is T => row !== undefined);
  return moved.length === rows.length ? moved : rows;
}
