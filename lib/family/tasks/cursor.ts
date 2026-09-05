/**
 * The Completed Date chore's open occurrence, DERIVED from the chain tail
 * (FR-343, R309). Nothing about the future is stored: `tasks.next_due_date`
 * does not exist, so a mid-cycle edit moves this occurrence for free and there
 * is no second record of the same fact to disagree with the chain.
 *
 * Pure and total — a task that is not in cursor mode simply has none.
 *
 * The delay is DATE arithmetic, never instant arithmetic: FR-326's DST rules
 * apply to the chore's due time, carried unchanged onto every cycle, and never
 * to the interval.
 *
 * Framework-free: plain dates in, plain dates out.
 */

import { DAY_MS, datePartsOf, epochDayOf, isoOfEpochDay } from "../recurrence/plain-date";
import type { RenewUnit, TaskCursor } from "../types";

/** The slice of a task the derivation reads; `Task` satisfies it. */
export interface CursorTask {
  /** The chain's seed — a repeat always has an anchor (`task_repeat_needs_an_anchor`). */
  startsOn: string | null;
  /** `renewAfterAmount !== null` IS the mode; `0` is "Immediately" (FR-342). */
  renewAfterAmount: number | null;
  renewAfterUnit: RenewUnit | null;
  renewUntil: string | null;
}

/**
 * `date` plus a Completed Date delay. `day` and `week` are `+n` and `+7n`
 * epoch days; `month` is calendar-month addition CLAMPED to the last day of the
 * target month (31 Jan + 1 month = 28 Feb).
 *
 * The clamp is deliberately the opposite answer to `BYMONTHDAY=31` in rule
 * mode, where a month that has no such day simply produces nothing: a rule may
 * legitimately be silent in a month, a cursor must always land somewhere or the
 * chore is lost.
 */
export function addDelay(date: string, amount: number, unit: RenewUnit): string {
  const day = epochDayOf(date);
  if (unit === "day") return isoOfEpochDay(day + amount);
  if (unit === "week") return isoOfEpochDay(day + amount * 7);
  return addMonths(day, amount);
}

/**
 * The one open occurrence of a Completed Date chore, or `null` when there is
 * none — the task is not in cursor mode, or the date has passed `renewUntil`.
 *
 * `chainStartedOn` is the assignee row's creation date (the task's own for an
 * up-for-grabs task's household chain), so adding Ben to a chore whose due date
 * was six months ago starts him today rather than six months late.
 */
export function openOccurrence(
  task: CursorTask,
  tail: TaskCursor | null,
  chainStartedOn: string,
): { date: string } | null {
  if (task.renewAfterAmount === null || task.renewAfterUnit === null) return null;
  const date = tail
    ? addDelay(tail.tailResolvedOn, task.renewAfterAmount, task.renewAfterUnit)
    : seedOf(task.startsOn, chainStartedOn);
  // ISO dates compare lexicographically; `renewUntil` is inclusive.
  if (task.renewUntil !== null && date > task.renewUntil) return null;
  return { date };
}

/** The chain's head: the chore's own first due date, never before this assignee joined. */
function seedOf(startsOn: string | null, chainStartedOn: string): string {
  if (startsOn === null) return chainStartedOn;
  return startsOn > chainStartedOn ? startsOn : chainStartedOn;
}

function addMonths(day: number, months: number): string {
  const parts = datePartsOf(day);
  const total = parts.year * 12 + (parts.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  const clamped = Math.min(parts.day, daysInMonth(year, month));
  return isoOfEpochDay(Date.UTC(year, month - 1, clamped) / DAY_MS);
}

/** Day 0 of the next month is the last day of this one. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
