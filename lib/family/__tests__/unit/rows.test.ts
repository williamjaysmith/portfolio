import { describe, it, expect } from "vitest";
import {
  CATEGORY_COLUMNS,
  EVENT_CATEGORY_COLUMNS,
  EVENT_COLUMNS,
  EVENT_EXCEPTION_COLUMNS,
  HOUSEHOLD_COLUMNS,
  REDEMPTION_COLUMNS,
  REWARD_COLUMNS,
  REWARD_ELIGIBILITY_COLUMNS,
  SETTINGS_COLUMNS,
  STAR_BALANCE_COLUMNS,
  STAR_ENTRY_COLUMNS,
  type CategoryRow,
  type EventCategoryRow,
  type EventExceptionRow,
  type EventRow,
  type EventWithRelationsRow,
  type HouseholdRow,
  type HouseholdSettingsRow,
  type RedemptionRow,
  type RewardEligibilityRow,
  type RewardRow,
  type StarBalanceRow,
  type StarEntryRow,
  rewardsSelect,
  toCategory,
  toEvent,
  toEventException,
  toHousehold,
  toRedemption,
  toReward,
  toSettings,
  toStarBalance,
  toStarEntry,
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

/* ------------------------------------------------------------------------- *
 * Rewards (Phase 4 — specs/004-family-rewards, data-model 024–026)
 * ------------------------------------------------------------------------- */

const REWARD_ID = "55555555-5555-4555-8555-555555555555";
const CLEO = "66666666-6666-4666-8666-666666666666";
const BEN = "77777777-7777-4777-8777-777777777777";
const RESOLUTION_ID = "88888888-8888-4888-8888-888888888888";
const REDEMPTION_ID = "99999999-9999-4999-8999-999999999999";

const rewardRow: RewardRow = {
  id: REWARD_ID,
  household_id: HOUSEHOLD_ID,
  name: "Bake cookies",
  description: "With whoever is home",
  emoji: "🍪",
  point_value: 20,
  respawn_on_redemption: true,
  created_by: "11111111-1111-4111-8111-111111111111",
  updated_by: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-02T10:00:00.000Z",
};

const eligibilityRow = (category_id: string): RewardEligibilityRow => ({
  household_id: HOUSEHOLD_ID,
  reward_id: REWARD_ID,
  category_id,
  created_at: "2026-09-01T10:00:00.000Z",
});

const creditRow: StarEntryRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  household_id: HOUSEHOLD_ID,
  category_id: CLEO,
  amount: 10,
  kind: "credit",
  earned_on: "2026-09-04",
  resolution_id: RESOLUTION_ID,
  redemption_id: null,
  summary: "Feed the cat",
  created_by: BEN,
  entered_on: "2026-09-04",
  created_at: "2026-09-04T13:00:00.000Z",
};

const balanceRow: StarBalanceRow = { category_id: CLEO, balance: 15 };

const redemptionRow: RedemptionRow = {
  id: REDEMPTION_ID,
  household_id: HOUSEHOLD_ID,
  reward_id: REWARD_ID,
  category_id: CLEO,
  point_value: 20,
  reward_name: "Bake cookies",
  redeemed_on: "2026-09-05",
  redeemed_at: "2026-09-05T22:10:00.000Z",
  redeemed_by: CLEO,
  reversed_at: null,
  reversed_by: null,
};

describe("column constants", () => {
  const ALL_COLUMN_CONSTANTS = [
    HOUSEHOLD_COLUMNS,
    CATEGORY_COLUMNS,
    SETTINGS_COLUMNS,
    EVENT_COLUMNS,
    EVENT_CATEGORY_COLUMNS,
    EVENT_EXCEPTION_COLUMNS,
    REWARD_COLUMNS,
    REWARD_ELIGIBILITY_COLUMNS,
    STAR_ENTRY_COLUMNS,
    STAR_BALANCE_COLUMNS,
    REDEMPTION_COLUMNS,
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
    expect(columnList(REWARD_COLUMNS).sort()).toEqual(Object.keys(rewardRow).sort());
    expect(columnList(REWARD_ELIGIBILITY_COLUMNS).sort()).toEqual(
      Object.keys(eligibilityRow(CLEO)).sort(),
    );
    expect(columnList(STAR_ENTRY_COLUMNS).sort()).toEqual(Object.keys(creditRow).sort());
    expect(columnList(STAR_BALANCE_COLUMNS).sort()).toEqual(Object.keys(balanceRow).sort());
    expect(columnList(REDEMPTION_COLUMNS).sort()).toEqual(Object.keys(redemptionRow).sort());
  });

  it("selects has_pin, the boolean flag, and nothing else PIN-shaped", () => {
    const pinish = columnList(CATEGORY_COLUMNS).filter((column) => column.includes("pin"));
    expect(pinish).toEqual(["has_pin"]);
  });
});

