"use client";

import { createDeviceSwitches } from "../../components/useDeviceSwitches";

/**
 * The calendar preview bar's two per-device switches (009 FR-908, FR-911,
 * FR-913, R907) — the shipped `useCalendarMealSwitch` shape, on the same store.
 *
 * **Tasks Progress** is off by default. The reference ships its Filter toggles
 * off, and a switch that were on by default would put four task reads on every
 * calendar paint for a household that never asked for them. Off, the row does
 * not mount at all, so the calendar makes no task request whatsoever (R905).
 *
 * **Pause countdowns** stops the rotation. The reference documents that the bar
 * rotates and nothing about stopping it (spec Assumption 6); a bar that changes
 * while somebody is reading it is a poor wall display, and the device doing the
 * moving is the one that should get to say so — the wall tablet and a phone
 * want different answers, which is exactly why this is per device and not a
 * household setting.
 */

export interface CalendarPreviewSwitches {
  tasksProgress: boolean;
  pauseRotation: boolean;
}

const store = createDeviceSwitches<CalendarPreviewSwitches>({
  storageKey: "family:calendar-preview:v1",
  defaults: { tasksProgress: false, pauseRotation: false },
});

export interface CalendarPreviewSwitchState {
  switches: CalendarPreviewSwitches;
  set: (key: keyof CalendarPreviewSwitches, on: boolean) => void;
  /**
   * What the sheet's one **Show all** means here: everything visible and
   * nothing held still — progress on, rotation running.
   */
  showAll: () => void;
  persistent: boolean;
}

export function useCountdownSwitches(): CalendarPreviewSwitchState {
  const { switches, persistent } = store.useSwitches();
  return {
    switches,
    set: (key, on) => store.set(key, on),
    showAll: () => store.replace({ tasksProgress: true, pauseRotation: false }),
    persistent,
  };
}

/** Test seam. */
export function resetCountdownSwitches(): void {
  store.reset();
}
