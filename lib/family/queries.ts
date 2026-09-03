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

import {
  CATEGORY_COLUMNS,
  EVENT_CATEGORY_COLUMNS,
  EVENT_COLUMNS,
  EVENT_EXCEPTION_COLUMNS,
  HOUSEHOLD_COLUMNS,
  SETTINGS_COLUMNS,
  toCategory,
  toEvent,
  toHousehold,
  toSettings,
  type CategoryRow,
  type EventWithRelationsRow,
  type HouseholdRow,
  type HouseholdSettingsRow,
} from "./rows";
import { createClient } from "./supabase/client";
import type { Category, Event, Household, HouseholdSettings } from "./types";

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
  /**
   * The cache unit is the ANCHORED week, never the phone slice (R207):
   * `weekStartISO` is the household-start-of-week date as `YYYY-MM-DD` in the
   * household's timezone — one canonical key per week however it was reached.
   */
  week: (householdId: string, weekStartISO: string) =>
    ["family", "events", householdId, weekStartISO] as const,
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
 * The fetch bounds of one anchored week, derived by the caller
 * (`lib/family/calendar/dates.ts`) from the week-start date and the
 * household's timezone. Instant bounds serve the timed branch, date bounds
 * the all-day branch — collapsing them would fabricate a
 * midnight-in-some-zone (data-model, "How the week is read").
 */
export interface WeekFetchBounds {
  /**
   * First day of the week, `YYYY-MM-DD` in the household zone — the cache
   * identity (R207) and the all-day lower bound.
   */
  startDate: string;
  /** Last day of the week, `YYYY-MM-DD` — inclusive, as `end_date` is (FR-225). */
  endDate: string;
  /** ISO instant of the window's opening midnight; timed one-offs must end strictly after it. */
  startsAt: string;
  /** ISO instant of the NEXT week's opening midnight — an exclusive bound. */
  endsAt: string;
}

// The week read embeds the ordered links and EVERY exception with each event
// row — that totality is what makes a moved occurrence findable (R206).
const WEEK_EVENT_COLUMNS =
  `${EVENT_COLUMNS}, event_categories(${EVENT_CATEGORY_COLUMNS}), ` +
  `event_exceptions(${EVENT_EXCEPTION_COLUMNS})`;

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
    queryKey: familyKeys.week(householdId, weekWindow.startDate),
    queryFn: () => fetchWeekEvents(createClient(), householdId, weekWindow),
    staleTime: STALE_TIME,
    initialData,
  });
}

/**
 * Warms one anchored week's cache entry. Called for each neighbour of a
 * settled anchor (`weekStart` ± 7 days, windows derived by the caller), so a
 * week-boundary swipe lands on data already there (R207/FR-279); a swipe
 * inside the anchored week costs zero fetches by construction.
 */
export function prefetchWeek(
  queryClient: QueryClient,
  householdId: string,
  weekWindow: WeekFetchBounds,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: familyKeys.week(householdId, weekWindow.startDate),
    queryFn: () => fetchWeekEvents(createClient(), householdId, weekWindow),
    staleTime: STALE_TIME,
  });
}
