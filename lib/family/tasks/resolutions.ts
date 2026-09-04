/**
 * The resolution index — O(1) "is this occurrence resolved, and how" for the
 * board and for the actions that validate an occurrence key (R315).
 *
 * It is keyed EXACTLY as the store's uniqueness is keyed —
 * `(task_id, assignee_id, occurrence_date, occurrence_slot, cycle_prev)`, the
 * columns of `task_resolutions_occurrence_key` — so "the client and the
 * database agree about what an occurrence is" is structural rather than
 * conventional. A null in any column is a value of its own, exactly as
 * `unique nulls not distinct` treats it.
 *
 * The credited Profile is deliberately NOT part of the key. An unclaimed
 * up-for-grabs occurrence is looked up on `(taskId, occurrenceDate, slot)` with
 * a null assignee, ignoring the credit, because the credit is what a resolution
 * ESTABLISHES, not what identifies the occurrence it settles (R315).
 *
 * Skipped rows stay in the index and in the occurrence list: hiding them is the
 * filter layer's job (FR-361) and removing them from the denominator is the
 * counters' (FR-360).
 *
 * Framework-free and pure.
 */

import type { OccurrenceKey, OccurrenceState, TaskResolution } from "../types";

export type ResolutionIndex = ReadonlyMap<string, TaskResolution>;

// A uuid, an ISO date and a slot token contain no "|", so no two column sets
// can join to the same string.
const SEPARATOR = "|";

/** The five uniqueness columns as one lookup string. */
export function resolutionKeyOf(key: OccurrenceKey): string {
  return [
    key.taskId,
    key.assigneeId ?? "",
    key.occurrenceDate ?? "",
    key.slot ?? "",
    key.cyclePrev ?? "",
  ].join(SEPARATOR);
}

export function resolutionIndexOf(resolutions: readonly TaskResolution[]): ResolutionIndex {
  const index = new Map<string, TaskResolution>();
  for (const row of resolutions) {
    index.set(
      resolutionKeyOf({
        taskId: row.taskId,
        assigneeId: row.assigneeId,
        occurrenceDate: row.occurrenceDate,
        slot: row.occurrenceSlot,
        cyclePrev: row.cyclePrev,
      }),
      row,
    );
  }
  return index;
}

/** The row that settled this occurrence, or null while it is outstanding. */
export function resolutionAt(index: ResolutionIndex, key: OccurrenceKey): TaskResolution | null {
  return index.get(resolutionKeyOf(key)) ?? null;
}

/** Absence of a row IS "unresolved" — an endless routine stores nothing (Key Entities). */
export function resolutionStateOf(index: ResolutionIndex, key: OccurrenceKey): OccurrenceState {
  return resolutionAt(index, key)?.status ?? "unresolved";
}
