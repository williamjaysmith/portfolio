"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { useSwipePan } from "../../components/useSwipePan";

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
 * Those three functions now live in `lib/family/swipe.ts` (003 T073, R320):
 * the Tasks board pages between profile columns with the same lock, the same
 * threshold and the same reduced-motion collapse, and a second hand-written
 * pair of them is precisely what the duplication gate exists to catch. The
 * framer binding over them is `useSwipePan`, shared with the board's pager for
 * the same reason (003 T075); what stayed here is the one thing that is this
 * component's own — which presses belong to the drag layer.
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

/** Did this press land in a control — a block, an all-day bar, a "+n more" row? */
export function beginsOnBlock(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button") !== null;
}

export interface WeekPagerProps {
  /** One step: `1` = one page later, `-1` = one page earlier — `columns` days (FR-279). */
  onPage: (direction: -1 | 1) => void;
  /** The day-header band, the notices and the hour grid — the strip that moves. */
  children: ReactNode;
}

export function WeekPager({ onPage, children }: WeekPagerProps) {
  const { x, handlers } = useSwipePan(onPage, beginsOnBlock);

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
