/**
 * "Cleo finished Practice piano" (008 FR-819, R811).
 *
 * The one notification anywhere in the reference that names a person — its
 * documented example is a real push banner reading "Olivia dried the dinner
 * dishes" [VERIFIED](54930439904923).
 *
 * Nothing is written for it. `family.task_resolutions` is already on the
 * realtime publication and already carries everything this needs, so an open
 * page learns of a completion through the channel it already subscribes to and
 * derives the announcement from the row. While this phase had Web Push in it a
 * delivery row was written in the completion's own transaction and sent
 * afterwards; without push there is nothing to send and nothing to record.
 *
 * Pure, like the rest of the engine: the clock and the reader's identity both
 * arrive as arguments.
 */

import { taskDoneMessage } from "./message";
import type { DueReminder } from "./due";
import type { NotificationSettings } from "./settings";
import type { TaskResolution } from "../types";

export interface CompletionContext {
  /** How the household names a Profile; null when the id names nobody it knows. */
  nameOf: (categoryId: string | null) => string | null;
  /**
   * The Profile punched in ON THIS DEVICE, or null.
   *
   * A completion is not announced back to the person who performed it: they are
   * looking at the card that just flipped, and a banner telling them what they
   * have just done is noise. With no push there is no second surface for it to
   * be useful on, so this is a suppression rather than a routing rule.
   */
  actorId: string | null;
}

/**
 * The announcements an open page should make for these resolutions.
 *
 * Filtering by the clock is the caller's job, as it is for every other kind —
 * `remindersDueNow` decides what is current, and this decides what is worth
 * announcing at all.
 */
export function completionNotices(
  resolutions: readonly TaskResolution[],
  summaryOf: (taskId: string) => string | null,
  settings: NotificationSettings,
  context: CompletionContext,
): DueReminder[] {
  if (!settings.taskCompleted) return [];

  const notices: DueReminder[] = [];
  for (const resolution of resolutions) {
    // A skip is not a completion, and neither is a row crediting nobody.
    if (resolution.status !== "complete" || resolution.categoryId === null) continue;
    // The person who ticked it is already looking at it.
    if (context.actorId !== null && resolution.createdBy === context.actorId) continue;

    const summary = summaryOf(resolution.taskId);
    const who = context.nameOf(resolution.categoryId);
    if (summary === null || who === null) continue;

    notices.push({
      identity: {
        subjectKind: "task_done",
        // The RESOLUTION row, not the task and date: a routine can be completed
        // in two slots on one day and an Anytime chore has no date at all, so
        // the pair would swallow one announcement and lose the other.
        subjectId: resolution.id,
        occurrenceDate: resolution.occurrenceDate,
        fireAtMs: Date.parse(resolution.resolvedAt),
      },
      ...taskDoneMessage(summary, who),
      path: "/family/tasks",
    });
  }
  return notices.sort((a, b) => a.identity.fireAtMs - b.identity.fireAtMs);
}
