/**
 * Session refresh for the root `proxy.ts` (@supabase/ssr 0.12 pattern).
 *
 * Supabase refresh tokens are single-use; refreshing once per navigation here
 * — before any Server Component renders — keeps the browser and server from
 * racing each other and logging the user out.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicSupabaseEnv } from "../env";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; isAuthenticated: boolean }> {
  const { url, publishableKey } = publicSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Refreshed tokens go to the downstream render via the request…
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // …and to the browser via the response, together with the
        // Cache-Control/Expires/Pragma headers that stop a CDN from caching a
        // response that carries someone's session.
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): the refresh
  // has to happen first, and getClaims() verifies the JWT signature rather than
  // trusting whatever the cookie says (getSession() would).
  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims);

  return { response, isAuthenticated };
}
