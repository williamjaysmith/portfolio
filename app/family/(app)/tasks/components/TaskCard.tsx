"use client";

import type { CSSProperties } from "react";

import {
  INK_DARK,
  inkOn,
  mixWithWhite,
  profileVars,
  type Ink,
  type PaletteColor,
} from "@/lib/family/colors";
import type { TaskCounters } from "@/lib/family/tasks/counters";
import { resolutionKeyOf } from "@/lib/family/tasks/resolutions";
import type { BoardOccurrence, OccurrenceState } from "@/lib/family/types";

import { CompleteCircle } from "./CompleteCircle";

/**
 * One task on the board (T041) — the first of the three renderers, because
 * `SectionGroup` and both columns compose it.
 *
 * It draws the emoji and the title and NOT the description, which belongs to
 * the details view (FR-320, FR-321). The card ITSELF is the completion
 * feedback (FR-349): the Profile's colour at 40 % while the task is
 * outstanding, the same colour at full strength once it is done, cross-faded
 * declaratively so `tokens.css`'s reduced-motion block collapses it without
 * this component knowing. The checkmark is the secondary signal.
 *
 * Two controls, never nested: the card BODY opens details (FR-352) and the
 * circle beside it resolves the occurrence (FR-348). They are siblings inside
 * the card rather than one inside the other, because a button inside a button
 * is invalid and un-tappable, and because FR-352 turns on the two being
 * distinguishable.
 *
 * The card is dumb and its props are plain data: the counters it shows are
 * computed above it from the UNFILTERED occurrence list (R317), the accent is
 * chosen by the column, and the verb behind a circle tap is the board's to
 * pick. The one thing it computes is `--fam-task-ink`, and it must: six of the
 * twenty accents flip to white ink at full strength and none does at 40 %, so
 * no stylesheet can choose it (FR-398, and `tokens.css` says so in as many
 * words).
 */

/** FR-353's five-column occurrence identity, as one string — the React key and the busy match. */
export function occurrenceKeyOf(occurrence: BoardOccurrence): string {
  return resolutionKeyOf({
    taskId: occurrence.taskId,
    assigneeId: occurrence.assigneeId,
    occurrenceDate: occurrence.scheduledDate,
    slot: occurrence.slot,
    cyclePrev: occurrence.cyclePrev,
  });
}

/** FR-398 at the card: the ink is chosen against the fill actually drawn. */
function cardInkOf(accent: PaletteColor | null, state: OccurrenceState): Ink {
  if (accent === null) return INK_DARK;
  return state === "complete" ? inkOn(accent) : inkOn(mixWithWhite(accent, 0.4));
}

/**
 * FR-349's ladder, and the one surface outside it: an occurrence with no
 * credited Profile has no accent to tint with, so it takes the neutral card
 * the no-category event block already uses (FR-308).
 */
function tintClassOf(accent: PaletteColor | null, state: OccurrenceState): string {
  if (accent === null) return "border border-(--fam-event-neutral-border) bg-(--fam-app-bg)";
  return state === "complete" ? "fam-tint-100" : "fam-tint-40";
}

/** The drawn fraction and the spoken one — the same number, said twice for two audiences. */
interface ProgressLabel {
  text: string;
  spoken: string;
}

/** FR-312's indicator, shown on routines only — a chore has no sibling occurrences to count. */
function progressLabelOf(
  occurrence: BoardOccurrence,
  progress: TaskCounters | null,
): ProgressLabel | null {
  if (!occurrence.routine || progress === null || progress.total === 0) return null;
  return {
    text: `${progress.complete}/${progress.total}`,
    spoken: `${progress.complete} of ${progress.total} complete`,
  };
}

export interface TaskCardProps {
  occurrence: BoardOccurrence;
  /**
   * The colour this card is drawn in: the column's Profile, which for a
   * claimed occurrence is also the Profile credited (FR-348). `null` is the
   * Up for Grabs column, which belongs to nobody (FR-308).
   */
  accent: PaletteColor | null;
  /** FR-312, computed above from the UNFILTERED list (R317); `null` on a chore. */
  progress?: TaskCounters | null;
  /** FR-393: this occurrence's write is in flight. */
  busy?: boolean;
  /** FR-352: a tap on the BODY opens the details view. */
  onOpen: (occurrence: BoardOccurrence) => void;
  /** FR-348: a tap on the CIRCLE resolves; the board picks the verb (T044). */
  onResolve: (occurrence: BoardOccurrence) => void;
}

export function TaskCard({
  occurrence,
  accent,
  progress = null,
  busy = false,
  onOpen,
  onResolve,
}: TaskCardProps) {
  const label = progressLabelOf(occurrence, progress);
  // React's CSSProperties is deliberately closed over the CSS spec, so a
  // custom property needs the assertion the shipped ProfileChip already uses.
  const style = {
    ...(accent === null ? {} : profileVars(accent)),
    "--fam-task-ink": cardInkOf(accent, occurrence.state),
  } as CSSProperties;

  return (
    <li
      data-task-card
      data-state={occurrence.state}
      data-variant={accent === null ? "neutral" : "profile"}
      data-late={occurrence.isLate ? "true" : undefined}
      style={style}
      className={`fam-profile relative flex items-center gap-(--fam-task-card-gap) rounded-(--fam-task-card-r) pr-(--fam-task-card-pad) text-(--fam-task-ink) transition-colors duration-(--fam-task-fade-ms) ease-(--fam-task-fade-ease) ${tintClassOf(
        accent,
        occurrence.state,
      )} ${occurrence.state === "skipped" ? "opacity-(--fam-past-dim)" : ""}`}
    >
      <button
        type="button"
        // The visible progress is folded into the name so it is announced
        // once, rather than read as a bare fraction after the title.
        aria-label={
          label === null ? occurrence.summary : `${occurrence.summary}, ${label.spoken}`
        }
        onClick={() => onOpen(occurrence)}
        className="flex min-h-(--fam-task-card-min-h) flex-1 items-center gap-(--fam-task-card-gap) p-(--fam-task-card-pad) text-left"
      >
        {occurrence.emoji === null ? null : (
          <span aria-hidden="true" className="shrink-0 text-(length:--fam-task-emoji) leading-none">
            {occurrence.emoji}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-(--fam-task-badge-gap)">
          <span
            className={`truncate text-(length:--fam-fs-body) font-medium ${
              occurrence.state === "skipped" ? "line-through" : ""
            }`}
          >
            {occurrence.summary}
          </span>
          {label === null ? null : (
            <span className="text-(length:--fam-fs-small) tabular-nums opacity-80">
              {label.text}
            </span>
          )}
        </span>
      </button>
      <CompleteCircle
        state={occurrence.state}
        accent={accent}
        summary={occurrence.summary}
        busy={busy}
        onToggle={() => onResolve(occurrence)}
      />
    </li>
  );
}
