import { showDay, strip } from "../helpers/board";
import { optionLabel } from "../helpers/controls";
import { expect, test } from "../fixtures";

/**
 * 007 T048–T055, US6 — the Meals tab and its tokens on the calendar
 * (FR-719, FR-720).
 *
 * The newest code in the app, and the only surfaces mounted by two different
 * pages: the popover a meal chip opens on the grid is the same popover a token
 * opens on the Week calendar. A browser is the only place that claim can be
 * checked.
 *
 * The seed leaves four mealtimes, seven recipes (one removed from the library
 * but still planned) and this week's meals, including a Friday pizza that
 * repeats weekly.
 */

/**
 * One day's slot. Empty it is a button — "Sunday 6 September, Lunch, empty" —
 * and filled it is a group of the meals in it, named the same way. Journeys
 * always work inside a slot: several days can hold the same recipe, and the
 * seed plans Banana bread on the Saturday.
 */
function emptyCell(page: import("@playwright/test").Page, day: string, mealtime: string) {
  return page.getByRole("button", { name: new RegExp(`^${day}.*${mealtime}, empty`) });
}

/**
 * A mealtime that is genuinely empty on `day`, read off the grid rather than
 * assumed.
 *
 * This journey used to name **Lunch**, and Lunch is free on today only six days
 * a week: the seed plants one on `sunday + 3`, so every Wednesday run failed at
 * the first click. Nothing else is safe to hard-code either — Breakfast is
 * taken on Sunday and Snack on Saturday — so the journey asks the grid which
 * slot is open instead of guessing. Found by 011's browser pass, on a
 * Wednesday.
 */
async function anEmptyMealtime(
  page: import("@playwright/test").Page,
  day: string,
): Promise<string> {
  const cell = page.getByRole("button", { name: new RegExp(`^${day}.*, empty$`) }).first();
  await expect(cell, `${day} has at least one free mealtime`).toBeVisible();

  const label = (await cell.getAttribute("aria-label")) ?? "";
  const mealtime = /,\s*([^,]+),\s*empty$/.exec(label)?.[1];
  if (mealtime === undefined) throw new Error(`could not read a mealtime from "${label}"`);
  return mealtime;
}

function filledCell(page: import("@playwright/test").Page, day: string, mealtime: string) {
  return page.getByRole("group", { name: new RegExp(`^${day}.*${mealtime}`) });
}

/**
 * Brings a seeded meal into the window, paging backwards if it sits behind today.
 *
 * **Why this is needed at all (013).** The seed anchors its meals on the week's
 * SUNDAY and spreads them at +0, +3 and +6 days. The grid's window used to begin
 * on that same Sunday, so every fixture was on screen. Since 013 the window
 * begins on TODAY — so on, say, a Thursday the Sunday breakfast and the Wednesday
 * dinners are in the past and not drawn.
 *
 * How far back they are depends on what day the suite runs, which is why this
 * pages until it finds the meal rather than clicking a fixed number of times.
 * Bounded, so a genuinely missing meal fails as a missing meal rather than
 * spinning.
 */
async function findSeededMeal(
  page: import("@playwright/test").Page,
  name: string,
): Promise<import("@playwright/test").Locator> {
  const meal = page.getByRole("button", { name }).first();
  for (let back = 0; back < 3; back += 1) {
    if ((await meal.count()) > 0) return meal;
    await page.getByRole("button", { name: /^Previous / }).click();
    await page.waitForTimeout(200);
  }
  await expect(meal, `${name} is not on the grid, forwards or back`).toBeVisible();
  return meal;
}