describe("toReward", () => {
  it("maps every column and embeds the eligible Profiles as categoryIds", () => {
    expect(
      toReward({ ...rewardRow, reward_eligibilities: [eligibilityRow(CLEO)] }),
    ).toEqual({
      id: REWARD_ID,
      householdId: HOUSEHOLD_ID,
      name: "Bake cookies",
      description: "With whoever is home",
      emoji: "🍪",
      pointValue: 20,
      respawnOnRedemption: true,
      categoryIds: [CLEO],
      createdBy: "11111111-1111-4111-8111-111111111111",
      updatedBy: null,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-02T10:00:00.000Z",
    });
  });

  it("pins the eligibility order by id, not by arrival order", () => {
    const reward = toReward({
      ...rewardRow,
      reward_eligibilities: [eligibilityRow(BEN), eligibilityRow(CLEO)],
    });
    expect(reward.categoryIds).toEqual([CLEO, BEN]);
  });

  it("keeps a one-time reward's flag false and its blanks null", () => {
    const reward = toReward({
      ...rewardRow,
      description: null,
      emoji: null,
      respawn_on_redemption: false,
      reward_eligibilities: [],
    });
    expect(reward.respawnOnRedemption).toBe(false);
    expect(reward.description).toBeNull();
    expect(reward.emoji).toBeNull();
    expect(reward.categoryIds).toEqual([]);
  });

  it("emits no snake_case keys, so a row is never passed through wholesale", () => {
    for (const key of Object.keys(toReward({ ...rewardRow, reward_eligibilities: [] }))) {
      expect(key).not.toContain("_");
    }
  });
});

describe("toStarEntry", () => {
  it("maps a credit with the Profile credited apart from the actor", () => {
    expect(toStarEntry(creditRow)).toEqual({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      householdId: HOUSEHOLD_ID,
      categoryId: CLEO,
      amount: 10,
      kind: "credit",
      earnedOn: "2026-09-04",
      resolutionId: RESOLUTION_ID,
      redemptionId: null,
      summary: "Feed the cat",
      createdBy: BEN,
      enteredOn: "2026-09-04",
      createdAt: "2026-09-04T13:00:00.000Z",
    });
  });

  it("keeps a debit negative and a redemption's undated shape null", () => {
    const debit = toStarEntry({
      ...creditRow,
      amount: -20,
      kind: "redemption",
      earned_on: null,
      resolution_id: null,
      redemption_id: REDEMPTION_ID,
      summary: "Bake cookies",
    });
    expect(debit.amount).toBe(-20);
    expect(debit.kind).toBe("redemption");
    expect(debit.earnedOn).toBeNull();
    expect(debit.resolutionId).toBeNull();
    expect(debit.redemptionId).toBe(REDEMPTION_ID);
  });

  it("keeps an adjustment's null summary and actor as null", () => {
    const adjustment = toStarEntry({
      ...creditRow,
      kind: "adjustment",
      earned_on: null,
      resolution_id: null,
      summary: null,
      created_by: null,
    });
    expect(adjustment.summary).toBeNull();
    expect(adjustment.createdBy).toBeNull();
    for (const key of Object.keys(adjustment)) {
      expect(key).not.toContain("_");
    }
  });
});

describe("toStarBalance", () => {
  it("maps the view's row", () => {
    expect(toStarBalance(balanceRow)).toEqual({ categoryId: CLEO, balance: 15 });
  });

  it("keeps zero and a negative balance as numbers rather than dropping them", () => {
    expect(toStarBalance({ ...balanceRow, balance: 0 }).balance).toBe(0);
    expect(toStarBalance({ ...balanceRow, balance: -5 }).balance).toBe(-5);
  });
});

describe("toRedemption", () => {
  it("maps a standing redemption with its copied cost and name", () => {
    expect(toRedemption(redemptionRow)).toEqual({
      id: REDEMPTION_ID,
      householdId: HOUSEHOLD_ID,
      rewardId: REWARD_ID,
      categoryId: CLEO,
      pointValue: 20,
      rewardName: "Bake cookies",
      redeemedOn: "2026-09-05",
      redeemedAt: "2026-09-05T22:10:00.000Z",
      redeemedBy: CLEO,
      reversedAt: null,
      reversedBy: null,
    });
  });

  it("carries a reversal's pair and keeps a departed actor null", () => {
    const reversed = toRedemption({
      ...redemptionRow,
      redeemed_by: null,
      reversed_at: "2026-09-06T08:00:00.000Z",
      reversed_by: BEN,
    });
    expect(reversed.redeemedBy).toBeNull();
    expect(reversed.reversedAt).toBe("2026-09-06T08:00:00.000Z");
    expect(reversed.reversedBy).toBe(BEN);
    for (const key of Object.keys(reversed)) {
      expect(key).not.toContain("_");
    }
  });
});

/**
 * The rewards select is built as a joined list like `eventsSelect`, because
 * two adjacent template literals shipped to production folded — the bundler
 * ate the seam between the embeds (PGRST100 on every client-side read).
 * These assertions are about the STRING's shape, not the columns.
 */
describe("rewardsSelect", () => {
  const select = rewardsSelect();

  it("closes the one embed it opens and never dips below the top level", () => {
    let depth = 0;
    const running = [...select].map((character) => {
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      return depth;
    });
    expect(Math.min(...running)).toBe(0);
    expect(depth).toBe(0);
    expect(select.split("(")).toHaveLength(2);
  });

  it("keeps the seam between the columns and the embed", () => {
    expect(select.startsWith(`${REWARD_COLUMNS},reward_eligibilities(`)).toBe(true);
    expect(select.endsWith(`(${REWARD_ELIGIBILITY_COLUMNS})`)).toBe(true);
  });

  it("separates every top-level part with a comma and no blanks", () => {
    const topLevel = select.replace(/\([^()]*\)/g, "");
    for (const part of topLevel.split(",")) expect(part.trim()).toMatch(/^[a-z_]+$/);
  });
});
