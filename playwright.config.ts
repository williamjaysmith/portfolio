import { defineConfig, devices } from "@playwright/test";

/**
 * 007 T002–T004: the browser-driven pass over `/family`.
 *
 * **Four screen sizes, two engines** (R702, R705): the wall tablet runs
 * Chromium, because that is what the wall display runs; the tablet and phone
 * run WebKit, because the family's iPads and iPhones do whatever browser is
 * installed on them, and emulating an iPad with Chromium would prove the
 * layout while lying about the engine. Only the journeys tagged `@responsive`
 * repeat on the three device profiles — the rest would re-prove logic that
 * does not vary by size, at four times the cost (FR-704, FR-724).
 *
 * **One prepared database per run** (R703): the `setup` project resets and
 * seeds the local stack, signs in once, sets the PINs the seed never sets and
 * warms every route. Every other project depends on it and inherits its saved
 * session. Files run one at a time against that one database, so a journey
 * owns the data it writes (R706, FR-706).
 *
 * **Local only, always** (FR-703): the server is the repository's own
 * `dev:local`, which resolves the local stack's keys itself. There is no
 * address, key or flag here that could point anywhere else.
 */

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** The saved sign-in, written by the setup project. Gitignored. */
export const STORAGE_STATE = "e2e/.auth/household.json";

/** The journeys FR-724 names — the ones whose layout genuinely differs. */
const RESPONSIVE = /@responsive/;

export default defineConfig({
  testDir: "e2e",
  // One database, one worker: a journey's rows must not race another's (R706).
  fullyParallel: false,
  workers: 1,
  // A retry would hide the flake this suite exists to surface.
  retries: 0,
  // A journey waits for what it expects; nothing here sleeps (FR-710).
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    // FR-708: artefacts on a failure, none on a pass.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  webServer: {
    // The same script the hand walks use, so "local only" is inherited rather
    // than re-implemented here (R704).
    command: "npm run dev:local",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "wall",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "tablet-landscape",
      grep: RESPONSIVE,
      use: { ...devices["Desktop Safari"], viewport: { width: 1024, height: 768 }, hasTouch: true, storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "tablet-portrait",
      grep: RESPONSIVE,
      use: { ...devices["Desktop Safari"], viewport: { width: 768, height: 1024 }, hasTouch: true, storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
    {
      name: "phone",
      grep: RESPONSIVE,
      use: { ...devices["iPhone 13"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
});
