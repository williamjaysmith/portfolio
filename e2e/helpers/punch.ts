import { expect, type Page } from "@playwright/test";

/**
 * 007 T014 — the punch-in gate (FR-705, FR-714).
 *
 * **There is no "punch in" button.** The app asks at the moment of the write:
 * an action that needs an actor opens the "who's here?" sheet, and once a PIN
 * is entered the write it interrupted goes through on its own. So a journey
 * does not punch in and then write — it writes, and answers the question if it
 * is asked. `actAs` is that shape, and it is the only way this suite gets an
 * actor: a hand-built cookie would prove nothing.
 *
 * PINs are never seeded, so the setup project sets them through Settings, the
 * way a parent does.
 */

/** The PINs this run works with. Set by the setup project; used by the fixtures. */
export const PINS = { Ana: "1234", Cleo: "2468" } as const;
export type PinnedProfile = keyof typeof PINS;

const SHEET = "Who's here?";

/**
 * One Profile's row on the Settings page, found by the control only that row
 * has. Settings holds six rows and a household form, so "Save" and "Confirm"
 * mean nothing until they are scoped to a row.
 */
export function profileRow(page: Page, profile: string) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: `Move ${profile} up` }) });
}

/** Sets a Profile's PIN through Settings. Idempotent: one that exists is reset to the same digits. */
export async function setPin(page: Page, profile: string, pin: string, authorise?: PinnedProfile): Promise<void> {
  await page.goto("/family/settings");
  const row = profileRow(page, profile);
  await row.getByRole("button", { name: new RegExp(`(Set|Reset) ${profile}'s PIN`) }).click();
  await row.getByLabel("New PIN").fill(pin);
  await row.getByLabel("Confirm").fill(pin);
  await row.getByRole("button", { name: "Save" }).click();
  // Once any parent holds a PIN this is itself a gated write (FR-018).
  if (authorise !== undefined) await answerPunchIn(page, authorise);
  await expect(row.getByRole("button", { name: `Reset ${profile}'s PIN` })).toBeVisible();
}

/** Is the punch-in sheet on screen? */
export function punchSheet(page: Page) {
  return page.getByRole("dialog", { name: SHEET });
}

/**
 * Choose the Profile and enter the PIN on an already-open sheet. The sheet
 * renames itself from "Who's here?" to the Profile once one is chosen, so each
 * step is scoped to the dialog it is on — a bare `dialog` would be ambiguous
 * whenever a sheet is open behind it.
 */
export async function enterPin(page: Page, profile: string, pin: string): Promise<void> {
  await punchSheet(page).getByRole("button", { name: profile, exact: true }).click();
  const pad = page.getByRole("dialog", { name: profile });
  for (const digit of pin) await pad.getByRole("button", { name: digit, exact: true }).click();
}

/** Answer the sheet if it opened; do nothing if the actor was still punched in. */
export async function answerPunchIn(page: Page, profile: PinnedProfile): Promise<void> {
  const sheet = punchSheet(page);
  if (await sheet.isVisible()) await enterPin(page, profile, PINS[profile]);
}

/**
 * Do something that writes, as this Profile: run it, answer the sheet if the
 * app asks, and let the interrupted write finish by itself.
 */
export async function actAs(page: Page, profile: PinnedProfile, action: () => Promise<void>): Promise<void> {
  await action();
  await answerPunchIn(page, profile);
}

export async function punchOut(page: Page, profile: string): Promise<void> {
  const out = page.getByRole("button", { name: `Punch out ${profile}` });
  if (await out.isVisible()) await out.click();
}

export function isPunchedIn(page: Page, profile: string): Promise<boolean> {
  return page.getByRole("button", { name: `Punch out ${profile}` }).isVisible();
}
