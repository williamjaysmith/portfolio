"use client";

import { useMemo } from "react";

import { upForGrabsCountOf } from "@/lib/family/tasks/counters";
import type { BoardOccurrence } from "@/lib/family/types";

import { SectionToggleRow } from "./ColumnHeader";
import { ColumnBody } from "./SectionGroup";
import type { TaskSectionKey, SectionToggles } from "./useSectionToggles";

/**
 * The Up for Grabs column (T043, FR-308) — left-most, before every profile
 * column, because it belongs to everyone by belonging to nobody.
 *
 * It is deliberately NOT `ProfileColumn` with a placeholder Profile. There is
 * no avatar, no progress ring and no profile accent, and each absence has a
 * reason rather than being an omission: an avatar would show a face for a task
 * nobody owns, a ring would need a denominator that is nobody's day, and an
 * accent would put an unclaimed chore in someone's colour (Assumption 16). Its
 * panel is the neutral chrome, visibly outside the 20 / 40 / 100 tint ladder.
 *
 * Its one number is FR-308's count of UNCLAIMED occurrences, taken from the
 * board's UNFILTERED list like every other counter (R317). A claim is a
 * resolution, so a claimed occurrence has already left this count and joined
 * the crediting Profile's column (FR-367).
 *
 * The four section toggles are here because FR-306 puts them in EVERY column
 * header. Only chores can be up for grabs (FR-365), so the three time-of-day
 * sections are empty in practice — but the switch set is one thing, and a
 * column missing three of the four would read as a different control.
 */

/** The key this column identifies itself by to `useSectionToggles` (per-column overrides). */
export const UP_FOR_GRABS_COLUMN_ID = "up-for-grabs";

export const UP_FOR_GRABS_TITLE = "Up for Grabs";

export interface UpForGrabsColumnProps {
  /** The whole board's UNFILTERED occurrences (R317) — the count's only argument. */
  allOccurrences: readonly BoardOccurrence[];
  /** What this column draws: the visible unclaimed occurrences. */
  occurrences: readonly BoardOccurrence[];
  toggles: SectionToggles;
  onToggleSection: (section: TaskSectionKey) => void;
  /** `occurrenceKeyOf` of the occurrence whose write is in flight (FR-393). */
  busyKey?: string | null;
  onOpen: (occurrence: BoardOccurrence) => void;
  onResolve: (occurrence: BoardOccurrence) => void;
}

export function UpForGrabsColumn({
  allOccurrences,
  occurrences,
  toggles,
  onToggleSection,
  busyKey,
  onOpen,
  onResolve,
}: UpForGrabsColumnProps) {
  const unclaimed = useMemo(() => upForGrabsCountOf(allOccurrences), [allOccurrences]);

  return (
    <section
      aria-label={UP_FOR_GRABS_TITLE}
      data-column={UP_FOR_GRABS_COLUMN_ID}
      className="flex h-full min-h-0 w-full min-w-0 flex-col gap-(--fam-task-col-gap)"
    >
      <header
        role="group"
        aria-label={UP_FOR_GRABS_TITLE}
        className="flex flex-col gap-(--fam-task-header-gap) rounded-(--fam-task-col-r) bg-(--fam-pill-btn-bg) p-(--fam-task-header-pad)"
      >
        <span className="truncate font-(family-name:--fam-font-serif) text-(length:--fam-fs-title)">
          {UP_FOR_GRABS_TITLE}
        </span>
        <p
          aria-label={`${unclaimed} unclaimed`}
          className="w-fit rounded-(--fam-task-badge-r) bg-(--fam-app-bg) px-(--fam-task-badge-pad) py-(--fam-task-badge-gap) text-(length:--fam-fs-pill) tabular-nums"
        >
          {unclaimed}
        </p>
        <SectionToggleRow toggles={toggles} accent={null} onToggle={onToggleSection} />
      </header>
      <ColumnBody
        occurrences={occurrences}
        toggles={toggles}
        accent={null}
        emptyLabel="Nothing going spare"
        busyKey={busyKey}
        onOpen={onOpen}
        onResolve={onResolve}
      />
    </section>
  );
}
