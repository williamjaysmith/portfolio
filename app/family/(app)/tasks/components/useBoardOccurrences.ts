"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { addDays, weekStartOf } from "@/lib/family/calendar/dates";
import {
  prefetchTaskWeek,
  useStarWeek,
  useTaskCarryForward,
  useTaskCursors,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import { starsTodayOf } from "@/lib/family/rewards/stars";
import {
  columnCountersOf,
  routineProgressOf,
  upForGrabsCountOf,
  type TaskCounters,
} from "@/lib/family/tasks/counters";
import { expandTaskDay } from "@/lib/family/tasks/expand";
import { visibleTaskOccurrences } from "@/lib/family/tasks/visibility";
import type {
  BoardOccurrence,
  StarEntry,
  Task,
  TaskCursor,
  TaskResolution,
  WeekStart,
} from "@/lib/family/types";

import { useDeviceVisibility } from "../../components/useDeviceVisibility";
import { useTaskFilters } from "./useTaskFilters";

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
 *   useStarWeek (week) ──────────────────┐         │
 *                    ┌───────────────────┴─────────┴──────────────┐
 *                    ▼                                            ▼
 *        the counters, over the UNFILTERED list         visibleTaskOccurrences
 *        — ring, "n of m", Up for Grabs, per-routine,   — the two per-device
 *          and the day's stars per Profile (FR-407)       stores + the query
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
 * T068 slots the filter layer in below that branch and `use-board-occurrences
 * .test.ts` carries the standing assertion: toggling any of the four switches,
 * hiding any Profile or typing any query re-runs THIS memo and nothing above
 * it, and every counter reads the same afterwards.
 *
 * The two per-device stores are read HERE rather than threaded through the
 * board, exactly as the shipped `useWeekOccurrences` reads the category set
 * (R319): they are device preferences, not view state. The search string is
 * the opposite and arrives as a parameter — it is the board's own component
 * state, dies with the view, and is never persisted.
 *
 * The first four reads are R314's, and none of them is keyed by the displayed
 * day: task DEFINITIONS do not depend on it (an Anytime chore has no date, a
 * Completed Date chore's only occurrence is a cursor, a routine is a rule, a
 * late chore belongs on today), so stepping Previous/Next inside a week costs
 * zero fetches. Only the resolutions are windowed, by the anchored week, and
 * the FR-357 carry tail is a disjoint read enabled only while the displayed
 * day IS today. Neighbouring weeks are warmed once the day SETTLES, so the
 * pages flicked past while stepping never fetch.
 *
 * The fifth read (004 R407) is the anchored week's star entries — credits and
 * retractions, dated by the day they were EARNED — keyed by the SAME week as
 * the resolutions, so it rolls with them and costs nothing inside a week.
 * FR-407's pill is the displayed day's net per Profile, summed HERE in the
 * counters memo and not from the balance view (R402, Assumption 6): that is
 * what makes it roll to zero with the board at midnight and read yesterday's
 * stars on yesterday — and what puts it above the filter layer with every
 * other number, so no switch or query can move it.
 */

/** How long a day must stay displayed before its neighbouring weeks are warmed. */
const PREFETCH_SETTLE_MS = 250;

/** One week either side — the step a Previous/Next run crosses a boundary by. */
const WEEK_DAYS = 7;

const NO_OCCURRENCES: BoardOccurrence[] = [];
const NO_RESOLUTIONS: TaskResolution[] = [];
const NO_CURSORS: TaskCursor[] = [];
const NO_ENTRIES: StarEntry[] = [];

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
  /**
   * FR-386's search box, filtering the board in place as it is typed. A
   * PARAMETER, not a store: it is the board's own state and never persisted
   * (R319). Absent means no search, which is the identity-preserving case.
   */
  query?: string;
  /** The server-fetched reads, for a no-flicker first paint (R314). */
  initialTasks?: Task[];
  initialResolutions?: TaskResolution[];
  initialCarry?: TaskResolution[];
  initialCursors?: TaskCursor[];
  /** The fifth seed (004 R407): the anchored week's star entries, beside the resolutions. */
  initialStarWeek?: StarEntry[];
}

/**
 * FR-305's numbers, bound to the day's whole occurrence list. `column` and
 * `routine` take the PROFILE's category id; Up for Grabs has no profile and no
 * ring — it belongs to nobody (FR-308).
 *
 * `starsToday` is FR-407's pill: the stars a Profile EARNED on the displayed
 * day, credits less retractions, bound to the week's entries the same way. It
 * is a closure for the same reason the others are — no caller is handed the
 * entries, so no caller can sum the wrong day. Up for Grabs has none: stars
 * are credited to a Profile, and it belongs to nobody.
 */
