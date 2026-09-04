/**
 * Per-request Supabase client for Server Components, Server Actions and Route
 * Handlers. Never cache the result at module scope: it captures this request's
 * cookies.
 */

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { publicSupabaseEnv } from "../env";

export async function createClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = publicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, which cannot write cookies. Safe to
          // ignore: proxy.ts refreshes the session before the page renders.
        }
      },
    },
  });
}
