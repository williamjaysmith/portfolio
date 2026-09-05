/**
 * A stored task's repeat, read back as the structured choice a form submits
 * (FR-334, FR-339–FR-346).
 *
 * This is the ONE direction the browser is allowed to take. Rule TEXT is
 * produced only by the server's emitter, from `TaskRepeatChoice`
 * (R201/R301) — but the edit form has to show the repeat a task actually has,
 * or it would offer "doesn't repeat" over a weekly chore and destroy it on
 * save. Decoding lives here rather than beside the form because the recurrence
 * grammar is a `lib/family/recurrence/**` module, which only the tasks and
 * calendar cores and the actions may import.
 *
 * One function, two consumers: the create/edit form seeds its controls from it,
 * and `updateTask` rebuilds the merged shape with it, so the shape the form
 * shows and the shape the server merges cannot drift.
 *
 * Framework-free and pure: plain columns in, a plain choice out.
 */

import { localDateOf } from "../calendar/dates";
import { parseRule, type RecurrenceRule, type RuleUntil } from "../recurrence/grammar";
import type { RenewUnit, TaskRepeatChoice } from "../types";

/** The slice of a task the decode reads; `Task` satisfies it. */
export interface RepeatSource {
  /** Canonical prefix-less rule text (R201); null = no rule-mode repeat. */
  rrule: string | null;
  /** `0` IS "Immediately" (FR-342); null = not a Completed Date chore. */
  renewAfterAmount: number | null;
  renewAfterUnit: RenewUnit | null;
  renewUntil: string | null;
}

/**
 * A stored `UNTIL` as the household-local date it admits. Tasks always write
 * the date form — the occurrence key is a date and the expander walks local
 * dates — but a rule authored elsewhere could carry an instant, so this stays
 * total rather than throwing on one.
 */
function untilDateOf(until: RuleUntil, zone: string): string {
  return until.kind === "date" ? until.date : localDateOf(zone, until.ms);
}

function choiceFromRule(rule: RecurrenceRule, zone: string): TaskRepeatChoice {
  const until = rule.until === null ? null : untilDateOf(rule.until, zone);
  if (rule.freq === "DAILY") return { kind: "daily", interval: rule.interval, until };
  if (rule.freq === "WEEKLY") {
    return { kind: "weekly", interval: rule.interval, weekdays: [...rule.byDay], until };
  }
  // BYMONTHDAY is derived from the anchor, never part of the choice.
  return { kind: "monthly", interval: rule.interval, until };
}

/**
 * Which repeat a stored task carries. The mode IS which fields are populated
 * (FR-339), and 017's `task_repeat_modes_exclusive` makes that unambiguous; a
 * half-written cursor row with no unit reads as `never` rather than inventing
 * one.
 */
export function taskRepeatChoiceOf(task: RepeatSource, zone: string): TaskRepeatChoice {
  if (task.renewAfterAmount !== null && task.renewAfterUnit !== null) {
    return {
      kind: "after_completion",
      amount: task.renewAfterAmount,
      unit: task.renewAfterUnit,
      until: task.renewUntil,
    };
  }
  if (task.rrule === null) return { kind: "never" };
  return choiceFromRule(parseRule(task.rrule), zone);
}
