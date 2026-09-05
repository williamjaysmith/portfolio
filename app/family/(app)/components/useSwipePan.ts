"use client";

import { animate, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";

import { swipeAxisOf, swipeStepOf, travelOf, type Offset, type SwipeAxis } from "@/lib/family/swipe";

import { SETTLE_SECONDS } from "../calendar/components/DragPreviewBlock";

/**
 * The framer-motion binding over `lib/family/swipe.ts`'s three pure decisions,
 * shared by the calendar's `WeekPager` (002 T060) and the board's `ColumnPager`
 * (003 T075, R320). The two pagers tile different things — an anchored week
 * against a window of profile columns — but the GESTURE is one gesture: the
 * same axis lock, the same commit threshold, the same follow-the-finger travel
 * and the same settle, collapsed to an instant under reduced motion (FR-252,
 * FR-397). Written once so a second binding cannot drift from the first, which
 * is exactly what the duplication gate exists to catch.
 *
 * The one thing that differs between the two is WHICH presses are not ours at
 * all — on the calendar a press that lands on a block belongs to the drag
 * layer (Assumption 44); on the board a press while a press-and-hold reorder
 * owns the pointer belongs to it (T076) — so that is the one argument.
 *
 * Held in refs because none of it is rendered: the strip's position is a
 * motion value (no render per frame) and the step is reported to the caller,
 * which owns the window. The one piece of React state a swipe produces lives
 * there.
 */

/** One gesture's memory: its locked axis, and whether it is ours at all. */
interface SwipeGesture {
  axis: SwipeAxis;
  /** The press belonged to something else — a drag, a reorder — not to paging. */
  rejected: boolean;
}

/** Between gestures nothing is ours — a stray move can then do nothing. */
const IDLE_GESTURE: SwipeGesture = { axis: "unlocked", rejected: true };

/** What framer's pan handlers need, in the shape `motion.div` takes them. */
export interface SwipeHandlers {
  onPanSessionStart: (event: PointerEvent) => void;
  onPan: (event: PointerEvent, info: { offset: Offset }) => void;
  onPanEnd: (event: PointerEvent, info: { offset: Offset }) => void;
}

/** Enough of framer's playback controls to call the settle off. */
interface Settling {
  stop: () => void;
}

export interface SwipePan {
  x: MotionValue<number>;
  handlers: SwipeHandlers;
}

export function useSwipePan(
  onPage: (direction: -1 | 1) => void,
  /** Does THIS press belong to something other than paging? Decided once, at the start. */
  rejects: (target: EventTarget | null) => boolean,
): SwipePan {
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
        gesture.current = { axis: "unlocked", rejected: rejects(event.target) };
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
    [x, reducedMotion, onPage, rejects],
  );

  return { x, handlers };
}
