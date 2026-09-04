/**
 * The habit-streak rule (FR-371, FR-373, FR-374) — one pure step, applied by
 * the resolution actions and by nothing else.
 *
 * The stored pair is `streak_count` + `streak_through` on `family.task_assignees`
 * (R311, migration 018). The date is not decoration: NOBODY WRITES ANYTHING on
 * the day a streak breaks, so a bare counter cannot know it has broken. Holding
 * the last date the count accounts for lets the caller replay the days that
 * have passed since — this module supplies the step, the action supplies the
 * days that routine actually ran on.
 *
 * `nextStreak` restates ONE day and is idempotent for that day: it is given the
 * day's occurrences as the write leaves them and as they stood before it, so
 * re-resolving a day already counted does not advance it twice and un-ticking
 * the day the checkpoint stands on steps back by exactly one (FR-374, SC-312).
 *
 * The board never reads this module (R311): the badge reads the stored number.
 *
 * Framework-free and pure: no React, no storage, no clock — "today" is a field.
 */

import { addDays } from "../calendar/dates";
import type { OccurrenceState } from "../types";

/** The stored checkpoint pair. `through` is the last date `count` accounts for. */
export interface StreakCheckpoint {
  count: number;
  /** Household-local `YYYY-MM-DD`; null while the count accounts for no day. */
  through: string | null;
}

/** One day of ONE routine for ONE person, as the stored resolutions leave it. */
export interface DayOutcome {
  /** The occurrences' household-local date — their scheduled day, never the write's. */
  date: string;
  /** The household-local date of the write: a day still running cannot break a streak. */
  todayDate: string;
  /** Every occurrence of that routine for that person on `date`, after the write. */
  states: readonly OccurrenceState[];
  /** The same occurrences before it — what the checkpoint already accounts for. */
  statesBefore: readonly OccurrenceState[];
}

/** FR-373's three readings of a day. A day with no occurrence is `protected`. */
type DayVerdict = "complete" | "protected" | "open";

/**
 * A day advances the count only when it HAS occurrences and every one of them
 * is complete — "every" over an empty day is vacuously true and must not count,
 * because a day the routine does not run is not a day of the streak.
 */
function verdictOf(states: readonly OccurrenceState[]): DayVerdict {
  if (states.some((state) => state === "unresolved")) return "open";
  if (states.length > 0 && states.every((state) => state === "complete")) return "complete";
  return "protected";
}

/**
 * Takes the day the checkpoint stands on back off it, so the day can be
 * restated from its new occurrences. Only a completed day put anything there.
 */
function withdraw(previous: StreakCheckpoint, day: DayOutcome): StreakCheckpoint {
  const counted = verdictOf(day.statesBefore) === "complete";
  return {
    count: counted ? Math.max(0, previous.count - 1) : previous.count,
    through: addDays(day.date, -1),
  };
}

/**
 * FR-373 itself. An open day breaks the streak only once it has ENDED: while it
 * is still running the checkpoint simply does not reach it yet, which is what
 * keeps a two-slot routine from resetting between its morning and its evening.
 */
function apply(base: StreakCheckpoint, verdict: DayVerdict, day: DayOutcome): StreakCheckpoint {
  if (verdict === "complete") return { count: base.count + 1, through: day.date };
  if (verdict === "protected") return { count: base.count, through: day.date };
  return day.date < day.todayDate ? { count: 0, through: day.date } : base;
}

/**
 * The checkpoint after `day`. Days are restated in order; a day the checkpoint
 * has already moved past is left alone, because the run behind a checkpoint is
 * not knowable from it — repairing one is a recompute, not a step.
 */
export function nextStreak(previous: StreakCheckpoint, day: DayOutcome): StreakCheckpoint {
  if (previous.through !== null && day.date < previous.through) return previous;
  const base = previous.through === day.date ? withdraw(previous, day) : previous;
  return apply(base, verdictOf(day.states), day);
}
