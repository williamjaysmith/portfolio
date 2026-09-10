/**
 * Which cached reads one changed table can possibly have invalidated (012).
 *
 * **Why this exists now and not before.** Until 012, `useFamilyRealtime`
 * delivered nothing at all — a filtered binding was discarding every binding on
 * the channel — so the cost of answering every notice with
 * `invalidateQueries(familyKeys.all)` was paid by nobody. With the channel
 * fixed, every change on twenty tables reaches every open device, and a bare
 * sweep is **roughly six refetches per device per write**. Ticking one chore on
 * the wall tablet should not refetch the week's events, the meal plan and the
 * shopping lists on the phone as well.
 *
 * **The rule this follows, and the one it refuses.** It narrows by DOMAIN — the
 * family of reads a table's rows can feed — and never by window or by day.
 * Narrowing by window is the trap `useFamilyRealtime` has always warned about:
 * completing a Completed Date occurrence creates a FUTURE day's occurrence, and
 * the cursor read that publishes it is unwindowed, so a day-scoped sweep would
 * break that mode first and quietly. Every task-domain notice therefore still
 * reaches `task-cursors`.
 *
 * **Rare tables keep the bare sweep on purpose.** A Profile renamed, a household
 * setting changed, a reward created — these happen a few times a month, and
 * their blast radius is genuinely wide (a Profile's name and colour are drawn on
 * every tab). Narrowing them would buy nothing measurable and cost real
 * confidence, so they are listed as `EVERYTHING` and say so.
 *
 * What is cheap to get wrong in the generous direction and expensive in the
 * mean one: an extra refetch is invisible, a missing one leaves a wall tablet
 * showing yesterday. Where the two readings were close, this picks the generous
 * one.
 */

/**
 * The second segment of every key in `familyKeys` — `["family", <group>,
 * householdId, ...]`. A prefix of `["family", group, householdId]` therefore
 * reaches every variant of that read, windowed or not, which is what lets this
 * module speak in domains rather than in cache keys.
 */
export type QueryGroup =
  | "categories"
  | "settings"
  | "household"
  | "avatar-urls"
  | "events"
  | "reminder-horizon"
  | "countdowns"
  | "event-search"
  | "category-event-count"
  | "category-task-counts"
  | "tasks"
  | "task-week"
  | "task-carry"
  | "task-cursors"
  | "task-box"
  | "star-week"
  | "star-balances"
  | "rewards"
  | "redemptions"
  | "lists"
  | "list-items"
  | "meal-categories"
  | "recipes"
  | "meals";

/** Every group `familyKeys` can produce. The orphan test below counts on this being complete. */
export const ALL_GROUPS: readonly QueryGroup[] = [
  "categories",
  "settings",
  "household",
  "avatar-urls",
  "events",
  "reminder-horizon",
  "countdowns",
  "event-search",
  "category-event-count",
  "category-task-counts",
  "tasks",
  "task-week",
  "task-carry",
  "task-cursors",
  "task-box",
  "star-week",
  "star-balances",
  "rewards",
  "redemptions",
  "lists",
  "list-items",
  "meal-categories",
  "recipes",
  "meals",
];

/** Everything the calendar reads: the week's windows and the three unwindowed ones beside them. */
const EVENTS_DOMAIN: readonly QueryGroup[] = [
  "events",
  "reminder-horizon",
  "countdowns",
  "event-search",
];

/**
 * The board's five reads plus the Task Box. `task-cursors` is in here always —
 * see the header: it is the unwindowed read that publishes a Completed Date
 * chore's next occurrence, and dropping it is how a narrowed sweep breaks.
 */
const TASKS_DOMAIN: readonly QueryGroup[] = [
  "tasks",
  "task-week",
  "task-carry",
  "task-cursors",
  "task-box",
  "category-task-counts",
];

/** The ledger and what is derived from it — a balance, a week's pill, a card's affordability. */
const REWARDS_DOMAIN: readonly QueryGroup[] = [
  "star-week",
  "star-balances",
  "rewards",
  "redemptions",
  "category-task-counts",
];

const LISTS_DOMAIN: readonly QueryGroup[] = ["lists", "list-items"];

/** A mealtime renamed or a recipe edited both change what the grid and the tokens say. */
const MEALS_DOMAIN: readonly QueryGroup[] = ["meal-categories", "recipes", "meals"];

/** The marker for a table whose blast radius is the whole household, kept deliberately. */
const EVERYTHING = "everything" as const;

type Affected = readonly QueryGroup[] | typeof EVERYTHING;

/**
 * Table → what its rows can have changed.
 *
 * A table absent from here sweeps everything, so a table added to
 * `useFamilyRealtime` without being considered here stays correct while being
 * slow — the safe direction for an omission.
 */
const AFFECTED_BY: Readonly<Record<string, Affected>> = {
  // Rare, wide, and left alone on purpose (see the header).
  categories: EVERYTHING,
  household_settings: EVERYTHING,
  households: EVERYTHING,
  rewards: EVERYTHING,
  reward_eligibilities: EVERYTHING,

  // The calendar.
  events: EVENTS_DOMAIN,
  event_categories: [...EVENTS_DOMAIN, "category-event-count"],
  event_exceptions: EVENTS_DOMAIN,

  // The board. A resolution is also a ledger entry's cause — completing a chore
  // awards stars — so every task-domain write reaches the rewards domain too.
  tasks: [...TASKS_DOMAIN, ...REWARDS_DOMAIN],
  task_assignees: [...TASKS_DOMAIN, ...REWARDS_DOMAIN],
  task_resolutions: [...TASKS_DOMAIN, ...REWARDS_DOMAIN],
  task_box_items: ["task-box"],

  // The ledger. Its own domain only: a star entry changes no chore's definition.
  star_entries: REWARDS_DOMAIN,
  redemptions: REWARDS_DOMAIN,

  lists: LISTS_DOMAIN,
  list_items: LISTS_DOMAIN,

  meal_categories: MEALS_DOMAIN,
  recipes: MEALS_DOMAIN,
  meals: MEALS_DOMAIN,
  meal_exceptions: MEALS_DOMAIN,
};

/**
 * The query-key prefixes to invalidate for one change to `table`.
 *
 * `[["family"]]` — the bare sweep — for a table whose radius is the household,
 * and for any table this module has not been told about.
 */
export function invalidationPrefixesFor(
  table: string,
  householdId: string,
): readonly (readonly unknown[])[] {
  const affected = AFFECTED_BY[table];
  if (affected === undefined || affected === EVERYTHING) return [["family"]];
  return affected.map((group) => ["family", group, householdId]);
}

/** Test seam: the domains a table touches, by name, without building keys. */
export function affectedGroupsFor(table: string): readonly QueryGroup[] | "everything" {
  const affected = AFFECTED_BY[table];
  if (affected === undefined || affected === EVERYTHING) return "everything";
  return affected;
}
