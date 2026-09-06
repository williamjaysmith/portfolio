"use client";

import type { ReactNode } from "react";

import { BoardStrip, type BoardStripReorder } from "./BoardStrip";
import { ColumnPager, type ColumnPage } from "./ColumnPager";

/**
 * The window of columns a measured board shows (003 FR-394–FR-396): every
 * column when they all fit, a page of them when they do not — `ColumnPager`
 * around `BoardStrip` around the visible slice. Shared by the Rewards and Lists
 * boards (the gate caught the two copies; this is the extraction); the Tasks
 * board composes the same two pieces with its column drag in between.
 */

/** One drawn column and the name the pager announces it by. */
export interface PagedColumn {
  label: string;
  node: ReactNode;
}

export interface PagedColumnsProps {
  page: ColumnPage;
  boardRef: (node: HTMLElement | null) => void;
  perRow: number;
  /** Every column the board has, in order — this component shows the page's window of it. */
  columns: readonly PagedColumn[];
  /** The board's column gap; the Tasks token unless a board brings its own. */
  gapClassName?: string;
  /** A board whose columns drag lends the strip its binding (the Tasks board). */
  reorder?: BoardStripReorder;
  /** True while a press-and-hold reorder inside a column owns the pointer: the swipe stands down. */
  suspended?: boolean;
}

export function PagedColumns({ page, boardRef, perRow, columns, gapClassName, reorder, suspended }: PagedColumnsProps) {
  const visible = columns.slice(page.start, page.end);
  return (
    <ColumnPager
      paged={page.paged}
      suspended={suspended}
      onPage={page.step}
      visibleLabels={visible.map((column) => column.label)}
    >
      <BoardStrip boardRef={boardRef} perRow={perRow} count={visible.length} gapClassName={gapClassName} reorder={reorder}>
        {visible.map((column) => column.node)}
      </BoardStrip>
    </ColumnPager>
  );
}
