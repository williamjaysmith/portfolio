/**
 * Environment access for /family.
 *
 * Deliberately free of `server-only` so unit tests (and the browser client)
 * can import `publicSupabaseEnv`; `admin.ts` and `actor.ts` carry that guard.
 *
 * `NEXT_PUBLIC_*` values are read with literal `process.env.NAME` expressions
 * (not a dynamic lookup) so Next.js can inline them into the browser bundle.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[family] Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function publicSupabaseEnv(): { url: string; publishableKey: string } {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function serverSecrets(): { secretKey: string; actorSecret: string } {
  return {
    secretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    actorSecret: required("FAMILY_ACTOR_SECRET", process.env.FAMILY_ACTOR_SECRET),
  };
}

/** True for a `supabase start` stack (127.0.0.1 / localhost on any port). */
export function isLocalSupabase(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
}
