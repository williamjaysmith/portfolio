"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { reminderKeyOf } from "@/lib/family/notifications/identity";

import { playChime } from "./chime";
import { useDueReminders } from "./useDueReminders";
import { useReminderSwitches } from "./reminderSwitches";

/**
 * The reminder, on whichever page is open (008 FR-814–FR-816).
 *
 * Everything due in the same minute is ONE banner naming each item, which is
 * what the reference's own pop-up does — it "lists all scheduled events/tasks"
 * [VERIFIED](36836043247131) — rather than a stack of one per item.
 *
 * Accessibility, and why it is shaped this way:
 *
 *   - `role="status"` with `aria-live="polite"`, not `alert`. A reminder is
 *     information arriving on its own schedule; interrupting a screen-reader
 *     user mid-sentence for "swim lesson in 10 minutes" is the wrong trade.
 *   - it never takes focus. Focus belongs to whatever the person was doing, and
 *     a banner that steals it at 4:20 loses somebody their half-typed event.
 *   - Dismiss is a real button with an accessible name and a 44px target, so it
 *     is reachable by keyboard and by a child's thumb on a wall tablet.
 *
 * It renders nothing at all when this device's banner switch is off, and
 * nothing when there is nothing due — no empty container, so it takes no space
 * and is invisible to a screen reader on the overwhelming majority of minutes.
 */
export function ReminderBanner() {
  const { reminders, key, dismiss } = useDueReminders();
  const { switches } = useReminderSwitches();

  // Ring once when a NEW set arrives, never on a re-render of the same one.
  // Comparing the key rather than the count is what makes one reminder
  // replacing another inside the same minute still ring.
  const rung = useRef("");
  useEffect(() => {
    if (key === rung.current) return;
    rung.current = key;
    if (key && switches.banner && switches.chime) playChime();
  }, [key, switches.banner, switches.chime]);

  if (!switches.banner || reminders.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Reminders"
      // 011: at the BOTTOM, clear of the FAB, and — the part that actually
      // matters — INERT except for its own two controls.
      //
      // It used to sit at `top-3`, directly over the first thing every tab
      // draws: on the calendar the ‹ / Today / › cluster, the view switcher and
      // the search box. The card is opaque, so it took their clicks as well as
      // their space, and a household with a reminder showing could not use any
      // of them. Moving it to the bottom fixed that and immediately broke the
      // FAB instead, which is the lesson: **position alone cannot promise a
      // floating card never covers something interactive.**
      //
      // So the card does not take pointer events at all. Its link and its
      // Dismiss button opt back in, and everything else under it stays
      // reachable wherever it happens to land.
      className="pointer-events-none absolute bottom-3 left-3 right-24 z-30 flex items-start gap-3 rounded-2xl border border-(--fam-hairline) bg-(--fam-notice-bg) p-4 shadow-lg backdrop-blur-md"
    >
      <ul className="flex min-w-0 flex-1 flex-col gap-1">
        {reminders.map((reminder) => (
          // Keyed on the reminder's canonical identity, not its words: two
          // different events can share a summary on the same day, and a key
          // built from the text would collide and drop one of them.
          <li key={reminderKeyOf(reminder.identity)} className="min-w-0">
            <Link
              href={reminder.path}
              onClick={dismiss}
              className="pointer-events-auto block truncate text-(length:--fam-fs-body)"
            >
              <span className="font-medium">{reminder.title}</span>
              {reminder.body ? (
                <span className="text-(--fam-text-secondary)"> — {reminder.body}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss reminders"
        className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--fam-text-secondary)"
      >
        <X className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
