import { test as base, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

import { STORAGE_STATE } from "../playwright.config";
import { expectNoSeriousViolations } from "./helpers/a11y";
import { strip } from "./helpers/board";
import { clearLeftovers } from "./helpers/leftovers";
import { unique as uniqueName } from "./helpers/names";
import { hideDevOverlay } from "./helpers/overlay";
import { actAs, punchOut, type PinnedProfile } from "./helpers/punch";
import { clearStaleSubscriptions, liveUpdateSupport, type LiveUpdateSupport } from "./helpers/realtime";

/**
 * 007 T017 — the extended `test` every journey imports (harness.md §2).
 *
 * A journey never imports `@playwright/test` directly, so every journey gets
 * the same guarantees: the signed-in session, a way to write as a Profile that
 * answers the punch-in sheet the app raises, names it owns, a second browser
 * for the live-update journeys, and the accessibility sweep.
 */

export interface HouseholdFacts {
  /** Today as the app writes it on the Meals grid — "Wednesday 9 September". */
  todayLabel: string;
  /** The household's zone, which is what every date in the app is expressed in. */
  timezone: string;
}

interface Fixtures {
  /** Write as this Profile: runs the action, answers the sheet if the app asks. */
  actAsAna: (action: () => Promise<void>) => Promise<void>;
  /** The same as Cleo, for the journeys that must see what a member sees. */
  actAsCleo: (action: () => Promise<void>) => Promise<void>;
  /** A page with no session, for the door's journeys. */
  signedOut: Page;
  /** A second, independent browser signed in to the same household. */
  secondBrowser: Page;
  /** A name unique to this journey and stable across runs. */
  unique: (base: string) => string;
  /** What the app believes today is. */
  household: HouseholdFacts;
  /** Fails the current page on any serious or critical accessibility violation. */
  axe: (label: string) => Promise<void>;
  /**
   * Whether this environment can deliver a live update at all (FR-725).
   *
   * A function, not a value, and that is the whole point (012): fixtures resolve
   * before the test body, so a value was always measured before either browser
   * had navigated. Call it once both pages are on `/family`.
   */
  liveUpdates: () => Promise<LiveUpdateSupport>;
  /**
   * Automatic. Removes what this journey created, pass or fail (012).
   *
   * harness.md §4 rule 3 already asks every journey to remove its own data, and
   * they do — but a journey that FAILS never reaches its cleanup, and the next
   * journey inherits the rows. One flaky journey was taking six others down with
   * it. See `helpers/leftovers.ts` for the two measured cases.
   */
  ownData: void;
}

function actor(page: Page, profile: PinnedProfile) {
  return (action: () => Promise<void>) => actAs(page, profile, action);
}

/**
 * Today's column label, read off the Meals grid — **paging to it if it is not on
 * screen** (012).
 *
 * This fixture used to read the first `aria-current="date"` column and trust it
 * to be there. On the wall tablet it always is. **On a phone it is not**: the
 * grid anchors on the week's first day and draws only the columns that fit, so a
 * two-column phone opens on Sunday and Monday and a Wednesday is two pages away.
 * The fixture then waited the full sixty seconds and failed the journey in its
 * setup — the standing `phone` failure in `meals.spec:62`, blamed on "a narrow
 * grid" without the cause ever being named.
 *
 * The paging itself is `showDay`, shared with the journeys that need it after a
 * reload. The app stays the source of truth for what today is; the fixture just
 * stops assuming today is in the first window it is handed.
 */
async function todayOnTheGrid(page: Page): Promise<string> {
  const todayColumn = page.locator('section:has(header[aria-current="date"])').first();
  if ((await todayColumn.count()) === 0) await pageToToday(page, todayColumn);
  return (await todayColumn.getAttribute("aria-label")) ?? "";
}

/** Pages right until the grid marks one of its visible columns as today. */
async function pageToToday(page: Page, todayColumn: Locator): Promise<void> {
  for (let paged = 0; paged < 7; paged += 1) {
    await strip(page, "Meals").press("ArrowRight");
    if ((await todayColumn.count()) > 0) return;
  }
}

/**
 * A journey that ends with a dialog open would leave the shell unclickable for
 * the teardown below, and the failure would name the teardown rather than the
 * journey. Escape first, then punch out.
 */
async function closeAnyDialog(page: Page): Promise<void> {
  if (page.isClosed()) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await page.locator("dialog[open]").count()) === 0) return;
    await page.keyboard.press("Escape");
  }
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await hideDevOverlay(page);
    await use(page);
  },

  actAsAna: async ({ page }, use) => {
    await use(actor(page, "Ana"));
    // Leave nobody punched in, so the next journey starts where harness.md says.
    await closeAnyDialog(page).catch(() => undefined);
    await punchOut(page, "Ana").catch(() => undefined);
  },

  actAsCleo: async ({ page }, use) => {
    await use(actor(page, "Cleo"));
    await closeAnyDialog(page).catch(() => undefined);
    await punchOut(page, "Cleo").catch(() => undefined);
  },

  signedOut: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await hideDevOverlay(page);
    await use(page);
    await context.close();
  },

  secondBrowser: async ({ browser }, use) => {
    let context: BrowserContext | undefined;
    try {
      context = await browser.newContext({ storageState: STORAGE_STATE });
      const page = await context.newPage();
      await hideDevOverlay(page);
      await use(page);
    } finally {
      await context?.close();
    }
  },

  unique: async ({}, use, testInfo) => {
    await use((base_: string) => uniqueName(base_, testInfo));
  },

  household: async ({ page }, use) => {
    // The app is the source of truth for "today": the fixtures it draws were
    // seeded against the household's own clock, not this machine's (FR-711).
    // The Meals grid names each day column, and marks one of them as today.
    await page.goto("/family/meals");
    await use({ todayLabel: await todayOnTheGrid(page), timezone: "America/Chicago" });
  },

  axe: async ({ page }, use, testInfo) => {
    await use((label: string) => expectNoSeriousViolations(page, testInfo, label));
  },

  ownData: [
    async ({}, use, testInfo) => {
      await use();
      // **Only after a FAILURE**, and the cost is the reason (012). A passing
      // journey removes its own rows (harness.md §4 rule 3), so there is nothing
      // here to do — and doing it anyway cost a Postgres connection and fifteen
      // deletes after each of 143 tests, which took the suite from 8.5 minutes
      // to 19.5 and failed twenty-seven journeys on timeouts it had caused
      // itself. A teardown that makes the suite slower than the cascade it
      // prevents is not worth having.
      //
      // A failure is the case that matters anyway: it is the journey that never
      // reached its own cleanup.
      if (testInfo.status === testInfo.expectedStatus) return;

      const removed = await clearLeftovers();
      const left = Object.entries(removed)
        .map(([table, count]) => `${count} ${table}`)
        .join(", ");
      // Named in the report rather than swept up silently: what a failed journey
      // left behind is evidence about the failure.
      if (left !== "") testInfo.annotations.push({ type: "left behind", description: left });
    },
    { auto: true },
  ],

  liveUpdates: async ({}, use) => {
    // Rows in `realtime.subscription` outlive the socket that made them, so a
    // count taken without clearing first reports "live updates work here" on
    // any machine that has ever run the app. Cleared before either browser has
    // navigated, so whatever the journey counts was registered by the journey.
    await clearStaleSubscriptions();
    await use(liveUpdateSupport);
  },
});

export { expect };
