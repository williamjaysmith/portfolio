import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron";
import { createAdminClient } from "@/lib/family/supabase/admin";

/**
 * A daily query that stops the Supabase project being paused for inactivity.
 *
 * **The problem.** The household's database is on Supabase's Free plan, which
 * pauses a project that shows too little activity across a rolling 7-day
 * window. A paused project does not wake on its own — somebody has to restore
 * it from the dashboard — so a week away from home is enough to come back to a
 * calendar that will not load.
 *
 * **Why a real query and not a ping.** Supabase's own wording is "a few user
 * requests to the database each day", and what it counts is *user database
 * queries*. Loading the dashboard does not count, and neither does an HTTP
 * request that never reaches Postgres — so this reads a row rather than merely
 * returning 200. `categories` is the table chosen because it is small, always
 * non-empty in a real household, and carries nothing sensitive.
 *
 * **Daily, not every second or third day**, which was the first instinct. The
 * pause window is 7 days, but the bar is activity on the days *within* it, so a
 * 2–3 day cadence leaves gaps that may still read as idle. Vercel's Hobby plan
 * allows exactly one cron run per day, which is the cadence this needs.
 *
 * **It lives under `/api`, deliberately.** `proxy.ts` matches `/family/:path*`
 * and would redirect an unauthenticated call to the sign-in page, which would
 * make the scheduler's request a 302 that never touches the database. Out here
 * there is no session in front of it, so `CRON_SECRET` is what guards it —
 * see `lib/cron.ts` for why that comparison is constant-time.
 *
 * **This is insurance, not a load-bearing part of the app.** On any week the
 * family opens the calendar, their own queries have already kept the project
 * awake and this run changes nothing.
 */

// The whole point is to reach Postgres on every invocation; a cached response
// would keep the project just as idle as no request at all.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.schema("family").from("categories").select("id").limit(1);

  if (error) {
    // Surfaced rather than swallowed: a failing keep-alive is the one signal
    // that the project is already unreachable, and Vercel logs a non-2xx run.
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
