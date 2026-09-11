"use client";

import { createDeviceSwitches } from "../../components/useDeviceSwitches";

/**
 * The calendar preview bar's per-device switch (009 FR-908, FR-913, R907) — the
 * shipped `useCalendarMealSwitch` shape, on the same store.
 *
 * **`taskProgress` is the reference's own toggle, twice reworked.** 009 had it
 * gate a whole second row of the family's faces above the calendar; the
 * operator reported that duplication and 014 deleted both the row and the
 * switch, moving the counts onto the shell's chips permanently. Then: *"on
 * calendar view its just the colored circle with user photos … but you can in
 * filter turn on 'show task progress' … where then the task stat comes out
 * similar to how it is now"*. So the switch is back, gating the COUNT on the
 * chip rather than a row of its own — the faces are drawn exactly once either
 * way.
 *
 * **Off by default, and that is worth more than a preference.** `ProfileChipRow`
 * mounts its reads, so with this off the shell issues no task request at all on
 * any tab — which retires 014's stated cost of putting four reads in the shell
 * where Lists and Meals pay for them too.
 *
 * **`showAll` leaves it alone — deliberately.** 009's `showAll` set it true, so
 * the sheet's one "Show all" turned on a whole extra surface as a side effect of
 * un-hiding one Profile, which is how the operator met that row without ever
 * asking for it. "Show all" un-hides what is hidden; it does not add a surface
 * nobody asked for. The stored key needs no migration and no version bump —
 * `createDeviceSwitches` reads the defaults it is given, so a device still
 * carrying 009's value simply has it honoured again.
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
  /** Draw today's chore count beside each face on the shell's chip row. */
  taskProgress: boolean;
}

const store = createDeviceSwitches<CalendarPreviewSwitches>({
  storageKey: "family:calendar-preview:v1",
  defaults: { pauseRotation: false, taskProgress: false },
});

export interface CalendarPreviewSwitchState {
  switches: CalendarPreviewSwitches;
  set: (key: keyof CalendarPreviewSwitches, on: boolean) => void;
  /**
   * What the sheet's one **Show all** means here: nothing held still — the
   * rotation running — and `taskProgress` left exactly as it was. See above:
   * "all" is about what is HIDDEN, not about switching extra surfaces on.
   */
  showAll: () => void;
  persistent: boolean;
}

export function useCountdownSwitches(): CalendarPreviewSwitchState {
  const { switches, persistent } = store.useSwitches();
  return {
    switches,
    set: (key, on) => store.set(key, on),
    showAll: () => store.set("pauseRotation", false),
    persistent,
  };
}

/** Test seam. */
export function resetCountdownSwitches(): void {
  store.reset();
}
