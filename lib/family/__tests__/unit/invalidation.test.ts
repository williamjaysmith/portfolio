/**
 * 012 — what one changed table can have invalidated.
 *
 * The whole risk of narrowing a sweep is **silence**: a missed key does not
 * throw, it leaves the wall tablet showing yesterday, and nobody finds out until
 * somebody notices the house has moved on. So these tests are shaped around the
 * ways that happens rather than around the shape of the map:
 *
 *   - no group may be ORPHANED — every read `familyKeys` can produce must be
 *     reachable from some table, or a feature quietly stops updating;
 *   - the hot paths must reach what the tab they happen on actually reads;
 *   - an unknown table must sweep everything, so the next person to add one is
 *     slow rather than wrong;
 *   - `task-cursors` must be in every task-domain answer, because that is the
 *     specific narrowing `useFamilyRealtime` has always warned about.
 */

import { describe, expect, it } from "vitest";

import {
  ALL_GROUPS,
  affectedGroupsFor,
  invalidationPrefixesFor,
  type QueryGroup,
} from "@/lib/family/invalidation";
import { familyKeys } from "@/lib/family/queries";

const HOUSEHOLD = "household-1";

/** Every table `useFamilyRealtime` subscribes to, in its order. */
const SUBSCRIBED_TABLES = [
  "categories",
  "household_settings",
  "households",
  "events",
  "event_categories",
  "event_exceptions",
  "tasks",
  "task_assignees",
  "task_resolutions",
  "task_box_items",
  "rewards",
  "reward_eligibilities",
  "star_entries",
  "redemptions",
  "lists",
  "list_items",
  "meal_categories",
  "recipes",
  "meals",
  "meal_exceptions",
] as const;

/** The groups a table reaches, with `everything` expanded to all of them. */
function reach(table: string): readonly QueryGroup[] {
  const affected = affectedGroupsFor(table);
  return affected === "everything" ? ALL_GROUPS : affected;
}

describe("the group list matches familyKeys", () => {
  /**
   * `ALL_GROUPS` is hand-written, and the orphan test below is only as good as
   * it is. This derives the truth from `familyKeys` itself so the two cannot
   * drift: a key added there without a group here fails this.
   */
  it("names every group familyKeys can actually produce", () => {
    const builders = [
      familyKeys.categories(HOUSEHOLD),
      familyKeys.settings(HOUSEHOLD),
      familyKeys.household(HOUSEHOLD),
      familyKeys.avatarUrls(HOUSEHOLD),
      familyKeys.events(HOUSEHOLD),
      familyKeys.week(HOUSEHOLD, { startDate: "2026-09-06", endDate: "2026-09-12" }),
      familyKeys.reminderHorizon(HOUSEHOLD, "2026-09-16"),
      familyKeys.countdowns(HOUSEHOLD),
      familyKeys.eventSearch(HOUSEHOLD, "swim"),
      familyKeys.categoryEventCount(HOUSEHOLD, "category-1"),
      familyKeys.categoryTaskCounts(HOUSEHOLD, "category-1"),
      familyKeys.tasks(HOUSEHOLD),
      familyKeys.taskWeek(HOUSEHOLD, "2026-09-06"),
      familyKeys.taskCarry(HOUSEHOLD, "2026-09-09"),
      familyKeys.taskCursors(HOUSEHOLD),
      familyKeys.taskBox(HOUSEHOLD),
      familyKeys.starWeek(HOUSEHOLD, "2026-09-06"),
      familyKeys.balances(HOUSEHOLD),
      familyKeys.rewards(HOUSEHOLD),
      familyKeys.redemptions(HOUSEHOLD),
      familyKeys.lists(HOUSEHOLD),
      familyKeys.listItems(HOUSEHOLD),
      familyKeys.mealCategories(HOUSEHOLD),
      familyKeys.recipes(HOUSEHOLD),
      familyKeys.meals(HOUSEHOLD),
    ];

    const used = new Set(builders.map((key) => key[1]));
    expect([...used].sort()).toEqual([...ALL_GROUPS].sort());
  });
});

