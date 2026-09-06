"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * A press-and-hold that opens something (006 FR-623, R607): the reference's
 * long-press on a meal cell adds a second meal to the slot. The machine's
 * timing — 400 ms held still — but none of its lifting: nothing here moves,
 * so this is a small hook of its own rather than the reorder machine with
 * its drag turned off. Movement beyond a few pixels, a lift or a cancel
 * before the timer clears it; a hold that fires marks the press consumed so
 * the click that follows the pointer-up does not also open the tap's sheet.
 */

const HOLD_MS = 400;
const SLOP_PX = 8;

export interface HoldPress {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  /** True for the click that follows a hold that fired — the caller ignores it. */
  consumeClick: () => boolean;
}

export function useHoldPress(onHold: () => void): HoldPress {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary) return;
      clear();
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onHold();
      }, HOLD_MS);
    },
    [clear, onHold],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (origin.current === null) return;
      const moved = Math.abs(event.clientX - origin.current.x) + Math.abs(event.clientY - origin.current.y);
      if (moved > SLOP_PX) clear();
    },
    [clear],
  );

  const consumeClick = useCallback(() => {
    const was = fired.current;
    fired.current = false;
    return was;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: clear, onPointerCancel: clear, consumeClick };
}
