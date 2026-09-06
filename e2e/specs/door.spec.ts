import { HOUSEHOLD_PASSWORD, TABS } from "../helpers/auth";
import { expect, test } from "../fixtures";

/**
 * 007 T023, US2 — the door (FR-713).
 *
 * Nobody reaches `/family` without the household's password. This is the one
 * part of the app where being wrong is a privacy failure rather than an
 * inconvenience, so it is proved from both sides: turned away, let in, and
 * turned away again after signing out.
 *
 * These journeys use a browser with no session at all, so they are the only
 * ones in the suite that do not inherit the run's sign-in.
 */

test.describe("the door", () => {
  test("sends a browser with no session to sign-in, from every page @responsive", async ({ signedOut }) => {
    for (const tab of TABS) {
      await signedOut.goto(`/family/${tab}`);
      await expect(signedOut).toHaveURL(/\/family\/sign-in$/);
      await expect(signedOut.getByRole("heading", { name: "Family calendar" })).toBeVisible();
    }
  });

  test("refuses a wrong password, in the household's words, and opens nothing", async ({ signedOut }) => {
    await signedOut.goto("/family/sign-in");
    await signedOut.getByLabel("Household password").fill("not-the-password");
    await signedOut.getByRole("button", { name: "Sign in" }).click();

    // The message, not the role: Next's own route announcer is an alert too.
    await expect(signedOut.getByText("That password isn't right.")).toBeVisible();
    await expect(signedOut).toHaveURL(/\/family\/sign-in$/);
  });

  test("admits the household password, and signing out closes the door again @responsive", async ({ signedOut }) => {
    await signedOut.goto("/family/sign-in");
    await signedOut.getByLabel("Household password").fill(HOUSEHOLD_PASSWORD);
    await signedOut.getByRole("button", { name: "Sign in" }).click();

    await expect(signedOut).toHaveURL(/\/family\/calendar$/);
    await expect(signedOut.getByRole("navigation", { name: "Primary" })).toBeVisible();

    await signedOut.goto("/family/settings");
    await signedOut.getByRole("button", { name: "Sign out" }).click();
    await expect(signedOut).toHaveURL(/\/family\/sign-in$/);

    // And the session really is gone, not merely navigated away from.
    await signedOut.goto("/family/lists");
    await expect(signedOut).toHaveURL(/\/family\/sign-in$/);
  });
});
