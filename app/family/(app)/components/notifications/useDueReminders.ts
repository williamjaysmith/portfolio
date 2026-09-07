"use client";

import { expandWindow } from "@/lib/family/calendar/expand";
import { diffDays, viewWindowOf } from "@/lib/family/calendar/dates";
import { eventReminders, remindersDueNow, type DueReminder } from "@/lib/family/notifications/due";
import { notificationSettingsOf } from "@/lib/family/notifications/settings";
import { reminderKeyOf } from "@/lib/family/notifications/identity";
import { reminderHorizonOf, useReminderHorizon } from "@/lib/family/queries";

import { useNow } from "../Clock";
import { createDeviceKeySet } from "../useDeviceKeySet";
import { useFamily } from "../FamilyProvider";

/**
 * What this screen should be showing right now (008 FR-814–FR-817).
 *
 * Three things meet here and nothing else happens: the shell's minute clock
 * (`useNow`, Phase 1), the banner's own horizon read, and the pure
 * due-computation. Everything difficult is in `lib/family/notifications/**` and
 * is unit-tested there; this hook is the wiring.
 *
 * **"Shown once" is a per-device convention, not a guarantee.** The keys live in
 * this browser's storage, and there are two places that gives way, both of which
 * the specification states rather than hides:
 *
 *   - clearing site data, a private window or a second browser profile can
 *     re-show a reminder that is still inside its fifteen-minute window;
 *   - two tabs each draw their own banner, and dismissing one does not dismiss
 *     the other — a banner is a thing on a screen, not a state in the household.
 *
 * Both were a database unique index while this phase had Web Push in it. Losing
 * that is the honest cost of the household deciding it did not want push.
 */

/** Keys of reminders this device has already put on screen. */
const shown = createDeviceKeySet("family:reminders-shown:v1");

export interface DueRemindersState {
  /** Everything due now that this device has not already shown. */
  reminders: DueReminder[];
  /**
   * A stable identity for THIS set of reminders, so a caller can tell a new
   * banner from a re-render of the same one — which is what the chime needs,
   * and what a `reminders.length` check would get wrong when one reminder
   * replaces another in the same minute.
   */
  key: string;
  /** Marks them shown, so they do not come back on the next minute's tick. */
  dismiss: () => void;
}

export function useDueReminders(): DueRemindersState {
  const { household, settings } = useFamily();
  const now = useNow();
  const nowMs = now?.getTime() ?? null;

  // The server renders no clock (`useNow` returns null until hydration), so
  // there is nothing to compute and nothing to draw until the browser has it.
  const horizon = useReminderHorizon(household.id, settings.timezone, nowMs);
  const { keys } = shown.useKeys();

  if (nowMs === null || horizon.data === undefined) {
    return { reminders: [], key: "", dismiss: () => {} };
  }

  const bounds = reminderHorizonOf(settings.timezone, nowMs);
  const days = diffDays(bounds.startDate, bounds.endDate) + 1;
  const window = viewWindowOf(bounds.startDate, days, settings.timezone);
  const occurrences = expandWindow(horizon.data, window, settings.timezone);
  const all = eventReminders(
    occurrences,
    horizon.data,
    notificationSettingsOf(settings),
    settings.timezone,
  );

  const reminders = remindersDueNow(all, nowMs).filter(
    (reminder) => !keys.has(reminderKeyOf(reminder.identity)),
  );

  return {
    reminders,
    key: reminders.map((reminder) => reminderKeyOf(reminder.identity)).join("|"),
    dismiss: () => {
      for (const reminder of reminders) shown.add(reminderKeyOf(reminder.identity));
    },
  };
}

/** Test seam. */
export function resetShownReminders(): void {
  shown.reset();
}
