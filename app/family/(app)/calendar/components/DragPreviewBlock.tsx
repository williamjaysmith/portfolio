"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";

import {
  minBlockHeightOf,
  type LayoutMetrics,
  type TimedSegment,
} from "@/lib/family/calendar/layout";
import type { PaletteColor } from "@/lib/family/colors";
import type { Occurrence, TimeFormat } from "@/lib/family/types";
import { MINUTES_PER_DAY, type TimedPlacement } from "@/lib/family/week-geometry";

import { EventBlock } from "./EventBlock";

/**
 * T056: the drag preview — the **snapped in-grid ghost** of R205. While a
 * block is being dragged the grid keeps drawing it where it is (dimmed, so
 * the household can see what moved from where) and draws this copy at the
 * candidate slot the planners produced: same event, same colours, same
 * rendering, because it IS `EventBlock`. Nothing here decides where the
 * candidate is — `week-geometry.ts` snapped it and `drag-state.ts` chose it.
 *
 * The ghost is a **copy**, so it is hidden from assistive technology
 * (`aria-hidden`), taken out of the tab order and off the hit-testing surface
 * (`inert`, `pointer-events-none`): the one announced, focusable, tappable
 * control for an occurrence stays the real block. The keyboard path's
 * `aria-live` (T058) says what slot the block is in; the ghost says it in
 * pixels, and so keeps the event's own stored label and time range rather
 * than fabricating a new one.
 *
 * Motion is the one tween in the drag layer: the ghost eases as it settles
 * onto each new slot, and FR-252 requires script-driven animation to honour
 * a reduced-motion preference itself — `useReducedMotion()` collapses the
 * tween to nothing, leaving the ghost jumping instantly between slots.
 *
 * An all-day candidate has no in-grid ghost: the band is a different
 * surface, and FR-251's conversion is what the band's own highlight shows.
 */

/** The settle tween's length — the drag layer's only motion parameter. */
export const SETTLE_SECONDS = 0.14;

/** FR-252: `null` is "not read yet" and animates; `true` collapses the tween. */
export function settleTransitionOf(reducedMotion: boolean | null): Transition {
  if (reducedMotion === true) return { duration: 0 };
  return { type: "tween", duration: SETTLE_SECONDS, ease: "easeOut" };
}

/**
 * The candidate as a `TimedSegment`, so the shared block renders it: the
 * ghost owns its wrapper (no cluster fractions), sits at its top, keeps the
 * FR-218 minimum height, and opens whichever edge a midnight-crossing
 * candidate continues through (FR-217).
 */
export function ghostSegmentOf(
  occurrence: Occurrence,
  placement: TimedPlacement,
  date: string,
  metrics: LayoutMetrics,
): TimedSegment {
  const spanned = (placement.endMinutes - placement.startMinutes) * metrics.pxPerMinute;
  return {
    occurrence,
    columnIndex: placement.columnIndex,
    date,
    startMinutes: placement.startMinutes,
    endMinutes: placement.endMinutes,
    continuesFromPrevious: placement.startMinutes < 0,
    continuesToNext: placement.endMinutes > MINUTES_PER_DAY,
    top: 0,
    height: Math.max(spanned, minBlockHeightOf(metrics)),
    leftFraction: 0,
    widthFraction: 1,
  };
}

export interface DragPreviewBlockProps {
  /** The dragged occurrence — the ghost carries its own label and colours. */
  occurrence: Occurrence;
  /** The snapped candidate, in this column's grid space. */
  placement: TimedPlacement;
  /** The candidate column's household-local date (`dateOfColumn`, T055). */
  date: string;
  /** The occurrence's category colours in draw order (FR-227). */
  fills: readonly PaletteColor[];
  /** The measured layout inputs (T027) — the ruler the ghost is drawn on. */
  metrics: LayoutMetrics;
  /** Household IANA zone (FR-219/284). */
  zone: string;
  timeFormat: TimeFormat;
}

export function DragPreviewBlock({
  occurrence,
  placement,
  date,
  fills,
  metrics,
  zone,
  timeFormat,
}: DragPreviewBlockProps) {
  const reducedMotion = useReducedMotion();
  const segment = ghostSegmentOf(occurrence, placement, date, metrics);
  const top = Math.max(0, placement.startMinutes * metrics.pxPerMinute);

  return (
    <motion.div
      aria-hidden="true"
      inert
      className="pointer-events-none absolute inset-x-0"
      initial={false}
      animate={{ top, height: segment.height }}
      transition={settleTransitionOf(reducedMotion)}
    >
      <EventBlock
        segment={segment}
        fills={fills}
        dimmed={false}
        zone={zone}
        timeFormat={timeFormat}
      />
    </motion.div>
  );
}
