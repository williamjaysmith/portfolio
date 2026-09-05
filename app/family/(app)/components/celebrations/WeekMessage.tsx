"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import { useEffect, useRef } from "react";

import type { WeekCelebration } from "../../tasks/components/useWeekCelebrations";

/**
 * FR-440's Amazing / Strong Week message (004 T050 — R408): one earned
 * message, on the board, the next time it is on screen after the household
 * week ends. "Amazing week, Ana! Brush teeth every day." for a routine
 * completed on every scheduled day; "Strong week, Ben! Read a book almost
 * every day." for exactly one missed day of a routine scheduled at least
 * three times. Both tiers are the reference's `[V]`; the copy is ours
 * (`[OURS 2026-09-05 #13]`).
 *
 * **It decides nothing.** `useWeekCelebrations` (T049) judges the week,
 * queues the messages one at a time and remembers what this device has shown;
 * the board mounts this for `message` and passes `dismiss` as `onDismiss`.
 * The message ends two ways — a tap anywhere on it, or its own clock a few
 * seconds on — and both report through `onDismiss`, which is what advances
 * the queue: the next message, if any, arrives as a new `message` and starts
 * a clock of its own. The parent need not key the element; the clock is keyed
 * on `message.key` here.
 *
 * **A polite live region** (`role="status"`, `aria-live="polite"`), so a
 * screen reader hears the celebration without being interrupted by it; the
 * tap target is a real `<button>` at the touch floor, keyboard-operable with
 * the shipped focus ring (FR-445). The star beside the copy is decoration and
 * says nothing the copy does not.
 *
 * **Reduced motion collapses the motion, not the message** (FR-445): the
 * message is the celebration's content, so it still shows and still ends on
 * its clock; only the entrance is skipped, on `RedeemModal`'s pattern — the
 * shipped hook is `useReducedMotion`, and `null` (not yet read) is treated as
 * motion allowed.
 *
 * It sits in the board's flow, where `Notice` does, rather than fixed over
 * the viewport: the board is the message's home (FR-440 "on the board"), and
 * a banner that pushes the columns down for a few seconds is the same shift
 * the shipped notice already makes.
 */

/** "After a few seconds" (T050) — long enough to read on the wall, short enough to not be a wall. [ESTIMATED] */
const DISMISS_MS = 6000;

/** The entrance: a short lift from slightly small and unseen, on the redeem modal's curve. */
const ENTRANCE_FROM = { opacity: 0, y: 12, scale: 0.96 };
const ENTRANCE_TO = { opacity: 1, y: 0, scale: 1 };
const ENTRANCE = { duration: 0.32, ease: "easeOut" } as const;

const REGION = "flex justify-center px-(--fam-edge-inset) py-1";
const BODY = "max-w-full";
const BUTTON =
  "flex min-h-(--fam-touch) max-w-full items-center gap-3 rounded-(--fam-radius-card) " +
  "bg-(--fam-app-bg) px-5 py-2 text-left text-(length:--fam-fs-body) font-medium " +
  "text-(--fam-text-primary) shadow-md";
/** The star is the copy's own size — one token, no drift. */
const STAR = "size-(--fam-fs-body) shrink-0 text-(--fam-star-gold)";

/** The two tiers' copy, from the verdict alone. */
function copyOf(message: WeekCelebration): string {
  const { profileName, routineName } = message;
  return message.verdict === "amazing"
    ? `Amazing week, ${profileName}! ${routineName} every day.`
    : `Strong week, ${profileName}! ${routineName} almost every day.`;
}

export interface WeekMessageProps {
  /** The message to show — `useWeekCelebrations`'s `message`, never null here. */
  message: WeekCelebration;
  /**
   * The message was seen: a tap on it, or its own clock. The board passes
   * `useWeekCelebrations`'s `dismiss`, which remembers the key on this device
   * and surfaces the next message. The latest callback is the one called; a
   * new identity on re-render does not restart the clock — a new `message` does.
   */
  onDismiss: () => void;
}

export function WeekMessage({ message, onDismiss }: WeekMessageProps) {
  const reducedMotion = useReducedMotion() === true;

  // The latest `onDismiss` without it being a dependency: the clock is the
  // message's, not the parent's render cadence (StarConfetti's pattern).
  const latestOnDismiss = useRef(onDismiss);
  useEffect(() => {
    latestOnDismiss.current = onDismiss;
  }, [onDismiss]);

  // One clock per message: the next in the queue starts its own.
  useEffect(() => {
    const timer = setTimeout(() => latestOnDismiss.current(), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message.key]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-week-message
      data-verdict={message.verdict}
      className={REGION}
    >
      <motion.div
        data-week-message-body
        initial={reducedMotion ? false : ENTRANCE_FROM}
        animate={ENTRANCE_TO}
        transition={ENTRANCE}
        className={BODY}
      >
        <button type="button" onClick={onDismiss} className={BUTTON}>
          <Star aria-hidden="true" fill="currentColor" className={STAR} />
          <span>{copyOf(message)}</span>
        </button>
      </motion.div>
    </div>
  );
}
