/**
 * Reads for /family.
 *
 * Reads do NOT go through server actions (contracts → "Read path"): the
 * browser queries Supabase directly under RLS with the publishable key, which
 * is what makes viewing free (FR-008) and lets Realtime push live updates.
 * Every query names its columns — `select("*")` would ship columns the privacy
 * contract keeps out of reach.
 */

import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays } from "./calendar/dates";
import {
  CATEGORY_COLUMNS,
  HOUSEHOLD_COLUMNS,
  LIST_COLUMNS,
  LIST_ITEM_COLUMNS,
  REDEMPTION_COLUMNS,
  SETTINGS_COLUMNS,
  STAR_BALANCE_COLUMNS,
  STAR_ENTRY_COLUMNS,
  TASK_BOX_COLUMNS,
  TASK_CURSOR_COLUMNS,
  TASK_RESOLUTION_COLUMNS,
  eventsSelect,
  rewardsSelect,
  tasksSelect,
  toCategory,
  toEvent,
  toHousehold,
  toList,
  toListItem,
  toRedemption,
  toReward,
  toSettings,
  toStarBalance,
  toStarEntry,
  toTask,
  toTaskBoxItem,
  toTaskCursor,
  toTaskResolution,
  type CategoryRow,
  type EventWithRelationsRow,
  type HouseholdRow,
  type HouseholdSettingsRow,
  type ListItemRow,
  type ListRow,
  type RedemptionRow,
  type RewardWithEligibilitiesRow,
  type StarBalanceRow,
  type StarEntryRow,
  type TaskBoxItemRow,
  type TaskCursorRow,
  type TaskResolutionRow,
  type TaskWithAssigneesRow,
} from "./rows";
import { createClient } from "./supabase/client";
import { carryReadWindowOf } from "./tasks/dates";
import type {
  Category,
  Event,
  Household,
  HouseholdSettings,
  List,
  ListItem,
  Redemption,
  Reward,
  StarBalance,
  StarEntry,
  Task,
  TaskBoxItem,
  TaskCursor,
  TaskResolution,
  WeekStart,
} from "./types";

/**
 * FR-391's two opposite outcomes of deleting a Profile, for its confirmation —
 * and, from 004 on, the third sentence's number (FR-443).
 */
export interface CategoryTaskCounts {
  /** Tasks somebody else is also assigned to: they stay, without this Profile. */
  losingAnAssignee: number;
  /** Tasks whose only assignee is this Profile: they go with it. */
  deleted: number;
  /**
   * The Profile's SIGNED balance from `star_balances`, which goes with them
   * (004 FR-443): positive is forfeited, negative is a debt the deletion
   * clears (Assumption 5), and the dialog words each. 0 for a Label, which
   * has no row in the view (FR-414).
   */
  starsForfeited: number;
}

/** Phase 3's half of the answer: the two task numbers, before the stars are read. */
type CategoryTaskSplit = Omit<CategoryTaskCounts, "starsForfeited">;

/** The two columns the split above counts over. */
interface AssigneeLinkRow {
  task_id: string;
  category_id: string;
}

/** What identifies one cached window of events: the days it covers, inclusive. */
export interface WeekCacheWindow {
  startDate: string;
  endDate: string;
}

/**
 * Prefix-shaped so one `invalidateQueries({ queryKey: familyKeys.all })` from
 * the Realtime channel sweeps every family query.
 */
