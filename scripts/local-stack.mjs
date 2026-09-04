/**
 * Where the local Supabase stack's credentials come from.
 *
 * The CLI mints the same publishable and secret keys for every local install,
 * so they are public constants rather than secrets — but they carry the shape
 * of a real service-role key, and GitHub's push protection rightly refuses a
 * repository that contains one. Hard-coding them also teaches the habit that
 * eventually commits a real one. So they live in the gitignored `.env.local`
 * and are read from the environment, with `supabase status -o env` as the
 * fallback, which is where the CLI publishes them anyway.
 */

import { execFileSync } from "node:child_process";

const LOCAL_URL_DEFAULT = "http://127.0.0.1:55321";

let cached = null;

function fromStatus() {
  const text = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const read = (key) => text.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, "m"))?.[1];
  return {
    url: read("API_URL"),
    secretKey: read("SECRET_KEY") ?? read("SERVICE_ROLE_KEY"),
    publishableKey: read("PUBLISHABLE_KEY") ?? read("ANON_KEY"),
  };
}

/**
 * Never throws for the URL — only the keys are worth failing over, and the
 * message names the one command that produces them.
 */
function resolved(env) {
  const fromEnv = {
    url: env.SUPABASE_LOCAL_URL,
    secretKey: env.SUPABASE_LOCAL_SECRET_KEY,
    publishableKey: env.SUPABASE_LOCAL_PUBLISHABLE_KEY,
  };
  return fromEnv.secretKey ? fromEnv : { ...fromEnv, ...fromStatus() };
}

export function localStack(env = process.env) {
  if (cached) return cached;
  const stack = resolved(env);
  if (!stack.secretKey) {
    throw new Error(
      "The local stack's keys are unknown. Run `supabase start`, then either let this read " +
        "`supabase status`, or put SUPABASE_LOCAL_SECRET_KEY and SUPABASE_LOCAL_PUBLISHABLE_KEY " +
        "in .env.local.",
    );
  }
  cached = { ...stack, url: stack.url || LOCAL_URL_DEFAULT };
  return cached;
}
