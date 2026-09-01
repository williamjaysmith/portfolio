/**
 * Database row shapes for the `family` schema (snake_case, exactly as
 * PostgREST returns them) and the mappers to the camelCase domain types.
 *
 * Keep the selected column lists here too, so no query ever uses `select('*')`
 * — the column set is part of the privacy contract (nothing PIN-related is
 * ever selected; it does not exist on `categories` at all).
 */

import type { PaletteColor } from "./colors";
import type {
  AvatarKind,
  Category,
  Density,
  Household,
  HouseholdSettings,
  Role,
  TextSize,
  TimeFormat,
  WeekStart,
} from "./types";

export interface HouseholdRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  household_id: string;
  label: string;
  color: string;
  is_profile: boolean;
  avatar_kind: AvatarKind | null;
  avatar_id: string | null;
  avatar_path: string | null;
  birthday: string | null;
  dietary_prefs: string | null;
  role: Role;
  user_id: string | null;
  emoji: string | null;
  show_on_tasks: boolean;
  sort_order: number | string;
  has_pin: boolean;
  created_at: string;
  updated_at: string;
}

export interface HouseholdSettingsRow {
  household_id: string;
  show_name_not_date: boolean;
  time_format: TimeFormat;
  start_week_on: WeekStart;
  punch_out_minutes: number;
  text_size: TextSize;
  density: Density;
  updated_at: string;
}

export const HOUSEHOLD_COLUMNS = "id, name, created_at, updated_at";

export const CATEGORY_COLUMNS =
  "id, household_id, label, color, is_profile, avatar_kind, avatar_id, avatar_path, " +
  "birthday, dietary_prefs, role, user_id, emoji, show_on_tasks, sort_order, has_pin, " +
  "created_at, updated_at";

export const SETTINGS_COLUMNS =
  "household_id, show_name_not_date, time_format, start_week_on, punch_out_minutes, " +
  "text_size, density, updated_at";

export function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    householdId: row.household_id,
    label: row.label,
    // The domain constraint guarantees this; the cast keeps the type honest
    // without re-validating on every read.
    color: row.color as PaletteColor,
    isProfile: row.is_profile,
    avatarKind: row.avatar_kind,
    avatarId: row.avatar_id,
    avatarPath: row.avatar_path,
    birthday: row.birthday,
    dietaryPrefs: row.dietary_prefs,
    role: row.role,
    userId: row.user_id,
    emoji: row.emoji,
    showOnTasks: row.show_on_tasks,
    // `numeric` arrives as a string from PostgREST.
    sortOrder: Number(row.sort_order),
    hasPin: row.has_pin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSettings(row: HouseholdSettingsRow): HouseholdSettings {
  return {
    householdId: row.household_id,
    showNameNotDate: row.show_name_not_date,
    timeFormat: row.time_format,
    startWeekOn: row.start_week_on,
    punchOutMinutes: row.punch_out_minutes,
    textSize: row.text_size,
    density: row.density,
    updatedAt: row.updated_at,
  };
}
