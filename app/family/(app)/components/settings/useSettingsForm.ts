"use client";

import { useState } from "react";

import type {
  Density,
  Household,
  HouseholdSettings,
  HouseholdSettingsPatch,
  TextSize,
  TimeFormat,
} from "@/lib/family/types";

/**
 * Draft state for the household form.
 *
 * Every field is held as a string (or boolean) so the inputs stay uncontrolled
 * by type, and the conversion back to the action's shape happens once, in
 * `toPatch`. Zod re-validates it server-side regardless.
 */

export interface SettingsDraft {
  householdName: string;
  showNameNotDate: boolean;
  timeFormat: string;
  startWeekOn: string;
  punchOutMinutes: string;
  textSize: string;
  density: string;
}

export interface SettingsFormState {
  draft: SettingsDraft;
  set: (key: keyof SettingsDraft, value: string | boolean) => void;
  toPatch: () => HouseholdSettingsPatch;
}

export function useSettingsForm(
  household: Household,
  settings: HouseholdSettings,
): SettingsFormState {
  const [draft, setDraft] = useState<SettingsDraft>(() => ({
    householdName: household.name,
    showNameNotDate: settings.showNameNotDate,
    timeFormat: settings.timeFormat,
    startWeekOn: String(settings.startWeekOn),
    punchOutMinutes: String(settings.punchOutMinutes),
    textSize: settings.textSize,
    density: settings.density,
  }));

  function set(key: keyof SettingsDraft, value: string | boolean): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toPatch(): HouseholdSettingsPatch {
    return {
      householdName: draft.householdName,
      showNameNotDate: draft.showNameNotDate,
      timeFormat: draft.timeFormat as TimeFormat,
      startWeekOn: draft.startWeekOn === "1" ? 1 : 0,
      punchOutMinutes: Number(draft.punchOutMinutes),
      textSize: draft.textSize as TextSize,
      density: draft.density as Density,
    };
  }

  return { draft, set, toPatch };
}
