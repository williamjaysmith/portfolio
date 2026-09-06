"use client";

import { useCallback, useMemo } from "react";

import type { ColumnSections } from "@/lib/family/tasks/layout";
import type { Reorder } from "@/lib/family/tasks/reorder";
import type { BoardOccurrence, TimeOfDay } from "@/lib/family/types";

import { useListReorder, type ListReorder } from "../../components/useListReorder";

/**
 * T076: the Tasks board's two reorders (FR-309, FR-310, FR-397, R321), as
 * bindings of the shared press-and-hold machine — `useListReorder`, which moved
 * to `app/family/(app)/components/` when the Lists tab became its third
 * consumer (005 T005, R507). What stays here is what only this board knows:
 * FR-309's reconstruction of the household order from the drawn columns, and
 * FR-310's three per-section routine lists.
 */

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
