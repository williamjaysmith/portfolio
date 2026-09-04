"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { addDays, weekStartOf } from "@/lib/family/calendar/dates";
import {
  prefetchTaskWeek,
  useTaskCarryForward,
  useTaskCursors,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import {
  columnCountersOf,
  routineProgressOf,
  upForGrabsCountOf,
  type TaskCounters,
} from "@/lib/family/tasks/counters";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import type {
  BoardOccurrence,
  Task,
  TaskCursor,
  TaskResolution,
  WeekStart,
} from "@/lib/family/types";

/**
 * T039 / R317: the board's one data path from the cached reads to drawn cards,
 * as memo layers that invalidate independently — the Tasks analogue of the
 * shipped `useWeekOccurrences`:
 *
 *   useTasks (household)      ─┐
 *   useTaskResolutions (week) ─┼─→ one resolution set          ── memo
 *   useTaskCarryForward (today, enabled) ─┘        │
 *                                                  ▼
 *                          expandTaskDay(...) → BoardOccurrence[]   ── memo
 *                                                  │
 *                    ┌─────────────────────────────┴──────────────┐
 *                    ▼                                            ▼
 *        the counters, over the UNFILTERED list         visibleTaskOccurrences
 *        — ring, "n of m", Up for Grabs, per-routine    (a pass-through until T067)
 *
 * **The counters branch off the unfiltered list, and that is the whole point.**
 * FR-384 ("filters never move the counters"), FR-386's same promise for
 * search, US4-1, US4-13 and SC-310 hold as a property of this graph rather
 * than as an `if` in four components: toggling a filter or typing in the
 * search box re-runs the layer BELOW the branch and cannot reach the counters
 * at all. They are returned as closures over that list precisely so no caller
 * is ever handed it — "pass the filtered list to the counters" is then not a
 * mistake anyone can make.
 *
 * The graph's shape is asserted at T068 rather than here, and deliberately:
 * until T067 lands the filter store and T069 the search box there is nothing
 * to toggle and nothing to type, so the assertion would have no input to move.
 * `tasks-counters.test.ts`'s table carries the guarantee at the pure-function
 * level for the whole of US1–US3.
 *
 * The four reads are R314's, and none of them is keyed by the displayed day:
 * task DEFINITIONS do not depend on it (an Anytime chore has no date, a
 * Completed Date chore's only occurrence is a cursor, a routine is a rule, a
 * late chore belongs on today), so stepping Previous/Next inside a week costs
 * zero fetches. Only the resolutions are windowed, by the anchored week, and
 * the FR-357 carry tail is a disjoint read enabled only while the displayed
 * day IS today. Neighbouring weeks are warmed once the day SETTLES, so the
 * pages flicked past while stepping never fetch.
 */

/** How long a day must stay displayed before its neighbouring weeks are warmed. */
const PREFETCH_SETTLE_MS = 250;

/** One week either side — the step a Previous/Next run crosses a boundary by. */
const WEEK_DAYS = 7;

const NO_OCCURRENCES: BoardOccurrence[] = [];
const NO_RESOLUTIONS: TaskResolution[] = [];
const NO_CURSORS: TaskCursor[] = [];

export interface UseBoardOccurrencesOptions {
  householdId: string;
  /** The board's displayed household-local day (`YYYY-MM-DD`). */
  displayedDate: string;
  /** Household-local date of now — what rolls the carry read at midnight. */
  todayDate: string;
  /** Household IANA zone (FR-284); every expansion works in it. */
  zone: string;
  /** `settings.start_week_on` — what week the resolutions read is keyed by. */
  startWeekOn: WeekStart;
  /** The server-fetched reads, for a no-flicker first paint (R314). */
  initialTasks?: Task[];
  initialResolutions?: TaskResolution[];
  initialCarry?: TaskResolution[];
  initialCursors?: TaskCursor[];
}

/**
 * FR-305's numbers, bound to the day's whole occurrence list. `column` and
 * `routine` take the PROFILE's category id; Up for Grabs has no profile and no
 * ring — it belongs to nobody (FR-308).
 */
export interface BoardCounters {
  column: (profileId: string) => TaskCounters;
  routine: (taskId: string, profileId: string) => TaskCounters;
  upForGrabs: number;
}

export interface BoardOccurrencesState {
  /** What the board draws — below every display filter (a pass-through until T068). */
  occurrences: BoardOccurrence[];
  counters: BoardCounters;
  /** True while a read the board actually needs is still on its first fetch. */
  isPending: boolean;
  error: Error | null;
}

export function useBoardOccurrences(
  options: UseBoardOccurrencesOptions,
): BoardOccurrencesState {
  const { householdId, displayedDate, todayDate, zone, startWeekOn } = options;

  // Today by DATE, not by how the anchor got here: a person who tapped
  // Previous then Next is on today's date and gets today's carry-ins, and at
  // midnight a pinned day stops being today while the anchor does not move.
  const isToday = displayedDate === todayDate;
  const weekStartDate = useMemo(
    () => weekStartOf(displayedDate, startWeekOn),
    [displayedDate, startWeekOn],
  );

  const tasks = useTasks(householdId, options.initialTasks);
  const week = useTaskResolutions(householdId, weekStartDate, options.initialResolutions);
  const carry = useTaskCarryForward(
    householdId,
    todayDate,
    startWeekOn,
    isToday,
    options.initialCarry,
  );
  const cursors = useTaskCursors(householdId, options.initialCursors);

  // The two resolution reads are disjoint by construction (R314), so this is a
  // concatenation and never a merge: the carry tail ends the day before the
  // week the other one covers begins.
  const resolutions = useMemo(
    () => [...(week.data ?? NO_RESOLUTIONS), ...(carry.data ?? NO_RESOLUTIONS)],
    [week.data, carry.data],
  );

  const occurrences = useMemo(
    () =>
      tasks.data === undefined
        ? NO_OCCURRENCES
        : expandTaskDay(tasks.data, resolutions, cursors.data ?? NO_CURSORS, {
            displayedDate,
            todayDate,
            zone,
          }),
    [tasks.data, resolutions, cursors.data, displayedDate, todayDate, zone],
  );

  const counters = useMemo<BoardCounters>(
    () => ({
      column: (profileId) => columnCountersOf(occurrences, profileId),
      routine: (taskId, profileId) => routineProgressOf(occurrences, taskId, profileId),
      upForGrabs: upForGrabsCountOf(occurrences),
    }),
    [occurrences],
  );

  // The filter layer's seat, held open. T068 replaces this alias with
  // `visibleTaskOccurrences(occurrences, hiddenIds, filters, query)` as a memo
  // of its own — BELOW the counters, which is what keeps FR-384 structural.
  const visible = occurrences;

  usePrefetchNeighbourWeeks(householdId, weekStartDate);

  return {
    occurrences: visible,
    counters,
    isPending: pendingOf({ tasks, week, carry, cursors, isToday }),
    error: tasks.error ?? week.error ?? carry.error ?? cursors.error ?? null,
  };
}

/** Just enough of a React Query result for the two states the board reads. */
interface ReadState {
  isPending: boolean;
  error: Error | null;
}

interface BoardReads {
  tasks: ReadState;
  week: ReadState;
  carry: ReadState;
  cursors: ReadState;
  isToday: boolean;
}

/**
 * A DISABLED React Query reports `isPending` for ever, so the carry read only
 * counts while FR-357 has it enabled — otherwise a pinned past day would show
 * a loading state that can never resolve (US3-3).
 */
function pendingOf(reads: BoardReads): boolean {
  if (reads.tasks.isPending || reads.week.isPending || reads.cursors.isPending) return true;
  return reads.isToday && reads.carry.isPending;
}

/**
 * Warms the week either side once the displayed day settles, so a Previous or
 * Next tap across a week boundary lands on data already there. A short delay
 * filters out the days stepped past while holding the arrow, and React Query
 * dedupes whatever remains.
 */
function usePrefetchNeighbourWeeks(householdId: string, weekStartDate: string): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const offset of [-WEEK_DAYS, WEEK_DAYS]) {
        void prefetchTaskWeek(queryClient, householdId, addDays(weekStartDate, offset));
      }
    }, PREFETCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [queryClient, householdId, weekStartDate]);
}
