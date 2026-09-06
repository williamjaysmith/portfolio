import { expect, type Page } from "@playwright/test";

/**
 * 007 T013 — the door (FR-705, FR-713).
 *
 * The session is created by filling in the sign-in form, never by writing a
 * cookie: the run therefore proves the door before it proves anything else,
 * and a change that breaks sign-in fails the whole suite loudly rather than
 * being papered over by a hand-built session.
 */

export const HOUSEHOLD_PASSWORD = "family-dev-password";

/** Every tab of `/family`, in the order the shell lists them. */
export const TABS = ["calendar", "tasks", "rewards", "meals", "lists", "settings"] as const;
export type Tab = (typeof TABS)[number];

export async function signIn(page: Page, password = HOUSEHOLD_PASSWORD): Promise<void> {
  await page.goto("/family/sign-in");
  await page.getByLabel("Household password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Our Family" })).toBeVisible();
}

/** The one line that says a page really rendered for a signed-in member. */
export async function expectSignedIn(page: Page): Promise<void> {
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}

/**
 * The first request to a route in development compiles it. Warming every route
 * once, in the setup project, keeps that cost out of the first journey's
 * timeout (R704).
 */
export async function warmRoutes(page: Page): Promise<void> {
  for (const tab of TABS) {
    await page.goto(`/family/${tab}`);
    await expectSignedIn(page);
  }
}
