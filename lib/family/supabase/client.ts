/**
 * Browser Supabase client (Client Components only).
 *
 * `createBrowserClient` is a singleton by default, so calling this from many
 * components still yields one client — and one Realtime socket.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { publicSupabaseEnv } from "../env";

export function createClient(): SupabaseClient {
  const { url, publishableKey } = publicSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
