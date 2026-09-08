"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { rotates, rotationAt } from "@/lib/family/countdowns/rotation";
import type { CountdownStatus } from "@/lib/family/countdowns/target";
import { countdownChipLabel, countdownPhrase } from "@/lib/family/countdowns/wording";

import { useCountdownSwitches } from "./useCountdownSwitches";

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
 *
 * **The rotation** (FR-908): when there are more countdowns than there is room
 * for, the active ones take the first position in turn. WHAT is drawn is
 * `rotation.ts`'s pure answer to a step number; the only thing owned here is
 * the interval that increments it. It never starts when everything already
 * fits, it stops for the device's own **Pause countdowns** switch (Assumption
 * 6), and it stops for `prefers-reduced-motion` without being asked —
 * `tokens.css` collapses CSS durations under that preference and says plainly
 * that script-driven motion must consult `useReducedMotion()` itself.
 */

/**
 * How long each countdown holds the first position. A module constant and not
 * a setting: the household chooses whether it moves, not how fast.
 */
const ROTATE_MS = 6_000;

/**
 * The step the rotation is at. Zero — and never ticking — whenever the row is
 * not rotating, so a bar that fits is a bar with no timer behind it at all.
 */
function useRotationStep(total: number, slots: number): number {
  const { switches } = useCountdownSwitches();
  const reducedMotion = useReducedMotion();
  const moving = rotates(total, slots) && !switches.pauseRotation && !reducedMotion;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(() => setStep((current) => current + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [moving]);

  return moving ? step : 0;
}

const CHIP =
  "flex min-h-(--fam-touch) shrink-0 items-center rounded-full bg-(--fam-pill-btn-bg) px-3 " +
  "text-(length:--fam-fs-pill) font-medium text-(--fam-text-muted) tabular-nums";

const ROW = "flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left";

export interface CountdownChipsProps {
  /** Every countdown in force, soonest first (FR-903). */
  countdowns: readonly CountdownStatus[];
  /** How many hold a position at once. More than this and the row rotates. */
  slots: number;
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

export function CountdownChips({ countdowns, slots, onOpenList }: CountdownChipsProps) {
  const step = useRotationStep(countdowns.length, slots);
  const shown = rotationAt(countdowns, slots, step);
  if (shown.length === 0) return null;

  const chips = shown.map((countdown) => (
    <span key={countdown.eventId} className={CHIP}>
      {countdownChipLabel(countdown.summary, countdownPhrase(countdown.state, countdown.days))}
    </span>
  ));

  // The whole row is one target, and its label says how many it opens — a
  // rotating row whose visible chips change must not change what it announces.
  if (onOpenList === undefined) {
    return (
      <div role="group" aria-label={labelOf(countdowns.length)} className={ROW}>
        {chips}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenList}
      aria-label={labelOf(countdowns.length)}
      className={ROW}
    >
      {chips}
    </button>
  );
}
