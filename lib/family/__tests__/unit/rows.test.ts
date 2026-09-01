import { describe, it, expect } from "vitest";
import {
  CATEGORY_COLUMNS,
  HOUSEHOLD_COLUMNS,
  SETTINGS_COLUMNS,
  type CategoryRow,
  type HouseholdRow,
  type HouseholdSettingsRow,
  toCategory,
  toHousehold,
  toSettings,
} from "@/lib/family/rows";

/**
 * The mappers are the only door between PostgREST rows and the domain types,
 * and the column constants are the privacy contract: no query may ever ask for
 * `*` or for anything PIN-related (the hash lives in `family.profile_pins`,
 * which the app holds no grant on at all).
 */

function columnList(columns: string): string[] {
  return columns.split(",").map((column) => column.trim());
}

/** Columns that must never appear in a select list, on any table. */
const FORBIDDEN_COLUMNS = ["pin_hash", "pin_set_at", "failed_attempts", "locked_until"];

const HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";

const householdRow: HouseholdRow = {
  id: HOUSEHOLD_ID,
  name: "Our Family",
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-02-02T11:30:00.000Z",
};

const profileRow: CategoryRow = {
  id: "11111111-1111-4111-8111-111111111111",
  household_id: HOUSEHOLD_ID,
  label: "Alex",
  color: "#2178AF",
  is_profile: true,
  avatar_kind: "illustration",
  avatar_id: "fox",
  avatar_path: "00000000-0000-4000-8000-000000000001/11111111.webp",
  birthday: "1990-04-01",
  dietary_prefs: "No peanuts",
  role: "parent",
  user_id: "22222222-2222-4222-8222-222222222222",
  emoji: null,
  show_on_tasks: true,
  sort_order: 2000,
  has_pin: true,
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-02-02T11:30:00.000Z",
};

/** A Label: every profile-only column is null and nothing may be coerced. */
const labelRow: CategoryRow = {
  id: "33333333-3333-4333-8333-333333333333",
  household_id: HOUSEHOLD_ID,
  label: "Holidays",
  color: "#FDC36D",
  is_profile: false,
  avatar_kind: null,
  avatar_id: null,
  avatar_path: null,
  birthday: null,
  dietary_prefs: null,
  role: "member",
  user_id: null,
  emoji: "🎉",
  show_on_tasks: false,
  sort_order: "1500.5",
  has_pin: false,
  created_at: "2026-01-03T10:00:00.000Z",
  updated_at: "2026-01-04T10:00:00.000Z",
};

const settingsRow: HouseholdSettingsRow = {
  household_id: HOUSEHOLD_ID,
  show_name_not_date: true,
  time_format: "24h",
  start_week_on: 1,
  punch_out_minutes: 15,
  text_size: "large",
  density: "roomy",
  updated_at: "2026-02-02T11:30:00.000Z",
};

describe("toHousehold", () => {
  it("maps every column to its camelCase field", () => {
    expect(toHousehold(householdRow)).toEqual({
      id: HOUSEHOLD_ID,
      name: "Our Family",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-02-02T11:30:00.000Z",
    });
  });

  it("emits no snake_case keys, so a row is never passed through wholesale", () => {
    for (const key of Object.keys(toHousehold(householdRow))) {
      expect(key).not.toContain("_");
    }
  });
});

