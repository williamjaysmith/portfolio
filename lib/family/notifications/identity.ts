/**
 * What makes one reminder the same reminder as another (008 R808, FR-828).
 *
 * A banner is shown once per device, and this key is how a device remembers
 * what it has already shown. With no server and no delivery table, this is the
 * only definition of "the same reminder" the feature has — so it carries the
 * whole of FR-816 and FR-819's "not for an un-ticking".
 *
 *   scheduled  (kind, subject, occurrenceDate, fireAt)
 *   completion (subject, occurrenceDate)
 *
 * The instant is part of a SCHEDULED reminder's identity and not a
 * completion's, and both halves of that are deliberate:
 *
 *   * including `fireAt` is what makes "the event moved, so the new time is
 *     what reminds" fall out for free (FR-821). The old instant is gone; the
 *     new instant is a different reminder, judged on its merits. `fireAt` is
 *     DERIVED from stored data and never from the current clock, so a jittery
 *     clock cannot manufacture a second key;
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
 * A stable string key, for a `Set` of what this device has already shown.
 * Only ever compared with another key from this function — never parsed, never
 * shown to anybody, never stored anywhere but this browser.
 */
export function reminderKeyOf(identity: ReminderIdentity): string {
  const { subjectKind, subjectId, occurrenceDate, fireAtMs } = identity;
  if (subjectKind === "task_done") return `task_done:${subjectId}:${occurrenceDate}`;
  return `${subjectKind}:${subjectId}:${occurrenceDate}:${fireAtMs}`;
}
