"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { SETTLE_SECONDS } from "./DragPreviewBlock";

/**
 * T060: the paging swipe (FR-279, R211) — a horizontal pan on the grid strip
 * that advances the view by EXACTLY ONE PAGE, which is however many days the
 * grid is currently showing.
 *
 * Where that lands belongs elsewhere: `useWeekAnchor` moves its anchor by the
 * column count, and the arrows call the very same step. This component's whole
 * job is to decide, from a gesture, whether a step was asked for and in which
 * direction — so it is three pure functions and a thin framer-motion binding
 * over them.
 *
 * **Axis lock** (FR-280). The hours scroll vertically and the week pages
 * horizontally through the same finger, so one of them must yield. The pan
 * claims the gesture only once the displacement is worth claiming (~10 px)
 * AND the horizontal dominates; anything else locks vertical for the rest of
 * the gesture and the native scroll of `WeekGrid`'s viewport keeps it. The
 * lock is per gesture and never revisited — a scroll that drifts sideways
 * halfway down the hours must not suddenly page.
 *
 * **Direction** (FR-279, Contradiction 2). Left = later, right = earlier:
 * the content follows the finger. A release is a page only past a travel
 * threshold, which is also what makes ONE swipe one page — the step is
 * decided at `onPanEnd` and nowhere else, so a swipe across the whole width
 * still advances a single page.
 *
 * **Where a swipe may begin** (Assumption 44). A press that lands on a block
 * belongs to the drag layer (`useEventDrag` — R205's surfaces partition by
 * target), and paging swipes start on empty grid, the hour ruler or the
 * day-header band. Those are all inert background; every block, all-day bar
 * and "+n more" row is a `button`, so the partition is exactly "did this
 * press land in a control". The check happens HERE rather than relying on
 * the drag layer's `stopPropagation`: React delegates its listeners to the
 * tree root, so framer's own listener on this element has already run by the
 * time the block's handler could stop anything.
 *
 * **Reduced motion** (FR-252). The strip follows the finger only when motion
 * is allowed; under a reduced-motion preference `travelOf` pins the travel to
 * zero, which turns the whole thing into an instant jump to the new page.
 *
 * The arrows and Today (FR-281) page through the same anchor state without
 * passing through here — they always work however full the grid is.
 */

/** R211: the displacement at which the pan may claim the gesture (FR-280). */
const SWIPE_LOCK_PX = 10;

/** R211: how far a release must have travelled to advance a page (FR-279). */
const SWIPE_COMMIT_PX = 48;

/** How far the strip follows the finger — capped, so it cannot widen the page. */
const SWIPE_TRAVEL_PX = 72;

/** Which axis a gesture belongs to; `unlocked` until the slop decides (FR-280). */
export type SwipeAxis = "unlocked" | "horizontal" | "vertical";

/** The pan's displacement since the press, as framer reports it. */
export interface Offset {
  x: number;
  y: number;
}

/**
 * The axis lock: once claimed it is kept for the whole gesture, so this only
 * ever decides from `unlocked`. An equal diagonal goes to the hour scroll —
 * the horizontal must dominate to take the gesture (FR-280).
 */
export function swipeAxisOf(axis: SwipeAxis, offset: Offset): SwipeAxis {
  if (axis !== "unlocked") return axis;
  const horizontal = Math.abs(offset.x);
  const vertical = Math.abs(offset.y);
  if (Math.max(horizontal, vertical) < SWIPE_LOCK_PX) return "unlocked";
  return horizontal > vertical ? "horizontal" : "vertical";
}

/**
 * What a release asks for: one page later (`1`) for a swipe left, one
 * earlier (`-1`) for a swipe right, or nothing (FR-279). Only a horizontal
 * gesture that travelled past the threshold pages.
 */
export function swipeStepOf(axis: SwipeAxis, offsetX: number): -1 | 1 | null {
  if (axis !== "horizontal" || Math.abs(offsetX) < SWIPE_COMMIT_PX) return null;
  return offsetX < 0 ? 1 : -1;
}

