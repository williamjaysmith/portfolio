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

/**
 * Settings is behind `SettingsGate` — a parent has to be punched in before the
 * screen is drawn. Opens the door if it is up, and does nothing if it is not.
 *
 * **The door is only up once a parent HOLDS a PIN**, which is the no-lockout
 * rule `setProfilePin` enforces server-side and the gate mirrors: PINs are set
 * inside Settings, so gating the first one would lock the household out for
 * good. That is why the very first `setPin` of a run walks straight in and
 * every later one comes through here.
 */
async function openSettingsDoor(page: Page, authorise?: PinnedProfile): Promise<void> {
  const door = page.getByRole("button", { name: "Punch in" });
  // **Wait for one of the two, never poll once.** `SettingsGate` is a client
  // component, so a bare `isVisible()` straight after `goto` asks before React
  // has drawn anything and answers "no door" for a page that is about to have
  // one — the helper then walked past a gate that was still arriving and every
  // later locator timed out. Racing the door against the screen behind it
  // settles as soon as either exists, whichever way this household is set up.
  await Promise.race([
    door.waitFor({ state: "visible", timeout: 15_000 }),
    page.getByRole("heading", { name: "Household" }).waitFor({ state: "visible", timeout: 15_000 }),
  ]).catch(() => null);
  if (!(await door.isVisible().catch(() => false))) return;
  if (authorise === undefined) {
    throw new Error("Settings is gated and no Profile was given to open it with");
  }
  await door.click();
  await enterPin(page, authorise, PINS[authorise]);
}

/**
 * Go to Settings and get through the door — what every journey that reads or
 * changes a setting now has to do, because the tab is a parent's.
 *
 * `authorise` defaults to Ana, the seed's parent with a PIN. A journey that has
 * already punched in as a parent passes through untouched.
 */
export async function gotoSettings(page: Page, authorise: PinnedProfile = "Ana"): Promise<void> {
  await page.goto("/family/settings");
  await openSettingsDoor(page, authorise);
}

/** Sets a Profile's PIN through Settings. Idempotent: one that exists is reset to the same digits. */
export async function setPin(page: Page, profile: string, pin: string, authorise?: PinnedProfile): Promise<void> {
  await page.goto("/family/settings");
  await openSettingsDoor(page, authorise);
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
  // The sheet closes when the actor is in; the write it interrupted resumes
  // from there, so a journey that carried on now would be racing it.
  await expect(pad).toBeHidden();
}

/**
 * Answer the sheet if it opened; do nothing if the actor was still punched in.
 *
 * **It waits for the sheet, but only when a sheet is actually owed.** A bare
 * `isVisible()` asks the instant the write is submitted, and the sheet is a
 * round trip away — so a slow render read as "no sheet", the helper walked past
 * an unanswered dialog, and the write never happened. That is a race, so it
 * failed intermittently and looked like a flake.
 *
 * Waiting unconditionally would be the obvious fix and the wrong one: `actAs`
 * wraps every write in this suite, and most of them run with somebody already
 * punched in and no sheet coming — a blanket timeout would add minutes per run
 * to the common path. The actor BADGE settles which case this is: no badge
 * means nobody is in, so a sheet is on its way and is worth waiting for.
 */
export async function answerPunchIn(page: Page, profile: PinnedProfile): Promise<void> {
  const sheet = punchSheet(page);
  if (await sheet.isVisible().catch(() => false)) {
    await enterPin(page, profile, PINS[profile]);
    return;
  }
  if ((await page.getByRole("button", { name: /^Punched in as / }).count()) > 0) return;
  await sheet.waitFor({ state: "visible", timeout: 8_000 }).catch(() => null);
  if (await sheet.isVisible().catch(() => false)) await enterPin(page, profile, PINS[profile]);
}

/**
 * Do something that writes, as this Profile: run it, answer the sheet if the
 * app asks, and let the interrupted write finish by itself.
 */
export async function actAs(page: Page, profile: PinnedProfile, action: () => Promise<void>): Promise<void> {
  await action();
  await answerPunchIn(page, profile);
}

/**
 * The badge that says who is in. 014 turned it from a pill reading
 * `● Ana  Punch out` into the person's face in a circle, so the NAME is on the
 * trigger and the way out is in the panel behind it.
 */
export function actorBadge(page: Page, profile: string) {
  return page.getByRole("button", { name: `Punched in as ${profile}` });
}

/** Two taps now: open the badge, then punch out from inside it. */
export async function punchOut(page: Page, profile: string): Promise<void> {
  const badge = actorBadge(page, profile);
  if (!(await badge.isVisible())) return;
  await badge.click();
  await page.getByRole("button", { name: "Punch out" }).click();
  await expect(badge).toBeHidden();
}

export function isPunchedIn(page: Page, profile: string): Promise<boolean> {
  return actorBadge(page, profile).isVisible();
}
