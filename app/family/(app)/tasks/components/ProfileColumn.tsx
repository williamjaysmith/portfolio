"use client";

import { useCallback, useMemo, type CSSProperties } from "react";

import { profileVars } from "@/lib/family/colors";
import { columnCountersOf, routineProgressOf } from "@/lib/family/tasks/counters";
import type { BoardOccurrence, Category } from "@/lib/family/types";

import { ColumnHeader } from "./ColumnHeader";
import { ColumnBody } from "./SectionGroup";
import type { TaskSectionKey, SectionToggles } from "./useSectionToggles";

/**
 * One column per Profile (T042, FR-301).
 *
 * It takes TWO lists, and the difference between them is the whole of R317.
 * `allOccurrences` is the board's UNFILTERED set and is the only thing the
 * counters ever see, so a display filter or a search string cannot move the
 * ring or the count (FR-384, FR-386, SC-310). `occurrences` is what this
 * column DRAWS: this Profile's visible slice, split out above by the board,
 * which is also why the column-membership rule is not re-implemented here —
 * `columnCountersOf` owns it, once (R318).
 *
 * A Profile with nothing to do still gets a column, a header and a zero-of-
 * zero count (FR-316): a person who has finished must not disappear from the
 * board, and neither must one who was never given anything.
 *
 * The column fills the track the board gives it rather than the width of
 * `--fam-task-col-w`: that token is what the FIT divides by (`boardLayoutOf`),
 * never a drawn width — the columns on show always stretch to share the board
 * (FR-394, `tokens.css`).
 *
 * The accent is set once on this element as `--profile`, and `.fam-profile`
 * derives every rung from it — the 20 % header panel, the 40 % and full-
 * strength cards, the deepened disc and the two ring states. Nothing below
 * hand-picks a tint.
 */

export interface ProfileColumnProps {
  category: Category;
  /**
   * The whole board's UNFILTERED occurrences (R317) — the counters' only
   * argument. Passing the drawn list here is exactly the bug FR-384 forbids.
   */
  allOccurrences: readonly BoardOccurrence[];
  /** What this column draws: this Profile's visible occurrences, already split out. */
  occurrences: readonly BoardOccurrence[];
  toggles: SectionToggles;
  onToggleSection: (section: TaskSectionKey) => void;
  /** Signed URL for a photo avatar. */
  photoUrl?: string;
  /** `occurrenceKeyOf` of the occurrence whose write is in flight (FR-393). */
  busyKey?: string | null;
  onOpen: (occurrence: BoardOccurrence) => void;
  onResolve: (occurrence: BoardOccurrence) => void;
}

export function ProfileColumn({
  category,
  allOccurrences,
  occurrences,
  toggles,
  onToggleSection,
  photoUrl,
  busyKey,
  onOpen,
  onResolve,
}: ProfileColumnProps) {
  const counters = useMemo(
    () => columnCountersOf(allOccurrences, category.id),
    [allOccurrences, category.id],
  );

  // FR-312 from the same unfiltered list as the column's own count, so a
  // routine's indicator and the ring above it can never disagree.
  const progressOf = useCallback(
    (occurrence: BoardOccurrence) =>
      occurrence.routine ? routineProgressOf(allOccurrences, occurrence.taskId, category.id) : null,
    [allOccurrences, category.id],
  );

  return (
    <section
      aria-label={category.label}
      data-column={category.id}
      style={profileVars(category.color) as CSSProperties}
      className="fam-profile flex h-full min-h-0 w-full min-w-0 flex-col gap-(--fam-task-col-gap)"
    >
      <ColumnHeader
        category={category}
        counters={counters}
        toggles={toggles}
        onToggleSection={onToggleSection}
        photoUrl={photoUrl}
      />
      <ColumnBody
        occurrences={occurrences}
        toggles={toggles}
        accent={category.color}
        emptyLabel={`Nothing for ${category.label} today`}
        progressOf={progressOf}
        busyKey={busyKey}
        onOpen={onOpen}
        onResolve={onResolve}
      />
    </section>
  );
}