export const familyKeys = {
  all: ["family"] as const,
  categories: (householdId: string) => ["family", "categories", householdId] as const,
  settings: (householdId: string) => ["family", "settings", householdId] as const,
  household: (householdId: string) => ["family", "household", householdId] as const,
  avatarUrls: (householdId: string) => ["family", "avatar-urls", householdId] as const,
  /** Every cached window of events, for a prefix sweep. */
  events: (householdId: string) => ["family", "events", householdId] as const,
  /**
   * The cache unit is the DISPLAYED WINDOW (R207), identified by the
   * household-local days it covers, `YYYY-MM-DD..YYYY-MM-DD`. Both bounds are
   * in the key on purpose: a phone's three-day window and a tablet's seven-day
   * one begin on the same day, and keying on the first day alone would let a
   * rotation draw seven columns from a three-day fetch.
   */
  week: (householdId: string, window: WeekCacheWindow) =>
    [...familyKeys.events(householdId), `${window.startDate}..${window.endDate}`] as const,
  /** FR-274's affected-event count for one category's delete confirmation. */
  categoryEventCount: (householdId: string, categoryId: string) =>
    ["family", "category-event-count", householdId, categoryId] as const,
  /** FR-391's two task numbers for the same confirmation — the opposite promise. */
  categoryTaskCounts: (householdId: string, categoryId: string) =>
    ["family", "category-task-counts", householdId, categoryId] as const,
  /**
   * The board's four reads plus its lazy fifth (R314). None is keyed by the
   * displayed day: task DEFINITIONS do not depend on it (an Anytime chore has
   * no date, a Completed Date chore's only occurrence is a cursor, a routine is
   * a rule, a late chore belongs on today), so keying them by the day would
   * refetch byte-identical rows on every Previous/Next tap.
   */
  tasks: (householdId: string) => ["family", "tasks", householdId] as const,
  /** Resolutions in the anchored week containing the displayed day. */
  taskWeek: (householdId: string, weekStartDate: string) =>
    ["family", "task-week", householdId, weekStartDate] as const,
  /** The FR-357 carry tail. Keyed by TODAY, which is what rolls it at midnight. */
  taskCarry: (householdId: string, todayDate: string) =>
    ["family", "task-carry", householdId, todayDate] as const,
  /** The tail of every Completed Date chain — its own read, never an embed. */
  taskCursors: (householdId: string) => ["family", "task-cursors", householdId] as const,
  /** The Task Box templates; fetched only while the sheet is open. */
  taskBox: (householdId: string) => ["family", "task-box", householdId] as const,
  /**
   * The rewards reads (004 R407) — R314's discipline again: definitions and
   * balances unwindowed, the one day-dependent row kind windowed by the SAME
   * anchored week as `taskWeek`, so stepping inside a week costs nothing and
   * the board's fifth read rolls with its second.
   */
  starWeek: (householdId: string, weekStartDate: string) =>
    ["family", "star-week", householdId, weekStartDate] as const,
  /** The `star_balances` view: one row per Profile, the sum of their entries. */
  balances: (householdId: string) => ["family", "star-balances", householdId] as const,
  /** Every reward with its eligibilities embedded. */
  rewards: (householdId: string) => ["family", "rewards", householdId] as const,
  /** Every redemption, standing and reversed — the history card needs all of them. */
  redemptions: (householdId: string) => ["family", "redemptions", householdId] as const,
  /** 005 R506: the Lists tab's two unwindowed reads — every list, every item. */
  lists: (householdId: string) => ["family", "lists", householdId] as const,
  listItems: (householdId: string) => ["family", "list-items", householdId] as const,
};

const STALE_TIME = 30_000;

export async function fetchCategories(
  supabase: SupabaseClient,
  householdId: string,
): Promise<Category[]> {
  const { data, error } = await supabase
    .schema("family")
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CategoryRow[]).map(toCategory);
}

export async function fetchSettings(
  supabase: SupabaseClient,
  householdId: string,
): Promise<HouseholdSettings | null> {
  const { data, error } = await supabase
    .schema("family")
    .from("household_settings")
    .select(SETTINGS_COLUMNS)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toSettings(data as unknown as HouseholdSettingsRow) : null;
}

