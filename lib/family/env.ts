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

/**
 * The address of the ONE Supabase account the household shares (FR-002).
 *
 * It is not a `NEXT_PUBLIC_*` name, so it is never inlined into a browser
 * bundle, and nothing renders it: the sign-in form asks for a password only,
 * and the server pairs it with this address. There is deliberately no reader
 * for `FAMILY_ACCOUNT_PASSWORD` — Supabase validates the password, so nothing
 * at runtime ever needs to hold it (only `scripts/family-seed.mjs` does, to
 * create the account).
 */
export function familyAccountEmail(): string {
  return required("FAMILY_ACCOUNT_EMAIL", process.env.FAMILY_ACCOUNT_EMAIL);
}
