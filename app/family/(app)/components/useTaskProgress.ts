"use client";

import { useMemo } from "react";

import { weekStartOf } from "@/lib/family/calendar/dates";
import {
  useTaskCarryForward,
  useTaskCursors,
  useTaskResolutions,
  useTasks,
} from "@/lib/family/queries";
import { columnCountersOf, type TaskCounters } from "@/lib/family/tasks/counters";
import type { WeekStart } from "@/lib/family/types";

import { useTaskDay } from "../tasks/components/useTaskDay";

/**
 * Each Profile's completed-of-total for today (009 FR-911, FR-912, R905, R906),
 * read by the shell's `ProfileChipRow` and drawn on the chips themselves.
 *
 * The reference's Filter toggle "displays the task progress of visible profiles
 * above the events in all calendar views" [VERIFIED](36625171368987). 014 moved
 * it: the count belongs on the chip, where the reference itself draws it
 * ("Dad 1/20"), and the separate row above the calendar is gone — the operator
 * reported the two as redundant and asked for them combined into one row at the
 * top.
 *
 * **It defines no counting rule.** `columnCountersOf` in
 * `lib/family/tasks/counters.ts` is FR-305's denominator, fixed once, and its
 * own header already names this surface as one of its readers. A second rule
 * for what "done" means is how a board ends up reading 3/10 beside seven
 * visible cards, so this hook composes the shipped expansion and the shipped
 * counters and adds nothing.
 *
 * **Mounting is still the `enabled`** (`useTaskBox`'s shipped idiom, R905), but
 * what mounts it changed. The per-device Tasks Progress switch is gone — a
 * count the household always wants needs no switch, and the one it had was
 * flipped on as a side effect of the Filter sheet's "Show all", which is how
 * the operator met the old row without choosing it. The gate is now the CLOCK:
 * `ProfileChipRow` renders the counting child only once the household's today
 * is known, so the server render and the first paint issue no task read. That
 * is 012's rule, learned from `useTaskReads` fetching an epoch week on every
 * tab because a placeholder date looked like a real one.
 *
 * **The cost is honest and new**: the chip row is in the shell, so these reads
 * now happen on Lists and Meals too, where they did not before.
 *
 * **The cache is shared, not duplicated.** Three of the four reads are keyed by
 * the household alone (003 R314) and the fourth by the anchored week, so a
 * household that has opened the Tasks board this session pays nothing here, and
 * a chore ticked on either tab moves both.
 *
 * **Today, not the displayed day** (spec Assumption 7). The board is a
 * today-shaped board and the reference describes progress, not a history; a bar
 * whose numbers changed as the week was paged would be reporting on chores that
 * have not happened.
 */

export interface UseTaskProgressOptions {
  householdId: string;
  /** Household-local today — the ONLY day this reports on (Assumption 7). */
  todayDate: string;
  zone: string;
  /** `settings.startWeekOn` — what week the resolutions read is keyed by. */
  startWeekOn: WeekStart;
}

export interface TaskProgressState {
  /** One Profile's completed-of-total for today. `0 / 0` for nobody's chores. */
  counters: (profileId: string) => TaskCounters;
  /** True while a read the row actually needs is still on its first fetch. */
  isPending: boolean;
}

export function useTaskProgress({
  householdId,
  todayDate,
  zone,
  startWeekOn,
}: UseTaskProgressOptions): TaskProgressState {
  const weekStartDate = useMemo(
    () => weekStartOf(todayDate, startWeekOn),
    [todayDate, startWeekOn],
  );

  const tasks = useTasks(householdId);
  const week = useTaskResolutions(householdId, weekStartDate);
  // The board enables this only while its displayed day IS today (003 FR-357).
  // Here the displayed day is always today, so it is always enabled.
  const carry = useTaskCarryForward(householdId, todayDate, startWeekOn, true);
  const cursors = useTaskCursors(householdId);

  // The board's own concatenate-then-expand, shared rather than copied — the
  // same discipline `counters.ts` applies one layer up (003 R317).
  const occurrences = useTaskDay({
    tasks: tasks.data,
    week: week.data,
    carry: carry.data,
    cursors: cursors.data,
    displayedDate: todayDate,
    todayDate,
    zone,
  });

  // A closure over the UNFILTERED day, exactly as the board returns its own
  // (003 R317): no caller is handed the list, so no caller can count a
  // filtered one.
  const counters = useMemo(
    () => (profileId: string) => columnCountersOf(occurrences, profileId),
    [occurrences],
  );

  return { counters, isPending: tasks.isPending || week.isPending || cursors.isPending };
}
