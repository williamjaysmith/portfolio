"use server";

/**
 * Household settings (FR-043, D15).
 *
 * `households.name` is the one household name — `household_settings` has no
 * `display_name`, so there is nothing to keep in sync. `showNameNotDate`
 * chooses whether the top bar shows that name or today's date (FR-031).
 */

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "../errors";
import { requireParent } from "../guards";
import {
  HOUSEHOLD_COLUMNS,
  SETTINGS_COLUMNS,
  toHousehold,
  toSettings,
  type HouseholdRow,
  type HouseholdSettingsRow,
} from "../rows";
import type { Household, HouseholdSettings, HouseholdSettingsPatch } from "../types";
import { parseOrThrow, settingsPatchSchema } from "../validation";
import { adminFamily, mapDbError, touchActor } from "./shared";

type SettingsWrite = Record<string, string | number | boolean | null>;

/** Settings field → its column. `householdName` is deliberately absent: it lives on `households`. */
const SETTINGS_FIELDS = {
  showNameNotDate: "show_name_not_date",
  timeFormat: "time_format",
  startWeekOn: "start_week_on",
  punchOutMinutes: "punch_out_minutes",
  textSize: "text_size",
  density: "density",
} as const satisfies Partial<Record<keyof HouseholdSettingsPatch, string>>;

function settingsColumns(patch: HouseholdSettingsPatch): SettingsWrite {
  const columns: SettingsWrite = {};
  for (const [field, column] of Object.entries(SETTINGS_FIELDS)) {
    const value = patch[field as keyof typeof SETTINGS_FIELDS];
    if (value !== undefined) columns[column] = value;
  }
  return columns;
}

export async function updateHouseholdSettings(
  patch: HouseholdSettingsPatch,
): Promise<ActionResult<{ household: Household; settings: HouseholdSettings }>> {
  return runAction(async () => {
    const actor = await requireParent();
    const parsed = parseOrThrow(settingsPatchSchema, patch);
    const fam = adminFamily();

    if (parsed.householdName !== undefined) {
      const { error } = await fam
        .from("households")
        .update({ name: parsed.householdName, updated_by: actor.profileId })
        .eq("id", actor.householdId);
      if (error) throw mapDbError(error);
    }

    const columns = settingsColumns(parsed);
    if (Object.keys(columns).length > 0) {
      const { error } = await fam
        .from("household_settings")
        .update({ ...columns, updated_by: actor.profileId })
        .eq("household_id", actor.householdId);
      if (error) throw mapDbError(error);
    }

    const [householdResult, settingsResult] = await Promise.all([
      fam.from("households").select(HOUSEHOLD_COLUMNS).eq("id", actor.householdId).single(),
      fam
        .from("household_settings")
        .select(SETTINGS_COLUMNS)
        .eq("household_id", actor.householdId)
        .single(),
    ]);
    if (householdResult.error) throw mapDbError(householdResult.error);
    if (settingsResult.error) throw mapDbError(settingsResult.error);

    await touchActor(actor);
    revalidatePath("/family", "layout");
    return {
      household: toHousehold(householdResult.data as unknown as HouseholdRow),
      settings: toSettings(settingsResult.data as unknown as HouseholdSettingsRow),
    };
  });
}
