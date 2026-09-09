import type { Metadata } from "next";
import { cookies } from "next/headers";

import { fetchBoundsOf, localDateOf, viewWindowOf, weekAnchorOf } from "@/lib/family/calendar/dates";
import { COLUMNS_COOKIE, parseColumnCount } from "@/lib/family/calendar/device-columns";
import { getMember } from "@/lib/family/guards";
import { fetchMealCategories, fetchMeals, fetchRecipes, fetchSettings, fetchWeekEvents } from "@/lib/family/queries";
import { createClient } from "@/lib/family/supabase/server";
import type { HouseholdSettings } from "@/lib/family/types";
import { DEFAULT_COLUMN_COUNT } from "@/lib/family/week-geometry";

import { WeekView } from "./components/WeekView";

export const metadata: Metadata = { title: "Calendar" };

/**
 * The household's CURRENT first day at request time. A named helper, not an
 * inline `Date.now()`: this is an async server request handler where reading
 * the wall clock is the point, but the React purity lint reads any capitalised
 * component body as a render and (rightly, for browsers) refuses impure calls
 * there. `HouseholdSettings["timezone"]` etc. keep the call sites honest.
 */
/**
 * How many day columns to draw before the browser has measured anything —
 * this device's remembered width (012), or the default for one that has never
 * told us. Its own function so the page below states what it fetches rather
 * than how it learned the number, and so the two ways a cookie says nothing
 * (absent, or not a count a grid could produce) are answered in one place.
 */
async function seededColumnCount(): Promise<number> {
  const stored = (await cookies()).get(COLUMNS_COOKIE)?.value;
  return parseColumnCount(stored) ?? DEFAULT_COLUMN_COUNT;
}

function currentAnchorDate(
  zone: HouseholdSettings["timezone"],
  startWeekOn: HouseholdSettings["startWeekOn"],
): string {
  return weekAnchorOf(localDateOf(zone, Date.now()), startWeekOn);
}

/**
 * The Week calendar (T033, R207): a server component that fetches the window
 * beginning today under the signed-in session (RLS, the server client — never
 * the admin client) and seeds `WeekView` with it, so the wall tablet's first
 * paint already shows the week with no loading state — the same seeding
 * pattern the `(app)` layout uses for `FamilyProvider`.
 *
 * How many days it fetches is how many columns THIS DEVICE drew last time
 * (012, `device-columns.ts`), falling back to `DEFAULT_COLUMN_COUNT` for a
 * device that has never said. A server cannot measure a viewport, and the
 * default is a tablet's width, so before the cookie every phone painted seven
 * columns, re-laid-out to three, and threw away the seven days of events the
 * seed had just shipped it. The cookie is a hint and the mounted grid is still
 * the truth: a rotated device is wrong for one paint, which is what every load
 * used to be.
 *
 * The layout above is the gate: when there is no member or no settings row
 * it is already redirecting this whole render to sign-in or not-authorized,
 * so this page only has to decline to fetch, never to decide the door.
 */
export default async function CalendarPage() {
  const member = await getMember();
  if (member === null) return null;

  const supabase = await createClient();
  const columnCount = await seededColumnCount();

  // 012: only the EVENTS read depends on the settings, because only it needs a
  // window — and a window needs the household's timezone and start-of-week.
  // The three meal reads are keyed by the household alone, so they have no
  // reason to wait. This was two round trips of one-then-four; it is now two of
  // four-then-one, which on a server a region away from the database is a whole
  // trip saved on every calendar render.
  const [settings, mealCategories, recipes, meals] = await Promise.all([
    fetchSettings(supabase, member.householdId),
    fetchMealCategories(supabase, member.householdId),
    fetchRecipes(supabase, member.householdId),
    fetchMeals(supabase, member.householdId),
  ]);
  if (settings === null) return null;

  const anchorDate = currentAnchorDate(settings.timezone, settings.startWeekOn);
  const window = viewWindowOf(anchorDate, columnCount, settings.timezone);
  // 006 FR-634: the meal reads ride the same request, so the tokens are on the first paint too.
  const events = await fetchWeekEvents(supabase, member.householdId, fetchBoundsOf(window));

  return (
    <WeekView
      initialAnchorDate={anchorDate}
      initialColumnCount={columnCount}
      initialEvents={events}
      initialMeals={meals}
      initialMealCategories={mealCategories}
      initialRecipes={recipes}
    />
  );
}
