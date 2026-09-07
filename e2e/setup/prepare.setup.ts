import { test as setup, expect } from "@playwright/test";

import { STORAGE_STATE } from "../../playwright.config";
import { signIn, warmRoutes } from "../helpers/auth";
import { hideDevOverlay } from "../helpers/overlay";
import { PINS, setPin } from "../helpers/punch";
import { requireLocalStack, resetAndSeed } from "../helpers/stack";

/**
 * 007 T018 — everything a journey may assume, done once (harness.md §1).
 *
 * A setup *project* rather than a global hook, so each step appears in the
 * report, a failure carries a trace, and the same helpers the journeys use are
 * used here (R703).
 *
 * The order matters. The stack must be up before anything; the reset must
 * precede the seed; the household account only exists after the seed; a PIN can
 * only be set once signed in; and Cleo's PIN is a gated write, because by then
 * Ana holds one — which is exactly the rule Phase 1 shipped (FR-018), proved
 * here before any journey depends on it.
 */

setup.describe.configure({ mode: "serial" });

setup("the local stack is up", async () => {
  const url = await requireLocalStack();
  expect(url, "the stack answered, so the suite has somewhere to run").toContain("127.0.0.1");
});

setup("reset and seed", async () => {
  setup.setTimeout(300_000);
  await resetAndSeed();
});

setup("sign in and save the session", async ({ page }) => {
  setup.setTimeout(120_000);
  await hideDevOverlay(page);
  await signIn(page);
  await page.context().storageState({ path: STORAGE_STATE });
});

/**
 * From here on the steps need the session the step above saved: each setup test
 * gets its own browser context, so the state has to be loaded rather than
 * inherited.
 */
setup.describe("with the saved session", () => {
  setup.use({ storageState: STORAGE_STATE });

  setup("set the PINs the seed never sets", async ({ page }) => {
    setup.setTimeout(120_000);
    await hideDevOverlay(page);
    // The first PIN in a household needs no punch-in: there would be nobody to
    // authorise it (FR-018). The second does, and Ana is now that somebody.
    await setPin(page, "Ana", PINS.Ana);
    await setPin(page, "Cleo", PINS.Cleo, "Ana");
    await page.getByRole("button", { name: "Punch out Ana" }).click();
  });

  setup("warm every route", async ({ page }) => {
    setup.setTimeout(180_000);
    await warmRoutes(page);
  });
});
