"use client";

import { Zap } from "lucide-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { BoardOccurrence, Task } from "@/lib/family/types";

/**
 * FR-372's habit-streak badge (T070) — the lightning bolt beside a routine's
 * name, counting the days in a row that person has completed it.
 *
 * **The number is read, never derived.** FR-371 makes the count stored
 * (`streak_count` on `family.task_assignees`, with the `streak_through` date
 * that lets a silent break be known — R311), the resolve action moves it
 * through `lib/family/tasks/streaks.ts` on the same write as the resolution,
 * and it rides embedded with the task rows, so a streak change arrives on the
 * invalidation the board already does and needs no cache key of its own
 * (R314). Nothing here counts a day: a second implementation of FR-373 beside
 * the one the badge must agree with is exactly what R311 rejected.
 *
 * **Never on a chore**, on any surface (FR-337), and never on a routine whose
 * Track Habit switch is off — both stated in `useTaskStreak`, so the badge
 * cannot be applied to one by mistake from a new call site.
 *
 * **How it reaches the card.** The streak belongs to a `(task, assignee)`
 * pair, not to an occurrence and not to a column, and every card on the board
 * wants it while no layer between the board and the card has any opinion about
 * it. So it arrives as one indexed lookup put up by `TasksBoard` over the task
 * rows it already holds, rather than as a prop threaded through the sections
 * and both columns. A card drawn with no board above it — every bare render in
 * the component suites — reads the empty index and draws nothing, which is
 * also the honest answer for a task row that has gone (FR-393).
 *
 * Geometry is **consumed** from `tokens.css` (T038 owns it) and not
 * re-committed: the shared badge pill the late mark also wears, so a card
 * carrying both reads as one family of marks rather than two ornaments. Its
 * one colour is `--fam-task-ink` — the ink the CARD chose for the fill it
 * actually drew, ≥ 4.5:1 against it by construction (FR-398) — so the badge is
 * legible on all twenty accents at both tints without a colour of its own.
 */

/** `taskId` + assignee, as one map key. The unit separator cannot occur in a uuid. */
function streakKeyOf(taskId: string, assigneeId: string): string {
  return `${taskId}\u001f${assigneeId}`;
}

/** Every tracked routine's stored count, by `(task, assignee)`. */
type StreakIndex = ReadonlyMap<string, number>;

/** What a card outside any board reads: nothing is tracked, so nothing is drawn. */
const NO_STREAKS: StreakIndex = new Map<string, number>();

const StreakContext = createContext<StreakIndex>(NO_STREAKS);

/**
 * The index, built once per task-rows identity. Untracked tasks are left out
 * rather than stored as zero: a chore's `streak_count` column exists and is
 * meaningless, and the surest way for it never to be shown is for it never to
 * be indexed (FR-337).
 */
function streakIndexOf(tasks: readonly Task[]): StreakIndex {
  const index = new Map<string, number>();
  for (const task of tasks) {
    if (!task.routine || !task.trackHabit) continue;
    for (const assignee of task.assignees) {
      index.set(streakKeyOf(task.id, assignee.categoryId), assignee.streakCount);
    }
  }
  return index;
}

export interface TaskStreaksProviderProps {
  /** The household's task rows, with their assignees' streak pair embedded (R314). */
  tasks: readonly Task[];
  children: ReactNode;
}

export function TaskStreaksProvider({ tasks, children }: TaskStreaksProviderProps) {
  const index = useMemo(() => streakIndexOf(tasks), [tasks]);
  return <StreakContext.Provider value={index}>{children}</StreakContext.Provider>;
}

/**
 * This occurrence's stored streak, or zero — which a card draws as no badge at
 * all. Zero is returned rather than the badge being asked to decide, so every
 * "there is no streak here" case has one answer: a chore, an untracked
 * routine, an occurrence belonging to nobody (FR-308), a task row that has
 * gone, and a card with no board above it.
 */
export function useTaskStreak(occurrence: BoardOccurrence): number {
  const index = useContext(StreakContext);
  if (!occurrence.routine || !occurrence.trackHabit) return 0;
  if (occurrence.assigneeId === null) return 0;
  return index.get(streakKeyOf(occurrence.taskId, occurrence.assigneeId)) ?? 0;
}

const BADGE =
  "inline-flex h-(--fam-task-badge-h) shrink-0 items-center gap-(--fam-task-badge-gap) " +
  "rounded-(--fam-task-badge-r) border-(length:--fam-task-badge-edge) border-(--fam-task-ink) " +
  "px-(--fam-task-badge-pad) text-(length:--fam-fs-small) font-medium tabular-nums";

export interface StreakBadgeProps {
  /** The stored count. Zero — a run of no days — is not a run, and draws nothing. */
  count: number;
}

export function StreakBadge({ count }: StreakBadgeProps) {
  if (count <= 0) return null;
  return (
    // Hidden from the reading order on purpose: the badge sits INSIDE the
    // card's body control, which carries an explicit accessible name that
    // already says the streak once (`TaskCard`), so announcing the digits here
    // would say it twice.
    <span data-streak-badge aria-hidden="true" className={BADGE}>
      <Zap className="h-(--fam-task-streak-icon) w-(--fam-task-streak-icon)" />
      {count}
    </span>
  );
}
