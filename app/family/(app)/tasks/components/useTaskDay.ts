"use client";

import { useMemo } from "react";

import { expandTaskDay } from "@/lib/family/tasks/expand";
import type { BoardOccurrence, Task, TaskCursor, TaskResolution } from "@/lib/family/types";

/**
 * One displayed day's task occurrences, from the four reads that produce them
 * (003 R314, R317).
 *
 * Extracted in 009 because a second surface needed exactly this: the calendar's
 * Tasks Progress row reads today's occurrences to count them (009 FR-912,
 * R906), and it must not re-derive the expansion the board already does. Two
 * copies of "concatenate the two resolution reads, then expand" is precisely
 * the drift `counters.ts` was written to prevent one layer up.
 *
 * The two resolution reads are DISJOINT by construction (R314) — the carry tail
 * ends the day before the week the other covers begins — so this is a
 * concatenation and never a merge.
 *
 * The list it returns is the WHOLE day, above any display filter. That is the
 * list the counters must be computed from (R317, R318); the board's filter
 * layer sits below its caller, not inside this.
 */

const NO_OCCURRENCES: BoardOccurrence[] = [];
const NO_RESOLUTIONS: TaskResolution[] = [];
const NO_CURSORS: TaskCursor[] = [];

export interface TaskDayInputs {
  /** `useTasks`' rows; `undefined` while the definitions are still loading. */
  tasks: Task[] | undefined;
  /** The anchored week's resolutions. */
  week: TaskResolution[] | undefined;
  /** FR-357's carry tail — present only while the displayed day IS today. */
  carry: TaskResolution[] | undefined;
  cursors: TaskCursor[] | undefined;
  /** The board day being expanded. */
  displayedDate: string;
  /** Household-local today — what makes a chore late, and what carries. */
  todayDate: string;
  zone: string;
}

export function useTaskDay(inputs: TaskDayInputs): BoardOccurrence[] {
  const { tasks, week, carry, cursors, displayedDate, todayDate, zone } = inputs;

  const resolutions = useMemo(
    () => [...(week ?? NO_RESOLUTIONS), ...(carry ?? NO_RESOLUTIONS)],
    [week, carry],
  );

  return useMemo(
    () =>
      tasks === undefined
        ? NO_OCCURRENCES
        : expandTaskDay(tasks, resolutions, cursors ?? NO_CURSORS, {
            displayedDate,
            todayDate,
            zone,
          }),
    [tasks, resolutions, cursors, displayedDate, todayDate, zone],
  );
}