export async function fetchHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<Household | null> {
  const { data, error } = await supabase
    .schema("family")
    .from("households")
    .select(HOUSEHOLD_COLUMNS)
    .eq("id", householdId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toHousehold(data as unknown as HouseholdRow) : null;
}

/**
 * The fetch bounds of one displayed window, derived by the caller
 * (`lib/family/calendar/dates.ts`) from its first day, its width in days and
 * the household's timezone. Instant bounds serve the timed branch, date bounds
 * the all-day branch — collapsing them would fabricate a
 * midnight-in-some-zone (data-model, "How the week is read").
 */
export interface WeekFetchBounds extends WeekCacheWindow {
  /**
   * First day of the window, `YYYY-MM-DD` in the household zone — half of the
   * cache identity (R207) and the all-day lower bound.
   */
  startDate: string;
  /** Last day of the window, `YYYY-MM-DD` — inclusive, as `end_date` is (FR-225). */
  endDate: string;
  /** ISO instant of the window's opening midnight; timed one-offs must end strictly after it. */
  startsAt: string;
  /** ISO instant of the NEXT week's opening midnight — an exclusive bound. */
  endsAt: string;
}

// The week read embeds the ordered links and EVERY exception with each event
// row — that totality is what makes a moved occurrence findable (R206).
const WEEK_EVENT_COLUMNS = eventsSelect();

export async function fetchWeekEvents(
  supabase: SupabaseClient,
  householdId: string,
  weekWindow: WeekFetchBounds,
): Promise<Event[]> {
  // Three branches, three partial indexes (data-model, "How the week is
  // read"): every series row always arrives — expansion is client-side — and
  // one-offs are windowed by their real bounds. The explicit `rrule.is.null`
  // conjunct is what makes each one-off branch's predicate imply its partial
  // index's predicate; without it neither index is usable.
  const threeBranchOr = [
    "rrule.not.is.null",
    "and(rrule.is.null,all_day.is.false," +
      `starts_at.lt."${weekWindow.endsAt}",ends_at.gt."${weekWindow.startsAt}")`,
    "and(rrule.is.null,all_day.is.true," +
      `start_date.lte."${weekWindow.endDate}",end_date.gte."${weekWindow.startDate}")`,
  ].join(",");
  const { data, error } = await supabase
    .schema("family")
    .from("events")
    .select(WEEK_EVENT_COLUMNS)
    .eq("household_id", householdId)
    .or(threeBranchOr);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as EventWithRelationsRow[]).map(toEvent);
}

/**
 * How many events carry a category — what the category-delete confirmation
 * states (FR-274, Assumption 24). A read, so not an action: the RLS path, and
 * `head: true` because only the number changes hands, never a row. The
 * `household_id` + `category_id` pair is exactly the key of
 * `event_categories_category_idx` (011), so the count is an index scan.
 */
