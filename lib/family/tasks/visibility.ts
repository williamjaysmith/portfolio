/**
 * T066 / R319: the Tasks board's filter rule — the ONE place the board decides
 * whether a card is drawn, and the exact analogue of `calendar/visibility.ts`.
 *
 * FR-383 names five controls (Completed tasks, Late chores, Skipped tasks, Up
 * for Grabs, and a show/hide toggle per Profile) and FR-386 adds the search
 * box; all six meet here as **one predicate each, composed by a list**, so the
 * table this module owes the spec is a table and not a six-arm condition.
 *
 * What it owes:
 *
 * - **FR-383** — the Late chores control shows and hides the FR-357
 *   carry-forwards *without affecting chores due on the displayed day*, which
 *   is `isLate` exactly: `expandTaskDay` sets it only on an occurrence drawn
 *   past its own date.
 * - **FR-361** — skipped occurrences appear only while their switch is on.
 * - **FR-384** — filtering is display only. Nothing here writes, nothing here
 *   mutates, and the counters cannot see it: they are computed ABOVE this
 *   layer in `useBoardOccurrences`'s memo chain (R317), so no filter and no
 *   query can move a number.
 * - **FR-386 / SC-320** — the search matches a title or a description, trimmed
 *   and case-insensitively, across every column including Up for Grabs.
 * - **R319** — its own memo layer, returning the input array itself when
 *   nothing is filtered, so an untouched board keeps its memo identity.
 *
 * The per-Profile set is the shipped device store's generic *category* ids, so
 * a Profile hidden on the calendar is hidden here too — one device preference,
 * one **Show all**. It is a different thing from FR-313's household-wide
 * **Show on Tasks tab**, which removes the column everywhere and withdraws the
 * Profile from the assignment picker.
 *
 * Framework-free and pure: no React, no storage, no clock.
 */

import type { BoardOccurrence, TaskFilters } from "../types";

/** Keep this occurrence on the board? One filter's whole opinion. */
type OccurrencePredicate = (occurrence: BoardOccurrence) => boolean;

/**
 * Whose column an occurrence is drawn in — its chain's owner, or the Profile a
 * claim credited (FR-367). `null` is the Up for Grabs column: it belongs to
 * nobody (FR-308), which is why no per-Profile toggle can hide it. Stated to
 * agree with `boardColumnsOf` and `columnCountersOf`'s `inColumn` (R318).
 */
function ownerOf(occurrence: BoardOccurrence): string | null {
  return occurrence.assigneeId ?? occurrence.creditedCategoryId;
}

/**
 * The four switches, each paired with what it keeps when it is OFF. On, a
 * switch adds no predicate at all — which is what leaves an unfiltered board
 * holding its own array.
 */
const SWITCH_PREDICATES: readonly (readonly [keyof TaskFilters, OccurrencePredicate])[] = [
  ["completed", (occurrence) => occurrence.state !== "complete"],
  ["late", (occurrence) => !occurrence.isLate],
  ["skipped", (occurrence) => occurrence.state !== "skipped"],
  ["upForGrabs", (occurrence) => ownerOf(occurrence) !== null],
];

/** FR-386: title or description, against an already-trimmed lowercase needle. */
function matchesQuery(occurrence: BoardOccurrence, needle: string): boolean {
  const haystack = `${occurrence.summary}\n${occurrence.description ?? ""}`;
  return haystack.toLowerCase().includes(needle);
}

/** Every filter that is actually doing something, and nothing that is not. */
function predicatesFor(
  hiddenIds: ReadonlySet<string>,
  filters: TaskFilters,
  query: string,
): OccurrencePredicate[] {
  const predicates = SWITCH_PREDICATES.filter(([key]) => !filters[key]).map(([, keep]) => keep);

  if (hiddenIds.size > 0) {
    predicates.push((occurrence) => {
      const owner = ownerOf(occurrence);
      return owner === null || !hiddenIds.has(owner);
    });
  }

  const needle = query.trim().toLowerCase();
  if (needle.length > 0) predicates.push((occurrence) => matchesQuery(occurrence, needle));

  return predicates;
}

/**
 * The displayed day, minus what this device is hiding and what the search box
 * excludes — the same array when nothing is filtered, so the common untouched
 * render does not invalidate the layers below (R319).
 */
export function visibleTaskOccurrences(
  occurrences: BoardOccurrence[],
  hiddenIds: ReadonlySet<string>,
  filters: TaskFilters,
  query: string,
): BoardOccurrence[] {
  const predicates = predicatesFor(hiddenIds, filters, query);
  if (predicates.length === 0) return occurrences;
  return occurrences.filter((occurrence) => predicates.every((keep) => keep(occurrence)));
}
