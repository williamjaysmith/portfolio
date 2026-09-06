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
import { LateBadge } from "./LateBadge";
import { StarChip, starsWorthOf } from "./StarChip";
import { StreakBadge, useTaskStreak } from "./StreakBadge";

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
 * A tracked routine carries `StreakBadge` beside its NAME (FR-372) — the
 * stored count read from the task rows the board holds, never counted here
 * (FR-371, R311) and never on a chore (FR-337). It sits inside the body
 * control rather than out at the card's edge, which is where FR-372 puts it
 * and is why the streak is folded into that control's accessible name instead
 * of being announced separately.
 *
 * A task worth something carries `StarChip` on the same line (FR-403) — the
 * stored value the occurrence arrived with, and nothing on a card worth
 * nothing, so that card is the height it was in Phase 3 (FR-402, SC-418). Its
 * value is folded into the body's name the same way the streak is, and for the
 * same reason.
 *
 * A carried-forward occurrence additionally carries `LateBadge`, which shows
 * the date it was DUE rather than the day it is drawn on (FR-358, US3-1) —
 * that date is the occurrence's identity and the whole reason the card is on
 * today's board (FR-357). An anytime chore has no date, so it can never carry
 * the badge (FR-328, US3-4).
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

/**
 * What the body control is CALLED: the title, plus every mark drawn beside it,
 * said once. The visible progress, the streak and the star value are folded in
 * rather than left to be read as bare numbers after the title — and rather
 * than announced twice, which is why all three marks are `aria-hidden` inside
 * it.
 */
function cardLabelOf(
  summary: string,
  progress: ProgressLabel | null,
  streak: number,
  worth: string | null,
): string {
  const parts = [summary];
  if (progress !== null) parts.push(progress.spoken);
  if (streak > 0) parts.push(`${streak} day streak`);
  if (worth !== null) parts.push(worth);
  return parts.join(", ");
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
  // FR-371: read from the board's task rows, and zero — no badge — for every
  // occurrence that has no streak to show.
  const streak = useTaskStreak(occurrence);
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
        // The visible progress, the streak and the star value are folded into
        // the name so each is announced once, rather than read as bare numbers
        // after the title.
        aria-label={cardLabelOf(
          occurrence.summary,
          label,
          streak,
          starsWorthOf(occurrence.rewardPoints),
        )}
        onClick={() => onOpen(occurrence)}
        className="flex min-h-(--fam-task-card-min-h) flex-1 items-center gap-(--fam-task-card-gap) p-(--fam-task-card-pad) text-left"
      >
        {occurrence.emoji === null ? null : (
          <span aria-hidden="true" className="shrink-0 text-(length:--fam-task-emoji) leading-none">
            {occurrence.emoji}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-(--fam-task-badge-gap)">
          {/* The name, the streak and the star chip on one line, because
              FR-372 and FR-403 both put their mark beside the name and not
              under it. */}
          <span className="flex min-w-0 items-center gap-(--fam-task-badge-gap)">
            <span
              className={`truncate text-(length:--fam-fs-body) font-medium ${
                occurrence.state === "skipped" ? "line-through" : ""
              }`}
            >
              {occurrence.summary}
            </span>
            <StreakBadge count={streak} />
            <StarChip count={occurrence.rewardPoints} />
          </span>
          {label === null ? null : (
            <span className="text-(length:--fam-fs-small) tabular-nums opacity-80">
              {label.text}
            </span>
          )}
        </span>
      </button>
      {/* Outside the body button on purpose: that button carries an explicit
          aria-label, so anything inside it is not announced — and the badge's
          own date is the reason this card is here at all (FR-358). */}
      <LateBadge dueDate={occurrence.scheduledDate} late={occurrence.isLate} />
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
