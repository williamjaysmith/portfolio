"use client";

import type { CountdownStatus } from "@/lib/family/countdowns/target";
import { countdownChipLabel, countdownPhrase } from "@/lib/family/countdowns/wording";

/**
 * The countdown chips (009 FR-902, FR-907, FR-909).
 *
 * A row of "Vacation · 13 days" chips, in the shipped pill idiom at the FR-263
 * touch floor. The whole row is one tap target: tapping it opens the full list
 * of active countdowns, which is what the reference does
 * [VERIFIED](40459070511515).
 *
 * The wording is `lib/family/countdowns/wording.ts`'s and not this file's, so
 * the chip, the list and the event's own details cannot drift apart. No emoji:
 * the reference "may add a relevant emoji automatically" and this project
 * declines (009 R914, divergence 4).
 */

const CHIP =
  "flex min-h-(--fam-touch) shrink-0 items-center rounded-full bg-(--fam-pill-btn-bg) px-3 " +
  "text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted) tabular-nums";

const ROW = "flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left";

export interface CountdownChipsProps {
  /** The countdowns to draw, already cut to what fits and rotated (FR-908). */
  shown: readonly CountdownStatus[];
  /** How many are active in total — what the tap's label promises to open. */
  total: number;
  /**
   * FR-909: opens the full list of every active countdown.
   *
   * Optional, and absent means the row is a plain group rather than a button.
   * A tap target that does nothing is worse than no tap target, so the row
   * only becomes one once there is a list for it to open.
   */
  onOpenList?: () => void;
}

function labelOf(total: number): string {
  return `Countdowns — ${total === 1 ? "1 countdown" : `${total} countdowns`}`;
}

export function CountdownChips({ shown, total, onOpenList }: CountdownChipsProps) {
  if (shown.length === 0) return null;

  const chips = shown.map((countdown) => (
    <span key={countdown.eventId} className={CHIP}>
      {countdownChipLabel(countdown.summary, countdownPhrase(countdown.state, countdown.days))}
    </span>
  ));

  if (onOpenList === undefined) {
    return (
      <div role="group" aria-label={labelOf(total)} className={ROW}>
        {chips}
      </div>
    );
  }

  return (
    <button type="button" onClick={onOpenList} aria-label={labelOf(total)} className={ROW}>
      {chips}
    </button>
  );
}