export interface BoardCounters {
  column: (profileId: string) => TaskCounters;
  routine: (taskId: string, profileId: string) => TaskCounters;
  upForGrabs: number;
  starsToday: (profileId: string) => number;
}

export interface BoardOccurrencesState {
  /** What the board draws — the day, less every display filter (FR-383, FR-386). */
  occurrences: BoardOccurrence[];
  /**
   * The WHOLE displayed day, above the filter layer — the list `counters` was
   * computed from, and the list every number drawn above a card must be
   * computed from too (R317, R318).
   *
   * It is exposed because the columns own numbers this hook cannot pre-compute
   * for them: `ProfileColumn` reads FR-305's ring and FR-312's per-routine
   * indicator off it, and `UpForGrabsColumn` reads FR-308's count, each for a
   * Profile only it knows. Handing them `occurrences` instead is the exact bug
   * FR-384 and FR-386 forbid — every count on the board moves as a filter is
   * toggled or a query is typed — so the two lists are named apart here rather
   * than being told apart at four call sites: whatever a component is counting,
   * it is counting the day.
   */
  allOccurrences: BoardOccurrence[];
  counters: BoardCounters;
  /** True while a read the board actually needs is still on its first fetch. */
  isPending: boolean;
  error: Error | null;
}

/**
 * The five cached reads, taken together so the chain below them is a chain of
 * memos and nothing else. Each is keyed exactly as R314 and R407 say: the
 * definitions and the cursor tails by the household alone, the resolutions and
 * the star week by the anchored week, the carry tail by today and only while
 * the displayed day IS today. The seeds go to the key each was fetched for.
 */
function useBoardReads(
  options: UseBoardOccurrencesOptions,
  weekStartDate: string,
  isToday: boolean,
) {
  const { householdId, todayDate, startWeekOn } = options;
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
  // The fifth read (004 R407), keyed by the SAME anchored week as the
  // resolutions so the two roll together and stepping inside a week is free.
  const stars = useStarWeek(householdId, weekStartDate, options.initialStarWeek);
  return { tasks, week, carry, cursors, stars };
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

  const { tasks, week, carry, cursors, stars } = useBoardReads(options, weekStartDate, isToday);
  const entries = stars.data ?? NO_ENTRIES;

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

  // FR-407's pill lives HERE, in the counters memo, and not in a layer of its
  // own: it is bound to the displayed day the same way the others are bound to
  // the day's occurrences, and it sits above the filter branch with them.
  const counters = useMemo<BoardCounters>(
    () => ({
      column: (profileId) => columnCountersOf(occurrences, profileId),
      routine: (taskId, profileId) => routineProgressOf(occurrences, taskId, profileId),
      upForGrabs: upForGrabsCountOf(occurrences),
      starsToday: (profileId) => starsTodayOf(entries, profileId, displayedDate),
    }),
    [occurrences, entries, displayedDate],
  );

  // The filter layer (T068), and the whole point of its position: it reads the
  // device's hidden categories, the four task switches and the typed query,
  // and it sits BELOW the counters, so none of the three can move a number
  // (FR-384, FR-386, SC-310, SC-320).
  const { hiddenIds } = useDeviceVisibility();
  const { filters } = useTaskFilters();
  const query = options.query ?? "";
  const visible = useMemo(
    () => visibleTaskOccurrences(occurrences, hiddenIds, filters, query),
    [occurrences, hiddenIds, filters, query],
  );

  usePrefetchNeighbourWeeks(householdId, weekStartDate);

  return {
    occurrences: visible,
    allOccurrences: occurrences,
    counters,
    isPending: pendingOf({ tasks, week, carry, cursors, stars, isToday }),
    error: tasks.error ?? week.error ?? carry.error ?? cursors.error ?? stars.error ?? null,
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
  /** The star week (004 R407): a board painting 0 stars before they arrive is a wrong board. */
  stars: ReadState;
  isToday: boolean;
}

/**
 * A DISABLED React Query reports `isPending` for ever, so the carry read only
 * counts while FR-357 has it enabled — otherwise a pinned past day would show
 * a loading state that can never resolve (US3-3).
 */
function pendingOf(reads: BoardReads): boolean {
  const always = [reads.tasks, reads.week, reads.cursors, reads.stars];
  if (always.some((read) => read.isPending)) return true;
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
