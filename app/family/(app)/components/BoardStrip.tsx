"use client";

import { useCallback, type ReactNode } from "react";

import type { ListReorder } from "./useListReorder";

/**
 * The columns' own element, and the one the geometry measures — shared by the
 * Tasks board (003 T046) and the Rewards tab (004 T032, R409), which is why it
 * lives here rather than beside either. It takes the callback ref as a plain
 * parameter — the shipped `WeekGrid`'s idiom — so the ref is never read off an
 * object mid-render.
 *
 * The rows are FR-395's wrap, and they are a CONSEQUENCE of the fit rather than
 * a second layout: the columns on show, laid into `perRow` tracks, take
 * `ceil(count / perRow)` rows of equal height — which is one row on the wall
 * tablet, one row on a paged phone (a page is always full), and the reference's
 * photographed two-by-two on a portrait tablet, with no branch anywhere that
 * names any of those three.
 *
 * **The column drag is the Tasks board's** (FR-309) and arrives as `reorder`;
 * the Rewards tab has no reorder (FR-422 draws the household's order and
 * nothing else) and passes nothing, so the strip is then only the grid.
 */

/** The two things the column drag lends the strip: its container binding, and whether a column is in hand. */
export type BoardStripReorder = Pick<ListReorder, "containerProps" | "active">;

/** A strip with no drag binds nothing and has nothing to spread. */
const IDLE_CONTAINER: { ref: undefined } = { ref: undefined };

export interface BoardStripProps {
  boardRef: (node: HTMLElement | null) => void;
  perRow: number;
  /** How many columns are actually drawn — a page's worth when paging. */
  count: number;
  /** FR-309: this element is also the column drag's container and its rows. Absent on a board with no drag. */
  reorder?: BoardStripReorder;
  children: ReactNode;
}

export function BoardStrip({ boardRef, perRow, count, reorder, children }: BoardStripProps) {
  const rows = Math.max(1, Math.ceil(count / perRow));
  const { ref: reorderRef, ...gestures } = reorder?.containerProps ?? IDLE_CONTAINER;
  const setBoard = useCallback(
    (node: HTMLElement | null) => {
      boardRef(node);
      reorderRef?.(node);
    },
    [boardRef, reorderRef],
  );
  return (
    // `.fam-board` is `overflow-x: hidden` (tokens.css): twenty occurrences are
    // reached by scrolling a COLUMN, and the page never scrolls sideways at any
    // width (FR-394, SC-315). The columns share the width in equal tracks —
    // `--fam-task-col-w` is what the fit divides by, never a drawn width — and
    // the rows share the height, so a wrapped column still scrolls its own body.
    <div
      data-board
      ref={setBoard}
      {...gestures}
      style={{
        gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        // A carried column follows the finger rather than scrolling the board.
        ...(reorder?.active ? { touchAction: "none" as const } : {}),
      }}
      className="fam-board grid min-h-0 flex-1 gap-(--fam-task-col-gap) overflow-y-auto px-(--fam-edge-inset) pb-(--fam-edge-inset)"
    >
      {children}
    </div>
  );
}
