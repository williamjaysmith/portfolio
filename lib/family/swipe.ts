/**
 * The horizontal paging swipe, as three pure decisions (002 FR-279/FR-280,
 * 003 FR-396, R320).
 *
 * These shipped inside the calendar's `WeekPager` and moved here when the Tasks
 * board grew a pager of its own: two hand-written axis-lock/threshold pairs is
 * exactly the duplication `fallow:dupes` exists to catch, and the answer to a
 * dupes finding is the code changing, never the gate. Both pagers now bind to
 * this one module, so a swipe feels the same wherever the household makes it.
 *
 * What is NOT here is the tiling — what one page contains and where the next
 * begins. The calendar pages by days within an anchored week; the board pages
 * by whole columns with no overlap and no week to continue into. Those have
 * nothing in common but the finger.
 *
 * Framework-free and DOM-free: no React, no framer-motion, no `Element`. The
 * pan handler that feeds these lives with its component, and so does the
 * question of which presses belong to a drag layer rather than to paging.
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
 * ever decides from `unlocked`. An equal diagonal goes to the vertical scroll —
 * the hours on the calendar, a column's own contents on the board — because the
 * horizontal must dominate to take the gesture (FR-280).
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
