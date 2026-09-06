import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

import { STORAGE_STATE } from "../playwright.config";
import { expectNoSeriousViolations } from "./helpers/a11y";
import { unique as uniqueName } from "./helpers/names";
import { hideDevOverlay } from "./helpers/overlay";
import { actAs, punchOut, type PinnedProfile } from "./helpers/punch";
import { liveUpdateSupport, type LiveUpdateSupport } from "./helpers/realtime";

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
  /** Whether this environment can deliver a live update at all (FR-725). */
  liveUpdates: LiveUpdateSupport;
}

function actor(page: Page, profile: PinnedProfile) {
  return (action: () => Promise<void>) => actAs(page, profile, action);
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await hideDevOverlay(page);
    await use(page);
  },

  actAsAna: async ({ page }, use) => {
    await use(actor(page, "Ana"));
    // Leave nobody punched in, so the next journey starts where harness.md says.
    await punchOut(page, "Ana").catch(() => undefined);
  },

  actAsCleo: async ({ page }, use) => {
    await use(actor(page, "Cleo"));
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
    const todayLabel = await page
      .locator('section:has(header[aria-current="date"])')
      .first()
      .getAttribute("aria-label");
    await use({ todayLabel: todayLabel ?? "", timezone: "America/Chicago" });
  },

  axe: async ({ page }, use, testInfo) => {
    await use((label: string) => expectNoSeriousViolations(page, testInfo, label));
  },

  liveUpdates: async ({}, use) => {
    await use(await liveUpdateSupport());
  },
});

export { expect };