export async function fetchCategoryEventCount(
  supabase: SupabaseClient,
  householdId: string,
  categoryId: string,
): Promise<number> {
  const { count, error } = await supabase
    .schema("family")
    .from("event_categories")
    .select("category_id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("category_id", categoryId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export function useCategoryEventCount(householdId: string, categoryId: string) {
  return useQuery({
    queryKey: familyKeys.categoryEventCount(householdId, categoryId),
    queryFn: () => fetchCategoryEventCount(createClient(), householdId, categoryId),
    staleTime: STALE_TIME,
  });
}

/**
 * FR-391's two numbers, and they point in OPPOSITE directions — which is why
 * both are read and both are stated. Deleting a Profile takes its assignments
 * with it (018's cascade); a task somebody else is also assigned to survives
 * without them, and a task nobody is left assigned to is deleted outright,
 * because a chore becomes up-for-grabs by an explicit choice and never by
 * attrition (Assumption 24, SC-317).
 *
 * Two reads rather than a join: the first is exactly the prefix of
 * `task_assignees_category_idx` (018), and the second re-reads only those tasks
 * by primary key. An up-for-grabs task has no assignee at all, so it is in
 * neither number by construction. Phase 4 adds a third read for the third
 * sentence: the stars that go with the Profile (FR-443, R405).
 */
export async function fetchCategoryTaskCounts(
  supabase: SupabaseClient,
  householdId: string,
  categoryId: string,
): Promise<CategoryTaskCounts> {
  const split = await splitTasksOf(supabase, householdId, categoryId);
  const starsForfeited = await fetchStarsForfeited(supabase, householdId, categoryId);
  return { ...split, starsForfeited };
}

/** Phase 3's two reads, unchanged: the second only when the first found anything. */
async function splitTasksOf(
  supabase: SupabaseClient,
  householdId: string,
  categoryId: string,
): Promise<CategoryTaskSplit> {
  const mine = await supabase
    .schema("family")
    .from("task_assignees")
    .select("task_id")
    .eq("household_id", householdId)
    .eq("category_id", categoryId);
  if (mine.error) throw new Error(mine.error.message);
  const taskIds = ((mine.data ?? []) as unknown as { task_id: string }[]).map(
    (row) => row.task_id,
  );
  if (taskIds.length === 0) return { losingAnAssignee: 0, deleted: 0 };

  const everyone = await supabase
    .schema("family")
    .from("task_assignees")
    .select("task_id, category_id")
    .eq("household_id", householdId)
    .in("task_id", taskIds);
  if (everyone.error) throw new Error(everyone.error.message);
  return splitByCompany(taskIds, (everyone.data ?? []) as unknown as AssigneeLinkRow[]);
}

/**
 * The third number (004 FR-443): this Profile's row of the `star_balances`
 * view, signed. The view is `security_invoker` (025), so this is the caller's
 * own RLS on `star_entries`; `maybeSingle` because a Label has no row there at
 * all (FR-414) and forfeits nothing.
 */
async function fetchStarsForfeited(
  supabase: SupabaseClient,
  householdId: string,
  categoryId: string,
): Promise<number> {
  const { data, error } = await supabase
    .schema("family")
    .from("star_balances")
    .select("balance")
    .eq("household_id", householdId)
    .eq("category_id", categoryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as unknown as Pick<StarBalanceRow, "balance">).balance : 0;
}

/** Shared with somebody else, or this Profile's alone — every task lands in one. */
function splitByCompany(
  taskIds: readonly string[],
  links: readonly AssigneeLinkRow[],
): CategoryTaskSplit {
  let losingAnAssignee = 0;
  for (const taskId of taskIds) {
    const assignees = links.filter((row) => row.task_id === taskId).length;
    if (assignees > 1) losingAnAssignee += 1;
  }
  return { losingAnAssignee, deleted: taskIds.length - losingAnAssignee };
}

export function useCategoryTaskCounts(householdId: string, categoryId: string) {
  return useQuery({
    queryKey: familyKeys.categoryTaskCounts(householdId, categoryId),
    queryFn: () => fetchCategoryTaskCounts(createClient(), householdId, categoryId),
    staleTime: STALE_TIME,
  });
}

export function useCategories(householdId: string, initialData?: Category[]) {
  return useQuery({
    queryKey: familyKeys.categories(householdId),
    queryFn: () => fetchCategories(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useSettings(householdId: string, initialData?: HouseholdSettings) {
  return useQuery({
    queryKey: familyKeys.settings(householdId),
    queryFn: () => fetchSettings(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useHousehold(householdId: string, initialData?: Household) {
  return useQuery({
    queryKey: familyKeys.household(householdId),
    queryFn: () => fetchHousehold(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useWeekEvents(householdId: string, weekWindow: WeekFetchBounds, initialData?: Event[]) {
  return useQuery({
    queryKey: familyKeys.week(householdId, weekWindow),
    queryFn: () => fetchWeekEvents(createClient(), householdId, weekWindow),
    staleTime: STALE_TIME,
    initialData,
  });
}

/**
 * Warms one displayed window's cache entry. Called for each neighbour of a
 * settled anchor (one window either side, derived by the caller), so the next
 * page — by swipe or by arrow — lands on data already there (R207/FR-279).
 */
export function prefetchWeek(
  queryClient: QueryClient,
  householdId: string,
  weekWindow: WeekFetchBounds,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: familyKeys.week(householdId, weekWindow),
    queryFn: () => fetchWeekEvents(createClient(), householdId, weekWindow),
    staleTime: STALE_TIME,
  });
}

/* ------------------------------------------------------------------------- *
 * Tasks (Phase 3 — contracts/server-actions.md "Read path", research R314)
 * ------------------------------------------------------------------------- */

// One embed, built as a joined list rather than adjacent template literals —
// the production bundler folds those and drops the separator between them
// (see `eventsSelect`).
const TASK_SELECT = tasksSelect();

/** The anchored week is seven days from its first, inclusive. */
const TASK_WEEK_DAYS = 7;

/**
 * Read 1 — every `family.tasks` row for the household, with its assignees and
 * their streak pair embedded. **Unwindowed on purpose**: any due-date window
 * here would be wrong rather than merely slow, because an Anytime chore has no
 * date (FR-328), a Completed Date chore's only occurrence is a cursor (FR-343),
 * a routine is a rule, and a chore due three weeks ago belongs on today's board
 * (FR-356). One index, `tasks_household_idx`, serves the whole read path.
 */
export async function fetchTasks(supabase: SupabaseClient, householdId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .schema("family")
    .from("tasks")
    .select(TASK_SELECT)
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as TaskWithAssigneesRow[]).map(toTask);
}

/**
 * Read 2 — the resolutions of the anchored week containing the displayed day,
 * **plus every undated row**: an Anytime chore's single occurrence has no date
 * to fall inside a window and belongs to every day until it is resolved
 * (FR-328). Resolutions are the one thing that grows without bound, which is
 * why they are the only windowed read.
 */
export async function fetchTaskResolutions(
  supabase: SupabaseClient,
  householdId: string,
  weekStartDate: string,
): Promise<TaskResolution[]> {
  const weekEndDate = addDays(weekStartDate, TASK_WEEK_DAYS - 1);
  const weekOrUndated = [
    `and(occurrence_date.gte."${weekStartDate}",occurrence_date.lte."${weekEndDate}")`,
    "occurrence_date.is.null",
  ].join(",");
  const { data, error } = await supabase
    .schema("family")
    .from("task_resolutions")
    .select(TASK_RESOLUTION_COLUMNS)
    .eq("household_id", householdId)
    .or(weekOrUndated);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as TaskResolutionRow[]).map(toTaskResolution);
}

/**
 * Read 3 — `[today − CARRY_FORWARD_DAYS, weekStart(today) − 1]`, the FR-357
 * tail minus what read 2 already holds. Its bound comes from
 * `lib/family/tasks/dates.ts`, the same module the render pass reads it from,
 * so the number the read is bounded by and the number the render is bounded by
 * are the same number by construction (R316). Enabled only while the displayed
 * day IS today: a pinned past or future day needs none of it (US3-3).
 */
export async function fetchTaskCarryForward(
  supabase: SupabaseClient,
  householdId: string,
  todayDate: string,
  startWeekOn: WeekStart,
): Promise<TaskResolution[]> {
  const window = carryReadWindowOf(todayDate, startWeekOn);
  const { data, error } = await supabase
    .schema("family")
    .from("task_resolutions")
    .select(TASK_RESOLUTION_COLUMNS)
    .eq("household_id", householdId)
    .gte("occurrence_date", window.startDate)
    .lte("occurrence_date", window.endDate);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as TaskResolutionRow[]).map(toTaskResolution);
}

/**
 * Read 4 — the tail of every Completed Date chain, from the `family.task_cursors`
 * view. **Its own query, never a PostgREST embed on read 1**: embedding needs a
 * declared foreign key and a view has none, so the embed would silently return
 * nothing rather than erroring and Completed Date would be missing from the
 * board with no failure to notice (R309, R314). Unwindowed, because the row
 * that decides what is due today may be arbitrarily old.
 */
export async function fetchTaskCursors(
  supabase: SupabaseClient,
  householdId: string,
): Promise<TaskCursor[]> {
  const { data, error } = await supabase
    .schema("family")
    .from("task_cursors")
    .select(TASK_CURSOR_COLUMNS)
    .eq("household_id", householdId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as TaskCursorRow[]).map(toTaskCursor);
}

/**
 * Read 5 — the Task Box templates (FR-377), off the critical path: seventeen
 * rows nobody looks at on a normal day, fetched only while the sheet is open.
 * Chores before routines, the two sections the sheet renders.
 */
export async function fetchTaskBox(
  supabase: SupabaseClient,
  householdId: string,
): Promise<TaskBoxItem[]> {
  const { data, error } = await supabase
    .schema("family")
    .from("task_box_items")
    .select(TASK_BOX_COLUMNS)
    .eq("household_id", householdId)
    .order("routine", { ascending: true })
    .order("summary", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as TaskBoxItemRow[]).map(toTaskBoxItem);
}

export function useTasks(householdId: string, initialData?: Task[]) {
  return useQuery({
    queryKey: familyKeys.tasks(householdId),
    queryFn: () => fetchTasks(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useTaskResolutions(
  householdId: string,
  weekStartDate: string,
  initialData?: TaskResolution[],
) {
  return useQuery({
    queryKey: familyKeys.taskWeek(householdId, weekStartDate),
    queryFn: () => fetchTaskResolutions(createClient(), householdId, weekStartDate),
    staleTime: STALE_TIME,
    initialData,
  });
}

/** `enabled` is FR-357's "only while the displayed day is today", not an optimisation. */
export function useTaskCarryForward(
  householdId: string,
  todayDate: string,
  startWeekOn: WeekStart,
  enabled: boolean,
  initialData?: TaskResolution[],
) {
  return useQuery({
    queryKey: familyKeys.taskCarry(householdId, todayDate),
    queryFn: () => fetchTaskCarryForward(createClient(), householdId, todayDate, startWeekOn),
    staleTime: STALE_TIME,
    enabled,
    initialData,
  });
}

export function useTaskCursors(householdId: string, initialData?: TaskCursor[]) {
  return useQuery({
    queryKey: familyKeys.taskCursors(householdId),
    queryFn: () => fetchTaskCursors(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

/**
 * Read 5 (R314), and the only one that is not the board's: the Task Box's
 * seventeen-odd templates, which nobody looks at on a normal day.
 *
 * **Mounting is the `enabled`.** `TaskBoxSheet` is rendered only while the
 * sheet is open, so the fetch happens when it is opened and at no other time —
 * the shipped `useCategoryTaskCounts` shape, whose laziness is likewise the
 * dialog's own mount. It seeds nothing: the sheet is never part of a first
 * paint, so there is no server-rendered `initialData` to hand it.
 */
export function useTaskBox(householdId: string) {
  return useQuery({
    queryKey: familyKeys.taskBox(householdId),
    queryFn: () => fetchTaskBox(createClient(), householdId),
    staleTime: STALE_TIME,
  });
}

/**
 * Warms one neighbouring week's resolutions when the anchor settles, so a
 * Previous/Next tap across the week boundary lands on data already there — the
 * shipped `prefetchWeek` shape. Only the windowed reads need warming: read 2,
 * and from 004 on the star week beside it (R407), so the column's star pill
 * lands right on the first paint of the next week rather than flickering from
 * 0 while its own read catches up.
 */
export function prefetchTaskWeek(
  queryClient: QueryClient,
  householdId: string,
  weekStartDate: string,
): Promise<void> {
  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: familyKeys.taskWeek(householdId, weekStartDate),
      queryFn: () => fetchTaskResolutions(createClient(), householdId, weekStartDate),
      staleTime: STALE_TIME,
    }),
    queryClient.prefetchQuery({
      queryKey: familyKeys.starWeek(householdId, weekStartDate),
      queryFn: () => fetchStarWeek(createClient(), householdId, weekStartDate),
      staleTime: STALE_TIME,
    }),
  ]).then(() => undefined);
}

/* ------------------------------------------------------------------------- *
 * Rewards (Phase 4 — contracts/server-actions.md "Read path", research R407)
 * ------------------------------------------------------------------------- */

// One embed, joined rather than concatenated, for the reason `tasksSelect` is.
const REWARD_SELECT = rewardsSelect();

/** The two kinds that carry a day — the only ones FR-407's pill can sum. */
const DATED_KINDS = ["credit", "retraction"] as const;

/**
 * The board's fifth read (004 FR-407): the ledger entries EARNED in the
 * anchored week containing the displayed day — credits and retractions only,
 * windowed on `earned_on`, which for a late chore is the day it was ticked and
 * not the day it was due (FR-405). The window is `taskWeek`'s (`TASK_WEEK_DAYS`
 * from the same first day), so the two rolls together and stepping inside a
 * week costs nothing. The other three kinds have no day and are the balance's
 * business, not the pill's — they are left out here rather than filtered
 * client-side so the partial index `star_entries_day_idx` (025) serves the read.
 */
export async function fetchStarWeek(
  supabase: SupabaseClient,
  householdId: string,
  weekStartDate: string,
): Promise<StarEntry[]> {
  const weekEndDate = addDays(weekStartDate, TASK_WEEK_DAYS - 1);
  const { data, error } = await supabase
    .schema("family")
    .from("star_entries")
    .select(STAR_ENTRY_COLUMNS)
    .eq("household_id", householdId)
    .gte("earned_on", weekStartDate)
    .lte("earned_on", weekEndDate)
    .in("kind", [...DATED_KINDS]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as StarEntryRow[]).map(toStarEntry);
}

/**
 * The `family.star_balances` view (FR-412): one row per Profile, the sum of
 * their entries, which may be negative (Assumption 5). **Its own query, never a
 * PostgREST embed on `categories`**: a view has no foreign key to embed on, so
 * an embed would silently return nothing — the `task_cursors` finding (R309),
 * met again (R407).
 */
export async function fetchStarBalances(
  supabase: SupabaseClient,
  householdId: string,
): Promise<StarBalance[]> {
  const { data, error } = await supabase
    .schema("family")
    .from("star_balances")
    .select(STAR_BALANCE_COLUMNS)
    .eq("household_id", householdId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as StarBalanceRow[]).map(toStarBalance);
}

/**
 * Every reward with its eligibilities embedded (FR-417): unwindowed, oldest
 * first — the order `orderRewardCards` falls back to after affordability and
 * cost (FR-427). A card is drawn per eligible Profile from this one row.
 */
export async function fetchRewards(supabase: SupabaseClient, householdId: string): Promise<Reward[]> {
  const { data, error } = await supabase
    .schema("family")
    .from("rewards")
    .select(REWARD_SELECT)
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RewardWithEligibilitiesRow[]).map(toReward);
}

/**
 * Every redemption, standing AND reversed, newest first (FR-426, FR-431): the
 * standing ones decide a one-time reward's muted card, the Redeemed switch
 * shows them, and the history reads them all. Unwindowed on purpose — at a
 * household's scale that is a few hundred rows a year (R407), and the index
 * `redemptions_profile_idx` is already in this order.
 */
export async function fetchRedemptions(
  supabase: SupabaseClient,
  householdId: string,
): Promise<Redemption[]> {
  const { data, error } = await supabase
    .schema("family")
    .from("redemptions")
    .select(REDEMPTION_COLUMNS)
    .eq("household_id", householdId)
    .order("redeemed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RedemptionRow[]).map(toRedemption);
}

/** Seeded by `/family/tasks`'s page beside `taskWeek` (data-model "How the tab and the board are read"). */
export function useStarWeek(householdId: string, weekStartDate: string, initialData?: StarEntry[]) {
  return useQuery({
    queryKey: familyKeys.starWeek(householdId, weekStartDate),
    queryFn: () => fetchStarWeek(createClient(), householdId, weekStartDate),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useStarBalances(householdId: string, initialData?: StarBalance[]) {
  return useQuery({
    queryKey: familyKeys.balances(householdId),
    queryFn: () => fetchStarBalances(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useRewards(householdId: string, initialData?: Reward[]) {
  return useQuery({
    queryKey: familyKeys.rewards(householdId),
    queryFn: () => fetchRewards(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useRedemptions(householdId: string, initialData?: Redemption[]) {
  return useQuery({
    queryKey: familyKeys.redemptions(householdId),
    queryFn: () => fetchRedemptions(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

/* ------------------------------------------------------------------ lists -- */

/**
 * Every list of the household in the row's order (005 R506): unwindowed — a
 * household has a handful. The Parents only filter runs on the client over this
 * array (`visibleListsOf`), never here: RLS is by household and the punch-in is
 * the app's layer (R505).
 */
export async function fetchLists(supabase: SupabaseClient, householdId: string): Promise<List[]> {
  const rows = await fetchInRowOrder<ListRow>(supabase, "lists", LIST_COLUMNS, householdId);
  return rows.map(toList);
}

/**
 * The one read shape both list tables share: named columns, the household
 * filter, and the order every device draws — position, then age (R502).
 */
async function fetchInRowOrder<Row>(
  supabase: SupabaseClient,
  table: "lists" | "list_items",
  columns: string,
  householdId: string,
): Promise<Row[]> {
  const { data, error } = await supabase
    .schema("family")
    .from(table)
    .select(columns)
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

/**
 * Every item of every list, in position order (R506): one array feeds every
 * card's rows, badge and section counts, and the device's Completed switch hides
 * rows BELOW those counts (FR-505). Unwindowed on purpose — a few hundred rows at
 * most, and one invalidation reaches every card.
 */
export async function fetchListItems(supabase: SupabaseClient, householdId: string): Promise<ListItem[]> {
  const rows = await fetchInRowOrder<ListItemRow>(supabase, "list_items", LIST_ITEM_COLUMNS, householdId);
  return rows.map(toListItem);
}

/** Seeded by `/family/lists`'s page (data-model "How the tab is read"). */
export function useLists(householdId: string, initialData?: List[]) {
  return useQuery({
    queryKey: familyKeys.lists(householdId),
    queryFn: () => fetchLists(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}

export function useListItems(householdId: string, initialData?: ListItem[]) {
  return useQuery({
    queryKey: familyKeys.listItems(householdId),
    queryFn: () => fetchListItems(createClient(), householdId),
    staleTime: STALE_TIME,
    initialData,
  });
}
