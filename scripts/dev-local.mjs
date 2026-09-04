/**
 * `next dev` pointed at the local Supabase stack instead of the hosted project.
 *
 * The overrides live here rather than inline in package.json so no key of any
 * shape is committed (see local-stack.mjs). `.env.local` still supplies
 * everything else Next needs; these three take precedence over it.
 */

import { spawn } from "node:child_process";

import { localStack } from "./local-stack.mjs";

const stack = localStack();

spawn("next", ["dev", "--turbopack"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: stack.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
    SUPABASE_SECRET_KEY: stack.secretKey,
    FAMILY_ACCOUNT_EMAIL: "dev@family.local",
  },
}).on("exit", (code) => process.exit(code ?? 0));
