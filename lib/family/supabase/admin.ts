import "server-only";

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only for the PIN RPCs (`set_pin` / `verify_pin` / `clear_pin`), storage
 * writes, signed URLs, and the guard re-reads in `guards.ts`. Every caller must
 * have already established who the user is through `requireMember()` and must
 * scope its own queries by household — nothing here does that for you.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { publicSupabaseEnv, serverSecrets } from "../env";

export function createAdminClient(): SupabaseClient {
  const { url } = publicSupabaseEnv();
  const { secretKey } = serverSecrets();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
