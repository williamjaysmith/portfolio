import type { Metadata } from "next";

import { fetchBoundsOf, localDateOf, viewWindowOf, weekAnchorOf } from "@/lib/family/calendar/dates";
import { getMember } from "@/lib/family/guards";
import { fetchSettings, fetchWeekEvents } from "@/lib/family/queries";
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
 * It fetches `DEFAULT_COLUMN_COUNT` days because that is what the client
 * renders before it has measured itself; a narrower measured window simply
 * fetches its own, and `WeekView` only seeds the entry these rows belong to.
 *
 * The layout above is the gate: when there is no member or no settings row
 * it is already redirecting this whole render to sign-in or not-authorized,
 * so this page only has to decline to fetch, never to decide the door.
 */
export default async function CalendarPage() {
  const member = await getMember();
  if (member === null) return null;

  const supabase = await createClient();
  const settings = await fetchSettings(supabase, member.householdId);
  if (settings === null) return null;

  const anchorDate = currentAnchorDate(settings.timezone, settings.startWeekOn);
  const window = viewWindowOf(anchorDate, DEFAULT_COLUMN_COUNT, settings.timezone);
  const events = await fetchWeekEvents(supabase, member.householdId, fetchBoundsOf(window));

  return <WeekView initialAnchorDate={anchorDate} initialEvents={events} />;
}
