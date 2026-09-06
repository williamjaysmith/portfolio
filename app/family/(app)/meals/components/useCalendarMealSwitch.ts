"use client";

import type { CalendarMealSwitches } from "@/lib/family/types";

import { createDeviceSwitches } from "../../components/useDeviceSwitches";

/**
 * The calendar's one per-device meals switch (006 FR-635, R609): **Show
 * Meals**, on by default, on the Tasks and Lists filters' store. Off, the
 * token row is empty on this device and the Meals tab is untouched.
 */

const store = createDeviceSwitches<CalendarMealSwitches>({
  storageKey: "family:calendar-meals:v1",
  defaults: { showMeals: true },
});

export interface CalendarMealSwitch {
  showMeals: boolean;
  setShowMeals: (on: boolean) => void;
  showAll: () => void;
  persistent: boolean;
}

export function useCalendarMealSwitch(): CalendarMealSwitch {
  const { switches, persistent } = store.useSwitches();
  return {
    showMeals: switches.showMeals,
    setShowMeals: (on) => store.set("showMeals", on),
    showAll: () => store.replace({ showMeals: true }),
    persistent,
  };
}

/** Test seam. */
export function resetCalendarMealSwitch(): void {
  store.reset();
}