describe("nothing is orphaned", () => {
  /**
   * The test this change exists to be safe under. A group no table reaches is a
   * read that never refreshes on another device — the failure mode is a screen
   * that is quietly out of date, which no other test in this repo would catch.
   */
  it("reaches every group from at least one subscribed table", () => {
    const reached = new Set<QueryGroup>();
    for (const table of SUBSCRIBED_TABLES) for (const group of reach(table)) reached.add(group);

    const orphans = ALL_GROUPS.filter((group) => !reached.has(group));
    expect(orphans, "groups no table can invalidate").toEqual([]);
  });
});

describe("the hot paths reach the tab they happen on", () => {
  it("a ticked chore reaches the board's five reads and the stars it awards", () => {
    const groups = reach("task_resolutions");

    for (const group of ["tasks", "task-week", "task-carry", "task-cursors"] as const) {
      expect(groups, `a resolution must reach ${group}`).toContain(group);
    }
    // Completing a chore writes a ledger row, which moves the other device's
    // balance, its week pill and every reward card's affordability (004 R407).
    for (const group of ["star-week", "star-balances"] as const) {
      expect(groups, `a resolution must reach ${group}`).toContain(group);
    }
  });

  it("keeps task-cursors in every task-domain answer (the warned-about narrowing)", () => {
    // Completing a Completed Date occurrence creates a FUTURE day's occurrence,
    // and the cursor read that publishes it is unwindowed. This is the one
    // narrowing `useFamilyRealtime` has always said would break first.
    for (const table of ["tasks", "task_assignees", "task_resolutions"] as const) {
      expect(reach(table), `${table} must reach task-cursors`).toContain("task-cursors");
    }
  });

  it("an added list item reaches both list reads and nothing else", () => {
    expect(reach("list_items")).toEqual(["lists", "list-items"]);
  });

  it("a planned meal reaches the grid and the calendar's tokens", () => {
    expect(reach("meals")).toEqual(["meal-categories", "recipes", "meals"]);
  });

  it("an event reaches the week, the countdowns, the banner's horizon and the search", () => {
    const groups = reach("events");
    for (const group of ["events", "reminder-horizon", "countdowns", "event-search"] as const) {
      expect(groups).toContain(group);
    }
  });
});

describe("what it deliberately does not narrow", () => {
  it("sweeps everything for the rare, wide tables", () => {
    // A Profile's name and colour are drawn on every tab, and these change a few
    // times a month. Narrowing them would buy nothing measurable.
    for (const table of ["categories", "household_settings", "households", "rewards"] as const) {
      expect(affectedGroupsFor(table), table).toBe("everything");
    }
  });

  it("sweeps everything for a table it has never heard of", () => {
    // The safe direction for an omission: a table added to the channel without
    // being considered here is slow, never wrong.
    expect(affectedGroupsFor("some_future_table")).toBe("everything");
    expect(invalidationPrefixesFor("some_future_table", HOUSEHOLD)).toEqual([["family"]]);
  });
});

describe("the prefixes it hands the query client", () => {
  it("is the bare family prefix for a whole-household change", () => {
    expect(invalidationPrefixesFor("categories", HOUSEHOLD)).toEqual([["family"]]);
  });

  it("is household-scoped, and a PREFIX so windowed entries are reached too", () => {
    const prefixes = invalidationPrefixesFor("list_items", HOUSEHOLD);

    expect(prefixes).toEqual([
      ["family", "lists", HOUSEHOLD],
      ["family", "list-items", HOUSEHOLD],
    ]);
  });

  it("reaches every cached window of events from one prefix", () => {
    // `week` keys extend `events` with their day range, so the prefix that
    // invalidates the group invalidates every window a device has cached.
    const [eventsPrefix] = invalidationPrefixesFor("events", HOUSEHOLD);
    const oneWindow = familyKeys.week(HOUSEHOLD, { startDate: "2026-09-06", endDate: "2026-09-12" });

    expect(oneWindow.slice(0, 3)).toEqual(eventsPrefix);
  });
});
