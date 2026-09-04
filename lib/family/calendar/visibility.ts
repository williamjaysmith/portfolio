/**
 * The filter rule (spec 002, T061) — the ONE place the grid decides whether an
 * occurrence is drawn.
 *
 * It is lib, not component logic, because it is a rule rather than a widget:
 * `FilterSheet` only writes ids into the per-device hidden set (Phase 1's
 * `useDeviceVisibility`, generic *category* ids — profiles and labels alike,
 * FR-266 / R212), and this module is what the week's memo chain applies.
 *
 * What it owes the spec:
 *
 * - **FR-265** — an event is shown while at least ONE category it carries is
 *   visible, and an event with no categories is ALWAYS shown. Hiding Cleo
 *   therefore leaves the Cleo-and-Ana event on the grid (US4 scenario 7).
 * - **FR-267** — filtering is display only: nothing here writes, and
 *   `visibleOccurrences` neither mutates its input nor its occurrences. A
 *   hidden category is still assigned, still coloured and still saved.
 * - **R206** — it is its OWN memo layer between expansion and layout, so a
 *   filter toggle re-filters without re-expanding the week. The unfiltered
 *   case returns the input array itself, so the common toggle-free render
 *   does not invalidate layout either.
 *
 * Framework-free and pure: no React, no storage, no clock.
 */

import type { Occurrence } from "../types";

/**
 * FR-265's truth table. `hiddenIds` may name categories the household has
 * since deleted; ids an event does not carry simply do not apply.
 */
export function isEventVisible(
  categoryIds: readonly string[],
  hiddenIds: ReadonlySet<string>,
): boolean {
  if (categoryIds.length === 0) return true;
  return categoryIds.some((categoryId) => !hiddenIds.has(categoryId));
}

/**
 * The expanded week, minus what this device is hiding — the same array when
 * nothing is hidden, so an unfiltered week keeps its memo identity (R206).
 */
export function visibleOccurrences(
  occurrences: Occurrence[],
  hiddenIds: ReadonlySet<string>,
): Occurrence[] {
  if (hiddenIds.size === 0) return occurrences;
  return occurrences.filter((occurrence) => isEventVisible(occurrence.categoryIds, hiddenIds));
}
