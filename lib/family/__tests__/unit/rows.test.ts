import { describe, it, expect } from "vitest";
import {
  CATEGORY_COLUMNS,
  EVENT_CATEGORY_COLUMNS,
  EVENT_COLUMNS,
  EVENT_EXCEPTION_COLUMNS,
  HOUSEHOLD_COLUMNS,
  SETTINGS_COLUMNS,
  type CategoryRow,
  type EventCategoryRow,
  type EventExceptionRow,
  type EventRow,
  type EventWithRelationsRow,
  type HouseholdRow,
  type HouseholdSettingsRow,
  toCategory,
  toEvent,
  toEventException,
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
  timezone: "America/Chicago",
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
      timezone: "America/Chicago",
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

const EVENT_ID = "22222222-2222-4222-8222-222222222222";

const baseEventRow: EventRow = {
  id: EVENT_ID,
  household_id: HOUSEHOLD_ID,
  summary: "Piano",
  description: "Bring the blue book",
  location: "Miss Reed's",
  all_day: false,
  starts_at: "2026-10-06T22:00:00.000Z",
  ends_at: "2026-10-06T22:45:00.000Z",
  start_date: null,
  end_date: null,
  timezone: "America/Chicago",
  rrule: "FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TU",
  countdown_enabled: false,
  created_by: null,
  updated_by: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
};

const timedEventRow: EventWithRelationsRow = {
  ...baseEventRow,
  event_categories: [],
  event_exceptions: [],
};

const linkRow = (category_id: string, position: number): EventCategoryRow => ({
  event_id: EVENT_ID,
  category_id,
  household_id: HOUSEHOLD_ID,
  position,
  created_at: "2026-09-01T10:00:00.000Z",
});

const skipRow: EventExceptionRow = {
  id: "33333333-3333-4333-8333-333333333333",
  household_id: HOUSEHOLD_ID,
  event_id: EVENT_ID,
  occurrence_date: "2026-10-13",
  action: "skip",
  summary: null,
  description: null,
  location: null,
  starts_at: null,
  ends_at: null,
  start_date: null,
  end_date: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
};

describe("toEvent", () => {
  it("maps a timed row to the timed shape with no snake_case keys", () => {
    const event = toEvent(timedEventRow);
    expect(event.times).toEqual({
      allDay: false,
      startsAt: "2026-10-06T22:00:00.000Z",
      endsAt: "2026-10-06T22:45:00.000Z",
    });
    expect(event.rrule).toBe("FREQ=WEEKLY;INTERVAL=1;WKST=SU;BYDAY=TU");
    expect(event.countdownEnabled).toBe(false);
    for (const key of Object.keys(event)) {
      expect(key).not.toContain("_");
    }
  });

  it("maps an all-day row to the inclusive date shape", () => {
    const event = toEvent({
      ...timedEventRow,
      all_day: true,
      starts_at: null,
      ends_at: null,
      start_date: "2026-10-06",
      end_date: "2026-10-08",
      rrule: null,
    });
    expect(event.times).toEqual({ allDay: true, startDate: "2026-10-06", endDate: "2026-10-08" });
    expect(event.rrule).toBeNull();
  });

  it("orders categoryIds by position, not by arrival order", () => {
    const event = toEvent({
      ...timedEventRow,
      event_categories: [linkRow("cat-b", 1), linkRow("cat-a", 0), linkRow("cat-c", 2)],
    });
    expect(event.categoryIds).toEqual(["cat-a", "cat-b", "cat-c"]);
  });

  it("orders exceptions by occurrence date, not by arrival order", () => {
    const event = toEvent({
      ...timedEventRow,
      event_exceptions: [skipRow, { ...skipRow, id: "44444444-4444-4444-8444-444444444444", occurrence_date: "2026-10-06" }],
    });
    expect(event.exceptions.map((exception) => exception.occurrenceDate)).toEqual([
      "2026-10-06",
      "2026-10-13",
    ]);
  });
});

describe("toEventException", () => {
  it("maps a skip with no payload and null times", () => {
    const exception = toEventException(skipRow);
    expect(exception.action).toBe("skip");
    expect(exception.times).toBeNull();
    expect(exception.summary).toBeNull();
    expect(exception.occurrenceDate).toBe("2026-10-13");
  });

  it("maps a timed override to the timed shape", () => {
    const exception = toEventException({
      ...skipRow,
      action: "override",
      starts_at: "2026-10-06T23:00:00.000Z",
      ends_at: "2026-10-06T23:45:00.000Z",
    });
    expect(exception.times).toEqual({
      allDay: false,
      startsAt: "2026-10-06T23:00:00.000Z",
      endsAt: "2026-10-06T23:45:00.000Z",
    });
  });

  it("maps a date-pair override to the all-day shape (an FR-251 grid→band drag)", () => {
    const exception = toEventException({
      ...skipRow,
      action: "override",
      start_date: "2026-10-06",
      end_date: "2026-10-06",
    });
    expect(exception.times).toEqual({ allDay: true, startDate: "2026-10-06", endDate: "2026-10-06" });
  });

  it("keeps a title-only override's times null so the series time is inherited", () => {
    const exception = toEventException({ ...skipRow, action: "override", summary: "Recital" });
    expect(exception.times).toBeNull();
    expect(exception.summary).toBe("Recital");
  });
});

describe("column constants", () => {
  const ALL_COLUMN_CONSTANTS = [
    HOUSEHOLD_COLUMNS,
    CATEGORY_COLUMNS,
    SETTINGS_COLUMNS,
    EVENT_COLUMNS,
    EVENT_CATEGORY_COLUMNS,
    EVENT_EXCEPTION_COLUMNS,
  ];

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
    expect(columnList(EVENT_COLUMNS).sort()).toEqual(Object.keys(baseEventRow).sort());
    expect(columnList(EVENT_CATEGORY_COLUMNS).sort()).toEqual(
      Object.keys(linkRow("cat-a", 0)).sort(),
    );
    expect(columnList(EVENT_EXCEPTION_COLUMNS).sort()).toEqual(Object.keys(skipRow).sort());
  });

  it("selects has_pin, the boolean flag, and nothing else PIN-shaped", () => {
    const pinish = columnList(CATEGORY_COLUMNS).filter((column) => column.includes("pin"));
    expect(pinish).toEqual(["has_pin"]);
  });
});