test.describe("the Meals tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/meals");
  });

  test("plans a meal from a saved recipe, and it survives a reload @responsive", async ({ page, actAsAna, household }) => {
    const today = household.todayLabel;
    expect(today, "the grid marks one day as today").not.toBe("");
    const mealtime = await anEmptyMealtime(page, today);

    await actAsAna(async () => {
      await emptyCell(page, today, mealtime).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      // The chips and rows are painted labels over screen-reader-only radios.
      await optionLabel(page, sheet, "All").click();
      await optionLabel(page, sheet, "Banana bread").click();
      await sheet.getByRole("button", { name: "Save" }).click();
    });

    const slot = filledCell(page, today, mealtime);
    await expect(slot.getByRole("button", { name: "Banana bread" })).toBeVisible();

    // A reload puts the grid back on the week's first day, and a two-column
    // phone does not hold today there (012, `showDay`). Page to it as a person
    // would before asking whether the meal survived.
    await page.reload();
    await showDay(page, today);
    await expect(filledCell(page, today, mealtime).getByRole("button", { name: "Banana bread" })).toBeVisible();

    // Take it back off the plan, from the popover this journey also proves.
    await actAsAna(async () => {
      await filledCell(page, today, mealtime).getByRole("button", { name: "Banana bread" }).click();
      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByRole("button", { name: "Delete meal" }).click();
    });
    // The slot is a button again once the write lands; reloading first would
    // cancel it. The Saturday's seeded Banana bread is untouched throughout.
    await expect(emptyCell(page, today, mealtime)).toBeVisible();

    await page.reload();
    await showDay(page, today);
    await expect(emptyCell(page, today, mealtime)).toBeVisible();
  });

  test("opens a meal's popover and reaches its recipe from there", async ({ page }) => {
    await (await findSeededMeal(page, "🍝 Spaghetti")).click();
    const popover = page.getByRole("dialog", { name: "🍝 Spaghetti" });
    await expect(popover).toBeVisible();
    for (const action of ["Open Recipe", "Add to List", "Edit", "Delete"]) {
      await expect(popover.getByRole("button", { name: action })).toBeVisible();
    }

    await popover.getByRole("button", { name: "Open Recipe" }).click();
    const detail = page.getByRole("article", { name: "🍝 Spaghetti" });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("parmesan");
  });

  test("filters and searches the recipes pane", async ({ page }) => {
    await page.getByRole("button", { name: "Recipes" }).click();
    const pane = page.getByRole("dialog", { name: "Recipes" });
    const listed = pane.getByRole("list", { name: "Recipes" }).getByRole("button");

    await expect(listed).not.toHaveCount(0);
    await optionLabel(page, pane, "Breakfast").click();
    await expect(listed.first()).toContainText("Pancakes");

    await optionLabel(page, pane, "All").click();
    await pane.getByRole("searchbox", { name: "Search recipes" }).fill("parmesan");
    await expect(listed).toHaveCount(1);
    await expect(listed.first()).toContainText("Spaghetti");

    // A recipe removed from the library is not offered, though meals keep it.
    await pane.getByRole("searchbox", { name: "Search recipes" }).fill("stew");
    await expect(pane.getByText("No recipes match.")).toBeVisible();
  });

  test("pushes a recipe's chosen lines onto a list, and the Lists tab has them", async ({ page, actAsAna }) => {
    await (await findSeededMeal(page, "🍝 Spaghetti")).click();
    await page.getByRole("button", { name: "Add to List" }).click();

    const sheet = page.getByRole("dialog", { name: /Add 🍝 Spaghetti to a list/ });
    await expect(sheet).toBeVisible();
    // The instructions are unticked; only the ingredients travel.
    for (const line of ["Soften the onion and garlic.", "Add the tomatoes, simmer 20 min.", "Toss with the pasta."]) {
      await sheet.getByRole("checkbox", { name: line }).uncheck();
    }
    await sheet.getByRole("combobox", { name: "List" }).selectOption({ label: "Grocery List" });

    await actAsAna(async () => {
      await sheet.getByRole("button", { name: "Save" }).click();
    });
    await expect(page.getByText(/items added to Grocery List/)).toBeVisible();

    await page.goto("/family/lists");
    const grocery = page.getByRole("region", { name: "Grocery List", exact: true });
    await expect(grocery.getByRole("checkbox", { name: "500 g spaghetti" })).toBeVisible();
    await expect(grocery.getByRole("checkbox", { name: "parmesan" })).toBeVisible();
    await expect(grocery.getByRole("checkbox", { name: "Toss with the pasta." })).toHaveCount(0);
  });

  test("asks the scope before changing a repeating meal, and keeps the rest of the series", async ({ page, actAsAna }) => {
    const pizza = page.getByRole("button", { name: "🍕 Pizza" });
    await expect(pizza.first()).toBeVisible();

    await pizza.first().click();
    await page.getByRole("dialog", { name: "🍕 Pizza" }).getByRole("button", { name: "Edit" }).click();

    // A repeating meal asks first, in its own words.
    await expect(page.getByRole("heading", { name: "Edit repeating meal" })).toBeVisible();
    await page.getByRole("radio", { name: "This meal" }).check();
    await page.getByRole("button", { name: "Continue" }).click();

    const sheet = page.getByRole("dialog", { name: "Edit meal" });
    await actAsAna(async () => {
      await sheet.getByRole("textbox", { name: /Note/ }).fill("Only this Friday");
      await sheet.getByRole("button", { name: "Save" }).click();
    });
    await expect(sheet).toBeHidden();

    await page.reload();
    // The note lands on that one occurrence and on no other. Next week's Pizza
    // is the seed's skipped one, so the week after is where the series shows
    // again — moved to its Saturday by the seeded exception.
    await expect(page.getByRole("button", { name: "🍕 Pizza" }).first()).toHaveAttribute("title", "Only this Friday");
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByRole("button", { name: "🍕 Pizza" })).toHaveCount(0);
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByRole("button", { name: "🍕 Pizza" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "🍕 Pizza" }).first()).not.toHaveAttribute("title", "Only this Friday");
  });

  test("shows the week's meals on the calendar, and hides them on this device @responsive", async ({ page }) => {
    await page.goto("/family/calendar");
    const tokens = page.getByRole("list", { name: "Meals" });
    await expect(tokens).toBeVisible();

    // A token is named by its mealtime and its meal, and opens the same popover
    // the grid does. Which meals are on screen depends on how many day columns
    // fit, so the journey takes the first token the week is showing rather than
    // naming one that a narrow screen may have paged away.
    const token = tokens.getByRole("button").first();
    const name = (await token.getAttribute("aria-label")) ?? "";
    expect(name, "a token says its mealtime and its meal").toMatch(/^[^:]+: .+/);
    await token.click();
    await expect(page.getByRole("dialog", { name: name.split(": ")[1] })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("dialog").getByRole("checkbox", { name: "Show Meals on the calendar" }).uncheck();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("list", { name: "Meals" })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("list", { name: "Meals" })).toHaveCount(0);

    // The Meals tab itself is untouched by a switch that belongs to this device.
    // How many days are on screen depends on the width, so the journey pages
    // the week the way a person does until a planned meal shows.
    await page.goto("/family/meals");
    const planned = page.getByRole("group", { name: /, \d+ meals?$/ });
    for (let day = 0; day < 7 && (await planned.count()) === 0; day += 1) {
      await strip(page, "Meals").press("ArrowRight");
    }
    await expect(planned.first()).toBeVisible();

    await page.goto("/family/calendar");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("button", { name: "Show all" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("list", { name: "Meals" })).toBeVisible();
  });
});

