"use client";

import { createDeviceSwitches } from "../useDeviceSwitches";

/**
 * This device's two reminder choices (008 FR-815, R813).
 *
 * **Banner** — whether a reminder draws on this screen at all. On by default:
 * a household that turned reminders on in Settings expects to see them, and a
 * device that should stay quiet is the exception.
 *
 * **Chime** — whether one short tone plays with it. Skylight has a "Reminder
 * sound" toggle [VERIFIED](36836043247131), so the switch ships; it is OFF by
 * default because Phase 1 chose a silent display and this phase does not get to
 * overturn that quietly. The reference has exactly one tone and no picker, so
 * neither does this.
 *
 * Both are PER DEVICE and neither asks the browser for permission. There is no
 * system notification here — a banner is a DOM element on a page somebody has
 * open — so there is nothing for a browser to grant or refuse. That is worth
 * saying because the same two words meant something quite different while this
 * phase still had Web Push in it.
 *
 * Its own versioned key on the shipped switch-store factory, for the reason
 * every other set has one: a stored shape is never reparsed against another.
 */

export interface ReminderSwitches {
  banner: boolean;
  chime: boolean;
}

const store = createDeviceSwitches<ReminderSwitches>({
  storageKey: "family:reminder-switches:v1",
  defaults: { banner: true, chime: false },
});

export interface ReminderSwitchStore {
  switches: ReminderSwitches;
  setSwitch: (key: keyof ReminderSwitches, on: boolean) => void;
  /** False once storage has refused — the UI says the choice won't be remembered. */
  persistent: boolean;
}

export function useReminderSwitches(): ReminderSwitchStore {
  const { switches, persistent } = store.useSwitches();
  return { switches, setSwitch: store.set, persistent };
}

/** Test seam. */
export function resetReminderSwitches(): void {
  store.reset();
}
