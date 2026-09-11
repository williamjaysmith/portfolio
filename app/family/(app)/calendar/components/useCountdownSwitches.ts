"use client";

import { createDeviceSwitches } from "../../components/useDeviceSwitches";

/**
 * The calendar preview bar's per-device switch (009 FR-908, FR-913, R907) — the
 * shipped `useCalendarMealSwitch` shape, on the same store.
 *
 * **014 removed `tasksProgress`.** It gated a row of faces that duplicated the
 * shell's chip row; the counts moved onto the chips and now need no switch. It
 * is also worth recording WHY the operator met that row without choosing it:
 * `showAll` set it true, so the sheet's one "Show all" turned on a whole extra
 * row as a side effect of un-hiding a Profile. The stored key is simply
 * ignored from here — `createDeviceSwitches` reads the defaults it is given, so
 * a device carrying the old value in `family:calendar-preview:v1` needs no
 * migration and no version bump.
 *
 * **Pause countdowns** stops the rotation. The reference documents that the bar
 * rotates and nothing about stopping it (spec Assumption 6); a bar that changes
 * while somebody is reading it is a poor wall display, and the device doing the
 * moving is the one that should get to say so — the wall tablet and a phone
 * want different answers, which is exactly why this is per device and not a
 * household setting.
 */

export interface CalendarPreviewSwitches {
  pauseRotation: boolean;
}

const store = createDeviceSwitches<CalendarPreviewSwitches>({
  storageKey: "family:calendar-preview:v1",
  defaults: { pauseRotation: false },
});

export interface CalendarPreviewSwitchState {
  switches: CalendarPreviewSwitches;
  set: (key: keyof CalendarPreviewSwitches, on: boolean) => void;
  /**
   * What the sheet's one **Show all** means here: nothing held still — the
   * rotation running. It no longer switches a row on as a side effect.
   */
  showAll: () => void;
  persistent: boolean;
}

export function useCountdownSwitches(): CalendarPreviewSwitchState {
  const { switches, persistent } = store.useSwitches();
  return {
    switches,
    set: (key, on) => store.set(key, on),
    showAll: () => store.replace({ pauseRotation: false }),
    persistent,
  };
}

/** Test seam. */
export function resetCountdownSwitches(): void {
  store.reset();
}