/**
 * 013 — the grid's day navigation (FR-1301–FR-1307).
 *
 * These run `@responsive`, at all four widths, because the defect they cover
 * existed only where seven columns did not fit: the arrows moved seven days while
 * two were on screen, so five days per step were reachable only by a swipe. At
 * the wall's width the same rule is indistinguishable from the old behaviour,
 * which is the point — one rule, not a special case.
 *
 * What they cannot check is the midnight hold (FR-1308): the clock helper refuses
 * jumps over three hours, so that guarantee lives in
 * `meals/components/__tests__/useMealWindow.test.ts` and nowhere else.
 */
test.describe("the Meals grid's day navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/family/meals");
  });

  /**
   * The day columns on show, in order — **once the grid has settled**.
   *
   * The wait is not defensive padding, it is the grid's actual behaviour: the
   * server cannot measure a viewport, so the first paint draws the unmeasured
   * ceiling of seven and the measurement then narrows it to what fits. On a phone
   * that is seven columns replaced by two, within the initial paint — CLS stays 0,
   * but a journey that counts columns immediately counts seven and then fails
   * confusingly a line later.
   *
   * Settled means two reads in a row agree, which is cheaper and less brittle
   * than guessing at a count per width.
   */
  async function daysShown(page: import("@playwright/test").Page): Promise<string[]> {
    let previous: string[] = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const current = await page.locator("section > header").allInnerTexts();
      if (current.length > 0 && current.length === previous.length) return current;
      previous = current;
      await page.waitForTimeout(100);
    }
    return previous;
  }

  test("the arrows move the window by exactly the days on show @responsive", async ({ page }) => {
    const first = await daysShown(page);
    expect(first.length, "the grid draws at least one day column").toBeGreaterThan(0);

    await page.getByRole("button", { name: /^Next / }).click();
    const second = await daysShown(page);

    // Same width, and no day seen twice — which is what "moves by the days on
    // show" means and what the shipped behaviour broke on a narrow screen.
    expect(second).toHaveLength(first.length);
    for (const day of second) expect(first, `${day} was shown twice`).not.toContain(day);

    await page.getByRole("button", { name: /^Previous / }).click();
    expect(await daysShown(page)).toEqual(first);
  });

  test("the arrows say how far they go @responsive", async ({ page }) => {
    const drawn = (await daysShown(page)).length;
    // "week" where seven days is the width, "N days" otherwise — a week is not a
    // special case, it is what seven days is called.
    const distance = drawn === 7 ? "week" : drawn === 1 ? "day" : `${drawn} days`;

    await expect(page.getByRole("button", { name: `Next ${distance}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Previous ${distance}` })).toBeVisible();
  });

  test("opens on today, and Today brings it back @responsive", async ({ page, household }) => {
    const today = household.todayLabel;
    expect(today, "the grid marks one day as today").not.toBe("");

    // Today is the FIRST column, not merely somewhere in the window.
    const opensOn = (await daysShown(page))[0];
    const todayHeader = await page
      .locator('section:has(header[aria-current="date"]) > header')
      .first()
      .innerText();
    expect(opensOn).toBe(todayHeader);

    await page.getByRole("button", { name: /^Next / }).click();
    await expect(page.getByRole("button", { name: "Today" })).toBeEnabled();

    await page.getByRole("button", { name: "Today" }).click();
    expect((await daysShown(page))[0]).toBe(todayHeader);
    await expect(page.getByRole("button", { name: "Today" })).toBeDisabled();
  });

  test("skips no day across several steps @responsive", async ({ page }) => {
    // The property a household notices, walked the way they walk it. Under the
    // shipped behaviour a two-column window stepping seven days saw 4 of 14.
    const seen: string[] = [];
    for (let step = 0; step < 4; step += 1) {
      seen.push(...(await daysShown(page)));
      await page.getByRole("button", { name: /^Next / }).click();
    }

    expect(new Set(seen).size, "a day was shown twice").toBe(seen.length);
  });
});
