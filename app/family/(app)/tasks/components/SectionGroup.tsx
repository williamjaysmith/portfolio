"use client";

import type { PaletteColor } from "@/lib/family/colors";
import type { TaskCounters } from "@/lib/family/tasks/counters";
import { sectionsOf } from "@/lib/family/tasks/layout";
import type { BoardOccurrence } from "@/lib/family/types";

import { TaskCard, occurrenceKeyOf } from "./TaskCard";
import type { TaskSectionKey } from "./useSectionToggles";

/**
 * FR-302's four sections, and the body every column shares (T042).
 *
 * The split itself is `sectionsOf` in `lib/family/tasks/layout.ts`: an
 * occurrence's own SLOT is its section, so a routine stays in the slot it was
 * generated for however the clock moves (FR-336), a chore falls into Chores,
 * and the Chores section arrives in FR-311's fixed order. Nothing here
 * re-derives any of that — it renders what the pure function returns.
 *
 * `ColumnBody` lives here rather than in either column because both columns
 * need exactly this: the four sections in canonical order, each drawn only
 * when its toggle is on, and one empty state when the visible list is empty
 * (FR-316). Two copies of it would be two places for the section order to
 * drift.
 */

/** The order a column draws its sections in — FR-302's own order. */
export const SECTION_ORDER: readonly TaskSectionKey[] = [
  "morning",
  "afternoon",
  "evening",
  "chores",
];

/** The four headings, and the four toggle labels — one wording for both. */
export const SECTION_LABELS: Record<TaskSectionKey, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  chores: "Chores",
};

/** FR-306's toggle faces: the three windows and the one that is not a time of day. */
export const SECTION_GLYPHS: Record<TaskSectionKey, string> = {
  morning: "🌤",
  afternoon: "☀️",
  evening: "🌙",
  chores: "🧹",
};

/**
 * What a card needs that the section itself does not decide — the board's own
 * half of the contract, shared by every renderer that draws a `TaskCard`.
 */
export interface TaskCardHandlers {
  /** FR-312, resolved against the UNFILTERED list by the column (R317). */
  progressOf?: (occurrence: BoardOccurrence) => TaskCounters | null;
  /** `occurrenceKeyOf` of the occurrence whose write is in flight (FR-393). */
  busyKey?: string | null;
  onOpen: (occurrence: BoardOccurrence) => void;
  onResolve: (occurrence: BoardOccurrence) => void;
}

export interface SectionGroupProps extends TaskCardHandlers {
  section: TaskSectionKey;
  occurrences: readonly BoardOccurrence[];
  /** The column's Profile accent; `null` in Up for Grabs (FR-308). */
  accent: PaletteColor | null;
}

/**
 * One section. An empty one draws nothing at all: four standing headings on a
 * column holding two tasks is noise, and the toggle's own ring already says
 * the section is on.
 */
export function SectionGroup({
  section,
  occurrences,
  accent,
  progressOf,
  busyKey,
  onOpen,
  onResolve,
}: SectionGroupProps) {
  if (occurrences.length === 0) return null;

  return (
    <section
      aria-label={SECTION_LABELS[section]}
      data-section={section}
      className="flex flex-col gap-(--fam-task-section-pad)"
    >
      <h3 className="font-(family-name:--fam-font-serif) text-(length:--fam-fs-section)">
        {SECTION_LABELS[section]}
      </h3>
      <ul className="flex list-none flex-col gap-(--fam-task-section-gap)">
        {occurrences.map((occurrence) => {
          const key = occurrenceKeyOf(occurrence);
          return (
            <TaskCard
              key={key}
              occurrence={occurrence}
              accent={accent}
              progress={progressOf?.(occurrence) ?? null}
              busy={busyKey === key}
              onOpen={onOpen}
              onResolve={onResolve}
            />
          );
        })}
      </ul>
    </section>
  );
}

export interface ColumnBodyProps extends TaskCardHandlers {
  /** The occurrences this column DRAWS — already filtered, already this column's. */
  occurrences: readonly BoardOccurrence[];
  toggles: Record<TaskSectionKey, boolean>;
  accent: PaletteColor | null;
  /** FR-316: what a column with nothing in it says instead of vanishing. */
  emptyLabel: string;
}

/**
 * The scrolling half of a column. It is its own `overflow-y` region so twenty
 * occurrences are reached by scrolling THIS column and the page never scrolls
 * sideways at any width (FR-394). `.fam-task-scroll` is that contract in
 * `tokens.css`, and carries the `overscroll-behavior: contain` that stops a
 * column which has run out of scroll handing the gesture to the board behind
 * it — on the wall tablet that reads as the whole board lurching.
 */
export function ColumnBody({
  occurrences,
  toggles,
  accent,
  emptyLabel,
  progressOf,
  busyKey,
  onOpen,
  onResolve,
}: ColumnBodyProps) {
  const sections = sectionsOf(occurrences);

  return (
    <div
      data-column-body
      className="fam-task-scroll flex min-h-0 flex-1 flex-col gap-(--fam-task-section-gap) overflow-y-auto p-(--fam-task-col-pad)"
    >
      {occurrences.length === 0 ? (
        <p className="text-(length:--fam-fs-body) text-(--fam-text-secondary)">{emptyLabel}</p>
      ) : (
        SECTION_ORDER.map((section) =>
          toggles[section] ? (
            <SectionGroup
              key={section}
              section={section}
              occurrences={sections[section]}
              accent={accent}
              progressOf={progressOf}
              busyKey={busyKey}
              onOpen={onOpen}
              onResolve={onResolve}
            />
          ) : null,
        )
      )}
    </div>
  );
}
