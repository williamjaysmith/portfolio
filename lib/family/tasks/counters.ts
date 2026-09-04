/**
 * FR-305's denominator, fixed ONCE (R318). Every surface that says how much of
 * a day is done reads these three functions: the column's progress ring and
 * its completed-of-total count (FR-304, FR-305), the per-routine indicator
 * (FR-312), the Up for Grabs column's count (FR-308), the deferred whole-list
 * emoji rain's "every" (Assumption 21), the calendar's Tasks Progress display
 * and Phase 5's home screen. A rule re-implemented per surface is how a board
 * ends up reading 3/10 beside seven visible cards.
 *
 * The total is every one of that Profile's occurrences on the DISPLAYED day —
 * routines in each of their slots, chores due that day, undated anytime
 * chores, chores carried forward late, and any up-for-grabs occurrence that
 * Profile has claimed — LESS every skipped one. A skip leaves the total, not
 * merely the completed count (FR-360): ten with one skipped reads three of
 * nine, not three of ten (US4-5).
 *
 * These functions take the UNFILTERED occurrence list. "Filters never move the
 * counters" (FR-384, FR-386, SC-310) is a property of where they are called
 * from — above every display filter in `useBoardOccurrences`'s memo chain
 * (R317) — not of an `if` inside them, so there is deliberately nothing here
 * that knows a filter exists.
 *
 * Framework-free and pure: no React, no storage, no clock.
 */

import type { BoardOccurrence } from "../types";

/** A completed-of-total pair. `0 / 0` is the empty column's ring (FR-316). */
export interface TaskCounters {
  complete: number;
  total: number;
}

/**
 * One Profile's column: their own occurrences, plus any up-for-grabs
 * occurrence credited to them, which joins this column's total AND completed
 * count at the moment of the claim (FR-305, FR-367).
 */
export function columnCountersOf(
  occurrences: readonly BoardOccurrence[],
  profileId: string,
): TaskCounters {
  return countersOf(occurrences.filter((one) => inColumn(one, profileId)));
}

/**
 * One routine's own progress on the displayed day (FR-312) — the same column
 * membership and the same skip rule, narrowed to one task.
 */
export function routineProgressOf(
  occurrences: readonly BoardOccurrence[],
  taskId: string,
  profileId: string,
): TaskCounters {
  return countersOf(
    occurrences.filter((one) => one.taskId === taskId && inColumn(one, profileId)),
  );
}

/**
 * The Up for Grabs column's count (FR-308): occurrences that belong to nobody
 * and are still outstanding. A claim IS a resolution, so `unresolved` already
 * means no Profile has been credited — and a skipped up-for-grabs occurrence,
 * which credits nobody (FR-368), leaves this count as it leaves every other.
 */
export function upForGrabsCountOf(occurrences: readonly BoardOccurrence[]): number {
  return occurrences.filter((one) => one.assigneeId === null && one.state === "unresolved").length;
}

/** An occurrence is this Profile's own, or one they have claimed (FR-367). */
function inColumn(one: BoardOccurrence, profileId: string): boolean {
  if (one.assigneeId !== null) return one.assigneeId === profileId;
  return one.creditedCategoryId === profileId;
}

/** FR-360 in one place: a skip leaves the total, so it is dropped before both counts. */
function countersOf(column: readonly BoardOccurrence[]): TaskCounters {
  const counted = column.filter((one) => one.state !== "skipped");
  return {
    complete: counted.filter((one) => one.state === "complete").length,
    total: counted.length,
  };
}
