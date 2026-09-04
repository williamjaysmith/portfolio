import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/family/supabase/proxy";

/**
 * /family request interception (Next 16 `proxy.ts`, formerly middleware).
 *
 * THIS IS NOT AN AUTHORIZATION BOUNDARY (research R1). It exists to refresh
 * the Supabase session once per navigation and to bounce signed-out visitors
 * to the sign-in page as a convenience. Server Functions are POSTs that can
 * fall outside this matcher, and Next explicitly says proxy "should not be
 * your only line of defense". Every server action and page re-checks the
 * session and membership itself through `lib/family/guards.ts`.
 */

/** Reachable without a session: the sign-in flow and the PWA's static assets. */
const PUBLIC_ROUTES = [
  "/family/sign-in",
  "/family/not-authorized",
  "/family/manifest.webmanifest",
  "/family/icons",
  "/family/avatars",
  "/family/apple-icon.png",
];

const ROBOTS_HEADER = ["X-Robots-Tag", "noindex, nofollow"] as const;

/** Set by @supabase/ssr alongside refreshed auth cookies so no CDN caches them. */
const NO_CACHE_HEADERS = ["Cache-Control", "Expires", "Pragma"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, isAuthenticated } = await updateSession(request);
  // FR-007 belt: the family app is never indexed (the layout adds the braces).
  response.headers.set(...ROBOTS_HEADER);

  if (isAuthenticated || isPublicPath(request.nextUrl.pathname)) return response;

  const redirect = NextResponse.redirect(new URL("/family/sign-in", request.url));
  redirect.headers.set(...ROBOTS_HEADER);
  // A refreshed session must reach the browser even on the redirect, or the
  // single-use refresh token is burned and the next request is signed out.
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const name of NO_CACHE_HEADERS) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

export const config = {
  matcher: ["/family/:path*"],
};
