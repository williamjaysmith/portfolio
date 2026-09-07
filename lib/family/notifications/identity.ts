/**
 * What makes one reminder the same reminder as another (008 R808, FR-828).
 *
 * This is the client-side twin of migration 036's two partial unique indexes,
 * and the two MUST agree: the browser uses these keys to remember what it has
 * already shown on this device, the database uses the indexes to guarantee
 * that a reminder is sent once. If they disagreed, a device would dismiss one
 * thing and be sent another.
 *
 *   scheduled  (household, kind, subject, occurrenceDate, fireAt)
 *   completion (household, subject, occurrenceDate)
 *
 * The instant is part of a SCHEDULED reminder's identity and not a
 * completion's, and both halves of that are deliberate:
 *
 *   * including `fireAt` is what makes "the event moved, so the new time is
 *     what reminds" fall out for free (FR-821). The old instant was claimed
 *     and is gone; the new instant is a different reminder, judged on its
 *     merits. `fireAt` is DERIVED from stored data and never from the current
 *     clock, so a jittery clock cannot manufacture a second key;
 *
 *   * excluding it from a completion is the whole of FR-819's "not for an
 *     un-ticking": a chore un-ticked and re-ticked an hour later is the same
 *     occurrence, and says nothing the second time.
 */

import type { ReminderSubjectKind } from "../types";

export interface ReminderIdentity {
  subjectKind: ReminderSubjectKind;
  /** The event or task row this reminder is about. */
  subjectId: string;
  /** The occurrence's ORIGINAL household-local date — Phase 2's key (R204). */
  occurrenceDate: string;
  /** The instant it fires, in epoch milliseconds. */
  fireAtMs: number;
}

/**
 * A stable string key. Only ever compared with another key from this
 * function — never parsed, never shown, never stored in the database.
 */
export function reminderKeyOf(identity: ReminderIdentity): string {
  const { subjectKind, subjectId, occurrenceDate, fireAtMs } = identity;
  if (subjectKind === "task_done") return `task_done:${subjectId}:${occurrenceDate}`;
  return `${subjectKind}:${subjectId}:${occurrenceDate}:${fireAtMs}`;
}

/** Whether two reminders are the same reminder, by the rule above. */
export function sameReminder(left: ReminderIdentity, right: ReminderIdentity): boolean {
  return reminderKeyOf(left) === reminderKeyOf(right);
}
