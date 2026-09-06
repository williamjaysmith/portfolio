import { ActionFailure } from "../errors";
import { addDays } from "../calendar/dates";
import { emitRule, parseRule, type RecurrenceRule, type RuleWeekday } from "../recurrence/grammar";
import type { RepeatChoice, WeekStart } from "../types";

/**
 * A meal's repeat is the calendar's rule (006 FR-627, FR-628, R602) in its
 * date-only form: the same four choices, a date `UNTIL`, never a count, never
 * an instant — a meal has no clock time. Emitted and parsed by the engine's
 * grammar, never hand-built.
 */

const REPEAT_NO_WEEKDAY = "Choose at least one weekday.";
const REPEAT_ENDS_TOO_SOON = "The repeat can't end before the meal's date.";

const WEEK_START_DAY: Record<WeekStart, RuleWeekday> = { 0: "SU", 1: "MO" };

function dayOfMonthOf(date: string): number {
  return Number(date.slice(8, 10));
}

function untilOf(until: string | null | undefined, date: string): RecurrenceRule["until"] {
  if (until === null || until === undefined || until === "") return null;
  if (until < date) throw new ActionFailure("VALIDATION", REPEAT_ENDS_TOO_SOON, { repeat: [REPEAT_ENDS_TOO_SOON] });
  return { kind: "date", date: until };
}

/** The choice as a canonical rule anchored on `date`, or `null` for a one-off. */
export function mealRuleOf(choice: RepeatChoice, date: string, startWeekOn: WeekStart): string | null {
  switch (choice.kind) {
    case "never":
      return null;
    case "daily":
      return emitRule({ freq: "DAILY", interval: 1, until: untilOf(choice.until, date) });
    case "weekly": {
      if (choice.weekdays.length === 0) {
        throw new ActionFailure("VALIDATION", REPEAT_NO_WEEKDAY, { repeat: [REPEAT_NO_WEEKDAY] });
      }
      return emitRule({
        freq: "WEEKLY",
        interval: 1,
        until: untilOf(choice.until, date),
        wkst: WEEK_START_DAY[startWeekOn],
        byDay: [...choice.weekdays],
      });
    }
    case "monthly":
      return emitRule({ freq: "MONTHLY", interval: 1, until: untilOf(choice.until, date), byMonthDay: dayOfMonthOf(date) });
  }
}

/** The stored rule as the form's choice — the round trip of `mealRuleOf`. */
export function mealRepeatChoiceOf(rrule: string | null): RepeatChoice {
  if (rrule === null) return { kind: "never" };
  const rule = parseRule(rrule);
  const until = rule.until === null ? null : rule.until.kind === "date" ? rule.until.date : null;
  if (rule.freq === "DAILY") return { kind: "daily", until };
  if (rule.freq === "WEEKLY") return { kind: "weekly", weekdays: [...rule.byDay], until };
  return { kind: "monthly", until };
}

/**
 * The head of a split (FR-629, R603): the same rule ending the day before the
 * cut. A rule that already ends before the cut is left as it is.
 */
export function truncatedMealRule(rrule: string, cut: string): string {
  const rule = parseRule(rrule);
  const lastDay = addDays(cut, -1);
  if (rule.until?.kind === "date" && rule.until.date <= lastDay) return rrule;
  return emitRule({ ...rule, until: { kind: "date", date: lastDay } });
}

/**
 * The same rule anchored on another date (a series moved at scope `all`, or
 * a tail that starts on the patched date): a monthly rule follows the new
 * date's day of month; daily and weekly rules are already date-free.
 */
export function reanchoredMealRule(rrule: string, date: string): string {
  const rule = parseRule(rrule);
  if (rule.freq !== "MONTHLY") return rrule;
  return emitRule({ ...rule, byMonthDay: dayOfMonthOf(date) });
}
