/**
 * Two levels of reminder, resolved into the one actually in force
 * (008 FR-808, FR-809, R809).
 *
 * Skylight verifies exactly this shape: a calendar-wide default, and a
 * per-event reminder that OVERRIDES it [VERIFIED](32083277890075). What no
 * fetched source addresses is how to say "this one, deliberately, never
 * reminds" — absence already means inherit, so silence needs a name of its
 * own. That name is `none`, and telling it apart from `inherit` is the whole
 * reason the mode column exists (spec Assumption 4).
 *
 * Pure, and shared by both readers of the due-computation (R802): the browser
 * drawing a banner and the server sending a push resolve a reminder with this
 * function, so they cannot disagree about what an event asked for.
 */

import type { Event, EventReminder, ReminderInForce } from "../types";
import type { NotificationSettings } from "./settings";

/** Nothing will fire. Both halves off is the only way to say so. */
export function isSilent(reminder: ReminderInForce): boolean {
  return !reminder.atTime && reminder.beforeMinutes === null;
}

/**
 * The household's own reminder, from its two independent switches
 * [VERIFIED](45795554249371) — so it may be both, either or neither.
 *
 * `eventBeforeMinutes` is deliberately ignored while `eventBefore` is off: the
 * stored number is the value the field shows when the switch is turned back
 * on, not a reminder that is somehow half-enabled.
 */
export function householdReminder(settings: NotificationSettings): ReminderInForce {
  return {
    atTime: settings.eventAtTime,
    beforeMinutes: settings.eventBefore ? settings.eventBeforeMinutes : null,
  };
}

/**
 * The reminder one event will actually give.
 *
 * A `custom` REPLACES the household's choice rather than adding to it: the
 * reference calls the per-event setting an override, and blending the two
 * would make "an event that reminds only at its start, in a household that
 * reminds ten minutes before" impossible to express.
 */
export function reminderInForce(
  settings: NotificationSettings,
  own: EventReminder,
): ReminderInForce {
  if (own.mode === "inherit") return householdReminder(settings);
  if (own.mode === "none") return { atTime: false, beforeMinutes: null };
  return { atTime: own.atTime, beforeMinutes: own.beforeMinutes };
}

/**
 * One occurrence's reminder: its exception's, or failing that its series'.
 *
 * `occurrenceDate` is the occurrence's ORIGINAL household-local date — Phase
 * 2's exception key (R204) — so this still finds the right override for an
 * occurrence that has been moved to another day.
 *
 * Deliberately NOT a field on `Occurrence`: that type is what renderers draw,
 * and every one of them would have to carry a reminder it never shows. The
 * two places that need this (the details view, FR-811, and the
 * due-computation) ask for it.
 */
export function occurrenceReminder(event: Event, occurrenceDate: string): EventReminder {
  const exception = event.exceptions.find((entry) => entry.occurrenceDate === occurrenceDate);
  return exception?.reminder ?? event.reminder;
}
