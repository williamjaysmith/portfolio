"use client";

import { motion } from "framer-motion";
import { useCallback, useState, type KeyboardEvent, type ReactNode } from "react";

import type { BoardLayoutMode } from "@/lib/family/tasks/layout";

import { useSwipePan } from "./useSwipePan";

/**
 * T075: the phone's horizontal swipe between profile columns (FR-396, R320).
 *
 * The board already decides HOW MANY whole columns the viewport fits, by
 * measuring rather than by a breakpoint (`boardLayoutOf`, T030/T040). This is
 * the other half of that decision: when more columns exist than fit, and the
 * viewport is not the tall-and-narrow shape that wraps them onto a second row
 * (FR-395), the ones that do not fit are reached by swiping.
 *
 * **The gesture is not written here.** `swipeAxisOf`, `swipeStepOf` and
 * `travelOf` live in `lib/family/swipe.ts` (T073) and the framer binding over
 * them is `useSwipePan`, the very one the calendar's `WeekPager` mounts: one
 * axis lock, one commit threshold, one reduced-motion collapse, so a swipe
 * feels the same on both tabs and a second hand-written pair cannot drift
 * from the first.
 *
 * **The tiling IS written here, because it is genuinely different.** The
 * calendar tiles an anchored week into slices and pulls the last one back so it
 * ends on the week's last day; a board of people has no week, no continuation
 * and nothing to pull back. It is a window of `perRow` columns that steps by
 * ONE column, so every page is full and every swipe reveals exactly one more
 * profile — which is what the reference does — and **Up for Grabs is index 0**,
 * so the board opens on it (FR-396, US4-14).
 *
 * **Axis lock, restated for this tab.** A column's own body scrolls vertically
 * (`.fam-task-scroll`) and the board pages horizontally through the same
 * finger, so the pan claims the gesture only once the horizontal dominates;
 * everything else stays with the column's scroll for the whole gesture.
 *
 * **A reorder stands the pager down** (`suspended`). Once a press-and-hold has
 * armed a column or routine drag (T076) the gesture belongs to it, and a drag
 * that wanders sideways must not also page the board out from under itself.
 *
 * Reduced motion collapses the follow to zero travel and the settle to an
 * instant, exactly as the calendar's does (FR-252, FR-397).
 */

/** What the paging group is called to a screen reader. */
const PAGER_LABEL = "Profile columns";

/* ------------------------------------------------------------------ pure -- */

/**
 * Where a page may start: index 0 up to the last window that is still full.
 * Clamped rather than wrapped — the board has two ends and a swipe at one of
 * them does nothing, which is what stops a phone cycling past Up for Grabs.
 */
export function pageStartOf(start: number, columnCount: number, perRow: number): number {
  const last = Math.max(0, columnCount - Math.max(1, perRow));
  return Math.min(Math.max(0, Math.trunc(start)), last);
}

/** "Cleo", "Cleo and Bea", "Up for Grabs, Cleo and Bea" — what is on screen. */
export function columnsInWords(labels: readonly string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/* ------------------------------------------------------------- the window -- */

export interface ColumnPageInput {
  /** Every column the board has — Up for Grabs plus each shown Profile. */
  columnCount: number;
  /** How many whole columns fit, from the measured layout. */
  perRow: number;
  /** Wrapped rows of a grid, or one row paged by swipe (FR-395, FR-396). */
  mode: BoardLayoutMode;
}

export interface ColumnPage {
  /** True only when columns are actually being held back (FR-396). */
  paged: boolean;
  /** The first column on show, and one past the last. */
  start: number;
  end: number;
  /** One page later (`1`) or earlier (`-1`) — one column either way. */
  step: (direction: -1 | 1) => void;
}

/**
 * Which columns are on screen. The requested start is clamped on READ rather
 * than corrected by an effect, so a rotation that changes `perRow` — or a
 * Profile switched off the Tasks tab (FR-313) — lands on a legal page in the
 * same render, with no flash of an empty board and no second pass.
 */
export function useColumnPage({ columnCount, perRow, mode }: ColumnPageInput): ColumnPage {
  const [requested, setRequested] = useState(0);

  const step = useCallback(
    (direction: -1 | 1) =>
      setRequested((current) =>
        pageStartOf(pageStartOf(current, columnCount, perRow) + direction, columnCount, perRow),
      ),
    [columnCount, perRow],
  );

  const paged = mode === "pager" && columnCount > perRow;
  const start = paged ? pageStartOf(requested, columnCount, perRow) : 0;
  return { paged, start, end: paged ? start + perRow : columnCount, step };
}

/** FR-397: the swipe has a keyboard equivalent, on the group the columns sit in. */
function pageKeyOf(key: string): -1 | 1 | null {
  if (key === "ArrowRight") return 1;
  if (key === "ArrowLeft") return -1;
  return null;
}

/* ------------------------------------------------------------------ view -- */

export interface ColumnPagerProps {
  /** False on a board that fits: no gesture, no group, no live region. */
  paged: boolean;
  /** True while a press-and-hold reorder owns the pointer (T076). */
  suspended?: boolean;
  onPage: (direction: -1 | 1) => void;
  /** The columns currently on show, in order — announced after every step. */
  visibleLabels: readonly string[];
  /** What the group is called to a screen reader; the Tasks board's columns unless a board names its own. */
  label?: string;
  /** The board strip itself: the measured element and its columns. */
  children: ReactNode;
}

export function ColumnPager({
  paged,
  suspended = false,
  label = PAGER_LABEL,
  onPage,
  visibleLabels,
  children,
}: ColumnPagerProps) {
  // A press while a press-and-hold reorder owns the pointer is the reorder's,
  // not the pager's (T076) — decided at the press, like the calendar's blocks.
  const rejectWhileSuspended = useCallback(() => suspended, [suspended]);
  const { x, handlers } = useSwipePan(onPage, rejectWhileSuspended);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = pageKeyOf(event.key);
      if (step === null) return;
      event.preventDefault();
      onPage(step);
    },
    [onPage],
  );

  // A board that fits keeps the shipped structure exactly: the strip is the
  // board's own child, with nothing wrapped around it (FR-394's wall tablet).
  if (!paged) return <>{children}</>;

  return (
    // `overflow-x-clip` and not `hidden`: clip leaves the vertical axis
    // `visible`, so this never becomes a second scroll container over a
    // column's own — while a strip drawn past either side still cannot give
    // the page a horizontal scrollbar (FR-394, SC-315).
    <div className="flex min-h-0 flex-1 flex-col overflow-x-clip">
      <motion.div
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{ x }}
        className="flex min-h-0 flex-1 flex-col"
        onPanSessionStart={handlers.onPanSessionStart}
        onPan={handlers.onPan}
        onPanEnd={handlers.onPanEnd}
      >
        {children}
      </motion.div>
      <p role="status" aria-live="polite" className="sr-only">
        {`Showing ${columnsInWords(visibleLabels)}`}
      </p>
    </div>
  );
}