describe("toCategory", () => {
  it("maps every column of a profile row to its camelCase field", () => {
    expect(toCategory(profileRow)).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      householdId: HOUSEHOLD_ID,
      label: "Alex",
      color: "#2178AF",
      isProfile: true,
      avatarKind: "illustration",
      avatarId: "fox",
      avatarPath: "00000000-0000-4000-8000-000000000001/11111111.webp",
      birthday: "1990-04-01",
      dietaryPrefs: "No peanuts",
      role: "parent",
      userId: "22222222-2222-4222-8222-222222222222",
      emoji: null,
      showOnTasks: true,
      sortOrder: 2000,
      hasPin: true,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-02-02T11:30:00.000Z",
    });
  });

  it("maps every column of a label row, keeping emoji and false flags", () => {
    expect(toCategory(labelRow)).toEqual({
      id: "33333333-3333-4333-8333-333333333333",
      householdId: HOUSEHOLD_ID,
      label: "Holidays",
      color: "#FDC36D",
      isProfile: false,
      avatarKind: null,
      avatarId: null,
      avatarPath: null,
      birthday: null,
      dietaryPrefs: null,
      role: "member",
      userId: null,
      emoji: "🎉",
      showOnTasks: false,
      sortOrder: 1500.5,
      hasPin: false,
      createdAt: "2026-01-03T10:00:00.000Z",
      updatedAt: "2026-01-04T10:00:00.000Z",
    });
  });

  it("preserves nulls as null rather than undefined", () => {
    const label = toCategory(labelRow);
    expect(label.avatarKind).toBeNull();
    expect(label.avatarId).toBeNull();
    expect(label.avatarPath).toBeNull();
    expect(label.birthday).toBeNull();
    expect(label.dietaryPrefs).toBeNull();
    expect(label.userId).toBeNull();
    expect(toCategory(profileRow).emoji).toBeNull();
  });

  it("converts the numeric sort_order PostgREST sends as a string", () => {
    const result = toCategory({ ...profileRow, sort_order: "1500.5" });
    expect(result.sortOrder).toBe(1500.5);
    expect(typeof result.sortOrder).toBe("number");
  });

  it("keeps a zero sort_order as 0 rather than dropping it", () => {
    expect(toCategory({ ...profileRow, sort_order: "0" }).sortOrder).toBe(0);
    expect(toCategory({ ...profileRow, sort_order: 0 }).sortOrder).toBe(0);
  });

  it("emits no snake_case keys, so a row is never passed through wholesale", () => {
    for (const key of Object.keys(toCategory(profileRow))) {
      expect(key).not.toContain("_");
    }
  });
});

describe("toSettings", () => {
  it("maps every column to its camelCase field", () => {
    expect(toSettings(settingsRow)).toEqual({
      householdId: HOUSEHOLD_ID,
      showNameNotDate: true,
      timeFormat: "24h",
      startWeekOn: 1,
      punchOutMinutes: 15,
      textSize: "large",
      density: "roomy",
      updatedAt: "2026-02-02T11:30:00.000Z",
    });
  });

  it("keeps Sunday (0) and false flags rather than treating them as absent", () => {
    const result = toSettings({ ...settingsRow, start_week_on: 0, show_name_not_date: false });
    expect(result.startWeekOn).toBe(0);
    expect(result.showNameNotDate).toBe(false);
  });

  it("emits no snake_case keys, so a row is never passed through wholesale", () => {
    for (const key of Object.keys(toSettings(settingsRow))) {
      expect(key).not.toContain("_");
    }
  });
});

describe("column constants", () => {
  const ALL_COLUMN_CONSTANTS = [HOUSEHOLD_COLUMNS, CATEGORY_COLUMNS, SETTINGS_COLUMNS];

  it("never selects a wildcard", () => {
    for (const columns of ALL_COLUMN_CONSTANTS) {
      expect(columns).not.toContain("*");
    }
  });

  it("never selects a PIN column", () => {
    for (const columns of ALL_COLUMN_CONSTANTS) {
      for (const forbidden of FORBIDDEN_COLUMNS) {
        expect(columnList(columns)).not.toContain(forbidden);
      }
    }
  });

  it("lists plain, non-empty, non-duplicated identifiers", () => {
    for (const columns of ALL_COLUMN_CONSTANTS) {
      const list = columnList(columns);
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list).size).toBe(list.length);
      for (const column of list) {
        expect(column).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("selects exactly the columns each row type declares", () => {
    expect(columnList(HOUSEHOLD_COLUMNS).sort()).toEqual(Object.keys(householdRow).sort());
    expect(columnList(CATEGORY_COLUMNS).sort()).toEqual(Object.keys(profileRow).sort());
    expect(columnList(SETTINGS_COLUMNS).sort()).toEqual(Object.keys(settingsRow).sort());
  });

  it("selects has_pin, the boolean flag, and nothing else PIN-shaped", () => {
    const pinish = columnList(CATEGORY_COLUMNS).filter((column) => column.includes("pin"));
    expect(pinish).toEqual(["has_pin"]);
  });
});