/** How far the strip is drawn from home — nowhere at all under reduced motion (FR-252). */
export function travelOf(offsetX: number, reducedMotion: boolean | null): number {
  if (reducedMotion === true) return 0;
  return Math.max(-SWIPE_TRAVEL_PX, Math.min(SWIPE_TRAVEL_PX, offsetX));
}

/** Did this press land in a control — a block, an all-day bar, a "+n more" row? */
export function beginsOnBlock(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button") !== null;
}

/** One gesture's memory: its locked axis, and whether it is ours at all. */
interface SwipeGesture {
  axis: SwipeAxis;
  /** Assumption 44: the press belongs to the drag layer, not to paging. */
  rejected: boolean;
}

/** Between gestures nothing is ours — a stray move can then do nothing. */
const IDLE_GESTURE: SwipeGesture = { axis: "unlocked", rejected: true };

/** What framer's pan handlers need, in the shape `motion.div` takes them. */
interface SwipeHandlers {
  onPanSessionStart: (event: PointerEvent) => void;
  onPan: (event: PointerEvent, info: { offset: Offset }) => void;
  onPanEnd: (event: PointerEvent, info: { offset: Offset }) => void;
}

/** Enough of framer's playback controls to call the settle off. */
interface Settling {
  stop: () => void;
}

interface SwipePan {
  x: MotionValue<number>;
  handlers: SwipeHandlers;
}

/**
 * The gesture, held in a ref because none of it is rendered: the strip's
 * position is a motion value (no render per frame) and the step is reported
 * to the anchor, which owns the window. The one piece of React state a swipe
 * produces lives there.
 */
function useSwipePan(onPage: (direction: -1 | 1) => void): SwipePan {
  const x = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const gesture = useRef<SwipeGesture>(IDLE_GESTURE);
  const settling = useRef<Settling | null>(null);

  useEffect(() => () => settling.current?.stop(), []);

  const handlers = useMemo<SwipeHandlers>(
    () => ({
      onPanSessionStart: (event) => {
        settling.current?.stop();
        settling.current = null;
        gesture.current = { axis: "unlocked", rejected: beginsOnBlock(event.target) };
      },
      onPan: (_event, info) => {
        const current = gesture.current;
        if (current.rejected) return;
        const axis = swipeAxisOf(current.axis, info.offset);
        gesture.current = { axis, rejected: false };
        if (axis === "horizontal") x.set(travelOf(info.offset.x, reducedMotion));
      },
      onPanEnd: (_event, info) => {
        const current = gesture.current;
        gesture.current = IDLE_GESTURE;
        if (current.rejected) return;
        settling.current = animate(x, 0, {
          type: "tween",
          duration: reducedMotion === true ? 0 : SETTLE_SECONDS,
          ease: "easeOut",
        });
        const step = swipeStepOf(current.axis, info.offset.x);
        if (step !== null) onPage(step);
      },
    }),
    [x, reducedMotion, onPage],
  );

  return { x, handlers };
}

export interface WeekPagerProps {
  /** One step: `1` = one page later, `-1` = one page earlier — `columns` days (FR-279). */
  onPage: (direction: -1 | 1) => void;
  /** The day-header band, the notices and the hour grid — the strip that moves. */
  children: ReactNode;
}

export function WeekPager({ onPage, children }: WeekPagerProps) {
  const { x, handlers } = useSwipePan(onPage);

  // `overflow-x-clip` and not `hidden`: clip leaves the vertical axis
  // `visible`, so this wrapper never becomes a second scroll container over
  // the hour viewport's own (FR-280) — while a strip drawn past either side
  // still cannot give the page a horizontal scrollbar (FR-282).
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-clip">
      <motion.div
        style={{ x }}
        className="flex min-h-0 flex-1 flex-col"
        onPanSessionStart={handlers.onPanSessionStart}
        onPan={handlers.onPan}
        onPanEnd={handlers.onPanEnd}
      >
        {children}
      </motion.div>
    </div>
  );
}
