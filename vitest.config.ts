import {
  configDefaults,
  defineConfig,
  type TestProjectInlineConfiguration,
  type ViteUserConfig,
} from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { connect } from "node:net";

// Two projects (D20): `unit` is the jsdom suite every file used to run in;
// `policies` runs `lib/family/__tests__/policies/**` against the LOCAL Supabase
// stack (node environment, real Postgres) and only exists when that stack is up.
const POLICIES_DIR = "lib/family/__tests__/policies";
const POLICIES_GLOB = `${POLICIES_DIR}/**/*.test.ts`;

// Kong (the API gateway) port of `supabase start` for THIS repo — see
// supabase/config.toml; another project owns the CLI default 54321 on this machine.
const SUPABASE_HOST = process.env.SUPABASE_LOCAL_HOST ?? "127.0.0.1";
const SUPABASE_PORT = Number(process.env.SUPABASE_LOCAL_PORT ?? 55321);
// `FAMILY_POLICY_TESTS=1` turns "skip" into "fail" so nobody believes the
// policy suite ran when it did not (`npm run test:policies`).
const FORCE_POLICIES = process.env.FAMILY_POLICY_TESTS === "1";
// Each inline project re-evaluates this file (extends: true); print the notice once.
const NOTICE_FLAG = "FAMILY_POLICY_NOTICE_SHOWN";

// A TCP probe, not an HTTP call: Kong wants an apikey header, a socket does not.
function listening(host: string, port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ host, port });
    const finish = (up: boolean) => {
      socket.destroy();
      done(up);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

/** Is the local stack this repo's policy suite talks to accepting connections? */
function localSupabaseIsUp(): Promise<boolean> {
  return listening(SUPABASE_HOST, SUPABASE_PORT);
}

/**
 * The stack is down. Either the operator asked for the policy suite by name —
 * in which case silently skipping it would be a lie — or they get one notice
 * saying what they are missing and how to get it.
 */
function reportMissingStack(): void {
  if (FORCE_POLICIES) {
    throw new Error(
      `FAMILY_POLICY_TESTS=1 but nothing is listening on ${SUPABASE_HOST}:${SUPABASE_PORT}. ` +
        "Run `supabase start` (ports from supabase/config.toml) before `npm run test:policies`.",
    );
  }
  if (process.env[NOTICE_FLAG]) return;
  process.env[NOTICE_FLAG] = "1";
  console.warn(
    `\n[vitest] policies project SKIPPED — no local Supabase on ${SUPABASE_HOST}:${SUPABASE_PORT}.` +
      "\n         Run `supabase start && supabase db reset` to include it, " +
      "or set FAMILY_POLICY_TESTS=1 to fail instead.\n",
  );
}

// Required in Vitest 4: without `extends` an inline project loses the root
// plugins and the `@` alias.
const unitProject: TestProjectInlineConfiguration = {
  extends: true,
  test: {
    name: "unit",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "**/.next/**", `${POLICIES_DIR}/**`],
  },
};

const policiesProject: TestProjectInlineConfiguration = {
  extends: true,
  test: {
    name: "policies",
    environment: "node",
    include: [POLICIES_GLOB],
    globalSetup: [`./${POLICIES_DIR}/global-setup.ts`],
    // One shared fixture household per run — files must not interleave.
    fileParallelism: false,
    // bcrypt + a real network round-trip per assertion.
    testTimeout: 20_000,
  },
};

/** Which suites this run can honestly execute. */
function projectsFor(stackUp: boolean): TestProjectInlineConfiguration[] {
  if (stackUp) return [unitProject, policiesProject];
  reportMissingStack();
  return [unitProject];
}

export default defineConfig(async (): Promise<ViteUserConfig> => {
  const projects = projectsFor(await localSupabaseIsUp());

  return {
    plugins: [react()],
    resolve: {
      alias: { "@": resolve(__dirname, ".") },
    },
    test: {
      css: false,
      // Istanbul (not v8): fallow's CRAP scoring reads the Istanbul format, and
      // without real coverage every branchy function scores as if untested.
      coverage: {
        provider: "istanbul",
        reporter: ["text-summary", "json"],
        reportsDirectory: "./coverage",
        include: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "proxy.ts"],
        exclude: ["**/__tests__/**", "**/*.test.*", "app/**/layout.tsx", "app/**/page.tsx"],
      },
      projects,
    },
  };
});
