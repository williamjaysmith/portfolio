import { TABS } from "../helpers/auth";
import { expect, test } from "../fixtures";

/**
 * 007 T019–T020, US1 — the journey that needs no knowledge of any feature.
 *
 * Every page of `/family` opens for a signed-in household member, renders its
 * own heading, survives a reload, and logs nothing to the console. This alone
 * catches what no test in the repository could: a page that throws on the
 * server, a missing environment variable, a bad import, a route that redirects
 * when it should not.
 */

const HEADINGS: Record<(typeof TABS)[number], string> = {
  calendar: "Our Family",
  tasks: "Our Family",
  rewards: "Our Family",
  meals: "Our Family",
  lists: "Our Family",
  settings: "Household",
};

const TITLES: Record<(typeof TABS)[number], RegExp> = {
  calendar: /^Calendar · Family$/,
  tasks: /^Tasks · Family$/,
  rewards: /^Rewards · Family$/,
  meals: /^Meals · Family$/,
  lists: /^Lists · Family$/,
  settings: /^Settings · Family$/,
};

for (const tab of TABS) {
  test(`${tab} renders for a signed-in household, with a clean console`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await page.goto(`/family/${tab}`);

    await expect(page).toHaveTitle(TITLES[tab]);
    await expect(page.getByRole("heading", { name: HEADINGS[tab], level: tab === "settings" ? 2 : 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    expect(problems, `${tab} logged to the console`).toEqual([]);
  });
}

test("the shell reaches every tab, and a reload keeps you there @responsive", async ({ page }) => {
  await page.goto("/family/calendar");

  for (const tab of TABS) {
    const label = tab[0].toUpperCase() + tab.slice(1);
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/family/${tab}$`));
    await expect(page).toHaveTitle(TITLES[tab]);

    // The server-rendered path, which no component test touches.
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/family/${tab}$`));
    await expect(page).toHaveTitle(TITLES[tab]);
  }
});
